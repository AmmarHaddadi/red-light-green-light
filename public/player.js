// Squid Game Player Client Logic
(() => {
  // Elements
  const joinScreen = document.getElementById('join-screen');
  const gameScreen = document.getElementById('game-screen');
  const eliminatedScreen = document.getElementById('eliminated-screen');
  const usernameInput = document.getElementById('username-input');
  const joinBtn = document.getElementById('join-btn');
  const joinError = document.getElementById('join-error');
  const motionTestVal = document.getElementById('motion-test-val');
  const motionTestFill = document.getElementById('motion-test-fill');

  const displayUsername = document.getElementById('display-username');
  const displayNumber = document.getElementById('display-number');
  const playerStatusBadge = document.getElementById('player-status-badge');
  const arenaCard = document.getElementById('arena-card');
  const phaseTitle = document.getElementById('phase-title');
  const phaseInstruction = document.getElementById('phase-instruction');
  const liveMotionVal = document.getElementById('live-motion-val');
  const liveMotionFill = document.getElementById('live-motion-fill');
  const elimPlayerTag = document.getElementById('elim-player-tag');
  const elimDeltaInfo = document.getElementById('elim-delta-info');
  const silenceAlarmBtn = document.getElementById('silence-alarm-btn');

  // State
  let ws = null;
  let currentPlayer = null;
  let currentPhase = 'LOBBY';
  let phaseStartTime = 0;
  let motionThreshold = 3.5;
  let gracePeriodMs = 250;
  let isEliminated = false;
  let motionListenerActive = false;

  // Accelerometer tracking
  let lastX = 0, lastY = 0, lastZ = 0;
  let hasLastCoords = false;

  // Web Audio Context
  let audioCtx = null;
  let alarmOsc1 = null;
  let alarmOsc2 = null;
  let alarmGain = null;
  let alarmInterval = null;

  // Init Audio Context on user gesture
  function initAudio() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContext();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  // Play short feedback beep
  function playBeep(freq = 440, duration = 0.15, type = 'sine') {
    if (!audioCtx) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }

  // Start continuous screeching elimination alarm
  function startAlarmSound() {
    initAudio();
    if (!audioCtx || alarmInterval) return;

    try {
      alarmGain = audioCtx.createGain();
      alarmGain.gain.setValueAtTime(0.4, audioCtx.currentTime);
      alarmGain.connect(audioCtx.destination);

      alarmOsc1 = audioCtx.createOscillator();
      alarmOsc2 = audioCtx.createOscillator();

      alarmOsc1.type = 'sawtooth';
      alarmOsc2.type = 'square';

      alarmOsc1.connect(alarmGain);
      alarmOsc2.connect(alarmGain);

      alarmOsc1.start();
      alarmOsc2.start();

      let toggle = false;
      alarmInterval = setInterval(() => {
        if (!audioCtx) return;
        const now = audioCtx.currentTime;
        if (toggle) {
          alarmOsc1.frequency.setValueAtTime(800, now);
          alarmOsc2.frequency.setValueAtTime(820, now);
        } else {
          alarmOsc1.frequency.setValueAtTime(1200, now);
          alarmOsc2.frequency.setValueAtTime(1240, now);
        }
        toggle = !toggle;
      }, 150);

      // Aggressive mobile vibration pattern
      if (navigator.vibrate) {
        navigator.vibrate([300, 100, 300, 100, 600]);
      }
    } catch (e) {
      console.warn('Alarm audio error:', e);
    }
  }

  function stopAlarmSound() {
    if (alarmInterval) {
      clearInterval(alarmInterval);
      alarmInterval = null;
    }
    if (alarmOsc1) {
      try { alarmOsc1.stop(); alarmOsc1.disconnect(); } catch (e) {}
      alarmOsc1 = null;
    }
    if (alarmOsc2) {
      try { alarmOsc2.stop(); alarmOsc2.disconnect(); } catch (e) {}
      alarmOsc2 = null;
    }
    if (navigator.vibrate) {
      navigator.vibrate(0);
    }
  }

  // Motion Detection Handler
  function handleDeviceMotion(event) {
    const acc = event.acceleration || event.accelerationIncludingGravity;
    if (!acc) return;

    const x = acc.x || 0;
    const y = acc.y || 0;
    const z = acc.z || 0;

    if (!hasLastCoords) {
      lastX = x;
      lastY = y;
      lastZ = z;
      hasLastCoords = true;
      return;
    }

    const dx = x - lastX;
    const dy = y - lastY;
    const dz = z - lastZ;

    lastX = x;
    lastY = y;
    lastZ = z;

    const delta = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const roundedDelta = Math.round(delta * 10) / 10;

    // Update calibration test bar if still on join screen
    if (joinScreen.style.display !== 'none') {
      motionTestVal.textContent = roundedDelta.toFixed(1);
      const testPercent = Math.min(100, (delta / motionThreshold) * 100);
      motionTestFill.style.width = `${testPercent}%`;
      if (testPercent >= 100) {
        motionTestFill.classList.add('danger');
      } else {
        motionTestFill.classList.remove('danger');
      }
      return;
    }

    // Update in-game live motion meter
    liveMotionVal.textContent = `${roundedDelta.toFixed(1)} m/s²`;
    const percent = Math.min(100, (delta / motionThreshold) * 100);
    liveMotionFill.style.width = `${percent}%`;
    if (percent >= 100) {
      liveMotionFill.classList.add('danger');
    } else {
      liveMotionFill.classList.remove('danger');
    }

    // Check motion violation during RED LIGHT
    if (currentPhase === 'RED_LIGHT' && !isEliminated && currentPlayer) {
      const elapsed = Date.now() - phaseStartTime;
      // Check grace period to prevent elimination on stop deceleration
      if (elapsed >= gracePeriodMs && delta >= motionThreshold) {
        triggerElimination(delta);
      }
    }
  }

  function triggerElimination(delta) {
    if (isEliminated) return;
    isEliminated = true;

    // Notify server immediately
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'MOTION_DETECTED',
        delta: delta,
      }));
    }

    showEliminationUI(delta);
  }

  function showEliminationUI(delta) {
    isEliminated = true;
    playerStatusBadge.textContent = 'ELIMINATED';
    playerStatusBadge.className = 'player-badge-status badge-eliminated';

    elimPlayerTag.textContent = currentPlayer ? `PLAYER #${currentPlayer.number}` : 'PLAYER';
    if (delta) {
      elimDeltaInfo.textContent = `Movement detected during Red Light! (${delta.toFixed(1)} m/s²)`;
    } else {
      elimDeltaInfo.textContent = `Eliminated by Front Man!`;
    }

    eliminatedScreen.style.display = 'flex';
    startAlarmSound();
  }

  function hideEliminationUI() {
    isEliminated = false;
    eliminatedScreen.style.display = 'none';
    stopAlarmSound();
    playerStatusBadge.textContent = 'ALIVE';
    playerStatusBadge.className = 'player-badge-status badge-alive';
  }

  // Request DeviceMotion permissions (iOS 13+)
  async function enableMotionSensors() {
    if (motionListenerActive) return true;

    if (
      typeof DeviceMotionEvent !== 'undefined' &&
      typeof DeviceMotionEvent.requestPermission === 'function'
    ) {
      try {
        const response = await DeviceMotionEvent.requestPermission();
        if (response === 'granted') {
          window.addEventListener('devicemotion', handleDeviceMotion, { passive: true });
          motionListenerActive = true;
          return true;
        } else {
          alert('Motion sensor permission was denied. You will not be able to play.');
          return false;
        }
      } catch (err) {
        console.error('DeviceMotion permission error:', err);
        return false;
      }
    } else {
      // Non-iOS or older browser
      window.addEventListener('devicemotion', handleDeviceMotion, { passive: true });
      motionListenerActive = true;
      return true;
    }
  }

  // Update UI for Game Phase
  function updatePhaseUI(phase) {
    currentPhase = phase;
    arenaCard.className = 'arena-box';

    switch (phase) {
      case 'GREEN_LIGHT':
        arenaCard.classList.add('phase-green');
        phaseTitle.textContent = 'GREEN LIGHT';
        phaseInstruction.textContent = 'RUN! MOVEMENT ALLOWED';
        playBeep(587.33, 0.2, 'sine'); // D5
        break;

      case 'RED_LIGHT':
        arenaCard.classList.add('phase-red');
        phaseTitle.textContent = 'RED LIGHT';
        phaseInstruction.textContent = 'FREEZE! DO NOT MOVE';
        playBeep(220, 0.3, 'sawtooth'); // A3 warning buzz
        if (navigator.vibrate) navigator.vibrate(150);
        break;

      case 'STARTING':
        phaseTitle.textContent = 'GET READY';
        phaseInstruction.textContent = 'Game is starting in 3 seconds...';
        playBeep(440, 0.1, 'sine');
        break;

      case 'ROUND_OVER':
        phaseTitle.textContent = 'ROUND OVER';
        phaseInstruction.textContent = 'Wait for next round...';
        break;

      case 'LOBBY':
      default:
        phaseTitle.textContent = 'LOBBY';
        phaseInstruction.textContent = 'Waiting for Front Man to start...';
        break;
    }
  }

  // Setup WebSocket
  function connectWebSocket(username) {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${location.host}/ws`);

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'JOIN',
        username: username,
      }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        switch (msg.type) {
          case 'JOIN_SUCCESS': {
            currentPlayer = msg.player;
            sessionStorage.setItem('squid_username', msg.player.username);
            displayUsername.textContent = msg.player.username;
            displayNumber.textContent = `#${msg.player.number}`;

            joinScreen.style.display = 'none';
            gameScreen.style.display = 'flex';

            if (msg.state) {
              motionThreshold = msg.state.config.motionThreshold;
              gracePeriodMs = msg.state.config.gracePeriodMs;
              phaseStartTime = msg.state.phaseStartTime;
              updatePhaseUI(msg.state.phase);

              if (currentPlayer.status === 'ELIMINATED') {
                showEliminationUI();
              }
            }
            break;
          }

          case 'JOIN_ERROR': {
            joinError.textContent = msg.message;
            joinError.style.display = 'block';
            joinBtn.disabled = false;
            joinBtn.textContent = '⚡ Calibrate & Enter';
            break;
          }

          case 'PHASE_CHANGE': {
            phaseStartTime = msg.timestamp;
            updatePhaseUI(msg.phase);
            break;
          }

          case 'STATE_UPDATE': {
            motionThreshold = msg.state.config.motionThreshold;
            gracePeriodMs = msg.state.config.gracePeriodMs;

            if (currentPlayer) {
              const updated = msg.state.players.find(p => p.id === currentPlayer.id);
              if (updated) {
                currentPlayer = updated;
                if (updated.status === 'ELIMINATED' && !isEliminated) {
                  showEliminationUI(updated.eliminationDelta);
                } else if (updated.status === 'ALIVE' && isEliminated) {
                  hideEliminationUI();
                }
              }
            }
            break;
          }

          case 'PLAYER_ELIMINATED': {
            if (currentPlayer && msg.player.id === currentPlayer.id) {
              showEliminationUI(msg.player.eliminationDelta);
            }
            break;
          }

          case 'PLAYER_REVIVED': {
            if (currentPlayer && msg.player.id === currentPlayer.id) {
              hideEliminationUI();
            }
            break;
          }

          case 'PLAYER_KICKED': {
            if (currentPlayer && msg.playerId === currentPlayer.id) {
              stopAlarmSound();
              sessionStorage.removeItem('squid_username');
              alert('You have been kicked by the Front Man.');
              location.reload();
            }
            break;
          }
        }
      } catch (err) {
        console.error('Error parsing WS message:', err);
      }
    };

    ws.onclose = () => {
      console.warn('WebSocket closed. Attempting reconnect in 2s...');
      setTimeout(() => {
        if (currentPlayer) {
          connectWebSocket(currentPlayer.username);
        }
      }, 2000);
    };
  }

  // Join Button handler
  joinBtn.addEventListener('click', async () => {
    const username = usernameInput.value.trim();
    if (!username) {
      joinError.textContent = 'Please enter a username.';
      joinError.style.display = 'block';
      return;
    }

    joinError.style.display = 'none';
    joinBtn.disabled = true;
    joinBtn.textContent = 'Calibrating Sensors...';

    // Unlock audio and motion
    initAudio();
    await enableMotionSensors();

    // Connect
    connectWebSocket(username);
  });

  // Enter key in input
  usernameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      joinBtn.click();
    }
  });

  // Silence Alarm Button
  silenceAlarmBtn.addEventListener('click', () => {
    stopAlarmSound();
    silenceAlarmBtn.textContent = 'Alarm Silenced';
    silenceAlarmBtn.disabled = true;
  });

  // Check saved session
  const savedUsername = sessionStorage.getItem('squid_username');
  if (savedUsername) {
    usernameInput.value = savedUsername;
  }

  // Try passive motion detection for initial meter preview
  window.addEventListener('devicemotion', handleDeviceMotion, { passive: true });
})();
