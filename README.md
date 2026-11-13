# Telegram TV for Samsung Tizen

A Telegram client for Samsung TVs that talks to Telegram **directly** — no phone server, no backend, no API key to type in. Built on [mtcute](https://github.com/mtcute/mtcute) and packaged as a Tizen `.wgt`.

Channels, streaming video with seeking, music, PDF reading, Saved Messages and archived chats, all from the TV remote. UI available in **Spanish**, English and Chinese.

## Download

Latest release: **[v1.4.0](https://github.com/arrietaoadrian/telegram-tv-tizen/releases/tag/v1.4.0)**

- Package: [`Telegram-TV-1.4.0.wgt`](https://github.com/arrietaoadrian/telegram-tv-tizen/releases/download/v1.4.0/Telegram-TV-1.4.0.wgt)
- Install it with **Apps2Samsung** (Samsung + Partner signing).

## What's new in 1.4.0

- **Channel sidebar always visible** while you browse channels and files. It only hides when a video, a song or a PDF opens full screen.
- **File-type filter** at the top of the grid: **All · Video · Music · PDF**.
  - Press **↑** from the first row of cards to reach the filter.
  - **← →** changes the type and applies it immediately.
  - **OK** or **↓** returns to the cards.
- **Full-screen PDF**: the page fills the screen width, **↑↓** scrolls and **← →** turns pages, with a tiny page counter in the bottom-right corner.
- **Music fixes**: the audio is loaded explicitly before playing, retried once if it does not start within 12 seconds, and if the TV blocks autoplay the app shows **“Press OK to play”** instead of failing.
- **Saved Messages and archived chats** are always available in the sidebar.
- **Grid reworked** to 3 columns of 480×396 next to the sidebar, with 2:3 posters.

## How it works

The TV app is a plain HTML/CSS/JS Tizen web app. It connects to Telegram itself over MTProto using the bundled mtcute client and downloads media directly from Telegram's data centres.

- **No phone or PC server.** The previous version of this repository (tag [`v0.6.0`](https://github.com/arrietaoadrian/telegram-tv-tizen/tree/v0.6.0)) needed a Node.js backend; this one does not.
- **No API ID / Hash prompt.** Release builds carry the project's own credentials in packed form (`app/js/apikey.js`). You only scan a QR code with your phone.
- **Separate app.** It installs as `TgTvVideo0` / **Telegram TV** and does not replace the old `com.telegramtv.app` (0.6.0), so both can live on the TV.

## Install on the TV

1. Enable **Developer Mode** on the TV (Settings → General → Network → Expert Settings → Developer Mode), enter the IP of the PC that will install the app and reboot.
2. Install the `.wgt` with **Apps2Samsung** using **Samsung + Partner** signing, or with Tizen Studio / `sdb install`.
3. Open **Telegram TV**.
4. On your phone: Telegram → **Settings → Devices → Link Desktop Device**, and scan the QR code shown on the TV.

The login is stored on the TV and survives restarts. Nothing is sent to any server of ours.

## Controls

| Screen | Remote |
|---|---|
| Home | Arrows move, **OK** opens, **←** from the first column goes to the sidebar, **Back** exits (press twice) |
| Filter row | **← →** change type, **OK / ↓** back to the grid |
| Video | **OK** pause/resume (hold for the menu), **← →** seek, **↑ ↓** big seek, **Back** returns |
| Music | **OK** pause/resume, **← →** seek 10 s, **↑ ↓** previous/next track, **Back** returns to the list (keeps playing) |
| PDF | **← →** page, **↑ ↓** scroll, **Back** returns |

## Build from source

Requirements: Tizen Studio with the TV extension (the app targets `required_version="5.0"`) and a signing profile.

```bash
# from the repository root
tizen package -t wgt -s <your-profile> -- app
```

The generated `Telegram TV.wgt` is written inside `app/` and is ignored by git.

### Credentials

`app/js/config.js` ships with the project's API pair in packed form (`TG_API_PACKED`), so a build straight from the repository works without asking for credentials. To use your own:

- put them in `TG_API_ID` / `TG_API_HASH` in `app/js/config.js`, or
- leave the file empty and enter them once in the app's API screen (they are stored on the TV).

Get your own pair at [my.telegram.org](https://my.telegram.org) → API development tools.

## Project layout

```
app/                  Tizen web app (config.xml, index.html, css/, js/)
app/js/app.js         UI, remote handling, grid, filters, PDF viewer
app/js/tg.js          Telegram layer (dialogs, messages, media classification)
app/js/music.js       music queue and blob playback
app/js/player.js      MSE/HLS video player
app/js/pdf/           pdf.js 2.16 (legacy build for Tizen 5.0)
app/js/tg.bundle.js   prebuilt mtcute bundle
app/js/tg.legacy.js   prebuilt mtcute bundle for TVs without BigInt
LICENSES/             third-party licence texts
```

## Contributing

Contributions are welcome.

- **Bug reports**: open an issue with the TV model, the Tizen version (Settings → Support → About), what you did, what happened, and the exact text shown on screen. Logs from the app's diagnostics screen help a lot.
- **Pull requests**: keep the existing structure and style, make sure every script still parses on Chromium 63 (Tizen 5.0), and describe what you tested on a real TV.
- **Never paste** API hashes, session files or personal media links in issues or PRs.

## Credits and acknowledgements

This app is a derivative of the excellent **[titlog/telegram-tizen](https://github.com/titlog/telegram-tizen)** project by **titlog** (MIT): the mtcute-based Telegram client, the player, the music pipeline, the PDF reader and most of the code in `app/` come from there. Many thanks for publishing it.

Thanks as well to the libraries that make this possible:

- **[mtcute](https://github.com/mtcute/mtcute)** — Telegram MTProto client for JavaScript.
- **[pdf.js](https://github.com/mozilla/pdf.js)** (Mozilla) — PDF rendering on the TV.
- **[hls.js](https://github.com/video-dev/hls.js)** — HLS playback.
- **[qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator)** — login QR codes.
- **[JSBI](https://github.com/GoogleChromeLabs/jsbi)** and **[bn.js](https://github.com/indutny/bn.js)** — big integers for the legacy bundle.

The previous, server-based version of this repository is the Samsung Tizen port of **[arrietaoadrian/telegram-webos-3.x](https://github.com/arrietaoadrian/telegram-webos-3.x)**; its source is kept in the [`v0.6.0` tag](https://github.com/arrietaoadrian/telegram-tv-tizen/tree/v0.6.0).

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for the full list and licence texts.

## License

MIT — see [LICENSE](LICENSE). Third-party components keep their own licences.

Telegram is a trademark of Telegram FZ-LLC. This is an unofficial client, not affiliated with Telegram.
