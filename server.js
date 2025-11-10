const express = require('express');
const cors = require('cors');
const axios = require('axios');
const XLSX = require('xlsx');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const plmService = require('./plm-service');

// Load Swagger YAML
const swaggerDocument = YAML.load('./swagger.yaml');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'TrimSKUOpener API Docs'
}));

// Gerekli başlıklar
const REQUIRED_HEADERS = ['Trim Kodu', 'Renk Kodu', 'Beden Kodu', 'YeniEge Barkod'];
const MANDATORY_FIELDS = ['Trim Kodu', 'Renk Kodu', 'YeniEge Barkod'];

// Excel URL'den okuma endpoint'i
app.post('/api/read-excel', async (req, res) => {
  try {
    const { url } = req.body;

    // URL kontrolü
    if (!url) {
      return res.status(400).json({
        success: false,
        message: 'URL gereklidir'
      });
    }

    console.log('Excel dosyası indiriliyor:', url);

    // Excel dosyasını URL'den indir
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30000, // 30 saniye timeout
      headers: {
        'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel, */*'
      }
    });

    // Excel dosyasını oku
    const workbook = XLSX.read(response.data, { type: 'buffer' });

    // İlk sheet'i al
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    // JSON'a çevir
    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      defval: '',
      blankrows: false
    });

    console.log('Bulunan sheet:', firstSheetName);

    // Veri boş mu kontrol et
    if (!jsonData || jsonData.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Excel dosyası boş'
      });
    }

    // Başlıkları kontrol et
    const headers = Object.keys(jsonData[0]);
    console.log('Bulunan başlıklar:', headers);

    // Eksik başlıkları bul
    const missingHeaders = REQUIRED_HEADERS.filter(header => !headers.includes(header));
    
    if (missingHeaders.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Eksik başlık',
        missingHeaders: missingHeaders,
        detail: `Şu başlıklar eksik: ${missingHeaders.join(', ')}`
      });
    }

    // Sadece gerekli başlıkları filtrele
    const filteredData = jsonData.map(row => {
      const filteredRow = {};
      REQUIRED_HEADERS.forEach(header => {
        filteredRow[header] = row[header];
      });
      return filteredRow;
    });

    // Zorunlu alanları kontrol et
    const emptyFieldErrors = [];
    filteredData.forEach((row, index) => {
      const emptyFields = [];
      
      MANDATORY_FIELDS.forEach(field => {
        const value = row[field];
        // Boş, undefined, null veya sadece boşluk karakterlerinden oluşan değerleri kontrol et
        if (value === '' || value === undefined || value === null || 
            (typeof value === 'string' && value.trim() === '')) {
          emptyFields.push(field);
        }
      });

      if (emptyFields.length > 0) {
        emptyFieldErrors.push({
          row: index + 2, // Excel'de satır numarası (başlık + 1)
          emptyFields: emptyFields
        });
      }
    });

    // Eksik bilgiler varsa hata dön
    if (emptyFieldErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Lütfen eksik bilgileri doldurunuz',
        errors: emptyFieldErrors,
        detail: `${emptyFieldErrors.length} satırda eksik zorunlu alan bulundu`
      });
    }

    console.log(`✅ Validasyon başarılı - ${filteredData.length} satır okundu`);

    res.json({
      success: true,
      message: 'Excel dosyası başarıyla okundu ve doğrulandı',
      data: {
        sheetName: firstSheetName,
        headers: REQUIRED_HEADERS,
        rowCount: filteredData.length,
        rows: filteredData
      }
    });

  } catch (error) {
    console.error('Hata:', error.message);
    
    // Hata türüne göre mesaj
    let errorMessage = 'Excel dosyası okunurken bir hata oluştu';
    if (error.code === 'ECONNABORTED') {
      errorMessage = 'İstek zaman aşımına uğradı';
    } else if (error.response) {
      errorMessage = `Dosya indirilemedi: ${error.response.status} ${error.response.statusText}`;
    } else if (error.request) {
      errorMessage = 'Sunucuya bağlanılamadı';
    }

    res.status(500).json({
      success: false,
      message: errorMessage,
      error: error.message
    });
  }
});

