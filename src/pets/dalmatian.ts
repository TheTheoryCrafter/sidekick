// Dalmatian as a self-contained module (see cream-cat.ts):
//   import dalmatian from 'sidekick-pet/pets/dalmatian';

import type { PetDefinition } from '../dom/sidekick';
import manifest from '../../pets/dalmatian/manifest.json';
import sheetUrl from '../../pets/dalmatian/dalmatian.png?inline';

const dalmatian: PetDefinition = { id: 'dalmatian', manifest, sheetUrl };
export default dalmatian;
