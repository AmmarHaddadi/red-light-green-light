import type {
  GameConfig,
  GameMode,
  GamePhase,
  GameStateSnapshot,
  Player,
  ServerMessage
} from './types';

export interface Broadcaster {
  broadcast: (message: ServerMessage) => void;
  sendTo: (playerId: string, message: ServerMessage) => void;
}

export class GameStateManager {
  private phase: GamePhase = 'LOBBY';
  private mode: GameMode = 'AUTOMATIC';
  private phaseStartTime: number = Date.now();
  private phaseDurationMs: number = 0;
  private autoTimer: ReturnType<typeof setTimeout> | null = null;

  private players: Map<string, Player> = new Map();
  private playerCounter: number = 1;
  private broadcaster: Broadcaster | null = null;

  public config: GameConfig = {
    minGreen: 3,
    maxGreen: 7,
    minRed: 2,
    maxRed: 5,
    gracePeriodMs: 250,
    motionThreshold: 3.5, // m/s^2 jitter delta
  };

  constructor(broadcaster?: Broadcaster) {
    if (broadcaster) {
      this.broadcaster = broadcaster;
    }
  }

  public setBroadcaster(broadcaster: Broadcaster) {
    this.broadcaster = broadcaster;
  }

  public getSnapshot(): GameStateSnapshot {
    const playerList = Array.from(this.players.values()).sort(
      (a, b) => parseInt(a.number, 10) - parseInt(b.number, 10)
    );
    const aliveCount = playerList.filter((p) => p.status === 'ALIVE').length;
    const eliminatedCount = playerList.filter((p) => p.status === 'ELIMINATED').length;

    return {
      phase: this.phase,
      mode: this.mode,
      config: { ...this.config },
      phaseStartTime: this.phaseStartTime,
      phaseDurationMs: this.phaseDurationMs,
      players: playerList,
      aliveCount,
      eliminatedCount,
      totalPlayers: playerList.length,
    };
  }

  public registerPlayer(username: string): { player?: Player; error?: string } {
    const trimmed = username.trim();
    if (!trimmed) {
      return { error: 'Username cannot be empty.' };
    }
    if (trimmed.length > 20) {
      return { error: 'Username must be 20 characters or less.' };
    }

    // Check if player with this username already exists (allow session reconnect)
    for (const existing of this.players.values()) {
      if (existing.username.toLowerCase() === trimmed.toLowerCase()) {
        return { player: existing };
      }
    }

    const assignedNumber = String(this.playerCounter++).padStart(3, '0');
    const newPlayer: Player = {
      id: crypto.randomUUID(),
      number: assignedNumber,
      username: trimmed,
      status: 'ALIVE',
      joinedAt: Date.now(),
    };

    this.players.set(newPlayer.id, newPlayer);
    this.notifyState();
    return { player: newPlayer };
  }

  public getPlayer(id: string): Player | undefined {
    return this.players.get(id);
  }

  public getPlayerByUsername(username: string): Player | undefined {
    const trimmed = username.trim().toLowerCase();
    for (const player of this.players.values()) {
      if (player.username.toLowerCase() === trimmed) {
        return player;
      }
    }
    return undefined;
  }

  public handleMotion(playerId: string, delta: number): boolean {
    const player = this.players.get(playerId);
    if (!player || player.status !== 'ALIVE') {
      return false;
    }

    // Motion is only a violation during RED_LIGHT
    if (this.phase !== 'RED_LIGHT') {
      return false;
    }

    // Check grace period to prevent false eliminations on the sudden stop deceleration
    const elapsed = Date.now() - this.phaseStartTime;
    if (elapsed < this.config.gracePeriodMs) {
      return false;
    }

    // Eliminate player
    player.status = 'ELIMINATED';
    player.eliminatedAt = Date.now();
    player.eliminationDelta = Math.round(delta * 100) / 100;

    if (this.broadcaster) {
      this.broadcaster.broadcast({
        type: 'PLAYER_ELIMINATED',
        player,
      });
    }

    this.notifyState();
    return true;
  }

  public startGame(): void {
    this.clearTimer();
    this.setPhase('STARTING', 3000);

    this.autoTimer = setTimeout(() => {
      this.setPhase('GREEN_LIGHT');
      if (this.mode === 'AUTOMATIC') {
        this.scheduleNextPhase();
      }
    }, 3000);
  }

