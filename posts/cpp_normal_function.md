---
title: "写一个cpp常用函数库的速查表（持续更新）"
date: 2026-10-28
summary: "cpp常用算法库"
tags:
  - cpp
  - Eigen
  - 算法
draft: false
---


### 1.Eigen库

# Eigen 常用类与函数速查表

本文整理 Eigen 中常用的矩阵类、向量类、数学函数、矩阵分解算法和三维几何变换类，重点说明每个接口的输入、输出与作用。

---

## 一、特征值分解类：`SelfAdjointEigenSolver`

头文件：

```cpp
#include <Eigen/Eigenvalues>
```

适用于实对称矩阵：

\[
A=A^T
\]

矩阵可以分解为：

\[
A=Q\Lambda Q^T
\]

其中，\(Q\) 的每一列是一个单位特征向量，\(\Lambda\) 是特征值构成的对角矩阵。

| 类或函数 | 输入 | 输出 | 作用 |
|---|---|---|---|
| `SelfAdjointEigenSolver(A)` | 对称矩阵 `A` | 求解器对象 | 创建对象并执行特征值分解 |
| `compute(A)` | 对称矩阵 `A` | 求解器对象的引用 | 执行或重新执行分解 |
| `eigenvalues()` | 无额外参数 | 特征值向量 | 获取按从小到大排列的特征值 |
| `eigenvectors()` | 无额外参数 | 特征向量矩阵 | 每一列对应一个特征值的特征向量 |
| `info()` | 无额外参数 | `ComputationInfo` | 检查分解是否成功 |
| `computeDirect(A)` | 固定尺寸的 2×2 或 3×3 对称矩阵 | 求解器对象的引用 | 使用直接方法求解特征值分解 |
| `operatorSqrt()` | 已完成分解的正定矩阵 | 矩阵表达式 | 计算矩阵平方根 |
| `operatorInverseSqrt()` | 已完成分解的正定矩阵 | 矩阵表达式 | 计算矩阵逆平方根 |

### 1.1 代码示例

```cpp
#include <iostream>
#include <Eigen/Dense>
#include <Eigen/Eigenvalues>

int main()
{
    Eigen::MatrixXd A(2, 2);
    A << 2.0, 1.0,
         1.0, 2.0;

    Eigen::SelfAdjointEigenSolver<Eigen::MatrixXd> solver(A);

    if (solver.info() != Eigen::Success) {
        std::cerr << "分解失败\n";
        return 1;
    }

    Eigen::VectorXd lambda = solver.eigenvalues();
    Eigen::MatrixXd V = solver.eigenvectors();

    std::cout << "特征值：\n" << lambda << "\n\n";
    std::cout << "特征向量矩阵：\n" << V << '\n';

    return 0;
}
```

### 1.2 重要注意事项

- `eigenvalues()` 返回按从小到大排列的特征值。
- `eigenvectors()` 的每一列对应一个特征值的特征向量。
- 使用结果前应检查 `solver.info()`。
- 输入应当是实对称矩阵；该类通常只读取输入矩阵的一个三角部分，因此不要依赖它自动检查矩阵是否对称。
- `computeDirect()` 适用于固定尺寸的 2×2 或 3×3 矩阵。
- `operatorSqrt()` 和 `operatorInverseSqrt()` 要求矩阵满足相应的正定条件。

---

## 二、矩阵与向量类

| 类 | 输入 | 输出 | 作用 |
|---|---|---|---|
| `MatrixXd` | 行数、列数或矩阵数据 | 动态尺寸双精度矩阵 | 表示动态大小的矩阵 |
| `MatrixXf` | 行数、列数或矩阵数据 | 动态尺寸单精度矩阵 | 表示动态大小的 `float` 矩阵 |
| `Matrix3d` | 9 个元素或矩阵表达式 | 固定 3×3 矩阵 | 旋转矩阵、协方差矩阵 |
| `Matrix4d` | 16 个元素或矩阵表达式 | 固定 4×4 矩阵 | 齐次变换矩阵 |
| `VectorXd` | 向量长度或数据 | 动态长度列向量 | 状态增量、特征值 |
| `Vector3d` | 3 个元素 | 三维列向量 | 位置、平移向量 |
| `Vector4d` | 4 个元素 | 四维列向量 | 四维坐标等 |
| `RowVectorXd` | 向量长度或数据 | 动态长度行向量 | 行向量运算 |
| `ArrayXXd` | 行数、列数或数据 | 动态尺寸数组 | 逐元素运算 |

