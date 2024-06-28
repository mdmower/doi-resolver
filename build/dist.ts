/**
 * @license Apache-2.0
 */

import path from 'node:path';
import fse from 'fs-extra';
import {minify} from 'html-minifier-terser';
import webpack from 'webpack';
import minimist from 'minimist';
import colors from 'colors';
import deepmerge from 'deepmerge';
import {webpackConfig} from './webpack.js';
import {manifest} from './manifest.js';
import {Browser, browsers, dirRef} from './utils.js';

const {bold} = colors;
const {readdir, copyFile, readFile, writeFile, copy, existsSync, mkdirSync} = fse;

/**
 * Minify HTML
 * @param debug Whether to run in debug mode
 * @param browser Target browser
 */
async function minifyHtml(debug: boolean, browser: Browser): Promise<void> {
  try {
    const filenames = await readdir(dirRef.html);
    const htmlFilenames = filenames.filter(
      (filename) =>
        /\.html?$/i.test(filename) &&
        (browser !== 'firefox' || !['offscreen.html'].includes(filename))
    );
    const htmlFiles = htmlFilenames.map((filename) => ({
      filename,
      inputPath: path.join(dirRef.html, filename),
      outputPath: path.join(dirRef.dist, browser, filename),
    }));

    if (debug) {
      console.log(`${bold.green('[Copying HTML]')} ${htmlFilenames.join(', ')}`);
      await Promise.all(htmlFiles.map((file) => copyFile(file.inputPath, file.outputPath)));
      return;
    }

    console.log(`${bold.green('[Minifying HTML]')} ${htmlFilenames.join(', ')}`);
    await Promise.all(
      htmlFiles.map(async (file) => {
        const html = await readFile(file.inputPath, 'utf-8');
        const minHtml = await minify(html, {
          collapseBooleanAttributes: true,
          collapseWhitespace: true,
          conservativeCollapse: true,
          decodeEntities: true,
          removeComments: true,
        });

        return writeFile(file.outputPath, minHtml, 'utf-8');
      })
    );
  } catch (ex) {
    console.error(bold.red(`[Build error] Unexpected error in ${minifyHtml.name}`));
    if (ex) {
      console.error(ex);
    }
    return Promise.reject();
  }
}

/**
 * Copy static files
 * @param debug Whether to run in debug mode
 * @param browser Target browser
 */
async function copyStaticFiles(debug: boolean, browser: Browser): Promise<void> {
  try {
    const filenames = await readdir(dirRef.static);
    const staticFiles = filenames.map((filename) => {
      return {
        filename,
        inputPath: path.join(dirRef.static, filename),
        outputPath: path.join(dirRef.dist, browser, filename),
      };
    });

    console.log(`${bold.green('[Copying static files]')} ${filenames.join(', ')}`);
    await Promise.all(staticFiles.map((file) => copy(file.inputPath, file.outputPath)));
  } catch (ex) {
    console.error(bold.red(`[Build error] Unexpected error in ${copyStaticFiles.name}`));
    if (ex) {
      console.error(ex);
    }
    return Promise.reject();
  }
}

/**
 * Write manifest.json
 * @param debug Whether to run in debug mode
 * @param browser Target browser
 */
async function writeManifest(debug: boolean, browser: Browser): Promise<void> {
  try {
    let manifestObj = manifest[browser];

    // If local.manifest.json exists and this is a debug build, merge into manifest.
    if (debug) {
      const localManifestPath = path.join(dirRef.root, 'local.manifest.json');
      if (existsSync(localManifestPath)) {
        const localManifestJson = await readFile(localManifestPath, 'utf-8');
        const localManifestObj = JSON.parse(localManifestJson) as chrome.runtime.ManifestV3;
        if (browser == 'firefox' && 'key' in localManifestObj) {
          delete localManifestObj.key;
        }
        manifestObj = deepmerge(manifestObj, localManifestObj);
      }
    }

    const manifestJson = JSON.stringify(manifestObj, undefined, debug ? 2 : undefined);
    const mainfestPath = path.join(dirRef.dist, browser, 'manifest.json');
    console.log(`${bold.green('[Writing manifest]')} manifest.json`);
    await writeFile(mainfestPath, manifestJson, 'utf-8');
  } catch (ex) {
    console.error(bold.red(`[Build error] Unexpected error in ${writeManifest.name}`));
    if (ex) {
      console.error(ex);
    }
    return Promise.reject();
  }
}

/**
 * Compile JS for browser target
 * @param debug Whether to run in debug mode
 * @param browser Target browser
 */
async function compileJs(debug: boolean, browser: Browser): Promise<void> {
  try {
    const config = webpackConfig[browser];
    config.output ||= {};
    config.output.path = path.join(dirRef.dist, browser);

    if (debug) {
      config.mode = 'development';
      config.devtool = 'inline-source-map';
    }

    config.entry ||= {};
    const filenames = Object.keys(config.entry).map((entry) => `${entry}.js`);
    console.log(`${bold.green('[Compiling JS]')} ${filenames.join(', ')}\n`);
    const compiler = webpack(config);
    await new Promise<void>((resolve, reject) => {
      compiler.run((err, stats) => {
        if (err) {
          console.error(bold.red('[Webpack error] Config failure'));
          if ('details' in err && err.details) {
            console.error(err.details);
          } else {
            console.error(err.stack || err);
          }
          return reject();
        }
        if (!stats) {
          return reject();
        }

        console.log(
          stats.toString({
            chunks: false,
            colors: true,
          })
        );

        return stats.hasErrors() ? reject() : resolve();
      });
    });
  } catch (ex) {
    console.error(bold.red(`[Build error] Compilation error in ${compileJs.name}`));
    if (ex) {
      console.error(ex);
    }
    return Promise.reject();
  }
}

// Build all the things
(async function () {
  let debug = false;
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
      mkdirSync(path.join(dirRef.dist, browser), {recursive: true});
    }
  } catch (ex) {
    console.error(bold.red('[Build error] Unexpected error preparing for build'));
    if (ex) {
      console.error(ex);
    }
    process.exit(1);
  }

  // Error output is handled within each method, no need to re-output here.
  try {
    for (const browser of filteredBrowsers) {
      console.log(`\n${bold.cyan('Building for ' + browser)}`);
      await Promise.all([
        minifyHtml(debug, browser),
        copyStaticFiles(debug, browser),
        writeManifest(debug, browser),
      ]);
      // Keep compilation logs together by calling compileJs independently
      await compileJs(debug, browser);

      console.log(`\n${bold.green('[Build successful]')} ${browser}`);
    }
  } catch (ex) {
    process.exit(1);
  }
})();
