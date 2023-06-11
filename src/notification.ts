/**
 * @license Apache-2.0
 */

import {logError} from './logger';

/**
 * Open a minimal popup window to display a notification.
 * @param title Title
 * @param message Message
 */
export function showNotification(title: string, message: string): void {
  const encodedTitle = encodeURIComponent(title);
  const encodedMessage = encodeURIComponent(message);

  chrome.windows
    .create({
      url: `notification.html?title=${encodedTitle}&message=${encodedMessage}`,
      focused: true,
      height: 250,
      width: 500,
      type: 'popup',
    })
    .catch((error) => {
      logError('Failed to open notification window\n', error);
    });
}
