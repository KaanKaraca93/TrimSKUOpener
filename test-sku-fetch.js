const plmService = require('./plm-service');

async function testSKUFetch() {
    try {
        console.log('\n' + '='.repeat(70));
        console.log('🔍 SKU ID SORGULAMA TESTİ');
        console.log('='.repeat(70));

        // Test için TrimId'ler (çoklu test için)
        const trimIds = [1558]; // TRFED00069
        
        console.log('\n📋 Test Parametreleri:');
        console.log(`   TrimIds: ${trimIds.join(', ')}`);

        // SKU'ları çek
        const result = await plmService.fetchCreatedSKUs(trimIds);

        if (!result.success) {
            console.error('\n❌ SKU sorgulaması başarısız!');
            console.error(`   Hata: ${result.error}`);
            return;
        }

        const skus = result.data;
        
        console.log('\n' + '='.repeat(70));
        console.log('✅ SKU SORGULAMASI BAŞARILI!');
        console.log('='.repeat(70));

        console.log(`\n📊 Toplam ${skus.length} adet SKU bulundu`);

        if (skus.length > 0) {
            console.log('\n📋 SKU Listesi:');
            console.log('─'.repeat(70));
            
            // TrimId'ye göre grupla
            const groupedByTrim = {};
            skus.forEach(sku => {
                if (!groupedByTrim[sku.TrimId]) {
                    groupedByTrim[sku.TrimId] = [];
                }
                groupedByTrim[sku.TrimId].push(sku);
            });

            // Her Trim için SKU'ları göster
            Object.keys(groupedByTrim).forEach(trimId => {
                const trimSKUs = groupedByTrim[trimId];
                console.log(`\n🎯 TrimId: ${trimId} (${trimSKUs.length} adet SKU)`);
                
                trimSKUs.forEach((sku, index) => {
                    console.log(`   ${index + 1}. SKU ID: ${sku.SkuId}`);
                    console.log(`      ├─ TrimId: ${sku.TrimId}`);
                    console.log(`      ├─ ColorMasterId: ${sku.ColorMasterId}`);
                    console.log(`      └─ MakeSizeId: ${sku.MakeSizeId || 'null'}`);
                    if (index < trimSKUs.length - 1) {
                        console.log();
                    }
                });
            });

            console.log('\n' + '─'.repeat(70));

            // İstatistikler
            const nullSizeCount = skus.filter(sku => !sku.MakeSizeId).length;
            const withSizeCount = skus.filter(sku => sku.MakeSizeId).length;
            const uniqueTrims = Object.keys(groupedByTrim).length;
            const uniqueColors = [...new Set(skus.map(sku => sku.ColorMasterId))].length;

            console.log('\n📊 İstatistikler:');
            console.log(`   - Toplam SKU: ${skus.length}`);
            console.log(`   - Unique Trim: ${uniqueTrims}`);
            console.log(`   - Unique Renk: ${uniqueColors}`);
            console.log(`   - Bedenli SKU: ${withSizeCount}`);
            console.log(`   - Bedensiz SKU: ${nullSizeCount}`);
        }

        console.log('\n' + '='.repeat(70));
        console.log('🎉 TEST TAMAMLANDI!');
        console.log('='.repeat(70));

    } catch (error) {
        console.error('\n❌ Test Hatası:', error.message);
        console.error(error.stack);
    }
}

// Komut satırı argümanları ile çalıştır
const args = process.argv.slice(2);

if (args.length > 0 && args[0] !== 'default') {
    // Özel TrimId'ler ile çalıştır
    const customTrimIds = args.map(arg => parseInt(arg)).filter(id => !isNaN(id));
    if (customTrimIds.length > 0) {
        console.log(`\nÖzel TrimId'ler ile çalıştırılıyor: ${customTrimIds.join(', ')}`);
        
        (async () => {
            const plmService = require('./plm-service');
            const result = await plmService.fetchCreatedSKUs(customTrimIds);
            if (result.success) {
                console.log(`\n✅ ${result.data.length} adet SKU bulundu`);
                console.log(JSON.stringify(result.data, null, 2));
            } else {
                console.error(`\n❌ Hata: ${result.error}`);
            }
        })();
    } else {
        console.error('Geçersiz TrimId. Lütfen sayısal değer girin.');
    }
} else {
    // Default test
    testSKUFetch();
}