### 2.1 类型名称的含义

以 `Matrix3d` 为例：

- `Matrix`：矩阵。
- `3`：固定为 3 行、3 列。
- `d`：`double` 类型。

`MatrixXd` 中的 `X` 表示维度在运行时确定。

### 2.2 代码示例

```cpp
Eigen::MatrixXd H(6, 6);
Eigen::VectorXd delta_x(6);

Eigen::Matrix3d R;
Eigen::Matrix4d T;

Eigen::Vector3d p(1.0, 2.0, 3.0);
```

在 LM 优化中，`H` 可以表示 6×6 海森矩阵，`delta_x` 可以表示六维状态增量。

---

## 三、矩阵初始化函数

| 函数 | 输入 | 输出 | 作用 |
|---|---|---|---|
| `Zero()` | 动态矩阵的行数、列数等 | 全零矩阵 | 创建全零矩阵 |
| `Identity()` | 动态矩阵的行数、列数等 | 单位矩阵 | 创建主对角线为 1 的矩阵 |
| `Ones()` | 矩阵尺寸 | 全 1 矩阵 | 创建所有元素为 1 的矩阵 |
| `Constant(n,m,v)` | 行数、列数、常数值 | 常数矩阵 | 所有元素设为 `v` |
| `Random()` | 矩阵尺寸 | 随机矩阵 | 生成随机元素 |
| `setZero()` | 无额外参数 | `void` | 将已有矩阵清零 |
| `setIdentity()` | 无额外参数 | `void` | 将已有矩阵设置为单位矩阵 |

### 3.1 代码示例

```cpp
Eigen::Matrix3d R = Eigen::Matrix3d::Identity();

Eigen::MatrixXd H = Eigen::MatrixXd::Zero(6, 6);

H.setIdentity();
```

注意：

- `Zero()` 和 `Identity()` 返回矩阵对象。
- `setZero()` 和 `setIdentity()` 修改已有对象。
- `Identity()` 对非方阵也可以使用，但只能在可用的主对角线上设置 1。

---

## 四、矩阵访问、切片与转置

| 函数 | 输入 | 输出 | 作用 |
|---|---|---|---|
| `row(i)` | 行索引 `i` | 行表达式 | 获取第 `i` 行 |
| `col(i)` | 列索引 `i` | 列表达式 | 获取第 `i` 列 |
| `block(i,j,p,q)` | 起始行、起始列、行数、列数 | 子矩阵表达式 | 获取指定区域 |
| `head(n)` | 元素个数 `n` | 向量片段 | 获取前 `n` 个元素 |
| `tail(n)` | 元素个数 `n` | 向量片段 | 获取最后 `n` 个元素 |
| `segment(i,n)` | 起始索引、元素个数 | 向量片段 | 获取连续的一段元素 |
| `transpose()` | 无额外参数 | 转置表达式 | 将行列互换 |
| `diagonal()` | 无额外参数 | 对角线表达式 | 获取主对角线 |
| `asDiagonal()` | 向量 | 对角矩阵表达式 | 将向量转换为对角矩阵 |

### 4.1 代码示例

```cpp
Eigen::MatrixXd A(4, 4);

auto first_row = A.row(0);
auto second_col = A.col(1);
auto sub_matrix = A.block(0, 0, 2, 2);

Eigen::VectorXd x(6);

auto first_three = x.head(3);
auto last_three = x.tail(3);
auto middle_three = x.segment(1, 3);
```

注意：`row()`、`col()` 和 `block()` 通常返回表达式或引用式视图，不一定创建独立副本。如果需要独立矩阵，可以显式赋值：

```cpp
Eigen::MatrixXd B = A.block(0, 0, 2, 2);
```

