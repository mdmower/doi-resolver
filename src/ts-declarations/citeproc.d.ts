/**
 * @license Apache-2.0
 */

// https://citeproc-js.readthedocs.io/en/latest/running.html

// Minimal declarations needed by this extension.

declare module 'citeproc' {
  export class Engine {
    constructor(sys: CiteProcSys, styleXml: string, locale?: string, forceLocale?: boolean);

    /**
     * Generates a single bibliography object based on the current state of the processor registry.
     */
    makeBibliography(): [unknown, string[]];

    /**
     * Refreshes the registry with a designated set of citable items.
     * @param idList List of IDs
     */
    updateItems(idList: string[]): void;
  }

  export interface CiteProcSys {
    /**
     * Fetches CSL locales needed at runtime.
     */
    retrieveLocale: (locale: string) => string;

    /**
     * Fetches citation data for an item.
     */
    retrieveItem: (id: string) => unknown;
  }
}
