(() => {
  try {
    const theme = localStorage.getItem("rblog-theme");
    if (theme === "dark") document.documentElement.dataset.theme = "dark";
  } catch { /* Storage may be disabled; the default light theme still works. */ }
})();
