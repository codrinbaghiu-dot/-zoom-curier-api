# WhatsApp Message Templates - Zoom Curier

Aceste template-uri trebuie create și aprobate în **Meta Business Manager** înainte de a putea fi utilizate prin API.

## Ghid de Aprobare

1. Accesează [Meta Business Manager](https://business.facebook.com)
2. Navighează la **WhatsApp Manager** → **Message Templates**
3. Click **Create Template**
4. Completează informațiile conform specificațiilor de mai jos

---

## Template 1: Confirmare Comandă

| Câmp | Valoare |
|------|---------|
| **Template Name** | `zoom_order_confirmation` |
| **Category** | Utility |
| **Language** | Romanian (ro) |

### Header (Optional)
```
Comandă Confirmată ✅
```

### Body
```
Bună {{1}}! 👋

Comanda ta #{{2}} a fost preluată cu succes de Zoom Curier.

📍 Adresa de livrare:
{{3}}

⏰ Livrare estimată: Astăzi, în intervalul 10:00 - 18:00

Vei primi o notificare când curierul pleacă spre tine.

Mulțumim că ai ales Zoom Curier! 🚀
```

### Footer
```
Zoom Curier - Livrări rapide în București
```

### Buttons (Optional)
- **Quick Reply**: "Urmărește comanda"
- **Quick Reply**: "Contactează suport"

---

## Template 2: Curier Alocat

| Câmp | Valoare |
|------|---------|
| **Template Name** | `zoom_driver_assigned` |
| **Category** | Utility |
| **Language** | Romanian (ro) |

### Body
```
Salut {{1}}! 🚗

Curierul tău a fost alocat:

👤 Nume: {{2}}
📱 Telefon: {{3}}
⏰ Ora estimată de sosire: {{4}}

Poți contacta curierul direct dacă ai instrucțiuni speciale de livrare.

Te așteptăm! 📦
```

### Buttons
- **Call Button**: "Sună curierul" → `{{3}}`

---

## Template 3: În Drum Spre Tine

| Câmp | Valoare |
|------|---------|
| **Template Name** | `zoom_out_for_delivery` |
| **Category** | Utility |
| **Language** | Romanian (ro) |

### Header
```
🚀 Curierul e pe drum!
```

### Body
```
{{1}}, coletul tău ajunge în aproximativ {{2}} minute!

📍 Urmărește în timp real:
{{3}}

Te rugăm să fii disponibil pentru a prelua coletul.

Dacă nu ești acasă, curierul te va contacta telefonic.
```

### Buttons
- **URL Button**: "Urmărește live" → `{{3}}`

---

## Template 4: Livrare Finalizată

| Câmp | Valoare |
|------|---------|
| **Template Name** | `zoom_delivery_completed` |
| **Category** | Utility |
| **Language** | Romanian (ro) |

### Header
```
✅ Livrare Finalizată!
```

### Body
```
Felicitări {{1}}! 🎉

Comanda #{{2}} a fost livrată cu succes.

Ne-ar plăcea să știm cum a fost experiența ta:
{{3}}

Mulțumim că ai ales Zoom Curier! 💚

La următoarea comandă, folosește codul ZOOM10 pentru 10% reducere.
```

### Buttons
- **URL Button**: "Lasă o recenzie" → `{{3}}`
- **Quick Reply**: "Comandă din nou"

---

## Template 5: Livrare Eșuată

| Câmp | Valoare |
|------|---------|
| **Template Name** | `zoom_delivery_failed` |
| **Category** | Utility |
| **Language** | Romanian (ro) |

### Body
```
Bună {{1}},

Din păcate, nu am reușit să livrăm coletul tău.

📋 Motiv: {{2}}

Reprogramează livrarea gratuit:
{{3}}

Sau contactează-ne pentru asistență:
📞 0800 123 456 (gratuit)

Ne cerem scuze pentru inconveniență!
```

### Buttons
- **URL Button**: "Reprogramează" → `{{3}}`
- **Phone Button**: "Sună suport" → `+40800123456`

---

## Template 6: Reminder Plată Ramburs (COD)

| Câmp | Valoare |
|------|---------|
| **Template Name** | `zoom_cod_reminder` |
| **Category** | Utility |
| **Language** | Romanian (ro) |

### Body
```
Salut {{1}}! 💰

Reamintire: Comanda ta #{{2}} are plată ramburs.

💵 Suma de achitat: {{3}} RON

Te rugăm să pregătești suma exactă pentru curier.

Acceptăm: numerar sau card (POS mobil).
```

---

## Template 7: Feedback Request (24h după livrare)

| Câmp | Valoare |
|------|---------|
| **Template Name** | `zoom_feedback_request` |
| **Category** | Marketing |
| **Language** | Romanian (ro) |

### Body
```
Bună {{1}}! 😊

A trecut o zi de la livrarea comenzii tale.

Cum a fost experiența cu Zoom Curier?

⭐ Lasă-ne un review și primești 15% reducere la următoarea comandă:
{{2}}

Feedback-ul tău ne ajută să devenim mai buni!

Mulțumim! 💚
```

### Buttons
- **URL Button**: "Lasă review" → `{{2}}`

---

## Variabile Template

| Placeholder | Descriere | Exemplu |
|-------------|-----------|---------|
| `{{1}}` | Numele clientului | Ion Popescu |
| `{{2}}` | ID comandă / Nume curier / Sumă | ZC-20260204-abc123 |
| `{{3}}` | Adresă / Telefon / Link | Str. Victoriei 10, București |
| `{{4}}` | Ora estimată | 14:30 |

---

## Reguli de Aprobare Meta

1. **Nu include**: prețuri specifice, promoții agresive, conținut spam
2. **Evită**: CAPS LOCK excesiv, prea multe emoji-uri
3. **Include**: informații utile pentru client
4. **Categoria corectă**: Utility pentru notificări tranzacționale, Marketing pentru promoții
5. **Timp aprobare**: 24-48 ore (poate dura până la 7 zile)

---

## Configurare în .env

```env
# WhatsApp Business API
WHATSAPP_API_URL=https://graph.facebook.com/v18.0
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_ACCESS_TOKEN=your_access_token
WHATSAPP_BUSINESS_ACCOUNT_ID=your_business_account_id

# Feature Flags
WHATSAPP_DRY_RUN=true  # Set to false in production

# Links
TRACKING_BASE_URL=https://curier-local.ro/track
FEEDBACK_BASE_URL=https://curier-local.ro/feedback
RESCHEDULE_BASE_URL=https://curier-local.ro/reschedule
```
