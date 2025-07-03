// Simple keep-alive script for development
const https = require('https');

const BACKEND_URL = 'https://fitness-tracker-backend-r2ud.onrender.com/health';
const INTERVAL_MINUTES = 10; // Ping every 10 minutes

function pingServer() {
  const startTime = Date.now();
  
  https.get(BACKEND_URL, (res) => {
    const duration = Date.now() - startTime;
    console.log(`✅ Keep-alive ping successful - Status: ${res.statusCode} - Duration: ${duration}ms - ${new Date().toISOString()}`);
  }).on('error', (err) => {
    console.log(`❌ Keep-alive ping failed: ${err.message} - ${new Date().toISOString()}`);
  });
}

// Initial ping
console.log(`🚀 Starting keep-alive service - Pinging ${BACKEND_URL} every ${INTERVAL_MINUTES} minutes`);
pingServer();

// Set up interval
setInterval(pingServer, INTERVAL_MINUTES * 60 * 1000);

console.log(`⏰ Keep-alive service running. Press Ctrl+C to stop.`); 