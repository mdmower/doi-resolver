/**
 * @license Apache-2.0
 */
import {logError} from './lib/logger';
import {DisplayTheme, getDefaultOptions, getOptions} from './lib/options';
import {isRecord} from './lib/utils';
import DOMPurify from 'dompurify';

/**
 * Apply theme to page
 * @param win Window
 * @param theme Theme to apply
 */
export async function applyTheme(win: Window, theme?: DisplayTheme): Promise<void> {
  if (theme === undefined) {
    const stg = await getOptions('local', ['theme']);
    theme = stg.theme ?? getDefaultOptions()['theme'];
  }

  if (
    theme === DisplayTheme.Dark ||
    (theme === DisplayTheme.System && win.matchMedia('(prefers-color-scheme: dark)').matches)
  ) {
    win.document.documentElement.setAttribute('data-bs-theme', DisplayTheme.Dark);
  } else {
    win.document.documentElement.setAttribute('data-bs-theme', DisplayTheme.Light);
  }
}

/**
 * Parse titles
 * @param val The raw titles which may include HTML
 */
export function parseTitles(val?: unknown): Record<string, string | undefined> | undefined {
  if (!isRecord(val)) {
    return;
  }

  return Object.keys(val).reduce<Record<string, string | undefined>>((titles, doi) => {
    let title: string | undefined;

    const rawTitle = val[doi];
    if (typeof rawTitle === 'string') {
      try {
        const container = document.createElement('div');
        container.innerHTML = DOMPurify.sanitize(rawTitle);
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
    }

    titles[doi] = title;
    return titles;
  }, {});
}

interface HtmlSub {
  search: string | RegExp;
  node: (text?: string) => HTMLElement;
}
const htmlSubs: HtmlSub[] = [
  {
    search: 'HTML_SUB_BR',
    node: () => document.createElement('br'),
  },
  {
    search: 'HTML_SUB_A_CSL_LOCALES',
    node: () => {
      const element = document.createElement('a');
      element.href = 'https://github.com/citation-style-language/locales';
      element.textContent = 'GitHub';
      element.target = '_blank';
      return element;
    },
  },
  {
    search: 'HTML_SUB_A_CSL_STYLES',
    node: () => {
      const element = document.createElement('a');
      element.href = 'https://github.com/citation-style-language/styles';
      element.textContent = 'GitHub';
      element.target = '_blank';
      return element;
    },
  },
  {
    search: /HTML_SUB_SPAN_UL\(([^)]+)\)/,
    node: (text) => {
      const element = document.createElement('span');
      element.style.textDecoration = 'underline';
      element.textContent = text ?? '';
      return element;
    },
  },
  {
    search: /HTML_SUB_STRONG\(([^)]+)\)/,
    node: (text) => {
      const element = document.createElement('strong');
      element.textContent = text ?? '';
      return element;
    },
  },
  {
    search: /HTML_SUB_EM\(([^)]+)\)/,
    node: (text) => {
      const element = document.createElement('em');
      element.textContent = text ?? '';
      return element;
    },
  },
  {
    search: /HTML_SUB_CODE\(([^)]+)\)/,
    node: (text) => {
      const element = document.createElement('code');
      element.textContent = text ?? '';
      return element;
    },
  },
  {
    search: /HTML_SUB_ULIST\(([^)]+)\)/,
    node: (text) => {
      const element = document.createElement('ul');
      const children = (text ?? '').split(',').map((item) => {
        const li = document.createElement('li');
        li.textContent = item.trim();
        return li;
      });
      element.append(...children);
      return element;
    },
  },
];

interface HtmlSubResult {
  idx: number;
  len: number;
  node: HTMLElement;
}

/**
 * Print a notification
 * @param i18nId Message ID
 * @param i18nSubstitutions Substitutions
 */
export function getMessageNodes(i18nId: string, i18nSubstitutions?: string[]): Node[] {
  const message = chrome.i18n.getMessage(i18nId, i18nSubstitutions);

  const nodes: Node[] = [];
  for (let pos = 0; pos < message.length; ) {
    const subs = htmlSubs
      .map<HtmlSubResult | undefined>((htmlSub) => {
        if (htmlSub.search instanceof RegExp) {
          const match = htmlSub.search.exec(message.slice(pos));
          if (match) {
            return {
              idx: pos + match.index,
              len: match[0].length,
              node: htmlSub.node(match[1]),
            };
          }
        } else {
          const idx = message.indexOf(htmlSub.search, pos);
          if (idx >= 0) {
            return {
              idx,
              len: htmlSub.search.length,
              node: htmlSub.node(),
            };
          }
        }
      })
      .filter((sub) => !!sub)
      .sort((subA, subB) => subA.idx - subB.idx);

    if (!subs.length) {
      nodes.push(document.createTextNode(message.slice(pos)));
      break;
    }

    const {idx, len, node} = subs[0];
    if (idx > pos) {
      nodes.push(document.createTextNode(message.slice(pos, idx)));
    }
    nodes.push(node);
    pos = idx + len;
  }

  return nodes;
}
