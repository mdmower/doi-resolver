import {test as teardown} from '@playwright/test';
import {fileURLToPath} from 'node:url';
import {rename} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';

/**
 * Restore original manifest.json from .bak backup
 * @param path Path to manifest.json
 */
async function restoreManifest(path: string) {
  if (!existsSync(path + '.bak')) {
    return;
  }
  await rename(path + '.bak', path);
}

teardown('restore manifest', async ({}) => {
  const pathToExtension = fileURLToPath(import.meta.resolve('../dist/chrome'));
  const pathToManifest = path.join(pathToExtension, 'manifest.json');
  await restoreManifest(pathToManifest);
});
