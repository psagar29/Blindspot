// Renders docs/media/blindspot-header.gif from scene.html.
//   node scripts/header-animation/render.mjs
// Frames are captured deterministically (the page renders a given t, never a clock),
// so re-running produces the same GIF. Needs playwright + ffmpeg on PATH.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdirSync, rmSync, existsSync, readFileSync} from 'node:fs';
import http from 'node:http';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

// PLAYWRIGHT_PATH lets you point at an existing install instead of adding a dependency.
const {chromium} = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || 'playwright');

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
const out = path.join(repo, 'docs/media');
const tmp = path.join(here, '.frames');
const FPS = 10, SECONDS = 9.0;

rmSync(tmp, {recursive: true, force: true});
mkdirSync(tmp, {recursive: true});
mkdirSync(out, {recursive: true});

// file:// blocks the loader's fetch of the collider, so serve the folder over loopback
const MIME = {'.html': 'text/html', '.json': 'application/json',
  '.glb': 'model/gltf-binary', '.webp': 'image/webp', '.png': 'image/png'};
const server = http.createServer((req, res) => {
  const f = path.join(here, decodeURIComponent(req.url.split('?')[0]));
  try {
    res.setHeader('content-type', MIME[path.extname(f)] || 'application/octet-stream');
    res.end(readFileSync(f));
  } catch { res.statusCode = 404; res.end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = 'http://127.0.0.1:' + server.address().port;

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({viewport: {width: 960, height: 431}, deviceScaleFactor: 1});
page.on('pageerror', e => console.error('page error:', e.message));
await page.goto(base + '/' + (process.env.PAGE || 'scene.html'));
await page.waitForFunction('window.ready === true', null, {timeout: 60000});
await page.waitForTimeout(1500); // webfonts

const total = Math.round(FPS * SECONDS);
let last;
for (let i = 0; i < total; i++) {
  last = await page.evaluate(t => window.renderFrame(t), i / FPS);
  await page.screenshot({path: path.join(tmp, String(i).padStart(4, '0') + '.png')});
}
console.log('final state:', last);
// the run has to actually reproduce the blind spot, or the header is just a cartoon
assert(Math.abs(last.fx - 160 / (2 * Math.tan(78 * Math.PI / 360))) < 1e-6,
  'fx must be derived from the declared raster width, not a display size');
assert(last.detected !== null && last.detected < last.dStop,
  'first detection must fall inside the required stopping distance');
await browser.close();
server.close();

const gif = path.join(out, 'blindspot-header.gif');
const pal = path.join(tmp, 'pal.png');
const src = path.join(tmp, '%04d.png');
execFileSync('ffmpeg', ['-y', '-v', 'error', '-framerate', String(FPS), '-i', src,
  '-vf', 'palettegen=max_colors=72:stats_mode=diff', pal]);
execFileSync('ffmpeg', ['-y', '-v', 'error', '-framerate', String(FPS), '-i', src, '-i', pal,
  '-lavfi', 'paletteuse=dither=none:diff_mode=rectangle', '-loop', '0', gif]);
if (!process.env.KEEP_FRAMES) rmSync(tmp, {recursive: true, force: true});
console.log('wrote', gif, existsSync(gif));
