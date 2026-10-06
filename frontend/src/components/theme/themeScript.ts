export const THEME_STORAGE_KEY = "lead-theme";

/**
 * Runs in <head> before paint: applies the saved theme, or light by default,
 * as <html data-theme="light|dark"> so there is no flash of the wrong theme.
 */
export const themeScript = `(function(){var t="light";try{if(localStorage.getItem("${THEME_STORAGE_KEY}")==="dark")t="dark"}catch(e){}document.documentElement.dataset.theme=t})();`;
