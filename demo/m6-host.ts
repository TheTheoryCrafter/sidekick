import { init, type SidekickEvent } from '../src/index';

const $ = (id: string) => document.getElementById(id)!;
const pet = init({
  pets: ['cream-cat', 'box-cat'],
  petUrls: { 'box-cat': '/demo/pets/box-cat/' },
  menu: true,
  idleAfter: 10_000,
})!;

// The host's own UI, kept in sync through subscribe().
const enabled = $('enabled') as HTMLInputElement;
const select = $('pet') as HTMLSelectElement;
for (const id of pet.getPets()) select.append(new Option(id, id));
function syncUi() {
  const s = pet.getSettings();
  enabled.checked = s.enabled;
  select.value = s.pet;
  $('settings').textContent = JSON.stringify(s);
}
pet.subscribe(syncUi);
syncUi();
enabled.onchange = () => (enabled.checked ? pet.enable() : pet.disable());
select.onchange = () => void pet.setPet(select.value);

document.querySelectorAll<HTMLButtonElement>('[data-emit]').forEach((b) => {
  b.onclick = () => pet.emit(b.dataset.emit!);
});
document.querySelectorAll<HTMLButtonElement>('[data-route]').forEach((b) => {
  b.onclick = () => {
    history.pushState({}, '', `${location.pathname}?route=${b.dataset.route}`);
    $('route').textContent = `route: ${b.dataset.route}`;
  };
});

const lines: string[] = [];
function log(e: SidekickEvent) {
  if (e.type !== 'event' && e.type !== 'action-start') return;
  const text = e.type === 'event'
    ? `⚡ ${e.name}${e.payload ? ` ${JSON.stringify(e.payload)}` : ''} → ${e.rule ? `rule ${e.rule}` : 'no rule'}`
    : `▶ ${e.action}${e.rule ? `  (rule ${e.rule})` : ''}`;
  lines.unshift(`${new Date().toLocaleTimeString()}  ${text}`);
  lines.length = Math.min(lines.length, 150);
  $('log').textContent = lines.join('\n');
}
pet.on(log);
$('clear').onclick = () => { lines.length = 0; $('log').textContent = ''; };

$('reset').onclick = () => {
  pet.destroy();
  localStorage.removeItem('sidekick:v1');
  location.reload();
};

setInterval(() => {
  $('stored').textContent = localStorage.getItem('sidekick:v1') ?? '(nothing saved yet)';
}, 300);
