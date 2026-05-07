/**
 * @license Apache-2.0
 */

import {readdir, rm} from 'node:fs/promises';
import path from 'node:path';
import {dirRef, green, red} from './utils.js';

try {
  const items = await readdir(dirRef.dist);
  const rmPromises = items.map((item) => rm(path.join(dirRef.dist, item), {recursive: true}));
  await Promise.all(rmPromises);
  console.log(`${green('[Clean successful]')} ${dirRef.dist}`);
} catch (ex) {
  console.error(`${red('[Clean error]')} Unexpected error during cleanup\n`, ex);
  process.exitCode = 1;
}
