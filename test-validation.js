const axios = require('axios');

console.log('🧪 Validasyon Testleri\n');
console.log('='.repeat(60));

async function testValidation() {
  const baseURL = 'http://localhost:3000/api/read-excel';
  
  // Test 1: Eksik başlık testi
  console.log('\n1️⃣ Test: Eksik başlık kontrolü');
  console.log('   Senaryo: Excel dosyasında "YeniEge Barkod" başlığı eksik olsun');
  console.log('   Beklenen: "Eksik başlık" hatası');
  console.log('   Not: Bu testi manuel olarak test etmeniz gerekiyor (başlık silerek)');
  
  // Test 2: Boş zorunlu alan testi
  console.log('\n2️⃣ Test: Boş zorunlu alan kontrolü');
  console.log('   Senaryo: "Trim Kodu", "Renk Kodu" veya "YeniEge Barkod" boş');
  console.log('   Beklenen: "Lütfen eksik bilgileri doldurunuz" hatası');
  console.log('   Not: Bu testi manuel olarak test etmeniz gerekiyor (değer silerek)');
  
  // Test 3: Başarılı okuma (mevcut dosya)
  console.log('\n3️⃣ Test: Başarılı okuma');
  try {
    const testURL = 'https://idm.eu1.inforcloudsuite.com/ca/api/resources/FPLM_Document-90028-2-LATEST?$token=AXYs8RFhYgGkV6uNE6iokfkIGHZDNn%2FpiA%2B4%2FBaGgzh%2BMWbsPAH9jUYm3D022KbhliCne6y6GJuLHVyi6exFs66mFSaatxjbVb%2B9tZmOcY9TpjdJR%2F%2FrLUJywoxWgrL7Okb73MBBbUP6revkf9f1n75%2B9BQyIdQ%2BM8LYlI5sQORlNgonSAVZwwRSt3q%2BMLh%2BqELtQWPxeL5%2BgXu4Iso3LtXcYysZAtwcXdBkHJkcsIBW%2Fj4iy0NH4M%2FsBsfQuMKf12zIz1xCuEbfkO5hadK7SX369YvQBomorJfa%2BTlhpMCUyKDtXEN7tkuYYkGewswxV6mWQ%2FW1578jNNtHnOfW%2F3eP8bnHOCdentGZJW4GcJ09lRH1k5VnzgAYVEuESGZvkuE74K8VNVy%2Fx8zmwKlTVVeXv86tS0RPOO%2B62Uk70U4FSl2sMpa%2F6f1Jaq%2B5GIAv&$tenant=JKARFH4LCGZA78A5_PRD';
    
    const response = await axios.post(baseURL, { url: testURL });
    
    console.log('   ✅ BAŞARILI');
    console.log('   Mesaj:', response.data.message);
    console.log('   Satır sayısı:', response.data.data.rowCount);
    console.log('   Başlıklar:', response.data.data.headers.join(', '));
    
  } catch (error) {
    console.log('   ❌ BAŞARISIZ');
    if (error.response) {
      console.log('   Hata:', error.response.data.message);
    } else {
      console.log('   Hata:', error.message);
    }
  }
  
  // Test 4: Geçersiz URL
  console.log('\n4️⃣ Test: Geçersiz URL');
  try {
    const response = await axios.post(baseURL, { 
      url: 'https://invalid-url-test.com/nonexistent.xlsx' 
    });
    console.log('   ❌ BAŞARISIZ - Hata oluşmalıydı');
  } catch (error) {
    console.log('   ✅ BAŞARILI - Beklenen hata alındı');
    if (error.response) {
      console.log('   Hata mesajı:', error.response.data.message);
    }
  }
  
  // Test 5: URL olmadan istek
  console.log('\n5️⃣ Test: URL parametresi olmadan');
  try {
    const response = await axios.post(baseURL, {});
    console.log('   ❌ BAŞARISIZ - Hata oluşmalıydı');
  } catch (error) {
    console.log('   ✅ BAŞARILI - Beklenen hata alındı');
    if (error.response) {
      console.log('   Hata mesajı:', error.response.data.message);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✨ Test senaryoları tamamlandı\n');
  
  console.log('📝 Validasyon Kuralları Özeti:');
  console.log('   • Zorunlu başlıklar: Trim Kodu, Renk Kodu, Beden Kodu, YeniEge Barkod');
  console.log('   • Zorunlu alanlar: Trim Kodu, Renk Kodu, YeniEge Barkod');
  console.log('   • Opsiyonel alan: Beden Kodu (boş olabilir)');
  console.log('   • Diğer sütunlar: Göz ardı edilir');
}

testValidation();

