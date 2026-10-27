// The cream cat as a self-contained module: manifest plus the sprite sheet
// inlined as a data URL, so bundler users need no static files:
//   import creamCat from 'sidekick-pet/pets/cream-cat';
//   init({ pet: creamCat });
// Sites with a strict img-src CSP should serve the pets/ folder instead.

import type { PetDefinition } from '../dom/sidekick';
import manifest from '../../pets/cream-cat/manifest.json';
import sheetUrl from '../../pets/cream-cat/cream-cat-sheet-v2.png?inline';

const creamCat: PetDefinition = { id: 'cream-cat', manifest, sheetUrl };
export default creamCat;
