// Golden retriever as a self-contained module (see cream-cat.ts):
//   import goldenRetriever from 'sidekick-pet/pets/golden-retriever';

import type { PetDefinition } from '../dom/sidekick';
import manifest from '../../pets/golden-retriever/manifest.json';
import sheetUrl from '../../pets/golden-retriever/golden-retriever.png?inline';

const goldenRetriever: PetDefinition = { id: 'golden-retriever', manifest, sheetUrl };
export default goldenRetriever;
