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
    process.exit(0);
  } catch (e) {
    console.error('Database init error:', e.message);
    process.exit(1);
  }
}

init();
