---
title: "ROS 2 Nav2 配置与常见坑点排查指南"
date: 2026-07-23
summary: "解决Nav2参数配置的若干问题"
tags:
  - Nav2
draft: false
---



本指南记录了 Nav2 栅格地图加载、参数文件配置、RViz2 调试以及 ROS 2 自定义消息类型桥接的完整解决方案。

---

## 一、 栅格地图加载与 Launch 启动配置

### 1.1 地图文件构成
标准的 2D 栅格地图通常由两个文件组成：
* `map.pgm`：保存像素与障碍物信息的图像文件。
* `map.yaml`：描述元数据（分辨率、原点坐标、图片相对/绝对路径等）。

### 1.2 Python Launch 文件调用 Nav2 标准 Bringup
使用 `IncludeLaunchDescription` 嵌套调用 Nav2 官方 `bringup_launch.py` 是最规范的做法：

```python
import os
import launch
import launch_ros
from ament_index_python import get_package_share_directory
from launch.actions import IncludeLaunchDescription
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch_ros.substitutions import FindPackageShare

# 获取包路径与地图/配置文件路径
share_directory = get_package_share_directory("nav_test")
nav2_params = os.path.join(share_directory, "config", "nav2_params.yaml")
map_path = os.path.join(share_directory, "PGM", "my_map.yaml") # ⚠️ 必须传入地图的 yaml，非参数 yaml！

def generate_launch_description():
    # 嵌套调用 nav2_bringup 官方 launch
    nav2_bringup_launch = IncludeLaunchDescription(
        PythonLaunchDescriptionSource(
            os.path.join(FindPackageShare('nav2_bringup').find('nav2_bringup'), 
                         'launch', 'bringup_launch.py')
        ),
        launch_arguments={
            'map': map_path,               # 传入地图 yaml 文件路径
            'params_file': nav2_params,     # 传入 nav2 参数配置文件路径
            'use_sim_time': 'false'
        }.items()
    )

    rviz_launch = launch_ros.actions.Node(
        package="rviz2",
        executable="rviz2",
        output="screen",
        parameters=[{"use_sim_time": False}]
    )

    return launch.LaunchDescription([
        rviz_launch,
        nav2_bringup_launch,
    ])
```

---

## 二、 踩坑与排查集锦

### 2.1 报错：`Couldn't load critics! Caught exception: No critics defined for FollowPath`
* **原因**：使用 DWB 局部路径规划器（`dwb_core::DWBLocalPlanner`）时，未给 `FollowPath` 插件配置 `critics`（打分函数列表）。
* **解决办法**：在 `nav2_params.yaml` 中补充 `critics` 数组及对应评价器配置。

### 2.2 报错：`class GoalCritic ... does not exist`
* **原因**：DWB 评价器的名称填写不符合规范。不能写成 `GoalCritic` 或 `PathCritic`。
* **正确映射**：
  * 目标点距离评价器：**`GoalDist`** (全称 `dwb_critics::GoalDistCritic`)
  * 全局路径距离评价器：**`PathDist`** (全称 `dwb_critics::PathDistCritic`)

#### 💡 `FollowPath` 标准配置示范：
```yaml
controller_server:
  ros__parameters:
    FollowPath:
      plugin: "dwb_core::DWBLocalPlanner"
      # ... [速度与加速度限制参数略] ...
      
      critics: ["RotateToGoal", "Oscillation", "BaseObstacle", "GoalDist", "GoalAlign", "PathDist", "PathAlign"]
      
      BaseObstacle:
        scale: 0.02
      PathDist:
        scale: 32.0
      PathAlign:
        scale: 32.0
        forward_point_distance: 0.1
      GoalDist:
        scale: 24.0
      GoalAlign:
        scale: 24.0
        forward_point_distance: 0.1
      RotateToGoal:
        scale: 32.0
        slowing_factor: 5.0
        lookahead_time: -1.0
```

---

### 2.3 RViz2 显示 `No map received`
如果代码逻辑正常但地图不显示，按照以下两步排查：

1. **服务质量 QoS 不匹配（最常见）**：
   * `map_server` 使用 **`Transient Local`** 通信模式发布地图。
   * **解决**：在 RViz2 左侧的 `Map` 插件中，展开 **`Topic`**，将 **`Durability Policy`** 从 `Volatile` 修改为 **`Transient Local`**。
2. **`CMakeLists.txt` 未正确安装资源**：
   * 检查 `install/` 目录下是否存在地图文件夹。若缺失，需在 `CMakeLists.txt` 中添加：
     ```cmake
     install(DIRECTORY config PGM launch DESTINATION share/${PROJECT_NAME})
     ```

---

### 2.4 雷达与传感器话题配置
* **`global_costmap`** 与 **`local_costmap`** 是独立的图层模块，即使使用同一雷达，也**必须分别**在两处的 `observation_sources` 里填入实际的雷达话题（如 `/scan`）。
* **IMU 数据不需要接入代价地图**，IMU 主要接入卡尔曼滤波节点（`robot_localization` 的 `ekf_node`）用于里程计与姿态融合。

---

## 三、 修改 Nav2 话题与自定义消息类型

### 3.1 默认的核心话题机制
在 Nav2 中，控制器（`controller_server`）和全局规划器（`planner_server`）发布/订阅的话题是固定的默认规范，但也可以在配置文件或 Launch 文件中进行重映射（Remap）。

#### 1. 默认的核心话题表
不需要额外设置，Nav2 启动后默认的话题映射如下：

