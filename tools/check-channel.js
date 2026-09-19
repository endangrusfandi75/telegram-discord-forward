// tools/check-channel.js
// Ambil beberapa pesan terakhir dari TELEGRAM_TARGET_CHAT_ID via API
// untuk memverifikasi channel dapat diakses dan berapa pesan aktifnya.
require('dotenv').config();
const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const input = require('input');

const {
  TELEGRAM_API_ID,
  TELEGRAM_API_HASH,
  TELEGRAM_SESSION,
  TELEGRAM_TARGET_CHAT_ID,
} = process.env;

if (!TELEGRAM_API_ID || !TELEGRAM_API_HASH || !TELEGRAM_TARGET_CHAT_ID) {
  console.error('Missing TELEGRAM_* env vars. Check .env');
  process.exit(1);
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

  const chat = await client.getEntity(TELEGRAM_TARGET_CHAT_ID);
  console.log('Entity:', chat && chat.className, chat && chat.title);

  const msgs = await client.getMessages(chat, { limit: 10 });
  console.log('Fetched:', msgs.length, 'messages');
  for (const m of msgs) {
    console.log(JSON.stringify({
      id: m.id,
      date: m.date ? new Date(m.date * 1000).toISOString() : null,
      text: (m.message || '').slice(0, 100),
      hasMedia: !!m.media,
      groupedId: m.groupedId ? m.groupedId.toString() : null,
    }));
  }
  process.exit(0);
})().catch((e) => {
  console.error('Error:', e);
  process.exit(1);
});