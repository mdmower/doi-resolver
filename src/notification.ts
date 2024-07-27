/**
 * @license Apache-2.0
 */

import {logError} from './lib/logger';
import {applyTheme, getMessageNodes} from './utils';

document.addEventListener(
  'DOMContentLoaded',
  function () {
    new DoiNotification().init().catch((error) => {
      logError('Init failed', error);
    });
  },
  false
);

class DoiNotification {
  private elements_: {
    title: HTMLHeadingElement;
    message: HTMLParagraphElement;
    close: HTMLButtonElement;
  };

  constructor() {
    const elementMissing = (selector: string) => {
      throw new Error(`Required element is missing from the page: ${selector}`);
    };
    this.elements_ = {
      close:
        document.querySelector<HTMLButtonElement>('button#close') || elementMissing('button#close'),
      title: document.querySelector<HTMLHeadingElement>('h5#title') || elementMissing('h5#title'),
      message:
        document.querySelector<HTMLParagraphElement>('p#message') || elementMissing('p#message'),
    };
  }

  /**
   * Initialize notification.
   */
  public async init() {
    this.renderNotification();
    await applyTheme(window);
    this.startListeners();
  }

  /**
   * Attach window/element listeners.
   */
  private startListeners(): void {
    this.elements_.close.addEventListener('click', close.bind(window));
  }

  /**
   * Render a notification
   */
  private renderNotification(): void {
    const url = new URL(location.href);
    const title = url.searchParams.get('title') ?? '';
    const message = url.searchParams.get('message') ?? '';

    document.title = title;
    this.elements_.close.append(...getMessageNodes('closeButton'));

    this.elements_.title.textContent = title;
    this.elements_.message.textContent = message;
    this.elements_.close.focus();
  }
}