| 节点 (Server) | 话题功能 | 默认话题名称 | 数据类型 (Message Type) | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| **`planner_server`** | 发布全局路径 | `/plan` | `nav_msgs/msg/Path` | 规划器算出的全局路线（RViz 里选这个看全景路径） |
| **`controller_server`** | 发布局部路径 | `/local_plan` | `nav_msgs/msg/Path` | 控制器当前帧计算的局部拟合路径 |
| **`controller_server`** | 发布控制指令 | `/cmd_vel` | `geometry_msgs/msg/Twist` 或 `TwistStamped` | 传给底盘驱动节点的速度控制指令 |

#### 2. 在终端查看当前发布的话题
启动 Nav2 节点后，可以使用 ROS 2 命令行工具验证：

```bash
# 查看特定节点发布的所有话题
ros2 node info /planner_server
ros2 node info /controller_server

# 检查路径和速度话题是否有输出
ros2 topic echo /plan
ros2 topic echo /cmd_vel
```

#### 3. 修改/重映射话题名称

* **方式 A：在 Python Launch 文件中重映射（最推荐）**  
  直接在 Launch 文件中启动 `controller_server` 或 `bringup_launch.py` 时添加 `remappings` 参数：
  ```python
  nav2_bringup_launch = IncludeLaunchDescription(
      PythonLaunchDescriptionSource(
          os.path.join(FindPackageShare('nav2_bringup').find('nav2_bringup'), 
                       'launch', 'bringup_launch.py')
      ),
      launch_arguments={
          'map': map_path,
          'params_file': nav2_params,
          'use_sim_time': 'false'
      }.items(),
      # 👇 通过 remappings 重新映射话题名称
      remappings=[
          ('/cmd_vel', '/cmd_vel_nav'),  # 将默认的 /cmd_vel 重命名为 /cmd_vel_nav
          ('/plan', '/global_plan')      # 将默认的 /plan 重命名为 /global_plan
      ]
  )
  ```

* **方式 B：在 `nav2_params.yaml` 中配置 `cmd_vel` 类型**  
  在 ROS 2 Humble 及更高版本中，`controller_server` 增加了对 `TwistStamped`（带时间戳的速度指令）的支持。你可以在 YAML 配置文件中指定它发布的数据类型：
  ```yaml
  controller_server:
    ros__parameters:
      use_sim_time: false
      # 是否加上 Header 时间戳信息（默认是 Twist，开启后变成 TwistStamped）
      type_of_cmd_vel: 0  # 0: geometry_msgs/Twist, 1: geometry_msgs/TwistStamped
  ```

> 💡 **建议**：  
> 除非底盘节点有特殊的话题命名要求，否则强烈建议保持默认的 `/plan` 和 `/cmd_vel`。如果底盘话题不同，优先在 Launch 文件里用 `remappings` 映射过去，这样可以避免修改 Nav2 核心 YAML 的结构。

---

### 3.2 将话题数据类型修改为“自定义消息类型” (Custom Msg)
Nav2 的 C++ 源码中硬编码了默认输出类型（如 `geometry_msgs::msg::Twist`），**无法直接通过修改 `.yaml` 参数文件来改变数据类型**。

**推荐方案**：编写一个极简的 C++ 桥接节点（Bridge Node）做数据转发与类型转换。

---

### 3.3 C++ 桥接节点开发实践

#### 1. 源码逻辑 (`src/cmd_vel_bridge.cpp`)
```cpp
#include <memory>
#include "rclcpp/rclcpp.hpp"
#include "geometry_msgs/msg/twist.hpp"
// 包含自定义消息头文件：<包名>/msg/<消息名_小写下划线>.hpp
#include "my_custom_msgs/msg/my_cmd_vel.hpp" 

class CmdVelBridge : public rclcpp::Node
{
public:
  CmdVelBridge() : Node("cmd_vel_bridge")
  {
    // 订阅 Nav2 输出的标准 /cmd_vel
    sub_ = this->create_subscription<geometry_msgs::msg::Twist>(
      "/cmd_vel", 10, std::bind(&CmdVelBridge::cmdVelCallback, this, std::placeholders::_1));

    // 发布自定义数据类型话题
    pub_ = this->create_publisher<my_custom_msgs::msg::MyCmdVel>("/my_robot/custom_cmd", 10);
  }

private:
  void cmdVelCallback(const geometry_msgs::msg::Twist::SharedPtr msg)
  {
    auto custom_msg = my_custom_msgs::msg::MyCmdVel();
    // 提取字段并转换
    custom_msg.linear_x = msg->linear.x;
    custom_msg.angular_z = msg->angular.z;

    pub_->publish(custom_msg);
  }

  rclcpp::Subscription<geometry_msgs::msg::Twist>::SharedPtr sub_;
  rclcpp::Publisher<my_custom_msgs::msg::MyCmdVel>::SharedPtr pub_;
};

int main(int argc, char **argv)
{
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<CmdVelBridge>());
  rclcpp::shutdown();
  return 0;
}
```

#### 2. 引入外部/自定义 msg 包所需修改的文件

##### 📁 `package.xml`
声明依赖包名称：
```xml
<depend>rclcpp</depend>
<depend>geometry_msgs</depend>
<depend>my_custom_msgs</depend> <!-- 👈 引入目标 msg 包名 -->
```

##### 📁 `CMakeLists.txt`
配置依赖与编译规则：
```cmake
find_package(ament_cmake REQUIRED)
find_package(rclcpp REQUIRED)
find_package(geometry_msgs REQUIRED)
find_package(my_custom_msgs REQUIRED) # 👈 1. Find 目标包

add_executable(cmd_vel_bridge src/cmd_vel_bridge.cpp)

ament_target_dependencies(cmd_vel_bridge
  rclcpp
  geometry_msgs
  my_custom_msgs                       # 👈 2. 挂载依赖
)

install(TARGETS
  cmd_vel_bridge
  DESTINATION lib/${PROJECT_NAME}
)
```