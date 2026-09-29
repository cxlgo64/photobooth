# Photo Booth

A browser-based photo booth app. It uses the machine's webcam as the booth camera, plays idle animations on loop, and takes a full-screen screenshot (camera + animations composited) when triggered. Each shot is saved locally and a QR code is shown on screen — anyone on the same network can scan it with a phone to download the photo.

---

## 1. Requirements

- A Windows PC with a webcam
- **Node.js LTS** installed (https://nodejs.org) — the launcher scripts auto-detect it; if none is found they print setup instructions
- Google Chrome or Microsoft Edge

> The launcher scripts (`start.bat` / `start-server.bat`) automatically run `npm install` on first run, so a fresh clone works out of the box — no manual setup needed.

## 2. Project Layout

```
photobooth/
├── server.js            Node server: static files, save screenshot, QR code, phone download page
├── start.bat            One-click launcher: server + fullscreen (kiosk) browser
├── start-server.bat     Server only (opens a console window with logs)
├── public/              Front end (index.html / style.css / app.js)
├── assets/
│   ├── idle/            Idle-mode webm animations
│   └── countdown/       Shot-sequence webm animations (see naming rules below)
├── captures/            Saved screenshots (created automatically)
└── tools/
    └── gen_anims.py     Script that regenerates the built-in sample animations
```

## 3. First-Time Setup

1. Double-click `start-server.bat` (or `start.bat`) to start the server on port **8787**.
2. Open `http://localhost:8787` in Chrome/Edge on the booth machine.
3. The browser asks for camera permission — click **Allow**. This is asked only once.
   - If you previously blocked it: click the lock icon left of the address bar, set **Camera** to **Allow**, then refresh.
   - If the camera option doesn't appear at all, enable it in Windows: `Settings → Privacy & security → Camera` — turn on both **Camera access** and **Let desktop apps access your camera**.

> Important: the booth page must be opened via `localhost`. Browsers block camera access on non-localhost addresses (that address is only for phones downloading photos).

## 4. Daily Use

### Option A — Full booth mode (recommended)

Double-click **`start.bat`**. It will:

1. Start the server if it isn't running yet
2. Wait until the server is ready
3. Open Chrome in **kiosk mode** (true fullscreen, no address bar)

To exit kiosk mode, press **Alt + F4**.

### Option B — Server only

Double-click **`start-server.bat`** if you want to control the browser yourself (useful while developing). Keep the console window open; closing it stops the server. Then open `http://localhost:8787` manually in any browser.

### Boot autostart (optional)

Press `Win + R`, type `shell:startup`, press Enter, and drop a shortcut to `start.bat` into that folder. The booth will launch automatically on every boot.

## 5. How the Booth Flows

| Stage | Duration | What happens |
|---|---|---|
| **Idle** | — | Webcam fills the screen (mirrored selfie view). Idle animations play on top: a **random** clip is picked first, then they loop in filename order 1 → 2 → 3 |
| **Intro** | 5 s | Triggered by pressing **Enter** or **clicking/tapping anywhere**. Animation `3.webm` starts looping on the background layer |
| **Countdown** | 3 s | Animations `1.webm` → `2.webm` play on the front layer while `3.webm` keeps looping behind them. The moment `2.webm` finishes, the shot is taken |
| **Result** | 15 s | White flash, the photo + a QR code appear on top. `3.webm` still plays in the background. Anyone on the same Wi-Fi scans the QR code to open the download page and save the photo to their phone |
| **Back to idle** | — | Everything resets; idle resumes with a new random starting clip |

The screenshot is a composite of exactly what the screen shows at the moment of capture: camera (cover) + background animation + the last frame of animation 2. Files are saved as PNG in `captures/`, named by timestamp.

## 6. Replacing the Animations

Just drop your own webm files into the folders — no code changes needed. Refresh the page to pick them up (the server reads the folders live).

> Note: the webm files in this repository are **empty placeholders** (0 bytes, names kept). Copy your real animation files into `assets/idle/` and `assets/countdown/` on each machine — without them the booth falls back to the built-in CSS ring animation and a 3-2-1 number countdown.

- `assets/idle/` — played in filename order. Recommended: `1.webm`, `2.webm`, `3.webm`
- `assets/countdown/` — the **first character of the filename** decides the role:
  - **`3*.webm`** → background clip: starts at trigger, loops through the whole sequence (5 s intro + countdown + QR display)
  - **`1*.webm`, `2*.webm`** → front clips: play in order after the intro; the shot fires when the last one ends

Tips:

- Use **VP9 with alpha channel** so animations blend over the camera view (the built-in samples do this).
- Keep all countdown clips the same aspect ratio; they are drawn centered with `contain` scaling.
- If `1/2` files are missing, an on-screen 3-2-1 number countdown is used as a fallback and the shot fires after it.
- To regenerate the built-in sample animations, run `tools/gen_anims.py` (colors and durations are at the top of the script).

## 7. Phone Download Page

- The QR code points to `http://<LAN-IP>:8787/photo/<file>` — phones must be on the **same network** as the booth PC.
- The page shows "Welcome!", the photo, and a dark-blue **Save to Phone** button.
- If phones can't open the link, check that Windows Firewall allows inbound connections on port 8787 for private networks.

## 8. Troubleshooting

| Symptom | Fix |
|---|---|
| Black screen / camera error | Check camera permission (lock icon in address bar) and Windows camera privacy settings; close other apps using the camera (Teams, Zoom, Camera app) |
| Page won't load at all | Server isn't running — double-click `start-server.bat` |
| QR code scans but page won't open on phone | Phone not on the same network, or Windows Firewall blocks port 8787 |
| Camera view is mirrored wrong | The camera is mirrored intentionally (selfie view); screenshots match what guests see on screen |
| Multiple cameras | Pick the right device in the browser's site settings for `localhost:8787` |
