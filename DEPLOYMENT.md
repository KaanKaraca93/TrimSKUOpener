# 🚀 TrimSKUOpener - Production Deployment Guide

## 📋 Gereksinimler

### Heroku Add-ons:
- ✅ **Heroku Postgres** (Database - Free tier yeterli)

### Heroku Dynos:
- ✅ **Web Dyno** (Eco $5/ay veya Basic $7/ay)
- ✅ **Worker Dyno** (Basic $7/ay - Önerilen)

### **Toplam Maliyet**: $12-14/ay

---

## 🛠️ Deployment Adımları

### 1️⃣ **Heroku Postgres Provision Et**

```bash
# Heroku Dashboard'dan veya CLI ile:
heroku addons:create heroku-postgresql:mini --app trimskuopener-4b8505224c7d
```

**Otomatik olarak `DATABASE_URL` environment variable eklenecek.**

✅ Kontrol et:
```bash
heroku config --app trimskuopener-4b8505224c7d | grep DATABASE_URL
```

---

### 2️⃣ **Kodu Deploy Et**

```bash
cd TrimSKUOpener

# Tüm değişiklikleri commit et
git add .
git commit -m "Add async processing with Worker Dyno"
git push origin main
```

**Heroku otomatik deploy edecek** (GitHub entegrasyonu aktifse)

YA DA manuel deploy:
```bash
git push heroku main
```

---

### 3️⃣ **Worker Dyno'yu Aktif Et**

```bash
# Worker dyno'yu aç (ÖNEMLİ!)
heroku ps:scale worker=1 --app trimskuopener-4b8505224c7d
```

✅ Kontrol et:
```bash
heroku ps --app trimskuopener-4b8505224c7d
```

**Görmek istediğiniz:**
```
=== web (Eco): node server.js (1)
web.1: up 2024/12/24 12:00:00 +0300 (~ 1h ago)

=== worker (Basic): node worker.js (1)
worker.1: up 2024/12/24 12:00:00 +0300 (~ 1h ago)
```

---

### 4️⃣ **Database Schema'yı Initialize Et**

Web dyno başladığında otomatik olarak `initializeDatabase()` çalışır.

✅ Kontrol et:
```bash
heroku logs --tail --app trimskuopener-4b8505224c7d
```

**Görmek istediğiniz:**
```
✅ PostgreSQL bağlantısı başarılı
🔧 Database schema kontrol ediliyor...
✅ Database schema hazır
```

---

## ✅ Test Et

### 1. **Health Check**
```bash
curl https://trimskuopener-4b8505224c7d.herokuapp.com/api/health
```

### 2. **Async XML Processing**

#### Swagger UI'dan:
1. https://trimskuopener-4b8505224c7d.herokuapp.com/api-docs
2. **POST /api/process-xml-async** seç
3. XML payload gönder
4. **jobId** al

