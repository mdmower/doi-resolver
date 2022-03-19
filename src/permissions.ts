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
  return new Promise((resolve) => {
    chrome.permissions.request({origins}, resolve);
  });
}

/**
 * Check whether meta permissions are allowed.
 */
export function checkMetaPermissions(): Promise<boolean> {
  const origins = getMetaOrigins();
  return new Promise((resolve) => {
    chrome.permissions.contains({origins}, resolve);
  });
}

/**
 * Remove meta permissions.
 */
export function removeMetaPermissions(): Promise<boolean> {
  const origins = getMetaOrigins();
  return new Promise((resolve) => {
    chrome.permissions.remove({origins}, resolve);
  });
}

/**
 * Request citation permissions.
 */
export function requestCitationPermissions(): Promise<boolean> {
  const origins = getCitationOrigins();
  return new Promise((resolve) => {
    chrome.permissions.request({origins}, resolve);
  });
}

/**
 * Check whether citation permissions are allowed.
 */
export function checkCitationPermissions(): Promise<boolean> {
  const origins = getCitationOrigins();
  return new Promise((resolve) => {
    chrome.permissions.contains({origins}, resolve);
  });
}

/**
 * Remove citation permissions.
 */
export function removeCitationPermissions(): Promise<boolean> {
  const origins = getCitationOrigins();
  return new Promise((resolve) => {
    chrome.permissions.remove({origins}, resolve);
  });
}

/**
 * Request content script permissions.
 */
export function requestContentScriptPermissions(): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.permissions.request(
      {
        permissions: ['tabs'],
        origins: ['http://*/*', 'https://*/*'],
      },
      resolve
    );
  });
}

/**
 * Check whether content script permissions are allowed.
 */
export function checkContentScriptPermissions(): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.permissions.contains(
      {
        permissions: ['tabs'],
        origins: ['http://*/*', 'https://*/*'],
      },
      resolve
    );
  });
}

/**
 * Remove content script permissions.
 */
export function removeContentScriptPermissions(): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.permissions.remove(
      {
        permissions: ['tabs'],
        origins: ['http://*/*', 'https://*/*'],
      },
      resolve
    );
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

  return new Promise((resolve) => {
    chrome.permissions.remove({origins}, resolve);
  });
}
