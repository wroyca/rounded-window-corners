/** @file Contains the list of top-level pages (tabs) in the preferences window. */

import type Adw from 'gi://Adw';

import {BlacklistPage} from '../preferences/pages/blacklist.js';
import {CustomPage} from '../preferences/pages/custom.js';
import {GeneralPage} from '../preferences/pages/general.js';

export const prefsTabs: (typeof Adw.PreferencesPage)[] = [
    GeneralPage,
    BlacklistPage,
    CustomPage,
];
