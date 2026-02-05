/**
 * Database Configuration
 * 
 * MySQL/MariaDB connection configuration using mysql2
 */

const mysql = require('mysql2/promise');

// Database configuration from environment variables
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'zoom_curier',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'zoom_curier_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Create connection pool
let pool = null;

/**
 * Initialize database connection pool
 */
const initializePool = () => {
  if (!pool) {
    pool = mysql.createPool(dbConfig);
    console.log('📊 Database connection pool initialized');
  }
  return pool;
};

/**
 * Get database connection from pool
 */
const getConnection = async () => {
  if (!pool) {
    initializePool();
  }
  return await pool.getConnection();
};

/**
 * Execute a query
 */
const query = async (sql, params = []) => {
  if (!pool) {
    initializePool();
  }
  const [results] = await pool.execute(sql, params);
  return results;
};

/**
 * Close all connections in the pool
 */
const closePool = async () => {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('📊 Database connection pool closed');
  }
};

module.exports = {
  initializePool,
  getConnection,
  query,
  closePool,
  dbConfig
};
