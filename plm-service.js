const axios = require('axios');
const PLM_CONFIG = require('./plm-config');

/**
 * PLM Token Alma Fonksiyonu
 */
async function getToken() {
    try {
        console.log('🔑 PLM Token alınıyor...');
        
        const params = new URLSearchParams();
        params.append('grant_type', 'password');
        params.append('client_id', PLM_CONFIG.CLIENT_ID);
        params.append('client_secret', PLM_CONFIG.CLIENT_SECRET);
        params.append('username', PLM_CONFIG.USERNAME);
        params.append('password', PLM_CONFIG.PASSWORD);
        
        const tokenResponse = await axios.post(
            PLM_CONFIG.TOKEN_URL,
            params.toString(),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json'
                }
            }
        );
        
        console.log('✅ Token başarıyla alındı');
        return {
            success: true,
            token: tokenResponse.data.access_token,
            expiresIn: tokenResponse.data.expires_in
        };
        
    } catch (error) {
        console.error('❌ Token alma hatası:', error.message);
        if (error.response) {
            console.error('   Status:', error.response.status);
            console.error('   Data:', error.response.data);
        }
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Birden fazla Trim Kodu için toplu PLM sorgusu
 * Performans için tüm trim'leri tek sorguda çeker
 */
async function getTrimsWithDetails(trimCodes) {
    try {
        console.log(`\n🔍 ${trimCodes.length} adet Trim sorgulanıyor...`);
        console.log(`   Trim Kodları: ${trimCodes.join(', ')}`);
        
        // Token al
        const tokenResult = await getToken();
        if (!tokenResult.success) {
            throw new Error(`Token alınamadı: ${tokenResult.error}`);
        }

        const token = tokenResult.token;
        
        // IN operatörü ile tüm trim'leri tek sorguda çek (Size bilgileriyle birlikte)
        const trimCodesFormatted = trimCodes.map(code => `'${code}'`).join(',');
        const trimApiUrl = `${PLM_CONFIG.BASE_API_URL}/odata2/api/odata2/Trim?$filter=Code in (${trimCodesFormatted})&$expand=TrimColorways($select=TrimColorwayId,Code),TrimSizeRange($select=TrimId,Id,SizeRangeId;$expand=TrimSizes($select=SizeId;$expand=Size($select=SizeId,SizeCode)))&$select=Id,Code`;
        
        console.log('📡 PLM API çağrısı yapılıyor...');
        const response = await axios.get(trimApiUrl, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'X-Infor-Tenantid': PLM_CONFIG.TENANT,
                'Content-Type': 'application/json'
            }
        });

        const trims = response.data?.value;
        
        if (!trims || trims.length === 0) {
            throw new Error(`Trim kodları bulunamadı: ${trimCodes.join(', ')}`);
        }

        console.log(`✅ ${trims.length} adet Trim bulundu`);
        
        // Trim'leri Code'a göre map'e dönüştür (hızlı erişim için)
        const trimMap = {};
        trims.forEach(trim => {
            // TrimSizeRange array içinde olabilir, ilk elemanı al
            const sizeRangeData = Array.isArray(trim.TrimSizeRange) && trim.TrimSizeRange.length > 0 
                ? trim.TrimSizeRange[0] 
                : null;
            
            trimMap[trim.Code] = {
                trimId: trim.Id,
                trimCode: trim.Code,
                colorways: trim.TrimColorways || [],
                sizeRange: sizeRangeData,
                sizes: sizeRangeData?.TrimSizes || []
            };
        });

        return {
            success: true,
            data: trimMap
        };

    } catch (error) {
        console.error(`❌ Trim sorgu hatası: ${error.message}`);
        if (error.response) {
            console.error('   Response:', JSON.stringify(error.response.data, null, 2));
        }
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Renk kodunu colorway listesinde bul
 */
function findColorway(colorways, colorCode) {
    // Excel'den sayı olarak gelebilir, string'e çevir
    const colorCodeStr = String(colorCode).toUpperCase();
    
    const colorway = colorways.find(
        (c) => String(c.Code).toUpperCase() === colorCodeStr
    );
    
    if (!colorway) {
        const availableColors = colorways.map(c => c.Code).join(', ');
        throw new Error(`Renk kodu "${colorCode}" bulunamadı. Mevcut renkler: ${availableColors}`);
    }
    
    return colorway;
}

/**
 * Beden kodunu size listesinde bul
 */
function findSize(sizes, sizeCode) {
    if (!sizeCode || sizeCode.toString().trim() === '') {
        return null; // Opsiyonel alan
    }
    
    // Size bilgileri TrimSizes[$expand=Size] ile geliyor
    // Size.SizeCode ile eşleştir
    const matchedSize = sizes.find(
        (s) => s.Size?.SizeCode?.toUpperCase() === sizeCode.toString().toUpperCase()
    );
    
    if (!matchedSize) {
        // Eşleşme bulunamadı, mevcut size kodlarını göster
        const availableSizes = sizes
            .filter(s => s.Size?.SizeCode)
            .map(s => s.Size.SizeCode)
            .join(', ');
        
        if (availableSizes) {
            console.warn(`      ⚠️  Beden "${sizeCode}" bulunamadı. Mevcut bedenler: ${availableSizes}`);
        }
        return null;
    }
    
    return matchedSize;
}

/**
 * Excel verisini işle ve PLM ID'leri ile eşleştir (Performanslı versiyon)
 */
async function processExcelDataWithPLM(excelRows) {
    try {
        console.log(`\n📊 ${excelRows.length} satır işleniyor...`);
        console.log('='.repeat(70));
        
        // ADIM 1: Tüm unique trim kodlarını topla
        const uniqueTrimCodes = [...new Set(excelRows.map(row => row['Trim Kodu']))];
        console.log(`\n🔍 Unique Trim Kodları: ${uniqueTrimCodes.length} adet`);
        
        // ADIM 2: Tüm trim'leri tek sorguda çek (colorway ve size bilgileriyle)
        const trimsResult = await getTrimsWithDetails(uniqueTrimCodes);
        if (!trimsResult.success) {
            throw new Error(`Trim'ler çekilemedi: ${trimsResult.error}`);
        }
        
        const trimMap = trimsResult.data;
        console.log(`✅ Trim verisi hazır, şimdi satırlar eşleştiriliyor...\n`);
        
        // ADIM 3: Her satırı eşleştir
        const results = [];
        const errors = [];

        for (let i = 0; i < excelRows.length; i++) {
            const row = excelRows[i];
            const rowNum = i + 2; // Excel'de satır numarası (başlık + 1)
            
            console.log(`📝 Satır ${rowNum}: ${row['Trim Kodu']} - ${row['Renk Kodu']} - ${row['Beden Kodu']}`);

            try {
                // Trim'i map'ten bul
                const trimData = trimMap[row['Trim Kodu']];
                if (!trimData) {
                    throw new Error(`Trim kodu "${row['Trim Kodu']}" PLM'de bulunamadı`);
                }

                // Colorway'i bul
                const colorway = findColorway(trimData.colorways, row['Renk Kodu']);

                // Size'ı bul (opsiyonel)
                let sizeData = null;
                if (row['Beden Kodu'] && row['Beden Kodu'].toString().trim() !== '') {
                    sizeData = findSize(trimData.sizes, row['Beden Kodu']);
                }

                // Başarılı eşleştirme
                results.push({
                    rowNumber: rowNum,
                    excelData: {
                        trimCode: row['Trim Kodu'],
                        colorCode: row['Renk Kodu'],
                        sizeCode: row['Beden Kodu'],
                        barcode: row['YeniEge Barkod']
                    },
                    plmData: {
                        trimId: trimData.trimId,
                        trimColorwayId: colorway.TrimColorwayId,
                        sizeId: sizeData?.SizeId || null,
                        trim: {
                            trimId: trimData.trimId,
                            trimCode: trimData.trimCode
                        },
                        colorway: {
                            trimColorwayId: colorway.TrimColorwayId,
                            code: colorway.Code
                        },
                        size: sizeData ? {
                            sizeId: sizeData.SizeId,
                            sizeCode: sizeData.Size?.SizeCode || null
                        } : null
                    }
                });

                console.log(`   ✅ TrimId: ${trimData.trimId}, ColorwayId: ${colorway.TrimColorwayId}, SizeId: ${sizeData?.SizeId || 'N/A'} (${sizeData?.Size?.SizeCode || 'N/A'})`);

            } catch (error) {
                errors.push({
                    rowNumber: rowNum,
                    data: row,
                    error: error.message
                });
                console.error(`   ❌ Hata: ${error.message}`);
            }
        }

        console.log('\n' + '='.repeat(70));
        console.log(`✅ İşlem tamamlandı: ${results.length} başarılı, ${errors.length} hata`);
        console.log('='.repeat(70));

        return {
            success: results.length > 0,
            data: {
                totalRows: excelRows.length,
                successfulRows: results.length,
                failedRows: errors.length,
                results: results,
                errors: errors
            }
        };

    } catch (error) {
        console.error('❌ Excel işleme hatası:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * PLM'e TrimSKU yazma
 */
async function saveTrimSKUs(trimId, skuList) {
    try {
        console.log(`\n💾 PLM'e TrimSKU yazılıyor...`);
        console.log(`   TrimId: ${trimId}`);
        console.log(`   SKU Sayısı: ${skuList.length}`);
        
        // Token al
        const tokenResult = await getToken();
        if (!tokenResult.success) {
            throw new Error(`Token alınamadı: ${tokenResult.error}`);
        }

        const token = tokenResult.token;
        const saveUrl = `${PLM_CONFIG.BASE_API_URL}/pdm/api/pdm/sku/save`;
        
        // Payload oluştur
        const payload = {
            moduleType: 3, // Sabit - Trim için
            objectId: trimId,
            skuList: skuList.map(sku => ({
                colorMasterId: sku.colorMasterId,
                isIncluded: true, // Hep true
                makeSizeId: sku.makeSizeId // null olabilir
            })),
            Schema: "FSH1" // Schema field'ı zorunlu
        };

        console.log('📤 Payload gönderiliyor...');
        console.log(JSON.stringify(payload, null, 2));
        
        const response = await axios.post(
            saveUrl,
            payload,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'X-Infor-Tenantid': PLM_CONFIG.TENANT,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('✅ TrimSKU başarıyla yazıldı!');
        
        return {
            success: true,
            data: response.data
        };

    } catch (error) {
        console.error('❌ TrimSKU yazma hatası:', error.message);
        if (error.response) {
            console.error('   Status:', error.response.status);
            console.error('   Data:', JSON.stringify(error.response.data, null, 2));
        }
        return {
            success: false,
            error: error.message,
            details: error.response?.data
        };
    }
}

/**
 * Excel'den okunan ve eşleştirilen verileri PLM'e yaz
 */
async function writeMatchedDataToPLM(matchedResults) {
    try {
        console.log(`\n📊 ${matchedResults.length} satır PLM'e yazılıyor...`);
        console.log('='.repeat(70));
        
        // TrimId'ye göre grupla
        const trimGroups = {};
        matchedResults.forEach(result => {
            const trimId = result.plmData.trimId;
            if (!trimGroups[trimId]) {
                trimGroups[trimId] = {
                    trimCode: result.excelData.trimCode,
                    skus: []
                };
            }
            
            trimGroups[trimId].skus.push({
                colorMasterId: result.plmData.trimColorwayId,
                makeSizeId: result.plmData.sizeId, // null olabilir
                excelRow: result.rowNumber,
                barcode: result.excelData.barcode
            });
        });

        const trimIds = Object.keys(trimGroups);
        console.log(`\n🔍 ${trimIds.length} farklı Trim için SKU yazılacak\n`);

        const results = [];
        const errors = [];

        // Her Trim için SKU'ları yaz
        for (const trimId of trimIds) {
            const group = trimGroups[trimId];
            console.log(`\n📝 Trim: ${group.trimCode} (ID: ${trimId})`);
            console.log(`   ${group.skus.length} adet SKU yazılacak`);

            try {
                const saveResult = await saveTrimSKUs(parseInt(trimId), group.skus);
                
                if (saveResult.success) {
                    results.push({
                        trimId: parseInt(trimId),
                        trimCode: group.trimCode,
                        skuCount: group.skus.length,
                        response: saveResult.data
                    });
                    console.log(`✅ ${group.trimCode} başarıyla yazıldı`);
                } else {
                    errors.push({
                        trimId: parseInt(trimId),
                        trimCode: group.trimCode,
                        error: saveResult.error,
                        details: saveResult.details
                    });
                    console.log(`❌ ${group.trimCode} yazılamadı: ${saveResult.error}`);
                }

            } catch (error) {
                errors.push({
                    trimId: parseInt(trimId),
                    trimCode: group.trimCode,
                    error: error.message
                });
                console.log(`❌ ${group.trimCode} yazılırken hata: ${error.message}`);
            }
        }

        console.log('\n' + '='.repeat(70));
        console.log(`✅ PLM yazma tamamlandı: ${results.length} başarılı, ${errors.length} hata`);
        console.log('='.repeat(70));

        return {
            success: results.length > 0,
            data: {
                totalTrims: trimIds.length,
                successfulTrims: results.length,
                failedTrims: errors.length,
                results: results,
                errors: errors
            }
        };

    } catch (error) {
        console.error('❌ PLM yazma hatası:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Yaratılan SKU'ların SKUId'lerini PLM'den çek
 */
async function fetchCreatedSKUs(trimIds) {
    try {
        console.log(`\n🔍 Yaratılan SKU'lar sorgulanıyor...`);
        console.log(`   TrimIds: ${trimIds.join(', ')}`);
        
        // Token al
        const tokenResult = await getToken();
        if (!tokenResult.success) {
            throw new Error(`Token alınamadı: ${tokenResult.error}`);
        }

        const token = tokenResult.token;
        
        // TrimId'lere göre SKU'ları sorgula
        const trimIdsFormatted = trimIds.join(',');
        const skuQueryUrl = `${PLM_CONFIG.BASE_API_URL}/odata2/api/odata2/TrimSKU?$select=SkuId,TrimId,ColorMasterId,MakeSizeId&$filter=TrimId in (${trimIdsFormatted})`;
        
        console.log('📡 PLM SKU sorgusu yapılıyor...');
        const response = await axios.get(skuQueryUrl, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'X-Infor-Tenantid': PLM_CONFIG.TENANT,
                'Content-Type': 'application/json'
            }
        });

        const skus = response.data?.value || [];
        console.log(`✅ ${skus.length} adet SKU bulundu`);

        return {
            success: true,
            data: skus
        };

    } catch (error) {
        console.error('❌ SKU sorgulama hatası:', error.message);
        if (error.response) {
            console.error('   Response:', JSON.stringify(error.response.data, null, 2));
        }
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Excel verisini SKU'larla eşleştir
 */
function matchExcelWithSKUs(excelResults, skus) {
    console.log('\n🔗 Excel verileri SKU\'larla eşleştiriliyor...');
    
    const matchedData = [];
    const unmatchedData = [];

    excelResults.forEach(excelRow => {
        const trimId = excelRow.plmData.trimId;
        const colorMasterId = excelRow.plmData.trimColorwayId;
        const makeSizeId = excelRow.plmData.sizeId;

        // SKU'ları eşleştir
        const matchedSKU = skus.find(sku => 
            sku.TrimId === trimId &&
            sku.ColorMasterId === colorMasterId &&
            sku.MakeSizeId === makeSizeId
        );

        if (matchedSKU) {
            matchedData.push({
                rowNumber: excelRow.rowNumber,
                excelData: excelRow.excelData,
                plmData: {
                    ...excelRow.plmData,
                    skuId: matchedSKU.SkuId // ← SKUId eklendi!
                }
            });
            console.log(`   ✅ Satır ${excelRow.rowNumber}: SKUId ${matchedSKU.SkuId}`);
        } else {
            unmatchedData.push({
                rowNumber: excelRow.rowNumber,
                excelData: excelRow.excelData,
                reason: 'PLM\'de karşılık gelen SKU bulunamadı'
            });
            console.log(`   ⚠️  Satır ${excelRow.rowNumber}: SKU bulunamadı`);
        }
    });

    console.log(`\n✅ ${matchedData.length}/${excelResults.length} satır SKU ile eşleştirildi`);

    return {
        success: matchedData.length > 0,
        data: {
            total: excelResults.length,
            matched: matchedData.length,
            unmatched: unmatchedData.length,
            matchedData: matchedData,
            unmatchedData: unmatchedData
        }
    };
}

/**
 * Tek bir SKU'ya barkod ata
 */
async function updateSKUBarcode(skuId, barcode) {
    try {
        const tokenResult = await getToken();
        if (!tokenResult.success) {
            throw new Error(`Token alınamadı: ${tokenResult.error}`);
        }

        const token = tokenResult.token;
        const updateUrl = `${PLM_CONFIG.BASE_API_URL}/odata2/api/odata2/TrimSKU(${skuId})`;
        
        const payload = {
            SkuCode: barcode
        };

        const response = await axios.patch(
            updateUrl,
            payload,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'X-Infor-Tenantid': PLM_CONFIG.TENANT,
                    'Content-Type': 'application/json'
                }
            }
        );

        return {
            success: true,
            skuId: skuId,
            barcode: barcode,
            data: response.data
        };

    } catch (error) {
        return {
            success: false,
            skuId: skuId,
            barcode: barcode,
            error: error.message,
            details: error.response?.data
        };
    }
}

/**
 * Tüm eşleştirilmiş SKU'lara barkod ata
 */
async function assignBarcodesToSKUs(matchedData) {
    console.log('\n📝 SKU\'lara barkod atanıyor...');
    console.log(`   Toplam ${matchedData.length} SKU güncellenecek`);

    const results = [];
    let successCount = 0;
    let failCount = 0;

    for (const item of matchedData) {
        const skuId = item.plmData.skuId;
        const barcode = item.excelData.barcode;

        console.log(`\n   📌 SKU ${skuId} güncelleniyor... (Barkod: ${barcode})`);

        const result = await updateSKUBarcode(skuId, barcode);

        if (result.success) {
            successCount++;
            console.log(`   ✅ Başarılı!`);
            results.push({
                rowNumber: item.rowNumber,
                skuId: skuId,
                barcode: barcode,
                status: 'success'
            });
        } else {
            failCount++;
            console.error(`   ❌ Hata: ${result.error}`);
            if (result.details) {
                console.error(`   Detay:`, JSON.stringify(result.details, null, 2));
            }
            results.push({
                rowNumber: item.rowNumber,
                skuId: skuId,
                barcode: barcode,
                status: 'failed',
                error: result.error,
                details: result.details
            });
        }

        // API rate limiting için küçük bir bekleme
        if (matchedData.indexOf(item) < matchedData.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    console.log(`\n✅ Barkod atama tamamlandı: ${successCount} başarılı, ${failCount} hatalı`);

    return {
        success: failCount === 0,
        data: {
            total: matchedData.length,
            successful: successCount,
            failed: failCount,
            results: results
        }
    };
}

/**
 * XML'den gelen Document ID ile gerçek Excel URL'ini alma
 * @param {string} itemId - AlternateDocumentID'den çıkarılan Item ID (örn: "2")
 * @param {string} docType - Document Type (örn: "TrimBarcode")
 * @returns {object} - { success, url, filename, error }
 */
async function getDocumentUrl(itemId, docType) {
    try {
        console.log(`🔍 Document URL alınıyor: ItemID=${itemId}, DocType=${docType}`);
        
        // PLM Token al
        const tokenResult = await getToken();
        if (!tokenResult.success) {
            return {
                success: false,
                error: 'Token alınamadı'
            };
        }

        const token = tokenResult.token;
        const docApiUrl = `${PLM_CONFIG.BASE_API_URL}/documents/api/document/doclib/items`;

        const payload = {
            itemIds: [itemId],
            idmDocType: docType
        };

        console.log('📤 Document API Request:', docApiUrl);
        console.log('📦 Payload:', JSON.stringify(payload, null, 2));

        const response = await axios.post(
            docApiUrl,
            payload,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            }
        );

        if (response.data && response.data.documents && response.data.documents.length > 0) {
            const doc = response.data.documents[0];
            console.log('✅ Document URL alındı:', doc.filename);
            
            return {
                success: true,
                url: doc.url,
                filename: doc.filename,
                key: doc.key,
                attributes: doc.attributes
            };
        } else {
            console.error('❌ Document bulunamadı');
            return {
                success: false,
                error: 'Document bulunamadı'
            };
        }

    } catch (error) {
        console.error('❌ Document URL alma hatası:', error.message);
        if (error.response) {
            console.error('   Status:', error.response.status);
            console.error('   Data:', JSON.stringify(error.response.data, null, 2));
        }
        return {
            success: false,
            error: error.message
        };
    }
}

module.exports = {
    getToken,
    getTrimsWithDetails,
    processExcelDataWithPLM,
    saveTrimSKUs,
    writeMatchedDataToPLM,
    fetchCreatedSKUs,
    matchExcelWithSKUs,
    assignBarcodesToSKUs,
    getDocumentUrl
};

