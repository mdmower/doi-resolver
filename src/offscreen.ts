/**
 * @license Apache-2.0
 */

import {OffscreenAction, isOffscreenDocMessage, MessageCmd} from './lib/messaging';
import {parseTitles} from './utils';

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
      case OffscreenAction.ParseTitles:
        sendResponse({
          cmd: MessageCmd.OffscreenDoc,
          data: {
            action: OffscreenAction.ParseTitles,
            data: parseTitles(message.data?.data),
          },
        });
        break;
      default:
        break;
    }
  }
}