---

## 五、向量数学函数

| 函数 | 输入 | 输出 | 作用 |
|---|---|---|---|
| `norm()` | 向量 | 标量 | 计算欧几里得范数 |
| `squaredNorm()` | 向量 | 标量 | 计算范数的平方 |
| `normalized()` | 向量 | 新向量 | 返回单位化后的向量 |
| `normalize()` | 向量对象 | `void` | 直接修改原向量，使其单位化 |
| `dot(b)` | 向量 `b` | 标量 | 计算内积 |
| `cross(b)` | 三维向量 `b` | 三维向量 | 计算叉积 |

### 5.1 相关数学公式

向量的欧几里得范数：

\[
\|a\|=\sqrt{a^Ta}
\]

向量内积：

\[
a\cdot b=a^Tb
\]

单位化：

\[
\hat{a}=\frac{a}{\|a\|}
\]

### 5.2 代码示例

```cpp
Eigen::Vector3d a(1.0, 2.0, 3.0);
Eigen::Vector3d b(4.0, 5.0, 6.0);

double length = a.norm();
double length2 = a.squaredNorm();
double inner = a.dot(b);

Eigen::Vector3d unit_a = a.normalized();
Eigen::Vector3d cross_ab = a.cross(b);
```

注意：零向量不能直接正常单位化，应在单位化前判断其范数是否足够大。

---

## 六、逐元素运算函数

| 函数 | 输入 | 输出 | 作用 |
|---|---|---|---|
| `cwiseAbs()` | 矩阵或向量 | 同尺寸表达式 | 每个元素取绝对值 |
| `cwiseProduct(B)` | 同尺寸矩阵或向量 `B` | 同尺寸表达式 | 对应位置元素相乘 |
| `cwiseQuotient(B)` | 同尺寸矩阵或向量 `B` | 同尺寸表达式 | 对应位置元素相除 |
| `maxCoeff()` | 矩阵或向量 | 标量 | 获取最大元素 |
| `minCoeff()` | 矩阵或向量 | 标量 | 获取最小元素 |
| `sum()` | 矩阵或向量 | 标量 | 所有元素求和 |
| `mean()` | 矩阵或向量 | 标量 | 所有元素求平均 |
| `allFinite()` | 矩阵或向量 | `bool` | 检查所有元素是否有限 |
| `isApprox(B)` | 同尺寸矩阵或向量 `B` | `bool` | 判断两个对象是否近似相等 |

### 6.1 代码示例

```cpp
Eigen::Vector3d x(-2.0, 0.5, 3.0);

double max_abs = x.cwiseAbs().maxCoeff(); // 3.0
double max_value = x.maxCoeff();          // 3.0
double min_value = x.minCoeff();          // -2.0
double total = x.sum();                   // 1.5

bool valid = x.allFinite();
```

### 6.2 `maxCoeff()` 与 `cwiseAbs().maxCoeff()` 的区别

```cpp
x.maxCoeff();
```

获取原始元素中的最大值。

```cpp
x.cwiseAbs().maxCoeff();
```

获取所有元素绝对值中的最大值。

例如：

\[
x=
\begin{bmatrix}
-8\\
2\\
3
\end{bmatrix}
\]

则：

\[
\max_i x_i=3
\]

而：

\[
\max_i|x_i|=8
\]

### 6.3 `*` 与 `cwiseProduct()` 的区别

```cpp
A * B
```

表示矩阵乘法。

```cpp
A.cwiseProduct(B)
```

表示逐元素乘法。

例如：

\[
\begin{bmatrix}
1&2\\
3&4
\end{bmatrix}
\odot
\begin{bmatrix}
5&6\\
7&8
\end{bmatrix}
=
\begin{bmatrix}
5&12\\
21&32
\end{bmatrix}
\]

其中，\(\odot\) 表示逐元素乘法。

---

## 七、矩阵代数函数

