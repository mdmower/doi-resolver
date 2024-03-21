/**
 * @license Apache-2.0
 */

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const packageJson = require('../package.json');
const minimist = require('minimist');
const colors = require('colors/safe');

const browsers = ['chrome', 'edge', 'firefox'];

/**
 * Package for target browser
 * @param {string} browser Target browser
 * @returns {Promise<void>}
 */
async function package(browser) {
  const distDirPath = path.resolve(__dirname, '..', 'dist', browser);

  // Prepare output directory
  const pkgDirPath = path.join('.', 'pkg');
  fs.mkdirSync(pkgDirPath, {recursive: true});

  // Prepare compressor
  const archive = archiver('zip');
  archive.on('error', function (err) {
    throw err;
  });

  // Prepare write stream
  const pkgPath = path.join(
    pkgDirPath,
    `${packageJson.name}-${packageJson.version}.${browser}.zip`
  );
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
}

(async function () {
  try {
    const argv = minimist(process.argv.slice(2));
    const cmdlineBrowsers = argv._.filter((s) => browsers.includes(s));
    const filteredBrowsers = browsers.filter(
      (browser) => !cmdlineBrowsers.length || cmdlineBrowsers.includes(browser)
    );

    for (const browser of filteredBrowsers) {
      await package(browser);
    }
  } catch (ex) {
    console.error(`${colors.bold.red('[Pkg error]')} Unexpected error during packaging\n`, ex);
    process.exit(1);
  }
})();
