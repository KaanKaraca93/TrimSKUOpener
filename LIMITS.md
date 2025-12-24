# 🔍 TrimSKUOpener - Olası Limitler ve Çözümleri

## 1. ⏱️ **HEROKU TIMEOUT (30 saniye)**
**Problem**: Heroku'da bir request 30 saniyeden uzun sürerse otomatik kesilir.

**Nerede Durur**:
- Çok fazla satır varsa (100+)
- Çok fazla farklı Trim varsa
- Barkod atama uzun sürüyorsa

**Çözüm**:
```javascript
// server.js'e timeout ayarı ekle
app.use((req, res, next) => {
    req.setTimeout(300000); // 5 dakika
    res.setTimeout(300000);
    next();
});
```

**YA DA**: Daha iyi çözüm - Async işlem (webhook ile sonuç döndür)

---

## 2. 🔗 **ODATA URL UZUNLUĞU LİMİTİ**
**Problem**: `Code in ('TRIM1','TRIM2',...)` çok uzun olursa URL çalışmaz.

**Limit**: ~2000 karakter (genelde)

**Nerede**: `plm-service.js` satır 67-68
```javascript
const trimCodesFormatted = trimCodes.map(code => `'${code}'`).join(',');
const trimApiUrl = `.../Trim?$filter=Code in (${trimCodesFormatted})...`;
```

**Çözüm**: Trimler'i batch'lere ayır
```javascript
// 20'şer 20'şer işle
const BATCH_SIZE = 20;
for (let i = 0; i < trimCodes.length; i += BATCH_SIZE) {
    const batch = trimCodes.slice(i, i + BATCH_SIZE);
    // batch'i işle...
}
```

---

## 3. 🏷️ **BARCODE ATAMA RATE LIMITING**
**Problem**: Her barkod ataması arasında sadece 100ms bekleme var.

**Nerede**: `plm-service.js` satır 636-639
```javascript
// API rate limiting için küçük bir bekleme
if (matchedData.indexOf(item) < matchedData.length - 1) {
    await new Promise(resolve => setTimeout(resolve, 100));
}
```

**Çözüm**: Bekleme süresini artır veya paralel işlem yap
```javascript
await new Promise(resolve => setTimeout(resolve, 500)); // 500ms
```

---

## 4. 🔐 **TOKEN RATE LIMITING**
**Problem**: Her işlemde yeni token alınıyor. Çok fazla token isteği olursa PLM bloke edebilir.

**Nerede**: Her API çağrısında `getToken()` çağrılıyor

**Çözüm**: Token'ı cache'le (1 saat geçerli)
```javascript
let cachedToken = null;
let tokenExpiry = null;

async function getToken() {
    if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
        return { success: true, token: cachedToken };
    }
    // Token al...
    cachedToken = token;
    tokenExpiry = Date.now() + (expiresIn * 1000) - 60000; // 1 dk önce expire et
}
```

---

## 5. 💾 **MEMORY LIMIT**
**Problem**: Çok büyük Excel dosyaları memory'yi doldurabilir.

**Heroku Free Tier**: 512MB RAM

**Çözüm**: Stream kullan veya satır satır işle

---

## 📊 **ŞU ANDA KODDA NE VAR?**

| Kısım | Limit Var mı? | Açıklama |
|-------|--------------|----------|
| Excel İndirme | ❌ Yok | Dosya boyutu limiti yok |
| Trim Sorgusu | ⚠️ VAR | URL uzunluğu limiti (çok fazla trim varsa) |
| SKU Yazma | ✅ OK | Trim'ler ayrı ayrı yazılıyor |
| Barkod Atama | ⚠️ VAR | Her barkod için sıralı istek (yavaş) + 100ms delay |
| Timeout | ⚠️ VAR | Heroku 30 saniye |

---

## 🚨 **SORUNUN NEREDEKİ OLDUĞUNU ANLAMA**

### Konsola Bakın:
```
✅ Excel indirildi              → İlk adım tamam
✅ Excel okundu                 → Excel parse tamam
✅ Validasyon başarılı          → Validasyon tamam
✅ PLM ile eşleştirme tamam     → Trim/Renk/Beden bulundu
✅ TrimSKU oluşturma tamam      → SKU yazıldı
🏷️ Barcode'lar atanıyor...     → BURADA MI DURUYOR?
```

**Eğer barkod atamasında duruyorsa**:
- Çok fazla SKU var (100+?)
- Rate limiting aktif
- Timeout sorunu

---

## 🔧 **HIZLI TEST**

Kaç satırlık liste yüklüyorsunuz?
- 0-50 satır → Problem olmamalı
- 50-100 satır → Yavaş ama çalışmalı
- 100+ satır → Timeout riski var
- 500+ satır → Kesin timeout

**Hangi adımda duruyor?**
Terminal/Heroku log'larına bakın!

