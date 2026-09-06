# Telegram to Discord Forward Bot

Forward pesan dari grup Telegram ke channel Discord via webhook. Berjalan sebagai user account (bukan bot Telegram).

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Buat file `.env` dari `.env.example`

```bash
cp .env.example .env
```

### 3. Isi `.env`

```
TELEGRAM_API_ID=12345678
TELEGRAM_API_HASH=abcdef1234567890abcdef
TELEGRAM_SESSION=
TELEGRAM_TARGET_CHAT_ID=-1001234567890
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/xxxx/yyyy
```

### 4. Jalankan

```bash
node index.js
```

Pertama kali jalankan akan diminta login (nomor telepon, kode verifikasi, password 2FA). Setelah login, session string akan dicetak ke terminal — copy ke `TELEGRAM_SESSION` di `.env` agar tidak perlu login lagi.

---

## Cara dapat kredensial

### Telegram API ID & Hash

1. Buka https://my.telegram.org
2. Login dengan nomor telepon
3. Klik **API Development Tools**
4. Buat aplikasi baru, isi form apa saja
5. Copy `api_id` dan `api_hash` ke `.env`

### Chat ID Grup Telegram

1. Buka grup target di Telegram (web atau desktop)
2. Lihat URL: `https://t.me/c/1234567890/1`
3. Chat ID adalah `-100` + angka pertama: `-1001234567890`

Atauforward pesan dari grup ke bot seperti `@userinfobot` atau `@getidsbot` untuk melihat chat ID.

### Discord Webhook URL

1. Buka channel Discord target
2. Klik **Edit Channel** > **Integrations** > **Webhooks**
3. Klik **New Webhook**, beri nama, pilih channel
4. Copy **Webhook URL**

---

## Cara kerja

- Pesan teks diteruskan apa adanya tanpa modifikasi
- Media (foto, video, dokumen, voice, sticker) di-download lalu di-upload ke Discord
- Album (beberapa media sekaligus) dikirim sebagai satu pesan Discord dengan banyak attachment
- Rate limit Discord (429) ditangani otomatis dengan retry
- Koneksi Telegram reconnect otomatis jika terputus
- Error per pesan di-log ke stderr tanpa menghentikan bot
