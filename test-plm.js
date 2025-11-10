const axios = require('axios');
const plmService = require('./plm-service');

const testURL = 'https://idm.eu1.inforcloudsuite.com/ca/api/resources/FPLM_Document-90028-2-LATEST?$token=AXYs8RFhYgGkV6uNE6iokfkIGHZDNn%2FpiA%2B4%2FBaGgzh%2BMWbsPAH9jUYm3D022KbhliCne6y6GJuLHVyi6exFs66mFSaatxjbVb%2B9tZmOcY9TpjdJR%2F%2FrLUJywoxWgrL7Okb73MBBbUP6revkf9f1n75%2B9BQyIdQ%2BM8LYlI5sQORlNgonSAVZwwRSt3q%2BMLh%2BqELtQWPxeL5%2BgXu4Iso3LtXcYysZAtwcXdBkHJkcsIBW%2Fj4iy0NH4M%2FsBsfQuMKf12zIz1xCuEbfkO5hadK7SX369YvQBomorJfa%2BTlhpMCUyKDtXEN7tkuYYkGewswxV6mWQ%2FW1578jNNtHnOfW%2F3eP8bnHOCdentGZJW4GcJ09lRH1k5VnzgAYVEuESGZvkuE74K8VNVy%2Fx8zmwKlTVVeXv86tS0RPOO%2B62Uk70U4FSl2sMpa%2F6f1Jaq%2B5GIAv&$tenant=JKARFH4LCGZA78A5_PRD';

async function testPLMIntegration() {
  try {
    console.log('\n' + '='.repeat(70));
    console.log('🧪 PLM ENTEGRASYON TESTİ');
    console.log('='.repeat(70));

    // TEST 1: Token Alma
    console.log('\n1️⃣ TEST: Token Alma');
    console.log('-'.repeat(70));
    const tokenResult = await plmService.getToken();
    if (tokenResult.success) {
      console.log('✅ Token başarıyla alındı');
      console.log(`   Token: ${tokenResult.token.substring(0, 50)}...`);
      console.log(`   Expires In: ${tokenResult.expiresIn} saniye`);
    } else {
      console.log('❌ Token alınamadı:', tokenResult.error);
      return;
    }

    // TEST 2: Excel'den veri okuma
    console.log('\n2️⃣ TEST: Excel Verisi Alma');
    console.log('-'.repeat(70));
    console.log('   API çağrısı yapılıyor...');
    
    const response = await axios.post('http://localhost:3000/api/read-excel', {
      url: testURL
    });

    if (!response.data.success) {
      console.log('❌ Excel okunamadı');
      return;
    }

    console.log('✅ Excel okundu');
    console.log(`   Satır sayısı: ${response.data.data.rowCount}`);
    console.log(`   İlk satır:`, response.data.data.rows[0]);

    // TEST 3: Tam İşlem (Excel + PLM)
    console.log('\n3️⃣ TEST: Excel + PLM Eşleştirme');
    console.log('-'.repeat(70));
    console.log('   Tam işlem başlatılıyor...');
    
    const plmResponse = await axios.post('http://localhost:3000/api/process-excel-with-plm', {
      url: testURL
    });

    if (!plmResponse.data.success) {
      console.log('❌ İşlem başarısız:', plmResponse.data.message);
      if (plmResponse.data.errors) {
        console.log('   Hatalar:', plmResponse.data.errors);
      }
      return;
    }

    console.log('✅ İşlem başarılı!');
    console.log(`   Toplam satır: ${plmResponse.data.data.totalRows}`);
    console.log(`   Başarılı: ${plmResponse.data.data.successfulRows}`);
    console.log(`   Hatalı: ${plmResponse.data.data.failedRows}`);

    // Sonuçları göster
    if (plmResponse.data.data.results && plmResponse.data.data.results.length > 0) {
      console.log('\n📊 İlk Eşleştirme Örneği:');
      const firstResult = plmResponse.data.data.results[0];
      console.log('   Excel Verisi:');
      console.log(`     - Trim Kodu: ${firstResult.excelData.trimCode}`);
      console.log(`     - Renk Kodu: ${firstResult.excelData.colorCode}`);
      console.log(`     - Beden Kodu: ${firstResult.excelData.sizeCode}`);
      console.log(`     - Barkod: ${firstResult.excelData.barcode}`);
      console.log('   PLM Verileri:');
      console.log(`     - Trim ID: ${firstResult.plmData.trimId}`);
      console.log(`     - Trim Colorway ID: ${firstResult.plmData.trimColorwayId}`);
      console.log(`     - Size ID: ${firstResult.plmData.sizeId || 'N/A'}`);
      console.log(`     - Trim: ${firstResult.plmData.trim.trimCode} - ${firstResult.plmData.trim.description}`);
      console.log(`     - Colorway: ${firstResult.plmData.colorway.code} - ${firstResult.plmData.colorway.name}`);
    }

    // Hataları göster
    if (plmResponse.data.data.errors && plmResponse.data.data.errors.length > 0) {
      console.log('\n⚠️  Hatalar:');
      plmResponse.data.data.errors.forEach(err => {
        console.log(`   Satır ${err.rowNumber}: ${err.error}`);
      });
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ TESTLER TAMAMLANDI');
    console.log('='.repeat(70));

  } catch (error) {
    console.error('\n❌ TEST HATASI:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Manuel testler için yardımcı fonksiyonlar
async function testTokenOnly() {
  console.log('\n🔑 Sadece Token Testi\n');
  const result = await plmService.getToken();
  console.log('Sonuç:', result);
}

async function testTrimLookup(...trimCodes) {
  console.log(`\n🔍 Trim Arama Testi: ${trimCodes.join(', ')}\n`);
  const result = await plmService.getTrimsWithDetails(trimCodes);
  console.log('Sonuç:', JSON.stringify(result, null, 2));
}

// Ana test fonksiyonunu çalıştır
if (require.main === module) {
  // Komut satırı argümanlarına göre test seç
  const args = process.argv.slice(2);
  
  if (args[0] === 'token') {
    testTokenOnly();
  } else if (args[0] === 'trim' && args.length > 1) {
    // Birden fazla trim kodu destekle
    testTrimLookup(...args.slice(1));
  } else {
    // Varsayılan: Tam test
    testPLMIntegration();
  }
}

module.exports = {
  testPLMIntegration,
  testTokenOnly,
  testTrimLookup
};

