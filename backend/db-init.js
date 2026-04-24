require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function init() {
  try {
    const schema = fs.readFileSync(path.join(__dirname, '../deploy/schema.sql'), 'utf-8');
    await pool.query(schema);
    console.log('Database initialized successfully');
  } catch (e) {
    // Ignore errors if tables already exist
    if (e.message.includes('already exists')) {
      console.log('Database tables already exist');
    } else {
      console.warn('Database init warning:', e.message);
    }
  } finally {
    await pool.end();
    process.exit(0);
  }
}

init();
