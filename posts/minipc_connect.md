---
title: "MiniPC 联网与 MiniLink 连接指南"
date: 2026-10-03
summary: "有线与无线网口的连接"
tags:
  - MiniPC
  - 网络
draft: false
---


# MiniPC 联网与 MiniLink 连接指南

整理日期：2026-10-03。以下网卡名称和地址来自本次排查，换设备或换网络时需要重新确认。

## 1. IP、网关和子网掩码有什么区别？

### IP：设备在网络中的地址

IP 用于标识网络接口，也是其他设备连接它时使用的目标地址。

本次网线直连时：

- 提供共享网络的电脑，有线 IP 是 `10.42.0.1`。
- MiniPC 的有线 IP 是 `10.42.0.2`。
- MiniLink 要连接 MiniPC，就填写 MiniPC 的地址 `10.42.0.2`，端口为 `3389`。

一台电脑有多个网卡时，可以有多个 IP。例如 MiniPC 的有线 IP 和无线 IP 通常不同。拔掉网线后，需要用可达的无线 IP 连接。

### 网关：通往其他网络的下一站

当目标不在本地网段内，设备通常把数据交给默认网关，由它继续转发。**网关本身也是一个 IP 地址，但它的作用是指定转发出口。**

在本次共享上网场景中：

```text
MiniPC（10.42.0.2）
    → 网线
    → 共享电脑（10.42.0.1，MiniPC 的默认网关）
    → 共享电脑的 Wi-Fi
    → 上游网关
    → 互联网
```

因此，MiniPC 的默认网关应填 `10.42.0.1`，不能填自己的 `10.42.0.2`。

网关并不总是以 `.1` 结尾，应以实际网络分配的值为准。

### 子网掩码：判断哪些地址属于本地网段

IP 和子网掩码一起决定本地网段。访问本地网段内的地址，通常直接通信；访问其他网段，则按路由表寻找出口。

| 写法 | 子网掩码 | 本次示例 |
|---|---|---|
| `/24` | `255.255.255.0` | `10.42.0.2/24` 属于 `10.42.0.0/24` |
| `/17` | `255.255.128.0` | 本机校园 Wi-Fi 当时为 `10.252.35.52/17` |

`10.252.0.0/17` 覆盖 `10.252.0.0` 至 `10.252.127.255`，所以之前图中的 `10.252.78.38` 与 `10.252.35.52` 属于同一网段。但这不能证明该地址空闲或已分配给 MiniPC，也不能保证校园网允许设备互访。

### DNS：把域名转换成 IP

DNS 用来查询 `www.baidu.com` 等域名对应的 IP。它不是默认网关。

本次共享电脑同时提供网络转发和 DNS 服务，所以 MiniPC 的网关、DNS 都填写了 `10.42.0.1`；其他网络中，两者可以不同。

## 2. 本次确认的网卡名称

| 设备 | 网卡名称 | 用途 |
|---|---|---|
| MiniPC | `enp2s0` | 本次用于网线连接的有线网卡 |
| MiniPC | `wlxc83a35ba1214` | 无线网卡 |
| 本机 | `enp4s0` | 本次提供网线共享的有线网卡 |
| 本机 | `wlp2s0` | 本次连接校园网的无线网卡 |

查看设备自己的网卡和状态：

```bash
nmcli device status
```

`TYPE` 为 `wifi` 的是无线网卡。`p2p-dev-...` 是 Wi-Fi 直连接口，普通 Wi-Fi 联网使用上表中的无线网卡。

## 3. 通过手机热点无线联网

**下面的命令在 MiniPC 终端执行。** 手机热点名称为 `Xiaomi 17T`，热点本身需要能访问互联网。

### 第一步：搜索热点

```bash
nmcli device wifi list ifname wlxc83a35ba1214 --rescan yes
```

`--rescan yes` 强制刷新扫描结果。正常情况下 NetworkManager 也会定期扫描，不需要一直手动执行。

### 第二步：连接热点——无线联网的关键命令

```bash
sudo nmcli --ask device wifi connect "Xiaomi 17T" ifname wlxc83a35ba1214
```

按提示在终端输入热点密码，无需把密码发给别人。

首次创建普通热点连接时，通常通过 DHCP 自动获取 IP、掩码、网关和 DNS，无需手动填写。已有连接配置可能保留此前的手动设置。

### 第三步：查看无线 IP

```bash
ip -4 address show dev wlxc83a35ba1214
```

输出中 `inet` 后面就是无线 IP。例如：

```text
inet 192.168.43.20/24
```

这个地址仅是格式示例，并非本次已确认的 MiniPC 地址。使用 MiniLink 时填写 IP 部分，不带 `/24`。

### 第四步：验证互联网访问

```bash
ip route
ping -c 2 -W 2 223.5.5.5
curl -I --connect-timeout 5 --max-time 10 https://www.baidu.com
```

- `ip route`：查看默认网关及流量走哪个网卡。有线仍连接时，默认路由可能仍走有线。
- `ping` 成功：说明能访问该外网 IP；失败时还需结合 HTTPS 测试判断，因为有些网络限制 ICMP。
- 百度 HTTPS 返回 `200 OK`：说明本次测试的域名解析和网页访问正常。

