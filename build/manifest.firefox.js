/**
 * @license Apache-2.0
 */

module.exports = {
  background: {
    scripts: ['background.js'],
  },
  browser_specific_settings: {
    gecko: {
      id: '{7befad41-6117-42d0-a803-4fbae41bde5a}',
      strict_min_version: '115.0',
    },
  },
  // optional_host_permissions is not yet recognized by firefox: https://bugzil.la/1766026
  optional_permissions: ['scripting', 'tabs', 'https://*/*', 'http://*/*'],
  options_ui: {
    page: 'options.html',
    open_in_tab: true,
  },
};
