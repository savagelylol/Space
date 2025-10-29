// plugin.js - adds a CSS variables theme
// a simple sample of plugins likely wont work off the start
(function (host) {
  // host is an API object the platform provides (for demo we won't use it)
  const style = document.createElement('style');
  style.id = 'plugin-stellar-theme';
  style.textContent = `
    :root{
      --bg: #02030a;
      --bg-2: #04102a;
      --fg: #cfefff;
      --accent: #3ea8ff;
    }
    body { background: linear-gradient(180deg, var(--bg), var(--bg-2)); color: var(--fg); }
    .button { background: var(--accent); color: black; border-radius: 8px; padding: 6px 12px; }
  `;
  document.head.appendChild(style);

  return {
    uninstall() {
      const el = document.getElementById('plugin-stellar-theme');
      if (el) el.remove();
    }
  };
})(window.SpacePluginHost || {});
