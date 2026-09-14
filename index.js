const { Pool } = require('pg');

// Force SSL bypass for cloud PostgreSQL hosting providers
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Auto-create the logging table if it doesn't exist
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

// Fetch public IP and save to Postgres
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

// Main service loop
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
