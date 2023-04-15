/**
 * @license Apache-2.0
 */

const packageJson = require('../package.json');

module.exports = {
  background: {
    service_worker: 'sw.js',
  },
  action: {
    default_icon: {
      16: 'icons/icon16.png',
      19: 'icons/icon19.png',
      24: 'icons/icon24.png',
      32: 'icons/icon32.png',
      38: 'icons/icon38.png',
      48: 'icons/icon48.png',
    },
    default_popup: 'bubble.html',
    default_title: '__MSG_iconHover__',
  },
  default_locale: 'en',
  description: '__MSG_appDesc__',
  icons: {
    16: 'icons/icon16.png',
    19: 'icons/icon19.png',
    24: 'icons/icon24.png',
    32: 'icons/icon32.png',
    38: 'icons/icon38.png',
    48: 'icons/icon48.png',
    128: 'icons/icon128.png',
  },
  manifest_version: 3,
  name: '__MSG_appName__',
  omnibox: {
    keyword: 'doi',
  },
  optional_host_permissions: ['https://*/*', 'http://*/*'],
  optional_permissions: ['offscreen', 'scripting', 'tabs'],
  options_page: 'options.html',
  permissions: ['contextMenus', 'clipboardWrite', 'storage'],
  version: packageJson.version,
};
