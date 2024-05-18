/**
 * @license Apache-2.0
 */

const fse = require('fs-extra');
const path = require('path');
const htmlMinifier = require('html-minifier-terser');
const webpack = require('webpack');
const minimist = require('minimist');
const colors = require('colors/safe');
const deepmerge = require('deepmerge');
const {merge: webpackMerge} = require('webpack-merge');

const browsers = ['chrome', 'edge', 'firefox'];

/**
 * Minify HTML
 * @param {boolean} debug Whether to run in debug mode
 * @param {string} browser Target browser
 * @param {string} distDirPath Path to destination dir
 * @returns {Promise<void>}
 */
async function minifyHtml(debug, browser, distDirPath) {
  try {
    const htmlDirPath = path.resolve(__dirname, '..', 'html');
    const filenames = (await fse.readdir(htmlDirPath)).filter((filename) => {
      if (browser === 'firefox') {
        return !['offscreen.html'].includes(filename);
      }
      return true;
    });
    const htmlFiles = filenames
      .filter((filename) => /\.html?$/i.test(filename))
      .map((filename) => {
        return {
          filename: filename,
          inputPath: path.join(htmlDirPath, filename),
          outputPath: path.join(distDirPath, filename),
        };
      });

    if (debug) {
      console.log(`${colors.bold.green('[Copying HTML]')} ${filenames.join(', ')}`);
      return Promise.all(
        htmlFiles.map(async (htmlFile) => {
          return fse.copyFile(htmlFile.inputPath, htmlFile.outputPath);
        })
      );
    }

    console.log(`${colors.bold.green('[Minifying HTML]')} ${filenames.join(', ')}`);
    return Promise.all(
      htmlFiles.map(async (htmlFile) => {
        const html = await fse.readFile(htmlFile.inputPath, 'utf-8');
        const minHtml = await htmlMinifier.minify(html, {
          collapseBooleanAttributes: true,
          collapseWhitespace: true,
          conservativeCollapse: true,
          decodeEntities: true,
          removeComments: true,
        });

        return fse.writeFile(htmlFile.outputPath, minHtml, 'utf-8');
      })
    );
  } catch (ex) {
    console.error(
      colors.bold.red(`[Build error] Unexpected error in ${minifyHtml.name}`) + '\n',
      ex
    );
  }

  return Promise.reject();
}

/**
 * Copy static files
 * @param {boolean} debug Whether to run in debug mode
 * @param {string} browser Target browser
 * @param {string} distDirPath Path to destination dir
 * @returns {Promise<void>}
 */
async function copyStaticFiles(debug, browser, distDirPath) {
  try {
    const staticDirPath = path.resolve(__dirname, '..', 'static');
    const itemnames = await fse.readdir(staticDirPath);
    const dirContents = itemnames.map((itemname) => {
      return {
        itemname: itemname,
        inputPath: path.join(staticDirPath, itemname),
        outputPath: path.join(distDirPath, itemname),
      };
    });

    console.log(`${colors.bold.green('[Copying static files]')} ${itemnames.join(', ')}`);
    return dirContents.map(async (item) => {
      return fse.copy(item.inputPath, item.outputPath);
    });
  } catch (ex) {
    console.error(
      colors.bold.red(`[Build error] Unexpected error in ${copyStaticFiles.name}`) + '\n',
      ex
    );
  }

  return Promise.reject();
}

/**
 * Write manifest.json
 * @param {boolean} debug Whether to run in debug mode
 * @param {string} browser Target browser
 * @param {string} distDirPath Path to destination dir
 * @returns {Promise<void>}
 */
