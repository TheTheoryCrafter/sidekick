// Husky as a self-contained module (see cream-cat.ts):
//   import husky from 'sidekick-pet/pets/husky';

import type { PetDefinition } from '../dom/sidekick';
import manifest from '../../pets/husky/manifest.json';
import sheetUrl from '../../pets/husky/husky.png?inline';

const husky: PetDefinition = { id: 'husky', manifest, sheetUrl };
export default husky;
