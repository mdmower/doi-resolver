/**
 * @license Apache-2.0
 */

module.exports = {
  background: {
    service_worker: 'sw.js',
  },
  options_page: 'options.html',
  optional_host_permissions: ['https://*/*', 'http://*/*'],
  optional_permissions: ['offscreen', 'scripting', 'tabs'],
};
