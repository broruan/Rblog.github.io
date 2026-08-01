---
title: "STM32 HAL：UART 与 ADC 的 DMA 学习笔记"
date: 2026-08-01
summary: "本文整理 STM32 HAL 库中 UART/USART DMA 和 ADC DMA 的常见概念、回调函数及使用方法。"
tags:
  - ADC
  - 嵌入式
  - DMA
  - USART
draft: false
---




> 说明：不同 STM32 系列和 HAL 库版本可能略有差异，最终应以当前工程所使用的 HAL 驱动源码和芯片参考手册为准。

## 1. UART/USART 的 DMA 回调函数

在 STM32 HAL 库中，UART 和 USART 通常都使用 `HAL_UART_*` 接口。

### 1.1 DMA 发送完成

```c
void HAL_UART_TxCpltCallback(UART_HandleTypeDef *huart)
{
    if (huart->Instance == USART1) {
        // USART1 的 DMA 发送已完成
    }
}
```

### 1.2 DMA 接收完成

```c
void HAL_UART_RxCpltCallback(UART_HandleTypeDef *huart)
{
    if (huart->Instance == USART1) {
        // USART1 已经收满指定长度的数据
    }
}
```

### 1.3 DMA 半传输完成

```c
void HAL_UART_TxHalfCpltCallback(UART_HandleTypeDef *huart);
void HAL_UART_RxHalfCpltCallback(UART_HandleTypeDef *huart);
```

### 1.4 UART 错误

```c
void HAL_UART_ErrorCallback(UART_HandleTypeDef *huart)
{
    if (huart->Instance == USART1) {
        // 处理溢出、帧错误、噪声错误等
    }
}
```

底层 DMA 中断一般会调用：

```c
void DMAx_Channelx_IRQHandler(void)
{
    HAL_DMA_IRQHandler(huart1.hdmarx);
}
```

`HAL_DMA_IRQHandler()` 处理 DMA 标志位后，再间接调用相应的 UART 回调函数。

## 2. USART 使用 DMA 是否需要开启 DMA

需要在 CubeMX 中为 USART 配置 DMA 请求：

1. 在 USART 的 `DMA Settings` 中添加 `USARTx_RX` 或 `USARTx_TX`。
2. 根据需求选择 `Normal` 或 `Circular` 模式。
3. 启用对应 DMA 通道的 NVIC 中断，否则 DMA 完成回调不会执行。
4. 使用空闲线接收时，还应启用 USART 全局中断。

通常不需要自己直接设置 USART 的 DMA 请求使能位。调用下面的 HAL 函数时，HAL 会完成相关设置：

```c
HAL_UART_Receive_DMA(&huart1, rx_buffer, rx_length);
HAL_UART_Transmit_DMA(&huart1, tx_buffer, tx_length);
```

### Normal 与 Circular 模式

- `Normal`：传输指定数量的数据后停止。下一次接收通常需要重新调用启动函数。
- `Circular`：缓冲区写满后从头继续，适合连续数据流。应用程序必须及时处理数据，避免旧数据被覆盖。

## 3. 普通 DMA 接收与 Receive-to-Idle 接收

### 3.1 固定长度接收

```c
uint8_t rx_buffer[100];

HAL_UART_Receive_DMA(&huart1, rx_buffer, sizeof(rx_buffer));
```

它对应的完成回调为：

```c
void HAL_UART_RxCpltCallback(UART_HandleTypeDef *huart);
```

只有收满 100 字节，才会触发接收完成回调。假如只收到 20 字节，回调不会因为线路暂时没有数据而执行。

这种方式适合长度固定的协议。

### 3.2 DMA 加串口空闲线接收

`HAL_UARTEx_ReceiveToIdle_DMA()` 是启动函数，不是回调函数：

```c
uint8_t rx_buffer[100];

HAL_UARTEx_ReceiveToIdle_DMA(
    &huart1,
    rx_buffer,
    sizeof(rx_buffer)
);
```

对应的事件回调为：

```c
void HAL_UARTEx_RxEventCallback(UART_HandleTypeDef *huart,
                                uint16_t Size)
{
    if (huart->Instance == USART1) {
        // Size 表示 DMA 缓冲区中的当前接收位置/有效长度
        // 根据接收模式处理 rx_buffer 中的数据
    }
}
```

该回调可能由以下事件触发：

