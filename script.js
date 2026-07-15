(() => {
  "use strict";

  const data = window.BLOG_CONTENT || {};
  const state = { query: "", tag: "全部" };
  const byId = (id) => document.getElementById(id);
  const profile = data.profile || {};
  const githubUrl = data.links?.github || "https://github.com/broruan";
  let notes = [];

  function setText(id, value) {
    const element = byId(id);
    if (element && value) element.textContent = value;
  }

  function createIcon(name) {
    const icon = document.createElement("i");
    icon.dataset.lucide = name;
    icon.setAttribute("aria-hidden", "true");
    return icon;
  }

  function renderProfile() {
    setText("profile-name", profile.name);
    setText("profile-role", profile.role);
    setText("profile-tagline", profile.tagline);
    setText("profile-bio", profile.bio);
    setText("profile-status", profile.status);
    setText("footer-owner", profile.name);

    const avatar = byId("profile-avatar");
    const fallback = byId("avatar-fallback");
    if (profile.avatar) avatar.src = profile.avatar;
    avatar.alt = `${profile.name || "broruan"} 的头像`;
    avatar.addEventListener("error", () => {
      avatar.hidden = true;
      fallback.hidden = false;
    }, { once: true });

    ["header-github-link", "hero-github-link"].forEach((id) => {
      byId(id).href = githubUrl;
    });

    const meta = Array.isArray(profile.meta) ? profile.meta : [];
    const metaList = byId("profile-meta");
    metaList.replaceChildren();
    meta.forEach((item) => {
      const group = document.createElement("div");
      const term = document.createElement("dt");
      const description = document.createElement("dd");
      term.textContent = item.label;
      description.textContent = item.value;
      group.append(term, description);
      metaList.append(group);
    });
    metaList.hidden = meta.length === 0;
  }

  function renderStats() {
    const container = byId("stats-strip");
    const stats = Array.isArray(data.learningStats) ? data.learningStats : [];
    container.replaceChildren();

    stats.forEach((stat) => {
      const item = document.createElement("div");
      const value = document.createElement("strong");
      const label = document.createElement("span");
      value.textContent = stat.value;
      label.textContent = stat.label;
      item.append(value, label);
      container.append(item);
    });
    container.hidden = stats.length === 0;
  }

  function renderFocus() {
    const container = byId("focus-list");
    const empty = byId("focus-empty");
    const focusItems = Array.isArray(data.currentFocus) ? data.currentFocus : [];
    container.replaceChildren();

    focusItems.forEach((focus, index) => {
      const item = document.createElement("article");
      item.className = "focus-item";

      const number = document.createElement("span");
      number.className = "focus-number";
      number.textContent = String(index + 1).padStart(2, "0");

      const content = document.createElement("div");
      const heading = document.createElement("h3");
      const description = document.createElement("p");
      heading.textContent = focus.title;
      description.textContent = focus.description;
      content.append(heading, description);

      const status = document.createElement("span");
      status.className = "focus-status";
      status.textContent = focus.status || "进行中";
      item.append(number, content, status);

      if (Number.isFinite(focus.progress)) {
        const progress = document.createElement("div");
        progress.className = "focus-progress";
        progress.setAttribute("role", "progressbar");
        progress.setAttribute("aria-label", `${focus.title} 进度`);
        progress.setAttribute("aria-valuemin", "0");
        progress.setAttribute("aria-valuemax", "100");
        progress.setAttribute("aria-valuenow", String(focus.progress));
        const fill = document.createElement("span");
        fill.style.width = `${Math.min(100, Math.max(0, focus.progress))}%`;
        progress.append(fill);
        item.append(progress);
      }
      container.append(item);
    });

    empty.hidden = focusItems.length !== 0;
    container.hidden = focusItems.length === 0;
  }

  function normalizeManifestEntry(entry) {
    if (typeof entry !== "string") {
      throw new TypeError("posts/index.json 中的每一项都必须是 Markdown 文件名。");
    }

    const filename = entry.trim();
    if (!filename.endsWith(".md") || filename.includes("..") || filename.startsWith("/") || filename.includes("\\") || /[?#]/.test(filename)) {
      throw new TypeError(`无效的 Markdown 文件名：${filename || "(空)"}`);
    }
    return `posts/${filename}`;
  }

  function parseFrontMatter(source, path) {
    const match = source.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?([\s\S]*)$/);
    if (!match) {
      throw new SyntaxError(`${path} 缺少有效的 YAML front matter。`);
    }

    const metadata = window.jsyaml.load(match[1]) || {};
    if (typeof metadata !== "object" || Array.isArray(metadata)) {
      throw new TypeError(`${path} 的 front matter 必须是对象。`);
    }

    const title = typeof metadata.title === "string" ? metadata.title.trim() : "";
    const summary = typeof metadata.summary === "string" ? metadata.summary.trim() : "";
    const rawTags = metadata.tags == null ? [] : metadata.tags;
    if (!title || !summary || !metadata.date) {
      throw new TypeError(`${path} 必须包含 title、date 和 summary。`);
    }
    if (!Array.isArray(rawTags) || rawTags.some((tag) => typeof tag !== "string")) {
      throw new TypeError(`${path} 的 tags 必须是字符串数组。`);
    }

    const date = metadata.date instanceof Date
      ? metadata.date.toISOString().slice(0, 10)
      : String(metadata.date).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(`${date}T00:00:00`).getTime())) {
      throw new TypeError(`${path} 的 date 必须使用 YYYY-MM-DD 格式。`);
    }

    const defaultId = path.split("/").pop().replace(/\.md$/i, "");
    return {
      id: typeof metadata.slug === "string" && metadata.slug.trim() ? metadata.slug.trim() : defaultId,
      title,
      date,
      summary,
      tags: rawTags.map((tag) => tag.trim()).filter(Boolean),
      draft: metadata.draft === true,
      markdown: match[2].trim(),
      path
    };
  }

  async function fetchPost(path) {
    const response = await fetch(path, { cache: "no-cache" });
    if (!response.ok) throw new Error(`${path} 返回 HTTP ${response.status}。`);
    return parseFrontMatter(await response.text(), path);
  }

  async function loadMarkdownPosts() {
    const loading = byId("notes-loading");
    const errorBox = byId("notes-error");
    const manifestUrl = data.postsManifest || "posts/index.json";

    try {
      if (!window.marked || !window.DOMPurify || !window.jsyaml) {
        throw new Error("Markdown 解析组件未能加载。");
      }

      const response = await fetch(manifestUrl, { cache: "no-cache" });
      if (!response.ok) throw new Error(`${manifestUrl} 返回 HTTP ${response.status}。`);
      const manifest = await response.json();
      if (!Array.isArray(manifest)) throw new TypeError(`${manifestUrl} 必须是文件名数组。`);

      const paths = manifest.map(normalizeManifestEntry);
      if (new Set(paths).size !== paths.length) {
        throw new TypeError(`${manifestUrl} 中存在重复文件名。`);
      }

      const results = await Promise.allSettled(paths.map(fetchPost));
      const failures = results.filter((result) => result.status === "rejected");
      notes = results
        .filter((result) => result.status === "fulfilled" && !result.value.draft)
        .map((result) => result.value)
        .sort((a, b) => b.date.localeCompare(a.date, "zh-CN"));

      if (failures.length > 0) {
        failures.forEach((failure) => console.error("Markdown article error:", failure.reason));
        errorBox.hidden = false;
        setText("notes-error-message", `${failures.length} 篇文章无法解析；其他有效文章仍会正常显示。`);
      } else {
        errorBox.hidden = true;
      }
    } catch (error) {
      console.error("Markdown manifest error:", error);
      notes = [];
      errorBox.hidden = false;
      setText("notes-error-message", error.message || "请检查文章清单与 front matter。");
    } finally {
      loading.hidden = true;
      renderFilters();
      renderNotes();
    }
  }

  function noteMatches(note) {
    const query = state.query.trim().toLocaleLowerCase("zh-CN");
    const tagMatches = state.tag === "全部" || note.tags.includes(state.tag);
    if (!query) return tagMatches;
    const haystack = [note.title, note.summary, ...note.tags].join(" ").toLocaleLowerCase("zh-CN");
    return tagMatches && haystack.includes(query);
  }

  function formatDate(date) {
    if (!date) return "日期待补充";
    const parsed = new Date(`${date}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return date;
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(parsed);
  }

  function createTag(tag) {
    const element = document.createElement("span");
    element.className = "note-tag";
    element.textContent = `#${tag}`;
    return element;
  }

  function resolveArticleResources(container, note) {
    const articleUrl = new URL(note.path, window.location.href);
    container.querySelectorAll("a[href]").forEach((link) => {
      const rawHref = link.getAttribute("href");
      if (!rawHref || rawHref.startsWith("#")) return;
      try {
        const resolved = new URL(rawHref, articleUrl);
        if (!["http:", "https:", "mailto:"].includes(resolved.protocol)) throw new Error();
        link.href = resolved.href;
        if (resolved.origin !== window.location.origin) {
          link.target = "_blank";
          link.rel = "noreferrer noopener";
        }
      } catch {
        link.removeAttribute("href");
      }
    });

    container.querySelectorAll("img[src]").forEach((image) => {
      try {
        const resolved = new URL(image.getAttribute("src"), articleUrl);
        if (!["http:", "https:"].includes(resolved.protocol)) throw new Error();
        image.src = resolved.href;
        image.loading = "lazy";
        image.decoding = "async";
      } catch {
        image.remove();
      }
    });
  }

  function renderMarkdown(note) {
    const html = window.marked.parse(note.markdown, { gfm: true, breaks: false });
    const fragment = window.DOMPurify.sanitize(html, {
      RETURN_DOM_FRAGMENT: true,
      USE_PROFILES: { html: true },
      FORBID_TAGS: ["style"],
      FORBID_ATTR: ["style"]
    });
    const content = byId("dialog-content");
    content.replaceChildren(fragment);
    resolveArticleResources(content, note);
  }

  function openNote(note) {
    setText("dialog-title", note.title);
    setText("dialog-date", formatDate(note.date));
    const tags = byId("dialog-tags");
    tags.replaceChildren(...note.tags.map(createTag));

    try {
      renderMarkdown(note);
    } catch (error) {
      const message = document.createElement("p");
      message.className = "markdown-error";
      message.textContent = "这篇 Markdown 文章暂时无法渲染，请检查文件格式。";
      byId("dialog-content").replaceChildren(message);
      console.error("Markdown render error:", error);
    }
    byId("note-dialog").showModal();
  }

  function renderFilters() {
    const filterContainer = byId("tag-filters");
    const tags = [...new Set(notes.flatMap((note) => note.tags))].sort((a, b) => a.localeCompare(b, "zh-CN"));
    filterContainer.replaceChildren();

    ["全部", ...tags].forEach((tag) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "tag-button";
      button.textContent = tag;
      button.setAttribute("aria-pressed", String(state.tag === tag));
      button.addEventListener("click", () => {
        state.tag = tag;
        renderFilters();
        renderNotes();
      });
      filterContainer.append(button);
    });
  }

  function renderNotes() {
    const list = byId("notes-list");
    const empty = byId("notes-empty");
    const searchEmpty = byId("search-empty");
    const tools = byId("note-tools");
    const filtered = notes.filter(noteMatches);
    list.replaceChildren();

    filtered.forEach((note) => {
      const article = document.createElement("article");
      article.className = "note-card";

      const meta = document.createElement("div");
      meta.className = "note-meta";
      const indexLabel = document.createElement("span");
      const date = document.createElement("time");
      indexLabel.textContent = `NOTE_${String(notes.indexOf(note) + 1).padStart(2, "0")}`;
      date.dateTime = note.date;
      date.textContent = formatDate(note.date);
      meta.append(indexLabel, date);

      const title = document.createElement("h3");
      title.textContent = note.title;
      const summary = document.createElement("p");
      summary.textContent = note.summary;

      const footer = document.createElement("div");
      footer.className = "note-card-footer";
      const tags = document.createElement("div");
      tags.className = "note-card-tags";
      tags.append(...note.tags.map(createTag));
      const button = document.createElement("button");
      button.className = "read-button";
      button.type = "button";
      button.append("阅读笔记", createIcon("arrow-up-right"));
      button.addEventListener("click", () => openNote(note));
      footer.append(tags, button);

      article.append(meta, title, summary, footer);
      list.append(article);
    });

    byId("notes-count").textContent = `${filtered.length} / ${notes.length} 篇记录`;
    empty.hidden = notes.length !== 0 || !byId("notes-error").hidden;
    tools.hidden = notes.length === 0;
    list.hidden = filtered.length === 0;
    searchEmpty.hidden = notes.length === 0 || filtered.length !== 0;
    refreshIcons();
  }

  function refreshIcons() {
    if (window.lucide) {
      window.lucide.createIcons({ attrs: { "stroke-width": 1.8 } });
      document.documentElement.classList.add("icons-ready");
    }
  }

  function initDialog() {
    const dialog = byId("note-dialog");
    byId("dialog-close").addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
  }

  function initSearch() {
    byId("note-search").addEventListener("input", (event) => {
      state.query = event.target.value;
      renderNotes();
    });
  }

  renderProfile();
  renderStats();
  renderFocus();
  initDialog();
  initSearch();
  refreshIcons();
  loadMarkdownPosts();
})();
