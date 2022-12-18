/**
 * @license Apache-2.0
 */

import {logError} from '../logger';
import {OffscreenAction, isOffscreenDocMessage, MessageCmd} from '../messaging';

document.addEventListener(
  'DOMContentLoaded',
  function () {
    new DoiOffscreen().init();
  },
  false
);

class DoiOffscreen {
  /**
   * Initialize offscreen document.
   */
  public init() {
    this.startListeners();
  }

  /**
   * Attach window/element listeners.
   */
  private startListeners(): void {
    chrome.runtime.onMessage.addListener(this.runtimeMessageHandler.bind(this));
  }

  /**
   * Handle runtime messages
   * @param message Internal message
   * @param sender Message sender
   * @param sendResponse Response callback
   */
  private runtimeMessageHandler(
    message: unknown,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void
  ): boolean | void {
    if (!isOffscreenDocMessage(message) || !message.data) {
      return;
    }

    switch (message.data.action) {
      case OffscreenAction.ParseTitle:
        sendResponse({
          cmd: MessageCmd.OffscreenDoc,
          data: {
            action: OffscreenAction.ParseTitle,
            data: this.parseTitle(message.data?.data),
          },
        });
        break;
      default:
        break;
    }
  }

  /**
   * Parse title
   * @param val The raw title value which may include HTML
   */
  private parseTitle(val?: unknown): string | undefined {
    let title: string | undefined;

    if (typeof val !== 'string') {
      return title;
    }

    try {
      const container = document.createElement('div');
      container.innerHTML = val;
      let firstChild = container.firstElementChild;
      while (firstChild) {
        if (firstChild.tagName === 'SUBTITLE' && firstChild.textContent) {
          container.replaceChild(
            document.createTextNode(` - ${firstChild.textContent}`),
            firstChild
          );
        } else if (firstChild.tagName === 'ALT-TITLE' || !firstChild.textContent?.trim()) {
          container.removeChild(firstChild);
        } else {
          container.replaceChild(document.createTextNode(firstChild.textContent), firstChild);
        }
        firstChild = container.firstElementChild;
      }

      title = container.textContent?.replace(/\s{2,}/g, ' ').trim();
    } catch (ex) {
      logError('Failed to parse title', ex);
    }

    return title;
  }
}
