// Pet manifest: types and validation. Pure — no DOM.
// A malformed manifest never throws: bad parts are dropped with a warning,
// and only a manifest that can't render anything at all is rejected.

export interface AnimationDef {
  /** Row in the sprite sheet (0-based). */
  row: number;
  /** Number of frames, read left to right starting at `col`. */
  frames: number;
  fps: number;
  loop: boolean;
  /** First column of the animation (0-based). Defaults to 0. */
  col?: number;
  label?: string;
}

/** A role maps to one animation, or to several that are picked at random. */
export type RoleValue = string | string[];

export interface Traits {
  /** Multiplier on walk/run speed. */
  speed: number;
  /** 0..1, how eager the pet is to jump onto page elements. */
  jumpiness: number;
  /** 0..1, how much the pet likes to stay near the cursor. */
  clinginess: number;
}

export interface PetManifest {
  id: string;
  name: string;
  /** Sheet file name, relative to the manifest. */
  sheet: string;
  frameSize: [number, number];
  /** Optional; used to check that animations fit inside the sheet. */
  sheetSize?: [number, number];
  /** Point inside a frame that sits on the ground, in sheet pixels. */
  anchor: [number, number];
  /** Direction the artwork faces. The renderer mirrors it for the other way. */
  facing: 'left' | 'right';
  /** Clickable area inside a frame as [x, y, width, height] in sheet px. Default: the whole frame. */
  hitbox: [number, number, number, number];
  animations: Record<string, AnimationDef>;
  roles: Record<string, RoleValue>;
  traits: Traits;
}

export interface ValidationResult {
  manifest: PetManifest | null;
  errors: string[];
  warnings: string[];
}

export const DEFAULT_TRAITS: Traits = { speed: 1, jumpiness: 0.2, clinginess: 0.5 };

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isPosInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v > 0;
const isNonNegInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;
const isPair = (v: unknown, check: (n: unknown) => boolean): v is [number, number] =>
  Array.isArray(v) && v.length === 2 && check(v[0]) && check(v[1]);
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export function validateManifest(input: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const fail = (): ValidationResult => ({ manifest: null, errors, warnings });

  if (!isObj(input)) {
    errors.push('Manifest must be a JSON object.');
    return fail();
  }
  const id = input.id;
  if (typeof id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(id)) {
    errors.push('"id" must be a lowercase slug like "cream-cat".');
  }
  if (typeof input.sheet !== 'string' || input.sheet === '') {
    errors.push('"sheet" must be the sprite sheet file name.');
  }
  if (!isPair(input.frameSize, isPosInt)) {
    errors.push('"frameSize" must be [width, height] in whole pixels.');
  }
  if (!isObj(input.animations)) {
    errors.push('"animations" must be an object.');
  }
  if (errors.length) return fail();

  const frameSize = input.frameSize as [number, number];
  const [fw, fh] = frameSize;

  let sheetSize: [number, number] | undefined;
  if (input.sheetSize !== undefined) {
    if (isPair(input.sheetSize, isPosInt)) sheetSize = input.sheetSize;
    else warnings.push('"sheetSize" is not [width, height]; ignoring it.');
  }
  const cols = sheetSize ? Math.floor(sheetSize[0] / fw) : Infinity;
  const rows = sheetSize ? Math.floor(sheetSize[1] / fh) : Infinity;

  const animations: Record<string, AnimationDef> = {};
  for (const [name, raw] of Object.entries(input.animations as Record<string, unknown>)) {
    const bad = (why: string) => warnings.push(`Animation "${name}" dropped: ${why}.`);
    if (!isObj(raw)) { bad('not an object'); continue; }
    const col = raw.col === undefined ? 0 : raw.col;
    if (!isNonNegInt(raw.row)) { bad('"row" must be a whole number ≥ 0'); continue; }
    if (!isNonNegInt(col)) { bad('"col" must be a whole number ≥ 0'); continue; }
    if (!isPosInt(raw.frames)) { bad('"frames" must be a whole number ≥ 1'); continue; }
    if (typeof raw.fps !== 'number' || !(raw.fps > 0)) { bad('"fps" must be > 0'); continue; }
    if (raw.row >= rows) { bad(`row ${raw.row} is outside the ${rows}-row sheet`); continue; }
    if (col + raw.frames > cols) { bad(`frames run past the ${cols}-column sheet`); continue; }
    animations[name] = {
      row: raw.row,
      col,
      frames: raw.frames,
      fps: raw.fps,
      loop: raw.loop !== false,
      ...(typeof raw.label === 'string' ? { label: raw.label } : {}),
    };
  }
  if (Object.keys(animations).length === 0) {
    errors.push('No usable animations.');
    return fail();
  }

  const roles: Record<string, RoleValue> = {};
  if (input.roles !== undefined && !isObj(input.roles)) {
    warnings.push('"roles" must be an object; ignoring it.');
  } else if (isObj(input.roles)) {
    for (const [role, raw] of Object.entries(input.roles)) {
      const names = (Array.isArray(raw) ? raw : [raw]).filter((n): n is string => typeof n === 'string');
      const known = names.filter((n) => n in animations);
      for (const n of names) {
        if (!(n in animations)) warnings.push(`Role "${role}" refers to unknown animation "${n}".`);
      }
      if (known.length === 0) {
        warnings.push(`Role "${role}" dropped: no usable animations.`);
        continue;
      }
      roles[role] = Array.isArray(raw) ? known : known[0]!;
    }
  }

  let anchor: [number, number] = [Math.floor(fw / 2), fh];
  if (input.anchor !== undefined) {
    if (isPair(input.anchor, (n) => typeof n === 'number')) anchor = input.anchor;
    else warnings.push('"anchor" is not [x, y]; using bottom centre.');
  }

  let hitbox: [number, number, number, number] = [0, 0, fw, fh];
  if (input.hitbox !== undefined) {
    const h = input.hitbox;
    const ok = Array.isArray(h) && h.length === 4 && h.every((n) => typeof n === 'number' && n >= 0) &&
      h[2] > 0 && h[3] > 0 && h[0] + h[2] <= fw && h[1] + h[3] <= fh;
    if (ok) hitbox = h as [number, number, number, number];
    else warnings.push('"hitbox" must be [x, y, width, height] inside the frame; using the whole frame.');
  }

  let facing: 'left' | 'right' = 'right';
  if (input.facing !== undefined) {
    if (input.facing === 'left' || input.facing === 'right') facing = input.facing;
    else warnings.push('"facing" must be "left" or "right"; using "right".');
  }

  const traits: Traits = { ...DEFAULT_TRAITS };
  if (isObj(input.traits)) {
    const t = input.traits;
    if (typeof t.speed === 'number' && t.speed > 0) traits.speed = t.speed;
    if (typeof t.jumpiness === 'number') traits.jumpiness = clamp01(t.jumpiness);
    if (typeof t.clinginess === 'number') traits.clinginess = clamp01(t.clinginess);
  }

  return {
    manifest: {
      id: id as string,
      name: typeof input.name === 'string' && input.name ? input.name : (id as string),
      sheet: input.sheet as string,
      frameSize,
      ...(sheetSize ? { sheetSize } : {}),
      anchor,
      facing,
      hitbox,
      animations,
      roles,
      traits,
    },
    errors,
    warnings,
  };
}
