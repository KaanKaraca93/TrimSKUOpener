# TrimSKUOpener API

Excel verilerini URL'den okuyup PLM'e yazan Node.js API'si.

## Kurulum

```bash
npm install
```

## Çalıştırma

```bash
# Production mode
npm start

# Development mode (nodemon ile)
npm run dev
```

## API Endpoints

### 1. Sağlık Kontrolü
```
GET /api/health
```

### 2. Excel Okuma ve Validasyon
```
POST /api/read-excel
Content-Type: application/json

{
  "url": "https://example.com/path/to/excel-file.xlsx"
}
```

#### Gerekli Excel Formatı:
Excel dosyanızda **mutlaka** şu başlıklar olmalıdır:
- `Trim Kodu` ⚠️ **Zorunlu Alan**
- `Renk Kodu` ⚠️ **Zorunlu Alan**
- `Beden Kodu` (Opsiyonel)
- `YeniEge Barkod` ⚠️ **Zorunlu Alan**

**Not:** Diğer sütunlar varsa göz ardı edilir, sadece yukarıdaki 4 başlık işlenir.

#### Başarılı Response:
```json
{
  "success": true,
  "message": "Excel dosyası başarıyla okundu ve doğrulandı",
  "data": {
    "sheetName": "Sayfa1",
    "headers": ["Trim Kodu", "Renk Kodu", "Beden Kodu", "YeniEge Barkod"],
    "rowCount": 9,
    "rows": [
      {
        "Trim Kodu": "TRFED00069",
        "Renk Kodu": "039TY",
        "Beden Kodu": "10.5cm",
        "YeniEge Barkod": "YeniEge1"
      }
    ]
  }
}
```

#### Hata Durumları:

**1. Eksik Başlık Hatası:**
```json
{
  "success": false,
  "message": "Eksik başlık",
  "missingHeaders": ["YeniEge Barkod"],
  "detail": "Şu başlıklar eksik: YeniEge Barkod"
}
```

**2. Boş Zorunlu Alan Hatası:**
```json
{
  "success": false,
  "message": "Lütfen eksik bilgileri doldurunuz",
  "errors": [
    {
      "row": 3,
      "emptyFields": ["Trim Kodu", "Renk Kodu"]
    }
  ],
  "detail": "1 satırda eksik zorunlu alan bulundu"
}
```

**3. URL Hatası:**
```json
{
  "success": false,
  "message": "URL gereklidir"
}
```

## Test

### Test Scriptleri:
```bash
# Temel test
node test.js

# Validasyon testleri
node test-validation.js
```

### Manuel Test (Postman veya curl):
```bash
curl -X POST http://localhost:3000/api/read-excel \
  -H "Content-Type: application/json" \
  -d '{"url": "YOUR_EXCEL_URL_HERE"}'
```

### VS Code REST Client ile Test:
`test-request.http` dosyasını kullanarak doğrudan VS Code içinden test edebilirsiniz.

### PLM Entegrasyon Testi:
```bash
# Tam test (Excel + PLM eşleştirme)
node test-plm.js

# Sadece token testi
node test-plm.js token

# Manuel testler
node test-plm.js trim TRFED00069
node test-plm.js size 10.5cm
```

## API Endpoints

### 1. Excel Okuma + Validasyon (Sadece Okuma)
```
POST /api/read-excel
```

### 2. Excel + PLM Eşleştirme (Sadece Eşleştirme)
```
POST /api/process-excel-with-plm
```

### 3. TAM İŞLEM: Excel → PLM Eşleştirme → PLM'e Yazma 🚀

```
POST /api/process-and-write-to-plm
Content-Type: application/json

{
  "url": "https://example.com/excel-file.xlsx"
}
```

### İşlem Adımları:
1. ✅ Excel dosyasını URL'den indir ve oku
2. ✅ Başlık ve zorunlu alan validasyonu yap
3. ✅ **Trim Kodu** → PLM'den **TrimId** bul
4. ✅ **Renk Kodu** → PLM'den **TrimColorwayId** bul
5. ✅ **Beden Kodu** → PLM'den **SizeId** bul (opsiyonel)
6. ✅ **TrimSKU'ları PLM'e yaz** (`/pdm/api/pdm/sku/save`)

### Başarılı Response:
```json
{
  "success": true,
  "message": "Excel verisi başarıyla işlendi ve PLM'e yazıldı",
  "data": {
    "excel": {
      "totalRows": 9,
      "processedRows": 9
    },
    "plm": {
      "totalTrims": 1,
      "successfulTrims": 1,
      "failedTrims": 0,
      "results": [
        {
          "trimId": 1558,
          "trimCode": "TRFED00069",
          "skuCount": 9,
          "response": { /* PLM yanıtı */ }
        }
      ]
    }
  }
}
```

### PLM'e Yazılan Payload Örneği:
```json
{
  "moduleType": 3,
  "objectId": 1558,
  "skuList": [
    {
      "colorMasterId": 7680,
      "isIncluded": true,
      "makeSizeId": 118
    },
    {
      "colorMasterId": 7710,
      "isIncluded": true,
      "makeSizeId": 119
    }
  ]
}
```

## PLM Konfigürasyonu

PLM bağlantı bilgileri `plm-config.js` dosyasında tanımlanmıştır:
- **Tenant**: JKARFH4LCGZA78A5_PRD
- **API Base URL**: https://mingle-ionapi.eu1.inforcloudsuite.com/JKARFH4LCGZA78A5_PRD/FASHIONPLM
- Token otomatik olarak OAuth2 Password Credentials flow ile alınır

## Teknolojiler

- **Express**: Web framework
- **XLSX**: Excel dosyalarını okuma
- **Axios**: HTTP istekleri ve PLM API çağrıları
- **CORS**: Cross-origin resource sharing

## 🌐 Heroku Deployment

### 1. GitHub'a Push (Bu adım tamamlandı ✅)

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/KaanKaraca93/TrimSKUOpener.git
git push -u origin main
```

### 2. Heroku'da Environment Variables Ayarlama

Heroku Dashboard'da Config Vars olarak şu değişkenleri ekleyin:

```
PLM_TENANT=JKARFH4LCGZA78A5_PRD
PLM_TOKEN_URL=https://mingle-sso.eu1.inforcloudsuite.com:443/JKARFH4LCGZA78A5_PRD/as/token.oauth2
PLM_CLIENT_ID=<your_client_id>
PLM_CLIENT_SECRET=<your_client_secret>
PLM_USERNAME=<your_username>
PLM_PASSWORD=<your_password>
PLM_BASE_API_URL=https://mingle-ionapi.eu1.inforcloudsuite.com/JKARFH4LCGZA78A5_PRD/FASHIONPLM
```

**Not:** `plm-config.js` dosyası .gitignore'da olduğu için GitHub'a push edilmez. Heroku'da çalışması için yukarıdaki environment variable'lar gereklidir.

### 3. Heroku'ya Deploy

Heroku Dashboard'dan "Deploy" sekmesinden GitHub repository'sini bağlayın ve "Deploy Branch" butonuna tıklayın.

### 4. Test

Deploy tamamlandıktan sonra:
```
https://your-app-name.herokuapp.com/api/health
```

endpoint'ine istek atarak servisi test edebilirsiniz.

## 📝 Notlar

- `plm-config.js` dosyası güvenlik nedeniyle GitHub'a push edilmez
- Local development için `plm-config.example.js` dosyasını `plm-config.js` olarak kopyalayıp içini doldurun
- Production'da (Heroku) environment variable'lar kullanılır

