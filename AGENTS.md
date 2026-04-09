# embodied-bidding-tracker - AGENTS.md

> 本文档面向 AI 编程助手。阅读本文档以了解本项目架构、开发规范和操作方式。

## 项目概述

具身智能行业招投标数据查询工具 —— 基于浏览器自动化技术（Puppeteer）批量查询企业在天眼查平台的招投标/中标公示信息，输出结构化 CSV 报表。

本项目是一个 Node.js CLI 工具，通过 Chrome DevTools Protocol (CDP) 连接已运行的 Chrome 浏览器实例，模拟人工操作完成数据爬取。

## 技术栈

| 层级 | 技术 |
|------|------|
| 运行时 | Node.js >= 18 (ES Modules) |
| 浏览器自动化 | puppeteer-core ^24.0.0 |
| 数据处理 | xlsx ^0.18.5, csv-writer ^1.6.0, csv-parse ^5.6.0 |
| 日志 | winston ^3.17.0 |

## 项目结构

```
embodied-bidding-tracker/
├── AGENTS.md                          # 本文件：AI 助手指南
├── README.md                          # 用户文档（中文）
├── SKILL.md                           # AI Skill 定义（Claude Code 自动加载）
├── .gitignore                         # Git 忽略：node_modules/
├── assets/
│   └── 具身智能中游企业数据库.md        # 默认企业名单（Markdown 表格格式）
├── scripts/                           # 主代码目录
│   ├── package.json                   # npm 依赖与脚本定义
│   ├── package-lock.json              # 锁定依赖版本
│   ├── settings.json                  # 浏览器与采集配置
│   ├── browser.js                     # Chrome 连接管理与工具函数
│   ├── step1_search_companies.js      # Step 1：企业搜索确认
│   ├── step2_download_bidding.js      # Step 2：招投标记录下载
│   ├── modules/                       # 业务逻辑模块
│   │   ├── parseCompanyList.js        # MD 企业名单解析（含海外企业过滤）
│   │   ├── companySearch.js           # 天眼查企业搜索（含安全验证检测）
│   │   └── biddingDownload.js         # 招投标记录抓取与筛选
│   └── utils/                         # 工具函数
│       ├── antiCrawl.js               # 反爬虫检测与安全验证处理
│       ├── excel.js                   # CSV/Excel 读写
│       ├── logger.js                  # Winston 日志配置
│       └── retry.js                   # 重试机制与用户操作等待
└── data/                              # 运行时输出（自动创建，git 忽略）
    ├── company_list.csv               # Step 1 输出：企业搜索确认结果
    ├── bidding_records.csv            # Step 2 输出：招投标记录明细
    ├── step2_progress.json            # 断点续传进度
    └── tool.log                       # 运行日志
```

## 核心架构

### 两阶段处理流程

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  企业名单 MD    │ ──▶ │  Step 1: 搜索    │ ──▶ │ company_list.csv│
│ (名称+领域+城市)│     │  (确认企业全称)  │     │ (名称+链接+状态)│
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                          │
                                                          ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ bidding_records │ ◀── │  Step 2: 下载    │ ◀── │  筛选条件       │
│    .csv         │     │ (招投标明细)     │     │(日期+金额门槛)  │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

### 浏览器连接模式

本项目采用**外部 Chrome 连接模式**（非自动启动）：

1. 用户需手动启动 Chrome 远程调试模式（端口 9222）
2. 用户在浏览器中手动登录天眼查
3. 脚本通过 CDP 连接已运行的 Chrome 实例
4. 此设计降低被检测为爬虫的风险

```javascript
// browser.js 核心逻辑
await puppeteer.connect({
  browserURL: 'http://127.0.0.1:9222',
  defaultViewport: null,
});
```

### 安全验证处理机制

天眼查平台有多层反爬机制，本项目通过 `antiCrawl.js` 处理：

