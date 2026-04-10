# embodied-bidding-tracker - AGENTS.md

> 本文档面向 AI 编程助手。阅读本文档以了解本项目架构、开发规范和操作方式。

## 项目概述

**具身智能行业招投标数据查询工具** —— 基于浏览器自动化技术（Puppeteer）批量查询企业在天眼查平台的招投标/中标公示信息，输出结构化 CSV 报表。

**v2.0 更新**: 已重构为符合 Agent Skill 标准的统一 CLI 架构。

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
├── SKILL.md                           # Skill 定义文件（主要参考）
├── AGENTS.md                          # 本文件：AI 助手指南
├── README.md                          # 用户文档
├── assets/
│   └── 具身智能中游企业数据库.md        # 默认企业名单
├── scripts/                           # 主代码目录
│   ├── cli.js                         # ⭐ 统一 CLI 入口
│   ├── config.js                      # ⭐ 统一配置管理
│   ├── browser.js                     # Chrome 连接管理
│   ├── modules/                       # 业务逻辑模块
│   │   ├── parseCompanyList.js        # MD 企业名单解析
│   │   ├── companySearch.js           # 天眼查企业搜索
│   │   └── biddingDownload.js         # 招投标记录下载
│   └── utils/                         # 工具函数
│       ├── excel.js                   # CSV/Excel 读写
│       ├── logger.js                  # Winston 日志配置
│       └── retry.js                   # 重试机制
└── data/                              # 运行时输出
    ├── company_list.csv               # 企业搜索确认结果
    ├── bidding_records.csv            # 招投标记录明细
    └── step2_progress.json            # 断点续传进度
```

## 核心架构

### 统一 CLI 入口 (cli.js)

v2.0 引入统一 CLI，取代分散的脚本文件：

```
node cli.js <command> [options]

Commands:
  status    环境状态检查
  search    企业搜索确认
  download  批量下载招投标记录
  query     交互式单企业查询
  help      显示帮助信息
```

### 配置管理 (config.js)

集中管理所有配置项：

```javascript
import { 
  PATHS,           // 路径配置
  BROWSER_CONFIG,  // 浏览器配置
  SEARCH_CONFIG,   // 搜索配置
  BIDDING_CONFIG,  // 招投标配置
  DateUtils,       // 日期工具
  EnvCheck,        // 环境检查
} from './config.js';
```

### 跨平台支持

| 平台 | Chrome 路径 |
|------|------------|
| macOS | `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` |
| Windows | `C:\Program Files\Google\Chrome\Application\chrome.exe` |
| Linux | `google-chrome` |

## 快速开始

### 1. 环境检查

```bash
cd scripts
node cli.js status
```

### 2. 企业搜索确认

```bash
# 使用默认企业名单
node cli.js search

# 使用自定义名单
node cli.js search --company-file /path/to/custom.md
```

### 3. 下载招投标记录

```bash
# 本季度数据
node cli.js download

# 指定参数
node cli.js download \
  --start-date 2026-01-01 \
  --end-date 2026-03-31 \
  --min-amount 100
```

### 4. 交互式单企业查询

```bash
# 交互式输入
node cli.js query

# 直接指定
node cli.js query "宇树科技"
```

## 代码规范

### 模块系统

使用 ES Modules (`"type": "module"` in package.json)：

```javascript
// ✅ 正确
import { logger } from './utils/logger.js';

// ❌ 错误
import { logger } from './utils/logger';  // 缺少 .js 扩展名
```

### 目录引用

使用 `fileURLToPath` 和 `import.meta.url`：

```javascript
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
```

### 配置使用

优先使用统一配置：

```javascript
import { PATHS, BROWSER_CONFIG, DateUtils } from './config.js';

// 使用预定义路径
const dataDir = PATHS.dataDir;

// 使用日期工具
const { startDate, endDate } = DateUtils.getQuarterRange(2026, 1);
```

### 日志规范

使用 `utils/logger.js`：

```javascript
import { logger } from './utils/logger.js';

logger.info('信息日志');
logger.warn('警告日志');
logger.error('错误日志');
```

### 延迟/等待

使用 `browser.js` 提供的随机延迟：

```javascript
import { delay } from './browser.js';

await delay(3000, 6000);  // 随机延迟 3-6 秒
```

### 安全验证检查

所有页面操作后必须检查：

```javascript
import { handleSecurityCheck } from './utils/antiCrawl.js';

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

必须包含以下列：

```markdown
| 索引 | 企业名称 | 所属领域 | 产品名称 | 城市 | 天眼查企业全称 | 天眼查链接 |
|------|----------|----------|----------|------|----------------|------------|
| 1 | 宇树科技 | 本体 | Unitree H1 | 杭州 | 宇树科技股份有限公司 | https://... |
```

- 海外/港澳台企业自动跳过（城市关键词匹配）
- 天眼查信息可为空，会被自动补全

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
| 搜索状态 | 已确认/未找到/失败/海外企业-跳过 |

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

采用手动集成测试：

1. **环境检查**: `node cli.js status`
   - 验证 Node.js 版本
   - 验证 Chrome 连接
   - 验证 npm 依赖

2. **企业搜索**: `node cli.js search`
   - 验证 MD 文件解析
   - 验证天眼查搜索
   - 验证 CSV 输出

3. **招投标下载**: `node cli.js download`
   - 验证筛选条件
   - 验证断点续传
   - 验证数据去重

4. **单企业查询**: `node cli.js query "测试企业"`
   - 验证模糊匹配
   - 验证交互流程
   - 验证结果保存

## 调试技巧

### 查看 Chrome DevTools

1. 访问 `http://127.0.0.1:9222`
2. 点击页面链接打开 DevTools

### 开启 Puppeteer 调试

```bash
DEBUG=puppeteer:* node cli.js download
```

### 查看日志

```bash
tail -f data/tool.log
```

## 常见问题

### Chrome 连接失败

```
未检测到 Chrome 远程调试服务
```

**解决**: 按 SKILL.md 说明手动启动 Chrome 远程调试模式。

### 安全验证频繁触发

**解决**:
1. 降低查询频率（增大 delay）
2. 分批次查询（单次不超过 200 家）
3. 暂停 30 分钟后继续

### 脚本中断后如何恢复

直接重新运行，会自动跳过已处理的企业（进度保存在 `step2_progress.json`）。

## AI Coding 规则

1. **工作区内使用中文**: 所有代码注释、文档、变量命名等均使用中文
2. **Git 操作需人工确认**: 任何 `git push` 操作前必须获得用户明确确认
3. **优先使用统一配置**: 新增配置项应放入 `config.js`
4. **统一入口**: 所有操作通过 `cli.js` 入口执行

## 开发注意事项

1. **不要自动启动 Chrome**: 必须使用外部 Chrome 连接模式
2. **必须处理安全验证**: 所有页面操作后调用 `handleSecurityCheck`
3. **保持随机延迟**: 请求间隔使用随机值，模拟人工操作
4. **注意数据去重**: 同一标题+日期的记录只保留一条
5. **避免硬编码路径**: 使用 `PATHS` 配置处理跨平台路径

## 依赖更新

```bash
cd scripts
npm update
npm outdated
```

## License

本项目为内部工具，未指定开源许可证。