如果要确认完全依靠无线联网，先确认无线 MiniLink 能连接，再拔掉网线，重新运行以上验证命令。

## 4. 通过手机热点使用 MiniLink

1. 本机和 MiniPC 都连接 `Xiaomi 17T` 热点。
2. 查看 MiniPC 无线网卡获得的 IP。
3. 本机 MiniLink 的目标地址填写该无线 IP，端口为 `3389`。
4. 无线连接成功后，再拔掉网线。

手机热点需要允许连接设备之间互访。MiniLink 能连接，只能证明远程桌面通信可用；要判断是否能上互联网，仍需执行上一节的联网验证。

## 5. 启用热点自动连接

成功连接并保存热点配置后，在 MiniPC 执行：

```bash
sudo nmcli connection modify "Xiaomi 17T" connection.autoconnect yes
sudo nmcli device set wlxc83a35ba1214 autoconnect yes
```

查看保存的连接及自动连接设置：

```bash
nmcli -f NAME,TYPE,AUTOCONNECT connection show
```

如果提示找不到 `Xiaomi 17T` 配置，先用上面的查看命令确认实际连接名称，再替换命令中的名称。

自动扫描、自动连接是不同的功能。热点未被扫描到时，启用自动连接不能直接修复扫描问题；无线网卡已经连接校园网时，自动连接也不会立即把它切换到手机热点。

## 6. 通过网线共享上网：本次实际修复

### 前提

- 本机自身已经联网。
- 本机有线网卡设置为“与其他计算机共享”，本次地址为 `10.42.0.1/24`。
- 网线直接连接本机和 MiniPC。

在本机查看共享配置，本次连接名称为 `配置 1`：

```bash
nmcli -f ipv4.method connection show "配置 1"
```

本次结果为 `shared`。单独给本机网口设置一个静态 IP，并不等于开启了网络共享。

### 当时的错误

MiniPC 原先的路由是：

```text
default via 10.42.0.2 dev enp2s0
10.0.0.0/8 dev enp2s0 ... src 10.42.0.2
```

默认网关错误地指向 MiniPC 自己，掩码也设成了 `/8`。因此本地 MiniLink 能连接，但访问互联网失败。

### 修复命令——在 MiniPC 执行

```bash
sudo nmcli connection modify "Wired connection 1" \
  ipv4.method manual \
  ipv4.addresses "10.42.0.2/24" \
  ipv4.gateway "10.42.0.1" \
  ipv4.dns "10.42.0.1" \
  ipv4.never-default no

sudo nmcli device reapply enp2s0
```

第一条保存正确配置，第二条尝试在线应用到当前网卡。若命令报错，需要根据报错继续处理。

### 修复后的结果

用户提供的验证输出确认了：

```text
default via 10.42.0.1 dev enp2s0
10.42.0.0/24 dev enp2s0 ... src 10.42.0.2
```

随后外网 `ping` 两次均成功，百度 HTTPS 返回 `200 OK`，证明当时网线共享上网已恢复。这组静态地址仅适用于本次共享网络，不能直接用于手机热点或其他 Wi-Fi。

## 7. 热点搜不到时的排查命令

先把手机放到 MiniPC 附近，保持热点开启，再强制扫描。若仍不可见，在 MiniPC 获取底层扫描结果和驱动信息：

```bash
sudo iw dev wlxc83a35ba1214 scan | grep -E 'BSS |freq:|signal:|SSID:'
nmcli -f GENERAL.STATE,GENERAL.CONNECTION,GENERAL.DRIVER device show wlxc83a35ba1214
lsusb
```

查看无线区域和部分 2.4 GHz 信道状态：

```bash
iw reg get
iw list | grep -E '2412 MHz|2462 MHz|2467 MHz|2472 MHz'
```

本次本机实际扫描到 `Xiaomi 17T` 使用 2.4 GHz、13 信道（2472 MHz）、WPA2。MiniPC 后来能找到热点，但目前没有足够证据确认是哪一步使其恢复，因此不能将原因定为 13 信道限制。

`disabled` 表示信道禁用；`no IR` 表示限制主动发射，不等于完全收不到热点。

此前建议的 `sudo iw reg set CN` 只是设备实际位于中国大陆时的临时区域设置测试，不是日常联网的必要命令，也未证实它解决了本次扫描问题。

本次已验证的是网线共享上网恢复、无线热点重新可见；尚未收到无线连接成功和重启后自动连接的验证输出。

## 8. 官方参考

- [NetworkManager：nmcli 命令、Wi-Fi 扫描与连接](https://networkmanager.pages.freedesktop.org/NetworkManager/NetworkManager/nmcli.html)
- [NetworkManager：自动连接规则](https://networkmanager.dev/docs/api/latest/settings-connection.html)
- [NetworkManager：IPv4 配置与共享机制](https://networkmanager.pages.freedesktop.org/NetworkManager/NetworkManager/nm-settings-nmcli.html)
- [Linux Wireless：iw 命令](https://wireless.docs.kernel.org/en/latest/en/users/documentation/iw.html)
- [Linux Wireless：无线区域限制与 no IR](https://wireless.docs.kernel.org/en/latest/en/developers/regulatory/processing_rules.html)

