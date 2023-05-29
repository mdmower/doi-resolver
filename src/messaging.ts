/**
 * @license Apache-2.0
 */

import {sendAutolinkOptions} from './autolink';
import {ContextMenuId, updateContextMenu} from './context_menu';
import {isLogLevel, log, logError, LogLevel} from './logger';
import {StorageOptions, isStorageOptions, getOptions} from './options';
import {isObject} from './utils';

/**
 * Send an internal message between different parts of the extension
 * @param message JSON request object
 * sent by the handler of the message
 */
export function sendInternalMessage<T extends InternalMessage<unknown>>(message: T): void {
  sendInternalMessageAsync<T, undefined>(message).catch((error) => {
    logError('Failed to send message', error);
  });
}

/**
 * Send an internal message between different parts of the extension
 * @param message JSON request object
 * sent by the handler of the message
 */
export async function sendInternalMessageAsync<T extends InternalMessage<unknown>, R>(
  message: T
): Promise<R | void> {
  // Debugging
  // logInfo(`Sending message: ${message.cmd}\n`, message);

  // Avoid "context invalidated" errors when extension updates but content
  // scripts on page have not been reloaded.
  if (!chrome.runtime?.id) {
    return;
  }

  return chrome.runtime.sendMessage<T, R>(message).catch((error) => {
    // There will not be a message receiver if content scripts are disabled
    // and no extension pages are open (aside from the sender page).
    if (
      isObject(error) &&
      typeof error.message === 'string' &&
      /Receiving end does not exist\./.test(error.message)
    ) {
      return;
    }

    logError('Failed to send message', error);
  });
}

export enum MessageCmd {
  AutolinkVars = 'autolink_vars',
  ContextMenuToggle = 'context_menu_toggle',
  Logging = 'logging',
  OffscreenDoc = 'offscreen_doc',
  SettingsUpdated = 'settings_updated',
}

export enum OffscreenAction {
  ParseTitles = 'parse_titles',
}

export interface InternalMessage<T> {
  cmd: MessageCmd;
  data?: T;
}

export interface AutolinkVarsResponse {
  doiResolver: string;
  rewriteAnchorHref: boolean;
}

export interface ContextMenuToggle {
  enable: boolean;
  doi?: string;
}

export interface LogData {
  level: LogLevel;
  data: unknown[];
}

export interface OffscreenDoc<T> {
  action: OffscreenAction;
  data: T;
}

export interface SettingsUpdated {
  options: StorageOptions;
  forceUpdate: boolean;
}

export interface AutolinkVarsMessage extends InternalMessage<AutolinkVarsResponse | undefined> {
  cmd: MessageCmd.AutolinkVars;
}

export interface ContextMenuToggleMessage extends InternalMessage<ContextMenuToggle> {
  cmd: MessageCmd.ContextMenuToggle;
}

export interface LoggingMessage extends InternalMessage<LogData> {
  cmd: MessageCmd.Logging;
}

export interface OffscreenDocMessage<T> extends InternalMessage<OffscreenDoc<T>> {
  cmd: MessageCmd.OffscreenDoc;
}

export interface SettingsUpdatedMessage extends InternalMessage<SettingsUpdated> {
  cmd: MessageCmd.SettingsUpdated;
}

/**
 * Verify a message object is an autolink vars message
 * @param message Unverified message
 */
export function isAutolinkVarsMessage(message: unknown): message is AutolinkVarsMessage {
  return (
    isObject(message) &&
    message.cmd === MessageCmd.AutolinkVars &&
    (message.data === undefined ||
      (isObject(message.data) &&
        typeof message.data.doiResolver === 'string' &&
        typeof message.data.rewriteAnchorHref === 'boolean'))
  );
}

/**
 * Verify a message object is a context menu toggled message
 * @param message Unverified message
 */
export function isContextMenuToggleMessage(message: unknown): message is ContextMenuToggleMessage {
  return (
    isObject(message) &&
    message.cmd === MessageCmd.ContextMenuToggle &&
    isObject(message.data) &&
    typeof message.data.enable === 'boolean' &&
    (typeof message.data.doi === 'string' || message.data.doi === undefined)
  );
}

/**
 * Verify a message object is a logging message
 * @param message Unverified message
 */
export function isLoggingMessage(message: unknown): message is LoggingMessage {
  return (
    isObject(message) &&
    message.cmd === MessageCmd.Logging &&
    isObject(message.data) &&
    isLogLevel(message.data.level) &&
    Array.isArray(message.data.data)
  );
}

/**
 * Verify a message object is an offscreen document message
 * @param message Unverified message
 */
export function isOffscreenDocMessage(message: unknown): message is OffscreenDocMessage<unknown> {
  return (
    isObject(message) &&
    message.cmd === MessageCmd.OffscreenDoc &&
    isObject(message.data) &&
    isOffscreenAction(message.data.action)
  );
}

/**
 * Verify an item is an instance of OffscreenAction
 * @param val Unverified item
 */
export function isOffscreenAction(val: unknown): val is OffscreenAction {
  return typeof val === 'string' && Object.values<string>(OffscreenAction).includes(val);
}

/**
 * Verify a message object is a context menu toggled message
 * @param message Unverified message
 */
export function isSettingsUpdatedMessage(message: unknown): message is SettingsUpdatedMessage {
  return (
    isObject(message) &&
    message.cmd === MessageCmd.SettingsUpdated &&
    isObject(message.data) &&
    typeof message.data.forceUpdate === 'boolean' &&
    isStorageOptions(message.data.options)
  );
}

/**
 * Verify a message object is an internal message
 * @param message Unverified message
 */
export function isInternalMessage(message: unknown): message is InternalMessage<unknown> {
  return (
    isObject(message) &&
    typeof message.cmd === 'string' &&
    Object.values<string>(MessageCmd).includes(message.cmd)
  );
}

/**
 * Handle runtime messages
 * @param message Internal message
 * @param sender Message sender
 * @param sendResponse Response callback
 */
export function runtimeMessageHandler(
  message: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void
): boolean | void {
  if (!isInternalMessage(message)) {
    return;
  }

  switch (message.cmd) {
    case MessageCmd.AutolinkVars:
      if (isAutolinkVarsMessage(message)) {
        sendAutolinkOptions(sendResponse).catch((error) => {
          logError('Failed to send autolink variables', error);
        });
        return true; // Required to allow async sendResponse
      }
      break;
    case MessageCmd.ContextMenuToggle:
      if (isContextMenuToggleMessage(message)) {
        // If context menu match has just been disabled, then any open tabs
        // where the content script is still running will continue to send
        // messages (e.g. when switching that tab back into focus). Make sure
        // updates are only applied if the feature is active.
        getOptions('local', ['context_menu_match'])
          .then((stg) => {
            if (stg.context_menu_match) {
              updateContextMenu(
                ContextMenuId.ResolveDoi,
                !!message.data?.enable,
                message.data?.doi
              );
            }
          })
          .catch((error) => {
            logError('Failed to check context menu match status', error);
          });
      }
      break;
    case MessageCmd.Logging:
      if (isLoggingMessage(message) && message.data !== undefined) {
        log(message.data.level, ...message.data.data);
      }
    default:
      break;
  }
}
