// Renders the favicon/app icons and the Open Graph image from the HTML templates in this folder.
// Usage: pnpm build && node scripts/images/generate.mjs   (needs `playwright` + Python Pillow for favicon.ico)
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../..');
const out = join(root, 'out');
const app = join(root, 'src/app');
const tmp = join(out, '__images');

// Reuse the built site's fonts: same stylesheet and the font-variable classes from <html>.
const index = readFileSync(join(out, 'index.html'), 'utf8');
const css = [...index.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map((m) => m[1]);
const htmlClass = index.match(/<html[^>]*class="([^"]+)"/)[1];
const head = css.map((href) => `<link rel="stylesheet" href="${href}" />`).join('');

mkdirSync(tmp, { recursive: true });
for (const f of ['og.html', 'icon.html', 'templates.js', 'avatar.jpg']) {
  let body = readFileSync(join(here, f));
  if (f.endsWith('.html'))
    body = body.toString().replace('<!--HEAD-->', head).replace('<html>', `<html class="${htmlClass}">`);
  writeFileSync(join(tmp, f), body);
}

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.jpg': 'image/jpeg' };
const server = createServer((req, res) => {
  try {
    const file = join(out, decodeURIComponent(req.url.split('?')[0]));
    res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
    res.end(readFileSync(file));
  } catch {
    res.writeHead(404).end();
  }
}).listen(0);
const base = `http://localhost:${server.address().port}/__images`;

const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {},
);
const shot = async (page, size, path, opts = {}) => {
  const p = await browser.newPage({ viewport: size, deviceScaleFactor: opts.scale ?? 1 });
  await p.goto(`${base}/${page}`);
  if (opts.radius !== undefined) await p.addStyleTag({ content: `:root{--radius:${opts.radius}px}` });
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path, omitBackground: true });
  await p.close();
};

await shot('og.html', { width: 1200, height: 630 }, join(app, 'opengraph-image.png'));
copyFileSync(join(app, 'opengraph-image.png'), join(app, 'twitter-image.png'));
await shot('icon.html', { width: 512, height: 512 }, join(app, 'icon.png'));
await shot('icon.html', { width: 512, height: 512 }, join(root, 'public/icon-maskable.png'), { radius: 0 });
await shot('icon.html', { width: 512, height: 512 }, join(tmp, 'apple.png'), { radius: 0 });

await browser.close();
server.close();

// Downscale with Pillow: apple-icon 180, manifest 192, multi-size favicon.ico.
execFileSync('python3', [
  '-c',
  `from PIL import Image
icon = Image.open(${JSON.stringify(join(app, 'icon.png'))})
Image.open(${JSON.stringify(join(tmp, 'apple.png'))}).convert('RGB').resize((180, 180), Image.LANCZOS).save(${JSON.stringify(join(app, 'apple-icon.png'))})
icon.resize((192, 192), Image.LANCZOS).save(${JSON.stringify(join(root, 'public/icon-192.png'))})
icon.save(${JSON.stringify(join(app, 'favicon.ico'))}, sizes=[(16, 16), (32, 32), (48, 48)])`,
]);
rmSync(tmp, { recursive: true });
console.log('images generated');
