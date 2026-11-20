// Runs before React renders so the right theme is applied with no flash.
// External file (not inline) because the CSP is script-src 'self'.
(function () {
  try {
    var saved = localStorage.getItem('cc_theme');
    var theme = saved === 'light' || saved === 'dark'
      ? saved
      : (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0A1628' : '#0B1F3A');
  } catch (e) { /* storage unavailable: default light */ }
})();
