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

/**
 * Write manifest.json
 * @param debug Whether to run in debug mode
 * @param browser Target browser
 */
async function writeManifest(debug: boolean, browser: Browser): Promise<void> {
  try {
    const manifest = await getManifest(debug, browser);
    const manifestJson = JSON.stringify(manifest, undefined, debug ? 2 : undefined);
    const manifestPath = path.join(dirRef.dist, browser, 'manifest.json');
    console.log(`${bold.green('[Writing manifest]')} manifest.json`);
    await writeFile(manifestPath, manifestJson, 'utf-8');
  } catch (ex) {
    console.error(bold.red(`[Build error] Unexpected error in ${writeManifest.name}`));
    if (ex) {
      console.error(ex);
    }
    throw ex instanceof Error ? ex : new Error(ex?.toString());
  }
}

/**
 * Copy static assets to browser output directory
 * @param browser Target browser
 */
async function copyStaticAssets(browser: Browser): Promise<void> {
  try {
    const dstDir = path.join(dirRef.dist, browser);
    await Promise.all([
      cp(path.join(dirRef.static, 'icons'), path.join(dstDir, 'icons'), {recursive: true}),
      cp(path.join(dirRef.static, 'img'), path.join(dstDir, 'img'), {recursive: true}),
      cp(path.join(dirRef.static, '_locales'), path.join(dstDir, '_locales'), {recursive: true}),
    ]);
  } catch (ex) {
    console.error(bold.red(`[Build error] Unexpected error in ${copyStaticAssets.name}`));
    if (ex) {
      console.error(ex);
    }
    throw ex instanceof Error ? ex : new Error(ex?.toString());
  }
}

/**
 * Compile source for browser target
 * @param debug Whether to run in debug mode
 * @param browser Target browser
 */
async function runVite(debug: boolean, browser: Browser): Promise<void> {
  try {
    for (const config of getViteConfigs(debug, browser)) {
      await build(config);
    }
  } catch (ex) {
    console.error(bold.red(`[Build error] Compilation error in ${runVite.name}`));
    if (ex) {
      console.error(ex);
    }
    throw ex instanceof Error ? ex : new Error(ex?.toString());
  }
}

/**
 * Build the extensions
 */
async function buildExtensions() {
  let debug: boolean;
  const filteredBrowsers: Browser[] = [];

  try {
    // Read flags
    const argv = minimist<{debug: boolean}>(process.argv.slice(2), {
      boolean: ['debug'],
    });

    // Set build mode
    debug = argv.debug;
    if (debug) {
      console.warn(bold.yellow('Debug mode enabled'));
    }

    const cmdlineBrowsers = argv._.filter((s): s is Browser =>
      (browsers as readonly string[]).includes(s)
    );
    filteredBrowsers.push(
      ...browsers.filter((browser) => !cmdlineBrowsers.length || cmdlineBrowsers.includes(browser))
    );

    // Prepare output directories
    for (const browser of filteredBrowsers) {
      await mkdir(path.join(dirRef.dist, browser), {recursive: true});
    }
  } catch (ex) {
    console.error(bold.red('[Build error] Unexpected error preparing for build'));
    if (ex) {
      console.error(ex);
    }
    process.exitCode = 1;
    return;
  }

  try {
    for (const browser of filteredBrowsers) {
      console.log(`\n${bold.cyan('Building for ' + browser)}`);
      await writeManifest(debug, browser);
      await runVite(debug, browser);
      await copyStaticAssets(browser);

      console.log(`\n${bold.green('[Build successful]')} ${browser}`);
    }
  } catch {
    // Error output is handled within each method, no need to re-output here.
    process.exitCode = 1;
  }
}

void buildExtensions();
