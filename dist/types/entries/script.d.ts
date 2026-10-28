import { destroy, getInstance, init } from '../index';
declare global {
    interface Window {
        Sidekick?: {
            init: typeof init;
            get: typeof getInstance;
            destroy: typeof destroy;
        };
    }
}
