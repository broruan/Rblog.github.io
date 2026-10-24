---
title: "关于高斯-牛顿法和LM非线性求解"
date: 2026-10-24
summary: "高斯牛顿与LM的推导与求解"
tags:
  - LM优化求解
  - 算法
draft: false
---



### 1. 高斯-牛顿法的推导

我们需要使
$$
    r_i(x)=||p_i - Tq_i||
$$
最小，其中$p_i$是目标点云，$q_i$是原始点云。
根据泰勒一阶线性展开得：
$$
    r_i(x+\Delta x) = r_i(x) + J\Delta x
$$
J为雅可比矩阵，不多做介绍。

这里要求残差平方和的最小值：
$$
    E(\Delta x)=r_i(x+\Delta x)r_i^\mathsf{T}(x+\Delta x)
$$

展开：
$$
\begin{aligned}
E(\Delta\boldsymbol{x})
\approx \frac12\big[&
\boldsymbol{r}^T\boldsymbol{r}\\
&+\boldsymbol{r}^TJ\Delta\boldsymbol{x}\\
&+\Delta\boldsymbol{x}^TJ^T\boldsymbol{r}\\
&+\Delta\boldsymbol{x}^TJ^TJ\Delta\boldsymbol{x}
\big]
\end{aligned}
$$

因为$\boldsymbol{r}^TJ\Delta\boldsymbol{x}$是一个标量，所以他的转置就等于他本身。
所以：
$$
E(\Delta\boldsymbol{x})
\approx
\frac12\boldsymbol{r}^T\boldsymbol{r}
+\Delta\boldsymbol{x}^TJ^T\boldsymbol{r}
+\frac12\Delta\boldsymbol{x}^TJ^TJ\Delta\boldsymbol{x}
$$
对他求导，令他的求导值为0：
$$
J^T\boldsymbol{r}
+J^TJ\Delta\boldsymbol{x}=0
$$

就推出了牛顿高斯公式：
$$
(J^TJ)\Delta\boldsymbol{x}
=-J^T\boldsymbol{r}
$$

### 2. LM求解
求解方程为：
$$
(J^TJ+\lambda I)\Delta\boldsymbol{x}
=-J^T\boldsymbol{r}
$$
更新阻尼$\lambda$,使残差小于上一次的$E(x)$。
$\lambda$的更新方向取决于这次的残差和上一次的残差的大小比较。
具体增大或者减小多少由一个函数决定。