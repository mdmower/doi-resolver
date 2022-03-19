import {HistoryDoi, HistorySort, getDefaultOptions} from './storage';

/**
 * Determine whether a value is a string.
 * @param val Candidate value
 */
export function isString(val: unknown): val is string {
  return typeof val === 'string';
}

/**
 * Determine whether a value is an object (excluding functions, arrays, and null).
 * @param val Candidate value
 */
export function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && !!val && !Array.isArray(val);
}

/**
 * Get typed object keys.
 * @param obj Object with known key types
 */
export function getTypedKeys<T>(obj: T): Array<keyof T> {
  return Object.keys(obj) as Array<keyof typeof obj>;
}

/**
 * Remove spaces punctuation from beginning and end of DOI input.
 * Also removes "doi:" prefix.
 * @param doiStr DOI string
 */
export function trimDoi(doiStr: string): string {
  return doiStr.replace(/^\s*doi:?|\s+|[^A-Z0-9)>]+$/gi, '');
}

/**
 * Perform a basic sanity test that a string appears to be a DOI.
 * @param doiStr DOI string
 */
export function isValidDoi(doiStr: string): boolean {
  return /^10[./]/.test(doiStr);
}

/**
 * Escape characters that could be identified as HTML markup
 * @param unsafe Unsafe string
 */
export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Determine whether a string is a valid hex color
 * @param str Candidate string
 */
export function isHexColor(str: string): boolean {
  return /(^#[0-9A-F]{6}$)|(^#[0-9A-F]{3}$)/i.test(str);
}

/**
 * Debounce a function
 * @param func Callback
 * @param wait Milliseconds to wait
 */
export function debounce<T extends (...args: unknown[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>): void => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      func(...args);
    }, wait);
  };
}

/**
 * Sort recorded DOIs
 * @param entries Recorded DOIs
 * @param method Sort method
 */
export function sortHistoryEntries(entries: HistoryDoi[], method?: HistorySort): void {
  const doiCompare = (a: HistoryDoi, b: HistoryDoi) => {
    if (a.doi.toLowerCase() < b.doi.toLowerCase()) return -1;
    if (a.doi.toLowerCase() > b.doi.toLowerCase()) return 1;
    return 0;
  };
  const titleCompare = (a: HistoryDoi, b: HistoryDoi) => {
    // Sort blank titles at end of list
    if (!a.title && b.title) return 1;
    if (a.title && !b.title) return -1;

    if (a.title.toLowerCase() < b.title.toLowerCase()) return -1;
    if (a.title.toLowerCase() > b.title.toLowerCase()) return 1;
    return 0;
  };
  const saveCompare = (a: HistoryDoi, b: HistoryDoi) => {
    if (a.save && !b.save) return -1;
    if (!a.save && b.save) return 1;
    return 0;
  };

  if (!method) {
    method = getDefaultOptions()['history_sortby'];
  }

  switch (method) {
    case HistorySort.Doi:
      entries.sort(doiCompare);
      break;
    case HistorySort.Title:
      entries.sort(titleCompare);
      break;
    case HistorySort.Save:
      entries.reverse();
      entries.sort(saveCompare);
      break;
    case HistorySort.Date:
      entries.reverse();
      break;
    default:
      break;
  }
}

/**
 * Only display <options> in a <select> that have text matching an input string
 * @param select HTML select element
 * @param text Input text
 * @param trySelect Whether to automatically select the first visible filtered
 * option.
 */
export function filterSelectByText(
  select: HTMLSelectElement,
  text: string,
  trySelect: boolean
): void {
  const options = Array.from(select.options);
  const showAll = !text;

  if (showAll) {
    options.forEach((option) => {
      option.hidden = false;
    });
    if (select.selectedOptions.length) {
      select.selectedOptions[0].scrollIntoView();
    }
  } else {
    // Escape special chars
    let search = text.replace(/[-[\]/{}()*+?.\\^$|]/g, '\\$&');
    // Ignore extra whitespace characters
    search = search.replace(/\s* /g, '\\s*');
    const regex = new RegExp(search, 'i');

    const visibleOptions = [] as HTMLOptionElement[];
    options.forEach((option) => {
      if (regex.test(option.textContent || '') || regex.test(option.value)) {
        option.hidden = false;
        visibleOptions.push(option);
      } else {
        option.selected = false;
        option.hidden = true;
      }
    });

    if (visibleOptions.length) {
      if (trySelect && !select.selectedOptions.length) {
        visibleOptions[0].selected = true;
      }
      if (select.selectedOptions.length) {
        select.selectedOptions[0].scrollIntoView();
      }
    }
  }
}
