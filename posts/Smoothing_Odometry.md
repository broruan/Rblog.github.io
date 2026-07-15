---
title: "基于Robot Localization的平滑里程计处理"
date: 2026-07-15
summary: "imu与里程计的数据融合"
tags:
  - Rviz
  - 仿真
  - Odometry
draft: false
---

> 工具：**ekf_node**(扩展卡尔曼滤波)和**ukf_node**(无迹卡尔曼滤波) 
```
odom0_config: [false, false, false,
                      false, false, false,
                      true, true, false,
                      false, false, true,
                      false, false, false]

```
- 在ekf或ukf节点中，15个参数分别是(*(X,Y,Z,roll,pitch,yaw,X˙,Y˙,Z˙,roll˙,pitch˙,yaw˙,X¨,Y¨,Z¨)*),也就是位置、速度、加速度
- #### 对于这几个参数官方给出的实际建议：
1. 同源数据不重复融合：单传感器（如纯编码器）产生的累积位姿和瞬时速度，优先融速度，不要两个都勾选。

2. 零约束是好东西：对于物理上无法发生的运动（如底盘横移、上下蹦迪），如果传感器输出为 0 且协方差极小，勾选为 true 可以作为强约束减少定位漂移。

3. 噪声大的假零不能要：像 IMU 加速度计这种噪声极高、且需要二次积分的物理量，如果物理上测不出该方向的运动，直接设为 false 屏蔽它，千万别引狼入室。

#### 1. 一开始运行碰到机器人结构分类，车体乱飞的情况
- 这是因为在Gazebo标签中发布了odom到base_footprint的tf，而在ekf_node节点中发布了odom到base_link的tf，导致tf树断裂。把ekf_node的基本帧改为base_footprint就行。

#### 2. 机器人走一段距离开始闪回原点，就是一闪一闪的
- 有两个节点发布odom到base_footprint的tf，分别是gazebo和ekf_node。把gazebo中`<publish_odom_tf>false</publish_odom_tf>`改为false就行，然后别忘了再在`ekf.yaml`中发布tf`publish_tf: true`.
> 下一步：制图与定位，Nav2启动！！！