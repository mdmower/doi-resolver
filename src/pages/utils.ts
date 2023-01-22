/**
 * @license Apache-2.0
 */
import {DisplayTheme, getDefaultOptions, getOptions} from '../options';

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
