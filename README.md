# Telegram TV for Samsung Tizen

A Telegram client for your TV — channels, videos, music, photos and PDF reading on the big screen.

This is the **Samsung Tizen** port of [telegram-webos-3.x](https://github.com/arrietaoadrian/telegram-webos-3.x). Same app, same backend, packaged as a `.wgt` for Samsung TVs (2021+).

## Download

Latest release: **[v0.6.0](https://github.com/arrietaoadrian/telegram-tv-tizen/releases/tag/v0.6.0)**

- Direct package: [`com.telegramtv.app_0.6.0.wgt`](https://github.com/arrietaoadrian/telegram-tv-tizen/releases/download/v0.6.0/com.telegramtv.app_0.6.0.wgt)
- Install it with **Apps2Samsung** (Samsung + Partner signing) or Tizen Studio.

## What's new in 0.6.0

Streaming video with real seeking (HTTP Range + `+faststart`), Samsung color-button shortcuts, 100/115/130% text size, a local pdf.js reader with server fallback, and smoother 4K/Tizen transitions. See the [release notes](https://github.com/arrietaoadrian/telegram-tv-tizen/releases/tag/v0.6.0) for details.

## How it works

Two pieces:

1. **The TV app** (`app/`) — a plain HTML/CSS/JS web app packaged as a Tizen `.wgt`.
2. **The backend** (`server/`) — a Node.js server that you run on a phone or PC. It talks to Telegram, downloads/transcodes media, and serves it to the TV over your Wi-Fi.

The TV app never talks to Telegram directly; it only calls `http://<server-ip>:8080`.

## Requirements

- A Samsung TV with **Developer Mode** enabled.
- A phone or PC on the same Wi-Fi running the backend (see below).

## Backend (same as webOS)

On the phone (Termux) or a PC:

```bash
cd server
npm install
# edit config.json: put your apiId and apiHash (https://my.telegram.org)
node server.js
```

It prints the URL to enter on the TV (e.g. `http://192.168.1.50:8080`).

Optional but recommended on Termux:

```bash
pkg install poppler ffmpeg
```

- `poppler` (pdftoppm) → PDF pages and covers.
- `ffmpeg` → MKV remux and HEVC/H.265 → H.264 transcoding.

> ⚠️ Never commit `server/session.txt` or `server/cache/` — they contain your login and media.

## Install on the TV

### Enable Developer Mode
On the TV: **Settings → General → Network → Expert Settings** (or the Smart Hub "Apps" panel) → find **Developer Mode**, toggle it **On**, enter the IP of the PC that will connect to the TV, and reboot.

### Install the app
Using **Tizen Studio** (recommended):

1. Install [Tizen Studio](https://developer.samsung.com/smarttv/develop/tools/tizen-studio.html) (with the TV Extension SDK).
2. Open **Device Manager**, connect to the TV's IP.
3. Right-click the TV → **Permit to install applications**.
4. Drag `bin/com.telegramtv.app_0.6.0.wgt` onto the device (it gets signed and installed automatically).

Or from the command line with `sdb`:

```bash
sdb connect <TV_IP>
sdb install bin/com.telegramtv.app_0.6.0.wgt
sdb shell 0 execute com.telegramtv.app
```

## Build the `.wgt`

The `.wgt` is a ZIP with `config.xml` at the root. Rebuild it from `app/`:

```bash
cd app
zip -r ../bin/com.telegramtv.app_0.6.0.wgt config.xml index.html icon.png css js
```

(If you use Tizen Studio, you can also import `app/` as a Tizen Web project and build/sign from there.)

## Key differences from webOS

- **Back key:** the Samsung remote "Return" button is `keyCode 10009` (webOS uses `461`). Already handled in `js/app.js`.
- **Manifest:** Tizen uses `config.xml` instead of `appinfo.json`.
- **Package:** `.wgt` instead of `.ipk`.

## Samsung-specific enhancements (0.6.0)

- **Instant video start + real seeking:** the backend serves video with HTTP Range and remuxes `native=1` MP4s to `+faststart` (files up to 1 GB) so the player can start before the whole file is read and seek anywhere.
- **Remote color buttons:** RED opens search, GREEN filters music, YELLOW filters PDFs, BLUE cycles the UI text size.
- **Text size:** 100% / 115% / 130%, applied live with CSS zoom and saved in `localStorage`.
- **PDF on the TV:** PDFs are rendered locally with the bundled pdf.js 3.11 (`js/pdf/`), so page turns are instant and do not depend on `pdftoppm`. If pdf.js cannot load, the app automatically falls back to the server-rendered pages.
- **4K / Tizen polish:** layout tuned for the 720p base resolution scaled to 4K, smoother focus/card transitions, smooth scrolling and larger focus rings.

The shared backend stays compatible with the LG/webOS app: the new endpoints and faststart remux are additive, and `native=1` is only sent by the Tizen app.

## License

Same as the original project. Use at your own risk; Telegram may limit unofficial clients.
