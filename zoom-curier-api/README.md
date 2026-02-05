# Zoom Curier API - Universal Integrator

Backend API for the Zoom Curier / curier-local.ro urban logistics platform. This service acts as the "Universal Integrator" - a single point of entry for orders from multiple e-commerce platforms and aggregators.

## Features

- **Universal Webhook Endpoint**: Single endpoint (`POST /api/webhooks/orders`) that accepts orders from any supported platform
- **Platform-Specific Endpoints**: Dedicated endpoints for Gomag, Shopify, WooCommerce, and Innoship
- **Automatic Source Detection**: Intelligently detects the source platform from headers and payload structure
- **Order Normalization**: Transforms diverse payload formats into a unified internal format
- **Overflow Management**: Supports receiving orders from partner carriers (Fan Courier, Sameday, etc.)
- **In-Memory Fallback**: Works without a database for development and testing

## Supported Platforms

| Platform | Endpoint | Priority |
|----------|----------|----------|
| Gomag | `/api/webhooks/gomag` | P0 (Romania) |
| Shopify | `/api/webhooks/shopify` | P0 (International) |
| WooCommerce | `/api/webhooks/woocommerce` | P0 (International) |
| Innoship | `/api/webhooks/innoship` | P1 (Aggregator) |
| Overflow IN | `/api/webhooks/overflow` | P3 (Partner Carriers) |

## Quick Start

### Prerequisites

- Node.js 18+
- MySQL 8.0+ (optional, can use in-memory storage)

### Installation

```bash
# Clone the repository
cd zoom-curier-api

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your configuration
nano .env

# Run database migrations (if using MySQL)
mysql -u root -p < migrations/001_create_orders_table.sql

# Start the server
npm start

# Or for development with auto-reload
npm run dev
```

### Environment Variables

```env
PORT=3000
NODE_ENV=development
USE_IN_MEMORY_DB=true  # Set to false to use MySQL

DB_HOST=localhost
DB_PORT=3306
DB_USER=zoom_curier
DB_PASSWORD=your_password
DB_NAME=zoom_curier_db
```

## API Endpoints

### Health Check

```bash
GET /api/health
```

### Webhooks

```bash
# Universal endpoint (auto-detects source)
POST /api/webhooks/orders?source=GOMAG|SHOPIFY|WOOCOMMERCE|INNOSHIP

# Platform-specific endpoints
POST /api/webhooks/gomag
POST /api/webhooks/shopify
POST /api/webhooks/woocommerce
POST /api/webhooks/innoship
POST /api/webhooks/overflow
```

### Orders

```bash
# List orders with filters
GET /api/orders?status=pending&source=gomag&limit=50

# Get single order
GET /api/orders/:id

# Update order status
PATCH /api/orders/:id/status
Body: { "status": "in_transit", "notes": "Driver picked up" }

# Assign driver
POST /api/orders/:id/assign
Body: { "driver_id": 123 }

# Cancel order
POST /api/orders/:id/cancel
Body: { "reason": "Customer requested cancellation" }
```

## Example Webhook Payloads

### Gomag

```json
{
  "order_id": "GOMAG-12345",
  "customer": {
    "name": "Ion Popescu",
    "phone": "0712345678",
    "email": "ion@example.com"
  },
  "shipping_address": {
    "address1": "Str. Victoriei 10",
    "address2": "Ap. 5",
    "city": "București",
    "zip": "010101"
  },
  "payment_method": "cod",
  "total": 150.00,
  "currency": "RON"
}
```

### Shopify

```json
{
  "id": 12345678,
  "customer": {
    "first_name": "Ion",
    "last_name": "Popescu",
    "email": "ion@example.com"
  },
  "shipping_address": {
    "address1": "Str. Victoriei 10",
    "address2": "Ap. 5",
    "city": "București",
    "province": "București",
    "zip": "010101",
    "phone": "0712345678"
  },
  "line_items": [
    { "name": "Product A", "quantity": 1, "grams": 500 }
  ],
  "total_price": "150.00",
  "currency": "RON"
}
```

## Architecture

```
zoom-curier-api/
├── src/
│   ├── index.js              # Entry point
│   ├── config/
│   │   └── database.js       # Database configuration
│   ├── controllers/
│   │   ├── webhook.controller.js
│   │   └── order.controller.js
│   ├── models/
│   │   └── order.model.js
│   ├── routes/
│   │   ├── webhook.routes.js
│   │   ├── order.routes.js
│   │   └── health.routes.js
│   ├── services/
│   │   ├── normalizer.service.js  # The Universal Integrator logic
│   │   └── order.service.js
│   └── middleware/
│       └── errorHandler.js
├── migrations/
│   └── 001_create_orders_table.sql
├── tests/
├── .env.example
├── package.json
└── README.md
```

## Testing

```bash
# Test Gomag webhook
curl -X POST http://localhost:3000/api/webhooks/gomag \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "TEST-001",
    "customer": { "name": "Test User", "phone": "0712345678" },
    "shipping_address": { "address1": "Test Street 1", "city": "București" }
  }'

# Test universal endpoint with source parameter
curl -X POST "http://localhost:3000/api/webhooks/orders?source=SHOPIFY" \
  -H "Content-Type: application/json" \
  -d '{
    "id": 12345,
    "customer": { "first_name": "Test", "last_name": "User" },
    "shipping_address": { "address1": "Test Street 1", "city": "București", "phone": "0712345678" }
  }'
```

## License

MIT License - Zoom Curier / curier-local.ro
