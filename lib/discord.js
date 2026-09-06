// lib/discord.js
const axios = require('axios');
const FormData = require('form-data');
require('dotenv').config();

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

if (!DISCORD_WEBHOOK_URL) {
  console.error('DISCORD_WEBHOOK_URL is not set in .env');
  process.exit(1);
}

/**
 * Send a simple text message to Discord webhook.
 * @param {string} content - Message content.
 */
async function sendText(content) {
  try {
    const resp = await axios.post(DISCORD_WEBHOOK_URL, { content });
    return resp.data;
  } catch (err) {
    await handleRateLimit(err, () => sendText(content));
  }
}

/**
 * Send message with optional attachments.
 * @param {string|null} content - Text content (may be null).
 * @param {Array<{filename: string, buffer: Buffer}>} files - Attachments.
 */
async function sendWithAttachments(content, files) {
  const form = new FormData();
  if (content) form.append('content', content);
  files.forEach((file, idx) => {
    // Discord expects field name "files[0]", "files[1]", ...
    form.append(`files[${idx}]`, file.buffer, { filename: file.filename });
  });
  try {
    const resp = await axios.post(DISCORD_WEBHOOK_URL, form, {
      headers: form.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });
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
    const retryAfter = error.response.data.retry_after;
    if (retryAfter) {
      console.warn(`Discord rate limited, retrying after ${retryAfter}s`);
      await new Promise(r => setTimeout(r, retryAfter * 1000));
      return retryFn();
    }
  }
  console.error('Failed to send to Discord:', error.message);
  // swallow error to keep processing other messages
}

module.exports = { sendText, sendWithAttachments };
