---
title: "学习ros2的diagnostic_msgs诊断组件"
date: 2026-10-20
summary: "diagnostic_msgs"
tags:
  - Ros2
  - diagnostic_msgs
draft: false
---


---
### diagnostic_msgs的组成

* 1. diagnostic_msgs/msg/DiagnosticArray
* 2. diagnostic_msgs/msg/DiagnosticStatus
* 3. diagnostic_msgs/msg/KeyValue

其中第一个接口是最终发布的消息，第二个是消息里面的状态信息，第三个是消息里面的键值对，也就是消息内容。

这是**Array**：
``` msg
# This message is used to send diagnostic information about the state of the robot.
std_msgs/Header header # for timestamp
	builtin_interfaces/Time stamp
		int32 sec
		uint32 nanosec
	string frame_id
DiagnosticStatus[] status # an array of components being reported on
	byte OK=0
	byte WARN=1
	byte ERROR=2
	byte STALE=3
	byte level
	string name
	string message
	string hardware_id
	KeyValue[] values
		string key
		string value


```

这是**Status**：
``` msg
# This message holds the status of an individual component of the robot.

# Possible levels of operations.
byte OK=0
byte WARN=1
byte ERROR=2
byte STALE=3

# Level of operation enumerated above.
byte level
# A description of the test/component reporting.
string name
# A description of the status.
string message
# A hardware unique string.
string hardware_id
# An array of values associated with the status.
KeyValue[] values
	string key
	string value


```

这是**KeyValue**：
``` msg
# What to label this value when viewing.
string key
# A value to track over time.
string value

```

