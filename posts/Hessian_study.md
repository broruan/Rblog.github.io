---
title: "海森矩阵的特征值求解"
date: 2026-10-24
summary: "通过特征值投影更新状态"
tags:
  - Nav2
  - Hessian
  - 算法
draft: false
---


> 导航主要优化的问题就是位姿状态的的残差，我们的目标就是使这个值越小越好。也就是要更新$\Delta x$.

### 1. 残差公式
$$
r(x_0+\Delta x)\approx r(x_0)+J\Delta x,
\qquad
J=\left.\frac{\partial r}{\partial x}\right|_{x_0}
$$

求状态变量就变成最小二乘问题：
$$
\min_{\Delta x}\|A\Delta x-b\|^2\tag{1}
$$

$$
A=W^{1/2}J,\qquad b=-W^{1/2}r(x_0)
$$

其中A是带权重的雅可比矩阵，b为先验残差

可以得出：海森矩阵：
$$
H=A^\mathsf{T}A=J^\mathsf{T}WJ
$$

目标就是解H矩阵的特征值（其实也可以解雅可比矩阵的奇异值）。上面式子(1)的通解就是$(A^\mathsf{T}A)\Delta x = A^\mathsf{T}b$,可以求出$x$的解为：
$$
\Delta x_{raw} = (A^\mathsf{T}A)^\mathsf{-1}A^\mathsf{T}b
$$

> A是列向量就用$A^\mathsf{T}A$, 行向量就用$AA^\mathsf{T}$

> 特征值只有实对称矩阵有，而奇异值可以是任何矩阵。并且他们成平方关系

**Tisp**：为什么要求海森矩阵的特征值呢？？
额，这个后面再说。（其实就是减少一些不必要的更新）

先搞清楚需要求解什么：
$$
\Delta x = x_0 + P\Delta x_{raw}\tag{2}
$$
这里的$\Delta x$就是需要求解的。那我们下面来一一分解。
> 这里的$P$是正交投影矩阵，用于过滤掉特征值较小的特征向量，然后再对状态进行更新。

### 2.特征值的求解

先回顾一下特征值分解：
$$
Hv = λv
$$
特征向量和特征值分别是$v,λ$

这里求解特征值和特征向量过程省略。假设特征值构成的对角矩阵为$\Lambda = diag(\lambda_1+\lambda_2+···+\lambda_n)$,特征向量构成的矩阵为$V$，其中特征向量为其的列向量。

那么$H=V\Lambda V^\mathsf{-1}$.

因为$H$为实对称矩阵(也就是$V$是正交矩阵)，所以$H=V\Lambda V^\mathsf{T}$。

带入(2)中得：
$$
    \Delta x = x_0 + PH^\mathsf{-1}A^\mathsf{T}b\tag{3}
$$

### 3.正交投影矩阵

我们这一部分要求$P$
首先，理解一下基本概念：
我们希望把一个向量投影到另一个向量空间中，就需要构造：
$$
P=C(C^TC)^{-1}C^T
$$

其中C的列向量为我们希望投影到的子空间，如果$C$已经为标准正交向量（模长为1），那么$C^\mathsf{T}C=I$.

所以$P$就可以简化成：
$$
    P=CC^\mathsf{T}\tag{4}
$$

> 这里就可以化为第二种形式，因为我们解出来的特征向量为一组标准正交基

### 4.过滤小特征值对应的特征向量

我们这里对正交投影矩阵$P$进行过滤。
代入上面（3）式，我们得出：
$$
    P=VV^\mathsf{T}
$$
假设我们前面已经对特征值进行了筛选，得出对角矩阵$D=diag(1,1,···，1，0，1)$(其中$\lambda_i$可能经过筛选后变为0)。

上式就变成了：
$$
    P=VDV^\mathsf{T}
$$

### 5. 合并

将上述结果代入式（3）中：
$$
    \Delta x = x_0 + VDV^\mathsf{T}(V\Lambda V^\mathsf{T})^\mathsf{-1}A^\mathsf{T}b
    =VD\Lambda^\mathsf{-1}V^\mathsf{T}A^\mathsf{T}b
$$

### 6. 参考代码

