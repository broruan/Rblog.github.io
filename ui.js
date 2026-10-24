(() => {
  "use strict";
  function icon(name) {
    const element = document.createElement("i");
    element.dataset.lucide = name;
    element.setAttribute("aria-hidden", "true");
    return element;
  }
  function refreshIcons() {
    window.lucide?.createIcons({ attrs: { "stroke-width": 1.6 } });
  }
  function updateThemeButtons() {
    const dark = document.documentElement.dataset.theme === "dark";
    document.querySelector('meta[name="theme-color"]').content = dark ? "#171e1b" : "#f7f8f4";
    document.querySelectorAll(".theme-toggle").forEach((button) => {
      const label = dark ? "切换为浅色主题" : "切换为深色主题";
      button.setAttribute("aria-label", label);
      button.title = label;
      button.replaceChildren(icon(dark ? "sun" : "moon"));
    });
    refreshIcons();
  }
  document.querySelectorAll(".theme-toggle").forEach((button) => button.addEventListener("click", () => {
    const theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("rblog-theme", theme); } catch { /* Optional preference. */ }
    updateThemeButtons();
  }));
  window.RBlogUI = Object.freeze({ icon, refreshIcons });
  updateThemeButtons();
})();
