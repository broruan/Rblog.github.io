---
title: "解决关于输入法在Google浏览器中不显示的问题"
date: 2026-07-15
summary: "已解决"
tags:
  - fcitx4
  - 输入法
draft: false
---


## 根本原因：使用的fcitx4是一个古老的框架，由于Google的Wayland的安全机制，把输入法给拦截了，因此只需要把google改回x11兼容模式就行
- 打开终端，把系统的google文件移动到用户本地（安全起见）
```
cp /usr/share/applications/google-chorme.desktop ~/.local/share/applicateons
```
- 打开desktop文件，进入编辑
```
nano ~/.local/share/applicateons/google-chorme.desktop 
```
- 找到Exec这一行，在后面加上*--ozone-platform=x11*，保存退出重启就行