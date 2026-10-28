export type Rng = () => number;
/** mulberry32: small, fast, good enough for pet decisions. Returns [0, 1). */
export declare function seededRng(seed: number): Rng;
/** Uniform float in [min, max). */
export declare const between: (rng: Rng, min: number, max: number) => number;
