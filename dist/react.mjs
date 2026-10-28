"use client";
import { useRef as m, useEffect as f, useSyncExternalStore as p } from "react";
import { init as y, getInstance as n, watchInstance as E } from "./sidekick.mjs";
let a = 0;
function R(e) {
  const t = m(e.onEvent);
  t.current = e.onEvent;
  const s = m(e);
  return f(() => {
    a++;
    const { onEvent: i, ...c } = s.current, u = y(c), l = u == null ? void 0 : u.on((o) => {
      var b;
      return (b = t.current) == null ? void 0 : b.call(t, o);
    });
    return () => {
      l == null || l(), a--, setTimeout(() => {
        var o;
        a === 0 && ((o = n()) == null || o.destroy());
      }, 0);
    };
  }, []), null;
}
const d = { ready: !1, enabled: !1, pet: null, pets: [] };
let r = d;
function g() {
  const e = n(), t = e ? { ready: !0, ...e.getSettings(), pets: e.getPets() } : d;
  return t.ready === r.ready && t.enabled === r.enabled && t.pet === r.pet && t.pets.join() === r.pets.join() || (r = t), r;
}
function k(e) {
  var i;
  let t = (i = n()) == null ? void 0 : i.subscribe(e);
  const s = E(() => {
    var c;
    t == null || t(), t = (c = n()) == null ? void 0 : c.subscribe(e), e();
  });
  return () => {
    s(), t == null || t();
  };
}
const P = {
  enable: () => {
    var e;
    return (e = n()) == null ? void 0 : e.enable();
  },
  disable: () => {
    var e;
    return (e = n()) == null ? void 0 : e.disable();
  },
  toggle: () => {
    var e;
    return (e = n()) == null ? void 0 : e.toggle();
  },
  setPet: (e) => {
    var t, s;
    return (s = (t = n()) == null ? void 0 : t.setPet(e)) != null ? s : Promise.resolve();
  },
  emit: (e, t) => {
    var s;
    return (s = n()) == null ? void 0 : s.emit(e, t);
  }
};
function S() {
  return { ...p(k, g, () => d), ...P, instance: n() };
}
export {
  R as Sidekick,
  S as useSidekick
};