- 串口空闲线事件 `IDLE`；
- DMA 半传输事件 `HT`；
- DMA 传输完成事件 `TC`。

可以在支持该接口的 HAL 版本中判断事件类型：

```c
HAL_UART_RxEventTypeTypeDef event_type;

event_type = HAL_UARTEx_GetRxEventType(huart);

if (event_type == HAL_UART_RXEVENT_IDLE) {
    // 串口空闲
} else if (event_type == HAL_UART_RXEVENT_HT) {
    // DMA 半传输
} else if (event_type == HAL_UART_RXEVENT_TC) {
    // DMA 传输完成
}
```

如果不需要 DMA 半传输回调，可以在启动后关闭半传输中断：

```c
HAL_UARTEx_ReceiveToIdle_DMA(&huart1,
                             rx_buffer,
                             sizeof(rx_buffer));

__HAL_DMA_DISABLE_IT(huart1.hdmarx, DMA_IT_HT);
```

### 3.3 两种接收方式的核心区别

| 启动函数 | 回调函数 | 典型触发条件 | 适用场景 |
| --- | --- | --- | --- |
| `HAL_UART_Receive_DMA()` | `HAL_UART_RxCpltCallback()` | 收满指定长度 | 固定长度数据帧 |
| `HAL_UARTEx_ReceiveToIdle_DMA()` | `HAL_UARTEx_RxEventCallback()` | IDLE、HT 或 TC | 不定长数据帧、连续数据流 |

在 `Normal` 模式下，接收事件结束后通常需要重新启动接收：

```c
void HAL_UARTEx_RxEventCallback(UART_HandleTypeDef *huart,
                                uint16_t Size)
{
    if (huart->Instance == USART1) {
        // 先处理或复制 Size 字节数据

        HAL_UARTEx_ReceiveToIdle_DMA(
            huart,
            rx_buffer,
            sizeof(rx_buffer)
        );

        __HAL_DMA_DISABLE_IT(huart->hdmarx, DMA_IT_HT);
    }
}
```

> 注意：在 `Circular` 模式中，`Size` 更接近 DMA 当前写入位置，未必等于“本次新增字节数”。需要记录上一次位置，并处理两次位置之间的数据以及缓冲区回绕。

## 4. `HAL_ADC_Start_DMA()` 的 Length 参数

函数调用示例：

```c
HAL_ADC_Start_DMA(&hadc1, (uint32_t *)adc_rx_msg, 10);
```

最后的 `10` 不是 10 字节，而是 DMA 要传输的 **10 个 ADC 转换结果（10 个数据单元）**。

缓冲区实际占用的字节数取决于缓冲区元素类型和 DMA 内存数据宽度。

例如，12 位 ADC 通常可以用 `uint16_t` 保存：

```c
#define ADC_BUF_LEN 10

uint16_t adc_rx_msg[ADC_BUF_LEN];

HAL_ADC_Start_DMA(
    &hadc1,
    (uint32_t *)adc_rx_msg,
    ADC_BUF_LEN
);
```

此时缓冲区大小为：

```text
10 个结果 × 2 字节 = 20 字节
```

CubeMX 中常见的 DMA 数据宽度配置为：

```text
Peripheral Data Width: Half Word
Memory Data Width:     Half Word
```

缓冲区元素类型必须能够容纳 ADC 转换结果，并与 DMA 内存数据宽度相匹配。不能只根据 `HAL_ADC_Start_DMA()` 形参是 `uint32_t *`，就认为每个结果一定占 4 字节；HAL 为兼容不同 ADC 和 DMA 配置而使用了这个形参类型。

对应的 ADC DMA 回调包括：

```c
void HAL_ADC_ConvHalfCpltCallback(ADC_HandleTypeDef *hadc)
{
    // DMA 已传输一半的数据
}

void HAL_ADC_ConvCpltCallback(ADC_HandleTypeDef *hadc)
{
    // DMA 已传输全部数据
}
```

当长度为 10 时，通常传输 5 个结果后触发半完成回调，传输 10 个结果后触发完成回调。

## 5. 什么是一个 ADC 转换结果

一个转换结果是指：

> ADC 对某一个通道完成一次采样和模数转换后，写入 ADC 数据寄存器的一个数值。

整个过程可以简化为：

```text
选择一个 ADC 通道
        ↓
采样该通道的模拟电压
        ↓
转换为数字值
        ↓
写入 ADC 数据寄存器
        ↓
产生一次 DMA 请求，DMA 搬运一个结果
```

