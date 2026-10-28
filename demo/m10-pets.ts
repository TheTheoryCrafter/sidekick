// Every bundled pet, with buttons to switch between them and to trigger actions.
import { init } from '../src/index';

const PETS = ['cream-cat', 'dalmatian', 'husky', 'labrador', 'rottweiler', 'golden-retriever', 'panda'];
const ACTIONS = ['sit', 'walk', 'sniff', 'bark', 'think', 'yoga', 'snack', 'wave', 'jump', 'hide', 'sleep', 'eat', 'celebrate', 'faint', 'startle', 'happy', 'grumble'];
const $ = (id: string) => document.getElementById(id)!;
const pet = init({ pets: PETS, menu: true, persist: false, idleAfter: 30_000 })!;

for (const id of PETS) {
  const b = Object.assign(document.createElement('button'), { textContent: id });
  b.onclick = () => void pet.setPet(id);
  $('pets').append(b);
}
pet.subscribe(({ pet: current }) => {
  for (const b of $('pets').querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.textContent === current));
});
for (const id of ACTIONS) {
  const b = Object.assign(document.createElement('button'), { textContent: id });
  b.onclick = () => pet.play(id);
  $('actions').append(b);
}
document.querySelectorAll<HTMLButtonElement>('[data-emit]').forEach((b) => (b.onclick = () => pet.emit(b.dataset.emit!)));
($('speed') as HTMLSelectElement).onchange = (e) => pet.setTimeScale(Number((e.target as HTMLSelectElement).value));
setInterval(() => {
  const d = pet.debug();
  $('status').textContent = `${d.pet} · ${d.mode ?? '-'} · ${d.action ?? '-'} (${d.rule ?? 'play'}) · anim ${d.anim ?? '-'}`;
}, 200);
