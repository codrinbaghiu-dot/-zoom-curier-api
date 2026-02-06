/**
 * Database Configuration
 * Supports MySQL connection via DATABASE_URL or individual variables
 */
const mysql = require('mysql2/promise');

let pool = null;
let inMemoryStore = [];

const initializePool = async () => {
  if (process.env.USE_IN_MEMORY_DB === 'true') {
    console.log('📦 Using in-memory database (data will not persist)');
    return null;
  }

  try {
    if (process.env.MYSQL_URL || process.env.DATABASE_URL) {
      const dbUrl = process.env.MYSQL_URL || process.env.DATABASE_URL;
      pool = mysql.createPool(dbUrl);
      console.log('✅ Connected to MySQL via MYSQL_URL');
    } else {
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

const query = async (sql, params = []) => {
  if (!pool) {
    await initializePool();
  }
  
  if (!pool) {
    console.log('⚠️ Database unavailable, using in-memory storage');
    return handleInMemory(sql, params);
  }

  try {
    const [results] = await pool.query(sql, params);
    return results;
  } catch (error) {
    console.error('❌ Query failed:', error.message);
    throw error;
  }
};

const handleInMemory = (sql, params) => {
  if (sql.trim().toUpperCase().startsWith('INSERT')) {
    const id = inMemoryStore.length + 1;
    inMemoryStore.push({ id, ...params });
    return { insertId: id };
  }
  if (sql.trim().toUpperCase().startsWith('SELECT')) {
    return inMemoryStore;
  }
  return [];
};

const getPool = () => pool;

module.exports = { initializePool, getPool, query };


