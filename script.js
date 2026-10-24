(() => {
  "use strict";
  const data = window.BLOG_CONTENT || {};
  const markdown = window.RBlogMarkdown;
  const ui = window.RBlogUI;
  const byId = (id) => document.getElementById(id);
  const initial = new URLSearchParams(location.search);
  const state = { query: initial.get("q") || "", tag: initial.get("tag") || "全部", expanded: false };
  let notes = [];
  let topics = [];
  const text = (id, value) => { if (value) byId(id).textContent = value; };

  function renderProfile() {
    const profile = data.profile || {};
    ["name", "role", "tagline", "bio"].forEach((key) => text("profile-" + key, profile[key]));
    text("footer-owner", profile.name);
    const avatar = byId("profile-avatar");
    const onError = () => { avatar.hidden = true; byId("avatar-fallback").hidden = false; };
    avatar.addEventListener("error", onError, { once: true });
    if (profile.avatar) avatar.src = profile.avatar;
    avatar.alt = (profile.name || "broruan") + " 的头像";
    if (avatar.complete && !avatar.naturalWidth) onError();
    ["header-github-link", "hero-github-link"].forEach((id) => byId(id).href = data.links?.github || "https://github.com/broruan");
    const meta = byId("profile-meta");
    (profile.meta || []).forEach((item) => {
      const row = document.createElement("div");
      const dt = document.createElement("dt");
      const dd = document.createElement("dd");
      dt.textContent = item.label; dd.textContent = item.value;
      row.append(dt, dd); meta.append(row);
    });
    meta.hidden = !meta.children.length;
    const focusItems = Array.isArray(data.currentFocus) ? data.currentFocus : [];
    byId("focus").hidden = !focusItems.length;
    focusItems.forEach((focus) => {
      const item = document.createElement("article");
      item.className = "focus-item";
      const title = document.createElement("h3"); title.textContent = focus.title;
      const description = document.createElement("p"); description.textContent = focus.description;
      const status = document.createElement("span"); status.className = "focus-status"; status.textContent = focus.status || "进行中";
      item.append(title, description, status);
      if (Number.isFinite(focus.progress)) {
        const progress = document.createElement("div");
        progress.className = "focus-progress";
        progress.setAttribute("role", "progressbar");
        progress.setAttribute("aria-label", focus.title + " 进度");
        progress.setAttribute("aria-valuemin", "0"); progress.setAttribute("aria-valuemax", "100");
        progress.setAttribute("aria-valuenow", String(Math.min(100, Math.max(0, focus.progress))));
        const fill = document.createElement("span"); fill.style.width = progress.getAttribute("aria-valuenow") + "%";
        progress.append(fill); item.append(progress);
      }
      byId("focus-list").append(item);
    });
  }

  function updateURL() {
    const url = new URL(location.href);
    state.query ? url.searchParams.set("q", state.query) : url.searchParams.delete("q");
    state.tag !== "全部" ? url.searchParams.set("tag", state.tag) : url.searchParams.delete("tag");
    history.replaceState(null, "", url);
  }
  function selectTag(tag) {
    state.tag = tag;
    updateURL(); renderFilters(); renderTopics(); renderNotes();
  }
  function renderFilters() {
    const container = byId("tag-filters");
    const visible = state.expanded ? topics : topics.filter((item, index) => index < 6 || item.tag === state.tag);
    container.replaceChildren();
    [{ tag: "全部", count: notes.length }, ...visible].forEach(({tag, count}) => {
      const button = document.createElement("button");
      button.type = "button"; button.className = "tag-button";
      button.append(tag);
      const amount = document.createElement("span"); amount.className = "tag-count"; amount.textContent = count;
      button.append(amount); button.setAttribute("aria-pressed", String(state.tag === tag));
      button.addEventListener("click", () => selectTag(tag)); container.append(button);
    });
    const expand = byId("expand-tags");
    expand.hidden = topics.length <= 6;
    expand.textContent = state.expanded ? "收起标签 −" : "展开全部 ＋";
    expand.setAttribute("aria-expanded", String(state.expanded));
  }
  function renderTopics() {
    const container = byId("topic-list"); container.replaceChildren();
    topics.slice(0, 5).forEach(({tag, count}) => {
      const button = document.createElement("button"); button.className = "topic-button"; button.type = "button";
      const label = document.createElement("span"); label.className = "topic-label"; label.textContent = tag;
      const amount = document.createElement("span"); amount.textContent = String(count).padStart(2, "0");
      button.append(label, amount); button.setAttribute("aria-pressed", String(state.tag === tag));
      button.addEventListener("click", () => selectTag(tag)); container.append(button);
    });
  }
  function renderStats() {
    const stats = data.learningStats?.length ? data.learningStats : [
      { value: String(notes.length).padStart(2, "0"), label: "篇公开手记" },
      { value: String(topics.length).padStart(2, "0"), label: "个探索主题" }
    ];
    byId("stats-strip").replaceChildren(...stats.map((stat) => {
      const item = document.createElement("div");
      const value = document.createElement("strong"); value.textContent = stat.value;
      const label = document.createElement("span"); label.textContent = stat.label;
      item.append(value, label); return item;
    }));
    text("notebook-count", notes.length + " 篇手记 · 持续更新中");
  }
  function renderNotes() {
    const query = state.query.trim().toLocaleLowerCase("zh-CN");
    const filtered = notes.filter((note) => (state.tag === "全部" || note.tags.includes(state.tag)) && (!query || note.searchText.includes(query)));
    const list = byId("notes-list"); list.replaceChildren();
    filtered.forEach((note) => {
      const index = notes.indexOf(note);
      const featured = index === 0 && !query && state.tag === "全部";
      const article = document.createElement("article"); article.className = "note-card" + (featured ? " is-featured" : "");
      const meta = document.createElement("div");
      const number = document.createElement("span"); number.className = "note-number"; number.textContent = String(index + 1).padStart(2, "0");
      const date = document.createElement("time"); date.className = "note-date"; date.dateTime = note.date;
      date.append(note.date.slice(5).replace("-", "."));
      const year = document.createElement("span"); year.textContent = note.date.slice(0, 4); date.append(year); meta.append(number, date);
      const content = document.createElement("div"); content.className = "note-content";
      if (featured) {
        const label = document.createElement("span"); label.className = "latest-label"; label.append(ui.icon("sparkles"), "最近一篇 / LATEST NOTE"); content.append(label);
      }
      const title = document.createElement("h3"); const link = document.createElement("a");
      link.href = markdown.articleHref(note); link.textContent = note.title; title.append(link);
      const summary = document.createElement("p"); summary.textContent = note.summary;
      const footer = document.createElement("div"); footer.className = "note-card-footer";
      const tags = document.createElement("div"); tags.className = "note-card-tags";
      note.tags.forEach((tag) => { const element = document.createElement("span"); element.className = "note-tag"; element.textContent = "# " + tag; tags.append(element); });
      const time = document.createElement("span"); time.className = "note-read-time"; time.textContent = "约 " + markdown.readingMinutes(note.markdown) + " 分钟";
      footer.append(tags, time); content.append(title, summary, footer);
      const arrow = document.createElement("span"); arrow.className = "note-arrow"; arrow.setAttribute("aria-hidden", "true"); arrow.append(ui.icon("arrow-up-right"));
      article.append(meta, content, arrow); list.append(article);
    });
    text("notes-count", filtered.length === notes.length ? notes.length + " 篇公开手记" : filtered.length + " / " + notes.length + " 篇手记");
    byId("note-tools").hidden = !notes.length;
    byId("notes-empty").hidden = !!notes.length || !byId("notes-error").hidden;
    byId("search-empty").hidden = !notes.length || !!filtered.length;
    ui.refreshIcons();
  }
  async function loadNotes() {
    try {
      const paths = await markdown.fetchManifest(data.postsManifest || "posts/index.json");
      const results = await Promise.allSettled(paths.map(markdown.fetchPost));
      const failures = results.filter((result) => result.status === "rejected");
      notes = results.filter((result) => result.status === "fulfilled" && !result.value.draft).map((result) => result.value).sort((a, b) => b.date.localeCompare(a.date));
      notes.forEach((note) => note.searchText = [note.title, note.summary, ...note.tags, note.markdown].join(" ").toLocaleLowerCase("zh-CN"));
      const counts = new Map(); notes.forEach((note) => new Set(note.tags).forEach((tag) => counts.set(tag, (counts.get(tag) || 0) + 1)));
      topics = [...counts].map(([tag, count]) => ({tag, count})).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "zh-CN"));
      if (state.tag !== "全部" && !counts.has(state.tag)) { state.tag = "全部"; updateURL(); }
      if (failures.length) {
        byId("notes-error").hidden = false; text("notes-error-message", failures.length + " 篇手记读取失败，其他手记可以正常阅读。");
        failures.forEach((failure) => console.error(failure.reason));
      }
    } catch (error) {
      byId("notes-error").hidden = false; text("notes-error-message", error.message);
    } finally {
      byId("notes-loading").hidden = true;
      renderFilters(); renderTopics(); renderStats(); renderNotes();
    }
  }
  renderProfile();
  byId("note-search").value = state.query;
  byId("note-search").addEventListener("input", (event) => { state.query = event.target.value; updateURL(); renderNotes(); });
  byId("expand-tags").addEventListener("click", () => { state.expanded = !state.expanded; renderFilters(); });
  byId("reset-search").addEventListener("click", () => { state.query = ""; byId("note-search").value = ""; selectTag("全部"); byId("note-search").focus(); });
  document.addEventListener("keydown", (event) => {
    if (event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && !document.activeElement.isContentEditable) { event.preventDefault(); byId("note-search").focus(); }
  });
  loadNotes();
})();
