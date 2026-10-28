// Milestone 0 demo: shows every animation of a pet, how its roles resolve,
// and flags frames that are blank on the sheet. Demo code, not shipped.

import { validateManifest, type AnimationDef, type PetManifest } from '../src/core/manifest';
import { ROLE_FALLBACKS, ROLES_WITHOUT_DEFAULT, hasOwnRole, roleCandidates } from '../src/core/roles';
import { animationDuration, frameAt, frameRect } from '../src/core/sprite';

const PETS = ['cream-cat'];
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, ...kids: (Node | string)[]) => {
  const n = Object.assign(document.createElement(tag), props);
  n.append(...kids);
  return n;
};

interface Ctx { m: PetManifest; sheetUrl: string; sheetW: number; sheetH: number; blank: Map<string, number[]> }
interface Player { anim: AnimationDef; sprite: HTMLDivElement; cells: HTMLDivElement[]; start: number; last: number }

let players: Player[] = [];
let ctx: Ctx | null = null;

const scale = () => Number($<HTMLSelectElement>('scale').value);

function paint(div: HTMLDivElement, c: Ctx, anim: AnimationDef, frame: number, s: number, flip: boolean) {
  const r = frameRect(c.m, anim, frame);
  const st = div.style;
  st.width = `${r.w * s}px`;
  st.height = `${r.h * s}px`;
  st.backgroundImage = `url("${c.sheetUrl}")`;
  st.backgroundRepeat = 'no-repeat';
  st.backgroundSize = `${c.sheetW * s}px ${c.sheetH * s}px`;
  st.backgroundPosition = `${-r.x * s}px ${-r.y * s}px`;
  st.imageRendering = 'pixelated';
  st.transform = flip ? 'scaleX(-1)' : '';
}

/** Frames whose pixels are all transparent, per animation. */
function findBlankFrames(img: HTMLImageElement, m: PetManifest): Map<string, number[]> {
  const cv = document.createElement('canvas');
  cv.width = img.naturalWidth;
  cv.height = img.naturalHeight;
  const g = cv.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(img, 0, 0);
  const out = new Map<string, number[]>();
  for (const [name, a] of Object.entries(m.animations)) {
    const blanks: number[] = [];
    for (let i = 0; i < a.frames; i++) {
      const r = frameRect(m, a, i);
      const px = g.getImageData(r.x, r.y, r.w, r.h).data;
      let any = false;
      for (let k = 3; k < px.length; k += 4) if (px[k]! > 0) { any = true; break; }
      if (!any) blanks.push(i);
    }
    if (blanks.length) out.set(name, blanks);
  }
  return out;
}

async function load(petId: string) {
  const base = `/pets/${petId}/`;
  const url = `${base}manifest.json`;
  const res = await fetch(url);
  const text = res.ok ? await res.text() : '';
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error(`couldn't read ${url}. Does pets/${petId}/manifest.json exist and contain valid JSON?`);
  }
  const v = validateManifest(raw);
  const summary = $('summary');
  summary.replaceChildren();
  const list = el('ul', { className: 'msgs' });
  v.errors.forEach((e) => list.append(el('li', { className: 'err' }, `Error: ${e}`)));
  v.warnings.forEach((w) => list.append(el('li', { className: 'warn' }, `Warning: ${w}`)));
  if (!v.manifest) { summary.append(el('h2', {}, 'Manifest rejected'), list); return; }

  const m = v.manifest;
  const img = new Image();
  img.src = base + m.sheet;
  await img.decode();
  const blank = findBlankFrames(img, m);
  ctx = { m, sheetUrl: img.src, sheetW: img.naturalWidth, sheetH: img.naturalHeight, blank };

  if (m.sheetSize && (m.sheetSize[0] !== img.naturalWidth || m.sheetSize[1] !== img.naturalHeight)) {
    list.append(el('li', { className: 'warn' }, `Warning: manifest says the sheet is ${m.sheetSize.join('×')} but the image is ${img.naturalWidth}×${img.naturalHeight}.`));
  }
  for (const [name, frames] of blank) {
    list.append(el('li', { className: 'warn' }, `Warning: "${name}" frame${frames.length > 1 ? 's' : ''} ${frames.join(', ')} ${frames.length > 1 ? 'are' : 'is'} blank on the sheet.`));
  }
  if (!list.children.length) list.append(el('li', { className: 'ok' }, 'Manifest valid, no warnings.'));
  summary.append(
    el('h2', {}, `${m.name} (${m.id})`),
    el('div', {}, `Frame ${m.frameSize.join('×')} · sheet ${img.naturalWidth}×${img.naturalHeight} · anchor ${m.anchor.join(', ')} · facing ${m.facing} · traits ${JSON.stringify(m.traits)}`),
    list,
  );

  renderRoles(m);
  renderAnims();
}