```cpp
// 编译：g++ -std=c++17 -O2 -I/usr/include/eigen3 main.cpp -o demo

#include <Eigen/Dense>
#include <algorithm>
#include <cmath>
#include <iostream>
#include <limits>
#include <stdexcept>

struct ProjectionResult {
    Eigen::VectorXd delta_x;       // 过滤后的状态增量
    Eigen::VectorXd eigenvalues;   // H 的特征值，按升序排列
    Eigen::MatrixXd P;             // 正交投影矩阵
    Eigen::Index kept_directions;  // 保留的方向数量
};

// 求解 min ||A * delta_x - b||²，并过滤小特征值对应的方向。
// A: m×n，b: m×1，H: n×n，delta_x: n×1。
// eigenvalue_threshold 是 H 的特征值阈值，需结合状态尺度、权重调整。
ProjectionResult solveProjectedStep(
    const Eigen::MatrixXd& A,
    const Eigen::VectorXd& b,
    double eigenvalue_threshold = 1e-6)
{
    if (A.rows() == 0 || A.cols() == 0 || A.rows() != b.size()) {
        throw std::invalid_argument("A/b dimensions are invalid");
    }

    if (!A.allFinite() || !b.allFinite() ||
        !std::isfinite(eigenvalue_threshold) || eigenvalue_threshold < 0.0) {
        throw std::invalid_argument("Invalid input or threshold");
    }

    // 1. 构造 Gauss-Newton 近似海森矩阵和正规方程右端。
    // H * delta_x = A^T * b
    const Eigen::MatrixXd H = A.transpose() * A;
    const Eigen::VectorXd rhs = A.transpose() * b;

    if (!H.allFinite() || !rhs.allFinite()) {
        throw std::runtime_error("Overflow while forming normal equations");
    }

    // 2. 对实对称矩阵进行特征值分解。
    // H = V * Lambda * V^T
    // V 的第 i 列对应 lambda(i)，各列组成标准正交基。
    Eigen::SelfAdjointEigenSolver<Eigen::MatrixXd> solver(H);

    if (solver.info() != Eigen::Success) {
        throw std::runtime_error("Eigendecomposition failed");
    }

    const Eigen::VectorXd lambda = solver.eigenvalues();
    const Eigen::MatrixXd V = solver.eigenvectors();
    const Eigen::Index n = A.cols();

    // 同时过滤数值上接近零的特征值，避免除以零或极小值。
    const double numerical_threshold =
        std::numeric_limits<double>::epsilon() *
        static_cast<double>(n) * lambda.cwiseAbs().maxCoeff();

    const double threshold =
        std::max(eigenvalue_threshold, numerical_threshold);

    // 3. 构造筛选矩阵 D，以及过滤后的特征值倒数。
    // d_i = 1：保留；d_i = 0：过滤。
    // 不修改原特征值；被过滤的方向直接令倒数为 0。
    Eigen::VectorXd mask = Eigen::VectorXd::Zero(n);
    Eigen::VectorXd inverse_lambda = Eigen::VectorXd::Zero(n);
    Eigen::Index kept = 0;

    for (Eigen::Index i = 0; i < n; ++i) {
        if (lambda(i) > threshold) {
            mask(i) = 1.0;
            inverse_lambda(i) = 1.0 / lambda(i);
            ++kept;
        }
    }

    // 4. 构造正交投影矩阵。
    // P = V * D * V^T
    const Eigen::MatrixXd D = mask.asDiagonal();
    const Eigen::MatrixXd P = V * D * V.transpose();

    // 5. 直接求过滤后的增量。
    // delta_x = V * diag(d_i / lambda_i) * V^T * A^T * b
    //
    // H 可逆时，等价于 P * H^{-1} * A^T * b。
    // H 奇异时，使用上述截断伪逆形式，不显式求逆。
    // 被过滤的方向不执行除法，因此不会出现 0/0。
    const Eigen::VectorXd delta_x =
        V * inverse_lambda.asDiagonal() * V.transpose() * rhs;

    return {delta_x, lambda, P, kept};
}

int main()
{
    // 示例：4 个标量残差、3 维状态，其中第三维约束很弱。
    // 对于 6 自由度位姿增量，将 J 换成实际的 m×6 雅可比。
    Eigen::MatrixXd J(4, 3);
    J << 1.0, 0.0, 0.0,
         0.0, 1.0, 0.0,
         0.0, 0.0, 1e-4,
         1.0, 1.0, 0.0;

    Eigen::VectorXd r(4);
    r << -1.0, -2.0, -3e-4, -3.0;

    Eigen::VectorXd x0(3);
    x0 << 10.0, 20.0, 30.0;

    // 此例 W=I。
    // 一般构造满足 S^T*S=W 的权重因子 S，再令 A=S*J。
    // 对角权重 W=diag(w_i) 时，S=diag(sqrt(w_i))，要求 w_i>=0。
    const Eigen::MatrixXd S = Eigen::MatrixXd::Identity(4, 4);
    const Eigen::MatrixXd A = S * J;
    const Eigen::VectorXd b = -S * r;  // 负的加权当前残差，并非特指先验残差

    const auto result = solveProjectedStep(A, b, 1e-6);

    // 注意：delta_x 是增量；x_new 才是更新后的状态。
    // x_new = x0 + delta_x
    // 此加法适用于欧氏状态；SE(3) 位姿需按所用扰动约定通过 Exp 更新。
    const Eigen::VectorXd x_new = x0 + result.delta_x;

    std::cout << "H eigenvalues: "
              << result.eigenvalues.transpose() << '\n'
              << "P:\n" << result.P << '\n'
              << "kept directions: " << result.kept_directions << '\n'
              << "delta_x: " << result.delta_x.transpose() << '\n'
              << "x_new: " << x_new.transpose() << '\n';

    if (result.kept_directions == 0) {
        // 所有方向均被过滤时，零增量不代表优化已收敛。
        std::cout << "All directions filtered; this does not imply convergence.\n";
    }

    // 预期输出：
    // H eigenvalues: 1e-08  1  3
    // P:
    // 1 0 0
    // 0 1 0
    // 0 0 0
    // kept directions: 2
    // delta_x: 1 2 0
    // x_new: 11 22 30
}
```

