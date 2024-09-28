import {test as setup} from '@playwright/test';
import {fileURLToPath} from 'node:url';
import {copyFile, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';

// Playwright developers refuse to support optional permissions, so all permissions must be required.
// https://github.com/microsoft/playwright/issues/32755

/**
 * Make all optional permissions in manifest.json required and save a copy of the original manifest with .bak extension
 * @param path Path to manifest.json
 */
async function patchManifest(path: string) {
  const originalManifest = await readFile(path, 'utf8');
  const manifest = JSON.parse(originalManifest) as chrome.runtime.ManifestV3;
  const {permissions, optional_permissions, host_permissions, optional_host_permissions} = manifest;
  if (!optional_permissions && !optional_host_permissions) {
    return;
  }

  await copyFile(path, path + '.bak');
  manifest.permissions = [...(permissions ?? []), ...(optional_permissions ?? [])];
  manifest.host_permissions = [...(host_permissions ?? []), ...(optional_host_permissions ?? [])];
  delete manifest.optional_permissions;
  delete manifest.optional_host_permissions;
  await writeFile(path, JSON.stringify(manifest, undefined, 2));
}

setup('patch manifest', async ({}) => {
  const pathToExtension = fileURLToPath(import.meta.resolve('../dist/chrome'));
  const pathToManifest = path.join(pathToExtension, 'manifest.json');
  await patchManifest(pathToManifest);
});
