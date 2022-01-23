/**
 * @license Apache-2.0
 */

const fse = require('fs-extra');
const path = require('path');
const htmlMinifier = require('html-minifier');
const CleanCSS = require('clean-css');
const webpack = require('webpack');
const minimist = require('minimist');
const manifest = require('./manifest');
const webpackConfig = require('./webpack.config');
const colors = require('colors/safe');

/**
 * Minify HTML
 * @param {boolean} debug Whether to run in debug mode
 * @param {string} distDirPath Path to destination dir
 * @returns {Promise<void>}
 */
async function minifyHtml(debug, distDirPath) {
  try {
    const htmlDirPath = path.resolve(__dirname, '..', 'html');
    const filenames = await fse.readdir(htmlDirPath);
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
        const minHtml = htmlMinifier.minify(html, {
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
 * Minify CSS
 * @param {boolean} debug Whether to run in debug mode
 * @param {string} distDirPath Path to destination dir
 * @returns {Promise<void>}
 */
async function minifyCss(debug, distDirPath) {
  try {
    const cssDirPath = path.resolve(__dirname, '..', 'css');
    const filenames = await fse.readdir(cssDirPath);
    const cssFiles = filenames
      .filter((filename) => /\.css$/i.test(filename))
      .map((filename) => {
        return {
          filename: filename,
          inputPath: path.join(cssDirPath, filename),
          outputPath: path.join(distDirPath, filename),
        };
      });

    if (debug) {
      console.log(`${colors.bold.green('[Copying CSS]')} ${filenames.join(', ')}`);
      return Promise.all(
        cssFiles.map(async (cssFile) => {
          return fse.copyFile(cssFile.inputPath, cssFile.outputPath);
        })
      );
    }

    const cleanCSS = new CleanCSS({
      level: 2,
    });

    console.log(`${colors.bold.green('[Minifying CSS]')} ${filenames.join(', ')}`);
    return Promise.all(
      cssFiles.map(async (cssFile) => {
        const css = await fse.readFile(cssFile.inputPath, 'utf-8');
        const minCSS = cleanCSS.minify(css).styles;

        return fse.writeFile(cssFile.outputPath, minCSS, 'utf-8');
      })
    );
  } catch (ex) {
    console.error(
      colors.bold.red(`[Build error] Unexpected error in ${minifyCss.name}`) + '\n',
      ex
    );
  }

  return Promise.reject();
}

/**
 * Copy static files
 * @param {boolean} debug Whether to run in debug mode
 * @param {string} distDirPath Path to destination dir
 * @returns {Promise<void>}
 */
async function copyStaticFiles(debug, distDirPath) {
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
 * @param {string} distDirPath Path to destination dir
 * @returns {Promise<void>}
 */
async function writeManifest(debug, distDirPath) {
  try {
    const manifestJson = JSON.stringify(manifest, undefined, debug ? 2 : undefined);
    const mainfestPath = path.join(distDirPath, 'manifest.json');
    console.log(colors.bold.green('[Writing manifest]'));
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
 * Compile JS for browser target
 * @param {boolean} debug Whether to run in debug mode
 * @param {string} distDirPath Path to destination dir
 * @returns {Promise<void>}
 */
async function compileJs(debug, distDirPath) {
  try {
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
  let distDirPath = '';

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

    // Prepare output directory
    distDirPath = path.resolve(__dirname, '..', 'dist');
    fse.mkdirSync(distDirPath, {recursive: true});
  } catch (ex) {
    console.error(colors.bold.red(`[Build error] Unexpected error preparing for build`) + '\n', ex);
    process.exit(1);
  }

  // Error output is handled within each method, no need to re-output here.
  try {
    await Promise.all([
      minifyHtml(debug, distDirPath),
      minifyCss(debug, distDirPath),
      copyStaticFiles(debug, distDirPath),
      writeManifest(debug, distDirPath),
    ]);
    // Keep compilation logs together by calling compileJs independently
    await compileJs(debug, distDirPath);
  } catch (ex) {
    process.exit(1);
  }

  console.log(`\n${colors.bold.green('[Build successful]')} ${distDirPath}`);
})();
