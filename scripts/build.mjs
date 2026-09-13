import { mkdir, rm, copyFile, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const out = resolve(root, 'dist');
const assets = ['styles.css', 'retro-polish.css', 'app.js', 'api-hook.js', 'collection-edit.js', 'dashboard-cleanup.js', 'ui-cleanup.js'];

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

for (const file of assets) {
  await copyFile(resolve(root, file), resolve(out, file));
}

const index = await readFile(resolve(root, 'index.html'), 'utf8');
const marker = '<script type="module" src="./app.js"></script>';
const extras = [
  '<script src="./api-hook.js"></script>',
  marker,
  '<script src="./collection-edit.js"></script>',
  '<script src="./dashboard-cleanup.js"></script>',
  '<script src="./ui-cleanup.js"></script>'
].join('\n  ');
const builtIndex = index.replace(marker, extras);
await writeFile(resolve(out, 'index.html'), builtIndex);

await writeFile(resolve(out, '_headers'), `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n`);

console.log('Built GUANLAO\'S TCG Collector into dist/');
