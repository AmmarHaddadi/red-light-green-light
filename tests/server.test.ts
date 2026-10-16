import { describe, expect, it } from 'bun:test';

describe('Server & Endpoints', () => {
  it('serves static html files', async () => {
    // Check that public files exist and have non-zero length
    const indexFile = Bun.file('public/index.html');
    const playFile = Bun.file('public/play.html');
    const adminFile = Bun.file('public/admin.html');
    const cssFile = Bun.file('public/style.css');

    expect(await indexFile.exists()).toBe(true);
    expect(await playFile.exists()).toBe(true);
    expect(await adminFile.exists()).toBe(true);
    expect(await cssFile.exists()).toBe(true);

    const indexText = await indexFile.text();
    expect(indexText).toContain('Squid Game');
    expect(indexText).toContain('/play');
    expect(indexText).toContain('/admin');
  });
});
