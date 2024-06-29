/**
 * @license Apache-2.0
 */

export type DoiBrowser = 'chrome' | 'edge' | 'firefox';

// From webpack defines
declare const G_DOI_BROWSER: DoiBrowser;

export const doiBrowser = G_DOI_BROWSER;
