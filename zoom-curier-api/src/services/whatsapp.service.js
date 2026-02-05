/**
 * WhatsApp Notification Service (LeadXpress Integration)
 * 
 * This service handles automated WhatsApp notifications to customers
 * throughout the order lifecycle using the WhatsApp Business API.
 * 
 * Integration with LeadXpress for professional WhatsApp marketing.
 */

const https = require('https');

// WhatsApp Business API Configuration
const WHATSAPP_CONFIG = {
  apiUrl: process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v18.0',
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
  businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID
};

/**
 * Message Templates for Order Lifecycle
 * These templates should be pre-approved in WhatsApp Business Manager
 */
const MESSAGE_TEMPLATES = {
  // Order Confirmation - Sent immediately when order is received
  ORDER_CONFIRMATION: {
    name: 'zoom_order_confirmation',
    language: 'ro',
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: '{{recipient_name}}' },
          { type: 'text', text: '{{order_id}}' },
          { type: 'text', text: '{{delivery_address}}' }
        ]
      }
    ]
  },
  
  // Driver Assigned - Sent when a driver picks up the order
  DRIVER_ASSIGNED: {
    name: 'zoom_driver_assigned',
    language: 'ro',
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: '{{recipient_name}}' },
          { type: 'text', text: '{{driver_name}}' },
          { type: 'text', text: '{{driver_phone}}' },
          { type: 'text', text: '{{eta}}' }
        ]
      }
    ]
  },
  
  // Out for Delivery - Sent when driver starts delivery route
  OUT_FOR_DELIVERY: {
    name: 'zoom_out_for_delivery',
    language: 'ro',
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: '{{recipient_name}}' },
          { type: 'text', text: '{{eta_minutes}}' },
          { type: 'text', text: '{{tracking_link}}' }
        ]
      }
    ]
  },
  
  // Delivery Completed - Sent after successful delivery
  DELIVERY_COMPLETED: {
    name: 'zoom_delivery_completed',
    language: 'ro',
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: '{{recipient_name}}' },
          { type: 'text', text: '{{order_id}}' },
          { type: 'text', text: '{{feedback_link}}' }
        ]
      }
    ]
  },
  
  // Delivery Failed - Sent if delivery attempt fails
  DELIVERY_FAILED: {
    name: 'zoom_delivery_failed',
    language: 'ro',
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: '{{recipient_name}}' },
          { type: 'text', text: '{{reason}}' },
          { type: 'text', text: '{{reschedule_link}}' }
        ]
      }
    ]
  }
};

/**
 * Send WhatsApp message using template
 * 
 * @param {string} phoneNumber - Recipient phone number (with country code)
 * @param {string} templateName - Name of the template to use
 * @param {object} parameters - Template parameters
 * @returns {Promise<object>} - API response
 */
const sendTemplateMessage = async (phoneNumber, templateName, parameters) => {
  const template = MESSAGE_TEMPLATES[templateName];
  
  if (!template) {
    throw new Error(`Unknown template: ${templateName}`);
  }
  
  // Format phone number (ensure it has country code)
  const formattedPhone = formatPhoneNumber(phoneNumber);
  
  // Build the request payload
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: formattedPhone,
    type: 'template',
    template: {
      name: template.name,
      language: {
        code: template.language
      },
      components: buildTemplateComponents(template.components, parameters)
    }
  };
  
  console.log(`📱 Sending WhatsApp message to ${formattedPhone} using template ${templateName}`);
  
  try {
    const response = await makeWhatsAppApiCall(payload);
    console.log(`✅ WhatsApp message sent successfully. Message ID: ${response.messages?.[0]?.id}`);
    return response;
  } catch (error) {
    console.error(`❌ Failed to send WhatsApp message:`, error.message);
    throw error;
  }
};

/**
 * Send Order Confirmation to Customer
 * Called immediately when a new order is received and normalized
 */
const sendOrderConfirmation = async (order) => {
  if (!order.recipient_phone) {
    console.warn(`⚠️ Cannot send confirmation - no phone number for order ${order.internal_order_id}`);
    return null;
  }
  
  const parameters = {
    recipient_name: order.recipient_name || 'Client',
    order_id: order.internal_order_id,
    delivery_address: order.delivery_address || 'Adresa specificată'
  };
  
  return await sendTemplateMessage(
    order.recipient_phone,
    'ORDER_CONFIRMATION',
    parameters
  );
};

/**
 * Send Driver Assigned Notification
 * Called when a driver is assigned to the order
 */
const sendDriverAssignedNotification = async (order, driver) => {
  if (!order.recipient_phone) {
    console.warn(`⚠️ Cannot send notification - no phone number for order ${order.internal_order_id}`);
    return null;
  }
  
  const parameters = {
    recipient_name: order.recipient_name || 'Client',
    driver_name: driver.name || 'Curierul Zoom',
    driver_phone: driver.phone || '',
    eta: calculateETA(order, driver)
  };
  
  return await sendTemplateMessage(
    order.recipient_phone,
    'DRIVER_ASSIGNED',
    parameters
  );
};

/**
 * Send Out for Delivery Notification
 * Called when driver starts the delivery route
 */