#### Job Status Kontrol:
1. **GET /api/job-status/{jobId}** seç
2. jobId'yi gir
3. Status kontrol et:
   - `pending` → Worker henüz almadı
   - `processing` → İşlem devam ediyor (progress görebilirsin)
   - `completed` → Tamamlandı (result'ı görebilirsin)
   - `failed` → Hata oluştu (error mesajını görebilirsin)

---

## 📊 Monitoring

### Log'ları İzle:
```bash
# Tüm log'lar
heroku logs --tail --app trimskuopener-4b8505224c7d

# Sadece worker log'ları
heroku logs --tail --ps worker --app trimskuopener-4b8505224c7d

# Sadece web log'ları
heroku logs --tail --ps web --app trimskuopener-4b8505224c7d
```

### Database Kontrol:
```bash
heroku pg:info --app trimskuopener-4b8505224c7d
```

### Jobs Table Kontrol:
```bash
heroku pg:psql --app trimskuopener-4b8505224c7d

# Jobs'ları listele
SELECT id, status, created_at, total_rows, processed_rows, current_step 
FROM jobs 
ORDER BY created_at DESC 
LIMIT 10;

# Pending jobs
SELECT COUNT(*) FROM jobs WHERE status = 'pending';

# Processing jobs
SELECT COUNT(*) FROM jobs WHERE status = 'processing';

# Exit
\q
```

---

## 🔧 Troubleshooting

### Problem: Worker çalışmıyor
```bash
# Worker log'larını kontrol et
heroku logs --tail --ps worker --app trimskuopener-4b8505224c7d

# Worker'ı restart et
heroku ps:restart worker --app trimskuopener-4b8505224c7d

# Worker scale kontrol et
heroku ps --app trimskuopener-4b8505224c7d
```

### Problem: Database bağlanamıyor
```bash
# DATABASE_URL var mı?
heroku config --app trimskuopener-4b8505224c7d | grep DATABASE

# Postgres bilgileri
heroku pg:info --app trimskuopener-4b8505224c7d
```

### Problem: Job pending'de kalıyor
1. Worker dyno çalışıyor mu? → `heroku ps`
2. Worker log'larında hata var mı? → `heroku logs --ps worker`
3. Database bağlantısı var mı? → `heroku pg:psql` ile test et

---

## 💰 Maliyet Optimizasyonu

### Seçenek 1: **Eco Web + Basic Worker** (Önerilen)
```bash
heroku ps:type web=eco --app trimskuopener-4b8505224c7d
heroku ps:type worker=basic --app trimskuopener-4b8505224c7d
```
**Maliyet**: $5 + $7 = **$12/ay**

### Seçenek 2: **Basic Web + Basic Worker**
```bash
heroku ps:type web=basic --app trimskuopener-4b8505224c7d
heroku ps:type worker=basic --app trimskuopener-4b8505224c7d
```
**Maliyet**: $7 + $7 = **$14/ay**

### Seçenek 3: **Düşük trafikte worker'ı kapat**
```bash
# Gece worker'ı kapat
heroku ps:scale worker=0 --app trimskuopener-4b8505224c7d

# Sabah aç
heroku ps:scale worker=1 --app trimskuopener-4b8505224c7d
```

---

## 🎯 Production Kullanım

### PLM'den İşlem Gönderme:

```http
POST https://trimskuopener-4b8505224c7d.herokuapp.com/api/process-xml-async
Content-Type: application/xml

<DocumentRevisionUpdate>
  <AlternateDocumentID>TYPE="ITEMS", ITEMID="123"</AlternateDocumentID>
  <DocumentMetaData>
    <DocumentTypeID>TrimBarcode</DocumentTypeID>
  </DocumentMetaData>
</DocumentRevisionUpdate>
```

**Response (202 Accepted):**
```json
{
  "success": true,
  "message": "İşlem alındı, arka planda işleniyor",
  "jobId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "statusUrl": "/api/job-status/a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "estimatedTime": "2-5 dakika"
}
```

### Polling (5-10 saniyede bir):

```http
GET https://trimskuopener-4b8505224c7d.herokuapp.com/api/job-status/a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

**Response (Processing):**
```json
{
  "success": true,
  "jobId": "a1b2c3d4...",
  "status": "processing",
  "progress": {
    "totalRows": 1000,
    "processedRows": 450,
    "currentStep": "Barkodlar atanıyor... (450/1000)"
  }
}
```

**Response (Completed):**
```json
{
  "success": true,
  "jobId": "a1b2c3d4...",
  "status": "completed",
  "completedAt": "2024-12-24T12:05:00Z",
  "result": {
    "summary": {
      "totalRows": 1000,
      "assignedBarcodes": 1000,
      "failedBarcodes": 0
    }
  }
}
```

---

## 🔥 Performans

### Beklenen İşlem Süreleri:

| Satır Sayısı | Süre (Tahmini) |
|--------------|----------------|
| 100 satır    | ~30 saniye     |
| 500 satır    | ~2 dakika      |
| 1000 satır   | ~4 dakika      |
| 2000 satır   | ~8 dakika      |

**Not**: Worker dyno timeout olmaz, 10 dakika+ işlemler çalışabilir!

---

## 🎉 Tamamlandı!

Artık production'da 1000+ satırlık listeler işlenebilir! 🚀

