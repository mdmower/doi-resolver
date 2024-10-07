import {test as base, chromium, Worker, type BrowserContext} from '@playwright/test';
import {fileURLToPath} from 'node:url';
import {ExtensionPage, extensionPages} from './utils';

export const test = base.extend<{
  context: BrowserContext;
  serviceWorker: Worker;
  extension: {
    id: string;
    urls: Record<ExtensionPage, string>;
  };
}>({
  context: async ({}, use) => {
    const pathToExtension = fileURLToPath(import.meta.resolve('../dist/chrome'));
    const context = await chromium.launchPersistentContext('', {
      headless: true,
      args: [
        '--headless=new',
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
      ],
    });

    // Playwright is not able to capture the initial request when a tab is opened via
    // chrome.tabs.create(). There isn't enough incentive to mock responses until this is fixed.
    // https://github.com/microsoft/playwright/issues/32865
    // await context.route(/^https?:\/\//, (route, request) => {...});

    await use(context);
    await context.close();
  },
  serviceWorker: async ({context}, use) => {
    let [worker] = context.serviceWorkers();
    if (!worker) {
      worker = await context.waitForEvent('serviceworker');
    }

    for (let i = 0; i < 10; i++) {
      const ready = await worker.evaluate(
        async () =>
          typeof self !== 'undefined' &&
          self instanceof ServiceWorkerGlobalScope &&
          self.serviceWorker.state === 'activated' &&
          typeof chrome !== 'undefined' &&
          !!chrome.storage?.local &&
          Object.keys((await chrome.storage.local.get()) ?? {}).length > 0
      );
      if (!ready) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      } else {
        break;
      }
    }

    await use(worker);
  },
  extension: async ({serviceWorker}, use) => {
    const id = serviceWorker.url().split('/')[2];
    const urls = await serviceWorker.evaluate(
      ({pages}) =>
        pages.reduce(
          (prev, curr) => {
            prev[curr] = chrome.runtime.getURL(`${curr}.html`);
            return prev;
          },
          {} as Record<ExtensionPage, string>
        ),
      {pages: extensionPages}
    );
    await use({id, urls});
  },
});

export const expect = test.expect;
