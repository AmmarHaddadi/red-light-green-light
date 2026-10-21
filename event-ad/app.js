(() => {
  const config = window.EVENT_CONFIG || {};
  const $ = id => document.getElementById(id);
  const duration = Math.max(3000, Number(config.slideDuration) || 6000);
  const games = config.games?.length ? config.games : ['GAME LINEUP COMING SOON'];
  const questions = config.questions?.length ? config.questions : ['WILL YOU PLAY?'];
  document.documentElement.style.setProperty('--slide-duration', `${duration}ms`);
  $('event-note').textContent = config.eventNote || '100 PLAYERS · COUNTLESS MEMORIES';
  let index = 0;
  let transitioning = false;
  function swap(element, text) {
    element.className = 'swap-out';
    setTimeout(() => {
      element.textContent = text;
      element.className = 'swap-in';
    }, 300);
  }
  const bars = games.map(() => {
    const bar = document.createElement('span');
    $('game-progress').append(bar);
    return bar;
  });
  function showGame(animate) {
    const game = index % games.length;
    if (animate) swap($('game-name'), games[game]);
    else $('game-name').textContent = games[game];
    $('game-position').textContent = `${String(game + 1).padStart(2, '0')} / ${String(games.length).padStart(2, '0')}`;
    bars.forEach((bar, i) => { bar.className = i === game ? 'current' : ''; });
  }
  const photos = Array.isArray(config.photos) ? config.photos : [];
  const images = [];
  let photoIndex = 0;
  photos.forEach(photo => {
    const image = new Image();
    image.alt = photo.alt || 'Squid Game event';
    image.onload = () => {
      images.push(image);
      $('photo-stage').append(image);
      if (images.length === 1) showPhoto();
    };
    image.src = photo.src;
  });
  function showPhoto() {
    if (!images.length) return;
    $('photo-placeholder').hidden = true;
    $('photo-placeholder').style.display = 'none';
    images.forEach((image, i) => image.classList.toggle('active', i === photoIndex % images.length));
    $('photo-count').textContent = `${String(photoIndex % images.length + 1).padStart(2, '0')} / ${String(images.length).padStart(2, '0')}`;
  }
  if (config.qrImage) {
    const qr = $('qr');
    qr.onload = () => {
      qr.hidden = false;
      $('qr-placeholder').style.display = 'none';
      $('qr-caption').textContent = 'Scan to register. Join the game.';
      if (config.registrationUrl && /^https?:\/\//i.test(config.registrationUrl)) {
        const link = document.createElement('a');
        link.href = config.registrationUrl;
        link.setAttribute('aria-label', 'Register for the event');
        qr.replaceWith(link);
        link.append(qr);
      }
    };
    qr.src = config.qrImage;
  }
  const target = config.eventDate ? new Date(config.eventDate).getTime() : NaN;
  function tick() {
    if (!Number.isFinite(target)) return;
    const remaining = Math.max(0, Math.floor((target - Date.now()) / 1000));
    $('countdown-label').textContent = remaining > 0 ? 'THE GAMES BEGIN IN' : 'IT’S TIME. LET’S PLAY.';
    const values = [Math.floor(remaining / 86400), Math.floor(remaining / 3600) % 24, Math.floor(remaining / 60) % 60, remaining % 60];
    ['days', 'hours', 'minutes', 'seconds'].forEach((id, i) => { $(id).textContent = String(values[i]).padStart(2, '0'); });
  }
  showGame(false);
  $('question').textContent = questions[0];
  tick();
  setInterval(tick, 1000);
  setInterval(() => {
    if (document.hidden || transitioning) return;
    transitioning = true;
    index++;
    showGame(true);
    swap($('question'), questions[index % questions.length]);
    photoIndex++;
    showPhoto();
    setTimeout(() => { transitioning = false; }, 750);
  }, duration);
  let controlTimer;
  document.addEventListener('pointermove', () => {
    document.body.classList.add('controls-visible');
    clearTimeout(controlTimer);
    controlTimer = setTimeout(() => document.body.classList.remove('controls-visible'), 2000);
  });
  $('fullscreen').addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch { $('fullscreen').textContent = 'Use your browser’s fullscreen command'; }
  });
})();
