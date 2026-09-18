// lib/discord.js
const axios = require('axios');
const FormData = require('form-data');
require('dotenv').config();

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;

if (!DISCORD_BOT_TOKEN || !DISCORD_CHANNEL_ID) {
  console.error('DISCORD_BOT_TOKEN and DISCORD_CHANNEL_ID must be set in .env');
  process.exit(1);
}

const MESSAGES_URL = `https://discord.com/api/v10/channels/${DISCORD_CHANNEL_ID}/messages`;

function authHeaders(extra = {}) {
  return { Authorization: `Bot ${DISCORD_BOT_TOKEN}`, ...extra };
}

/**
 * Send a simple text message to Discord as the bot.
 * @param {string} content - Message content.
 */
async function sendText(content) {
  return sendWithAttachments(content, []);
}

/**
 * Send message with optional attachments as the bot.
 * @param {string|null} content - Text content (may be null).
 * @param {Array<{filename: string, buffer: Buffer}>} files - Attachments.
 */
async function sendWithAttachments(content, files = []) {
  try {
    let resp;
    if (files.length === 0) {
      resp = await axios.post(MESSAGES_URL, { content }, { headers: authHeaders() });
    } else {
      const form = new FormData();
      if (content) form.append('content', content);
      files.forEach((file, idx) => {
        form.append(`files[${idx}]`, file.buffer, { filename: file.filename });
      });
      resp = await axios.post(MESSAGES_URL, form, {
        headers: authHeaders(form.getHeaders()),
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });
    }
    return resp.data;
  } catch (err) {
    await handleRateLimit(err, () => sendWithAttachments(content, files));
  }
}

/**
 * Helper to handle Discord 429 rate limit.
 * Retries once after waiting retry_after seconds.
 */
async function handleRateLimit(error, retryFn) {
  if (error.response && error.response.status === 429) {
    const retryAfter = error.response.data && error.response.data.retry_after;
    if (retryAfter) {
      console.warn(`Discord rate limited, retrying after ${retryAfter}s`);
      await new Promise(r => setTimeout(r, retryAfter * 1000));
      return retryFn();
    }
  }
  console.error('Failed to send to Discord:', error.message);
  if (error.response) {
    console.error('Discord response status:', error.response.status);
  }
}

module.exports = { sendText, sendWithAttachments };