| 函数 | 输入 | 输出 | 作用 |
|---|---|---|---|
| `transpose()` | 矩阵 `A` | 矩阵表达式 | 计算转置 \(A^T\) |
| `adjoint()` | 矩阵 `A` | 矩阵表达式 | 计算共轭转置 \(A^H\) |
| `inverse()` | 可逆方阵 `A` | 方阵 | 计算逆矩阵 \(A^{-1}\) |
| `determinant()` | 方阵 `A` | 标量 | 计算行列式 |
| `trace()` | 方阵 `A` | 标量 | 计算主对角线元素之和 |
| `diagonal()` | 矩阵 `A` | 向量表达式 | 获取主对角线 |
| `isApprox(B)` | 矩阵 `B` | `bool` | 近似比较矩阵 |

### 7.1 代码示例

```cpp
Eigen::Matrix3d A = Eigen::Matrix3d::Identity();

Eigen::Matrix3d AT = A.transpose();

double det = A.determinant();
double tr = A.trace();
```

对于实数矩阵，`adjoint()` 与 `transpose()` 的结果相同；对于复数矩阵，`adjoint()` 还会对元素取共轭。

**注意：** 求解线性方程时，通常不推荐显式计算逆矩阵。

对于：

\[
Ax=b
\]

更推荐使用适合矩阵性质的分解求解器。

---

## 八、矩阵分解与线性方程求解类

| 类 | 输入 | 输出 | 作用 |
|---|---|---|---|
| `SelfAdjointEigenSolver` | 实对称矩阵 | 特征值、特征向量 | 分析特征方向和曲率 |
| `EigenSolver` | 一般实方阵 | 特征值、特征向量 | 一般矩阵特征值分解，特征值可能为复数 |
| `JacobiSVD` | 一般矩阵 | 奇异值及左右奇异向量 | 奇异值分解、秩分析、最小二乘 |
| `LLT` | 对称正定矩阵 | Cholesky 分解 | 求解正定线性系统 |
| `LDLT` | 对称矩阵 | \(LDL^T\) 分解 | 求解适合该分解的对称线性系统 |
| `PartialPivLU` | 方阵 | LU 分解 | 求解一般可逆方阵的线性系统 |
| `ColPivHouseholderQR` | 一般矩阵 | QR 分解 | 最小二乘、秩相关问题 |

### 8.1 常用接口

| 接口 | 输入 | 输出 | 作用 |
|---|---|---|---|
| `compute(A)` | 矩阵 `A` | 求解器对象的引用 | 执行分解 |
| `solve(b)` | 右侧向量或矩阵 `b` | 解向量或矩阵 `x` | 求解 \(Ax=b\) |
| `singularValues()` | 无额外参数 | 奇异值向量 | 获取 SVD 奇异值 |
| `matrixU()` | 无额外参数 | 矩阵表达式 | 获取左奇异向量矩阵 |
| `matrixV()` | 无额外参数 | 矩阵表达式 | 获取右奇异向量矩阵 |
| `eigenvalues()` | 无额外参数 | 特征值向量 | 获取特征值 |
| `eigenvectors()` | 无额外参数 | 特征向量矩阵 | 获取特征向量 |

### 8.2 LM 优化中的 `LDLT`

LM 的阻尼线性方程：

\[
(H+\lambda I)\Delta x=-g
\]

其中：

- \(H\)：海森矩阵或近似海森矩阵。
- \(\lambda\)：阻尼参数。
- \(I\)：单位矩阵。
- \(g\)：梯度。
- \(\Delta x\)：状态增量。

对应代码：

```cpp
Eigen::MatrixXd H_damped =
    H + lambda *
    Eigen::MatrixXd::Identity(H.rows(), H.cols());

Eigen::VectorXd delta_x =
    H_damped.ldlt().solve(-g);
```

这里使用 `LDLT` 分解求解线性方程，而不是显式计算逆矩阵。

注意：仍然需要检查矩阵的数值性质、分解状态和求解结果。

### 8.3 SVD 示例

```cpp
#include <Eigen/Dense>
#include <Eigen/SVD>

Eigen::JacobiSVD<Eigen::MatrixXd> svd(
    A,
    Eigen::ComputeFullU | Eigen::ComputeFullV
);

Eigen::VectorXd singular_values = svd.singularValues();

Eigen::MatrixXd U = svd.matrixU();
Eigen::MatrixXd V = svd.matrixV();
```

