// tools/list-dialogs.js
// Print semua chat/channel yang bisa diakses akun (id + title + tipe).
// Jalankan: node tools/list-dialogs.js
require('dotenv').config();
const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const input = require('input');

const {
  TELEGRAM_API_ID,
  TELEGRAM_API_HASH,
  TELEGRAM_SESSION,
} = process.env;

if (!TELEGRAM_API_ID || !TELEGRAM_API_HASH) {
  console.error('TELEGRAM_API_ID and TELEGRAM_API_HASH must be set in .env');
  process.exit(1);
}

async function classify(entity) {
  if (!entity || !entity.className) return 'unknown';
  if (entity.className === 'Channel') return 'channel';
  if (entity.className === 'Chat') return 'group';
  if (entity.className === 'User') return 'user';
  return entity.className;
}

(async () => {
  const client = new TelegramClient(
    new StringSession(TELEGRAM_SESSION || ''),
    Number(TELEGRAM_API_ID),
    TELEGRAM_API_HASH,
    { connectionRetries: 5 },
  );

  await client.start({
    phoneCode: async () => await input.text('Enter the code you received: '),
    password: async () => await input.text('Enter your 2FA password (if any): '),
    phoneNumber: async () => await input.text('Enter your phone number (e.g. +123456789): '),
    onError: (err) => console.error('Telegram client error:', err),
  });

  if (!TELEGRAM_SESSION) {
    console.log('=== TELEGRAM_SESSION STRING ===');
    console.log(client.session.save());
    console.log('=== END SESSION STRING ===');
  }

  console.log('--- Dialogs ---');
  for await (const dialog of client.iterDialogs()) {
    const type = await classify(dialog.entity);
    const id = dialog.id ? dialog.id.toString() : '?';
    const title = dialog.title || '(no title)';
    console.log(`${type}\t${id}\t${title}`);
  }
  console.log('--- End ---');
  process.exit(0);
})().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});