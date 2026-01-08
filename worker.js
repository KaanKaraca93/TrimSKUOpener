// Worker Dyno - Background Job Processor
// Bu dosya ayrı bir dyno olarak çalışır (Procfile'da tanımlı)
require('dotenv').config();

const axios = require('axios');
const XLSX = require('xlsx');
const db = require('./db');
const plmService = require('./plm-service');

// Worker ayarları
const POLL_INTERVAL = 5000; // 5 saniye (database'i kontrol etme sıklığı)
const MAX_CONCURRENT_JOBS = 1; // Aynı anda kaç job işlensin

let isProcessing = false;
let shutdownRequested = false;

/**
 * Ana işleme fonksiyonu - Server.js'teki process-xml endpoint'inin aynısı
 */
async function processJob(job) {
    const jobId = job.id;
    const excelUrl = job.excel_url;

    try {
        console.log(`\n${'='.repeat(70)}`);
        console.log(`🔄 JOB İŞLENİYOR: ${jobId}`);
        console.log(`📄 Excel URL: ${job.item_id} - ${job.doc_type}`);
        console.log(`${'='.repeat(70)}\n`);

        // Job'u processing olarak işaretle
        await db.markJobAsProcessing(jobId);

        // ADIM 1: Excel'i indir
        await db.updateJobStatus(jobId, 'processing', {
            currentStep: 'Excel indiriliyor...'
        });

        console.log('📥 ADIM 1: Excel dosyası indiriliyor...');
        const response = await axios.get(excelUrl, { 
            responseType: 'arraybuffer',
            timeout: 60000
        });
        console.log('✅ Excel indirildi, boyut:', response.data.length, 'bytes');

        // ADIM 2: Excel'i oku
        await db.updateJobStatus(jobId, 'processing', {
            currentStep: 'Excel okunuyor...'
        });

        console.log('📖 ADIM 2: Excel okunuyor...');
        const workbook = XLSX.read(response.data, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: null });

        if (jsonData.length === 0) {
            throw new Error('Excel dosyası boş');
        }

        console.log(`✅ Excel okundu: ${jsonData.length} satır bulundu`);

        await db.updateJobStatus(jobId, 'processing', {
            totalRows: jsonData.length
        });

        // ADIM 3: Validasyon
        await db.updateJobStatus(jobId, 'processing', {
            currentStep: 'Validasyon yapılıyor...'
        });

        console.log('🔍 ADIM 3: Validasyon yapılıyor...');
        
        const REQUIRED_HEADERS = ['Trim Kodu', 'Renk Kodu', 'Beden Kodu', 'YeniEge Barkod'];
        const MANDATORY_FIELDS = ['Trim Kodu', 'Renk Kodu', 'YeniEge Barkod'];

        const headers = Object.keys(jsonData[0]);
        const missingHeaders = REQUIRED_HEADERS.filter(h => !headers.includes(h));

        if (missingHeaders.length > 0) {
            throw new Error(`Eksik başlık(lar): ${missingHeaders.join(', ')}`);
        }

        const emptyFields = [];
        jsonData.forEach((row, index) => {
            MANDATORY_FIELDS.forEach(field => {
                const value = row[field];
                if (value === null || value === undefined || value.toString().trim() === '') {
                    emptyFields.push({
                        row: index + 2,
                        field: field
                    });
                }
            });
        });

        if (emptyFields.length > 0) {
            throw new Error(`Zorunlu alanlar boş: ${JSON.stringify(emptyFields)}`);
        }

        console.log('✅ Tüm validasyonlar başarılı');

        // ADIM 4: PLM ile eşleştir
        await db.updateJobStatus(jobId, 'processing', {
            currentStep: 'PLM ile eşleştirme yapılıyor...'
        });

        console.log('🔗 ADIM 4: PLM ile eşleştirme yapılıyor...');
        const plmResult = await plmService.processExcelDataWithPLM(jsonData);

        if (!plmResult.success) {
            throw new Error(`PLM eşleştirme hatası: ${plmResult.error}`);
        }

        console.log('✅ PLM eşleştirme tamamlandı');
        
        const matchedData = plmResult.data?.results || [];
        const unmatchedData = plmResult.data?.errors || [];
        
        console.log(`📊 Eşleştirilen: ${matchedData.length}, Eşleştirilememiş: ${unmatchedData.length}`);

        // ADIM 5: TrimSKU oluştur
        await db.updateJobStatus(jobId, 'processing', {
            currentStep: 'TrimSKU oluşturuluyor...'
        });

        console.log('💾 ADIM 5: TrimSKU oluşturuluyor...');
        const writeResult = await plmService.writeMatchedDataToPLM(matchedData);

        if (!writeResult.success) {
            throw new Error(`TrimSKU oluşturma hatası: ${writeResult.error}`);
        }

        console.log('✅ TrimSKU oluşturma tamamlandı');
        console.log(`   ${writeResult.data.results.length} Trim için yeni SKU yaratıldı`);
        console.log(`   ${writeResult.data.skippedSKUs} SKU zaten mevcuttu (atlandı)`);

        // ADIM 6: Yeni yaratılan SKU'ların ID'lerini al
        let newSkusWithIds = [];
        
        if (writeResult.data.results.length > 0) {
            await db.updateJobStatus(jobId, 'processing', {
                currentStep: 'Yeni SKU ID\'leri alınıyor...'
            });

            console.log('🔎 ADIM 6: Yeni yaratılan SKU ID\'leri alınıyor...');
            const trimIds = writeResult.data.results.map(r => r.trimId);
            const fetchSkusResult = await plmService.fetchCreatedSKUs(trimIds);

            if (!fetchSkusResult.success) {
                throw new Error(`SKU ID alma hatası: ${fetchSkusResult.error}`);
            }

            console.log('✅ Yeni SKU ID\'leri alındı');

            // ADIM 7: Yeni SKU'ları Excel ile eşleştir
            await db.updateJobStatus(jobId, 'processing', {
                currentStep: 'Yeni SKU\'lar Excel ile eşleştiriliyor...'
            });

            console.log('🔗 ADIM 7: Yeni SKU\'lar Excel ile eşleştiriliyor...');
            const matchSkuResult = plmService.matchExcelWithSKUs(matchedData, fetchSkusResult.data);
            newSkusWithIds = matchSkuResult.data.matchedData;
            console.log('✅ Eşleştirme tamamlandı');
        } else {
            console.log('⚠️  ADIM 6-7: Yeni SKU yok, atlandı');
        }

        // ✅ Mevcut SKU'ları (skipped) ekle
        const existingSkusWithIds = writeResult.data.skipped || [];
        console.log(`📦 Mevcut SKU'lar: ${existingSkusWithIds.length}`);
        
        // ✅ TÜM SKU'ları birleştir (yeni + mevcut)
        const allSkusForBarcode = [...newSkusWithIds, ...existingSkusWithIds];
        console.log(`📊 Toplam ${allSkusForBarcode.length} SKU barcode için hazır`);

        // ADIM 8: TÜM SKU'lara (yeni + mevcut) barcode ata
        await db.updateJobStatus(jobId, 'processing', {
            currentStep: `Barkodlar atanıyor... (0/${allSkusForBarcode.length})`
        });

        console.log('🏷️ ADIM 8: TÜM SKU\'lara (yeni + mevcut) barcode atanıyor...');
        console.log(`   Toplam: ${allSkusForBarcode.length} SKU`);
        
        // Progress tracking için custom function
        let processedBarcodes = 0;
        const barcodeResults = [];
        
        for (const item of allSkusForBarcode) {
            const skuId = item.plmData.skuId;
            const barcode = item.excelData.barcode;

            console.log(`\n   📌 [${processedBarcodes + 1}/${allSkusForBarcode.length}] SKU ${skuId} güncelleniyor... (Barkod: ${barcode})`);

            const result = await plmService.updateSKUBarcode(skuId, barcode);

            if (result.success) {
                console.log(`   ✅ Başarılı!`);
                barcodeResults.push({
                    rowNumber: item.rowNumber,
                    skuId: skuId,
                    barcode: barcode,
                    status: 'success'
                });
            } else {
                console.error(`   ❌ Hata: ${result.error}`);
                barcodeResults.push({
                    rowNumber: item.rowNumber,
                    skuId: skuId,
                    barcode: barcode,
                    status: 'failed',
                    error: result.error
                });
            }

            processedBarcodes++;

            // Progress güncelle (her 10 barkodda bir)
            if (processedBarcodes % 10 === 0 || processedBarcodes === allSkusForBarcode.length) {
                await db.updateJobStatus(jobId, 'processing', {
                    currentStep: `Barkodlar atanıyor... (${processedBarcodes}/${allSkusForBarcode.length})`,
                    processedRows: processedBarcodes
                });
            }

            // Rate limiting
            if (processedBarcodes < allSkusForBarcode.length) {
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }

        const successfulBarcodes = barcodeResults.filter(r => r.status === 'success').length;
        const failedBarcodes = barcodeResults.filter(r => r.status === 'failed').length;

        console.log(`\n✅ Barkod atama tamamlandı: ${successfulBarcodes} başarılı, ${failedBarcodes} hatalı`);

        // FINAL: Job'u tamamlandı olarak işaretle
        const finalResult = {
            success: true,
            message: 'XML işleme ve PLM yazma işlemi başarıyla tamamlandı',
            xmlInfo: {
                itemId: job.item_id,
                docType: job.doc_type
            },
            summary: {
                totalRows: jsonData.length,
                matchedRows: matchedData.length,
                unmatchedRows: unmatchedData.length,
                createdSKUs: writeResult.data.results.length,
                failedSKUs: writeResult.data.errors.length,
                assignedBarcodes: successfulBarcodes,
                failedBarcodes: failedBarcodes
            },
            details: {
                matched: matchedData,
                unmatched: unmatchedData,
                skuResults: writeResult.data.results,
                barcodeResults: barcodeResults
            }
        };

        await db.updateJobStatus(jobId, 'completed', {
            completedAt: new Date(),
            result: finalResult,
            processedRows: matchedSkus.length
        });

        console.log(`\n${'='.repeat(70)}`);
        console.log(`✅ JOB TAMAMLANDI: ${jobId}`);
        console.log(`📊 ${jsonData.length} satır işlendi`);
        console.log(`✅ ${successfulBarcodes} barkod atandı`);
        console.log(`${'='.repeat(70)}\n`);

    } catch (error) {
        console.error(`\n❌ JOB BAŞARISIZ: ${jobId}`);
        console.error(`Hata: ${error.message}`);
        if (error.stack) {
            console.error('Stack:', error.stack);
        }

        await db.updateJobStatus(jobId, 'failed', {
            error: error.message,
            completedAt: new Date()
        });
    }
}

