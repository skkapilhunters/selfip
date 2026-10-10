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
    return true;
  } catch (err) {
    console.warn('[DB Warning] Failed to initialize table (will fallback to console logging):', err.message);
    return false;
  }
}

async function recordIp() {
  const timestamp = new Date().toISOString();
  try {
    const res = await fetch('https://api.ipify.org?format=json');
    const data = await res.json();
    const publicIp = data.ip;

    let savedToDb = false;

    // Try saving to database if DATABASE_URL is provided
    if (process.env.DATABASE_URL) {
      try {
        await pool.query('INSERT INTO server_ip_logs (ip_address) VALUES ($1);', [publicIp]);
        console.log(`[${timestamp}] Successfully logged IP to DB: ${publicIp}`);
        savedToDb = true;
      } catch (dbErr) {
        console.warn(`[${timestamp}] [DB Warning] Could not save to database. Falling back to console log.`);
      }
    }

    // Fallback: If DB is not configured, not connected, or failed, print it in logs
    if (!savedToDb) {
      console.log(`[${timestamp}] Current Server IP (Console Log): ${publicIp}`);
    }
  } catch (err) {
    console.error(`[${timestamp}] Error fetching IP address:`, err.message);
  }
}

async function startService() {
  if (!process.env.DATABASE_URL) {
    console.warn('[WARN] DATABASE_URL environment variable is missing. Running in console-only log mode.');
  } else {
    await initDb();
  }

  await recordIp();

  const INTERVAL = 5 * 60 * 1000;
  setInterval(recordIp, INTERVAL);

  console.log('IP Logger Service is active. Running every 5 minutes...');
}

startService();
