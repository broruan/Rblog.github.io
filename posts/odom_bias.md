---
title: "odom坐标系纠偏以及重定位发布的tf"
date: 2026-08-07
summary: "纠正学习中误解的概念"
tags:
  - odom
  - Nav2
draft: false
---


## odom坐标系的重新理解
---
* **理解：** 是看你自己用哪一个里程计或者imu，是其刚开机初始化时的位置。启动完成后，这个坐标系就固定了，之后里程计或者imu就是发布 *odom->base_link* 的tf。然后 *map->odom* 的tf就是由重定位发布了。

---

## 重定位为什么发布 *map->odom* 的tf
---
* **原因：** 实际上由雷达点云实现的重定位是已知 *map->base_link* 的，反推出 *map->odom* 的。然后这个 *map->odom* 并不是odom在动，odom是一定不能动的，要不然里程计或者imu就乱了，它只是修正了 *odom->base_link* 的误差，然后相信**重定位**的位置。（实际上我觉得 *map->odom* 就相当于里程计的误差了）。
---