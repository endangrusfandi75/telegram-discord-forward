// lib/discord.js
const { Client, Events, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;

if (!DISCORD_BOT_TOKEN || !DISCORD_CHANNEL_ID) {
  console.error('DISCORD_BOT_TOKEN and DISCORD_CHANNEL_ID must be set in .env');
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds], retryLimit: 3 });

client.on(Events.ClientReady, () => {
  console.log(`Discord bot online as ${client.user.tag} (${client.user.id})`);
});

client.on('error', (err) => {
  console.error('Discord client error:', err);
});

const readyPromise = client.login(DISCORD_BOT_TOKEN);
readyPromise.catch((err) => {
  console.error('Failed to login to Discord:', err.message);
  process.exit(1);
});

async function getChannel() {
  await readyPromise;
  let channel = client.channels.cache.get(DISCORD_CHANNEL_ID);
  if (!channel) {
    channel = await client.channels.fetch(DISCORD_CHANNEL_ID);
  }
  return channel;
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
    const channel = await getChannel();
    if (!channel || typeof channel.send !== 'function') {
      console.error('Discord channel not found or not sendable:', DISCORD_CHANNEL_ID);
      return null;
    }
    let sent;
    if (files.length === 0) {
      sent = await channel.send(content);
    } else {
      sent = await channel.send({
        content: content || undefined,
        files: files.map((f) => ({ attachment: f.buffer, name: f.filename })),
      });
    }
    try {
      await sent.suppressEmbeds(true);
    } catch { }
    return sent;
  } catch (err) {
    console.error('Failed to send to Discord:', err.message);
    return null;
  }
}

module.exports = { sendText, sendWithAttachments };