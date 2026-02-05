/**
 * Universal Integrator - Normalizer Service
 * 
 * This service is responsible for normalizing incoming order data from various sources
 * (Gomag, Shopify, WooCommerce, Innoship) into a unified format that the Zoom Curier
 * platform can process.
 */

const { v4: uuidv4 } = require('uuid');

/**
 * Supported source platforms
 */
const SOURCES = {
  GOMAG: 'GOMAG',
  SHOPIFY: 'SHOPIFY',
  WOOCOMMERCE: 'WOOCOMMERCE',
  INNOSHIP: 'INNOSHIP',
  OVERFLOW_IN: 'OVERFLOW_IN'
};

/**
 * Order status enum
 */
const ORDER_STATUS = {
  PENDING: 'pending',
  ASSIGNED: 'assigned',
  IN_TRANSIT: 'in_transit',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled'
};

/**
 * Normalize an order from any supported source into the unified format
 * 
 * @param {string} source - The source platform (GOMAG, SHOPIFY, WOOCOMMERCE, INNOSHIP)
 * @param {object} payload - The raw payload from the source platform
 * @returns {object} - The normalized order object
 */
const normalizeOrder = (source, payload) => {
  // Initialize the standard order object with default values
  let standardOrder = {
    internal_order_id: generateInternalOrderId(),
    external_order_id: null,
    merchant_id: null,
    service_level: 'lite', // Default service level
    status: ORDER_STATUS.PENDING,
    pickup_address: null,
    delivery_address: null,
    delivery_city: null,
    delivery_county: null,
    delivery_postal_code: null,
    delivery_country: 'RO',
    recipient_name: null,
    recipient_phone: null,
    recipient_email: null,
    is_overflow: false,
    parent_carrier_id: null,
    aggregator_source: source.toLowerCase(),
    cod_amount: 0,
    cod_currency: 'RON',
    total_weight: null,
    notes: null,
    raw_payload: JSON.stringify(payload),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  // Apply source-specific normalization
  switch (source.toUpperCase()) {
    case SOURCES.GOMAG:
      standardOrder = normalizeGomag(standardOrder, payload);
      break;
    
    case SOURCES.SHOPIFY:
      standardOrder = normalizeShopify(standardOrder, payload);
      break;

    case SOURCES.WOOCOMMERCE:
      standardOrder = normalizeWooCommerce(standardOrder, payload);
      break;

    case SOURCES.INNOSHIP:
      standardOrder = normalizeInnoship(standardOrder, payload);
      break;

    case SOURCES.OVERFLOW_IN:
      standardOrder = normalizeOverflowIn(standardOrder, payload);
      break;

    default:
      throw new Error(`Unsupported source platform: ${source}`);
  }

  // Validate required fields
  validateNormalizedOrder(standardOrder);
  
  return standardOrder;
};

/**
 * Generate a unique internal order ID
 * Format: ZC-YYYYMMDD-XXXX (e.g., ZC-20260204-a1b2)
 */
const generateInternalOrderId = () => {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const uniqueId = uuidv4().slice(0, 8);
  return `ZC-${dateStr}-${uniqueId}`;
};

/**
 * Normalize Gomag payload
 */
const normalizeGomag = (order, payload) => {
  order.external_order_id = payload.order_id?.toString() || null;
  order.recipient_name = payload.customer?.name || null;
  order.recipient_phone = cleanPhoneNumber(payload.customer?.phone);
  order.recipient_email = payload.customer?.email || null;
  
  // Build delivery address
  const addr = payload.shipping_address || {};
  order.delivery_address = buildAddress(addr.address1, addr.address2);
  order.delivery_city = addr.city || null;
  order.delivery_postal_code = addr.zip || null;
  
  // Extract COD if present
  if (payload.payment_method === 'cod' || payload.payment_method === 'ramburs') {
    order.cod_amount = parseFloat(payload.total) || 0;
    order.cod_currency = payload.currency || 'RON';
  }
  
  // Notes
  order.notes = payload.customer_note || payload.notes || null;
  
  return order;
};

/**
 * Normalize Shopify payload
 */
const normalizeShopify = (order, payload) => {
  order.external_order_id = payload.id?.toString() || null;
  
  // Customer info
  const customer = payload.customer || {};
  order.recipient_name = `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
  order.recipient_email = customer.email || null;
  
  // Shipping address
  const shipping = payload.shipping_address || {};
  order.recipient_phone = cleanPhoneNumber(shipping.phone);
  order.delivery_address = buildAddress(shipping.address1, shipping.address2);
  order.delivery_city = shipping.city || null;
  order.delivery_county = shipping.province || null;
  order.delivery_postal_code = shipping.zip || null;
  order.delivery_country = shipping.country_code || 'RO';
  
  // COD handling (Shopify uses payment_gateway_names)
  if (payload.gateway === 'Cash on Delivery (COD)' || 
      payload.payment_gateway_names?.includes('cod')) {
    order.cod_amount = parseFloat(payload.total_price) || 0;
    order.cod_currency = payload.currency || 'RON';
  }
  
  // Calculate total weight from line items
  if (payload.line_items && Array.isArray(payload.line_items)) {
    order.total_weight = payload.line_items.reduce((sum, item) => {
      return sum + ((item.grams || 0) / 1000 * (item.quantity || 1));
    }, 0);
  }
  
  order.notes = payload.note || null;
  
  return order;
};

/**
 * Normalize WooCommerce payload
 */
const normalizeWooCommerce = (order, payload) => {
  order.external_order_id = payload.id?.toString() || null;
  
  // Shipping address takes priority, fallback to billing
  const shipping = payload.shipping || {};
  const billing = payload.billing || {};
  
  order.recipient_name = `${shipping.first_name || billing.first_name || ''} ${shipping.last_name || billing.last_name || ''}`.trim();
  order.recipient_phone = cleanPhoneNumber(billing.phone);
  order.recipient_email = billing.email || null;
  
  order.delivery_address = buildAddress(shipping.address_1, shipping.address_2);
  order.delivery_city = shipping.city || null;
  order.delivery_county = shipping.state || null;
  order.delivery_postal_code = shipping.postcode || null;
  order.delivery_country = shipping.country || 'RO';
  
  // COD handling
  if (payload.payment_method === 'cod') {
    order.cod_amount = parseFloat(payload.total) || 0;
    order.cod_currency = payload.currency || 'RON';
  }
  
  // Calculate weight from line items
  if (payload.line_items && Array.isArray(payload.line_items)) {
    order.total_weight = payload.line_items.reduce((sum, item) => {
      return sum + (parseFloat(item.weight) || 0) * (item.quantity || 1);
    }, 0);
  }
  
  order.notes = payload.customer_note || null;
  
  return order;
};

/**
 * Normalize Innoship payload
 */
const normalizeInnoship = (order, payload) => {
  order.external_order_id = payload.ClientOrderId || payload.ExternalOrderId || null;
  order.aggregator_source = 'innoship';
  
  // Address To (recipient)
  const addressTo = payload.AddressTo?.[0] || {};
  order.recipient_name = addressTo.Name || addressTo.ContactPerson || null;
  order.recipient_phone = cleanPhoneNumber(addressTo.Phone);
  order.recipient_email = addressTo.Email || null;
  
  order.delivery_address = addressTo.AddressText || null;
  order.delivery_city = addressTo.LocalityName || null;
  order.delivery_county = addressTo.CountyName || null;
  order.delivery_postal_code = addressTo.PostalCode || null;
  order.delivery_country = addressTo.Country || 'RO';
  
  // Address From (pickup)
  const addressFrom = payload.AddressFrom?.[0] || {};
  order.pickup_address = addressFrom.AddressText || null;
  
  // Content
  const content = payload.Content?.[0] || {};
  order.total_weight = content.TotalWeight || null;
  
  // Extra (COD, etc.)
  const extra = payload.Extra || {};
  if (extra.CashOnDeliveryAmount || extra.BankRepaymentAmount) {
    order.cod_amount = extra.CashOnDeliveryAmount || extra.BankRepaymentAmount || 0;
    order.cod_currency = extra.cashOnDeliveryAmountCurrency || extra.BankRepaymentCurrency || 'RON';
  }
  
  order.notes = payload.Observation || null;
  
  return order;
};

/**
 * Normalize Overflow IN payload (from partner carriers like Fan Courier, Sameday)
 */
const normalizeOverflowIn = (order, payload) => {
  order.is_overflow = true;
  order.parent_carrier_id = payload.carrier_id || null;
  order.external_order_id = payload.awb_number || payload.shipment_id || null;
  
  order.recipient_name = payload.recipient_name || null;
  order.recipient_phone = cleanPhoneNumber(payload.recipient_phone);
  order.delivery_address = payload.delivery_address || null;
  order.delivery_city = payload.delivery_city || null;
  order.delivery_county = payload.delivery_county || null;
  order.delivery_postal_code = payload.delivery_postal_code || null;
  
  order.cod_amount = parseFloat(payload.cod_amount) || 0;
  order.cod_currency = payload.cod_currency || 'RON';
  order.total_weight = parseFloat(payload.weight) || null;
  
  order.notes = `Overflow from carrier ID: ${payload.carrier_id}. Original AWB: ${payload.awb_number}`;
  
  return order;
};

/**
 * Helper: Build address string from multiple parts
 */
const buildAddress = (address1, address2) => {
  const parts = [address1, address2].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : null;
};

/**
 * Helper: Clean and format phone number
 */
const cleanPhoneNumber = (phone) => {
  if (!phone) return null;
  
  // Remove all non-numeric characters except +
  let cleaned = phone.replace(/[^\d+]/g, '');
  
  // Ensure Romanian numbers have proper format
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    cleaned = '+40' + cleaned.slice(1);
  } else if (cleaned.startsWith('40') && cleaned.length === 11) {
    cleaned = '+' + cleaned;
  }
  
  return cleaned;
};

/**
 * Validate that all required fields are present in the normalized order
 */
const validateNormalizedOrder = (order) => {
  const requiredFields = ['external_order_id', 'recipient_name', 'delivery_address'];
  const missingFields = requiredFields.filter(field => !order[field]);
  
  if (missingFields.length > 0) {
    throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
  }
  
  return true;
};

/**
 * Detect the source platform from the payload structure
 */
const detectSource = (payload, headers = {}) => {
  // Check headers first (most reliable)
  if (headers['x-shopify-topic']) return SOURCES.SHOPIFY;
  if (headers['x-wc-webhook-topic']) return SOURCES.WOOCOMMERCE;
  if (headers['x-gomag-webhook']) return SOURCES.GOMAG;
  if (headers['x-innoship-signature']) return SOURCES.INNOSHIP;
  
  // Fallback to payload structure detection
  if (payload.line_items && payload.shipping_address?.province_code) return SOURCES.SHOPIFY;
  if (payload.billing && payload.shipping && payload.line_items) return SOURCES.WOOCOMMERCE;
  if (payload.AddressTo && payload.AddressFrom && payload.Content) return SOURCES.INNOSHIP;
  if (payload.customer && payload.shipping_address && !payload.billing) return SOURCES.GOMAG;
  if (payload.awb_number && payload.carrier_id) return SOURCES.OVERFLOW_IN;
  
  return null;
};

module.exports = {
  normalizeOrder,
  detectSource,
  generateInternalOrderId,
  SOURCES,
  ORDER_STATUS
};
