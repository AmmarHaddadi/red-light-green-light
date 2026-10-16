// Squid Game Admin / Front Man Console Logic
(() => {
  // Elements
  const connectionStatus = document.getElementById('connection-status');
  const adminAudioToggle = document.getElementById('admin-audio-toggle');
  const adminBanner = document.getElementById('admin-banner');
  const bannerPhaseText = document.getElementById('banner-phase-text');
  const bannerTimerText = document.getElementById('banner-timer-text');
  const statAlive = document.getElementById('stat-alive');
  const statEliminated = document.getElementById('stat-eliminated');
  const statTotal = document.getElementById('stat-total');
  const playerCountIndicator = document.getElementById('player-count-indicator');
  const playerRoster = document.getElementById('player-roster');

  const btnStartGame = document.getElementById('btn-start-game');
  const btnForceGreen = document.getElementById('btn-force-green');
  const btnForceRed = document.getElementById('btn-force-red');
  const btnResetGame = document.getElementById('btn-reset-game');

  const configForm = document.getElementById('config-form');
  const selectMode = document.getElementById('select-mode');
  const inputMinGreen = document.getElementById('input-min-green');
  const inputMaxGreen = document.getElementById('input-max-green');
  const inputMinRed = document.getElementById('input-min-red');
  const inputMaxRed = document.getElementById('input-max-red');
  const inputGrace = document.getElementById('input-grace');
  const inputThreshold = document.getElementById('input-threshold');

  // State
  let ws = null;
  let currentState = null;
  let countdownTimer = null;
  let audioEnabled = false;
  let audioCtx = null;

  // Audio Engine
  function initAudio() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContext();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    audioEnabled = true;
    adminAudioToggle.textContent = '🔊 Stadium Audio: Active';
    adminAudioToggle.classList.remove('btn-secondary');
    adminAudioToggle.classList.add('btn-primary');
  }

  // Realistic synthesized gunshot / elimination cue
  function playEliminationSound() {
    if (!audioEnabled || !audioCtx) return;
    try {
      const now = audioCtx.currentTime;

      // 1. Noise blast (gunshot crack)
      const bufferSize = audioCtx.sampleRate * 0.4;
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = audioCtx.createBufferSource();
      noise.buffer = buffer;

      const noiseFilter = audioCtx.createBiquadFilter();
      noiseFilter.type = 'lowpass';
      noiseFilter.frequency.setValueAtTime(1000, now);
      noiseFilter.frequency.exponentialRampToValueAtTime(80, now + 0.35);

      const noiseGain = audioCtx.createGain();
      noiseGain.gain.setValueAtTime(0.7, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(audioCtx.destination);

      // 2. Sub-bass thump
      const osc = audioCtx.createOscillator();
      const oscGain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.3);

      oscGain.gain.setValueAtTime(0.6, now);
      oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

      osc.connect(oscGain);
      oscGain.connect(audioCtx.destination);

      noise.start(now);
      osc.start(now);
      osc.stop(now + 0.4);
    } catch (e) {
      console.warn('Audio playback error:', e);
    }
  }

  function playPhaseCue(phase) {
    if (!audioEnabled || !audioCtx) return;
    try {
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      if (phase === 'GREEN_LIGHT') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      } else if (phase === 'RED_LIGHT') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
      }

      osc.connect(gain);
      gain.connect(audioCtx.destination);
    } catch (e) {}
  }

  // WebSocket Connection
  function connect() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${location.host}/ws?role=admin`);

    ws.onopen = () => {
      connectionStatus.textContent = 'CONNECTED';
      connectionStatus.className = 'player-badge-status badge-alive';
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        switch (msg.type) {
          case 'STATE_UPDATE': {
            renderState(msg.state);
            break;
          }

          case 'PHASE_CHANGE': {
            if (currentState) {
              currentState.phase = msg.phase;
              currentState.phaseStartTime = msg.timestamp;
              currentState.phaseDurationMs = msg.durationMs;
              updatePhaseBanner(msg.phase, msg.durationMs, msg.timestamp);
            }
            playPhaseCue(msg.phase);
            break;
          }

          case 'PLAYER_ELIMINATED': {
            playEliminationSound();
            break;
          }
        }
      } catch (err) {
        console.error('Error handling WS message:', err);
      }
    };

    ws.onclose = () => {
      connectionStatus.textContent = 'DISCONNECTED';
      connectionStatus.className = 'player-badge-status badge-eliminated';
      setTimeout(connect, 2000);
    };
  }

  function renderState(state) {
    currentState = state;

    // Update stats
    statAlive.textContent = state.aliveCount;
    statEliminated.textContent = state.eliminatedCount;
    statTotal.textContent = state.totalPlayers;
    playerCountIndicator.textContent = `${state.totalPlayers} Players Connected`;

    // Populate config form if not focused
    if (document.activeElement?.tagName !== 'INPUT') {
      selectMode.value = state.mode;
      inputMinGreen.value = state.config.minGreen;
      inputMaxGreen.value = state.config.maxGreen;
      inputMinRed.value = state.config.minRed;
      inputMaxRed.value = state.config.maxRed;
      inputGrace.value = state.config.gracePeriodMs;
      inputThreshold.value = state.config.motionThreshold;
    }

    updatePhaseBanner(state.phase, state.phaseDurationMs, state.phaseStartTime);
    renderPlayerRoster(state.players);
  }

  function updatePhaseBanner(phase, durationMs, startTime) {
    adminBanner.className = 'admin-banner';
    if (countdownTimer) clearInterval(countdownTimer);

    switch (phase) {
      case 'GREEN_LIGHT':
        adminBanner.classList.add('phase-green');
        bannerPhaseText.textContent = 'GREEN LIGHT';
        bannerPhaseText.style.color = 'var(--squid-green)';
        break;
      case 'RED_LIGHT':
        adminBanner.classList.add('phase-red');
        bannerPhaseText.textContent = 'RED LIGHT';
        bannerPhaseText.style.color = 'var(--squid-red)';
        break;
      case 'STARTING':
        bannerPhaseText.textContent = 'STARTING (COUNTDOWN)';
        bannerPhaseText.style.color = 'var(--squid-gold)';
        break;
      case 'ROUND_OVER':
        bannerPhaseText.textContent = 'ROUND OVER';
        bannerPhaseText.style.color = 'var(--squid-pink)';
        break;
      case 'LOBBY':
      default:
        bannerPhaseText.textContent = 'LOBBY';
        bannerPhaseText.style.color = 'var(--squid-pink)';
        bannerTimerText.textContent = 'Waiting to start';
        return;
    }

    if (durationMs > 0) {
      const updateTimer = () => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, durationMs - elapsed);
        const sec = (remaining / 1000).toFixed(1);
        bannerTimerText.textContent = `Time remaining: ${sec}s`;
        if (remaining <= 0) {
          clearInterval(countdownTimer);
        }
      };
      updateTimer();
      countdownTimer = setInterval(updateTimer, 100);
    } else {
      bannerTimerText.textContent = 'Manual mode / indefinite';
    }
  }

  function renderPlayerRoster(players) {
    if (!players || players.length === 0) {
      playerRoster.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 48px;">
          No players connected yet.<br>
          Direct players to <strong style="color: white;">/play</strong>
        </div>
      `;
      return;
    }

    playerRoster.innerHTML = '';
    for (const player of players) {
      const card = document.createElement('div');
      card.className = `player-card ${player.status.toLowerCase()}`;

      const elimTimeStr = player.eliminatedAt
        ? new Date(player.eliminatedAt).toLocaleTimeString()
        : null;

      card.innerHTML = `
        <div class="player-card-header">
          <span class="player-card-number">#${player.number}</span>
          <span class="player-badge-status ${player.status === 'ALIVE' ? 'badge-alive' : 'badge-eliminated'}">
            ${player.status}
          </span>
        </div>
        <div class="player-card-username">${escapeHtml(player.username)}</div>
        ${
          player.status === 'ELIMINATED'
            ? `<div style="font-size: 0.8rem; color: var(--squid-red);">
                Eliminated at ${elimTimeStr} ${player.eliminationDelta ? `(Δ ${player.eliminationDelta} m/s²)` : ''}
               </div>`
            : `<div style="font-size: 0.8rem; color: var(--squid-green);">Surviving in Arena</div>`
        }
        <div class="player-card-actions">
          ${
            player.status === 'ELIMINATED'
              ? `<button class="btn btn-secondary btn-sm" data-action="revive" data-id="${player.id}">Revive</button>`
              : `<button class="btn btn-secondary btn-sm" style="color: var(--squid-red);" data-action="eliminate" data-id="${player.id}">Eliminate</button>`
          }
          <button class="btn btn-secondary btn-sm" style="opacity: 0.7;" data-action="kick" data-id="${player.id}">Kick</button>
        </div>
      `;

      playerRoster.appendChild(card);
    }

    // Attach button listeners
    playerRoster.querySelectorAll('button[data-action]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const action = e.currentTarget.getAttribute('data-action');
        const id = e.currentTarget.getAttribute('data-id');

        if (action === 'revive') {
          sendAdminAction({ type: 'ADMIN_REVIVE', playerId: id });
        } else if (action === 'eliminate') {
          sendAdminAction({ type: 'ADMIN_ELIMINATE', playerId: id });
        } else if (action === 'kick') {
          if (confirm('Are you sure you want to kick this player?')) {
            sendAdminAction({ type: 'ADMIN_KICK', playerId: id });
          }
        }
      });
    });
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function sendAdminAction(message) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  // Audio Toggle
  adminAudioToggle.addEventListener('click', () => {
    initAudio();
  });

  // Action Buttons
  btnStartGame.addEventListener('click', () => {
    initAudio();
    sendAdminAction({ type: 'ADMIN_START' });
  });

  btnForceGreen.addEventListener('click', () => {
    initAudio();
    sendAdminAction({ type: 'ADMIN_SET_PHASE', phase: 'GREEN_LIGHT' });
  });

  btnForceRed.addEventListener('click', () => {
    initAudio();
    sendAdminAction({ type: 'ADMIN_SET_PHASE', phase: 'RED_LIGHT' });
  });

  btnResetGame.addEventListener('click', () => {
    if (confirm('Reset round and revive all players?')) {
      sendAdminAction({ type: 'ADMIN_RESET' });
    }
  });

  // Mode Select change
  selectMode.addEventListener('change', (e) => {
    sendAdminAction({ type: 'ADMIN_SET_MODE', mode: e.target.value });
  });

  // Config Form
  configForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const config = {
      minGreen: parseFloat(inputMinGreen.value),
      maxGreen: parseFloat(inputMaxGreen.value),
      minRed: parseFloat(inputMinRed.value),
      maxRed: parseFloat(inputMaxRed.value),
      gracePeriodMs: parseInt(inputGrace.value, 10),
      motionThreshold: parseFloat(inputThreshold.value),
    };
    sendAdminAction({ type: 'ADMIN_UPDATE_CONFIG', config });
    alert('Configurations applied!');
  });

  // Start connection
  connect();
})();