对于 12 位 ADC，转换值通常处于：

```text
0 ～ 4095
```

理想情况下，参考电压为 `VREF` 时，可以粗略换算为：

```text
输入电压 ≈ ADC结果 × VREF / 4095
```

实际测量还会受到参考电压精度、ADC 校准、采样时间和输入阻抗等因素影响。

## 6. 单通道 ADC 示例

只配置一个 ADC 通道，DMA 长度设置为 10：

```c
uint16_t adc_rx_msg[10];

HAL_ADC_Start_DMA(&hadc1,
                  (uint32_t *)adc_rx_msg,
                  10);
```

缓冲区含义为：

```text
adc_rx_msg[0] = 该通道第 1 次转换结果
adc_rx_msg[1] = 该通道第 2 次转换结果
...
adc_rx_msg[9] = 该通道第 10 次转换结果
```

因此，在单通道模式中：

```text
一次通道采样和转换 = 一个转换结果
```

## 7. 多通道扫描 ADC 示例

假设 ADC 扫描顺序为：

```text
Rank 1：ADC_CHANNEL_0
Rank 2：ADC_CHANNEL_1
Rank 3：ADC_CHANNEL_2
```

DMA 缓冲区中的数据通常按 Rank 顺序排列：

```text
adc_rx_msg[0] = 通道 0，第 1 轮
adc_rx_msg[1] = 通道 1，第 1 轮
adc_rx_msg[2] = 通道 2，第 1 轮

adc_rx_msg[3] = 通道 0，第 2 轮
adc_rx_msg[4] = 通道 1，第 2 轮
adc_rx_msg[5] = 通道 2，第 2 轮
```

核心概念是：

```text
一个通道转换一次 = 一个转换结果
所有已配置通道按 Rank 转换一遍 = 一个转换序列（或一轮扫描）
```

如果配置了 3 个通道：

```text
一轮扫描 = 3 个转换结果
```

因此，若要让 3 个通道各采集 10 次，需要容纳 30 个转换结果：

```c
#define ADC_CHANNEL_COUNT 3
#define ADC_SAMPLE_ROUNDS 10
#define ADC_BUF_LEN (ADC_CHANNEL_COUNT * ADC_SAMPLE_ROUNDS)

uint16_t adc_rx_msg[ADC_BUF_LEN];

HAL_ADC_Start_DMA(
    &hadc1,
    (uint32_t *)adc_rx_msg,
    ADC_BUF_LEN
);
```

这里 `ADC_BUF_LEN` 等于 30，表示 DMA 总共搬运 30 个转换结果，而不是 30 字节。

## 8. 常见易错点

### 8.1 把 DMA Length 当作字节数

DMA 的 Length 通常表示传输的数据单元数量。数据单元是 1、2 还是 4 字节，取决于 DMA 的数据宽度设置。

### 8.2 ADC 缓冲区类型与 DMA 宽度不匹配

例如缓冲区使用 `uint16_t` 时，DMA Memory Data Width 通常也应配置为 `Half Word`。错误的数据宽度可能导致数据错位、覆盖或越界。

### 8.3 混淆“一次转换”和“一轮扫描”

多通道模式下，每个通道各转换一次都会产生一个结果。一轮扫描会产生“通道数量”个结果。

### 8.4 使用固定长度 UART DMA 接收不定长数据

`HAL_UART_Receive_DMA()` 必须收满指定长度才会产生完成回调。不定长数据通常更适合 `HAL_UARTEx_ReceiveToIdle_DMA()` 或自行实现空闲线检测。

### 8.5 忘记重新启动 Normal 模式接收

Normal DMA 完成或 Receive-to-Idle 接收结束后，需要根据 HAL 版本及实际模式重新启动下一次接收。

### 8.6 在回调中执行耗时操作

回调一般运行在中断上下文中。不要在其中进行长时间阻塞、复杂解析或大量打印。可以在回调中设置标志、记录长度或复制必要数据，再由主循环或 RTOS 任务处理。

## 9. 快速记忆

```text
UART 普通 DMA：收满指定长度才回调
UART Receive-to-Idle：空闲、半满或全满都可能产生事件回调

ADC DMA Length：转换结果的数量，不是字节数
一个 ADC 通道转换一次：一个转换结果
N 个 ADC 通道扫描一轮：N 个转换结果
```
