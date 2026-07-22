---
title: "Livox Mid-360 + FAST-LIO2 + Nav2 架构与实践指南"
date: 2026-07-22
summary: "遇到的一些问题"
tags:
  - Fast-Livo2
  - Nav2
draft: false
---




# Livox Mid-360 + FAST-LIO2 + Nav2 架构与实践指南

---

## 一、 核心概念解析与误区澄清

### Q1：`slam_toolbox` 的定位与使用场景是什么？
* **核心功能：** 基于 2D 占据栅格地图的 SLAM 算法，支持异步/同步模式、图优化闭环检测、长期建图（Lifelong Mapping）及地图序列化。
* **数据要求：** 仅接收 2D 激光雷达数据（`sensor_msgs/msg/LaserScan`）。
* **配置方式：** 采用 ROS 2 标准 YAML 格式（与 Nav2 格式一致），最外层由 `slam_toolbox: ros__parameters:` 包裹。

### Q2：Mid-360 可以直接转 2D 跑 `slam_toolbox` 吗？
* **技术可行性：** 可行（需将 3D `PointCloud2` 截取高度后用 `pointcloud_to_laserscan` 压成 2D `/scan`）。
* **工程结论：** **非常不推荐。**
  * **原因：** 浪费了 Mid-360 360°×59° 的 3D 大视场与内置高频 IMU 的优势。且车身颠簸/仰俯时，2D 切片会斜切到地面或天花板，导致 `slam_toolbox` 出现假墙或定位发散。

---

## 二、 关键技术误区辨析：前端 SLAM 降维 vs. 后端感知投影

> **核心困惑：** 为什么前面说“不要把点云转 2D”，后面又说“把点云转 2D 栅格给 Nav2 导航”？

这两个“转 2D”发生在算法处理的不同阶段，具有本质区别：

| 维度 | 方案 A：入口处转 2D 跑 2D SLAM（错误做法） | 方案 B：3D SLAM 后端投影给 2D Nav2（正确工程实践） |
| :--- | :--- | :--- |
| **数据链路** | 雷达 $\rightarrow$ **2D 切片** $\rightarrow$ `slam_toolbox` | 雷达 + IMU $\rightarrow$ **FAST-LIO2 (3D)** $\rightarrow$ 3D 地图投影 $\rightarrow$ Nav2 |
| **定位（TF）来源** | `slam_toolbox`（仅凭 2D 狭窄特征） | **`FAST-LIO2`（3D 点云 + 高频 IMU 紧耦合）** |
| **抗颠簸能力** | 极差（切片切到地面直接丢失定位） | **极强（IMU 姿态实时补偿，定位绝对稳定）** |
| **本质作用** | 用 2D 切片去**算定位** | 算准 3D 定位后，将障碍物压扁成 2D **供 Nav2 算路** |

---

## 三、 自主探索建图（Autonomous Exploration）

### Q：可以不依赖事先建立的全局地图，让机器人自行探索未知区域并建图吗？
* **答案：** 完全可以。
* **核心算法机制：** **基于前沿点的探索（Frontier-Based Exploration）**。
  1. 系统将实时地图划分为：**已识别自由区（白色）**、**障碍物区（黑色）**、**未知区（灰色）**。
  2. 算法寻找自由区与未知区的交界线（Frontier）。
  3. 选取距离最近/收益最高的前沿点，作为 `Goal Pose` 推送给 Nav2 进行路径规划。
  4. 随着移动，Mid-360 刷出新区域，循环上述逻辑直到整屋扫完。
* **推荐开源工具包：**
  * `explore_lite` (ROS 2 版)：适用于标准 2D 室内环境。
  * `TAO / CMU Exploration`：适用于复杂 3D 空间、斜坡或非平坦地形。

---

## 四、 硬件遮挡与盲区处理（车身自带遮挡）

### 问题描述
当 Mid-360 贴于车身一侧安装，导致部分视场打到车身结构时，会产生近距离静态“自碰撞点云”，导致建图出现假障碍物，且 Nav2 报 `Robot is in collision` 无法发车。

### 解决方案

#### 1. 软件裁剪过滤（最优先）
* **空间框裁剪（Crop Box Filter）：** 利用 PCL 或 `sensor_filters` 包，在基于 `base_link` 的坐标系中定义长方体边界，直接剔除落在车身范围内的点云。
* **盲区过滤（Blind Distance）：** 将 FAST-LIO2 中的 `blind` 参数调大（例如设为 `0.4m`），直接过滤距离雷达中心近距离的点。
* **角度扇区裁剪（Angle Filter）：** 依据极坐标方位角 $\theta = \arctan2(y, x)$，将遮挡的角度区间直接裁掉。

#### 2. 盲区对导航的影响与补救
* **对定位影响：** 极小。即使仅剩 180°~240° 视野，FAST-LIO2 结合 IMU 仍能提供高精度的定位。
* **对导航影响：** 遮挡侧存在“障碍物盲区”，盲目向该侧转向易引发刮蹭。
* **补救措施：** 在 Nav2 的 Costmap 中设置禁行掩膜（Keepout Filter），或在遮挡侧补充低成本传感器（如超声波/双目相机/单线雷达）专门用于防撞避障。

---

## 五、 推荐的完整机器人系统架构图

```text
[Livox Mid-360 雷达] ──(原始点云)──► [Crop Box / Angle Filter]
                                              │
                                       (干净点云 + IMU)
                                              ▼
                                 [FAST-LIO2 (3D SLAM)] ──► 发布高精度 map->odom->base_link TF
                                              │
                                    (实时 3D 局部/全局点云)
                                              ▼
                                [pointcloud_to_laserscan / grid_map]
                                              │
                                       (实时 2D 占据栅格)
                                              ▼
 [explore_lite (自主探索)] ──► [Nav2 路径规划 & Costmap 避障] ──► [底盘控制器 (cmd_vel)]