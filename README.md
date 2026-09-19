# Telegram to Discord Forward Bot

Forward pesan dari grup Telegram ke channel Discord via **Discord bot**. Berjalan sebagai user account (bukan bot Telegram).

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
DISCORD_BOT_TOKEN=MTIzNDU2Nzg5MDEyMzQ1Njc4OQ...
DISCORD_CHANNEL_ID=12345678901234567890
# Opsional
TELEGRAM_FORWARD_LAST=0
TELEGRAM_POLL_INTERVAL_SECONDS=15
```

### 4. Jalankan

```bash
npm start
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

Atau forward pesan dari grup ke bot seperti `@userinfobot` atau `@getidsbot` untuk melihat chat ID.

### Discord Bot Token & Channel ID

1. Buka https://discord.com/developers/applications
2. Klik **New Application**, beri nama, lalu pilih tab **Bot**
3. Klik **Reset Token** lalu **Copy** token-nya → isi ke `DISCORD_BOT_TOKEN`
4. Di tab **OAuth2** → **URL Generator**, centang scope `bot`, lalu pilih permissions `Send Messages`, `Attach Files`, dan `View Channels`
5. Buka URL yang dihasilkan, pilih server tujuan, dan invite bot ke server itu
6. Aktifkan **Developer Mode** di Discord (Settings → Advanced → Developer Mode)
7. Klik kanan channel tujuan → **Copy Channel ID** → isi ke `DISCORD_CHANNEL_ID`

---

## Cara kerja

- Pesan teks diteruskan apa adanya tanpa modifikasi
- Bot Discord online karena terhubung ke Gateway (WebSocket) via `discord.js`
- Media (foto, video, dokumen, voice, sticker) di-download lalu di-upload ke Discord
- Album (beberapa media sekaligus) dikirim sebagai satu pesan Discord dengan banyak attachment
- Pesan baru diambil via **update push + polling API** (jaring pengaman), dengan deduplikasi ID
- `TELEGRAM_FORWARD_LAST` (opsional): forward N pesan terakhir dari chat target saat start
- Rate limit Discord (429) ditangani otomatis dengan retry
- Koneksi Telegram reconnect otomatis jika terputus
- Error per pesan di-log ke stderr tanpa menghentikan bot