// Excel okuma + PLM eşleştirme endpoint'i
app.post('/api/process-excel-with-plm', async (req, res) => {
  try {
    const { url } = req.body;

    // URL kontrolü
    if (!url) {
      return res.status(400).json({
        success: false,
        message: 'URL gereklidir'
      });
    }

    console.log('\n' + '='.repeat(70));
    console.log('🎯 EXCEL + PLM EŞLEŞTİRME İŞLEMİ BAŞLADI');
    console.log('🕐 Timestamp:', new Date().toISOString());
    console.log('📦 URL:', url);
    console.log('='.repeat(70));

    console.log('\n📥 ADIM 1: Excel dosyası indiriliyor...');

    // Excel dosyasını URL'den indir
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: {
        'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel, */*'
      }
    });

    // Excel dosyasını oku
    const workbook = XLSX.read(response.data, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      defval: '',
      blankrows: false
    });

    console.log(`✅ Excel okundu: ${jsonData.length} satır`);

    // Veri boş mu kontrol et
    if (!jsonData || jsonData.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Excel dosyası boş'
      });
    }

    console.log('\n🔍 ADIM 2: Başlık ve alan validasyonu...');

    // Başlıkları kontrol et
    const headers = Object.keys(jsonData[0]);
    const missingHeaders = REQUIRED_HEADERS.filter(header => !headers.includes(header));
    
    if (missingHeaders.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Eksik başlık',
        missingHeaders: missingHeaders,
        detail: `Şu başlıklar eksik: ${missingHeaders.join(', ')}`
      });
    }

    // Sadece gerekli başlıkları filtrele
    const filteredData = jsonData.map(row => {
      const filteredRow = {};
      REQUIRED_HEADERS.forEach(header => {
        filteredRow[header] = row[header];
      });
      return filteredRow;
    });

    // Zorunlu alanları kontrol et
    const emptyFieldErrors = [];
    filteredData.forEach((row, index) => {
      const emptyFields = [];
      
      MANDATORY_FIELDS.forEach(field => {
        const value = row[field];
        if (value === '' || value === undefined || value === null || 
            (typeof value === 'string' && value.trim() === '')) {
          emptyFields.push(field);
        }
      });

      if (emptyFields.length > 0) {
        emptyFieldErrors.push({
          row: index + 2,
          emptyFields: emptyFields
        });
      }
    });

    if (emptyFieldErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Lütfen eksik bilgileri doldurunuz',
        errors: emptyFieldErrors,
        detail: `${emptyFieldErrors.length} satırda eksik zorunlu alan bulundu`
      });
    }

    console.log(`✅ Validasyon başarılı`);

    console.log('\n🔗 ADIM 3: PLM ile eşleştirme yapılıyor...');

    // PLM ile eşleştirme yap
    const plmResult = await plmService.processExcelDataWithPLM(filteredData);

    if (!plmResult.success) {
      return res.status(500).json({
        success: false,
        message: 'PLM eşleştirme hatası',
        error: plmResult.error
      });
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ İŞLEM TAMAMLANDI');
    console.log('='.repeat(70));

    res.json({
      success: true,
      message: 'Excel dosyası başarıyla işlendi ve PLM ile eşleştirildi',
      data: {
        sheetName: firstSheetName,
        totalRows: plmResult.data.totalRows,
        successfulRows: plmResult.data.successfulRows,
        failedRows: plmResult.data.failedRows,
        results: plmResult.data.results,
        errors: plmResult.data.errors.length > 0 ? plmResult.data.errors : undefined
      }
    });

  } catch (error) {
    console.error('❌ Hata:', error.message);
    
    let errorMessage = 'Excel işleme sırasında bir hata oluştu';
    if (error.code === 'ECONNABORTED') {
      errorMessage = 'İstek zaman aşımına uğradı';
    } else if (error.response) {
      errorMessage = `Dosya indirilemedi: ${error.response.status} ${error.response.statusText}`;
    } else if (error.request) {
      errorMessage = 'Sunucuya bağlanılamadı';
    }

    res.status(500).json({
      success: false,
      message: errorMessage,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/process-and-write-to-plm:
 *   post:
 *     summary: Excel'den PLM'e Tam İşlem
 *     description: |
 *       Excel dosyasını URL'den okur, validasyon yapar, PLM ile eşleştirir, TrimSKU yaratır, SKU ID'lerini çeker ve barkodları atar.
 *       
 *       **İşlem Adımları:**
 *       1. Excel URL'den okunur
 *       2. Başlık ve zorunlu alan validasyonu yapılır
 *       3. PLM ile eşleştirme (Trim/Renk/Beden → ID'ler)
 *       4. PLM'e TrimSKU yaratılır
 *       5. Yaratılan SKU'ların ID'leri çekilir
 *       6. Excel satırları SKU ID'leri ile eşleştirilir
 *       7. Her SKU'ya barkod atanır
 *       
 *       **Excel Formatı:**
 *       - `Trim Kodu` (Zorunlu)
 *       - `Renk Kodu` (Zorunlu)
 *       - `Beden Kodu` (Opsiyonel)
 *       - `YeniEge Barkod` (Zorunlu)
 *     tags:
 *       - Excel Processing
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ExcelRequest'
 *           examples:
 *             example1:
 *               summary: Örnek Excel URL
 *               value:
 *                 url: "https://idm.eu1.inforcloudsuite.com/ca/api/resources/FPLM_Document-90028-2-LATEST?$token=..."
 *     responses:
 *       200:
 *         description: İşlem başarılı
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Validasyon hatası veya eksik bilgi
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Sunucu hatası
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
app.post('/api/process-and-write-to-plm', async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        message: 'URL gereklidir'
      });
    }

    console.log('\n' + '='.repeat(70));
    console.log('🎯 TAM İŞLEM BAŞLADI: Excel → Validasyon → PLM Eşleştirme → PLM Yazma');
    console.log('🕐 Timestamp:', new Date().toISOString());
    console.log('📦 URL:', url);
    console.log('='.repeat(70));

    // ADIM 1: Excel okuma
    console.log('\n📥 ADIM 1: Excel dosyası indiriliyor...');
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: {
        'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel, */*'
      }
    });

    const workbook = XLSX.read(response.data, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      defval: '',
      blankrows: false
    });

    console.log(`✅ Excel okundu: ${jsonData.length} satır`);

    if (!jsonData || jsonData.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Excel dosyası boş'
      });
    }

    // ADIM 2: Validasyon
    console.log('\n🔍 ADIM 2: Başlık ve alan validasyonu...');
    const headers = Object.keys(jsonData[0]);
    const missingHeaders = REQUIRED_HEADERS.filter(header => !headers.includes(header));
    
    if (missingHeaders.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Eksik başlık',
        missingHeaders: missingHeaders
      });
    }

    const filteredData = jsonData.map(row => {
      const filteredRow = {};
      REQUIRED_HEADERS.forEach(header => {
        filteredRow[header] = row[header];
      });
      return filteredRow;
    });

    const emptyFieldErrors = [];
    filteredData.forEach((row, index) => {
      const emptyFields = [];
      MANDATORY_FIELDS.forEach(field => {
        const value = row[field];
        if (value === '' || value === undefined || value === null || 
            (typeof value === 'string' && value.trim() === '')) {
          emptyFields.push(field);
        }
      });
      if (emptyFields.length > 0) {
        emptyFieldErrors.push({ row: index + 2, emptyFields: emptyFields });
      }
    });

    if (emptyFieldErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Lütfen eksik bilgileri doldurunuz',
        errors: emptyFieldErrors
      });
    }

    console.log(`✅ Validasyon başarılı`);

    // ADIM 3: PLM ile eşleştirme
    console.log('\n🔗 ADIM 3: PLM ile eşleştirme yapılıyor...');
    const plmResult = await plmService.processExcelDataWithPLM(filteredData);

    if (!plmResult.success) {
      return res.status(500).json({
        success: false,
        message: 'PLM eşleştirme hatası',
        error: plmResult.error
      });
    }

    if (plmResult.data.failedRows > 0) {
      return res.status(400).json({
        success: false,
        message: 'Bazı satırlar eşleştirilemedi',
        data: plmResult.data
      });
    }

    console.log(`✅ Eşleştirme başarılı: ${plmResult.data.successfulRows} satır`);

    // ADIM 4: PLM'e yazma
    console.log('\n💾 ADIM 4: PLM\'e TrimSKU yazılıyor...');
    const writeResult = await plmService.writeMatchedDataToPLM(plmResult.data.results);

    if (!writeResult.success) {
      return res.status(500).json({
        success: false,
        message: 'PLM yazma hatası',
        error: writeResult.error,
        details: writeResult.data,
        matchedData: plmResult.data
      });
    }

    // ADIM 5: Yaratılan SKU'ların ID'lerini çek
    console.log('\n🔍 ADIM 5: Yaratılan SKU\'ların ID\'leri çekiliyor...');
    const trimIds = [...new Set(plmResult.data.results.map(r => r.plmData.trimId))];
    
    const skuFetchResult = await plmService.fetchCreatedSKUs(trimIds);
    if (!skuFetchResult.success) {
      console.warn('⚠️  SKU\'lar çekilemedi, ancak yazma başarılı oldu');
    }

    // ADIM 6: Excel verilerini SKU'larla eşleştir
    let finalMatchedData = plmResult.data.results;
    let matchResult = null;
    if (skuFetchResult.success && skuFetchResult.data.length > 0) {
      console.log('\n🔗 ADIM 6: Excel verileri SKU\'larla eşleştiriliyor...');
      matchResult = plmService.matchExcelWithSKUs(plmResult.data.results, skuFetchResult.data);
      if (matchResult.success) {
        finalMatchedData = matchResult.data.matchedData;
        console.log(`✅ ${matchResult.data.matched} satır SKUId ile eşleştirildi`);
      }
    }

    // ADIM 7: SKU'lara barkod ata
    let barcodeResult = null;
    if (matchResult && matchResult.success && finalMatchedData.length > 0) {
      console.log('\n📝 ADIM 7: SKU\'lara barkod atanıyor...');
      barcodeResult = await plmService.assignBarcodesToSKUs(finalMatchedData);
      
      if (!barcodeResult.success) {
        console.warn(`⚠️  Bazı barkodlar atanamadı: ${barcodeResult.data.failed}/${barcodeResult.data.total}`);
      } else {
        console.log(`✅ Tüm barkodlar başarıyla atandı!`);
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ TAM İŞLEM BAŞARIYLA TAMAMLANDI!');
    console.log('='.repeat(70));

    res.json({
      success: true,
      message: 'Excel verisi başarıyla işlendi, PLM\'e yazıldı, SKU ID\'leri alındı ve barkodlar atandı',
      data: {
        excel: {
          totalRows: plmResult.data.totalRows,
          processedRows: plmResult.data.successfulRows
        },
        plm: {
          totalTrims: writeResult.data.totalTrims,
          successfulTrims: writeResult.data.successfulTrims,
          failedTrims: writeResult.data.failedTrims,
          results: writeResult.data.results,
          errors: writeResult.data.errors.length > 0 ? writeResult.data.errors : undefined
        },
        skus: {
          totalSKUs: skuFetchResult.success ? skuFetchResult.data.length : 0,
          matchedRows: finalMatchedData.length,
          data: finalMatchedData
        },
        barcodes: barcodeResult ? {
          total: barcodeResult.data.total,
          successful: barcodeResult.data.successful,
          failed: barcodeResult.data.failed,
          results: barcodeResult.data.results
        } : null
      }
    });

  } catch (error) {
    console.error('❌ Hata:', error.message);
    res.status(500).json({
      success: false,
      message: 'İşlem sırasında bir hata oluştu',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Sağlık Kontrolü
 *     description: API'nin çalışır durumda olup olmadığını kontrol eder
 *     tags:
 *       - Health Check
 *     responses:
 *       200:
 *         description: API çalışıyor
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: OK
 *                 message:
 *                   type: string
 *                   example: TrimSKUOpener API çalışıyor
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: "2025-11-10T14:30:00.000Z"
 */
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'API çalışıyor',
    timestamp: new Date().toISOString()
  });
});

