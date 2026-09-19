// lib/telegram.js
const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { NewMessage } = require('telegram/events');
const input = require('input'); // for interactive prompts
require('dotenv').config();

const { sendText, sendWithAttachments } = require('./discord');

const {
  TELEGRAM_API_ID,
  TELEGRAM_API_HASH,
  TELEGRAM_SESSION,
  TELEGRAM_TARGET_CHAT_ID,
} = process.env;

// Optional: jumlah pesan terbaru dari chat target yang langsung di-forward saat start.
const FORWARD_LAST_N = Math.max(0, parseInt(process.env.TELEGRAM_FORWARD_LAST || '0', 10) || 0);
// Optional: interval polling (detik) untuk mengambil pesan baru via API.
const POLL_INTERVAL_MS = Math.max(5, parseInt(process.env.TELEGRAM_POLL_INTERVAL_SECONDS || '15', 10) || 15) * 1000;

if (!TELEGRAM_API_ID || !TELEGRAM_API_HASH || !TELEGRAM_TARGET_CHAT_ID) {
  console.error('Missing required Telegram env vars. Check .env');
  process.exit(1);
}

const apiId = Number(TELEGRAM_API_ID);
const apiHash = TELEGRAM_API_HASH;
const session = new StringSession(TELEGRAM_SESSION || '');

// Dedup: pesan dari update push + polling tidak akan dikirim dua kali.
const forwardedKeys = new Set();
// Buffer album (groupedId) sambil menunggu semua bagian terkumpul.
const albumMap = new Map();
let lastSeenId = 0;
let primed = false;
let targetChat = null;
let clientRef = null;

function msgKey(msg) {
  return `${msg.chatId}:${msg.id}`;
}

/**
 * Helper to print the generated session string to stdout so the user can copy it.
 */
async function printSessionString(client) {
  const str = client.session.save();
  console.log('=== TELEGRAM_SESSION STRING ===');
  console.log(str);
  console.log('=== END SESSION STRING ===');
}

async function downloadAndSend(msg, caption) {
  const buffer = await clientRef.downloadMedia(msg);
  const fileName = msg.file?.name || `${msg.id}.${(msg.file?.mimeType?.split('/')[1]) || 'bin'}`;
  await sendWithAttachments(caption || null, [{ filename: fileName, buffer }]);
}

/**
 * Kirim album yang sudah terkumpul ke Discord (satu pesan, banyak attachment).
 */
async function flushAlbum(groupedId) {
  const entry = albumMap.get(groupedId);
  if (!entry) return;
  albumMap.delete(groupedId);
  const pending = entry.messages.filter((m) => !forwardedKeys.has(msgKey(m)));
  if (pending.length === 0) return;
  for (const m of pending) forwardedKeys.add(msgKey(m));
  const files = [];
  let caption = '';
  for (const m of pending) {
    if (!caption && m.message) caption = m.message;
    try {
      const buffer = await clientRef.downloadMedia(m);
      const fileName = m.file?.name || `${m.id}.${(m.file?.mimeType?.split('/')[1]) || 'bin'}`;
      files.push({ filename: fileName, buffer });
    } catch (e) {
      console.error('Failed to download media for album part:', e);
    }
  }
  if (files.length === 0) {
    if (caption) await sendText(caption);
  } else {
    await sendWithAttachments(caption || null, files);
  }
}

/**
 * Proses satu pesan untuk diteruskan ke Discord. Dipakai oleh handler
 * (update push) maupun polling (ambil pesan via API).
 */
