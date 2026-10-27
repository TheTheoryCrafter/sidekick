import { init } from '../src/index';

const $ = (id: string) => document.getElementById(id)!;
const pet = init({ scale: 2 })!;
const lines = new Map<number, HTMLDivElement>();

$('jump').onclick = () => pet.play('jump');
($('jumpy') as HTMLInputElement).onchange = (e) => {
  const on = (e.target as HTMLInputElement).checked;
  pet.registerRule({ id: 'jump', on: 'idle', chance: on ? 1 : 0.5, scaleBy: on ? undefined : 'jumpiness', cooldown: on ? 0 : 6000, priority: 35, action: 'jump' });
};

function drawOverlay() {
  const show = ($('show') as HTMLInputElement).checked;
  const { surfaces, on } = pet.debugSurfaces();
  const seen = new Set<number>();
  if (show) {
    for (const s of surfaces) {
      seen.add(s.id);
      let el = lines.get(s.id);
      if (!el) {
        el = document.createElement('div');
        el.className = 'overlay';
        document.body.append(el);
        lines.set(s.id, el);
      }
      el.style.left = `${s.left}px`;
      el.style.width = `${s.right - s.left}px`;
      el.style.top = `${s.top - 1}px`;
      el.classList.toggle('on', s.id === on);
    }
  }
  for (const [id, el] of lines) if (!seen.has(id)) { el.remove(); lines.delete(id); }

  const d = pet.debug();
  $('status').textContent = `${d.mode ?? '-'} · ${d.action ?? '-'} · anim ${d.anim ?? '-'} · standing on ${on === null ? 'the floor' : `surface #${on}`} · ${surfaces.length} surfaces in view`;
  requestAnimationFrame(drawOverlay);
}
requestAnimationFrame(drawOverlay);
