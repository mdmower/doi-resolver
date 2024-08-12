/**
 * @license Apache-2.0
 */

import {doiBrowser} from './global';
import {log, LogLevel} from './logger';

/**
 * Get the permissions request object for meta
 */
function getMetaPermissionsReq(): chrome.permissions.Permissions {
  const permissionsReq: chrome.permissions.Permissions = {
    origins: [
      'https://*.doi.org/',
      'https://*.crossref.org/',
      'https://*.datacite.org/',
      'https://*.medra.org/',
    ],
  };

  if (doiBrowser != 'firefox') {
    permissionsReq.permissions = ['offscreen'];
  }

  return permissionsReq;
}

/**
 * Get the permissions request object for citations
 */
function getCitationPermissionsReq(): chrome.permissions.Permissions {
  const permissionsReq: chrome.permissions.Permissions = {
    origins: [
      'https://*.doi.org/',
      'https://*.crossref.org/',
      'https://*.datacite.org/',
      'https://*.medra.org/',
      'https://raw.githubusercontent.com/',
    ],
  };

  if (doiBrowser != 'firefox') {
    permissionsReq.permissions = ['offscreen'];
  }

  return permissionsReq;
}

/**
 * Get the permissions request object for content scripts
 */
function getContentScriptPermissionsReq(): chrome.permissions.Permissions {
  return {
    permissions: ['scripting', 'tabs'],
    origins: ['http://*/*', 'https://*/*'],
  };
}

/**
 * Request meta permissions.
 */
export function requestMetaPermissions(): Promise<boolean> {
  return chrome.permissions.request(getMetaPermissionsReq()).catch((error) => {
    log(LogLevel.Error, error);
    return false;
  });
}

/**
 * Check whether meta permissions are allowed.
 */
export function checkMetaPermissions(): Promise<boolean> {
  return chrome.permissions.contains(getMetaPermissionsReq()).catch((error) => {
    log(LogLevel.Error, error);
    return false;
  });
}

/**
 * Remove meta permissions.
 */
export function removeMetaPermissions(): Promise<boolean> {
  return chrome.permissions.remove(getMetaPermissionsReq()).catch((error) => {
    log(LogLevel.Error, error);
    return false;
  });
}

/**
 * Request citation permissions.
 */
export function requestCitationPermissions(): Promise<boolean> {
  return chrome.permissions.request(getCitationPermissionsReq()).catch((error) => {
    log(LogLevel.Error, error);
    return false;
  });
}

/**
 * Check whether citation permissions are allowed.
 */
export function checkCitationPermissions(): Promise<boolean> {
  return chrome.permissions.contains(getCitationPermissionsReq()).catch((error) => {
    log(LogLevel.Error, error);
    return false;
  });
}

/**
 * Remove citation permissions.
 */
export function removeCitationPermissions(): Promise<boolean> {
  return chrome.permissions.remove(getCitationPermissionsReq()).catch((error) => {
    log(LogLevel.Error, error);
    return false;
  });
}

/**
 * Request content script permissions.
 */
export function requestContentScriptPermissions(): Promise<boolean> {
  return chrome.permissions.request(getContentScriptPermissionsReq()).catch((error) => {
    log(LogLevel.Error, error);
    return false;
  });
}

/**
 * Check whether content script permissions are allowed.
 */
export function checkContentScriptPermissions(): Promise<boolean> {
  return chrome.permissions.contains(getContentScriptPermissionsReq()).catch((error) => {
    log(LogLevel.Error, error);
    return false;
  });
}

/**
 * Remove content script permissions.
 */
export function removeContentScriptPermissions(): Promise<boolean> {
  return chrome.permissions.remove(getContentScriptPermissionsReq()).catch((error) => {
    log(LogLevel.Error, error);
    return false;
  });
}

/**
 * Remove origin permissions once they are not needed.
 * @param removeWildcardOrigins Whether wildcard origins http://* and
 * https://* should also be removed.
 */
export function cleanupOriginPermissions(removeWildcardOrigins: boolean): Promise<boolean> {
  const origins = [
    'https://*.doi.org/',
    'https://*.crossref.org/',
    'https://*.datacite.org/',
    'https://*.medra.org/',
    'https://raw.githubusercontent.com/',
  ];

  if (removeWildcardOrigins) {
    origins.push('http://*/*');
    origins.push('https://*/*');
  }

  return chrome.permissions.remove({origins}).catch((error) => {
    log(LogLevel.Error, error);
    return false;
  });
}
