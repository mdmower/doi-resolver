/**
 * @license Apache-2.0
 */

import {existsSync} from 'node:fs';
import {readFile, readdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import colors from 'colors';
import util from 'node:util';
import {exec} from 'node:child_process';
import {DOMParser} from '@xmldom/xmldom';
import {dirRef} from './utils.js';

const {bold} = colors;
const execAsync = util.promisify(exec);

interface CslStyles {
  cite_styles: {
    code: string;
    title: string;
    default_locale: string;
  }[];
}

/**
 * Update CSL locales in src
 */
async function updateCslLocales() {
  const [readmeResponse, localesResponse] = await Promise.all([
    fetch('https://github.com/citation-style-language/locales/raw/master/README.md'),
    fetch('https://github.com/citation-style-language/locales/raw/master/locales.json'),
  ]);

  if (!readmeResponse.ok || !localesResponse.ok) {
    throw new Error(
      `Fetch request(s) unsuccessful. Status codes: readme=${readmeResponse.status}, locales=${localesResponse.status}`
    );
  }

  const readme = await readmeResponse.text();
  const locales = await localesResponse.json();
  await writeFile(path.join(dirRef.csl, 'locales/README.md'), readme);
  await writeFile(path.join(dirRef.csl, 'locales/locales.json'), JSON.stringify(locales));
}

/**
 * Update CSL styles in src
 */
async function updateCslStyles() {
  const readmeResponse = await fetch(
    'https://github.com/citation-style-language/styles/raw/master/README.md'
  );
  const readme = await readmeResponse.text();
  await writeFile(path.join(dirRef.csl, 'styles/README.md'), readme);

  const cloneDir = path.join(dirRef.root, 'csl-styles');
  if (existsSync(cloneDir)) {
    await execAsync('git pull', {cwd: cloneDir});
  } else {
    await execAsync(
      `git clone https://github.com/citation-style-language/styles.git "${cloneDir}"`,
      {cwd: dirRef.root}
    );
  }

  const cslStyles: CslStyles = {cite_styles: []};
  const files = await readdir(cloneDir);
  const cslFiles = files.filter((file) => path.extname(file).toLocaleLowerCase() === '.csl');
  const domParser = new DOMParser();

  for (const file of cslFiles) {
    try {
      const text = await readFile(path.join(cloneDir, file), 'utf-8');
      const doc = domParser.parseFromString(text, 'application/xml');
      const styleElements = doc.getElementsByTagNameNS('http://purl.org/net/xbiblio/csl', 'style');
      const default_locale = styleElements.length
        ? styleElements[0].getAttributeNS(null, 'default-locale') || ''
        : '';
      const titleElements = doc.getElementsByTagNameNS('http://purl.org/net/xbiblio/csl', 'title');
      const title = titleElements.length ? titleElements[0].textContent || '' : '';
      if (!title) {
        throw new Error('Title not available');
      }
      cslStyles.cite_styles.push({
        code: file.replace(/\.csl$/i, ''),
        title,
        default_locale,
      });
    } catch {
      console.warn(`Skipping ${file} because it could not be parsed`);
    }
  }
  await writeFile(path.join(dirRef.csl, 'styles/styles.json'), JSON.stringify(cslStyles));
}

/**
 * Update CSL styles and locales
 */
async function update() {
  try {
    console.log(`${bold.green('[Update]')} Updating CSL locales...`);
    await updateCslLocales();
    console.log(`${bold.green('[Update]')} Updating CSL styles...`);
    await updateCslStyles();
    console.log(`${bold.green('[Update]')} Done`);
  } catch (ex) {
    console.error(`${bold.red('[Update error]')} Unexpected error during update\n`, ex);
    process.exit(1);
  }
}

void update();
