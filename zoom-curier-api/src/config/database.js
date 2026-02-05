/**
 * Database Configuration
 * Supports MySQL connection via DATABASE_URL or individual variables
 */
const mysql = require('mysql2/promise');

let pool = null;

const initializePool = async () => {
  // Skip if using in-memory database
  if (process.env.USE_IN_MEMORY_DB === 'true') {
    console.log('📦 Using in-memory database (data will not persist)');
    return null;
  }

  try {
    // Try DATABASE_URL first (Railway provides this)
    if (process.env.DATABASE_URL || process.env.MYSQL_URL) {
      const dbUrl = process.env.DATABASE_URL || process.env.MYSQL_URL;
      pool = mysql.createPool(dbUrl);
      console.log('✅ Connected to MySQL via DATABASE_URL');
    } else {
      // Fallback to individual variables
      pool = mysql.createPool({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
      });
      console.log('✅ Connected to MySQL via individual variables');
    }
    
    // Test connection
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    console.log('✅ MySQL connection verified');
    return pool;
  } catch (error) {
    console.error('❌ MySQL connection failed:', error.message);
    pool = null;
    return null;
  }
};

const getPool = () => pool;

module.exports = { initializePool, getPool };

