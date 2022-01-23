/**
 * @license Apache-2.0
 */

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const colors = require('colors/safe');
const fetch = require('cross-fetch').fetch;
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const {DOMParser} = require('@xmldom/xmldom');

/**
 * Update CSL locales in src
 * @param {string} rootDir Path to root directory
 */
async function updateCslLocales(rootDir) {
  const cslLocalesDir = path.join(rootDir, 'src', 'csl', 'locales');
  const readmeResponsePromise = fetch(
    'https://github.com/citation-style-language/locales/raw/master/README.md'
  );
  const localesResponsePromise = fetch(
    'https://github.com/citation-style-language/locales/raw/master/locales.json'
  );

  const [readmeResponse, localesResponse] = await Promise.all([
    readmeResponsePromise,
    localesResponsePromise,
  ]);

  if (!readmeResponse.ok || !localesResponse.ok) {
    throw new Error(
      `Fetch request(s) unsuccessful: [${readmeResponse.status}, ${localesResponse.status}]`
    );
  }

  const readmeText = await readmeResponse.text();
  const localesText = await localesResponse.json();
  await fsp.writeFile(path.join(cslLocalesDir, 'README.md'), readmeText);
  await fsp.writeFile(path.join(cslLocalesDir, 'locales.json'), JSON.stringify(localesText));
}

/**
 * Update CSL styles in src
 * @param {string} rootDir Path to root directory
 */
async function updateCslStyles(rootDir) {
  const cslStylesDir = path.join(rootDir, 'src', 'csl', 'styles');
  const readmeResponse = await fetch(
    'https://github.com/citation-style-language/styles/raw/master/README.md'
  );
  const readmeText = await readmeResponse.text();
  await fsp.writeFile(path.join(cslStylesDir, 'README.md'), readmeText);

  const cloneDir = path.join(rootDir, 'csl-styles');
  if (fs.existsSync(cloneDir)) {
    await exec('git pull', {cwd: cloneDir});
  } else {
    await exec(`git clone https://github.com/citation-style-language/styles.git "${cloneDir}"`);
  }

  const citeStyles = {cite_styles: []};
  const files = (await fsp.readdir(cloneDir)).filter(
    (file) => path.extname(file).toLocaleLowerCase() === '.csl'
  );

  for (let file of files) {
    const filePath = path.join(cloneDir, file);
    const fileText = await fsp.readFile(filePath, 'utf-8');
    const doc = new DOMParser().parseFromString(fileText);
    const styleElements = doc.getElementsByTagNameNS('http://purl.org/net/xbiblio/csl', 'style');
    const defaultLocale = styleElements.length
      ? styleElements[0].getAttributeNS(null, 'default-locale') || ''
      : '';
    const titleElements = doc.getElementsByTagNameNS('http://purl.org/net/xbiblio/csl', 'title');
    const title = titleElements.length ? titleElements[0].textContent : '';
    citeStyles.cite_styles.push({
      code: file.replace(/\.csl$/i, ''),
      title: title,
      default_locale: defaultLocale,
    });
  }
  await fsp.writeFile(path.join(cslStylesDir, 'styles.json'), JSON.stringify(citeStyles));
}

(async function () {
  try {
    const rootDir = path.resolve(__dirname, '..');
    console.log(`${colors.bold.green('[Update]')} Updating CSL locales...`);
    await updateCslLocales(rootDir);
    console.log(`${colors.bold.green('[Update]')} Updating CSL styles...`);
    await updateCslStyles(rootDir);
    console.log(`${colors.bold.green('[Update]')} Done`);
  } catch (ex) {
    console.error(`${colors.bold.red('[Update error]')} Unexpected error during update\n`, ex);
    process.exit(1);
  }
})();