- **URL 跳转检测**：检测是否被重定向到登录/验证页面
- **DOM 元素检测**：检测登录弹窗、验证码、滑块等元素
- **文本特征检测**：检测页面提示文本（如"请登录后查看"）
- **人工介入等待**：触发安全验证时暂停脚本，等待用户手动完成验证（最多 5 分钟）

## 配置说明

### settings.json

```json
{
  "browser": {
    "debugPort": 9222,          // Chrome 远程调试端口
    "defaultTimeout": 30000     // 默认超时（毫秒）
  },
  "search": {
    "delayMin": 3000,           // 企业搜索间隔最小值（毫秒）
    "delayMax": 6000,           // 企业搜索间隔最大值（毫秒）
    "maxRetries": 3             // 最大重试次数
  },
  "bidding": {
    "year": 2026,               // 默认年份
    "minAmountWan": 20,         // 默认金额门槛（万元）
    "maxPages": 50,             // 最大翻页数
    "delayMin": 2000,           // 翻页间隔最小值（毫秒）
    "delayMax": 5000            // 翻页间隔最大值（毫秒）
  },
  "overseas_keywords": [        // 海外/港澳台城市关键词
    "美国", "英国", "德国", "香港", ...
  ]
}
```

## 构建与运行命令

### 前置条件

```bash
# 1. 确保 Node.js >= 18
node --version

# 2. 安装依赖
cd scripts && npm install

# 3. 启动 Chrome 远程调试（macOS 示例）
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir=/tmp/chrome_debug_profile

# 4. 在 Chrome 中访问 https://www.tianyancha.com 并登录
```

### 运行命令

```bash
cd scripts

# Step 1: 企业搜索确认（使用默认名单）
npm run step1
# 或
node step1_search_companies.js

# Step 1: 使用自定义企业名单
node step1_search_companies.js --company-file /path/to/custom_list.md

# Step 2: 招投标记录下载（默认参数）
npm run step2
# 或
node step2_download_bidding.js

# Step 2: 指定参数
node step2_download_bidding.js \
  --start-date 2026-01-01 \
  --end-date 2026-03-31 \
  --min-amount 100
```

### CLI 参数说明

**Step 1 参数：**
| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--company-file` | 自定义企业名单 MD 文件路径 | `assets/具身智能中游企业数据库.md` |

**Step 2 参数：**
| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--start-date` | 开始日期 (YYYY-MM-DD) | `2026-01-01` |
| `--end-date` | 结束日期 (YYYY-MM-DD) | `2026-03-31` |
| `--min-amount` | 最低金额（万元），0=无门槛 | `0` |

## 代码规范

### 模块系统

- 使用 ES Modules (`"type": "module"` in package.json)
- 文件扩展名使用 `.js`，导入时需带扩展名

```javascript
// 正确
import { logger } from './utils/logger.js';

// 错误
import { logger } from './utils/logger';  // 缺少 .js 扩展名
```

### 目录引用

使用 `fileURLToPath` 和 `import.meta.url` 处理 `__dirname`：

```javascript
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
```

### 日志规范

所有输出通过 `utils/logger.js`：

```javascript
import { logger } from './utils/logger.js';

logger.info('信息日志');
logger.warn('警告日志');
logger.error('错误日志');
```

日志同时输出到：
- 控制台（带颜色）
- `data/tool.log`（文件，最大 5MB，保留 3 个历史文件）

### 延迟/等待函数

使用 `browser.js` 提供的随机延迟：

```javascript
import { delay } from './browser.js';

// 随机延迟 2000-5000 毫秒
await delay(2000, 5000);
```

### 重试机制

使用 `utils/retry.js`：

```javascript
import { withRetry } from './utils/retry.js';

await withRetry(async () => {
  // 可能失败的操作
}, { maxRetries: 3, delayMs: 5000, label: '操作描述' });
```

### 安全验证检查

所有页面导航/操作后必须检查安全验证：

