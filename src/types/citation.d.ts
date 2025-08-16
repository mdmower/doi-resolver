/**
 * @license Apache-2.0
 */

// Minimal declarations needed by this extension.

declare module '@citation-js/core' {
  interface CiteOptions {
    format?: string;
    template?: string;
    lang?: string;
  }

  export class Cite {
    constructor(data: Record<string, unknown>);

    /**
     * Generate a formatted citation
     */
    public format(output: 'bibliography', options: CiteOptions): string;
  }

  interface PluginConfig {
    has(name: string): boolean;
    add(name: string, value: string): void;
    delete(name: string): void;
    list(): string[];
  }

  export const plugins: {
    config: {
      get(name: '@csl'): {
        templates: PluginConfig;
        locales: PluginConfig;
      };
    };
  };
}
