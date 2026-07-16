(() => {
  "use strict";

  function ensureDependencies() {
    if (!window.marked || !window.DOMPurify || !window.jsyaml) {
      throw new Error("Markdown 解析组件未能加载。");
    }
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
    ensureDependencies();
    const match = source.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?([\s\S]*)$/);
    if (!match) throw new SyntaxError(`${path} 缺少有效的 YAML front matter。`);

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

  async function fetchManifest(manifestUrl = "posts/index.json") {
    const response = await fetch(manifestUrl, { cache: "no-cache" });
    if (!response.ok) throw new Error(`${manifestUrl} 返回 HTTP ${response.status}。`);
    const manifest = await response.json();
    if (!Array.isArray(manifest)) throw new TypeError(`${manifestUrl} 必须是文件名数组。`);

    const paths = manifest.map(normalizeManifestEntry);
    if (new Set(paths).size !== paths.length) {
      throw new TypeError(`${manifestUrl} 中存在重复文件名。`);
    }
    return paths;
  }

  async function fetchPost(path) {
    const response = await fetch(path, { cache: "no-cache" });
    if (!response.ok) throw new Error(`${path} 返回 HTTP ${response.status}。`);
    return parseFrontMatter(await response.text(), path);
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

  function articleHref(note) {
    const filename = note.path.replace(/^posts\//, "");
    return `article.html?post=${encodeURIComponent(filename)}`;
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

    container.querySelectorAll("pre > code").forEach((code) => {
      const languageClass = [...code.classList].find((name) => name.startsWith("language-"));
      const language = languageClass ? languageClass.slice("language-".length) : "CODE";
      const pre = code.parentElement;
      pre.dataset.language = language.toUpperCase();
      pre.tabIndex = 0;
      pre.setAttribute("aria-label", `${language} 代码块`);
    });
  }

  function renderMarkdown(container, note) {
    ensureDependencies();
    const html = window.marked.parse(note.markdown, { gfm: true, breaks: false });
    const fragment = window.DOMPurify.sanitize(html, {
      RETURN_DOM_FRAGMENT: true,
      USE_PROFILES: { html: true },
      FORBID_TAGS: ["style"],
      FORBID_ATTR: ["style"]
    });
    container.replaceChildren(fragment);
    const firstHeading = container.querySelector(":scope > h1:first-child");
    if (firstHeading && firstHeading.textContent.trim() === note.title.trim()) {
      firstHeading.remove();
    }
    resolveArticleResources(container, note);
  }

  window.RBlogMarkdown = Object.freeze({
    ensureDependencies,
    normalizeManifestEntry,
    parseFrontMatter,
    fetchManifest,
    fetchPost,
    formatDate,
    articleHref,
    renderMarkdown
  });
})();
