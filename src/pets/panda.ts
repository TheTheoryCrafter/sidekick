// Panda as a self-contained module (see cream-cat.ts):
//   import panda from 'sidekick-pet/pets/panda';

import type { PetDefinition } from '../dom/sidekick';
import manifest from '../../pets/panda/manifest.json';
import sheetUrl from '../../pets/panda/panda.png?inline';

const panda: PetDefinition = { id: 'panda', manifest, sheetUrl };
export default panda;
