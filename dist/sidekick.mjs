const gt = ["none", "wander", "run", "follow", "jump"];
const F = (n) => typeof n == "object" && n !== null && !Array.isArray(n), yt = (n) => typeof n == "number" && n >= 0 || Array.isArray(n) && n.length === 2 && n.every((t) => typeof t == "number" && t >= 0) && n[0] <= n[1], z = (n) => Array.isArray(n) ? n.filter((t) => typeof t == "string") : void 0;
function bt(n, t) {
  return typeof n == "number" ? n : n[0] + t() * (n[1] - n[0]);
}
function wt(n, t, e) {
  if (!F(n) || typeof n.role != "string" || !n.role)
    return e(`${t}: a step needs a "role".`), null;
  const i = { role: n.role };
  return n.motion !== void 0 && (gt.includes(n.motion) ? i.motion = n.motion : e(`${t}: unknown motion "${String(n.motion)}", using "none".`)), n.duration !== void 0 && (yt(n.duration) ? i.duration = n.duration : e(`${t}: "duration" must be ms or [min, max]; ignoring it.`)), typeof n.speed == "number" && n.speed > 0 && (i.speed = n.speed), n.face === "cursor" || n.face === "away" ? i.face = n.face : n.face !== void 0 && e(`${t}: "face" must be "cursor" or "away"; ignoring it.`), typeof n.emit == "string" && n.emit && (i.emit = n.emit), i;
}
function xt(n) {
  const t = [];
  if (!F(n) || typeof n.id != "string" || !n.id)
    return { action: null, warnings: ['An action needs an "id".'] };
  const e = `Action "${n.id}"`, i = Array.isArray(n.steps) ? n.steps : [n], s = i.map((o, r) => wt(o, i.length > 1 ? `${e} step ${r}` : e, (a) => t.push(a))).filter((o) => o !== null);
  return s.length === 0 ? { action: null, warnings: [...t, `${e} dropped: no valid steps.`] } : {
    action: {
      id: n.id,
      steps: s,
      interruptible: n.interruptible !== !1,
      ...typeof n.next == "string" && n.next ? { next: n.next } : {}
    },
    warnings: t
  };
}
function vt(n) {
  var c;
  const t = [];
  if (!F(n) || typeof n.id != "string" || !n.id)
    return { rule: null, warnings: ['A rule needs an "id".'] };
  const e = `Rule "${n.id}"`;
  if (typeof n.action != "string" || !n.action)
    return { rule: null, warnings: [`${e} dropped: it needs an "action".`] };
  const i = (l, h, u = -1 / 0, f = 1 / 0) => {
    const m = n[l];
    return m === void 0 ? h : typeof m == "number" && Number.isFinite(m) ? Math.min(f, Math.max(u, m)) : (t.push(`${e}: "${l}" must be a number; using ${h}.`), h);
  }, s = typeof n.if == "string" ? [n.if] : (c = z(n.if)) != null ? c : [], o = z(n.during), r = z(n.notDuring);
  let a;
  return n.scaleBy === "jumpiness" || n.scaleBy === "clinginess" ? a = n.scaleBy : n.scaleBy !== void 0 && t.push(`${e}: "scaleBy" must be "jumpiness" or "clinginess"; ignoring it.`), {
    rule: {
      id: n.id,
      action: n.action,
      on: typeof n.on == "string" && n.on ? n.on : "tick",
      if: s,
      chance: i("chance", 1, 0, 1),
      ...a ? { scaleBy: a } : {},
      cooldown: i("cooldown", 0, 0),
      priority: i("priority", 0),
      ...o ? { during: o } : {},
      ...r ? { notDuring: r } : {}
    },
    warnings: t
  };
}
class St {
  constructor() {
    this.actions = /* @__PURE__ */ new Map(), this.conditions = /* @__PURE__ */ new Map(), this.rules = /* @__PURE__ */ new Map(), this.sorted = null;
  }
  /** Add or replace an action. Returns warnings; never throws. */
  addAction(t) {
    const { action: e, warnings: i } = xt(t);
    return e && this.actions.set(e.id, e), i;
  }
  /** Add or replace a rule (same id replaces). Returns warnings; never throws. */
  addRule(t) {
    const { rule: e, warnings: i } = vt(t);
    return e && (this.rules.set(e.id, e), this.sorted = null), i;
  }
  removeRule(t) {
    return this.sorted = null, this.rules.delete(t);
  }
  addCondition(t, e) {
    this.conditions.set(t, e);
  }
  allRules() {
    return this.sorted || (this.sorted = [...this.rules.values()].sort((t, e) => e.priority - t.priority)), this.sorted;
  }
  rulesFor(t) {
    return this.allRules().filter((e) => e.on === t);
  }
}
const S = {
  /** px/s² */
  gravity: 2600,
  /** Share of speed kept when bouncing off a wall or the ceiling. */
  wallBounce: 0.45,
  /** Share of vertical speed kept when bouncing off the floor. */
  floorBounce: 0.3,
  /** Below this downward speed (px/s) the pet lands instead of bouncing. */
  landSpeed: 700,
  /** Share of horizontal speed kept per floor bounce. */
  floorFriction: 0.6,
  /** Throws are capped at this speed (px/s). */
  maxThrow: 2600,
  /** Pointer history used to measure a throw, ms. */
  throwWindowMs: 90
};
function Mt(n, t, e, i, s = !0) {
  let o = t.x, r = t.y + S.gravity * e, a = n.x + o * e, c = n.y + r * e;
  if (a < i.minX ? (a = i.minX, o = Math.abs(o) * S.wallBounce) : a > i.maxX && (a = i.maxX, o = -Math.abs(o) * S.wallBounce), c < i.minY && (c = i.minY, r = Math.abs(r) * S.wallBounce), c >= i.floorY) {
    const l = Math.max(0, r);
    if (c = i.floorY, !s || l < S.landSpeed) return { pos: { x: a, y: c }, vel: { x: 0, y: 0 }, landed: l };
    r = -l * S.floorBounce, o *= S.floorFriction;
  }
  return { pos: { x: a, y: c }, vel: { x: o, y: r }, landed: null };
}
function Et(n, t) {
  const e = n.filter((l) => t - l.t <= S.throwWindowMs);
  if (e.length < 2) return { x: 0, y: 0 };
  const i = e[0], s = e[e.length - 1], o = (s.t - i.t) / 1e3;
  if (o <= 0) return { x: 0, y: 0 };
  let r = (s.x - i.x) / o, a = (s.y - i.y) / o;
  const c = Math.hypot(r, a);
  return c > S.maxThrow && (r *= S.maxThrow / c, a *= S.maxThrow / c), { x: r, y: a };
}
const kt = {
  ambient: [],
  move: [],
  zoomies: ["move"],
  sleep: [],
  tired: [],
  hover: [],
  near: ["hover"],
  click: ["hover"],
  dblclick: ["success", "click"],
  dragged: ["hover", "click"],
  fall: ["dragged"],
  thrown: ["click"],
  landing: [],
  jump: ["landing"],
  poop: [],
  success: [],
  error: ["click"],
  "tool-used": ["success"],
  hide: [],
  hiding: ["hide"]
}, At = /* @__PURE__ */ new Set(["poopEntity"]);
function Tt(n, t) {
  var r;
  const e = /* @__PURE__ */ new Set(), i = [t];
  for (; i.length; ) {
    const a = i.shift();
    if (e.has(a)) continue;
    e.add(a);
    const c = n.roles[a];
    if (c !== void 0) return Array.isArray(c) ? [...c] : [c];
    i.push(...(r = kt[a]) != null ? r : []);
  }
  if (At.has(t)) return [];
  const s = n.roles.ambient;
  if (t !== "ambient" && s !== void 0) return Array.isArray(s) ? [...s] : [s];
  const o = Object.keys(n.animations)[0];
  return o ? [o] : [];
}
function U(n, t, e = Math.random) {
  const i = Tt(n, t);
  return i.length === 0 ? null : i[Math.min(i.length - 1, Math.floor(e() * i.length))];
}
function B(n, t, e) {
  var r;
  const [i, s] = n.frameSize, o = Math.max(0, Math.min(t.frames - 1, Math.floor(e)));
  return { x: (((r = t.col) != null ? r : 0) + o) * i, y: t.row * s, w: i, h: s };
}
function W(n, t) {
  const e = Math.max(0, t), i = Math.floor(e * n.fps / 1e3);
  return n.loop ? { frame: i % n.frames, done: !1 } : { frame: Math.min(i, n.frames - 1), done: i >= n.frames };
}
const Y = {
  /** Highest jump, in pet heights. */
  maxUp: 4,
  /** Furthest jump sideways, in pet widths. */
  maxSide: 7,
  /** Apex sits this many pet heights above the higher end of the jump. */
  apexRise: 0.6
};
function $t(n, t, e, i) {
  if (t <= n) return null;
  let s = null;
  for (const o of i)
    e < o.left || e > o.right || n > o.top + 0.5 || t < o.top || (!s || o.top < s.top) && (s = o);
  return s;
}
function It(n, t, e, i, s) {
  const o = i.petH * Y.maxUp, r = i.petW * Y.maxSide, a = [];
  for (const c of e) {
    if (c.id === t || c.top < i.minY || c.top > i.floorY - 4 || n.y - c.top > o) continue;
    const l = Math.min(i.petW / 2, (c.right - c.left) / 2), h = Math.max(c.left + l, i.minX), u = Math.min(c.right - l, i.maxX);
    if (u < h) continue;
    const f = Math.min(u, Math.max(h, n.x + (s() - 0.5) * i.petW));
    Math.abs(f - n.x) > r || Math.abs(f - n.x) < 4 && Math.abs(c.top - n.y) < 8 || a.push({ id: c.id, x: f, y: c.top });
  }
  if (t !== null && n.y < i.floorY - 4) {
    const c = s() < 0.5 ? -1 : 1, l = Math.min(i.maxX, Math.max(i.minX, n.x + c * i.petW * (1 + s() * 2)));
    a.push({ id: null, x: l, y: i.floorY });
  }
  return a.length === 0 ? null : a[Math.min(a.length - 1, Math.floor(s() * a.length))];
}
function Pt(n, t, e, i, s = -1 / 0) {
  const o = Math.max(s, Math.min(n.y, t.y) - e), r = Math.max(1, n.y - o), a = Math.max(1, t.y - o), c = -Math.sqrt(2 * i * r), l = Math.sqrt(2 * r / i) + Math.sqrt(2 * a / i);
  return { x: (t.x - n.x) / l, y: c };
}
const M = {
  tickMs: 1e3,
  /** After falling off a surface, ignore it for landing this long, ms. */
  skipLandMs: 400,
  minWanderPx: 80,
  /** A run goes at least this share of the walkable width. */
  minRunShare: 0.4,
  runSpeed: 3,
  /** "follow" stops this far from the cursor. */
  followStopPx: 40,
  /** Release speed (px/s) above which a drop counts as a throw. */
  throwSpeed: 500
}, _ = {
  id: "__fallback",
  steps: [{ role: "ambient", duration: [3e3, 8e3] }],
  interruptible: !0
}, A = (n, t, e) => e < t ? (t + e) / 2 : Math.min(e, Math.max(t, n));
function G(n, t, e, i, s) {
  const o = Math.max(0, n - t - e), r = Math.max(0, i - (n + t)), a = o + r;
  if (a <= 0) return null;
  const c = s() * a;
  return c < o ? e + c : n + t + (c - o);
}
function rt(n, t) {
  return n === null ? void 0 : t.surfaces.find((e) => e.id === n);
}
function H(n, t) {
  const e = rt(n.on, t);
  return e ? [Math.max(t.minX, e.left), Math.min(t.maxX, e.right)] : [t.minX, t.maxX];
}
function K(n, t) {
  if (!t.cursor) return null;
  const [e, i] = H(n, t), s = n.body.x <= t.cursor.x ? -1 : 1, o = A(t.cursor.x + s * M.followStopPx, e, i);
  return Math.abs(o - n.body.x) < 1 ? null : o;
}
function at(n, t) {
  return It(
    { x: n.body.x, y: n.body.y },
    n.on,
    t.surfaces,
    { petW: t.petW, petH: t.petH, minY: t.minY, floorY: t.floorY, minX: t.minX, maxX: t.maxX },
    t.rng
  );
}
function Lt(n, t, e) {
  var s;
  if (e.calm && n.steps.some((o) => {
    var r;
    return ((r = o.motion) != null ? r : "none") !== "none";
  })) return !1;
  const i = (s = n.steps[0]) == null ? void 0 : s.motion;
  return i === "follow" ? K(t, e) !== null : i === "jump" ? at(t, { ...e, rng: () => 0.5 }) !== null : !0;
}
function Rt(n, t) {
  var e;
  return {
    body: { x: A(n, t.minX, t.maxX), y: t.floorY, facing: t.rng() < 0.5 ? -1 : 1 },
    mode: "ground",
    on: null,
    vel: { x: 0, y: 0 },
    thrown: !1,
    jumping: !1,
    action: null,
    anim: (e = U(t.manifest, "ambient", t.rng)) != null ? e : "",
    animStart: t.now,
    cooldowns: {},
    lastDone: {},
    nextTick: t.now + M.tickMs
  };
}
function Ct(n, t, e) {
  var i, s;
  return {
    now: t.now,
    hour: t.hour,
    action: (s = (i = n.action) == null ? void 0 : i.id) != null ? s : null,
    lastDone: n.lastDone,
    payload: e,
    cursor: t.cursor,
    onSurface: n.on !== null
  };
}
function Ot(n, t, e, i) {
  var a;
  if (n.mode !== "ground") return null;
  const s = n.action, o = s ? e.behavior.actions.get(s.id) : void 0, r = Ct(n, e, i);
  for (const c of e.behavior.rulesFor(t)) {
    const l = e.behavior.actions.get(c.action);
    if (!l || ((a = n.cooldowns[c.id]) != null ? a : -1 / 0) > e.now || c.during && !(s && c.during.includes(s.id)) || c.notDuring && s && c.notDuring.includes(s.id) || s && ((o == null ? void 0 : o.interruptible) === !1 || c.priority < s.priority) || !c.if.every((u) => {
      var f, m;
      return (m = (f = e.behavior.conditions.get(u)) == null ? void 0 : f(r)) != null ? m : !1;
    }) || !Lt(l, n, e)) continue;
    const h = c.scaleBy ? Math.min(1, c.chance * e.manifest.traits[c.scaleBy] * 2) : c.chance;
    if (!(e.rng() >= h))
      return c;
  }
  return null;
}
function C(n, t, e) {
  const i = U(e.manifest, t, e.rng);
  return i ? { ...n, anim: i, animStart: e.now } : n;
}
function ct(n, t, e) {
  const [i, s] = H(t, e);
  switch (n.motion) {
    case "wander":
      return G(t.body.x, M.minWanderPx, i, s, e.rng);
    case "run":
      return G(t.body.x, Math.max(M.minWanderPx, (s - i) * M.minRunShare), i, s, e.rng);
    case "follow":
      return K(t, e);
    default:
      return null;
  }
}
function lt(n, t, e, i) {
  var f, m, x, y;
  const s = t.steps[e], o = C(n, s.role, i);
  if (i.calm && ((f = s.motion) != null ? f : "none") !== "none")
    return { ...o, action: { ...o.action, step: e, stepStart: i.now, deadline: i.now, targetX: null, speed: 0 } };
  if (s.motion === "jump") {
    const p = at(n, i), d = { ...o.action, step: e, stepStart: i.now, deadline: null, targetX: (m = p == null ? void 0 : p.x) != null ? m : null, speed: 0 };
    if (!p) return { ...o, action: { ...d, deadline: i.now } };
    const g = Pt({ x: n.body.x, y: n.body.y }, p, i.petH * Y.apexRise, S.gravity, i.minY), w = Math.abs(p.x - n.body.x) > 1 ? p.x > n.body.x ? 1 : -1 : n.body.facing;
    return { ...o, action: d, mode: "air", on: null, vel: g, jumping: !0, thrown: !1, body: { ...o.body, facing: w } };
  }
  const r = ((x = s.motion) != null ? x : "none") !== "none", a = ct(s, n, i), c = r ? i.walkSpeed * ((y = s.speed) != null ? y : s.motion === "run" ? M.runSpeed : 1) : 0, l = i.manifest.animations[o.anim];
  let h = null;
  s.duration !== void 0 ? h = i.now + bt(s.duration, i.rng) : r && a === null ? h = i.now : !r && (!l || l.loop) && (h = i.now + 3e3);
  let u = n.body.facing;
  if (a !== null) u = a > n.body.x ? 1 : -1;
  else if (s.face && i.cursor && Math.abs(i.cursor.x - n.body.x) > 1) {
    const p = i.cursor.x > n.body.x ? 1 : -1;
    u = s.face === "cursor" ? p : -p;
  }
  return {
    ...o,
    body: { ...o.body, facing: u },
    action: { ...o.action, step: e, stepStart: i.now, deadline: h, targetX: a, speed: c }
  };
}
function O(n, t, e, i, s, o) {
  n.action && o.push({ type: "action-end", action: n.action.id, interrupted: !0 }), o.push({ type: "action-start", action: t.id, rule: i });
  const r = {
    ...n,
    action: { id: t.id, step: 0, stepStart: s.now, deadline: null, targetX: null, speed: 0, priority: e, rule: i }
  };
  return lt(r, t, 0, s);
}
function ht(n, t) {
  return n.action ? (t.push({ type: "action-end", action: n.action.id, interrupted: !0 }), { ...n, action: null }) : n;
}
function I(n, t, e, i, s) {
  var a;
  const o = Ot(n, t, e, s);
  if (t !== "idle" && t !== "tick" && i.push({ type: "event", name: t, rule: (a = o == null ? void 0 : o.id) != null ? a : null, ...s !== void 0 ? { payload: s } : {} }), !o)
    return t === "idle" && n.mode === "ground" ? O(n, _, 0, null, e, i) : n;
  const r = o.cooldown > 0 ? { ...n, cooldowns: { ...n.cooldowns, [o.id]: e.now + o.cooldown } } : n;
  return O(r, e.behavior.actions.get(o.action), o.priority, o.id, e, i);
}
function ut(n, t) {
  return n === _.id ? _ : t.behavior.actions.get(n);
}
function dt(n, t, e, i) {
  const s = n.action, o = t.steps[s.step];
  if (o.emit && i.push({ type: "emit", name: o.emit, action: s.id }), s.step + 1 < t.steps.length) return lt(n, t, s.step + 1, e);
  i.push({ type: "action-end", action: s.id, interrupted: !1 }), n = { ...n, action: null, lastDone: { ...n.lastDone, [s.id]: e.now } };
  const r = t.next ? e.behavior.actions.get(t.next) : void 0;
  return r ? O(n, r, s.priority, s.rule, e, i) : I(n, "idle", e, i);
}
function Xt(n, t, e, i) {
  const s = [];
  return { state: I(n, t, e, s, i), effects: s };
}
function jt(n, t, e, i = 0) {
  const s = [], o = e.behavior.actions.get(t);
  return !o || n.mode !== "ground" ? { state: n, effects: s } : { state: O(n, o, i, null, e, s), effects: s };
}
function zt(n, t) {
  const e = [];
  let i = ht(n, e);
  return i = C({ ...i, mode: "held", on: null, vel: { x: 0, y: 0 }, thrown: !1, jumping: !1 }, "dragged", t), e.push({ type: "event", name: "drag-start", rule: null }), { state: i, effects: e };
}
function Dt(n, t, e, i) {
  if (n.mode !== "held") return n;
  const s = A(t, i.minX, i.maxX), o = A(e, i.minY, i.floorY), r = s - n.body.x, a = Math.abs(r) > 2 ? r > 0 ? 1 : -1 : n.body.facing;
  return { ...n, body: { x: s, y: o, facing: a } };
}
function Nt(n, t, e) {
  const i = [];
  if (n.mode !== "held") return { state: n, effects: i };
  const s = Math.hypot(t.x, t.y) >= M.throwSpeed;
  return i.push({ type: "event", name: s ? "throw" : "drop", rule: null, payload: { vx: Math.round(t.x), vy: Math.round(t.y) } }), { state: C({ ...n, mode: "air", vel: t, thrown: s, jumping: !1 }, "fall", e), effects: i };
}
function Bt(n, t, e) {
  const i = ht(n, e), s = n.on === null ? null : { id: n.on, until: t.now + M.skipLandMs };
  return C({ ...i, mode: "air", on: null, vel: { x: 0, y: 0 }, thrown: !1, jumping: !1, skipLand: s }, "fall", t);
}
function Yt(n, t, e) {
  var x;
  const i = Mt(
    { x: n.body.x, y: n.body.y },
    n.vel,
    t.dt,
    { minX: t.minX, maxX: t.maxX, minY: t.minY, floorY: t.floorY },
    !n.jumping
  ), s = Math.abs(i.vel.x) > 30 ? i.vel.x > 0 ? 1 : -1 : n.body.facing;
  let o = { ...n, body: { x: i.pos.x, y: i.pos.y, facing: s }, vel: i.vel };
  const r = n.skipLand && t.now < n.skipLand.until ? n.skipLand.id : null, a = r === null ? t.surfaces : t.surfaces.filter((y) => y.id !== r), c = n.vel.y >= 0 || i.vel.y > 0 ? $t(n.body.y, i.pos.y, i.pos.x, a) : null;
  let l;
  if (c)
    l = Math.max(0, i.vel.y), o = { ...o, body: { ...o.body, y: c.top }, on: c.id };
  else if (i.landed !== null)
    l = i.landed, o = { ...o, on: null };
  else
    return o;
  const h = n.thrown, u = n.jumping;
  o = { ...o, mode: "ground", vel: { x: 0, y: 0 }, thrown: !1, jumping: !1, nextTick: t.now + M.tickMs };
  const f = { impact: Math.round(l), thrown: h, jumped: u, surface: o.on !== null }, m = o.action && ut(o.action.id, t);
  return u && m && ((x = m.steps[o.action.step]) == null ? void 0 : x.motion) === "jump" ? (e.push({ type: "event", name: "land", rule: null, payload: f }), dt(o, m, t, e)) : (o = I(o, "land", t, e, f), o.action ? o : I(o, "idle", t, e));
}
function _t(n, t) {
  const e = [];
  if (n.mode === "held") return { state: n, effects: e };
  if (n.mode === "air") return { state: Yt(n, t, e), effects: e };
  let i;
  if (n.on !== null) {
    const h = rt(n.on, t);
    if (!h || h.top < t.minY || n.body.x < h.left - 2 || n.body.x > h.right + 2)
      return { state: Bt(n, t, e), effects: e };
    i = h.top > t.floorY ? { ...n, on: null, body: { ...n.body, y: t.floorY } } : { ...n, body: { ...n.body, x: A(n.body.x, t.minX, t.maxX), y: h.top } };
  } else
    i = { ...n, body: { ...n.body, x: A(n.body.x, t.minX, t.maxX), y: t.floorY } };
  if (t.now >= i.nextTick && (i = { ...i, nextTick: t.now + M.tickMs }, i = I(i, "tick", t, e), i.mode !== "ground"))
    return { state: i, effects: e };
  const s = i.action, o = s && ut(s.id, t);
  if (!s || !o) return { state: I({ ...i, action: null }, "idle", t, e), effects: e };
  const r = o.steps[s.step];
  let a = s.deadline !== null && t.now >= s.deadline;
  if (!a && s.targetX !== null) {
    const [h, u] = H(i, t), f = r.motion === "follow" ? K(i, t) : A(s.targetX, h, u);
    if (f === null)
      a = !0;
    else {
      const m = f - i.body.x, x = s.speed * t.dt;
      if (Math.abs(m) <= x) {
        i = { ...i, body: { ...i.body, x: f } };
        const y = s.deadline !== null && r.motion !== "follow" ? ct(r, i, t) : null;
        y === null ? a = !0 : i = { ...i, action: { ...s, targetX: y }, body: { ...i.body, facing: y > i.body.x ? 1 : -1 } };
      } else {
        const y = m > 0 ? 1 : -1;
        i = { ...i, body: { ...i.body, x: i.body.x + y * x, facing: y } };
      }
    }
  }
  const c = t.manifest.animations[i.anim], l = !!c && !c.loop && W(c, t.now - i.animStart).done;
  return !a && l && (s.deadline === null && s.targetX === null ? a = !0 : i = C(i, r.role, t)), a ? { state: dt(i, o, t, e), effects: e } : { state: i, effects: e };
}
const Ft = 3 * 6e4, Ut = [
  { id: "sit", role: "ambient", duration: [3e3, 8e3] },
  // Free-time actions last a while, so the pet doesn't flit from one to the next.
  // A timed walk keeps picking new spots until its time is up.
  { id: "walk", role: "move", motion: "wander", duration: [4e3, 1e4] },
  {
    id: "zoomies",
    steps: [
      { role: "zoomies", motion: "run" },
      { role: "zoomies", motion: "run" },
      { role: "ambient", duration: [2e3, 4e3] }
    ]
  },
  {
    id: "sleep",
    steps: [
      { role: "tired" },
      { role: "sleep", duration: [2e4, 45e3] }
    ]
  },
  { id: "hide", steps: [{ role: "hide" }, { role: "hiding", duration: [3e3, 6e3] }] },
  // After landing, stay on the element for a moment before doing anything else.
  { id: "jump", steps: [{ role: "jump", motion: "jump" }, { role: "ambient", duration: [2e3, 5e3] }] },
  // The pile appears when the step ends (the "poop" emit), behind the pet.
  { id: "poop", role: "poop", emit: "poop", interruptible: !1 },
  { id: "eat", role: "tool-used" },
  { id: "celebrate", role: "success", duration: 2500 },
  { id: "faint", role: "error", duration: 4e3 },
  // Reactions to the visitor.
  { id: "startle", role: "click", duration: 1e3 },
  { id: "happy", role: "dblclick", duration: 2e3 },
  { id: "shy", role: "hover" },
  { id: "notice", role: "near", face: "cursor" },
  { id: "approach", steps: [{ role: "move", motion: "follow" }, { role: "near", face: "cursor" }] },
  { id: "land", role: "landing" },
  { id: "grumble", steps: [{ role: "landing" }, { role: "thrown", duration: 2e3 }] },
  // Reactions to the page.
  { id: "wake", role: "tired" },
  { id: "look", role: "near" }
], Wt = [
  // Free time: tried highest priority first, the first whose chance roll succeeds wins.
  { id: "sleep-at-night", on: "idle", if: ["night", "sleepy"], chance: 0.6, priority: 51, action: "sleep" },
  { id: "sleep-when-sleepy", on: "idle", if: "sleepy", chance: 0.3, priority: 50, action: "sleep" },
  { id: "zoomies", on: "idle", chance: 0.06, cooldown: 9e4, priority: 40, action: "zoomies" },
  { id: "jump", on: "idle", chance: 0.5, scaleBy: "jumpiness", cooldown: 6e3, priority: 35, action: "jump" },
  // "poop-spot" is supplied by the page layer: poop is on, the pet has a pile sprite,
  // there is room for another, and nothing clickable is under the spot.
  { id: "poop", on: "idle", if: "poop-spot", chance: 0.05, cooldown: 9e4, priority: 33, action: "poop" },
  { id: "hide", on: "idle", chance: 0.05, cooldown: 12e4, priority: 30, action: "hide" },
  { id: "walk", on: "idle", chance: 0.55, priority: 10, action: "walk" },
  { id: "sit", on: "idle", chance: 1, priority: 0, action: "sit" },
  // The visitor. Clicks beat everything except landing; hover and near are gentle.
  { id: "land-after-throw", on: "land", if: "thrown", priority: 95, action: "grumble" },
  { id: "land", on: "land", priority: 90, action: "land" },
  { id: "dblclick", on: "dblclick", priority: 85, action: "happy" },
  { id: "click", on: "click", priority: 80, cooldown: 300, action: "startle" },
  { id: "tap", on: "tap", priority: 80, cooldown: 300, action: "startle" },
  { id: "hover", on: "hover", priority: 20, chance: 0.7, cooldown: 1e4, notDuring: ["sleep"], action: "shy" },
  { id: "near-approach", on: "near", priority: 15, chance: 0.3, scaleBy: "clinginess", cooldown: 2e4, notDuring: ["sleep"], action: "approach" },
  { id: "near-notice", on: "near", priority: 15, chance: 0.6, cooldown: 12e3, notDuring: ["sleep"], action: "notice" },
  // Built-in page events.
  { id: "visitor-idle", on: "visitor-idle", priority: 45, chance: 0.8, notDuring: ["sleep"], action: "sleep" },
  { id: "visitor-return-wake", on: "visitor-return", priority: 55, during: ["sleep"], action: "wake" },
  { id: "visitor-return", on: "visitor-return", priority: 30, chance: 0.5, action: "notice" },
  { id: "tab-return", on: "tab-return", priority: 40, chance: 0.8, action: "happy" },
  { id: "page-change", on: "page-change", priority: 30, chance: 0.8, cooldown: 2e3, notDuring: ["sleep"], action: "look" },
  { id: "copy", on: "copy", priority: 30, cooldown: 5e3, notDuring: ["sleep"], action: "eat" },
  // Events from the host site.
  { id: "tool-completed", on: "tool-completed", priority: 60, cooldown: 3e3, action: "eat" },
  { id: "success", on: "success", priority: 60, cooldown: 3e3, action: "celebrate" },
  { id: "error", on: "error", priority: 70, cooldown: 3e3, action: "faint" },
  { id: "poop-cleaned", on: "poop-cleaned", priority: 25, chance: 0.5, cooldown: 5e3, notDuring: ["sleep"], action: "celebrate" }
], Ht = {
  /** Awake for a while since the last nap (or since the pet appeared). */
  sleepy: ({ now: n, lastDone: t }) => {
    var e;
    return n - ((e = t.sleep) != null ? e : 0) >= Ft;
  },
  /** 22:00–06:00 in the visitor's time zone. */
  night: ({ hour: n }) => n >= 22 || n < 6,
  /** Replaced by the page layer, which can see what's under the pet. */
  "poop-spot": () => !1,
  /** For "land": the pet was thrown rather than set down. */
  thrown: ({ payload: n }) => !!(n != null && n.thrown)
};
function Kt() {
  const n = new St();
  return Ut.forEach((t) => n.addAction(t)), Wt.forEach((t) => n.addRule(t)), Object.entries(Ht).forEach(([t, e]) => n.addCondition(t, e)), n;
}
const Vt = { speed: 1, jumpiness: 0.2, clinginess: 0.5 }, $ = (n) => typeof n == "object" && n !== null && !Array.isArray(n), D = (n) => typeof n == "number" && Number.isInteger(n) && n > 0, q = (n) => typeof n == "number" && Number.isInteger(n) && n >= 0, N = (n, t) => Array.isArray(n) && n.length === 2 && t(n[0]) && t(n[1]), J = (n) => Math.min(1, Math.max(0, n));
function Q(n) {
  const t = [], e = [], i = () => ({ manifest: null, errors: t, warnings: e });
  if (!$(n))
    return t.push("Manifest must be a JSON object."), i();
  const s = n.id;
  if ((typeof s != "string" || !/^[a-z0-9][a-z0-9-]*$/.test(s)) && t.push('"id" must be a lowercase slug like "cream-cat".'), (typeof n.sheet != "string" || n.sheet === "") && t.push('"sheet" must be the sprite sheet file name.'), N(n.frameSize, D) || t.push('"frameSize" must be [width, height] in whole pixels.'), $(n.animations) || t.push('"animations" must be an object.'), t.length) return i();
  const o = n.frameSize, [r, a] = o;
  let c;
  n.sheetSize !== void 0 && (N(n.sheetSize, D) ? c = n.sheetSize : e.push('"sheetSize" is not [width, height]; ignoring it.'));
  const l = c ? Math.floor(c[0] / r) : 1 / 0, h = c ? Math.floor(c[1] / a) : 1 / 0, u = {};
  for (const [d, g] of Object.entries(n.animations)) {
    const w = (b) => e.push(`Animation "${d}" dropped: ${b}.`);
    if (!$(g)) {
      w("not an object");
      continue;
    }
    const v = g.col === void 0 ? 0 : g.col;
    if (!q(g.row)) {
      w('"row" must be a whole number ≥ 0');
      continue;
    }
    if (!q(v)) {
      w('"col" must be a whole number ≥ 0');
      continue;
    }
    if (!D(g.frames)) {
      w('"frames" must be a whole number ≥ 1');
      continue;
    }
    if (typeof g.fps != "number" || !(g.fps > 0)) {
      w('"fps" must be > 0');
      continue;
    }
    if (g.row >= h) {
      w(`row ${g.row} is outside the ${h}-row sheet`);
      continue;
    }
    if (v + g.frames > l) {
      w(`frames run past the ${l}-column sheet`);
      continue;
    }
    u[d] = {
      row: g.row,
      col: v,
      frames: g.frames,
      fps: g.fps,
      loop: g.loop !== !1,
      ...typeof g.label == "string" ? { label: g.label } : {}
    };
  }
  if (Object.keys(u).length === 0)
    return t.push("No usable animations."), i();
  const f = {};
  if (n.roles !== void 0 && !$(n.roles))
    e.push('"roles" must be an object; ignoring it.');
  else if ($(n.roles))
    for (const [d, g] of Object.entries(n.roles)) {
      const w = (Array.isArray(g) ? g : [g]).filter((b) => typeof b == "string"), v = w.filter((b) => b in u);
      for (const b of w)
        b in u || e.push(`Role "${d}" refers to unknown animation "${b}".`);
      if (v.length === 0) {
        e.push(`Role "${d}" dropped: no usable animations.`);
        continue;
      }
      f[d] = Array.isArray(g) ? v : v[0];
    }
  let m = [Math.floor(r / 2), a];
  n.anchor !== void 0 && (N(n.anchor, (d) => typeof d == "number") ? m = n.anchor : e.push('"anchor" is not [x, y]; using bottom centre.'));
  let x = [0, 0, r, a];
  if (n.hitbox !== void 0) {
    const d = n.hitbox;
    Array.isArray(d) && d.length === 4 && d.every((w) => typeof w == "number" && w >= 0) && d[2] > 0 && d[3] > 0 && d[0] + d[2] <= r && d[1] + d[3] <= a ? x = d : e.push('"hitbox" must be [x, y, width, height] inside the frame; using the whole frame.');
  }
  let y = "right";
  n.facing !== void 0 && (n.facing === "left" || n.facing === "right" ? y = n.facing : e.push('"facing" must be "left" or "right"; using "right".'));
  const p = { ...Vt };
  if ($(n.traits)) {
    const d = n.traits;
    typeof d.speed == "number" && d.speed > 0 && (p.speed = d.speed), typeof d.jumpiness == "number" && (p.jumpiness = J(d.jumpiness)), typeof d.clinginess == "number" && (p.clinginess = J(d.clinginess));
  }
  return {
    manifest: {
      id: s,
      name: typeof n.name == "string" && n.name ? n.name : s,
      sheet: n.sheet,
      frameSize: o,
      ...c ? { sheetSize: c } : {},
      anchor: m,
      facing: y,
      hitbox: x,
      animations: u,
      roles: f,
      traits: p
    },
    errors: t,
    warnings: e
  };
}
const Z = { max: 5, ttl: 15e3 };
function Gt(n, t, e, i) {
  return { x: n - e * i * 0.6, y: t };
}
function qt(n, t, e) {
  const i = [...n, t], s = Math.max(0, i.length - Math.max(0, e));
  return { list: i.slice(s), removed: i.slice(0, s) };
}
function Jt(n, t, e) {
  const i = [], s = [];
  for (const o of n) (t - o.born >= e ? s : i).push(o);
  return { list: i, removed: s };
}
function Qt(n) {
  if (n === !1) return null;
  const t = typeof n == "object" && n !== null ? n : {}, e = (i, s, o) => typeof i == "number" && Number.isFinite(i) && i >= o ? i : s;
  return { max: Math.floor(e(t.max, Z.max, 1)), ttl: e(t.ttl, Z.ttl, 1e3) };
}
function Zt(n) {
  let t = n >>> 0;
  return () => {
    t = t + 1831565813 >>> 0;
    let e = t;
    return e = Math.imul(e ^ e >>> 15, e | 1), e ^= e + Math.imul(e ^ e >>> 7, e | 61), ((e ^ e >>> 14) >>> 0) / 4294967296;
  };
}
const ft = 1;
function tt(n) {
  if (!n) return {};
  let t;
  try {
    t = JSON.parse(n);
  } catch {
    return {};
  }
  if (typeof t != "object" || t === null || t.v !== ft) return {};
  const e = t, i = {};
  return typeof e.enabled == "boolean" && (i.enabled = e.enabled), typeof e.pet == "string" && /^[a-z0-9][a-z0-9-]*$/.test(e.pet) && (i.pet = e.pet), typeof e.x == "number" && e.x >= 0 && e.x <= 1 && (i.x = e.x), i;
}
function te(n) {
  return JSON.stringify({ v: ft, enabled: n.enabled, pet: n.pet, ...n.x === void 0 ? {} : { x: Math.round(n.x * 1e3) / 1e3 } });
}
function ee(n, t, e) {
  var s;
  const i = t.pet && e.includes(t.pet) ? t.pet : n.pet;
  return { enabled: (s = t.enabled) != null ? s : n.enabled, pet: i, ...t.x === void 0 ? {} : { x: t.x } };
}
const ie = "sidekick-pet";
function ne(n) {
  const t = n.createElement(ie);
  t.setAttribute("aria-hidden", "true");
  const e = {
    all: "initial",
    position: "fixed",
    left: "0",
    top: "0",
    width: "0",
    height: "0",
    overflow: "visible",
    "z-index": "2147483000",
    "pointer-events": "none"
  };
  for (const [r, a] of Object.entries(e)) t.style.setProperty(r, a, "important");
  const i = t.attachShadow({ mode: "open" }), s = n.createElement("div"), o = s.style;
  return o.position = "fixed", o.inset = "0", o.overflow = "hidden", o.pointerEvents = "none", o.contain = "layout paint style", i.append(s), n.documentElement.append(t), { el: t, stage: s, remove: () => t.remove() };
}
const pt = 1e3 / 60, se = 250;
function oe(n, t, e = pt) {
  const i = n + Math.min(Math.max(0, t), se), s = Math.floor(i / e);
  return { steps: s, carry: i - s * e };
}
class re {
  constructor(t, e, i) {
    this.win = t, this.step = e, this.render = i, this.raf = 0, this.lastTs = -1, this.carry = 0, this.frame = (s) => {
      const { steps: o, carry: r } = oe(this.carry, this.lastTs < 0 ? 0 : s - this.lastTs);
      this.lastTs = s, this.carry = r;
      for (let a = 0; a < o; a++) this.step(pt);
      this.render(), this.raf = this.win.requestAnimationFrame(this.frame);
    };
  }
  get running() {
    return this.raf !== 0;
  }
  start() {
    this.raf || (this.lastTs = -1, this.raf = this.win.requestAnimationFrame(this.frame));
  }
  stop() {
    this.raf && this.win.cancelAnimationFrame(this.raf), this.raf = 0;
  }
}
const et = { bg: "#ffffff", fg: "#1f2328", hover: "#f0f1f3", border: "rgba(0,0,0,.12)", shadow: "0 6px 24px rgba(0,0,0,.18)" }, ae = { bg: "#24272e", fg: "#e8eaed", hover: "#33373f", border: "rgba(255,255,255,.14)", shadow: "0 6px 24px rgba(0,0,0,.5)" };
function mt(n) {
  try {
    return n.matchMedia("(prefers-color-scheme: dark)").matches ? ae : et;
  } catch {
    return et;
  }
}
function ce(n, t) {
  n.font = '13px/1.3 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', n.color = t.fg, n.letterSpacing = "normal", n.textTransform = "none", n.userSelect = "none", n.setProperty("-webkit-user-select", "none");
}
class le {
  constructor(t, e) {
    this.win = t, this.stage = e, this.el = null, this.cleanups = [];
  }
  get isOpen() {
    return this.el !== null;
  }
  /** Open above (x, y) in viewport px, kept on screen. */
  open(t, e, i) {
    if (this.close(), t.length === 0) return;
    const s = this.win.document, o = mt(this.win), r = s.createElement("div"), a = r.style;
    a.position = "absolute", a.left = "0", a.top = "0", a.minWidth = "160px", a.padding = "4px", a.background = o.bg, a.border = `1px solid ${o.border}`, a.borderRadius = "8px", a.boxShadow = o.shadow, a.pointerEvents = "auto", a.touchAction = "manipulation", ce(a, o);
    for (const p of t) {
      const d = s.createElement("div"), g = d.style;
      g.padding = "8px 10px", g.borderRadius = "5px", g.cursor = "pointer", g.whiteSpace = "nowrap", d.textContent = p.label, d.addEventListener("pointerenter", () => {
        g.background = o.hover;
      }), d.addEventListener("pointerleave", () => {
        g.background = "transparent";
      }), d.addEventListener("click", (w) => {
        w.stopPropagation(), this.close(), p.onSelect();
      }), r.append(d);
    }
    this.stage.append(r), this.el = r;
    const c = s.documentElement, l = r.offsetWidth, h = r.offsetHeight, u = Math.min(Math.max(8, e - l / 2), c.clientWidth - l - 8), f = i - h - 8 >= 8 ? i - h - 8 : Math.min(i + 8, c.clientHeight - h - 8);
    a.transform = `translate(${Math.round(u)}px,${Math.round(f)}px)`;
    const m = (p) => {
      p.composedPath().includes(r) || this.close();
    }, x = (p) => {
      p.key === "Escape" && this.close();
    }, y = (p, d) => {
      this.win.addEventListener(p, d, { capture: !0, passive: !0 }), this.cleanups.push(() => this.win.removeEventListener(p, d, { capture: !0 }));
    };
    this.win.setTimeout(() => {
      this.el === r && (y("pointerdown", m), y("keydown", x), y("scroll", () => this.close()), y("resize", () => this.close()));
    }, 0);
  }
  close() {
    var t;
    this.cleanups.forEach((e) => e()), this.cleanups = [], (t = this.el) == null || t.remove(), this.el = null;
  }
}
class he {
  constructor(t, e, i, s, o = "bottom-right") {
    const r = t.document, a = mt(t), c = r.createElement("div"), l = c.style;
    l.position = "absolute", o === "bottom-left" ? l.left = "12px" : l.right = "12px", l.bottom = "12px", l.width = "32px", l.height = "32px", l.borderRadius = "50%", l.display = "flex", l.alignItems = "center", l.justifyContent = "center", l.background = a.bg, l.border = `1px solid ${a.border}`, l.boxShadow = a.shadow, l.cursor = "pointer", l.pointerEvents = "auto", l.opacity = "0.55", l.transition = "opacity 150ms ease-out", l.fontSize = "16px", l.lineHeight = "1", c.title = s, c.textContent = "🐾", c.addEventListener("pointerenter", () => {
      l.opacity = "1";
    }), c.addEventListener("pointerleave", () => {
      l.opacity = "0.55";
    }), c.addEventListener("click", (h) => {
      h.stopPropagation(), i();
    }), e.append(c), this.el = c;
  }
  remove() {
    this.el.remove();
  }
}
const P = {
  /** Movement before a press becomes a drag, px. */
  dragMouse: 5,
  dragTouch: 10,
  /** Longest press that still counts as a click, ms. */
  clickMs: 500,
  /** Two clicks closer than this make a double-click, ms. */
  doubleMs: 350,
  /** Holding still this long opens the menu, ms. */
  longPressMs: 550
};
class ue {
  constructor(t, e, i) {
    this.win = t, this.hit = e, this.h = i, this.press = null, this.dragging = !1, this.samples = [], this.lastClick = { t: -1 / 0, type: "" }, this.longPress = 0, this.pressOpenedMenu = !1, this.cleanups = [], this.on(e, "pointerenter", (s) => {
      s.pointerType !== "touch" && !this.press && i.hover();
    }), this.on(e, "pointerdown", (s) => this.down(s)), this.on(e, "pointermove", (s) => this.move(s)), this.on(e, "pointerup", (s) => this.up(s)), this.on(e, "pointercancel", () => this.cancel()), this.on(e, "lostpointercapture", () => this.cancel()), this.on(e, "contextmenu", (s) => {
      s.preventDefault(), !(!i.menu || this.dragging) && (this.cancelLongPress(), this.press && (this.pressOpenedMenu = !0), i.menu({ x: s.clientX, y: s.clientY }));
    }), this.on(t, "pointermove", (s) => {
      s.pointerType !== "touch" && i.cursor({ x: s.clientX, y: s.clientY });
    }, { passive: !0 }), this.on(t.document, "mouseout", (s) => {
      s.relatedTarget || i.cursor(null);
    }, { passive: !0 });
  }
  get isDragging() {
    return this.dragging;
  }
  destroy() {
    this.cancelLongPress(), this.cleanups.forEach((t) => t()), this.cleanups = [];
  }
  down(t) {
    if (!(!t.isPrimary || t.button !== 0 || this.press)) {
      t.preventDefault();
      try {
        this.hit.setPointerCapture(t.pointerId);
      } catch {
      }
      if (this.press = { id: t.pointerId, type: t.pointerType, x: t.clientX, y: t.clientY, t: t.timeStamp }, this.samples = [{ t: t.timeStamp, x: t.clientX, y: t.clientY }], this.pressOpenedMenu = !1, this.h.menu) {
        const e = { x: t.clientX, y: t.clientY };
        this.longPress = this.win.setTimeout(() => {
          var i, s;
          this.longPress = 0, !(!this.press || this.dragging) && (this.pressOpenedMenu = !0, (s = (i = this.h).menu) == null || s.call(i, e));
        }, P.longPressMs);
      }
    }
  }
  move(t) {
    const e = this.press;
    if (!(!e || t.pointerId !== e.id)) {
      if (this.samples.push({ t: t.timeStamp, x: t.clientX, y: t.clientY }), this.samples.length > 12 && this.samples.shift(), !this.dragging) {
        const i = e.type === "touch" ? P.dragTouch : P.dragMouse;
        if (Math.hypot(t.clientX - e.x, t.clientY - e.y) < i || (this.cancelLongPress(), this.pressOpenedMenu)) return;
        this.dragging = !0, this.h.grab({ x: e.x, y: e.y });
      }
      this.h.drag({ x: t.clientX, y: t.clientY });
    }
  }
  up(t) {
    const e = this.press;
    if (!(!e || t.pointerId !== e.id)) {
      if (this.dragging)
        this.h.release(Et(this.samples, t.timeStamp));
      else if (!this.pressOpenedMenu && t.timeStamp - e.t <= P.clickMs) {
        const i = t.timeStamp - this.lastClick.t <= P.doubleMs && this.lastClick.type === e.type;
        this.lastClick = i ? { t: -1 / 0, type: "" } : { t: t.timeStamp, type: e.type }, this.h.click(i ? "dblclick" : e.type === "touch" ? "tap" : "click");
      }
      this.reset();
    }
  }
  cancel() {
    this.press && (this.dragging && this.h.release({ x: 0, y: 0 }), this.reset());
  }
  cancelLongPress() {
    this.longPress && this.win.clearTimeout(this.longPress), this.longPress = 0;
  }
  reset() {
    this.cancelLongPress(), this.press = null, this.dragging = !1, this.samples = [];
  }
  on(t, e, i, s) {
    const o = i;
    t.addEventListener(e, o, s), this.cleanups.push(() => t.removeEventListener(e, o, s));
  }
}
const de = [
  "a[href]",
  "button",
  "input",
  "select",
  "textarea",
  "label",
  "summary",
  "details",
  "iframe",
  "video",
  "audio",
  '[role="button"]',
  '[role="link"]',
  '[role="menuitem"]',
  '[role="tab"]',
  '[role="checkbox"]',
  '[role="switch"]',
  '[role="option"]',
  "[onclick]",
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]:not([tabindex="-1"])'
].join(","), it = 200;
class fe {
  constructor(t, e, i, s, o, r, a, c, l) {
    this.win = t, this.stage = e, this.below = i, this.host = s, this.manifest = o, this.sheet = r, this.anim = a, this.opts = c, this.onCleaned = l, this.placed = [], this.nextId = 1;
    const [h, u] = o.frameSize;
    this.box = [h * 0.25, u * 0.5, h * 0.5, u * 0.5], this.measureBox();
  }
  get count() {
    return this.placed.filter((t) => !t.gone).length;
  }
  get hasRoom() {
    return this.count < this.opts.max;
  }
  /** Whether a poop at viewport (x, y) would cover nothing clickable. */
  isSafeAt(t, e, i) {
    const s = this.footprint(t, e, i), o = this.win.document, r = o.documentElement;
    if (s.left < 0 || s.top < 0 || s.right > r.clientWidth || s.bottom > r.clientHeight) return !1;
    const a = [];
    for (const l of [0.15, 0.5, 0.85]) for (const h of [0.15, 0.5, 0.85])
      a.push([s.left + s.width * l, s.top + s.height * h]);
    const c = Math.min(r.clientHeight - 1, e + 3);
    for (const l of [0.05, 0.5, 0.95]) a.push([s.left + s.width * l, c]);
    return a.every(([l, h]) => {
      const u = o.elementsFromPoint(l, h).find((f) => f !== this.host && !this.host.contains(f));
      return !u || !u.closest(de);
    });
  }
  /** Drop a poop with its feet at viewport (x, y), pinned to `on` (or the page). */
  drop(t, e, i, s, o) {
    const r = i && i.isConnected ? i : this.contentBehind(t, e, o);
    let a;
    if (r) {
      const u = r.getBoundingClientRect();
      a = { kind: "element", el: r, dx: t - u.left, dy: e - u.top };
    } else {
      const u = this.scroll();
      a = { kind: "page", x: t + u.x, y: e + u.y };
    }
    const c = { id: this.nextId++, born: s, anchor: a }, l = this.placed.filter((u) => !u.gone), { removed: h } = qt(l.map((u) => u.poop), c, this.opts.max);
    h.forEach((u) => this.remove(u.id)), this.placed.push(this.create(c));
  }
  /** Remove poops past their time. Call with sim time. */
  expire(t) {
    const { removed: e } = Jt(this.placed.filter((i) => !i.gone).map((i) => i.poop), t, this.opts.ttl);
    e.forEach((i) => this.remove(i.id));
  }
  render(t, e, i) {
    const s = this.manifest.animations[this.anim];
    if (!s) return;
    const [o, r] = this.manifest.frameSize, [a, c] = this.manifest.anchor, l = (h) => Math.round(h * i) / i;
    for (const h of this.placed) {
      if (h.gone) continue;
      const u = this.position(h.poop.anchor);
      if (!u) {
        this.remove(h.poop.id, !1);
        continue;
      }
      const f = h.el.style;
      f.width = `${o * e}px`, f.height = `${r * e}px`, f.backgroundSize = `${this.sheet.width * e}px ${this.sheet.height * e}px`, f.transform = `translate3d(${l(u.x - a * e)}px,${l(u.y - c * e)}px,0)`;
      const { frame: m } = W(s, t - h.poop.born), x = `${m}:${e}`;
      if (x !== h.frameKey) {
        const y = B(this.manifest, s, m);
        f.backgroundPosition = `${-y.x * e}px ${-y.y * e}px`;
        const [p, d, g, w] = this.box, v = h.hit.style;
        v.left = `${p * e}px`, v.top = `${d * e}px`, v.width = `${g * e}px`, v.height = `${w * e}px`, h.frameKey = x;
      }
    }
  }
  clear() {
    for (const t of [...this.placed]) this.remove(t.poop.id, !1);
  }
  destroy() {
    for (const t of this.placed) t.el.remove();
    this.placed = [];
  }
  /** The innermost page element behind the pile that isn't <html>, <body> or ours. */
  contentBehind(t, e, i) {
    var a;
    const s = this.footprint(t, e, i), o = this.win.document;
    return (a = o.elementsFromPoint(s.left + s.width / 2, s.top + s.height / 2).find((c) => c !== this.host && !this.host.contains(c) && c !== o.documentElement && c !== o.body)) != null ? a : null;
  }
  /** How far the page has scrolled, whether the window or <body> is the scroller. */
  scroll() {
    const e = this.win.document.body;
    return { x: this.win.scrollX + (e ? e.scrollLeft : 0), y: this.win.scrollY + (e ? e.scrollTop : 0) };
  }
  position(t) {
    if (t.kind === "page") {
      const i = this.scroll();
      return { x: t.x - i.x, y: t.y - i.y };
    }
    if (!t.el.isConnected) return null;
    const e = t.el.getBoundingClientRect();
    return e.width === 0 && e.height === 0 ? null : { x: e.left + t.dx, y: e.top + t.dy };
  }
  footprint(t, e, i) {
    const [s, o] = this.manifest.anchor, [r, a, c, l] = this.box, h = t + (r - s) * i, u = e + (a - o) * i;
    return { left: h, top: u, width: c * i, height: l * i, right: h + c * i, bottom: u + l * i };
  }
  create(t) {
    const e = this.win.document, i = e.createElement("div"), s = i.style;
    s.position = "absolute", s.left = "0", s.top = "0", s.backgroundImage = `url("${this.sheet.url}")`, s.backgroundRepeat = "no-repeat", s.imageRendering = "pixelated", s.pointerEvents = "none", s.transition = `opacity ${it}ms ease-out`;
    const o = e.createElement("div"), r = o.style;
    return r.position = "absolute", r.pointerEvents = "auto", r.cursor = "pointer", r.touchAction = "manipulation", r.setProperty("-webkit-tap-highlight-color", "transparent"), o.addEventListener("click", () => {
      this.remove(t.id) && this.onCleaned();
    }), i.append(o), this.stage.insertBefore(i, this.below), { poop: t, el: i, hit: o, frameKey: "", gone: !1 };
  }
  /** Fade a poop out (or drop it at once). Returns false if it was already gone. */
  remove(t, e = !0) {
    const i = this.placed.find((o) => o.poop.id === t);
    if (!i || i.gone) return !1;
    i.gone = !0, i.hit.style.pointerEvents = "none";
    const s = () => {
      i.el.remove(), this.placed = this.placed.filter((o) => o !== i);
    };
    return e ? (i.el.style.opacity = "0", this.win.setTimeout(s, it)) : s(), !0;
  }
  /** Find the pile's opaque area so clicks and the safety check match what's drawn. */
  async measureBox() {
    const t = this.manifest.animations[this.anim];
    if (t)
      try {
        const e = this.win.document.createElement("img");
        e.src = this.sheet.url, await e.decode();
        const i = this.win.document.createElement("canvas");
        i.width = e.naturalWidth, i.height = e.naturalHeight;
        const s = i.getContext("2d", { willReadFrequently: !0 });
        if (!s) return;
        s.drawImage(e, 0, 0);
        let [o, r, a, c] = [1 / 0, 1 / 0, -1, -1];
        for (let l = 0; l < t.frames; l++) {
          const h = B(this.manifest, t, l), u = s.getImageData(h.x, h.y, h.w, h.h).data;
          for (let f = 0; f < h.h; f++) for (let m = 0; m < h.w; m++)
            u[(f * h.w + m) * 4 + 3] > 0 && (o = Math.min(o, m), r = Math.min(r, f), a = Math.max(a, m), c = Math.max(c, f));
        }
        a >= 0 && (this.box = [o, r, a - o + 1, c - r + 1], this.placed.forEach((l) => {
          l.frameKey = "";
        }));
      } catch {
      }
  }
}
const pe = (n) => ({ last: n, idle: !1 });
function me(n, t) {
  return { state: { last: t, idle: !1 }, event: n.idle ? "visitor-return" : null };
}
function ge(n, t, e) {
  return n.idle || t - n.last < e ? { state: n, event: null } : { state: { ...n, idle: !0 }, event: "visitor-idle" };
}
const nt = {
  /** How often to look at the clock and the URL, ms. */
  checkMs: 250,
  /** Away from the tab at least this long before "tab-return" fires, ms. */
  tabAwayMs: 3e4
}, ye = ["pointermove", "pointerdown", "keydown", "wheel", "scroll", "touchstart"];
class be {
  constructor(t, e, i) {
    this.win = t, this.emit = e, this.idleAfter = i, this.lastCheck = -1 / 0, this.hiddenAt = null, this.cleanups = [];
    const s = t.performance.now();
    this.idle = pe(s), this.lastInput = s, this.href = t.location.href;
    const o = () => {
      this.lastInput = this.win.performance.now();
    };
    for (const r of ye) this.listen(t, r, o, { passive: !0, capture: !0 });
    this.listen(t.document, "copy", () => this.emit("copy"), { passive: !0 }), this.listen(t.document, "visibilitychange", () => this.visibility(), { passive: !0 });
  }
  /** Call often (every frame is fine); it does real work at most every checkMs. */
  tick() {
    const t = this.win.performance.now();
    if (t - this.lastCheck < nt.checkMs) return;
    if (this.lastCheck = t, this.lastInput > this.idle.last) {
      const s = me(this.idle, this.lastInput);
      this.idle = s.state, s.event && this.emit(s.event);
    }
    const e = ge(this.idle, t, this.idleAfter);
    this.idle = e.state, e.event && this.emit(e.event);
    const i = this.win.location.href;
    if (i !== this.href) {
      const s = this.href;
      this.href = i, this.emit("page-change", { from: s, to: i });
    }
  }
  destroy() {
    this.cleanups.forEach((t) => t()), this.cleanups = [];
  }
  visibility() {
    const t = this.win.performance.now();
    if (this.win.document.hidden) {
      this.hiddenAt = t;
      return;
    }
    this.hiddenAt !== null && t - this.hiddenAt >= nt.tabAwayMs && this.emit("tab-return", { away: Math.round(t - this.hiddenAt) }), this.hiddenAt = null, this.lastInput = t;
  }
  listen(t, e, i, s) {
    t.addEventListener(e, i, s), this.cleanups.push(() => t.removeEventListener(e, i, s));
  }
}
class X {
  constructor(t, e, i, s) {
    this.manifest = i, this.sheet = s, this.last = { frameKey: "", transform: "", size: "", hit: "", cursor: "" }, this.el = t.createElement("div");
    const o = this.el.style;
    o.position = "absolute", o.left = "0", o.top = "0", o.backgroundImage = `url("${s.url}")`, o.backgroundRepeat = "no-repeat", o.imageRendering = "pixelated", o.pointerEvents = "none", o.willChange = "transform", this.hit = t.createElement("div");
    const r = this.hit.style;
    r.position = "absolute", r.left = "0", r.top = "0", r.pointerEvents = "auto", r.touchAction = "none", r.userSelect = "none", r.setProperty("-webkit-user-select", "none"), r.setProperty("-webkit-touch-callout", "none"), r.setProperty("-webkit-tap-highlight-color", "transparent"), e.append(this.el, this.hit);
  }
  /** Size of one sheet pixel in CSS px: a whole number of device pixels. */
  static pixelSize(t, e) {
    return Math.max(1, Math.round(t * e)) / e;
  }
  draw(t) {
    const e = this.manifest.animations[t.anim];
    if (!e) return;
    const i = X.pixelSize(t.scale, t.dpr), s = (E) => Math.round(E * t.dpr) / t.dpr, [o, r] = this.manifest.frameSize, [a, c] = this.manifest.anchor, l = this.el.style, h = `${i}`;
    h !== this.last.size && (l.width = `${o * i}px`, l.height = `${r * i}px`, l.backgroundSize = `${this.sheet.width * i}px ${this.sheet.height * i}px`, this.last.size = h, this.last.frameKey = "");
    const { frame: u } = W(e, t.elapsed), f = `${t.anim}:${u}`;
    if (f !== this.last.frameKey) {
      const E = B(this.manifest, e, u);
      l.backgroundPosition = `${-E.x * i}px ${-E.y * i}px`, this.last.frameKey = f;
    }
    const m = t.facing === 1 != (this.manifest.facing === "right"), x = m ? o - a : a, y = s(t.x - x * i), p = s(t.y - c * i), d = `translate3d(${y}px,${p}px,0)${m ? " scaleX(-1)" : ""}`;
    d !== this.last.transform && (l.transform = d, this.last.transform = d);
    const [g, w, v, b] = this.manifest.hitbox, T = y + (m ? o - g - v : g) * i, V = `${T},${p + w * i},${v * i},${b * i}`;
    if (V !== this.last.hit) {
      const E = this.hit.style;
      E.width = `${v * i}px`, E.height = `${b * i}px`, E.transform = `translate3d(${T}px,${p + w * i}px,0)`, this.last.hit = V;
    }
    t.cursor !== this.last.cursor && (this.hit.style.cursor = t.cursor, this.last.cursor = t.cursor);
  }
  remove() {
    this.el.remove(), this.hit.remove();
  }
}
const we = "sidekick:v1";
class xe {
  constructor(t, e, i) {
    this.win = t, this.key = e, this.enabled = i, this.cleanup = null;
  }
  read() {
    if (!this.enabled) return {};
    try {
      return tt(this.win.localStorage.getItem(this.key));
    } catch {
      return {};
    }
  }
  write(t) {
    if (this.enabled)
      try {
        this.win.localStorage.setItem(this.key, te(t));
      } catch {
      }
  }
  /** Changes made in another tab of the same site. */
  onExternalChange(t) {
    if (!this.enabled || this.cleanup) return;
    const e = (i) => {
      i.key === this.key && t(tt(i.newValue));
    };
    this.win.addEventListener("storage", e), this.cleanup = () => this.win.removeEventListener("storage", e);
  }
  destroy() {
    var t;
    (t = this.cleanup) == null || t.call(this), this.cleanup = null;
  }
}
const ve = [
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "img",
  "picture",
  "video",
  "canvas",
  "svg",
  "button",
  "input",
  "textarea",
  "select",
  "pre",
  "blockquote",
  "table",
  "figure",
  "hr",
  "li",
  "dt",
  "dd",
  "form",
  "fieldset",
  "nav",
  "header",
  "footer",
  "aside",
  "article",
  "section",
  '[role="button"]',
  "[data-sidekick-surface]"
].join(","), L = {
  /** Rediscover elements this often, ms (route changes, lazy content). */
  rediscoverMs: 2e3,
  /** Re-measure at most this often while scrolling or after DOM changes, ms. */
  remeasureMs: 120,
  /** Re-measure at least this often anyway (layout shifts without DOM changes), ms. */
  refreshMs: 1e3,
  /** After a DOM change, rediscover elements no sooner than this, ms. */
  rediscoverAfterChangeMs: 250,
  /** Keep at most this many candidates. */
  maxCandidates: 400
};
class Se {
  constructor(t, e, i) {
    this.win = t, this.selector = e, this.host = i, this.elements = [], this.ids = /* @__PURE__ */ new WeakMap(), this.byId = /* @__PURE__ */ new Map(), this.nextId = 1, this.cache = [], this.discoveredAt = -1 / 0, this.measuredAt = -1 / 0, this.dirty = !0, this.changed = !1, this.cleanups = [];
    const s = () => {
      this.dirty = !0;
    };
    for (const [r, a] of [[t, "scroll"], [t, "resize"]])
      r.addEventListener(a, s, { passive: !0, capture: !0 }), this.cleanups.push(() => r.removeEventListener(a, s, { capture: !0 }));
    const o = t.MutationObserver;
    if (o) {
      const r = new o((a) => {
        a.every((c) => i.contains(c.target)) || (this.changed = !0, this.dirty = !0);
      });
      r.observe(t.document.documentElement, { childList: !0, subtree: !0, attributes: !0, attributeFilter: ["class", "style", "hidden"] }), this.cleanups.push(() => r.disconnect());
    }
  }
  destroy() {
    this.cleanups.forEach((t) => t()), this.cleanups = [];
  }
  /** Current surfaces in viewport px. Cheap to call every frame. */
  list(t, e) {
    const i = t - this.discoveredAt;
    (i >= L.rediscoverMs || this.changed && i >= L.rediscoverAfterChangeMs) && (this.discover(), this.discoveredAt = t, this.changed = !1, this.dirty = !0);
    const s = t - this.measuredAt;
    return this.dirty && s >= L.remeasureMs || s >= L.refreshMs ? (this.cache = this.measure(e), this.measuredAt = t, this.dirty = !1) : this.changed && (this.cache = this.cache.filter((o) => {
      var r;
      return (r = this.byId.get(o.id)) == null ? void 0 : r.isConnected;
    })), this.cache;
  }
  /** The element behind a surface id, if it is still on the page. */
  elementOf(t) {
    const e = this.byId.get(t);
    return e && e.isConnected ? e : null;
  }
  /** Fresh measurement of one surface (the one the pet stands on), or null if it's gone. */
  measureOne(t) {
    const e = this.byId.get(t);
    if (!e || !e.isConnected) return null;
    const i = e.getBoundingClientRect();
    return i.width <= 0 || i.height <= 0 ? null : { id: t, left: i.left, right: i.right, top: i.top };
  }
  discover() {
    const t = this.win.document;
    let e;
    try {
      e = Array.from(t.querySelectorAll(this.selector));
    } catch {
      e = [];
    }
    this.elements = e.filter((i) => !this.host.contains(i) && !i.closest("[data-sidekick-ignore]")).slice(0, L.maxCandidates), this.byId.clear();
    for (const i of this.elements) {
      let s = this.ids.get(i);
      s === void 0 && (s = this.nextId++, this.ids.set(i, s)), this.byId.set(s, i);
    }
  }
  measure(t) {
    const e = this.win.document, i = e.documentElement.clientWidth, s = e.documentElement.clientHeight, o = [];
    for (const r of this.elements) {
      if (!r.isConnected) continue;
      const a = r.getBoundingClientRect();
      if (a.height < 4 || a.top < t.minTop || a.top > s - 4) continue;
      const c = Math.max(0, a.left), l = Math.min(i, a.right);
      l - c < t.minWidth || Me(r) && Ee(e, r, c, l, a.top, this.host) && o.push({ id: this.ids.get(r), left: c, right: l, top: a.top });
    }
    return o.sort((r, a) => r.top - a.top || r.left - a.left), o.filter((r, a) => {
      const c = o[a - 1];
      return !c || Math.abs(c.top - r.top) > 1 || Math.abs(c.left - r.left) > 1 || Math.abs(c.right - r.right) > 1;
    });
  }
}
function Me(n) {
  const t = n.checkVisibility;
  return t ? t.call(n, { opacityProperty: !0, visibilityProperty: !0 }) : !0;
}
function Ee(n, t, e, i, s, o) {
  const r = s + 1;
  for (const a of [e + (i - e) * 0.25, e + (i - e) * 0.75]) {
    const c = n.elementFromPoint(a, r);
    if (!c || c === o || t === c || t.contains(c) || c.contains(t)) return !0;
  }
  return !1;
}
const ke = 30, Ae = 2.5, Te = 1.4, $e = 10, k = "[sidekick]", R = Symbol.for("sidekick"), j = "sidekick:instance", st = (n) => {
  const t = Math.round(Number(n));
  return Number.isFinite(t) ? Math.min(8, Math.max(1, t)) : 2;
};
class Ie {
  constructor(t, e = {}) {
    var a, c, l, h, u, f, m, x, y;
    this.win = t, this.petDefs = /* @__PURE__ */ new Map(), this.calm = !1, this.behavior = Kt(), this.menu = null, this.restore = null, this.m = null, this.generation = 0, this.petCache = /* @__PURE__ */ new Map(), this.state = null, this.simTime = 0, this.timeScale = 1, this.status = "loading", this.listeners = /* @__PURE__ */ new Set(), this.settingsListeners = /* @__PURE__ */ new Set(), this.pending = [], this.cursor = null, this.cursorNear = !1, this.grabOffset = { x: 0, y: 0 }, this.globalCleanups = [];
    const i = (p) => typeof p == "string" ? p : (this.petDefs.set(p.id, p), p.id), s = i((l = (c = e.pet) != null ? c : (a = e.pets) == null ? void 0 : a[0]) != null ? l : "cream-cat"), o = [.../* @__PURE__ */ new Set([s, ...((h = e.pets) != null ? h : []).map(i)])];
    this.opts = {
      pets: o,
      petsBaseUrl: ot((u = e.petsBaseUrl) != null ? u : "/pets/"),
      petUrls: Object.fromEntries(Object.entries((f = e.petUrls) != null ? f : {}).map(([p, d]) => [p, ot(d)])),
      scale: st((m = e.scale) != null ? m : 2),
      surfaces: e.surfaces === void 0 ? ve : e.surfaces,
      menu: e.menu === !0,
      restoreButton: e.restoreButton === "bottom-left" ? "bottom-left" : "bottom-right",
      idleAfter: typeof e.idleAfter == "number" && e.idleAfter >= 1e3 ? e.idleAfter : 6e4
    }, this.poopOpts = Qt(e.poop), this.rng = e.seed === void 0 ? Math.random : Zt(e.seed), this.store = new xe(t, (x = e.storageKey) != null ? x : we, e.persist !== !1), this.settings = ee({ enabled: e.enabled !== !1, pet: s }, this.store.read(), o), this.behavior.addCondition("poop-spot", () => this.poopSpotIsGood()), this.watchMotion((y = e.motion) != null ? y : "auto"), this.host = ne(t.document), this.opts.menu && (this.menu = new le(t, this.host.stage)), this.store.onExternalChange((p) => this.applyExternal(p));
    const r = () => this.save();
    t.addEventListener("pagehide", r), this.globalCleanups.push(() => t.removeEventListener("pagehide", r)), this.settings.enabled ? this.mount() : this.showDisabled();
  }
  // ---- Public API ---------------------------------------------------------
  /** Show the pet (and remember the choice). */
  enable() {
    this.status === "destroyed" || this.settings.enabled || (this.settings = { ...this.settings, enabled: !0 }, this.save(), this.notify(), this.mount());
  }
  /** Hide the pet (and remember the choice). Its poops go with it. */
  disable() {
    this.status === "destroyed" || !this.settings.enabled || (this.unmount(), this.settings = { ...this.settings, enabled: !1 }, this.save(), this.notify(), this.showDisabled());
  }
  toggle() {
    this.settings.enabled ? this.disable() : this.enable();
  }
  isEnabled() {
    return this.settings.enabled;
  }
  /** Switch to another pet from `pets`. Resolves once it is on screen (or right away when hidden). */
  async setPet(t) {
    if (this.status === "destroyed" || t === this.settings.pet) return;
    if (!this.opts.pets.includes(t)) {
      console.warn(k, `Pet "${t}" is not in the "pets" option; ignoring setPet.`);
      return;
    }
    const e = !!this.m;
    e && this.unmount(), this.settings = { ...this.settings, pet: t }, this.save(), this.notify(), (e || this.settings.enabled) && await this.mount();
  }
  /** Current choices: on/off and pet. */
  getSettings() {
    return { enabled: this.settings.enabled, pet: this.settings.pet };
  }
  /** Pets the visitor can choose from. */
  getPets() {
    return [...this.opts.pets];
  }
  /** Listen to on/off and pet changes (from the API, the menu, or another tab). */
  subscribe(t) {
    return this.settingsListeners.add(t), () => this.settingsListeners.delete(t);
  }
  /** Send an event to the pet's rules, e.g. emit('tool-completed'). Ignored while hidden. */
  emit(t, e) {
    if (!(typeof t != "string" || !t || !this.settings.enabled)) {
      if (!this.state || !this.m) {
        this.pending.length < $e && this.pending.push([t, e]);
        return;
      }
      this.apply(Xt(this.state, t, this.ctx(0), e));
    }
  }
  /**
   * Start an action now, ignoring rules. Rules with at least `priority`
   * (default 0) can still interrupt it.
   */
  play(t, e = 0) {
    this.state && this.m && this.apply(jt(this.state, t, this.ctx(0), e));
  }
  /** Add or replace an action. Returns warnings (empty when all is well). */
  registerAction(t) {
    return this.warn(this.behavior.addAction(t));
  }
  /** Add or replace a rule. Returns warnings (empty when all is well). */
  registerRule(t) {
    return this.warn(this.behavior.addRule(t));
  }
  removeRule(t) {
    return this.behavior.removeRule(t);
  }
  /** Add or replace a named condition that rules can list in `if`. */
  registerCondition(t, e) {
    this.behavior.addCondition(t, e);
  }
  /** Listen to what the pet does. Returns an unsubscribe function. */
  on(t) {
    return this.listeners.add(t), () => this.listeners.delete(t);
  }
  /** Remove every poop from the page. */
  clearPoops() {
    var t, e;
    (e = (t = this.m) == null ? void 0 : t.poops) == null || e.clear();
  }
  setScale(t) {
    this.opts.scale = st(t);
  }
  /** Debug only: run simulated time faster (1–60×). */
  setTimeScale(t) {
    this.timeScale = Math.min(60, Math.max(1, Number(t) || 1));
  }
  debug() {
    var s, o, r;
    const t = this.state, e = t == null ? void 0 : t.action, i = this.simTime;
    return {
      status: this.status,
      pet: this.settings.pet,
      scale: this.opts.scale,
      simTime: Math.round(i),
      timeScale: this.timeScale,
      rules: this.behavior.allRules(),
      actions: [...this.behavior.actions.keys()],
      ...t ? {
        anim: t.anim,
        action: e == null ? void 0 : e.id,
        step: e == null ? void 0 : e.step,
        priority: e == null ? void 0 : e.priority,
        rule: e == null ? void 0 : e.rule,
        stepEndsIn: (e == null ? void 0 : e.deadline) == null ? null : Math.max(0, Math.round(e.deadline - i)),
        x: Math.round(t.body.x),
        y: Math.round(t.body.y),
        facing: t.body.facing,
        mode: t.mode,
        cursorNear: this.cursorNear,
        poops: (r = (o = (s = this.m) == null ? void 0 : s.poops) == null ? void 0 : o.count) != null ? r : 0,
        cooldowns: Object.fromEntries(
          Object.entries(t.cooldowns).filter(([, a]) => a > i).map(([a, c]) => [a, Math.round(c - i)])
        ),
        lastDone: Object.fromEntries(Object.entries(t.lastDone).map(([a, c]) => [a, Math.round(i - c)]))
      } : {}
    };
  }
  /** Debug only: the surfaces the pet currently sees, and the one it stands on. */
  debugSurfaces() {
    return !this.m || !this.state ? { surfaces: [], on: null } : { surfaces: this.ctx(0).surfaces.slice(), on: this.state.mode === "ground" ? this.state.on : null };
  }
  /** Remove the pet and everything it added to the page. */
  destroy() {
    var e, i, s;
    if (this.status === "destroyed") return;
    this.save(), this.unmount(), this.status = "destroyed", this.globalCleanups.forEach((o) => o()), this.globalCleanups = [], this.store.destroy(), (e = this.menu) == null || e.close(), (i = this.restore) == null || i.remove(), (s = this.host) == null || s.remove(), this.host = null, this.listeners.clear(), this.settingsListeners.clear();
    const t = this.win;
    t[R] === this && (delete t[R], this.win.dispatchEvent(new Event(j)));
  }
  // ---- Mounting -----------------------------------------------------------
  async mount() {
    var v;
    if (!this.host || this.m) return;
    const t = ++this.generation;
    this.status = "loading", (v = this.restore) == null || v.remove(), this.restore = null;
    const e = this.settings.pet;
    let i;
    try {
      i = await this.loadPet(e);
    } catch (b) {
      t === this.generation && (this.status = "error", console.error(k, b));
      return;
    }
    if (t !== this.generation || !this.host || !this.settings.enabled || this.settings.pet !== e) return;
    const { manifest: s, sheet: o } = i, r = this.win, a = r.document, c = new X(a, this.host.stage, s, o), l = this.opts.surfaces ? new Se(r, this.opts.surfaces, this.host.el) : null, h = U(s, "poopEntity", () => 0), u = this.poopOpts && h ? new fe(r, this.host.stage, c.el, this.host.el, s, o, h, this.poopOpts, () => this.emit("poop-cleaned")) : null, f = new ue(r, c.hit, {
      hover: () => this.emit("hover"),
      click: (b) => this.emit(b),
      cursor: (b) => {
        this.cursor = b;
      },
      grab: (b) => {
        this.state && (this.grabOffset = { x: this.state.body.x - b.x, y: this.state.body.y - b.y }, this.apply(zt(this.state, this.ctx(0))));
      },
      drag: (b) => {
        this.state && (this.state = Dt(this.state, b.x + this.grabOffset.x, b.y + this.grabOffset.y, this.ctx(0)));
      },
      release: (b) => {
        this.state && this.apply(Nt(this.state, b, this.ctx(0)));
      },
      ...this.menu ? { menu: () => this.openMenu() } : {}
    }), m = new be(r, (b, T) => this.emit(b, T), this.opts.idleAfter), x = new re(r, (b) => this.step(b), () => this.render()), y = [], p = () => {
      this.syncVisibility(), a.hidden && this.save();
    };
    a.addEventListener("visibilitychange", p), y.push(() => a.removeEventListener("visibilitychange", p)), this.m = { manifest: s, view: c, input: f, loop: x, sensors: m, scanner: l, poops: u, cleanups: y };
    const d = this.ctx(0), g = this.settings.x === void 0 ? d.minX + this.rng() * (d.maxX - d.minX) : this.settings.x * a.documentElement.clientWidth;
    this.state = Rt(g, d), this.syncVisibility();
    const w = this.pending;
    this.pending = [], w.forEach(([b, T]) => this.emit(b, T));
  }
  unmount() {
    var e, i, s;
    this.generation++, this.pending = [], (e = this.menu) == null || e.close();
    const t = this.m;
    t && (this.saveX(), t.loop.stop(), t.cleanups.forEach((o) => o()), t.input.destroy(), t.sensors.destroy(), (i = t.scanner) == null || i.destroy(), (s = t.poops) == null || s.destroy(), t.view.remove(), this.m = null, this.state = null, this.cursorNear = !1, this.status !== "destroyed" && (this.status = "disabled"));
  }
  showDisabled() {
    this.status = "disabled", this.menu && this.host && !this.restore && (this.restore = new he(this.win, this.host.stage, () => this.enable(), "Bring the pet back", this.opts.restoreButton));
  }
  loadPet(t) {
    let e = this.petCache.get(t);
    return e || (e = this.fetchPet(t), e.catch(() => this.petCache.delete(t)), this.petCache.set(t, e)), e;
  }
  watchMotion(t) {
    var s;
    if (t !== "auto") {
      this.calm = t === "reduced";
      return;
    }
    let e;
    try {
      e = this.win.matchMedia("(prefers-reduced-motion: reduce)");
    } catch {
      return;
    }
    this.calm = e.matches;
    const i = () => {
      this.calm = e.matches;
    };
    (s = e.addEventListener) == null || s.call(e, "change", i), this.globalCleanups.push(() => {
      var o;
      return (o = e.removeEventListener) == null ? void 0 : o.call(e, "change", i);
    });
  }
  async fetchPet(t) {
    var r;
    const e = this.petDefs.get(t);
    if (e) {
      const a = Q(e.manifest);
      if (a.warnings.forEach((c) => console.warn(k, `${t}:`, c)), !a.manifest) throw new Error(`Pet "${t}" has an invalid manifest: ${a.errors.join(" ")}`);
      return { manifest: a.manifest, sheet: await this.loadSheet(e.sheetUrl) };
    }
    const i = (r = this.opts.petUrls[t]) != null ? r : `${this.opts.petsBaseUrl}${encodeURIComponent(t)}/`, s = await this.win.fetch(`${i}manifest.json`);
    if (!s.ok) throw new Error(`Could not load pet "${t}" (${s.status}).`);
    const o = Q(await s.json());
    if (o.warnings.forEach((a) => console.warn(k, `${t}:`, a)), !o.manifest) throw new Error(`Pet "${t}" has an invalid manifest: ${o.errors.join(" ")}`);
    return { manifest: o.manifest, sheet: await this.loadSheet(new URL(o.manifest.sheet, new URL(i, this.win.location.href)).href) };
  }
  async loadSheet(t) {
    const e = this.win.document.createElement("img");
    return e.src = t, await e.decode(), { url: e.src, width: e.naturalWidth, height: e.naturalHeight };
  }
  syncVisibility() {
    this.m && (this.win.document.hidden ? (this.m.loop.stop(), this.status = "paused") : (this.m.loop.start(), this.status = "running"));
  }
  // ---- Settings -----------------------------------------------------------
  saveX() {
    if (!this.state) return;
    const t = this.win.document.documentElement.clientWidth;
    t > 0 && (this.settings = { ...this.settings, x: Math.min(1, Math.max(0, this.state.body.x / t)) });
  }
  save() {
    this.saveX(), this.store.write(this.settings);
  }
  notify() {
    const t = this.getSettings();
    for (const e of this.settingsListeners)
      try {
        e(t);
      } catch (i) {
        console.error(k, "subscriber failed:", i);
      }
  }
  /** Another tab changed the settings: follow along without writing back. */
  applyExternal(t) {
    var o;
    if (this.status === "destroyed") return;
    const e = t.pet && this.opts.pets.includes(t.pet) ? t.pet : this.settings.pet, i = (o = t.enabled) != null ? o : this.settings.enabled;
    if (e === this.settings.pet && i === this.settings.enabled) return;
    (!!this.m && e !== this.settings.pet || !i) && this.unmount(), this.settings = { ...this.settings, pet: e, enabled: i }, this.notify(), i ? this.m || this.mount() : this.showDisabled();
  }
  // ---- Menu ---------------------------------------------------------------
  openMenu() {
    var o, r, a;
    if (!this.menu || !this.state || !this.m) return;
    const t = [], e = (r = (o = this.m.poops) == null ? void 0 : o.count) != null ? r : 0;
    ((a = this.state.action) == null ? void 0 : a.id) !== "sleep" ? t.push({ label: "Take a nap", onSelect: () => this.play("sleep", 50) }) : t.push({ label: "Wake up", onSelect: () => this.play("sit", 60) }), e > 0 && t.push({ label: `Clean up (${e})`, onSelect: () => this.clearPoops() });
    for (const c of this.opts.pets)
      c !== this.settings.pet && t.push({ label: `Switch to ${Pe(c)}`, onSelect: () => void this.setPet(c) });
    t.push({ label: "Hide pet", onSelect: () => this.disable() });
    const i = this.pixelSize(), [, s] = this.m.manifest.frameSize;
    this.menu.open(t, this.state.body.x, this.state.body.y - s * i);
  }
  // ---- Simulation ---------------------------------------------------------
  pixelSize() {
    return X.pixelSize(this.opts.scale, this.win.devicePixelRatio || 1);
  }
  ctx(t) {
    const e = this.m.manifest, i = this.pixelSize(), s = this.win.document.documentElement, o = Math.max(e.anchor[0], e.frameSize[0] - e.anchor[0]) * i, r = e.anchor[1] * i;
    return {
      now: this.simTime,
      dt: t / 1e3,
      rng: this.rng,
      manifest: e,
      behavior: this.behavior,
      minX: o,
      minY: r,
      maxX: s.clientWidth - o,
      floorY: s.clientHeight,
      petW: e.frameSize[0] * i,
      petH: e.frameSize[1] * i,
      walkSpeed: ke * i * e.traits.speed,
      hour: (/* @__PURE__ */ new Date()).getHours(),
      cursor: this.cursor,
      surfaces: this.surfaces(r, e.hitbox[2] * i),
      calm: this.calm
    };
  }
  /** Surfaces for the brain, with the one underfoot measured fresh so the pet rides scrolling exactly. */
  surfaces(t, e) {
    var c, l;
    const i = (c = this.m) == null ? void 0 : c.scanner;
    if (!i) return [];
    const s = i.list(this.win.performance.now(), { minTop: t, minWidth: e }), o = ((l = this.state) == null ? void 0 : l.mode) === "ground" ? this.state.on : null;
    if (o === null) return s;
    const r = i.measureOne(o), a = s.filter((h) => h.id !== o);
    return r ? [...a, r] : a;
  }
  step(t) {
    var i, s, o;
    if (!this.state || !this.m) return;
    const e = t * this.timeScale;
    this.simTime += e, this.apply(_t(this.state, this.ctx(e))), this.checkNear(), (i = this.m) == null || i.sensors.tick(), (o = (s = this.m) == null ? void 0 : s.poops) == null || o.expire(this.simTime);
  }
  /** Emit "near" when the cursor comes close, once per approach. */
  checkNear() {
    const t = this.state;
    if (!t || !this.m) return;
    if (!this.cursor || t.mode !== "ground") {
      this.cursorNear = !1;
      return;
    }
    const e = this.pixelSize(), [i, s] = this.m.manifest.frameSize, o = Math.hypot(this.cursor.x - t.body.x, this.cursor.y - (t.body.y - s * e / 2)), r = i * e * Ae;
    !this.cursorNear && o < r ? (this.cursorNear = !0, this.emit("near")) : this.cursorNear && o > r * Te && (this.cursorNear = !1);
  }
  /** Where the next poop would go, in viewport px. */
  nextPoopSpot() {
    const t = this.state;
    return !t || !this.m || t.mode !== "ground" ? null : Gt(t.body.x, t.body.y, t.body.facing, this.m.manifest.frameSize[0] * this.pixelSize());
  }
  poopSpotIsGood() {
    var i;
    const t = this.nextPoopSpot(), e = (i = this.m) == null ? void 0 : i.poops;
    return !!t && !!e && e.hasRoom && e.isSafeAt(t.x, t.y, this.pixelSize());
  }
  /** The poop step finished: drop the pile if the spot is (still) safe. */
  dropPoop() {
    var s, o, r, a;
    const t = this.nextPoopSpot(), e = (s = this.m) == null ? void 0 : s.poops;
    if (!t || !e || !e.isSafeAt(t.x, t.y, this.pixelSize())) return;
    const i = this.state.on;
    e.drop(t.x, t.y, i === null ? null : (a = (r = (o = this.m) == null ? void 0 : o.scanner) == null ? void 0 : r.elementOf(i)) != null ? a : null, this.simTime, this.pixelSize());
  }
  apply(t) {
    this.state = t.state;
    for (const e of t.effects) {
      e.type === "emit" && e.name === "poop" && this.dropPoop();
      for (const i of this.listeners)
        try {
          i(e);
        } catch (s) {
          console.error(k, "listener failed:", s);
        }
    }
  }
  warn(t) {
    return t.forEach((e) => console.warn(k, e)), t;
  }
  render() {
    var i;
    const t = this.state, e = this.m;
    !t || !e || ((i = e.poops) == null || i.render(this.simTime, this.pixelSize(), this.win.devicePixelRatio || 1), e.view.draw({
      anim: t.anim,
      elapsed: this.simTime - t.animStart,
      x: t.body.x,
      y: t.body.y,
      facing: t.body.facing,
      scale: this.opts.scale,
      dpr: this.win.devicePixelRatio || 1,
      cursor: e.input.isDragging ? "grabbing" : "grab"
    }));
  }
}
function ot(n) {
  return n.endsWith("/") ? n : `${n}/`;
}
function Pe(n) {
  const t = n.replace(/-/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}
function Re(n = {}) {
  if (typeof window == "undefined" || typeof document == "undefined") return null;
  const t = window, e = t[R];
  if (e) return e;
  const i = new Ie(window, n);
  return t[R] = i, window.dispatchEvent(new Event(j)), i;
}
function Le() {
  var n;
  return typeof window == "undefined" ? null : (n = window[R]) != null ? n : null;
}
function Ce() {
  var n;
  (n = Le()) == null || n.destroy();
}
function Oe(n) {
  return typeof window == "undefined" ? () => {
  } : (window.addEventListener(j, n), () => window.removeEventListener(j, n));
}
export {
  Ut as DEFAULT_ACTIONS,
  Wt as DEFAULT_RULES,
  Ie as Sidekick,
  Ce as destroy,
  Le as getInstance,
  Re as init,
  Q as validateManifest,
  Oe as watchInstance
};
