# R.Blog

broruan 的静态学习博客。个人资料保存在 `content.js`，所有公开文章都使用 Markdown 编写并由浏览器解析。

## 写一篇文章

1. 在 `posts/` 中创建一个 `.md` 文件，例如 `css-grid-notes.md`。
2. 在文件开头填写 YAML front matter。
3. 把文件名加入 `posts/index.json`。
4. 提交并推送到 `main`，GitHub Pages 会自动更新。

完整文章格式：

````markdown
---
title: "文章标题"
date: 2026-07-15
summary: "一句话说明这篇文章解决了什么问题。"
tags:
  - CSS
  - 前端
draft: false
---

这里开始写 Markdown 正文。

## 小标题

- 支持列表
- 支持 **粗体**、链接、图片和表格

```javascript
console.log("代码围栏也可以正常显示");
```
````

必填字段是 `title`、`date` 和 `summary`。`date` 必须使用 `YYYY-MM-DD`；`tags` 必须是 YAML 数组。设置 `draft: true` 后，文章仍可保存在仓库中，但不会出现在网站上。

## 登记文章

`posts/index.json` 是一个 JSON 文件名数组：

```json
[
  "css-grid-notes.md",
  "javascript-async.md"
]
```

文章会按日期从新到旧排列。清单中可以包含子目录，例如 `frontend/css-grid.md`，但不允许绝对路径或 `..`。

## Markdown 能力

正文支持 GitHub Flavored Markdown，包括标题、段落、粗体、斜体、链接、图片、引用、列表、任务列表、表格、分隔线、行内代码和代码围栏。

Markdown 由本地固定版本的 Marked 解析，YAML 由 js-yaml 解析，生成结果经过 DOMPurify 消毒后才进入页面。文章内的相对链接和图片路径以该 `.md` 文件所在位置为基准。

## 更新个人资料

打开 `content.js`，修改 `profile`、`currentFocus`、`learningStats` 和 `links`。`postsManifest` 通常保持为 `posts/index.json`。

学习方向格式：

```js
currentFocus: [
  {
    title: "学习方向名称",
    description: "正在解决的问题或本阶段目标",
    status: "进行中",
    progress: 40
  }
]
```

`progress` 为 `0` 到 `100` 的数字；不需要进度条时可以删除该字段。

## 本地预览

浏览器直接打开 HTML 时无法通过 `fetch` 读取 Markdown。请在仓库根目录启动任意静态服务器，例如：

```powershell
python -m http.server 4173
```

然后访问 <http://127.0.0.1:4173/>。

## 发布到 GitHub Pages

提交并推送到 `main` 分支即可。当前 Pages 从 `main` 的仓库根目录发布：

<https://broruan.github.io/Rblog.github.io/>
