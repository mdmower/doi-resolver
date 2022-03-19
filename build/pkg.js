/**
 * @license Apache-2.0
 */

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const packageJson = require('../package.json');
const colors = require('colors/safe');

(async function () {
  try {
    const distDirPath = path.resolve(__dirname, '..', 'dist');

    // Prepare output directory
    const pkgDirPath = path.join('.', 'pkg');
    fs.mkdirSync(pkgDirPath, {recursive: true});

    // Prepare compressor
    const archive = archiver('zip');
    archive.on('error', function (err) {
      throw err;
    });

    // Prepare write stream
    const pkgPath = path.join(pkgDirPath, `${packageJson.name}-${packageJson.version}.zip`);
    const wstream = fs.createWriteStream(pkgPath, {flags: 'w'});
    wstream.on('close', function () {
      // Opting for SI unit kB rather than base 2 unit KB
      const kb = Math.round(archive.pointer() / 100) / 10;
      console.log(
        `${colors.bold.green('[Pkg successful]')} Zip (${kb} kB): ${path.resolve(pkgPath)}`
      );
    });

    // Begin compression
    archive.pipe(wstream);
    archive.directory(distDirPath, false);
    archive.finalize();
  } catch (ex) {
    console.error(`${colors.bold.red('[Pkg error]')} Unexpected error during packaging\n`, ex);
    process.exit(1);
  }
})();
