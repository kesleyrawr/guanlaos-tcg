import { mkdir, rm, copyFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const out = resolve(root, 'dist');

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

for (const file of ['index.html', 'styles.css', 'app.js']) {
  await copyFile(resolve(root, file), resolve(out, file));
}

await writeFile(resolve(out, '_headers'), `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n`);

console.log('Built GUANLAO\'S TCG Collector into dist/');
