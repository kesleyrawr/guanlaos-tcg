import { mkdir, rm, copyFile, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const out = resolve(root, 'dist');

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

for (const file of ['styles.css', 'retro-polish.css', 'app.js', 'api-hook.js']) {
  await copyFile(resolve(root, file), resolve(out, file));
}

const index = await readFile(resolve(root, 'index.html'), 'utf8');
const builtIndex = index.replace(
  '<script type="module" src="./app.js"></script>',
  '<script src="./api-hook.js"></script>\n  <script type="module" src="./app.js"></script>'
);
await writeFile(resolve(out, 'index.html'), builtIndex);

await writeFile(resolve(out, '_headers'), `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n`);

console.log('Built GUANLAO\'S TCG Collector into dist/');
