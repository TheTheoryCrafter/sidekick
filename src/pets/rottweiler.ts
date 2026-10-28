// Rottweiler as a self-contained module (see cream-cat.ts):
//   import rottweiler from 'sidekick-pet/pets/rottweiler';

import type { PetDefinition } from '../dom/sidekick';
import manifest from '../../pets/rottweiler/manifest.json';
import sheetUrl from '../../pets/rottweiler/rottweiler.png?inline';

const rottweiler: PetDefinition = { id: 'rottweiler', manifest, sheetUrl };
export default rottweiler;
