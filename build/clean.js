/**
 * @license Apache-2.0
 */

const fse = require('fs-extra');
const path = require('path');
const colors = require('colors/safe');

(async function () {
  try {
    const distDirPath = path.resolve(__dirname, '..', 'dist');
    await fse.emptyDir(distDirPath);
    console.log(`${colors.bold.green('[Clean successful]')} ${distDirPath}`);
  } catch (ex) {
    console.error(`${colors.bold.red('[Clean error]')} Unexpected error during cleanup\n`, ex);
    process.exit(1);
  }
})();
