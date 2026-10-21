// All assets are local. Use an ISO date with a timezone, e.g. 2026-11-01T15:30:00+01:00.
window.EVENT_CONFIG = {
  eventDate: '2026-10-21T16:00:00+01:00',
  // Event game lineup.
  games: ['RED LIGHT, GREEN LIGHT', 'FRISBEE', 'DODGE BALL', 'DARTS', 'POP THE BALLOON', 'BOUNCING BALL'],
  questions: ['WILL YOU PLAY?', 'MAKE YOUR MOVE.', 'DARE TO JOIN?'],
  // Event photos rotate one at a time.
  photos: [
    { src: 'assets/event-pics/IMG-20261021-WA0001.jpg', alt: 'Event photo 1' },
    { src: 'assets/event-pics/IMG-20261021-WA0005.jpg', alt: 'Event photo 2' }
  ],
  qrImage: 'assets/qr.svg',
  registrationUrl: null,
  eventNote: '100 PLAYERS · COUNTLESS MEMORIES',
  slideDuration: 6000
};
