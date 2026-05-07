/**
 * @license Apache-2.0
 */

import path from 'node:path';
import {cp, mkdir, writeFile} from 'node:fs/promises';
import {parseArgs} from 'node:util';
import {build} from 'vite';
import {getViteConfigs} from './vite.js';
import {getManifest} from './manifest.js';
import {Browser, browsers, cyan, dirRef, green, red, yellow} from './utils.js';

try {
  const {
    values: {debug},
    positionals,
  } = parseArgs({
    options: {debug: {type: 'boolean', default: false}},
    allowPositionals: true,
  });

  if (debug) {
    console.warn(yellow('Debug mode enabled'));
  }

  const cmdlineBrowsers = positionals.filter((s): s is Browser =>
    (browsers as readonly string[]).includes(s)
  );
  const filteredBrowsers = browsers.filter(
    (browser) => !cmdlineBrowsers.length || cmdlineBrowsers.includes(browser)
  );

  await Promise.all(
    filteredBrowsers.map((browser) => mkdir(path.join(dirRef.dist, browser), {recursive: true}))
  );

  for (const browser of filteredBrowsers) {
    console.log(`\n${cyan('Building for ' + browser)}`);

    const manifest = await getManifest(debug, browser);
    const manifestJson = JSON.stringify(manifest, undefined, debug ? 2 : undefined);
    console.log(`${green('[Writing manifest]')} manifest.json`);
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

    console.log(`\n${green('[Build successful]')} ${browser}`);
  }
} catch (ex) {
  console.error(`${red('[Build error]')} Build failed\n`, ex);
  process.exitCode = 1;
}
