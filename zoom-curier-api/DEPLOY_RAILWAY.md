# 🚀 Deploy Zoom Curier API pe Railway

Ghid pas-cu-pas pentru a obține un URL public în **5 minute**.

---

## Cerințe Preliminare

- Cont GitHub (gratuit): [github.com](https://github.com)
- Cont Railway (gratuit): [railway.app](https://railway.app)

---

## Pasul 1: Creează Repository GitHub

### Opțiunea A: Upload Direct (Recomandat)

1. Mergi la [github.com/new](https://github.com/new)
2. Nume repository: `zoom-curier-api`
3. Vizibilitate: **Private** (recomandat)
4. Click **Create repository**
5. Urmează instrucțiunile pentru "upload an existing file"
6. Upload toate fișierele din folderul `zoom-curier-api/`

### Opțiunea B: Git Command Line

```bash
cd zoom-curier-api

# Inițializează git
git init
git add .
git commit -m "Initial commit - Zoom Curier Universal Integrator"

# Conectează la GitHub
git remote add origin https://github.com/YOUR_USERNAME/zoom-curier-api.git
git branch -M main
git push -u origin main
```

---

## Pasul 2: Deploy pe Railway

### 2.1 Conectare GitHub

1. Mergi la [railway.app](https://railway.app)
2. Click **Login** → **Login with GitHub**
3. Autorizează Railway să acceseze repo-urile tale

### 2.2 Creează Proiect Nou

1. Click **New Project**
2. Selectează **Deploy from GitHub repo**
3. Alege repository-ul `zoom-curier-api`
4. Railway va detecta automat că e un proiect Node.js

### 2.3 Configurare Variabile de Mediu

1. În dashboard-ul proiectului, click pe serviciu
2. Tab **Variables**
3. Adaugă următoarele variabile:

```
PORT=3000
NODE_ENV=production
USE_IN_MEMORY_DB=true
WHATSAPP_ENABLED=false
WHATSAPP_DRY_RUN=true
```

### 2.4 Generează URL Public

1. Tab **Settings**
2. Secțiunea **Networking**
3. Click **Generate Domain**
4. Vei primi un URL de forma: `zoom-curier-api-production.up.railway.app`

---

## Pasul 3: Verifică Deploy-ul

### Health Check

```bash
curl https://YOUR-APP.up.railway.app/health
```

Răspuns așteptat:
```json
{
  "status": "healthy",
  "timestamp": "2026-02-04T12:00:00.000Z",
  "version": "1.0.0",
  "environment": "production"
}
```

### Test Webhook Gomag

```bash
curl -X POST https://YOUR-APP.up.railway.app/api/webhooks/gomag \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "TEST-001",
    "customer": {
      "name": "Ion Popescu",
      "phone": "0712345678",
      "email": "ion@test.ro"
    },
    "shipping_address": {
      "address1": "Str. Victoriei 10",
      "city": "București",
      "county": "Sector 1",
      "postal_code": "010001"
    },
    "total_price": "150.00",
    "payment_method": "cod"
  }'
```

Răspuns așteptat:
```json
{
  "success": true,
  "message": "Gomag order processed successfully",
  "data": {
    "internal_order_id": "ZC-20260204-xxxxxxxx",
    "external_order_id": "TEST-001",
    "status": "pending"
  }
}
```

---

## Pasul 4: Configurare Gomag Webhook

1. Loghează-te în panoul Gomag
2. Mergi la **Setări** → **Integrări** → **Webhooks**
3. Adaugă webhook nou:
   - **URL**: `https://YOUR-APP.up.railway.app/api/webhooks/gomag`
   - **Trigger**: Status "Ready for delivery"
   - **Format**: JSON
4. Salvează și testează

---

## Pasul 5: Activare WhatsApp (Opțional)

După ce ai testat fluxul de bază, poți activa notificările WhatsApp:

1. În Railway → Variables, actualizează:

```
WHATSAPP_ENABLED=true
WHATSAPP_DRY_RUN=false
WHATSAPP_PHONE_NUMBER_ID=your_actual_phone_id
WHATSAPP_ACCESS_TOKEN=your_actual_token
```

2. Railway va face auto-redeploy

---

## Endpoint-uri Disponibile

| Endpoint | Metodă | Descriere |
|----------|--------|-----------|
| `/health` | GET | Health check |
| `/api/webhooks/orders` | POST | Universal (auto-detect) |
| `/api/webhooks/gomag` | POST | Gomag specific |
| `/api/webhooks/shopify` | POST | Shopify specific |
| `/api/webhooks/woocommerce` | POST | WooCommerce specific |
| `/api/webhooks/innoship` | POST | Innoship specific |
| `/api/webhooks/overflow` | POST | Overflow IN |
| `/api/orders` | GET | Listare comenzi |
| `/api/orders/:id` | GET | Detalii comandă |
| `/api/orders/:id/status` | PATCH | Update status |
| `/api/orders/:id/assign` | POST | Alocare curier |
| `/api/orders/:id/out-for-delivery` | POST | Marcare în tranzit |
| `/api/orders/:id/delivered` | POST | Marcare livrat |
| `/api/orders/:id/cancel` | POST | Anulare |

---

## Monitorizare & Logs

### Vezi Logs în Railway

1. Dashboard proiect → Tab **Deployments**
2. Click pe deployment activ
3. Tab **Logs** pentru a vedea output-ul în timp real

### Exemple Log-uri

```
📦 Received Gomag webhook
📋 Payload: { order_id: "TEST-001", ... }
✅ Normalized order: { internal_order_id: "ZC-...", ... }
📱 WhatsApp confirmation sent for order ZC-...
```

---

## Troubleshooting

### Eroare: "Application failed to respond"

- Verifică că `PORT` e setat la `3000` în Variables
- Verifică logs pentru erori de sintaxă

### Eroare: "Cannot connect to database"

- Pentru MVP, asigură-te că `USE_IN_MEMORY_DB=true`
- Pentru producție, adaugă MySQL plugin din Railway

### Webhook nu primește date

- Verifică URL-ul în Gomag (HTTPS obligatoriu)
- Testează manual cu curl
- Verifică logs în Railway

---

## Costuri Railway

| Plan | Preț | Include |
|------|------|---------|
| **Hobby** | $5/lună | 500 ore execuție, suficient pentru MVP |
| **Pro** | $20/lună | Unlimited, custom domains |

**Notă**: Railway oferă $5 credit gratuit pentru utilizatori noi.

---

## Next Steps

1. ✅ Deploy pe Railway
2. ⬜ Configurare webhook în Gomag
3. ⬜ Test comandă reală
4. ⬜ Activare WhatsApp
5. ⬜ Custom domain (api.curier-local.ro)

---

*Documentație pentru Zoom Curier / curier-local.ro*
*Versiune: 1.0.0 | Data: Februarie 2026*
