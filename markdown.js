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

  const escapeHtml = (value) => value.replace(/[&<>\"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
  let parser;
  function getParser() {
    if (parser) return parser;
    // Tokenize math before Markdown consumes TeX escapes, but leave code untouched.
    const mathRenderer = (token) => '<span class="math-' + (token.display ? 'display' : 'inline') + '" data-tex="' + encodeURIComponent(token.text) + '">' + escapeHtml(token.text) + '</span>';
    parser = new window.marked.Marked({ gfm: true, breaks: false });
    parser.use({ extensions: [
      {
        name: "mathBlock", level: "block",
        start: (src) => src.search(/(?:^|\n)[ \t]*(?:\$\$|\\\[)/),
        tokenizer(src) {
          const match = /^(?:\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\])[ \t]*(?:\n|$)/.exec(src);
          if (match) return { type: "mathBlock", raw: match[0], text: (match[1] ?? match[2]).trim(), display: true };
        },
        renderer: mathRenderer
      },
      {
        name: "mathInline", level: "inline",
        start: (src) => src.search(/\$|\\\(/),
        tokenizer(src) {
          let match = /^(?:\$\$([\s\S]+?)\$\$|\\\(([^\n]+?)\\\))/.exec(src);
          if (match) return { type: "mathInline", raw: match[0], text: (match[1] ?? match[2]).trim(), display: match[1] != null };
          match = /^\$((?:\\.|[^$\\\n])+?)\$(?!\d)/.exec(src);
          if (match && !/^\s|\s$/.test(match[1])) return { type: "mathInline", raw: match[0], text: match[1], display: false };
        },
        renderer: mathRenderer
      }
    ] });
    return parser;
  }

  function readingMinutes(source) {
    const withoutCode = source.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, "");
    const chinese = (withoutCode.match(/[\u3400-\u9fff]/g) || []).length;
    const words = (withoutCode.match(/[a-zA-Z0-9_]+/g) || []).length;
    const codeLines = [...source.matchAll(/```[\s\S]*?```|~~~[\s\S]*?~~~/g)].reduce((count, match) => count + match[0].split("\n").length - 2, 0);
    return Math.max(1, Math.ceil(chinese / 350 + words / 200 + codeLines / 50));
  }

  function resolveArticleResources(container, note) {
    const articleUrl = new URL(note.path, window.location.href);
    const postsUrl = new URL("posts/", window.location.href);
    container.querySelectorAll("a[href]").forEach((link) => {
      const rawHref = link.getAttribute("href");
      if (!rawHref || rawHref.startsWith("#")) return;
      try {
        const resolved = new URL(rawHref, articleUrl);
        if (!["http:", "https:", "mailto:"].includes(resolved.protocol)) throw new Error();
        if (resolved.origin === postsUrl.origin && resolved.pathname.startsWith(postsUrl.pathname) && resolved.pathname.endsWith(".md")) {
          const filename = decodeURIComponent(resolved.pathname.slice(postsUrl.pathname.length));
          normalizeManifestEntry(filename);
          link.href = articleHref({ path: "posts/" + filename }) + resolved.hash;
        } else {
          link.href = resolved.href;
        }
        if (resolved.origin !== window.location.origin) { link.target = "_blank"; link.rel = "noreferrer noopener"; }
      } catch { link.removeAttribute("href"); }
    });
    container.querySelectorAll("img[src]").forEach((image) => {
      try {
        const resolved = new URL(image.getAttribute("src"), articleUrl);
        if (!["http:", "https:"].includes(resolved.protocol)) throw new Error();
        image.src = resolved.href; image.loading = "lazy"; image.decoding = "async";
        // Enlarge standalone images only; keep linked and inline images intact.
        const paragraph = image.parentElement;
        if (paragraph.tagName === "P" && paragraph.children.length === 1 && !paragraph.textContent.trim()) {
          const figure = document.createElement("figure"); figure.className = "image-figure";
          const button = document.createElement("button"); button.type = "button"; button.className = "article-image";
          button.setAttribute("aria-label", "放大图片：" + (image.alt || "文章插图"));
          button.append(image); figure.append(button);
          if (image.alt && !/^(img|image)$/i.test(image.alt)) { const caption = document.createElement("figcaption"); caption.textContent = image.alt; figure.append(caption); }
          paragraph.replaceWith(figure);
        }
      } catch { image.remove(); }
    });
  }

  function enhanceCode(container) {
    const aliases = { sh: "bash", shell: "bash", yml: "yaml", py: "python", js: "javascript", ts: "typescript", "c++": "cpp", ros: "yaml", msg: "yaml", srv: "yaml", action: "yaml", cmake: "cmake" };
    container.querySelectorAll("pre > code").forEach((code) => {
      const source = code.textContent;
      const languageClass = [...code.classList].find((name) => name.startsWith("language-"));
      const rawLanguage = languageClass ? languageClass.slice(9).toLowerCase() : "text";
      const language = aliases[rawLanguage] || rawLanguage;
      if (window.hljs?.getLanguage(language)) {
        code.innerHTML = window.hljs.highlight(source, { language, ignoreIllegals: true }).value;
        code.classList.add("hljs");
      }
      const pre = code.parentElement;
      pre.tabIndex = 0; pre.setAttribute("aria-label", rawLanguage + " 代码块，可横向滚动");
      const wrapper = document.createElement("div"); wrapper.className = "code-block";
      const toolbar = document.createElement("div"); toolbar.className = "code-toolbar";
      const label = document.createElement("span"); label.className = "code-language"; label.textContent = rawLanguage;
      const button = document.createElement("button"); button.type = "button"; button.className = "copy-code";
      button.setAttribute("aria-label", "复制 " + rawLanguage + " 代码"); button.setAttribute("aria-live", "polite");
      button.append(window.RBlogUI.icon("copy"), "复制代码");
      let resetTimer;
      button.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(source);
          button.replaceChildren(window.RBlogUI.icon("check"), "已复制");
        } catch {
          // A useful fallback when clipboard access is blocked (e.g. plain HTTP).
          const selection = window.getSelection(); const range = document.createRange();
          range.selectNodeContents(code); selection.removeAllRanges(); selection.addRange(range);
          button.textContent = "已选中，请手动复制";
        }
        window.RBlogUI.refreshIcons();
        clearTimeout(resetTimer);
        resetTimer = setTimeout(() => { button.replaceChildren(window.RBlogUI.icon("copy"), "复制代码"); window.RBlogUI.refreshIcons(); }, 2400);
      });
      toolbar.append(label, button); pre.before(wrapper); wrapper.append(toolbar, pre);
    });
  }

  function enhanceHeadings(container) {
    const used = new Set([...document.querySelectorAll("[id]")].map((element) => element.id));
    return [...container.querySelectorAll("h1, h2, h3, h4, h5, h6")].map((heading) => {
      const text = heading.textContent.trim();
      const base = text.toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, "").trim().replace(/\s+/g, "-") || "section";
      let id = base; let suffix = 1;
      while (used.has(id)) id = base + "-" + suffix++;
      heading.id = id; used.add(id);
      const anchor = document.createElement("a"); anchor.className = "heading-anchor"; anchor.href = "#" + encodeURIComponent(id);
      anchor.textContent = "#"; anchor.setAttribute("aria-label", "跳转到：" + text);
      heading.append(anchor);
      return { id, text, level: Number(heading.tagName[1]), element: heading };
    });
  }

  function enhanceBlocks(container) {
    container.querySelectorAll("table").forEach((table) => {
      const wrapper = document.createElement("div"); wrapper.className = "table-scroll"; wrapper.tabIndex = 0;
      wrapper.setAttribute("role", "region"); wrapper.setAttribute("aria-label", "文章表格，可横向滚动");
      table.before(wrapper); wrapper.append(table);
    });
    container.querySelectorAll('li > input[type="checkbox"]').forEach((input) => input.parentElement.classList.add("task-list-item"));
    const callouts = { NOTE: ["提示", "info"], TIP: ["小贴士", "lightbulb"], IMPORTANT: ["重要", "bookmark"], WARNING: ["注意", "triangle-alert"], CAUTION: ["警告", "octagon-alert"] };
    container.querySelectorAll("blockquote").forEach((quote) => {
      const paragraph = quote.firstElementChild;
      const first = paragraph?.firstChild;
      if (paragraph?.tagName !== "P" || first?.nodeType !== Node.TEXT_NODE) return;
      const match = first.textContent.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*(?:\n|$)/);
      if (!match) return;
      const [label, icon] = callouts[match[1]];
      first.textContent = first.textContent.slice(match[0].length);
      const title = document.createElement("div"); title.className = "callout-title"; title.append(window.RBlogUI.icon(icon), label);
      quote.classList.add("callout", "callout-" + match[1].toLowerCase()); quote.prepend(title);
      if (!paragraph.textContent.trim() && !paragraph.children.length) paragraph.remove();
    });
  }

  function renderMarkdown(container, note) {
    ensureDependencies();
    const html = getParser().parse(note.markdown);
    const fragment = window.DOMPurify.sanitize(html, {
      RETURN_DOM_FRAGMENT: true, USE_PROFILES: { html: true },
      FORBID_TAGS: ["style", "form", "button", "textarea", "select"],
      FORBID_ATTR: ["style", "id", "name"]
    });
    container.replaceChildren(fragment);
    const firstHeading = container.querySelector(":scope > h1:first-child");
    if (firstHeading && firstHeading.textContent.trim() === note.title.trim()) firstHeading.remove();
    resolveArticleResources(container, note);
    const headings = enhanceHeadings(container);
    enhanceCode(container); enhanceBlocks(container);
    container.querySelectorAll("[data-tex]").forEach((element) => {
      if (!window.katex) return;
      try {
        window.katex.render(decodeURIComponent(element.dataset.tex), element, {
          displayMode: element.classList.contains("math-display"), throwOnError: false,
          trust: false, strict: "ignore", maxExpand: 1000, maxSize: 20
        });
      } catch { /* A malformed formula should remain readable as source text. */ }
    });
    window.RBlogUI.refreshIcons();
    return headings;
  }

  window.RBlogMarkdown = Object.freeze({
    ensureDependencies, normalizeManifestEntry, parseFrontMatter, fetchManifest,
    fetchPost, formatDate, articleHref, renderMarkdown, readingMinutes
  });
})();
