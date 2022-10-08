import {StorageOptions, isStorageOptions} from './storage';
import {isObject} from './utils';

/**
 * Send an internal message between different parts of the extension
 * @param message JSON request object
 * @param responseCallback Callback function with the JSON response object
 * sent by the handler of the message
 */
export function sendInternalMessage<
  T extends InternalMessage<unknown>,
  R extends InternalMessage<unknown> | undefined
>(message: T, responseCallback?: (response: R) => void): void {
  // Debugging
  // console.log(`Sending message: ${message.cmd}\n`, message);
  // Avoid "context invalidated" errors when extension updates but content
  // scripts on page have not been reloaded.
  if (chrome.runtime?.id) {
    // HACK: Get around incorrect type definition for .sendMessage in MV2. An
    // undefined response is allowed and necessary when an async response is not
    // expected (otherwise a runtime error is reported).
    chrome.runtime.sendMessage(message, responseCallback as unknown as () => void);
  }
}

export enum MessageCmd {
  AutolinkVars = 'autolink_vars',
  ContextMenuToggle = 'context_menu_toggle',
  SettingsUpdated = 'settings_updated',
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
  doi: string;
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
    typeof message.data.doi === 'string'
  );
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
    (Object.values(MessageCmd) as string[]).includes(message.cmd)
  );
}
