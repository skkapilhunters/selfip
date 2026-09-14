const http = require('http');
const { Pool } = require('pg');

// Start a lightweight HTTP server for Web Service health checks
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('IP Logger Service is active\n');
}).listen(PORT, () => {
  console.log(`[HTTP] Health check server listening on port ${PORT}`);
});

// Sanitize connection string to prevent SSL query parameter warnings
let dbUrl = process.env.DATABASE_URL || '';
if (dbUrl.includes('?')) {
  dbUrl = dbUrl.split('?')[0];
}

const pool = new Pool({
  connectionString: dbUrl,
  ssl: {
    rejectUnauthorized: false
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
