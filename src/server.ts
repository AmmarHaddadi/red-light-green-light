import { networkInterfaces } from 'node:os';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { GameStateManager, type Broadcaster } from './state';
import type { ClientMessage, ServerMessage } from './types';

interface SocketData {
  id: string;
  playerId?: string;
  isAdmin?: boolean;
}

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = join(import.meta.dir, '..', 'public');
const CERTS_DIR = join(import.meta.dir, '..', 'certs');
const CERT_FILE = join(CERTS_DIR, 'cert.pem');
const KEY_FILE = join(CERTS_DIR, 'key.pem');

// Verify TLS files
const useTls = existsSync(CERT_FILE) && existsSync(KEY_FILE);

// Set up Connected Sockets Map
const connectedSockets = new Map<string, any>();

// Set up Broadcaster
const broadcaster: Broadcaster = {
  broadcast: (message: ServerMessage) => {
    const payload = JSON.stringify(message);
    for (const ws of connectedSockets.values()) {
      try {
        ws.send(payload);
      } catch (err) {
        // Socket may have disconnected
      }
    }
  },
  sendTo: (playerId: string, message: ServerMessage) => {
    const payload = JSON.stringify(message);
    for (const ws of connectedSockets.values()) {
      if (ws.data.playerId === playerId) {
        try {
          ws.send(payload);
        } catch (err) {}
      }
    }
  },
};

const gameState = new GameStateManager(broadcaster);

// Helper to determine local LAN IPs
function getLocalIps(): string[] {
  const nets = networkInterfaces();
  const results: string[] = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        results.push(net.address);
      }
    }
  }
  return results;
}

// Serve static files
async function handleStatic(path: string): Promise<Response> {
  let normalizedPath = path === '/' ? '/index.html' : path;
  if (normalizedPath === '/play') normalizedPath = '/play.html';
  if (normalizedPath === '/admin') normalizedPath = '/admin.html';

  const filePath = join(PUBLIC_DIR, normalizedPath);
  const file = Bun.file(filePath);

  if (await file.exists()) {
    const contentType = getMimeType(filePath);
    return new Response(file, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache',
      },
    });
  }

  return new Response('Not Found', { status: 404 });
}

function getMimeType(path: string): string {
  if (path.endsWith('.html')) return 'text/html; charset=utf-8';
  if (path.endsWith('.css')) return 'text/css; charset=utf-8';
  if (path.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if (path.endsWith('.json')) return 'application/json';
  if (path.endsWith('.svg')) return 'image/svg+xml';
  if (path.endsWith('.png')) return 'image/png';
  if (path.endsWith('.mp3')) return 'audio/mpeg';
  if (path.endsWith('.wav')) return 'audio/wav';
  return 'text/plain';
}

const serverOptions: any = {
  port: PORT,
  async fetch(req: Request, server: any) {
    const url = new URL(req.url);

    // WebSocket upgrade
    if (url.pathname === '/ws') {
      const socketId = crypto.randomUUID();
      const isAdmin = url.searchParams.get('role') === 'admin';
      const upgraded = server.upgrade(req, {
        data: {
          id: socketId,
          isAdmin,
        } as SocketData,
      });

      if (upgraded) {
        return undefined;
      }
      return new Response('WebSocket upgrade failed', { status: 400 });
    }

    // Static assets
    return handleStatic(url.pathname);
  },
  websocket: {
    open(ws: any) {
      connectedSockets.set(ws.data.id, ws);

      // Send initial state to newly connected client
      const snapshot = gameState.getSnapshot();
      ws.send(
        JSON.stringify({
          type: 'STATE_UPDATE',
          state: snapshot,
        })
      );
    },
    message(ws: any, rawMessage: string | Buffer) {
      try {
        const text = typeof rawMessage === 'string' ? rawMessage : rawMessage.toString();
        const msg: ClientMessage = JSON.parse(text);

        switch (msg.type) {
          case 'JOIN': {
            const result = gameState.registerPlayer(msg.username);
            if (result.error) {
              ws.send(
                JSON.stringify({
                  type: 'JOIN_ERROR',
                  message: result.error,
                })
              );
            } else if (result.player) {
              ws.data.playerId = result.player.id;
              ws.send(
                JSON.stringify({
                  type: 'JOIN_SUCCESS',
                  player: result.player,
                  state: gameState.getSnapshot(),
                })
              );
            }
            break;
          }

          case 'MOTION_DETECTED': {
            if (ws.data.playerId) {
              gameState.handleMotion(ws.data.playerId, msg.delta);
            }
            break;
          }

          case 'ADMIN_START': {
            gameState.startGame();
            break;
          }

          case 'ADMIN_SET_PHASE': {
            gameState.manualSetPhase(msg.phase);
            break;
          }

          case 'ADMIN_SET_MODE': {
            gameState.setMode(msg.mode);
            break;
          }

          case 'ADMIN_UPDATE_CONFIG': {
            gameState.updateConfig(msg.config);
            break;
          }

          case 'ADMIN_RESET': {
            gameState.resetGame();
            break;
          }

          case 'ADMIN_REVIVE': {
            gameState.revivePlayer(msg.playerId);
            break;
          }

          case 'ADMIN_ELIMINATE': {
            gameState.forceEliminate(msg.playerId);
            break;
          }

          case 'ADMIN_KICK': {
            gameState.kickPlayer(msg.playerId);
            break;
          }

          case 'PING': {
            ws.send(JSON.stringify({ type: 'PONG' }));
            break;
          }
        }
      } catch (err) {
        console.error('Error handling WebSocket message:', err);
      }
    },
    close(ws: any) {
      connectedSockets.delete(ws.data.id);
    },
  },
};

if (useTls) {
  serverOptions.tls = {
    cert: Bun.file(CERT_FILE),
    key: Bun.file(KEY_FILE),
  };
}

const server = Bun.serve(serverOptions);

const protocol = useTls ? 'https' : 'http';
const localIps = getLocalIps();

console.log('='.repeat(60));
console.log(`🦑 SQUID GAME: RED LIGHT, GREEN LIGHT SERVER RUNNING`);
console.log(`🔒 Mode: ${useTls ? 'HTTPS (Secure Context Enabled)' : 'HTTP'}`);
console.log(`🖥️  Admin Dashboard : ${protocol}://localhost:${PORT}/admin`);
console.log(`📱 Player Join     : ${protocol}://localhost:${PORT}/play`);
if (localIps.length > 0) {
  console.log(`🌐 LAN Mobile Access:`);
  for (const ip of localIps) {
    console.log(`   -> ${protocol}://${ip}:${PORT}/play`);
  }
}
console.log('='.repeat(60));
