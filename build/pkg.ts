/**
 * @license Apache-2.0
 */

import {createWriteStream} from 'node:fs';
import {pipeline} from 'node:stream/promises';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {parseArgs} from 'node:util';
import archiver from 'archiver';
import packageJson from '../package.json' with {type: 'json'};
import {Browser, browsers, dirRef, green, red} from './utils.js';

const {name, version} = packageJson;

/**
 * Package for target browser
 * @param browser Target browser
 */
async function createArchive(browser: Browser): Promise<void> {
  const pkgPath = path.join(dirRef.pkg, `${name}-${version}.${browser}.zip`);

  const archive = archiver('zip');
  archive.directory(path.join(dirRef.dist, browser), false);

  const finalize = archive.finalize();
  await pipeline(archive, createWriteStream(pkgPath, {flags: 'w'}));
  await finalize;

  // Opting for SI unit kB rather than base 2 unit KB
  const kb = Math.round(archive.pointer() / 100) / 10;
  console.log(`${green('[Pkg successful]')} Zip (${kb} kB): ${pkgPath}`);
}

try {
  const {positionals} = parseArgs({allowPositionals: true});
  const cmdlineBrowsers = positionals.filter((s): s is Browser =>
    (browsers as readonly string[]).includes(s)
  );
  const filteredBrowsers = browsers.filter(
    (browser) => !cmdlineBrowsers.length || cmdlineBrowsers.includes(browser)
  );

  await mkdir(dirRef.pkg, {recursive: true});
  await Promise.all(filteredBrowsers.map(createArchive));
} catch (ex) {
  console.error(`${red('[Pkg error]')} Unexpected error during packaging\n`, ex);
  process.exitCode = 1;
}
