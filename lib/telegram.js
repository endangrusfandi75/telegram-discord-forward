// lib/telegram.js
const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { NewMessage } = require('telegram/events');
const input = require('input'); // for interactive prompts
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const {
  TELEGRAM_API_ID,
  TELEGRAM_API_HASH,
  TELEGRAM_SESSION,
  TELEGRAM_TARGET_CHAT_ID,
} = process.env;

const { sendText, sendWithAttachments } = require('./discord');

if (!TELEGRAM_API_ID || !TELEGRAM_API_HASH || !TELEGRAM_TARGET_CHAT_ID) {
  console.error('Missing required Telegram env vars. Check .env');
  process.exit(1);
}

const apiId = Number(TELEGRAM_API_ID);
const apiHash = TELEGRAM_API_HASH;
const session = new StringSession(TELEGRAM_SESSION || '');

/**
 * Helper to print the generated session string to stdout so the user can copy it.
 */
async function printSessionString(client) {
  const str = client.session.save();
  console.log('=== TELEGRAM_SESSION STRING ===');
  console.log(str);
  console.log('=== END SESSION STRING ===');
}

/**
 * Map to collect media belonging to the same album (groupedId).
 * Key: groupedId (string), Value: { messages: [], timeout: TimeoutObject }
 */
const albumMap = new Map();

/**
 * Send a collected album (or single message) to Discord.
 */
async function flushAlbum(groupedId) {
  const entry = albumMap.get(groupedId);
  if (!entry) return;
  const { messages } = entry;
  // Prepare files array
  const files = [];
  let caption = null;
  for (const msg of messages) {
    // If the message has text and we haven't set caption yet, use it as caption.
    if (msg.message && msg.message?.message) {
      // Prefer caption from the first message that contains it.
      if (!caption) caption = msg.message.message;
    }
    try {
      const buffer = await client.downloadMedia(msg.message);
      // Guess filename from media
      const fileName = msg.message?.file?.name || `${msg.message?.id}.${msg.message?.mimeType?.split('/')[1] || 'bin'}`;
      files.push({ filename: fileName, buffer });
    } catch (e) {
      console.error('Failed to download media for album part:', e);
    }
  }
  if (files.length === 0) {
    // No media could be downloaded, fallback to text only.
    if (caption) await sendText(caption);
  } else {
    await sendWithAttachments(caption, files);
  }
  albumMap.delete(groupedId);
}

/**
 * Main entry point to start the Telegram client and set up handlers.
 */
async function startTelegram() {
  const client = new TelegramClient(session, apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.start({
    // If there is no saved session we need to go through the login flow.
    phoneCode: async () => await input.text('Enter the code you received: '),
    password: async () => await input.text('Enter your 2FA password (if any): '),
    phoneNumber: async () => await input.text('Enter your phone number (e.g. +123456789): '),
    onError: (err) => console.error('Telegram client error:', err),
  });

  // If the session was empty before, output the new session string.
  if (!TELEGRAM_SESSION) {
    await printSessionString(client);
    // Also write back to .env.example? We just print for the user.
  }

  // Event handler for new messages.
  client.addEventHandler(async (event) => {
    const msg = event.message;
    if (!msg) return;

    const chatId = msg.chatId?.toString();
    if (chatId !== TELEGRAM_TARGET_CHAT_ID) return; // filter by target chat

    // If message is part of an album/grouped media.
    const groupedId = msg.groupedId?.toString();
    if (groupedId) {
      // Collect messages for this album.
      if (!albumMap.has(groupedId)) {
        albumMap.set(groupedId, { messages: [], timeout: null });
      }
      const entry = albumMap.get(groupedId);
      entry.messages.push(event);
      // Reset timeout each time a new part arrives (wait 1 second after last part).
      if (entry.timeout) clearTimeout(entry.timeout);
      entry.timeout = setTimeout(() => flushAlbum(groupedId), 1000);
      return; // Defer sending until album is flushed.
    }

    // Non-album message handling.
    // Text only?
    const text = msg.message?.message?.trim();
    const hasMedia = !!msg.media;
    if (!hasMedia) {
      if (text) await sendText(text);
      return;
    }

    // Media with optional caption.
    try {
      const buffer = await client.downloadMedia(msg);
      const fileName = msg.file?.name || `${msg.id}.${msg.mimeType?.split('/')[1] || 'bin'}`;
      await sendWithAttachments(text || null, [{ filename: fileName, buffer }]);
    } catch (e) {
      console.error('Failed to process media message:', e);
    }
  }, new NewMessage({}));

  console.log('Telegram client started and listening for messages...');
}

module.exports = { startTelegram };
