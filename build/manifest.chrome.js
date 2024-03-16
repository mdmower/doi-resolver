/**
 * @license Apache-2.0
 */

const manifestCommon = require('./manifest.common');

module.exports = {
  ...manifestCommon,
  background: {
    service_worker: 'sw.js',
  },
  options_page: 'options.html',
  optional_permissions: [...manifestCommon.optional_permissions, 'offscreen'],
};
