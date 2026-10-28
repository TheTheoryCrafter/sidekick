// Labrador as a self-contained module (see cream-cat.ts):
//   import labrador from 'sidekick-pet/pets/labrador';

import type { PetDefinition } from '../dom/sidekick';
import manifest from '../../pets/labrador/manifest.json';
import sheetUrl from '../../pets/labrador/labrador.png?inline';

const labrador: PetDefinition = { id: 'labrador', manifest, sheetUrl };
export default labrador;