/**
 * @swagger
 * /:
 *   get:
 *     summary: Ana Sayfa
 *     description: API ana sayfası - Swagger dokümantasyonuna yönlendirir
 *     tags:
 *       - Home
 *     responses:
 *       200:
 *         description: API bilgileri
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: TrimSKUOpener API
 *                 version:
 *                   type: string
 *                   example: "1.0.0"
 *                 documentation:
 *                   type: string
 *                   example: /api-docs
 */
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'TrimSKUOpener API - Excel to PLM Data Processor',
    version: '1.0.0',
    documentation: '/api-docs',
    swagger: 'https://trimskuopener-4b8505224c7d.herokuapp.com/api-docs',
    endpoints: {
      health: 'GET /api/health',
      fullProcess: 'POST /api/process-and-write-to-plm'
    }
  });
});

// Server'ı başlat
app.listen(PORT, () => {
  console.log('='.repeat(70));
  console.log(`🚀 Server ${PORT} portunda çalışıyor`);
  console.log(`📍 http://localhost:${PORT}`);
  console.log(`📚 Swagger UI: http://localhost:${PORT}/api-docs`);
  console.log(`💚 Sağlık kontrolü: http://localhost:${PORT}/api/health`);
  console.log('='.repeat(70));
});

module.exports = app;

