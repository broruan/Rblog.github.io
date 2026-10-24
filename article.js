(() => {
  "use strict";
  const byId = (id) => document.getElementById(id);
  const data = window.BLOG_CONTENT || {};
  const markdown = window.RBlogMarkdown;
  const ui = window.RBlogUI;
  const setText = (id, value) => { byId(id).textContent = value; };
  let headings = [];
  let tocItems = [];
  let lastActive = null;

  function showError(error) {
    byId("article-loading").hidden = true;
    byId("article-header").hidden = true;
    byId("article-body-section").hidden = true;
    byId("article-error").hidden = false;
    setText("article-error-message", error.message || "请返回笔记本，重新选择文章。");
  }
  function updateMetadata(note) {
    const pageTitle = note.title + " | R.Blog";
    document.title = pageTitle;
    document.querySelector('meta[name="description"]').content = note.summary;
    document.querySelector('meta[property="og:title"]').content = pageTitle;
    document.querySelector('meta[property="og:description"]').content = note.summary;
    document.querySelector('link[rel="canonical"]').href = new URL(markdown.articleHref(note), "https://broruan.github.io/Rblog.github.io/").href;
  }
  function renderToc() {
    const minLevel = Math.min(...headings.map((heading) => heading.level));
    // Include the document's real top two levels, even when an article starts at h3.
    const entries = headings.filter((heading) => heading.level <= minLevel + 1);
    tocItems = entries.map((heading) => {
      const link = document.createElement("a"); link.href = "#" + encodeURIComponent(heading.id); link.textContent = heading.text;
      if (heading.level > minLevel) link.className = "toc-nested";
      link.addEventListener("click", () => { if (matchMedia("(max-width: 800px)").matches) byId("toc-details").open = false; });
      byId("article-toc").append(link);
      return { heading, link };
    });
    byId("article-sidebar").hidden = !entries.length;
    const query = matchMedia("(max-width: 800px)");
    const updateDisclosure = () => { byId("toc-details").open = !query.matches; };
    updateDisclosure(); query.addEventListener("change", updateDisclosure);
  }
  function updateReadingPosition() {
    const body = byId("article-content");
    const bounds = body.getBoundingClientRect();
    const distance = Math.max(1, bounds.height - (innerHeight - 130));
    const percent = Math.round(Math.min(100, Math.max(0, (130 - bounds.top) / distance * 100)));
    byId("reading-progress-bar").style.width = percent + "%";
    setText("reading-progress-text", percent + "%");
    let active = tocItems[0];
    for (const item of tocItems) { if (item.heading.element.getBoundingClientRect().top <= 155) active = item; }
    if (active && active !== lastActive) {
      lastActive?.link.removeAttribute("aria-current");
      active.link.setAttribute("aria-current", "location"); lastActive = active;
      const nav = byId("article-toc");
      const linkBounds = active.link.getBoundingClientRect(); const navBounds = nav.getBoundingClientRect();
      if (linkBounds.bottom > navBounds.bottom || linkBounds.top < navBounds.top) nav.scrollTop += linkBounds.top - navBounds.top - nav.clientHeight / 3;
    }
  }
  function initReading() {
    let pending = false;
    const schedule = () => { if (pending) return; pending = true; requestAnimationFrame(() => { updateReadingPosition(); pending = false; }); };
    document.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    new ResizeObserver(schedule).observe(byId("article-content"));
    let size = 16;
    try { const stored = Number(localStorage.getItem("rblog-font-size")); if (stored >= 14 && stored <= 20) size = stored; } catch { /* Optional preference. */ }
    const applySize = () => {
      document.documentElement.style.setProperty("--article-font-size", size + "px");
      byId("font-decrease").disabled = size <= 14; byId("font-increase").disabled = size >= 20;
      schedule();
    };
    [["font-decrease", -1], ["font-increase", 1]].forEach(([id, change]) => byId(id).addEventListener("click", () => {
      size = Math.min(20, Math.max(14, size + change)); applySize();
      try { localStorage.setItem("rblog-font-size", String(size)); } catch { /* Optional preference. */ }
    }));
    applySize();
    if (location.hash) {
      try { document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView({ behavior: "instant" }); } catch { /* Ignore malformed fragments. */ }
    }
  }
  function initImages() {
    const dialog = byId("image-dialog");
    byId("article-content").addEventListener("click", (event) => {
      const button = event.target.closest(".article-image");
      if (!button) return;
      const image = button.querySelector("img"); byId("zoomed-image").src = image.src; byId("zoomed-image").alt = image.alt;
      setText("zoomed-caption", /^(img|image)$/i.test(image.alt) ? "" : image.alt); dialog.showModal();
    });
    byId("close-image").addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
  }
  async function renderNeighbors(paths, current) {
    const results = await Promise.allSettled(paths.map((path) => path === current.path ? Promise.resolve(current) : markdown.fetchPost(path)));
    const notes = results.filter((result) => result.status === "fulfilled" && !result.value.draft).map((result) => result.value).sort((a, b) => b.date.localeCompare(a.date));
    const index = notes.findIndex((note) => note.path === current.path);
    [[notes[index - 1], "← 较新的手记"], [notes[index + 1], "较早的手记 →"]].forEach(([note, label], position) => {
      if (!note) return;
      const link = document.createElement("a"); link.className = "neighbor-link"; link.href = markdown.articleHref(note); link.style.gridColumn = String(position + 1); link.dataset.position = position ? "older" : "newer";
      const hint = document.createElement("span"); hint.textContent = label; link.append(hint, note.title); byId("article-neighbors").append(link);
    });
  }
  function renderArticle(note) {
    setText("article-title", note.title); setText("article-summary", note.summary);
    setText("article-date", markdown.formatDate(note.date)); byId("article-date").dateTime = note.date;
    setText("reading-time", "约 " + markdown.readingMinutes(note.markdown) + " 分钟阅读");
    setText("article-author", data.profile?.name || "broruan"); setText("footer-owner", data.profile?.name || "broruan");
    byId("article-tags").replaceChildren(...note.tags.map((tag) => {
      const element = document.createElement("a"); element.className = "note-tag"; element.href = "index.html?tag=" + encodeURIComponent(tag) + "#notes"; element.textContent = tag; return element;
    }));
    byId("article-source").href = "https://github.com/broruan/Rblog.github.io/blob/main/" + note.path.split("/").map(encodeURIComponent).join("/");
    headings = markdown.renderMarkdown(byId("article-content"), note);
    updateMetadata(note); renderToc();
    byId("article-loading").hidden = true; byId("article-error").hidden = true;
    byId("article-header").hidden = false; byId("article-body-section").hidden = false;
    initReading(); initImages(); ui.refreshIcons();
  }
  async function loadArticle() {
    try {
      const filename = new URLSearchParams(location.search).get("post");
      if (!filename) throw new Error("文章链接缺少文件名，请从笔记本中选择一篇手记。");
      const requestedPath = markdown.normalizeManifestEntry(filename);
      const paths = await markdown.fetchManifest(data.postsManifest || "posts/index.json");
      if (!paths.includes(requestedPath)) throw new Error("这篇手记不存在或尚未发布。");
      const note = await markdown.fetchPost(requestedPath);
      if (note.draft) throw new Error("这篇手记仍是草稿，尚未公开。");
      renderArticle(note);
      renderNeighbors(paths, note).catch((error) => console.warn("相邻手记暂时不可用：", error.message));
    } catch (error) { showError(error); }
  }
  byId("article-github-link").href = data.links?.github || "https://github.com/broruan";
  loadArticle();
})();
