import { destroy, getInstance, init } from '../src/index';

const $ = (id: string) => document.getElementById(id)!;
const scaleSel = $('scale') as HTMLSelectElement;
let clicks = 0;

const start = () => init({ scale: Number(scaleSel.value) });
start();

scaleSel.onchange = () => getInstance()?.setScale(Number(scaleSel.value));
$('again').onclick = () => {
  const before = getInstance();
  const after = start();
  alert(before === after ? 'Same instance returned: still one cat.' : 'A new instance was created.');
};
$('destroy').onclick = () => destroy();
$('start').onclick = () => start();
for (const id of ['btn', 'btn2']) {
  $(id).onclick = () => { $('clicks').textContent = `Button clicks: ${++clicks}`; };
}

setInterval(() => {
  const d = getInstance()?.debug();
  const hosts = document.querySelectorAll('sidekick-pet').length;
  $('debug').textContent = d
    ? `status ${d.status} · ${d.mode ?? '-'} · anim ${d.anim ?? '-'} · x ${d.x ?? '-'} y ${d.y ?? '-'} · facing ${d.facing ?? '-'} · scale ${d.scale} · sim ${(d.simTime / 1000).toFixed(1)}s · hosts in DOM: ${hosts}`
    : `no instance · hosts in DOM: ${hosts}`;
}, 200);
