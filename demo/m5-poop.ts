import { init } from '../src/index';

const $ = (id: string) => document.getElementById(id)!;
const ttl = Number(new URLSearchParams(location.search).get('ttl')) || undefined;
const pet = init({ scale: 2, poop: { ttl }, persist: false })!;
const lines: string[] = [];

const log = (msg: string) => {
  lines.unshift(`${(pet.debug().simTime / 1000).toFixed(1).padStart(6)}s  ${msg}`);
  lines.length = Math.min(lines.length, 60);
  $('log').textContent = lines.join('\n');
};

pet.on((e) => {
  if (e.type === 'action-start' && e.action === 'poop') log('▶ squats…');
  if (e.type === 'emit' && e.name === 'poop') log('✦ poop step done (a pile appears if the spot is safe)');
  if (e.type === 'event' && e.name === 'poop-cleaned') log(`⚡ poop-cleaned → ${e.rule ? `rule ${e.rule}` : 'no rule'}`);
});

$('now').onclick = () => pet.play('poop');
$('clear').onclick = () => pet.clearPoops();
($('often') as HTMLInputElement).onchange = (e) => {
  const on = (e.target as HTMLInputElement).checked;
  pet.registerRule({ id: 'poop', on: 'idle', if: 'poop-spot', chance: on ? 0.6 : 0.05, cooldown: on ? 2000 : 90_000, priority: 33, action: 'poop' });
};
($('floorLinks') as HTMLInputElement).onchange = (e) => {
  $('floorBar').classList.toggle('on', (e.target as HTMLInputElement).checked);
};

setInterval(() => {
  const d = pet.debug();
  const piles = document.querySelector('sidekick-pet')?.shadowRoot?.querySelectorAll('div > div[style*="transition"]').length ?? 0;
  $('status').textContent = `${d.mode ?? '-'} · ${d.action ?? '-'} · anim ${d.anim ?? '-'} · piles on page: ${piles} · lifetime ${ttl ? `${ttl / 1000}s` : '15s'}`;
}, 200);
