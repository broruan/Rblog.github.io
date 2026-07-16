(() => {
  "use strict";

  const byId = (id) => document.getElementById(id);
  const data = window.BLOG_CONTENT || {};
  const markdown = window.RBlogMarkdown;

  function setText(id, value) {
    const element = byId(id);
    if (element) element.textContent = value;
  }

  function refreshIcons() {
    if (window.lucide) {
      window.lucide.createIcons({ attrs: { "stroke-width": 1.8 } });
      document.documentElement.classList.add("icons-ready");
    }
  }

  function showError(error) {
    console.error("Article load error:", error);
    byId("article-loading").hidden = true;
    byId("article-header").hidden = true;
    byId("article-body-section").hidden = true;
    byId("article-error").hidden = false;
    setText("article-error-message", error.message || "请返回首页后重新选择文章。");
  }

  function updateMetadata(note) {
    const pageTitle = `${note.title} | R.Blog`;
    document.title = pageTitle;
    document.querySelector('meta[name="description"]').content = note.summary;
    document.querySelector('meta[property="og:title"]').content = pageTitle;
    document.querySelector('meta[property="og:description"]').content = note.summary;
    document.querySelector('link[rel="canonical"]').href = window.location.href;
  }

  function renderArticle(note) {
    setText("article-title", note.title);
    setText("article-summary", note.summary);
    setText("article-date", markdown.formatDate(note.date));
    byId("article-date").dateTime = note.date;

    const tags = byId("article-tags");
    tags.replaceChildren(...note.tags.map((tag) => {
      const element = document.createElement("span");
      element.className = "note-tag";
      element.textContent = `#${tag}`;
      return element;
    }));

    const encodedPath = note.path.split("/").map(encodeURIComponent).join("/");
    byId("article-source").href = `https://github.com/broruan/Rblog.github.io/blob/main/${encodedPath}`;
    markdown.renderMarkdown(byId("article-content"), note);
    updateMetadata(note);

    byId("article-loading").hidden = true;
    byId("article-error").hidden = true;
    byId("article-header").hidden = false;
    byId("article-body-section").hidden = false;
    refreshIcons();
  }

  async function loadArticle() {
    try {
      markdown.ensureDependencies();
      const filename = new URLSearchParams(window.location.search).get("post");
      if (!filename) throw new Error("文章链接缺少 post 参数。");

      const requestedPath = markdown.normalizeManifestEntry(filename);
      const manifestUrl = data.postsManifest || "posts/index.json";
      const publishedPaths = await markdown.fetchManifest(manifestUrl);
      if (!publishedPaths.includes(requestedPath)) throw new Error("这篇文章不存在或尚未发布。");

      const note = await markdown.fetchPost(requestedPath);
      if (note.draft) throw new Error("这篇文章仍是草稿，尚未公开。");
      renderArticle(note);
    } catch (error) {
      showError(error);
    }
  }

  byId("article-github-link").href = data.links?.github || "https://github.com/broruan";
  refreshIcons();
  loadArticle();
})();
