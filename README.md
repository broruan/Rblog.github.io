# R.Blog

broruan 的静态学习博客。站点无需构建工具，由 GitHub Pages 直接发布。

## 更新个人资料

打开 `content.js`，修改 `profile`、`currentFocus`、`learningStats` 和 `links`。页面会自动读取这些数据。

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

## 发布一篇笔记

在 `content.js` 的 `notes` 数组中加入一项：

```js
{
  id: "unique-note-id",
  title: "笔记标题",
  date: "2026-07-15",
  summary: "一句话概括这篇笔记解决了什么问题。",
  tags: ["标签一", "标签二"],
  body: [
    { type: "paragraph", text: "正文段落。" },
    { type: "heading", text: "小标题" },
    { type: "list", items: ["第一项", "第二项"] },
    { type: "code", language: "javascript", code: "console.log('hello');" }
  ]
}
```

支持的正文块类型为 `paragraph`、`heading`、`list` 和 `code`。内容通过安全的 DOM API 渲染，不会把正文当作 HTML 执行。

## 发布到 GitHub Pages

1. 提交并推送修改到 `main` 分支。
2. 打开仓库的 **Settings → Pages**。
3. 在 **Build and deployment** 中选择 **Deploy from a branch**。
4. 选择 `main` 分支和 `/(root)` 目录后保存。

发布地址：<https://broruan.github.io/Rblog.github.io/>