  public setPhase(phase: GamePhase, customDurationMs?: number): void {
    this.phase = phase;
    this.phaseStartTime = Date.now();

    if (customDurationMs !== undefined) {
      this.phaseDurationMs = customDurationMs;
    } else if (phase === 'GREEN_LIGHT') {
      const durSec =
        this.config.minGreen +
        Math.random() * (this.config.maxGreen - this.config.minGreen);
      this.phaseDurationMs = Math.round(durSec * 1000);
    } else if (phase === 'RED_LIGHT') {
      const durSec =
        this.config.minRed +
        Math.random() * (this.config.maxRed - this.config.minRed);
      this.phaseDurationMs = Math.round(durSec * 1000);
    } else {
      this.phaseDurationMs = 0;
    }

    if (this.broadcaster) {
      this.broadcaster.broadcast({
        type: 'PHASE_CHANGE',
        phase: this.phase,
        durationMs: this.phaseDurationMs,
        timestamp: this.phaseStartTime,
      });
    }

    this.notifyState();
  }

  public setMode(mode: GameMode): void {
    this.mode = mode;
    this.clearTimer();

    if (mode === 'AUTOMATIC') {
      if (this.phase === 'GREEN_LIGHT' || this.phase === 'RED_LIGHT') {
        this.scheduleNextPhase();
      }
    }
    this.notifyState();
  }

  public updateConfig(newConfig: Partial<GameConfig>): void {
    if (newConfig.minGreen !== undefined && newConfig.minGreen > 0) {
      this.config.minGreen = Number(newConfig.minGreen);
    }
    if (newConfig.maxGreen !== undefined && newConfig.maxGreen >= this.config.minGreen) {
      this.config.maxGreen = Number(newConfig.maxGreen);
    }
    if (newConfig.minRed !== undefined && newConfig.minRed > 0) {
      this.config.minRed = Number(newConfig.minRed);
    }
    if (newConfig.maxRed !== undefined && newConfig.maxRed >= this.config.minRed) {
      this.config.maxRed = Number(newConfig.maxRed);
    }
    if (newConfig.gracePeriodMs !== undefined && newConfig.gracePeriodMs >= 0) {
      this.config.gracePeriodMs = Number(newConfig.gracePeriodMs);
    }
    if (newConfig.motionThreshold !== undefined && newConfig.motionThreshold > 0) {
      this.config.motionThreshold = Number(newConfig.motionThreshold);
    }

    this.notifyState();
  }

  public manualSetPhase(phase: GamePhase): void {
    this.clearTimer();
    this.setPhase(phase);

    if (this.mode === 'AUTOMATIC') {
      this.scheduleNextPhase();
    }
  }

  public revivePlayer(playerId: string): void {
    const player = this.players.get(playerId);
    if (player && player.status === 'ELIMINATED') {
      player.status = 'ALIVE';
      player.eliminatedAt = undefined;
      player.eliminationDelta = undefined;

      if (this.broadcaster) {
        this.broadcaster.broadcast({
          type: 'PLAYER_REVIVED',
          player,
        });
      }
      this.notifyState();
    }
  }

  public forceEliminate(playerId: string): void {
    const player = this.players.get(playerId);
    if (player && player.status === 'ALIVE') {
      player.status = 'ELIMINATED';
      player.eliminatedAt = Date.now();
      player.eliminationDelta = 999;

      if (this.broadcaster) {
        this.broadcaster.broadcast({
          type: 'PLAYER_ELIMINATED',
          player,
        });
      }
      this.notifyState();
    }
  }

  public kickPlayer(playerId: string): void {
    if (this.players.has(playerId)) {
      this.players.delete(playerId);
      if (this.broadcaster) {
        this.broadcaster.broadcast({
          type: 'PLAYER_KICKED',
          playerId,
        });
      }
      this.notifyState();
    }
  }

  public resetGame(): void {
    this.clearTimer();
    this.phase = 'LOBBY';
    this.phaseStartTime = Date.now();
    this.phaseDurationMs = 0;

    for (const player of this.players.values()) {
      player.status = 'ALIVE';
      player.eliminatedAt = undefined;
      player.eliminationDelta = undefined;
    }

    if (this.broadcaster) {
      this.broadcaster.broadcast({
        type: 'PHASE_CHANGE',
        phase: 'LOBBY',
        durationMs: 0,
        timestamp: this.phaseStartTime,
      });
    }

    this.notifyState();
  }

  private scheduleNextPhase(): void {
    this.clearTimer();
    if (this.mode !== 'AUTOMATIC') return;

    if (this.phase === 'GREEN_LIGHT') {
      this.autoTimer = setTimeout(() => {
        this.setPhase('RED_LIGHT');
        this.scheduleNextPhase();
      }, this.phaseDurationMs);
    } else if (this.phase === 'RED_LIGHT') {
      this.autoTimer = setTimeout(() => {
        this.setPhase('GREEN_LIGHT');
        this.scheduleNextPhase();
      }, this.phaseDurationMs);
    }
  }

  private clearTimer(): void {
    if (this.autoTimer) {
      clearTimeout(this.autoTimer);
      this.autoTimer = null;
    }
  }

  private notifyState(): void {
    if (this.broadcaster) {
      this.broadcaster.broadcast({
        type: 'STATE_UPDATE',
        state: this.getSnapshot(),
      });
    }
  }
}
