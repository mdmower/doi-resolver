/**
 * @license Apache-2.0
 */

import path from 'node:path';
import {cp, mkdir, writeFile} from 'node:fs/promises';
import {build} from 'vite';
import minimist from 'minimist';
import colors from 'colors';
import {getViteConfigs} from './vite.js';
import {getManifest} from './manifest.js';
import {Browser, browsers, dirRef} from './utils.js';

const {bold} = colors;

try {
  const {debug, ...argv} = minimist<{debug: boolean}>(process.argv.slice(2), {
    boolean: ['debug'],
  });

  if (debug) {
    console.warn(bold.yellow('Debug mode enabled'));
  }

  const cmdlineBrowsers = argv._.filter((s): s is Browser =>
    (browsers as readonly string[]).includes(s)
  );
  const filteredBrowsers = browsers.filter(
    (browser) => !cmdlineBrowsers.length || cmdlineBrowsers.includes(browser)
  );

  await Promise.all(
    filteredBrowsers.map((browser) => mkdir(path.join(dirRef.dist, browser), {recursive: true}))
  );

  for (const browser of filteredBrowsers) {
    console.log(`\n${bold.cyan('Building for ' + browser)}`);

    const manifest = await getManifest(debug, browser);
    const manifestJson = JSON.stringify(manifest, undefined, debug ? 2 : undefined);
    console.log(`${bold.green('[Writing manifest]')} manifest.json`);
    await writeFile(path.join(dirRef.dist, browser, 'manifest.json'), manifestJson, 'utf-8');

    for (const config of getViteConfigs(debug, browser)) {
      await build(config);
    }

    const dstDir = path.join(dirRef.dist, browser);
    await Promise.all([
      cp(path.join(dirRef.static, 'icons'), path.join(dstDir, 'icons'), {recursive: true}),
      cp(path.join(dirRef.static, 'img'), path.join(dstDir, 'img'), {recursive: true}),
      cp(path.join(dirRef.static, '_locales'), path.join(dstDir, '_locales'), {recursive: true}),
    ]);

    console.log(`\n${bold.green('[Build successful]')} ${browser}`);
  }
} catch (ex) {
  console.error(`${bold.red('[Build error]')} Build failed\n`, ex);
  process.exitCode = 1;
}