function renderRoles(m: PetManifest) {
  const roles = [...new Set([...Object.keys(m.roles), ...Object.keys(ROLE_FALLBACKS), ...ROLES_WITHOUT_DEFAULT])];
  const rows = roles.map((role) => {
    const c = roleCandidates(m, role);
    const own = hasOwnRole(m, role);
    const cell = el('td');
    if (!c.length) cell.append(el('span', { className: 'tag none' }, 'none'));
    c.forEach((n) => cell.append(el('span', { className: own ? 'tag' : 'tag fb' }, n)));
    return el('tr', {}, el('td', {}, role), cell, el('td', {}, own ? 'pet' : c.length ? 'fallback' : '—'));
  });
  $('roles').replaceChildren(el('table', {}, el('tr', {}, el('th', {}, 'Role'), el('th', {}, 'Animation(s)'), el('th', {}, 'Source')), ...rows));
}

function renderAnims() {
  if (!ctx) return;
  const c = ctx;
  const s = scale();
  const flip = $<HTMLInputElement>('flip').checked;
  const showAnchor = $<HTMLInputElement>('anchor').checked;
  const usedBy = new Map<string, string[]>();
  for (const [role, v] of Object.entries(c.m.roles)) {
    for (const n of Array.isArray(v) ? v : [v]) usedBy.set(n, [...(usedBy.get(n) ?? []), role]);
  }

  players = [];
  const cards = Object.entries(c.m.animations).map(([name, anim]) => {
    const sprite = el('div');
    paint(sprite, c, anim, 0, s, flip);
    const stage = el('div', { className: 'stage' }, sprite);
    stage.style.minHeight = `${c.m.frameSize[1] * s + 16}px`;
    if (showAnchor) {
      const a = el('div', { className: 'anchor' });
      a.style.height = `${c.m.frameSize[1] * s + 16}px`;
      a.style.left = `calc(50% - ${(c.m.frameSize[0] / 2 - c.m.anchor[0]) * s * (flip ? -1 : 1)}px)`;
      a.style.bottom = '0';
      stage.append(a);
    }
    const blanks = c.blank.get(name) ?? [];
    const cells = Array.from({ length: anim.frames }, (_, i) => {
      const d = el('div', { title: `frame ${i}` });
      paint(d, c, anim, i, 1, flip);
      if (blanks.includes(i)) d.classList.add('empty');
      return d;
    });
    const roles = usedBy.get(name) ?? [];
    const card = el('div', { className: 'card' },
      el('h3', {}, name),
      el('div', { className: 'meta' },
        `${anim.label ?? ''}${anim.label ? ' · ' : ''}row ${anim.row} · ${anim.frames}f @ ${anim.fps}fps · ${anim.loop ? 'loops' : `once (${Math.round(animationDuration(anim))}ms)`}`),
      stage,
      el('div', { className: 'strip' }, ...cells),
      el('div', { className: 'meta' }, roles.length ? 'Roles: ' : 'No role', ...roles.map((r) => el('span', { className: 'tag' }, r))),
    );
    if (blanks.length) card.append(el('div', { className: 'note' }, `Blank frame(s): ${blanks.join(', ')}`));
    players.push({ anim, sprite, cells, start: performance.now(), last: -1 });
    return card;
  });
  $('anims').replaceChildren(...cards);
}

const ONCE_PAUSE_MS = 800;

function tick(now: number) {
  if (ctx) {
    const s = scale();
    const flip = $<HTMLInputElement>('flip').checked;
    for (const p of players) {
      let t = now - p.start;
      // Replay one-shot animations after a short pause so they can be inspected.
      if (!p.anim.loop && t > animationDuration(p.anim) + ONCE_PAUSE_MS) { p.start = now; t = 0; }
      const { frame } = frameAt(p.anim, t);
      if (frame !== p.last) {
        paint(p.sprite, ctx, p.anim, frame, s, flip);
        p.cells[p.last]?.classList.remove('current');
        p.cells[frame]?.classList.add('current');
        p.last = frame;
      }
    }
  }
  requestAnimationFrame(tick);
}

function setBg() {
  document.body.className = `bg-${$<HTMLSelectElement>('bg').value}`;
}

const petSelect = $<HTMLSelectElement>('pet');
// ?pet=<folder> shows any pet in pets/, so a new pet can be checked before it is listed.
const wanted = new URLSearchParams(location.search).get('pet');
if (wanted && !PETS.includes(wanted)) PETS.push(wanted);
PETS.forEach((p) => petSelect.append(el('option', { value: p }, p)));
petSelect.value = wanted ?? PETS[0]!;
petSelect.onchange = () => load(petSelect.value);
['scale', 'flip', 'anchor'].forEach((id) => ($(id).onchange = renderAnims));
$('bg').onchange = setBg;
setBg();
load(petSelect.value).catch((e) => { $('summary').textContent = `Failed to load: ${e}`; });
requestAnimationFrame(tick);
