import {fileURLToPath} from 'node:url';
import {cp, readFile, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';

const pathToExtension = fileURLToPath(import.meta.resolve('../dist/chrome'));
export const pathToTestExtension = fileURLToPath(import.meta.resolve('../dist/chrome-test'));

// Playwright developers refuse to support optional permissions, so all permissions must be required.
// https://github.com/microsoft/playwright/issues/32755

/**
 * Make all optional permissions in manifest.json required and save a copy of the original manifest with .bak extension
 * @param manifestPath Path to manifest.json
 */
async function patchManifest(manifestPath: string) {
  const originalManifest = await readFile(manifestPath, 'utf8');
  const manifest = JSON.parse(originalManifest) as chrome.runtime.ManifestV3;
  const {permissions, optional_permissions, host_permissions, optional_host_permissions} = manifest;
  if (!optional_permissions && !optional_host_permissions) {
    return;
  }

  manifest.permissions = [...(permissions ?? []), ...(optional_permissions ?? [])];
  manifest.host_permissions = [...(host_permissions ?? []), ...(optional_host_permissions ?? [])];
  delete manifest.optional_permissions;
  delete manifest.optional_host_permissions;
  await writeFile(manifestPath, JSON.stringify(manifest, undefined, 2));
}

export default async function (): Promise<void> {
  await rm(pathToTestExtension, {recursive: true, force: true});
  await cp(pathToExtension, pathToTestExtension, {recursive: true});

  const pathToTestManifest = path.join(pathToTestExtension, 'manifest.json');
  await patchManifest(pathToTestManifest);
}
