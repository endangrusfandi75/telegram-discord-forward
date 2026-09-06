// index.js
require('dotenv').config();
const path = require('path');
const { startTelegram } = require('./lib/telegram');

(async () => {
  try {
    await startTelegram();
  } catch (err) {
    console.error('Fatal error starting Telegram client:', err);
    process.exit(1);
  }
})();
