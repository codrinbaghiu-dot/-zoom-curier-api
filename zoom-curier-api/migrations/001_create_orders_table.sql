-- Migration: Create orders table for Zoom Curier Universal Integrator
-- Version: 1.0.0
-- Date: 2026-02-04

CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    internal_order_id VARCHAR(50) NOT NULL UNIQUE,
    external_order_id VARCHAR(255),
    merchant_id INT,
    driver_id INT,
    service_level ENUM('lite', 'heavy', 'cargo') DEFAULT 'lite',
    status ENUM('pending', 'assigned', 'in_transit', 'delivered', 'cancelled') DEFAULT 'pending',
    
    -- Pickup Information
    pickup_address VARCHAR(500),
    
    -- Delivery Information
    delivery_address VARCHAR(500) NOT NULL,
    delivery_city VARCHAR(100),
    delivery_county VARCHAR(100),
    delivery_postal_code VARCHAR(20),
    delivery_country VARCHAR(2) DEFAULT 'RO',
    
    -- Recipient Information
    recipient_name VARCHAR(200) NOT NULL,
    recipient_phone VARCHAR(50),
    recipient_email VARCHAR(200),
    
    -- Overflow & Aggregator Fields
    is_overflow BOOLEAN DEFAULT FALSE,
    parent_carrier_id INT,
    aggregator_source VARCHAR(50),
    
    -- Financial Information
    cod_amount DECIMAL(10, 2) DEFAULT 0,
    cod_currency VARCHAR(3) DEFAULT 'RON',
    
    -- Package Information
    total_weight DECIMAL(10, 2),
    
    -- Additional Information
    notes TEXT,
    raw_payload JSON,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_external_order (external_order_id, aggregator_source),
    INDEX idx_status (status),
    INDEX idx_merchant (merchant_id),
    INDEX idx_driver (driver_id),
    INDEX idx_created (created_at),
    INDEX idx_overflow (is_overflow, parent_carrier_id)
);

-- Create merchants table
CREATE TABLE IF NOT EXISTS merchants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    email VARCHAR(200),
    phone VARCHAR(50),
    address VARCHAR(500),
    city VARCHAR(100),
    api_key VARCHAR(100) UNIQUE,
    webhook_url VARCHAR(500),
    platform VARCHAR(50), -- gomag, shopify, woocommerce, etc.
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_api_key (api_key),
    INDEX idx_platform (platform)
);

-- Create drivers table
CREATE TABLE IF NOT EXISTS drivers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    email VARCHAR(200),
    phone VARCHAR(50) NOT NULL,
    vehicle_type VARCHAR(50),
    vehicle_plate VARCHAR(20),
    zone_id INT,
    is_active BOOLEAN DEFAULT TRUE,
    current_location_lat DECIMAL(10, 8),
    current_location_lng DECIMAL(11, 8),
    last_location_update TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_zone (zone_id),
    INDEX idx_active (is_active)
);

-- Create partner_carriers table (for overflow)
CREATE TABLE IF NOT EXISTS partner_carriers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) NOT NULL UNIQUE, -- FAN, SAMEDAY, CARGUS, DPD
    api_endpoint VARCHAR(500),
    api_key VARCHAR(200),
    webhook_url VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insert default partner carriers
INSERT INTO partner_carriers (name, code) VALUES
    ('Fan Courier', 'FAN'),
    ('Sameday', 'SAMEDAY'),
    ('Cargus', 'CARGUS'),
    ('DPD', 'DPD'),
    ('GLS', 'GLS')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- Create order_status_history table for tracking
CREATE TABLE IF NOT EXISTS order_status_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    status VARCHAR(50) NOT NULL,
    notes TEXT,
    changed_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_order (order_id),
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);
