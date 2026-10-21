# Squid Game TV advertisement

A standalone, dependency-free static website. Designed for a landscape 16:9 TV. Other aspect ratios preserve the landscape composition with letterboxing. No scrolling. No external fonts, assets, or services.

## Preview

From this directory:

```sh
bun run dev
```

Open http://localhost:4173. Move the pointer to reveal the fullscreen button, or use browser fullscreen. The page also works by opening index.html directly.

## Static export

```sh
bun run build
```

Upload the contents of `dist/` to any static host. No Bun or server is needed for the exported site. Relative asset URLs support subdirectory hosting.

## Set up your event

Edit `config.js`:

- `eventDate`: exact start date and time, including timezone, such as `2026-11-01T15:30:00+01:00`. The example is not the event date. Until configured, countdown displays dashes; after the event starts it stops at zero.
- `games`: confirmed game names. Current names are draft copy.
- `photos`: add 3:4 images to `assets/`, then list objects such as `{ src: 'assets/photo-1.jpg', alt: 'Event participants' }`. One portrait appears at a time. Photos fill the portrait panel with center cropping; missing images leave the decorative placeholder visible.
- `qrImage`: local registration QR image path, such as `'assets/registration-qr.png'`. Use an image with a white quiet zone. No invented QR is displayed while this is pending.
- `registrationUrl`: optional destination for clicking the QR.
- `questions`, `eventNote`, `slideDuration`: edit the looping text, footer and rotation interval.

Outdoor activities are advertised at 3:30 PM. Change the time in index.html if needed. Keep game names short for TV legibility.

The original game application outside this directory is independent of this advertisement.
