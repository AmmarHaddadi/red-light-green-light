export type PlayerStatus = 'ALIVE' | 'ELIMINATED';

export interface Player {
  id: string;
  number: string; // e.g. "001", "042", "456"
  username: string;
  status: PlayerStatus;
  joinedAt: number;
  eliminatedAt?: number;
  eliminationDelta?: number;
}

export type GamePhase = 'LOBBY' | 'STARTING' | 'GREEN_LIGHT' | 'RED_LIGHT' | 'ROUND_OVER';
export type GameMode = 'AUTOMATIC' | 'MANUAL';

export interface GameConfig {
  minGreen: number; // in seconds
  maxGreen: number; // in seconds
  minRed: number; // in seconds
  maxRed: number; // in seconds
  gracePeriodMs: number; // ms to ignore motion right after Red Light starts
  motionThreshold: number; // sensitivity threshold for delta acceleration
}

export interface GameStateSnapshot {
  phase: GamePhase;
  mode: GameMode;
  config: GameConfig;
  phaseStartTime: number;
  phaseDurationMs: number;
  players: Player[];
  aliveCount: number;
  eliminatedCount: number;
  totalPlayers: number;
}

// Client -> Server messages
export type ClientMessage =
  | { type: 'JOIN'; username: string }
  | { type: 'MOTION_DETECTED'; delta: number }
  | { type: 'ADMIN_SET_PHASE'; phase: GamePhase }
  | { type: 'ADMIN_SET_MODE'; mode: GameMode }
  | { type: 'ADMIN_UPDATE_CONFIG'; config: Partial<GameConfig> }
  | { type: 'ADMIN_START' }
  | { type: 'ADMIN_RESET' }
  | { type: 'ADMIN_REVIVE'; playerId: string }
  | { type: 'ADMIN_ELIMINATE'; playerId: string }
  | { type: 'ADMIN_KICK'; playerId: string }
  | { type: 'PING' };

// Server -> Client messages
export type ServerMessage =
  | { type: 'JOIN_SUCCESS'; player: Player; state: GameStateSnapshot }
  | { type: 'JOIN_ERROR'; message: string }
  | { type: 'STATE_UPDATE'; state: GameStateSnapshot }
  | { type: 'PHASE_CHANGE'; phase: GamePhase; durationMs: number; timestamp: number }
  | { type: 'PLAYER_ELIMINATED'; player: Player }
  | { type: 'PLAYER_REVIVED'; player: Player }
  | { type: 'PLAYER_KICKED'; playerId: string }
  | { type: 'PONG' };
