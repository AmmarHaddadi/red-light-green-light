# 🦑 Squid Game: Red Light, Green Light

A self-hosted, real-time party and field game system. Players join from their smartphones via a local network, detect movement during **Red Light** using the browser's native `DeviceMotionEvent` accelerometer API, and immediately trigger high-volume elimination alarms while synchronizing game state to the Front Man admin dashboard via WebSockets.

---

## 🌟 Features

- **📱 Mobile Motion Detection (`/play`)**:
  - Uses native `DeviceMotionEvent` for real-time 3-axis accelerometer tracking.
  - High-pass filtering & jitter magnitude calculation: $\Delta a = \sqrt{(x - x_{prev})^2 + (y - y_{prev})^2 + (z - z_{prev})^2}$.
  - Built-in 250ms grace period on Red Light transition to prevent false eliminations on deceleration.
  - One-tap calibration to unlock iOS Safari sensor permissions and Web Audio API.
  - Screeching alarm sound synthesis & aggressive phone vibration upon elimination.
  - Session restoration if player refreshes browser.

- **🖥️ Front Man Admin Console (`/admin`)**:
  - Real-time game control with live countdown and phase indicators.
  - `AUTOMATIC` mode with randomized intervals and instant `MANUAL` phase override.
  - Dynamic game settings (Min/Max Green & Red durations, grace period, motion threshold).
  - Live player roster showing alive/eliminated counts, player numbers (`#001`, `#042`), and elimination timestamps.
  - Quick player actions: Revive, Force Eliminate, Kick.
  - Synthesized stadium audio effects (gunshots/buzzers and phase chimes).

- **🔒 Built-in HTTPS & Secure Context**:
  - Mobile browsers require a secure context (`https://` or `localhost`) to access motion sensors.
  - Auto-generates local self-signed TLS certificates for seamless LAN mobile access (`https://<LAN-IP>:3000/play`).

- **⚡ Blazing Fast Runtime**:
  - Built with [Bun](https://bun.sh/) for ultra-fast startup and native WebSockets.
  - Zero external npm runtime dependencies.

---

## 🚀 Quick Start

### 1. Prerequisites
- [Bun](https://bun.sh/) (v1.0+)
- OpenSSL (for generating local TLS certs)

### 2. Generate TLS Certificates
```bash
bun run cert
```
*(This generates self-signed certificates in `certs/` with Subject Alternative Names for your local IP and localhost).*

### 3. Start the Game Server
```bash
bun run start
# or with live watch mode:
bun run dev
```

### 4. Connect & Play
- **Admin Console**: Open `https://localhost:3000/admin` on your computer.
- **Mobile Players**: Connect your smartphone to the same Wi-Fi network and open the LAN URL displayed in the terminal:
  ```
  https://<YOUR-LAN-IP>:3000/play
  ```
  *(Accept the browser self-signed certificate warning to proceed to the arena).*

---

## 🧪 Testing

Run the test suite with Bun:
```bash
bun test
```

---

## 🛠️ Project Structure

```
├── certs/                 # Local TLS certificates (gitignored)
├── generate-cert.sh       # Certificate generation helper
├── public/                # Static assets & frontend clients
│   ├── index.html         # Landing page
│   ├── play.html          # Mobile player UI
│   ├── player.js          # Player motion detector & Web Audio engine
│   ├── admin.html         # Front Man console UI
│   ├── admin.js           # Admin WebSocket controls & audio cues
│   └── style.css          # Squid Game dark & neon aesthetic
├── src/
│   ├── server.ts          # Bun HTTP & WebSocket server
│   ├── state.ts           # Game state engine & player registry
│   └── types.ts           # Protocol & data types
└── tests/
    ├── server.test.ts     # Static asset & endpoint tests
    └── state.test.ts      # State machine & motion physics tests
```

---

## 📜 License

MIT License.