async function processMessage(msg) {
  if (!msg || !msg.chatId) return;
  if (msg.chatId.toString() !== TELEGRAM_TARGET_CHAT_ID) return;

  // Album/grouped media: kumpulkan dulu semua bagiannya.
  const groupedId = msg.groupedId?.toString();
  if (groupedId) {
    let entry = albumMap.get(groupedId);
    if (!entry) entry = { messages: [], timeout: null };
    if (!forwardedKeys.has(msgKey(msg))) entry.messages.push(msg);
    if (entry.timeout) clearTimeout(entry.timeout);
    entry.timeout = setTimeout(() => flushAlbum(groupedId), 1200);
    albumMap.set(groupedId, entry);
    return;
  }

  if (forwardedKeys.has(msgKey(msg))) return;
  forwardedKeys.add(msgKey(msg));

  const text = (msg.message || '').trim();
  if (!msg.media) {
    try {
      if (text) await sendText(text);
    } catch (e) {
      console.error('Failed to forward text message:', e);
    }
    return;
  }
  try {
    await downloadAndSend(msg, text);
  } catch (e) {
    console.error('Failed to process media message:', e);
  }
}

/**
 * Polling: ambil pesan terbaru dari chat target via API dan forward
 * yang belum pernah dikirim. Jaring pengaman bila update push tidak sampai.
 */
async function pollTarget() {
  try {
    if (!targetChat) targetChat = await clientRef.getEntity(TELEGRAM_TARGET_CHAT_ID);
    const msgs = await clientRef.getMessages(targetChat, { limit: 50 });
    const fetched = Array.isArray(msgs) ? msgs.length : 0;
    const maxId = msgs.reduce((mx, m) => Math.max(mx, Number(m.id)), 0);

    if (!primed) {
      if (FORWARD_LAST_N > 0) {
        const sorted = msgs.slice().sort((a, b) => Number(a.id) - Number(b.id));
        const start = Math.max(0, sorted.length - FORWARD_LAST_N);
        for (const m of sorted.slice(start)) {
          await processMessage(m);
        }
        console.log(`[poll] primed, backfill last ${FORWARD_LAST_N}, maxId=${maxId}`);
      } else {
        console.log(`[poll] primed, no backfill, maxId=${maxId}`);
      }
      lastSeenId = Math.max(lastSeenId, maxId);
      primed = true;
      return;
    }

    const sorted = msgs.slice().sort((a, b) => Number(a.id) - Number(b.id));
    let forwarded = 0;
    for (const m of sorted) {
      const id = Number(m.id);
      if (id <= lastSeenId) continue;
      lastSeenId = id;
      await processMessage(m);
      forwarded += 1;
    }
    console.log(`[poll] fetched=${fetched} maxId=${maxId} lastSeenId=${lastSeenId} forwarded=${forwarded}`);
  } catch (e) {
    console.error(`[poll] error: ${e.message}`);
  }
}

/**
 * Main entry point to start the Telegram client and set up handlers.
 */
async function startTelegram() {
  const client = new TelegramClient(session, apiId, apiHash, {
    connectionRetries: 5,
  });
  clientRef = client;

  await client.start({
    phoneCode: async () => await input.text('Enter the code you received: '),
    password: async () => await input.text('Enter your 2FA password (if any): '),
    phoneNumber: async () => await input.text('Enter your phone number (e.g. +123456789): '),
    onError: (err) => console.error('Telegram client error:', err),
  });

  if (!TELEGRAM_SESSION) {
    await printSessionString(client);
  }

  try {
    targetChat = await client.getEntity(TELEGRAM_TARGET_CHAT_ID);
    await pollTarget();
    // Memancing Telegram supaya mulai mengirim update push untuk channel ini.
    try { await client.markAsRead(targetChat); } catch (e) { }
  } catch (e) {
    console.error('Failed to fetch target chat:', e.message);
  }

  // Jalan utama: forward instan via update push.
  client.addEventHandler(async (event) => {
    try {
      await processMessage(event.message);
    } catch (e) {
      console.error('Failed to handle message:', e);
    }
  }, new NewMessage({}));

  // Jaring pengaman: polling berkala via API.
  setInterval(pollTarget, POLL_INTERVAL_MS);

  console.log('Telegram client started and listening for messages...');
  if (FORWARD_LAST_N > 0) {
    console.log(`Backfill: ${FORWARD_LAST_N} pesan terbaru dari target chat akan di-forward saat start`);
  }
  console.log(`Polling target chat every ${POLL_INTERVAL_MS / 1000}s`);
}

module.exports = { startTelegram };