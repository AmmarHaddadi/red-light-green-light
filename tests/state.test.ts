import { describe, expect, it } from 'bun:test';
import { GameStateManager } from '../src/state';
import type { ServerMessage } from '../src/types';

describe('GameStateManager', () => {
  it('registers players and assigns sequential numbers', () => {
    const manager = new GameStateManager();
    const res1 = manager.registerPlayer('Player One');
    const res2 = manager.registerPlayer('Player Two');

    expect(res1.player).toBeDefined();
    expect(res1.player?.number).toBe('001');
    expect(res1.player?.username).toBe('Player One');
    expect(res1.player?.status).toBe('ALIVE');

    expect(res2.player).toBeDefined();
    expect(res2.player?.number).toBe('002');
    expect(res2.player?.username).toBe('Player Two');

    const snapshot = manager.getSnapshot();
    expect(snapshot.totalPlayers).toBe(2);
    expect(snapshot.aliveCount).toBe(2);
    expect(snapshot.eliminatedCount).toBe(0);
  });

  it('allows existing players to reconnect with same username', () => {
    const manager = new GameStateManager();
    const first = manager.registerPlayer('Player One');
    const second = manager.registerPlayer('player one'); // case-insensitive

    expect(second.player?.id).toBe(first.player?.id);
    expect(second.player?.number).toBe('001');
    expect(manager.getSnapshot().totalPlayers).toBe(1);
  });

  it('rejects empty usernames', () => {
    const manager = new GameStateManager();
    const res = manager.registerPlayer('   ');
    expect(res.error).toBeDefined();
    expect(res.player).toBeUndefined();
  });

  it('handles phase changes and ignores motion during GREEN_LIGHT', () => {
    const manager = new GameStateManager();
    const { player } = manager.registerPlayer('Runner');
    manager.setPhase('GREEN_LIGHT', 5000);

    const eliminated = manager.handleMotion(player!.id, 10.5);
    expect(eliminated).toBe(false);
    expect(manager.getPlayer(player!.id)?.status).toBe('ALIVE');
  });

  it('ignores motion during RED_LIGHT within grace period', () => {
    const manager = new GameStateManager();
    const { player } = manager.registerPlayer('Runner');
    manager.config.gracePeriodMs = 500;
    manager.setPhase('RED_LIGHT', 4000);

    // Immediate motion right upon red light switch (elapsed < 500ms)
    const eliminated = manager.handleMotion(player!.id, 8.2);
    expect(eliminated).toBe(false);
    expect(manager.getPlayer(player!.id)?.status).toBe('ALIVE');
  });

  it('eliminates player upon motion during RED_LIGHT after grace period', async () => {
    const broadcastEvents: ServerMessage[] = [];
    const manager = new GameStateManager({
      broadcast: (msg) => broadcastEvents.push(msg),
      sendTo: () => {},
    });

    const { player } = manager.registerPlayer('Runner');
    manager.config.gracePeriodMs = 50; // set short grace period for test
    manager.setPhase('RED_LIGHT', 4000);

    // Wait past grace period
    await new Promise((resolve) => setTimeout(resolve, 70));

    const eliminated = manager.handleMotion(player!.id, 6.7);
    expect(eliminated).toBe(true);

    const updated = manager.getPlayer(player!.id);
    expect(updated?.status).toBe('ELIMINATED');
    expect(updated?.eliminationDelta).toBe(6.7);

    const snapshot = manager.getSnapshot();
    expect(snapshot.eliminatedCount).toBe(1);
    expect(snapshot.aliveCount).toBe(0);

    const elimBroadcast = broadcastEvents.find(
      (m) => m.type === 'PLAYER_ELIMINATED' && (m as any).player.id === player!.id
    );
    expect(elimBroadcast).toBeDefined();
  });

  it('supports admin revive, eliminate, and reset', () => {
    const manager = new GameStateManager();
    const { player } = manager.registerPlayer('TestPlayer');

    manager.forceEliminate(player!.id);
    expect(manager.getPlayer(player!.id)?.status).toBe('ELIMINATED');

    manager.revivePlayer(player!.id);
    expect(manager.getPlayer(player!.id)?.status).toBe('ALIVE');

    manager.forceEliminate(player!.id);
    expect(manager.getPlayer(player!.id)?.status).toBe('ELIMINATED');

    manager.resetGame();
    expect(manager.getPlayer(player!.id)?.status).toBe('ALIVE');
    expect(manager.getSnapshot().phase).toBe('LOBBY');
  });

  it('supports kicking a player', () => {
    const manager = new GameStateManager();
    const { player } = manager.registerPlayer('KickMe');

    manager.kickPlayer(player!.id);
    expect(manager.getPlayer(player!.id)).toBeUndefined();
    expect(manager.getSnapshot().totalPlayers).toBe(0);
  });
});