奇异值分解：

\[
A=U\Sigma V^T
\]

---

## 九、三维几何变换类

| 类 | 输入 | 输出 | 作用 |
|---|---|---|---|
| `Vector3d` | 三个数 | 三维向量 | 表示位置或平移 |
| `Matrix3d` | 九个数或矩阵表达式 | 3×3 矩阵 | 表示旋转矩阵等 |
| `Quaterniond` | 四元数分量或旋转表示 | 四元数对象 | 表示三维旋转 |
| `AngleAxisd` | 旋转角度、旋转轴 | 角轴对象 | 表示绕指定轴的旋转 |
| `Isometry3d` | 旋转和平移 | 三维刚体变换 | 组合旋转与平移 |
| `Affine3d` | 线性变换和平移 | 三维仿射变换 | 表示更一般的仿射变换 |

头文件：

```cpp
#include <Eigen/Geometry>
```

### 9.1 常用成员函数

| 函数 | 输入 | 输出 | 作用 |
|---|---|---|---|
| `toRotationMatrix()` | 旋转对象 | 3×3 旋转矩阵 | 将四元数或角轴转换为旋转矩阵 |
| `translation()` | 变换对象 | 平移部分的可访问表达式 | 读取或修改平移 |
| `linear()` | 变换对象 | 线性部分的可访问表达式 | 读取或修改线性变换部分 |
| `matrix()` | 变换对象 | 齐次矩阵表达式 | 获取完整变换矩阵 |
| `setIdentity()` | 无额外参数 | `void` | 设置单位变换 |

### 9.2 代码示例

```cpp
#include <Eigen/Geometry>
#include <cmath>

Eigen::Isometry3d T = Eigen::Isometry3d::Identity();

T.linear() =
    Eigen::AngleAxisd(
        M_PI / 2.0,
        Eigen::Vector3d::UnitZ()
    ).toRotationMatrix();

T.translation() = Eigen::Vector3d(1.0, 2.0, 3.0);

Eigen::Matrix4d T_matrix = T.matrix();
```

齐次变换矩阵形式：

\[
T=
\begin{bmatrix}
R&t\\
0&1
\end{bmatrix}
\]

其中：

- \(R\)：3×3 旋转矩阵。
- \(t\)：3×1 平移向量。

在 ROS2 TF 中，矩阵相乘可以组合多个坐标变换，但必须保证变换的坐标系方向和乘法顺序一致。

---

## 十、头文件速查表

| 头文件 | 主要内容 |
|---|---|
| `<Eigen/Core>` | 基础矩阵、向量和表达式 |
| `<Eigen/Dense>` | 常用稠密矩阵及多种线性代数模块 |
| `<Eigen/Eigenvalues>` | 特征值与特征向量分解 |
| `<Eigen/SVD>` | 奇异值分解 |
| `<Eigen/Cholesky>` | `LLT`、`LDLT` |
| `<Eigen/LU>` | LU 分解 |
| `<Eigen/QR>` | QR 分解 |
| `<Eigen/Geometry>` | 四元数、角轴、刚体变换 |
| `<limits>` | `std::numeric_limits` |

### 推荐的常用头文件组合

```cpp
#include <iostream>
#include <limits>

#include <Eigen/Dense>
#include <Eigen/Geometry>
```

如果只需要特定功能，也可以使用更精简的头文件。

---


## 十一、官方参考文档

- [Eigen 快速参考手册](https://eigen.tuxfamily.org/dox/group__QuickRefPage.html)
- [Eigen 矩阵与向量教程](https://eigen.tuxfamily.org/dox/group__TutorialMatrixClass.html)
- [SelfAdjointEigenSolver 类文档](https://libeigen.gitlab.io/eigen/docs-3.4/classEigen_1_1SelfAdjointEigenSolver.html)
- [Eigen 几何模块](https://eigen.tuxfamily.org/dox/group__Geometry__Module.html)