```javascript
import { handleSecurityCheck } from './utils/antiCrawl.js';

await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
const passed = await handleSecurityCheck(page, {
  context: '操作描述',
  expectedUrlPattern: '/expected-path',
});
if (!passed) {
  throw new Error('安全验证等待超时');
}
```

## 输入数据格式

### 企业名单 MD 格式

Markdown 表格，必须包含以下列：

```markdown
| 索引 | 企业名称 | 所属领域 | 产品名称 | 城市 |
|------|----------|----------|----------|------|
| 1 | 宇树科技 | 本体 | Unitree H1 | 杭州 |
| 2 | 优必选 | 本体 | Walker S2 | 深圳 |
```

- 海外/港澳台企业（城市含 `overseas_keywords` 关键词）自动跳过
- 字段不足的行会被忽略

## 输出数据格式

### company_list.csv

| 列名 | 说明 |
|------|------|
| 索引 | 原 MD 中的索引 |
| 企业简称(MD) | 原 MD 中的名称 |
| 企业全称(天眼查) | 搜索到的完整企业名称 |
| 公司ID | 天眼查公司 ID |
| 天眼查链接 | 企业详情页 URL |
| 所属领域 | 原 MD 数据 |
| 产品名称 | 原 MD 数据 |
| 城市 | 原 MD 数据 |
| 搜索状态 | 已确认/未找到/失败:xxx/海外企业-跳过 |

### bidding_records.csv

| 列名 | 说明 |
|------|------|
| 企业名称 | 企业全称 |
| 项目名称 | 招投标项目标题 |
| 公告类型 | 中标公告/招标公告等 |
| 采购人 | 招采单位 |
| 中标金额 | 原始金额文本 |
| 发布日期 | YYYY-MM-DD 格式 |
| 天眼查详情页链接 | 项目详情 URL |

## 测试策略

本项目无自动化测试套件，采用**手动集成测试**：

1. **Step 1 测试**：运行 `npm run step1`，验证：
   - 能正确解析 MD 文件
   - 能连接到 Chrome
   - 能正确处理安全验证
   - 输出 CSV 格式正确

2. **Step 2 测试**：运行 `npm run step2`，验证：
   - 能正确读取 Step 1 输出
   - 能正确应用筛选条件
   - 断点续传功能正常（中断后重新运行）
   - 数据去重功能正常

## 调试技巧

### 查看 Chrome DevTools

1. 在浏览器访问 `http://127.0.0.1:9222`
2. 点击页面链接打开 DevTools

### 开启 Puppeteer 调试

```bash
DEBUG=puppeteer:* node step1_search_companies.js
```

### 检查日志

```bash
tail -f data/tool.log
```

## 常见问题

### Chrome 连接失败

```
未检测到 Chrome 远程调试服务
```
**解决**：按 README 说明手动启动 Chrome 远程调试模式。

### 安全验证频繁触发

**解决**：
1. 降低查询频率（增大 `delayMin`/`delayMax`）
2. 分批次查询（单次不超过 200 家企业）
3. 暂停 30 分钟后继续

### Step 2 中断后如何恢复

直接重新运行 Step 2，会自动跳过已处理的企业（进度保存在 `step2_progress.json`）。

## AI Coding 规则

1. **工作区内使用中文**：所有代码注释、文档、提交信息、变量命名等均使用中文
2. **Git 操作需人工确认**：任何 `git push` 操作前必须获得用户明确确认后再执行

## 开发注意事项

1. **不要自动启动 Chrome**：必须使用外部 Chrome 连接模式，避免被检测为爬虫
2. **必须处理安全验证**：所有页面操作后都要调用 `handleSecurityCheck`
3. **保持随机延迟**：请求间隔使用随机值，模拟人工操作
4. **注意数据去重**：同一标题+日期的记录只保留一条
5. **避免硬编码路径**：使用 `path.join` 和 `projectRoot` 处理跨平台路径

## 依赖更新

```bash
cd scripts
npm update
npm outdated
```

## License

本项目为内部工具，未指定开源许可证。
