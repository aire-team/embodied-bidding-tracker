---
name: embodied-bidding-tracker
description: 具身智能行业招投标数据查询工具 - 基于浏览器自动化技术批量查询企业招投标/中标公示信息，导出结构化 CSV 报表。支持 macOS 和 Windows 跨平台运行。
---

## Skill 目录结构

```
<SKILL_DIR>/embodied-bidding-tracker/
├── SKILL.md
├── assets/
│   └── 具身智能中游企业数据库.md        # 默认企业名单
├── scripts/
│   ├── package.json                   # npm 依赖声明（在此目录执行 npm install）
│   ├── settings.json                  # 浏览器与采集配置
│   ├── step1_search_companies.js      # 企业搜索确认
│   ├── step2_download_bidding.js      # 招投标下载
│   ├── browser.js                     # Puppeteer 浏览器连接
│   ├── modules/
│   │   ├── parseCompanyList.js        # MD 企业名单解析
│   │   ├── companySearch.js           # 天眼查企业搜索
│   │   └── biddingDownload.js         # 招投标记录下载
│   └── utils/
│       ├── excel.js                   # CSV/Excel 读写
│       ├── logger.js                  # 日志（Winston）
│       └── retry.js                   # 重试与安全验证等待
└── data/                              # 运行时输出（自动创建）
```

**SKILL_DIR 解析规则（按优先级）：**

| 优先级 | macOS / Linux | Windows |
|--------|---------------|---------|
| 1 | `~/.qclaw/skills/embodied-bidding-tracker` | `%USERPROFILE%\.qclaw\skills\embodied-bidding-tracker` |
| 2 | `~/.openclaw/skills/embodied-bidding-tracker` | `%USERPROFILE%\.openclaw\skills\embodied-bidding-tracker` |

取第一个存在的路径作为 SKILL_DIR。

## When to Use

当用户需要以下场景时触发此技能：
- 查询、导出企业在天眼查平台上的招投标/中标/投标公示信息
- 批量查询一批企业的招投标历史记录
- 按时间范围和金额筛选企业中标信息
- 基于企业名单文件进行招投标数据查询

## Execution Logic

### Step 1: 前置环境检查（跨平台）

#### 1.1 检测操作系统

```bash
node -e "console.log(process.platform)"
```

#### 1.2 Node.js 环境检测与自动安装

首先检测 Node.js 是否已安装：

```bash
node --version
npm --version
```

**如未安装 Node.js：**

请访问 Node.js 官网下载安装：https://nodejs.org/ （建议安装 LTS 版本）

验证安装：
```bash
node --version  # 应显示 v18 或更高版本
npm --version
```

#### 1.3 Chrome 环境检查

脚本会检测 Chrome 远程调试端口（9222）是否已开启。

**⚠️ 用户需手动启动 Chrome：**

请先关闭所有 Chrome 窗口，然后按您的操作系统运行以下命令：

**macOS:**
```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome_debug_profile
```

**Windows:**
```cmd
"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir=%TEMP%\chrome_debug_profile
```

**Linux:**
```bash
google-chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome_debug_profile
```

> **提示**：如果 Chrome 安装在其他位置，请修改命令中的路径。

**登录天眼查：**
Chrome 启动后，请手动在浏览器中打开 https://www.tianyancha.com 并完成登录。

登录完成后，告知我"已登录"，我将继续执行后续步骤。

**安装 npm 依赖：**
```bash
cd SKILL_DIR/scripts && npm install
```

### Step 2: 参数提取

从用户 prompt 中提取以下参数（均有默认值）：

| 参数 | 说明 | 默认值 |
|------|------|--------|
| 公司列表 | 文本内容或 .md 文件路径 | `assets/具身智能中游企业数据库.md` |
| 开始日期 | 查询时间范围起点 | 当季度第一天 |
| 结束日期 | 查询时间范围终点 | 今天 |
| 最低金额 | 万元，0=无门槛 | 0 |

当季度计算：Q1=01-01~03-31, Q2=04-01~06-30, Q3=07-01~09-30, Q4=10-01~12-31。

如果用户直接提供了公司名称列表（非文件），将公司列表写入 `SKILL_DIR/data/custom_companies.md`：
```
| 索引 | 企业名称 | 所属领域 | 产品名称 | 城市 |
| --- | --- | --- | --- | --- |
| 1 | 公司A | - | - | - |
| 2 | 公司B | - | - | - |
```
然后使用 `--company-file` 指向该文件。

### Step 3: 企业搜索确认

```bash
cd SKILL_DIR/scripts

# 使用内置默认企业名单
node step1_search_companies.js

# 使用自定义企业名单
node step1_search_companies.js --company-file SKILL_DIR/data/custom_companies.md
```

执行完成后，读取 `SKILL_DIR/data/company_list.csv`，向用户报告：
- 已确认的企业数
- 未找到的企业及名称
- 失败的企业及原因

### Step 4: 招投标记录下载

```bash
cd SKILL_DIR/scripts
node step2_download_bidding.js --start-date 2026-01-01 --end-date 2026-03-31 --min-amount 0
```

执行完成后，读取 `SKILL_DIR/data/bidding_records.csv`，输出结构化摘要：
- 有招投标记录的企业数量
- 总记录数
- 按企业分组的记录统计
- 金额 TOP 10 记录列表（如有金额信息）
- 失败企业列表

### 异常处理

| 异常场景 | 处理方式 |
|----------|----------|
| Chrome 未连接 / 端口 9222 无响应 | 提示用户按文档手动启动 Chrome |
| 需要验证码 | 提醒用户在 Chrome 窗口中手动完成验证码，完成后工具会自动继续 |
| 企业搜索无结果 | 说明可能原因：企业名称不准确、非大陆企业、天眼查未收录 |
| 招投标无记录 | 说明可能原因：该企业在指定时间范围内无公开招投标、金额门槛过高 |
| npm 依赖缺失 | 引导用户在 `SKILL_DIR/scripts` 下执行 `npm install` |
| CSV 文件不存在 | 检查上一步骤是否正常完成 |

## Expected Output

### 输出格式1：企业搜索确认报告
```
企业搜索完成：共 50 家国内企业
  已确认: 45 家
  未找到: 3 家（企业A、企业B、企业C）
  失败: 2 家（企业D: 网络超时、企业E: 页面异常）
```

### 输出格式2：招投标记录摘要
```
招投标记录下载完成
  时间范围: 2026-01-01 至 2026-03-31
  金额门槛: 无门槛
  有记录企业: 28 / 45 家
  符合条件记录: 156 条

  按企业分布:
    企业A: 12 条
    企业B: 8 条
    ...

  金额 TOP 5:
    1. 企业A - XX项目 - 500万元
    2. 企业B - YY项目 - 320万元
    ...
```

### 输出文件
| 文件 | 路径 | 说明 |
|------|------|------|
| 企业列表 | `SKILL_DIR/data/company_list.csv` | 企业搜索确认结果 |
| 招投标记录 | `SKILL_DIR/data/bidding_records.csv` | 招投标记录明细 |
| 断点进度 | `SKILL_DIR/data/step2_progress.json` | Step 2 断点续传进度 |

## Judgment Criteria
- 企业搜索确认率 > 90% 为正常，低于此值需检查名单质量
- 有招投标记录的企业占比通常在 40%-70%，取决于行业和时间范围
- 单次查询建议不超过 200 家企业，避免触发平台安全机制
- 时间范围建议不超过 1 年，数据量过大时可分季度采集
- 如遇安全验证频率过高（>5次/50家），建议暂停 30 分钟后继续