async function writeManifest(debug, browser, distDirPath) {
  try {
    const manifestCommon = require(path.resolve(__dirname, 'manifest.common.js'));
    const manifestBrowser = require(path.resolve(__dirname, `manifest.${browser}.js`));
    let manifestObj = deepmerge(manifestCommon, manifestBrowser);

    // If local.manifest.json exists and this is a debug build, merge into manifest.
    if (debug) {
      const localManifestPath = path.resolve(__dirname, '..', 'local.manifest.json');
      if (fse.existsSync(localManifestPath)) {
        const localManifestJson = await fse.readFile(localManifestPath, 'utf-8');
        const localManifestObj = JSON.parse(localManifestJson);
        if (browser == 'firefox' && 'key' in localManifestObj) {
          delete localManifestObj.key;
        }
        manifestObj = deepmerge(manifestObj, localManifestObj);
      }
    }

    const manifestJson = JSON.stringify(manifestObj, undefined, debug ? 2 : undefined);
    const mainfestPath = path.join(distDirPath, 'manifest.json');
    console.log(colors.bold.green('[Writing manifest] manifest.json'));
    return fse.writeFile(mainfestPath, manifestJson, 'utf-8');
  } catch (ex) {
    console.error(
      colors.bold.red(`[Build error] Unexpected error in ${writeManifest.name}`) + '\n',
      ex
    );
  }

  return Promise.reject();
}

/**
 * Compile JS and CSS for browser target
 * @param {boolean} debug Whether to run in debug mode
 * @param {string} browser Target browser
 * @param {string} distDirPath Path to destination dir
 * @returns {Promise<void>}
 */
async function compileJs(debug, browser, distDirPath) {
  try {
    const webpackCommon = require(path.resolve(__dirname, 'webpack.common.js'));
    const webpackBrowser = require(path.resolve(__dirname, `webpack.${browser}.js`));
    const webpackConfig = webpackMerge(webpackCommon, webpackBrowser);

    webpackConfig.output.path = distDirPath;

    if (debug) {
      webpackConfig.mode = 'development';
      webpackConfig.devtool = 'inline-source-map';
    }

    const filenames = Object.keys(webpackConfig.entry).map((entry) => `${entry}.js`);
    console.log(`${colors.bold.green('[Compiling JS]')} ${filenames.join(', ')}\n`);
    const compiler = webpack(webpackConfig);
    await new Promise((resolve, reject) => {
      compiler.run((err, stats) => {
        if (err) {
          console.error(colors.bold.red('[Webpack error] Config failure') + '\n', err.stack || err);
          if (err.details) {
            console.error(err.details);
          }
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

    return Promise.resolve();
  } catch (ex) {
    const redMsg = colors.bold.red(`[Build error] Compilation error in ${compileJs.name}`);
    if (ex !== undefined) {
      console.error(redMsg + '\n', ex);
    } else {
      console.error(redMsg);
    }
  }

  return Promise.reject();
}

// Build all the things
(async function () {
  let debug = false;
  const distDirPaths = {};
  const filteredBrowsers = [];

  try {
    // Read flags
    const argv = minimist(process.argv.slice(2), {
      boolean: ['debug'],
    });

    // Set build mode
    debug = argv.debug;
    if (debug) {
      console.warn(colors.bold.yellow('Debug mode enabled'));
    }

    const cmdlineBrowsers = argv._.filter((s) => browsers.includes(s));
    filteredBrowsers.push(
      ...browsers.filter((browser) => !cmdlineBrowsers.length || cmdlineBrowsers.includes(browser))
    );

    // Prepare output directories
    for (const browser of filteredBrowsers) {
      distDirPaths[browser] = path.resolve(__dirname, '..', 'dist', browser);
      fse.mkdirSync(distDirPaths[browser], {recursive: true});
    }
  } catch (ex) {
    console.error(colors.bold.red(`[Build error] Unexpected error preparing for build`) + '\n', ex);
    process.exit(1);
  }

  // Error output is handled within each method, no need to re-output here.
  try {
    for (const browser of filteredBrowsers) {
      console.log(`\n${colors.bold.cyan('Building for ' + browser)}`);
      await Promise.all([
        minifyHtml(debug, browser, distDirPaths[browser]),
        copyStaticFiles(debug, browser, distDirPaths[browser]),
        writeManifest(debug, browser, distDirPaths[browser]),
      ]);
      // Keep compilation logs together by calling compileJs independently
      await compileJs(debug, browser, distDirPaths[browser]);

      console.log(`\n${colors.bold.green('[Build successful]')} ${distDirPaths[browser]}`);
    }
  } catch (ex) {
    process.exit(1);
  }
})();
