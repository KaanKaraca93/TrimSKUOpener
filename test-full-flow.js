const axios = require('axios');

const newExcelURL = 'https://idm.eu1.inforcloudsuite.com/ca/api/resources/FPLM_Document-90028-2-LATEST?$token=AVfOchLAYjatCPKSl0KthKf9V7Z2Z0kJ8DcE0qJwtirgcjgLNGUdEkvwX5xQXIRhj1DZGOkIe6UE5tuHR7qDgkUHCYNWOP4yS1%2BubfnYB%2Fj7R%2BSUIiuMJjtErw9T%2BfanCyc3VU7c%2BM8IRj46DlSlDCZEia6%2BTeIdirLCTcgp7g6vzCjf9f6pNTslGEdjXyBO7LaW4um1Fcii2%2B8%2BT6BJBIpO5OR%2FgQplb2NGvrwkLlRE0%2FxSFvYJsr0opOu0E0DuCTq1csl7KunOBtiCKDdJYDL8Ngwr%2FNGpQKC5YCZZSsiCYO37BAEsF96YW5vzEGQKreXSBPEHDZ6gbrbBHIlypN%2FE4ZBlTbdLt33WFHLL6GL1GoNJxzn1BP9yBMcxaoEZLYxznIbvp3%2FLWEjlOSA244hvOegXBlQBoOaWIC07XSy0I1b0LEF4J0lxZLarVeUo&$tenant=JKARFH4LCGZA78A5_PRD';

async function testFullFlow() {
  try {
    console.log('\n' + '='.repeat(70));
    console.log('🚀 TAM AKIŞ TESTİ: Excel → PLM Eşleştirme → PLM Yazma');
    console.log('='.repeat(70));

    console.log('\n📥 API çağrısı yapılıyor...');
    console.log('Endpoint: POST /api/process-and-write-to-plm');
    
    const startTime = Date.now();
    
    const response = await axios.post('http://localhost:3000/api/process-and-write-to-plm', {
      url: newExcelURL
    }, {
      timeout: 120000 // 2 dakika timeout
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n' + '='.repeat(70));
    console.log(`✅ İŞLEM BAŞARILI! (${duration} saniye)`);
    console.log('='.repeat(70));

    console.log('\n📊 SONUÇLAR:');
    console.log('\n📥 Excel Bilgileri:');
    console.log(`   - Toplam Satır: ${response.data.data.excel.totalRows}`);
    console.log(`   - İşlenen Satır: ${response.data.data.excel.processedRows}`);

    console.log('\n💾 PLM Yazma Sonuçları:');
    console.log(`   - Toplam Trim: ${response.data.data.plm.totalTrims}`);
    console.log(`   - Başarılı Trim: ${response.data.data.plm.successfulTrims}`);
    console.log(`   - Hatalı Trim: ${response.data.data.plm.failedTrims}`);

    if (response.data.data.plm.results && response.data.data.plm.results.length > 0) {
      console.log('\n✅ Yazılan Trim\'ler:');
      response.data.data.plm.results.forEach(result => {
        console.log(`   - ${result.trimCode} (ID: ${result.trimId}): ${result.skuCount} adet SKU yazıldı`);
      });
    }

    if (response.data.data.plm.errors && response.data.data.plm.errors.length > 0) {
      console.log('\n❌ Hatalar:');
      response.data.data.plm.errors.forEach(error => {
        console.log(`   - ${error.trimCode}: ${error.error}`);
      });
    }

    // SKU Sonuçları
    if (response.data.data.skus) {
      console.log('\n🔑 SKU ID Sonuçları:');
      console.log(`   - Toplam SKU: ${response.data.data.skus.totalSKUs}`);
      console.log(`   - Eşleştirilen Satır: ${response.data.data.skus.matchedRows}`);
      
      if (response.data.data.skus.data && response.data.data.skus.data.length > 0) {
        console.log('\n📋 SKU Detayları (İlk 5):');
        response.data.data.skus.data.slice(0, 5).forEach(sku => {
          console.log(`   - Satır ${sku.rowNumber}:`);
          console.log(`     • Trim: ${sku.excelData['Trim Kodu']}`);
          console.log(`     • Renk: ${sku.excelData['Renk Kodu']}`);
          console.log(`     • Beden: ${sku.excelData['Beden Kodu'] || 'N/A'}`);
          console.log(`     • SKU ID: ${sku.plmData.skuId}`);
        });
        
        if (response.data.data.skus.data.length > 5) {
          console.log(`   ... ve ${response.data.data.skus.data.length - 5} SKU daha`);
        }
      }
    }

    // Barkod Atama Sonuçları
    if (response.data.data.barcodes) {
      console.log('\n📝 Barkod Atama Sonuçları:');
      console.log(`   - Toplam: ${response.data.data.barcodes.total}`);
      console.log(`   - Başarılı: ${response.data.data.barcodes.successful}`);
      console.log(`   - Hatalı: ${response.data.data.barcodes.failed}`);

      if (response.data.data.barcodes.results && response.data.data.barcodes.results.length > 0) {
        const successfulBarcodes = response.data.data.barcodes.results.filter(r => r.status === 'success');
        const failedBarcodes = response.data.data.barcodes.results.filter(r => r.status === 'failed');

        if (successfulBarcodes.length > 0) {
          console.log('\n✅ Başarılı Barkodlar (İlk 5):');
          successfulBarcodes.slice(0, 5).forEach(b => {
            console.log(`   - Satır ${b.rowNumber}: SKU ${b.skuId} → "${b.barcode}"`);
          });
          if (successfulBarcodes.length > 5) {
            console.log(`   ... ve ${successfulBarcodes.length - 5} barkod daha`);
          }
        }

        if (failedBarcodes.length > 0) {
          console.log('\n❌ Hatalı Barkodlar:');
          failedBarcodes.forEach(b => {
            console.log(`   - Satır ${b.rowNumber}: SKU ${b.skuId} → "${b.barcode}"`);
            console.log(`     Hata: ${b.error}`);
          });
        }
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('🎉 TEST TAMAMLANDI!');
    console.log('='.repeat(70));

    // Tam response'u kaydet
    const fs = require('fs');
    fs.writeFileSync('test-full-flow-response.json', JSON.stringify(response.data, null, 2));
    console.log('\n💾 Tam yanıt kaydedildi: test-full-flow-response.json');

  } catch (error) {
    console.error('\n' + '='.repeat(70));
    console.error('❌ TEST BAŞARISIZ!');
    console.error('='.repeat(70));
    console.error('\n🔴 Hata:', error.message);
    
    if (error.response) {
      console.error('\n📥 API Yanıtı:');
      console.error('   Status:', error.response.status);
      console.error('   Message:', error.response.data.message);
      
      if (error.response.data.error) {
        console.error('   Error:', error.response.data.error);
      }
      
      if (error.response.data.data) {
        console.error('\n📊 Detaylar:');
        console.error(JSON.stringify(error.response.data.data, null, 2));
      }

      // Hata response'unu kaydet
      const fs = require('fs');
      fs.writeFileSync('test-full-flow-error.json', JSON.stringify(error.response.data, null, 2));
      console.error('\n💾 Hata yanıtı kaydedildi: test-full-flow-error.json');
    } else if (error.request) {
      console.error('\n📡 Sunucuya bağlanılamadı veya yanıt alınamadı');
    }
    
    process.exit(1);
  }
}

// Test'i çalıştır
console.log('\n⏳ Lütfen bekleyin, işlem uzun sürebilir...\n');
testFullFlow();

