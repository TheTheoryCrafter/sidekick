import { init, type SidekickEvent } from '../src/index';

const $ = (id: string) => document.getElementById(id)!;
const pet = init({ scale: 2, persist: false })!;
const lines: string[] = [];
let clicks = 0;

function describe(e: SidekickEvent): string {
  switch (e.type) {
    case 'action-start': return `▶ ${e.action}${e.rule ? `  (rule ${e.rule})` : ''}`;
    case 'action-end': return `■ ${e.action}${e.interrupted ? '  interrupted' : ''}`;
    case 'emit': return `✦ ${e.action} emitted "${e.name}"`;
    case 'event': return `⚡ ${e.name}${e.payload ? ` ${JSON.stringify(e.payload)}` : ''} → ${e.rule ? `rule ${e.rule}` : 'no rule'}`;
  }
}

pet.on((e) => {
  // Free-time choices are noise here; show what the visitor causes.
  if (e.type === 'action-end' && !e.interrupted) return;
  lines.unshift(`${(pet.debug().simTime / 1000).toFixed(1).padStart(6)}s  ${describe(e)}`);
  lines.length = Math.min(lines.length, 100);
  $('log').textContent = lines.join('\n');
});

$('btn').onclick = () => { $('clicks').textContent = `Page button clicks: ${++clicks}`; };
($('scale') as HTMLSelectElement).onchange = (e) => pet.setScale(Number((e.target as HTMLSelectElement).value));

setInterval(() => {
  const d = pet.debug();
  $('status').textContent = `${d.mode ?? '-'} · ${d.action ?? '-'} · anim ${d.anim ?? '-'} · x ${d.x ?? '-'} y ${d.y ?? '-'} · cursor near: ${d.cursorNear ? 'yes' : 'no'}`;
}, 150);
