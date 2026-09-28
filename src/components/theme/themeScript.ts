export const THEME_STORAGE_KEY = "lead-theme";

/**
 * Runs in <head> before paint: applies the saved theme, or the OS preference,
 * as <html data-theme="light|dark"> so there is no flash of the wrong theme.
 */
export const themeScript = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t!=="light"&&t!=="dark"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.theme=t}catch(e){}})();`;
