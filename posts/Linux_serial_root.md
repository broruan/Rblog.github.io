---
title: "Linux 串口权限管理学习笔记"
date: 2026-08-05
summary: "解决linux串口调试时的若干问题"
tags:
  - Linux
  - serial
draft: false
---




## 1. 为什么需要给串口赋予权限？

在 Linux 中，串口设备通常以设备文件形式存在：

``` bash
/dev/ttyUSB0
/dev/ttyACM0
```

查看权限：

``` bash
ls -l /dev/ttyUSB0
```

示例：

``` text
crw-rw---- 1 root dialout 188,0 ttyUSB0
```

含义：

-   `root`：设备所有者
-   `dialout`：设备所属用户组
-   `rw-rw----`：
    -   root 可读写
    -   dialout 组用户可读写
    -   其他用户无权限

因此，普通用户如果不属于 `dialout` 组，就无法访问串口。

------------------------------------------------------------------------

# 2. 临时修改串口权限

可以使用：

``` bash
sudo chmod 666 /dev/ttyUSB0
```

权限变成：

``` text
crw-rw-rw-
```

表示所有用户都可以读写。

缺点：

-   重新插拔设备后失效
-   设备编号变化时需要重新设置
-   安全性较低

------------------------------------------------------------------------

# 3. 加入 dialout 用户组（用这种方法已解决）

Linux 推荐通过用户组管理串口权限。

执行：

``` bash
sudo usermod -aG dialout $USER
```

含义：

-   `usermod`：修改用户属性
-   `-G`：指定附加用户组
-   `-a`：append，追加，不覆盖已有组
-   `dialout`：串口设备用户组
-   `$USER`：当前用户名

例如：

``` bash
sudo usermod -aG dialout aa
```

表示：

把用户 aa 添加到 dialout 组。

------------------------------------------------------------------------

# 4. 为什么是 -aG，而不是 -G？

如果使用：

``` bash
sudo usermod -G dialout aa
```

表示：

将用户 aa 的附加组设置为 dialout。

原来的组可能会被删除。

例如：

修改前：

``` text
aa sudo video plugdev
```

执行：

``` bash
usermod -G dialout aa
```

之后：

``` text
aa dialout
```

sudo、video 等权限可能丢失。

因此一般使用：

``` bash
-aG
```

表示追加。

------------------------------------------------------------------------

# 5. \$USER 是什么？

Linux 环境变量：

``` bash
echo $USER
```

例如输出：

``` text
aa
```

那么：

``` bash
sudo usermod -aG dialout $USER
```

等价于：

``` bash
sudo usermod -aG dialout aa
```

------------------------------------------------------------------------

# 6. 为什么串口默认不是当前用户名？

这是 Linux 的设备管理设计。

串口设备：

``` text
/dev/ttyUSB0
```

不是普通文件，而是内核创建的设备节点。

设备创建流程：

``` text
USB设备
   |
   v
Linux Kernel
   |
   v
udev
   |
   v
/dev/ttyUSB0
```

这个过程属于系统层面，因此默认：

``` text
owner: root
```

而不是当前登录用户。

------------------------------------------------------------------------

# 7. 为什么使用用户组管理，而不是绑定个人？

假设一台机器人电脑有：

``` text
user1
user2
robot
```

如果串口属于 user1：

-   user2 无法使用
-   robot 服务无法启动

Linux 使用：

``` text
设备
 |
 v
用户组
 |
 v
用户
```

的方式管理权限。

例如：

``` text
/dev/ttyUSB0

root:dialout
```

然后：

``` text
user1 ----\
user2 ----- dialout
robot ----/
```

所有属于 dialout 的用户都能访问。

------------------------------------------------------------------------

# 8. 为什么设备属于 root？

设备是系统资源。

如果普通用户插入设备后自动获得所有权，会存在安全问题。

例如：

-   恶意 USB 设备
-   未授权硬件访问
-   系统服务权限混乱

所以 Linux 默认：

``` text
root 管理设备
```

普通用户通过用户组获得权限。

------------------------------------------------------------------------

# 9. ROS2 和串口权限

机器人系统常见设备：

-   YDLIDAR 激光雷达
-   IMU
-   GPS
-   STM32
-   Arduino

典型流程：

``` text
USB雷达
   |
   v
/dev/ttyUSB0
   |
   v
udev规则
   |
   v
/dev/ydlidar
   |
   v
ROS2节点
```

用户需要：

``` bash
sudo usermod -aG dialout $USER
```

然后重新登录。

检查：

``` bash
groups
```

应该包含：

``` text
dialout
```

------------------------------------------------------------------------

# 10. udev 固定串口名称

串口编号可能变化：

``` text
ttyUSB0
ttyUSB1
ttyUSB2
```

推荐使用 udev。

例如创建：

``` bash
sudo nano /etc/udev/rules.d/ydlidar.rules
```

写：

``` text
KERNEL=="ttyUSB*", MODE="0666", SYMLINK+="ydlidar"
```

重新加载：

``` bash
sudo udevadm control --reload-rules
sudo udevadm trigger
```

以后：

``` text
/dev/ydlidar
```

始终指向对应设备。

------------------------------------------------------------------------

# 11. 常见设备用户组

  用户组    用途
  --------- ----------
  dialout   串口设备
  video     摄像头
  plugdev   USB设备
  gpio      GPIO
  i2c       I2C设备
  spi       SPI设备

------------------------------------------------------------------------

# 12. 总结

Linux 不把串口绑定到用户名，是因为：

> 串口属于系统设备资源，不属于某个个人用户。

Linux 使用：

``` text
设备 -> 用户组 -> 用户
```

管理权限。

机器人开发推荐：

``` bash
sudo usermod -aG dialout $USER
```

而不是：

``` bash
sudo chmod 777 /dev/ttyUSB0
```

使用：

-   用户组管理权限
-   udev 固定设备名

是 ROS2 机器人系统中最规范的串口管理方式。
