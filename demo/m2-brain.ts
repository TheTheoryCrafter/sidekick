import { init, type SidekickEvent } from '../src/index';

const $ = (id: string) => document.getElementById(id)!;
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, ...kids: (Node | string)[]) => {
  const n = Object.assign(document.createElement(tag), props);
  n.append(...kids);
  return n;
};

const pet = init({ scale: 3 })!;
const lines: string[] = [];
let lastFired: string | null = null;

const fmt = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

function describe(e: SidekickEvent): string {
  switch (e.type) {
    case 'action-start': return `▶ ${e.action}${e.rule ? `  (rule ${e.rule})` : '  (direct)'}`;
    case 'action-end': return `■ ${e.action}${e.interrupted ? '  interrupted' : ''}`;
    case 'emit': return `✦ ${e.action} emitted "${e.name}"`;
    case 'event': return `⚡ event "${e.name}" → ${e.rule ? `rule ${e.rule}` : 'no rule fired'}`;
  }
}

pet.on((e) => {
  if (e.type === 'action-start') lastFired = e.rule;
  lines.unshift(`${fmt(pet.debug().simTime).padStart(7)}  ${describe(e)}`);
  lines.length = Math.min(lines.length, 200);
  $('log').textContent = lines.join('\n');
});
$('clear').onclick = () => { lines.length = 0; $('log').textContent = ''; };

// Time speed
for (const n of [1, 10, 60]) {
  const b = el('button', { textContent: `${n}×` });
  b.onclick = () => {
    pet.setTimeScale(n);
    $('speed').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
  };
  if (n === 1) b.classList.add('on');
  $('speed').append(b);
}

// Events
for (const name of ['tool-completed', 'success', 'error']) {
  const b = el('button', { textContent: name });
  b.onclick = () => pet.emit(name);
  $('events').append(b);
}
$('emitCustom').onclick = () => {
  const v = ($('custom') as HTMLInputElement).value.trim();
  if (v) pet.emit(v);
};

// Host-registered behavior
$('register').onclick = () => {
  const warnings = [
    ...pet.registerAction({
      id: 'party',
      steps: [
        { role: 'zoomies', motion: 'run', speed: 4 },
        { role: 'success', duration: 2000 },
        { role: 'zoomies', motion: 'run', speed: 4 },
      ],
    }),
    ...pet.registerRule({ id: 'party-time', on: 'party', action: 'party', priority: 65, cooldown: 5000 }),
  ];
  $('regInfo').textContent = warnings.length
    ? `Warnings: ${warnings.join(' ')}`
    : 'Registered. The action and rule now appear in the lists, and emit("party") triggers it (5 s cooldown).';
  ($('party') as HTMLButtonElement).disabled = false;
  renderActions();
};
$('party').onclick = () => pet.emit('party');

let actionKey = '';
function renderActions() {
  const ids = pet.debug().actions;
  if (ids.join() === actionKey) return;
  actionKey = ids.join();
  $('actions').replaceChildren(...ids.map((id) => {
    const b = el('button', { textContent: id });
    b.onclick = () => pet.play(id);
    return b;
  }));
}

function render() {
  const d = pet.debug();
  renderActions();
  const rows: [string, string][] = [
    ['status', d.status],
    ['sim time', fmt(d.simTime)],
    ['action', d.action ?? '—'],
    ['step', d.step === undefined ? '—' : String(d.step)],
    ['animation', d.anim ?? '—'],
    ['started by', d.action ? (d.rule ? `rule ${d.rule}` : 'play() / fallback') : '—'],
    ['priority', d.priority === undefined ? '—' : String(d.priority)],
    ['step ends in', d.stepEndsIn == null ? (d.action ? 'on arrival / when animation ends' : '—') : fmt(d.stepEndsIn)],
    ['position', d.x === undefined ? '—' : `x ${d.x}, facing ${d.facing === 1 ? 'right' : 'left'}`],
    ['last nap', d.lastDone?.sleep === undefined ? 'never' : `${fmt(d.lastDone.sleep)} ago`],
  ];
  $('now').replaceChildren(...rows.flatMap(([k, v]) => [el('dt', {}, k), el('dd', {}, v)]));

  const head = el('tr', {}, ...['id', 'on', 'if', 'chance', 'cooldown', 'priority', 'action', 'ready in'].map((h) => el('th', {}, h)));
  const body = d.rules.map((r) => {
    const wait = d.cooldowns?.[r.id];
    const tr = el('tr', {},
      el('td', {}, r.id), el('td', {}, r.on), el('td', {}, r.if.join(', ') || '—'),
      el('td', {}, `${Math.round(r.chance * 100)}%`), el('td', {}, r.cooldown ? fmt(r.cooldown) : '—'),
      el('td', {}, String(r.priority)), el('td', {}, r.action), el('td', {}, wait ? fmt(wait) : 'ready'),
    );
    if (wait) tr.classList.add('cool');
    if (r.id === lastFired && d.rule === r.id) tr.classList.add('fired');
    return tr;
  });
  $('rules').replaceChildren(head, ...body);
}

setInterval(render, 200);