const sendOutForDeliveryNotification = async (order, etaMinutes) => {
  if (!order.recipient_phone) {
    console.warn(`⚠️ Cannot send notification - no phone number for order ${order.internal_order_id}`);
    return null;
  }
  
  const trackingLink = generateTrackingLink(order.internal_order_id);
  
  const parameters = {
    recipient_name: order.recipient_name || 'Client',
    eta_minutes: etaMinutes?.toString() || '30',
    tracking_link: trackingLink
  };
  
  return await sendTemplateMessage(
    order.recipient_phone,
    'OUT_FOR_DELIVERY',
    parameters
  );
};

/**
 * Send Delivery Completed Notification
 * Called after successful delivery
 */
const sendDeliveryCompletedNotification = async (order) => {
  if (!order.recipient_phone) {
    console.warn(`⚠️ Cannot send notification - no phone number for order ${order.internal_order_id}`);
    return null;
  }
  
  const feedbackLink = generateFeedbackLink(order.internal_order_id);
  
  const parameters = {
    recipient_name: order.recipient_name || 'Client',
    order_id: order.internal_order_id,
    feedback_link: feedbackLink
  };
  
  return await sendTemplateMessage(
    order.recipient_phone,
    'DELIVERY_COMPLETED',
    parameters
  );
};

/**
 * Send Delivery Failed Notification
 * Called if delivery attempt fails
 */
const sendDeliveryFailedNotification = async (order, reason) => {
  if (!order.recipient_phone) {
    console.warn(`⚠️ Cannot send notification - no phone number for order ${order.internal_order_id}`);
    return null;
  }
  
  const rescheduleLink = generateRescheduleLink(order.internal_order_id);
  
  const parameters = {
    recipient_name: order.recipient_name || 'Client',
    reason: reason || 'Destinatar absent',
    reschedule_link: rescheduleLink
  };
  
  return await sendTemplateMessage(
    order.recipient_phone,
    'DELIVERY_FAILED',
    parameters
  );
};

/**
 * Send free-form text message (for customer service replies)
 * Note: Can only be sent within 24h of customer's last message
 */
const sendTextMessage = async (phoneNumber, text) => {
  const formattedPhone = formatPhoneNumber(phoneNumber);
  
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: formattedPhone,
    type: 'text',
    text: {
      preview_url: true,
      body: text
    }
  };
  
  return await makeWhatsAppApiCall(payload);
};

/**
 * Make API call to WhatsApp Business API
 */
const makeWhatsAppApiCall = async (payload) => {
  const url = `${WHATSAPP_CONFIG.apiUrl}/${WHATSAPP_CONFIG.phoneNumberId}/messages`;
  
  // For development/testing without actual WhatsApp API
  if (process.env.WHATSAPP_DRY_RUN === 'true') {
    console.log(`🔧 [DRY RUN] Would send to WhatsApp API:`, JSON.stringify(payload, null, 2));
    return { 
      messages: [{ id: `dry_run_${Date.now()}` }],
      dry_run: true 
    };
  }
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${WHATSAPP_CONFIG.accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`WhatsApp API Error: ${JSON.stringify(error)}`);
  }
  
  return await response.json();
};

/**
 * Build template components with actual parameter values
 */
const buildTemplateComponents = (templateComponents, parameters) => {
  return templateComponents.map(component => {
    if (component.type === 'body') {
      return {
        type: 'body',
        parameters: component.parameters.map(param => {
          const key = param.text.replace(/\{\{|\}\}/g, '');
          return {
            type: 'text',
            text: parameters[key] || ''
          };
        })
      };
    }
    return component;
  });
};

/**
 * Format phone number to international format
 */
const formatPhoneNumber = (phone) => {
  if (!phone) return '';
  
  // Remove all non-numeric characters except +
  let cleaned = phone.replace(/[^\d+]/g, '');
  
  // Handle Romanian numbers
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    cleaned = '40' + cleaned.slice(1);
  } else if (cleaned.startsWith('+40')) {
    cleaned = cleaned.slice(1);
  } else if (cleaned.startsWith('40') && cleaned.length === 11) {
    // Already correct format
  }
  
  return cleaned;
};

/**
 * Calculate estimated time of arrival
 */
const calculateETA = (order, driver) => {
  // TODO: Implement actual ETA calculation based on driver location
  // For now, return a default estimate
  const now = new Date();
  now.setMinutes(now.getMinutes() + 45);
  return now.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
};

/**
 * Generate tracking link for order
 */
const generateTrackingLink = (orderId) => {
  const baseUrl = process.env.TRACKING_BASE_URL || 'https://curier-local.ro/track';
  return `${baseUrl}/${orderId}`;
};

/**
 * Generate feedback link for order
 */
const generateFeedbackLink = (orderId) => {
  const baseUrl = process.env.FEEDBACK_BASE_URL || 'https://curier-local.ro/feedback';
  return `${baseUrl}/${orderId}`;
};

/**
 * Generate reschedule link for failed delivery
 */
const generateRescheduleLink = (orderId) => {
  const baseUrl = process.env.RESCHEDULE_BASE_URL || 'https://curier-local.ro/reschedule';
  return `${baseUrl}/${orderId}`;
};

module.exports = {
  sendOrderConfirmation,
  sendDriverAssignedNotification,
  sendOutForDeliveryNotification,
  sendDeliveryCompletedNotification,
  sendDeliveryFailedNotification,
  sendTextMessage,
  sendTemplateMessage,
  MESSAGE_TEMPLATES
};
