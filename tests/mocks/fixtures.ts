import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import type {Route} from '@playwright/test';

/**
 * Read a mock payload from the tests/mocks/data directory.
 * @param name File name within the data directory
 */
async function readFixture(name: string): Promise<Buffer | undefined> {
  try {
    return await readFile(fileURLToPath(import.meta.resolve(`./data/${name}`)));
  } catch {
    console.warn(`Fixture not available: ${name}`);
    return undefined;
  }
}

const doiCslJsonFixtures: Record<string, string | null | undefined> = {
  '10.1045/january99-bearman': 'january99-bearman.json',
  '10/cg7cd4': 'january99-bearman.json',
};

/**
 * Fulfill a doi.org metadata/citeproc request with fixture CSL JSON.
 * @param route Intercepted route
 *
 * Only requests that accept CSL JSON are intercepted; ordinary tab navigations to doi.org
 * cannot be intercepted - see `fixtures.ts`. Pass-through non-CSL requests.
 */
export async function routeDoiOrg(route: Route): Promise<void> {
  const request = route.request();
  if (!(request.headers()['accept'] ?? '').includes('csl+json')) {
    return route.continue();
  }

  const doi = decodeURIComponent(new URL(request.url()).pathname.replace(/^\//, '')).toLowerCase();
  const body = doiCslJsonFixtures[doi] ? await readFixture(doiCslJsonFixtures[doi]) : null;
  if (!body) {
    return route.fulfill({
      status: 404,
      contentType: 'text/plain',
      body: 'Not Found',
    });
  }

  return route.fulfill({
    status: 200,
    contentType: 'application/vnd.citationstyles.csl+json',
    body,
  });
}

/**
 * Fulfill a CSL style (.csl) or locale (.xml) request from the citation-style-language GitHub repos
 * with a vendored fixture.
 * @param route Intercepted route
 */
export async function routeCslAsset(route: Route): Promise<void> {
  const name = new URL(route.request().url()).pathname.split('/').pop() ?? '';
  const body = /\.(csl|xml)$/.test(name) ? await readFixture(name) : undefined;
  if (!body) {
    return route.fulfill({
      status: 404,
      contentType: 'text/plain',
      body: 'Not Found',
    });
  }

  return route.fulfill({
    status: 200,
    contentType: 'application/xml',
    body,
  });
}
