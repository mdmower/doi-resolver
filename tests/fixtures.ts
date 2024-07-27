import {test as base, chromium, Worker, type BrowserContext} from '@playwright/test';
import {fileURLToPath} from 'url';

export const test = base.extend<{
  context: BrowserContext;
  serviceWorker: Worker;
  extensionId: string;
}>({
  context: async ({}, use) => {
    const pathToExtension = fileURLToPath(import.meta.resolve('../dist/chrome'));
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        '--headless=new',
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
      ],
    });

    await use(context);
    await context.close();
  },
  serviceWorker: async ({context}, use) => {
    let [worker] = context.serviceWorkers();
    if (!worker) {
      worker = await context.waitForEvent('serviceworker');
    }

    let ready = false;
    for (let i = 0; i < 10; i++) {
      ready = await worker.evaluate(
        () =>
          typeof chrome !== 'undefined' &&
          typeof chrome.storage !== 'undefined' &&
          typeof chrome.storage.local !== 'undefined'
      );
      if (!ready) {
        await new Promise((resolve) => setTimeout(resolve, 25));
      } else {
        break;
      }
    }

    await use(worker);
  },
  extensionId: async ({serviceWorker}, use) => {
    const extensionId = serviceWorker.url().split('/')[2];
    await use(extensionId);
  },
});

export const expect = test.expect;
