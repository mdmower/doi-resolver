/**
 * @license Apache-2.0
 */

/**
 * Get the list of meta origins for permissions requests.
 */
function getMetaOrigins(): string[] {
  return [
    'https://*.doi.org/',
    'https://*.crossref.org/',
    'https://*.datacite.org/',
    'https://*.medra.org/',
  ];
}

/**
 * Get the list of citation origins for permissions requests.
 */
function getCitationOrigins(): string[] {
  return [
    'https://*.doi.org/',
    'https://*.crossref.org/',
    'https://*.datacite.org/',
    'https://*.medra.org/',
    'https://raw.githubusercontent.com/',
  ];
}

/**
 * Request meta permissions.
 */
export function requestMetaPermissions(): Promise<boolean> {
  const origins = getMetaOrigins();
  return chrome.permissions.request({permissions: ['offscreen'], origins});
}

/**
 * Check whether meta permissions are allowed.
 */
export function checkMetaPermissions(): Promise<boolean> {
  const origins = getMetaOrigins();
  return chrome.permissions.contains({permissions: ['offscreen'], origins});
}

/**
 * Remove meta permissions.
 */
export function removeMetaPermissions(): Promise<boolean> {
  const origins = getMetaOrigins();
  return chrome.permissions.remove({permissions: ['offscreen'], origins});
}

/**
 * Request citation permissions.
 */
export function requestCitationPermissions(): Promise<boolean> {
  const origins = getCitationOrigins();
  return chrome.permissions.request({permissions: ['offscreen'], origins});
}

/**
 * Check whether citation permissions are allowed.
 */
export function checkCitationPermissions(): Promise<boolean> {
  const origins = getCitationOrigins();
  return chrome.permissions.contains({permissions: ['offscreen'], origins});
}

/**
 * Remove citation permissions.
 */
export function removeCitationPermissions(): Promise<boolean> {
  const origins = getCitationOrigins();
  return chrome.permissions.remove({permissions: ['offscreen'], origins});
}

/**
 * Request content script permissions.
 */
export function requestContentScriptPermissions(): Promise<boolean> {
  return chrome.permissions.request({
    permissions: ['scripting', 'tabs'],
    origins: ['http://*/*', 'https://*/*'],
  });
}

/**
 * Check whether content script permissions are allowed.
 */
export function checkContentScriptPermissions(): Promise<boolean> {
  return chrome.permissions.contains({
    permissions: ['scripting', 'tabs'],
    origins: ['http://*/*', 'https://*/*'],
  });
}

/**
 * Remove content script permissions.
 */
export function removeContentScriptPermissions(): Promise<boolean> {
  return chrome.permissions.remove({
    permissions: ['scripting', 'tabs'],
    origins: ['http://*/*', 'https://*/*'],
  });
}

/**
 * Remove origin permissions once they are not needed.
 * @param removeWildcardOrigins Whether wildcard origins http://* and
 * https://* should also be removed.
 */
export function cleanupOriginPermissions(removeWildcardOrigins: boolean): Promise<boolean> {
  // Citation origins includes all meta origins
  const origins = getCitationOrigins();

  if (removeWildcardOrigins) {
    origins.push('http://*/*');
    origins.push('https://*/*');
  }

  return chrome.permissions.remove({origins});
}
