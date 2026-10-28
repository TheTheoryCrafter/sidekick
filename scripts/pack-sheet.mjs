// Packs horizontal animation strips into one sprite sheet, one row per animation.
//   node scripts/pack-sheet.mjs <out.png> <frameW>x<frameH> name=strip.png [name=strip.png ...]
// Trailing blank frames are dropped. Prints the `animations` block for the manifest.
import { readPng, writePng, bounds } from './lib/png.mjs';

const [out, size, ...pairs] = process.argv.slice(2);
if (!out || !/^\d+x\d+$/.test(size ?? '') || !pairs.length) {
  console.error('usage: node scripts/pack-sheet.mjs <out.png> <frameW>x<frameH> name=strip.png ...');
  process.exit(1);
}
const [fw, fh] = size.split('x').map(Number);
const rows = pairs.map((p) => {
  const i = p.indexOf('=');
  const img = readPng(p.slice(i + 1));
  if (img.h !== fh || img.w % fw) throw new Error(`${p}: ${img.w}x${img.h} is not a strip of ${fw}x${fh} frames`);
  let frames = img.w / fw;
  while (frames > 0 && !bounds(img, (frames - 1) * fw, 0, fw, fh)) frames--;
  if (!frames) throw new Error(`${p}: every frame is blank`);
  return { name: p.slice(0, i), img, frames };
});
const w = Math.max(...rows.map((r) => r.frames)) * fw, h = rows.length * fh;
const data = Buffer.alloc(w * h * 4);
rows.forEach((r, row) => {
  for (let y = 0; y < fh; y++) r.img.data.copy(data, ((row * fh + y) * w) * 4, y * r.img.w * 4, (y * r.img.w + r.frames * fw) * 4);
});
writePng(out, { w, h, data });
const anims = Object.fromEntries(rows.map((r, row) => [r.name, { row, frames: r.frames }]));
console.log(JSON.stringify({ sheetSize: [w, h], animations: anims }));
