// @ts-ignore

import Clutter from 'gi://Clutter';
import Shell from 'gi://Shell';

declare global {
    const global: Shell.Global, log, logError: any;
}

declare const imports = {
    gi: {Adw},
    ui: {windowPreview},
};
