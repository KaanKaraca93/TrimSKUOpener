const axios = require('axios');

const testURL = 'https://idm.eu1.inforcloudsuite.com/ca/api/resources/FPLM_Document-90028-2-LATEST?$token=AXYs8RFhYgGkV6uNE6iokfkIGHZDNn%2FpiA%2B4%2FBaGgzh%2BMWbsPAH9jUYm3D022KbhliCne6y6GJuLHVyi6exFs66mFSaatxjbVb%2B9tZmOcY9TpjdJR%2F%2FrLUJywoxWgrL7Okb73MBBbUP6revkf9f1n75%2B9BQyIdQ%2BM8LYlI5sQORlNgonSAVZwwRSt3q%2BMLh%2BqELtQWPxeL5%2BgXu4Iso3LtXcYysZAtwcXdBkHJkcsIBW%2Fj4iy0NH4M%2FsBsfQuMKf12zIz1xCuEbfkO5hadK7SX369YvQBomorJfa%2BTlhpMCUyKDtXEN7tkuYYkGewswxV6mWQ%2FW1578jNNtHnOfW%2F3eP8bnHOCdentGZJW4GcJ09lRH1k5VnzgAYVEuESGZvkuE74K8VNVy%2Fx8zmwKlTVVeXv86tS0RPOO%2B62Uk70U4FSl2sMpa%2F6f1Jaq%2B5GIAv&$tenant=JKARFH4LCGZA78A5_PRD';

async function testAPI() {
  try {
    console.log('⏳ API test ediliyor...\n');
    
    // Önce health check
    console.log('1️⃣ Health check yapılıyor...');
    const healthResponse = await axios.get('http://localhost:3000/api/health');
    console.log('✅ Health check başarılı:', healthResponse.data);
    console.log('');

    // Excel okuma testi
    console.log('2️⃣ Excel okuma test ediliyor...');
    const response = await axios.post('http://localhost:3000/api/read-excel', {
      url: testURL
    });

    console.log('✅ Excel başarıyla okundu ve doğrulandı!\n');
    console.log('📊 Sonuç:');
    console.log('- Başarılı:', response.data.success);
    console.log('- Mesaj:', response.data.message);
    console.log('- Sheet adı:', response.data.data.sheetName);
    console.log('- Başlıklar:', response.data.data.headers);
    console.log('- Satır sayısı:', response.data.data.rowCount);
    console.log('\n📋 Tüm veriler:');
    console.log(JSON.stringify(response.data.data.rows, null, 2));
    
  } catch (error) {
    console.error('❌ Hata:', error.message);
    if (error.response) {
      console.error('Sunucu yanıtı:', error.response.data);
    }
  }
}

testAPI();

