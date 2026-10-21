import { cp, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
const root = import.meta.dir;
const output = join(root, 'dist');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const name of ['index.html', 'styles.css', 'config.js', 'app.js', 'assets']) {
  await cp(join(root, name), join(output, name), { recursive: true });
}
console.log('Static export ready in event-ad/dist');
