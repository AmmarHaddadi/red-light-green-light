import { resolve, sep } from 'node:path';
const root = import.meta.dir;
const server = Bun.serve({
  port: Number(process.env.PORT) || 4173,
  async fetch(request) {
    let pathname: string;
    try { pathname = decodeURIComponent(new URL(request.url).pathname); }
    catch { return new Response('Bad request', { status: 400 }); }
    const path = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!path.startsWith(root + sep) || !/\.(html|css|js|png|jpe?g|webp|avif|svg|woff2?)$/i.test(path)) return new Response('Not found', { status: 404 });
    const file = Bun.file(path);
    return await file.exists() ? new Response(file) : new Response('Not found', { status: 404 });
  }
});
console.log(`Event advertisement: ${server.url}`);
