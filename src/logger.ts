/**
 * @license Apache-2.0
 */

export enum LogLevel {
  None,
  Trace,
  Debug,
  Info,
  Warn,
  Error,
}

/**
 * Verify an item is an instance of LogLevel
 * @param val Unverified item
 */
export function isLogLevel(val: unknown): val is LogLevel {
  return typeof val === 'number' && val in LogLevel;
}

/**
 * Log trace
 * @param data Log data
 */
export function logTrace(...data: unknown[]): void {
  log(LogLevel.Trace, ...data);
}

/**
 * Log debugging information
 * @param data Log data
 */
export function logDebug(...data: unknown[]): void {
  log(LogLevel.Debug, ...data);
}

/**
 * Log information
 * @param data Log data
 */
export function logInfo(...data: unknown[]): void {
  log(LogLevel.Info, ...data);
}

/**
 * Log warning
 * @param data Log data
 */
export function logWarn(...data: unknown[]): void {
  log(LogLevel.Warn, ...data);
}

/**
 * Log error
 * @param data Log data
 */
export function logError(...data: unknown[]): void {
  log(LogLevel.Error, ...data);
}

/**
 * Log data to console
 * @param level Log level
 * @param data Log data
 */
export function log(level: LogLevel, ...data: unknown[]): void {
  switch (level) {
    case LogLevel.Trace:
      console.trace(...data);
      break;
    case LogLevel.Debug:
      console.debug(...data);
      break;
    case LogLevel.Info:
      console.info(...data);
      break;
    case LogLevel.Warn:
      console.warn(...data);
      break;
    case LogLevel.Error:
      console.error(...data);
      break;
    default:
      break;
  }
}