/**
 * Pending job'ları işle
 */
async function processPendingJobs() {
    if (isProcessing || shutdownRequested) {
        return;
    }

    try {
        isProcessing = true;

        const pendingJobs = await db.getPendingJobs(MAX_CONCURRENT_JOBS);

        if (pendingJobs.length === 0) {
            // Sessiz kal, her 5 saniyede log basmaya gerek yok
            return;
        }

        console.log(`\n📋 ${pendingJobs.length} pending job bulundu`);

        for (const job of pendingJobs) {
            if (shutdownRequested) {
                console.log('⏹️  Shutdown talebi, yeni job işlenmeyecek');
                break;
            }

            await processJob(job);
        }

    } catch (error) {
        console.error('❌ Worker döngüsü hatası:', error.message);
    } finally {
        isProcessing = false;
    }
}

/**
 * Worker'ı başlat
 */
async function startWorker() {
    console.log('='.repeat(70));
    console.log('👷 WORKER DYNO BAŞLATILIYOR...');
    console.log('='.repeat(70));

    // Database'i initialize et
    try {
        await db.initializeDatabase();
        console.log('✅ Database hazır');
    } catch (error) {
        console.error('❌ Database initialization hatası:', error);
        process.exit(1);
    }

    console.log(`⏱️  Poll interval: ${POLL_INTERVAL}ms`);
    console.log(`🔄 Max concurrent jobs: ${MAX_CONCURRENT_JOBS}`);
    console.log('🚀 Worker aktif, pending job'lar işlenecek...\n');

    // Ana döngü
    setInterval(() => {
        processPendingJobs().catch(error => {
            console.error('❌ Process pending jobs hatası:', error);
        });
    }, POLL_INTERVAL);

    // İlk kontrolü hemen yap
    processPendingJobs().catch(error => {
        console.error('❌ Process pending jobs hatası:', error);
    });
}

/**
 * Graceful shutdown
 */
process.on('SIGTERM', async () => {
    console.log('\n⏹️  SIGTERM sinyali alındı, graceful shutdown başlıyor...');
    shutdownRequested = true;

    // Aktif job'ların bitmesini bekle (max 30 saniye)
    let waitTime = 0;
    const maxWaitTime = 30000;

    while (isProcessing && waitTime < maxWaitTime) {
        console.log(`⏳ Aktif job bitmesi bekleniyor... (${waitTime / 1000}s)`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        waitTime += 1000;
    }

    if (isProcessing) {
        console.log('⚠️  Timeout, zorla kapatılıyor');
    }

    await db.closePool();
    console.log('👋 Worker kapatıldı');
    process.exit(0);
});

// Worker'ı başlat
startWorker().catch(error => {
    console.error('❌ Worker başlatma hatası:', error);
    process.exit(1);
});

