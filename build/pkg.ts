/**
 * @license Apache-2.0
 */

import {mkdirSync, createWriteStream} from 'node:fs';
import path from 'node:path';
import archiver from 'archiver';
import packageJson from '../package.json' with {type: 'json'};
import minimist from 'minimist';
import colors from 'colors';
import {Browser, browsers, dirRef} from './utils.js';

const {name, version} = packageJson;
const {bold} = colors;

/**
 * Package for target browser
 * @param browser Target browser
 */
async function runPackaging(browser: Browser): Promise<void> {
  // Prepare compressor
  const archive = archiver('zip');
  archive.on('error', function (err) {
    throw err;
  });

  // Prepare write stream
  const pkgPath = path.join(dirRef.pkg, `${name}-${version}.${browser}.zip`);
  const wstream = createWriteStream(pkgPath, {flags: 'w'});
  wstream.on('close', function () {
    // Opting for SI unit kB rather than base 2 unit KB
    const kb = Math.round(archive.pointer() / 100) / 10;
    console.log(`${bold.green('[Pkg successful]')} Zip (${kb} kB): ${pkgPath}`);
  });

  // Begin compression
  archive.pipe(wstream);
  archive.directory(path.join(dirRef.dist, browser), false);
  await archive.finalize();
}

/**
 * Package the build
 */
async function pkg() {
  try {
    const argv = minimist(process.argv.slice(2));
    const cmdlineBrowsers = argv._.filter((s): s is Browser =>
      (browsers as readonly string[]).includes(s)
    );
    const filteredBrowsers = browsers.filter(
      (browser) => !cmdlineBrowsers.length || cmdlineBrowsers.includes(browser)
    );

    // Prepare output directory
    mkdirSync(dirRef.pkg, {recursive: true});

    for (const browser of filteredBrowsers) {
      await runPackaging(browser);
    }
  } catch (ex) {
    console.error(`${bold.red('[Pkg error]')} Unexpected error during packaging`);
    if (ex) {
      console.error(ex);
    }
    process.exitCode = 1;
  }
}

void pkg();
