/**
 * @license Apache-2.0
 */

/// <reference path="../../node_modules/@types/chrome/index.d.ts" />
// ^ Seems to be necessary for namespaces that already exist and which we want
// to extend. Otherwise, the unmodified namespace is all that gets picked-up
// by src .ts files.

// TODO: @types/chrome does not yet define MV3 chrome.offscreen namespace.
declare namespace chrome.offscreen {
  export type Reason =
    | 'TESTING'
    | 'AUDIO_PLAYBACK'
    | 'IFRAME_SCRIPTING'
    | 'DOM_SCRAPING'
    | 'BLOBS'
    | 'DOM_PARSER'
    | 'USER_MEDIA'
    | 'DISPLAY_MEDIA'
    | 'WEB_RTC'
    | 'CLIPBOARD';

  export interface CreateParameters {
    justification: string;
    reasons: Reason[];
    url: string;
  }

  export function createDocument(
    parameters: CreateParameters,
    callback?: () => void
  ): Promise<Document>;
  export function closeDocument(callback?: () => void): Promise<void>;
  export function hasDocument(): Promise<boolean>;
}

// TODO: @types/chrome does not yet define MV3 chrome.permissions methods.
declare namespace chrome.permissions {
  export interface Permissions {
    permissions?: string[];
    origins?: string[];
  }

  export function contains(permissions: Permissions): Promise<boolean>;
  export function request(permissions: Permissions): Promise<boolean>;
  export function remove(permissions: Permissions): Promise<boolean>;
}
