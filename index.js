const { Pool } = require('pg');

// Sanitize connection string to prevent SSL alias warnings
let dbUrl = process.env.DATABASE_URL || '';
if (dbUrl.includes('?')) {
  dbUrl = dbUrl.split('?')[0]; // Strip URL query params like ?sslmode=require
}

const pool = new Pool({
  connectionString: dbUrl,
  ssl: {
    rejectUnauthorized: false // Bypasses self-signed certificate error
  }
});

async function initDb() {
  const query = `
    CREATE TABLE IF NOT EXISTS server_ip_logs (
      id SERIAL PRIMARY KEY,
      ip_address VARCHAR(45) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;
  try {
    await pool.query(query);
    console.log('[DB] Table "server_ip_logs" verified/created.');
  } catch (err) {
    console.error('[DB Error] Failed to initialize table:', err.message);
  }
}

async function recordIp() {
  try {
    const res = await fetch('https://api.ipify.org?format=json');
    const data = await res.json();
    const publicIp = data.ip;

    await pool.query('INSERT INTO server_ip_logs (ip_address) VALUES ($1);', [publicIp]);
    console.log(`[${new Date().toISOString()}] Successfully logged IP: ${publicIp}`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error recording IP:`, err.message);
  }
}

async function startService() {
  if (!process.env.DATABASE_URL) {
    console.error('FATAL: DATABASE_URL environment variable is missing.');
    process.exit(1);
  }

  await initDb();
  await recordIp();

  const INTERVAL = 5 * 60 * 1000;
  setInterval(recordIp, INTERVAL);

  console.log('IP Logger Service is active. Running every 5 minutes...');
}

startService();
