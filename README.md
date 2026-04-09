# embodied-bidding-tracker

具身智能行业招投标数据查询 AI Skill —— 基于浏览器自动化技术批量查询企业招投标/中标公示信息，输出结构化 CSV。

**v2.0 更新**: 全新统一 CLI 入口，支持交互式单企业查询、模糊匹配、跨平台兼容。

## 目录结构

```
embodied-bidding-tracker/
├── SKILL.md                          # AI Skill 定义（标准格式）
├── README.md                         # 本文件
├── AGENTS.md                         # AI 助手指南
├── assets/
│   └── 具身智能中游企业数据库.md        # 默认企业名单
├── scripts/
│   ├── cli.js                        # ⭐ 统一 CLI 入口
│   ├── config.js                     # ⭐ 统一配置管理
│   ├── browser.js                    # Puppeteer 浏览器连接
│   ├── package.json                  # npm 依赖
│   ├── step1_search_companies.js     # (兼容) 企业搜索确认
│   ├── step2_download_bidding.js     # (兼容) 招投标下载
│   ├── download_bidding.js           # (兼容) 交互式单企业采集
│   ├── modules/
│   │   ├── parseCompanyList.js       # MD 企业名单解析
│   │   ├── companySearch.js          # 天眼查企业搜索
│   │   └── biddingDownload.js        # 招投标记录下载
│   └── utils/
│       ├── excel.js                  # CSV/Excel 读写
│       ├── logger.js                 # 日志（Winston）
│       └── retry.js                  # 重试与安全验证等待
└── data/                             # 运行时输出（自动创建）
    ├── company_list.csv              # 企业搜索确认结果
    ├── bidding_records.csv           # 招投标记录明细
    └── step2_progress.json           # 断点续传进度
```

## 前置条件

- **Node.js** >= 18（从 https://nodejs.org/ 下载安装）
- **Google Chrome** 浏览器（需手动启动远程调试模式）
- **天眼查账号**（需登录后使用）

## Chrome 启动说明

本工具需要 Chrome 在远程调试模式下运行。请按以下步骤操作：

1. 关闭所有 Chrome 窗口
2. 按您的操作系统运行以下命令启动 Chrome：

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

3. 启动后，在 Chrome 中访问 https://www.tianyancha.com 并登录

## 快速开始

```bash
cd scripts

# 安装依赖
npm install

# 检查环境状态
node cli.js status

# 企业搜索确认
node cli.js search

# 下载招投标记录
node cli.js download

# 交互式查询单个企业
node cli.js query "宇树科技"
```

## CLI 命令详解

### `node cli.js status` - 环境状态检查

检查 Node.js 版本、Chrome 连接、npm 依赖、企业数据库等环境状态。

### `node cli.js search` - 企业搜索确认

从企业名单搜索并确认天眼查信息，补全企业全称和链接。

```bash
# 使用默认企业名单
node cli.js search

# 使用自定义名单
node cli.js search --company-file /path/to/custom.md
```

**输出**: `data/company_list.csv`

### `node cli.js download` - 批量下载招投标记录

基于已确认的企业列表，批量下载招投标记录。

```bash
# 使用默认参数（本季度）
node cli.js download

# 指定时间范围和金额门槛
node cli.js download --start-date 2026-01-01 --end-date 2026-03-31 --min-amount 100
```

**参数**:
- `--start-date`: 开始日期 (YYYY-MM-DD, 默认: 本季度第一天)
- `--end-date`: 结束日期 (YYYY-MM-DD, 默认: 今天)
- `--min-amount`: 最低金额门槛 (万元, 默认: 0)

**输出**: `data/bidding_records.csv`

### `node cli.js query [企业名称]` - 交互式单企业查询

交互式查询单个企业的招投标记录，支持模糊匹配。

```bash
# 交互式输入
node cli.js query

# 直接指定企业名称
node cli.js query "宇树科技"

# 指定查询参数
node cli.js query "宇树科技" --start-date 2026-01-01 --min-amount 50
```

**工作流程**:
1. 输入企业名称（支持简称/模糊匹配，如"宇树"）
2. 系统显示匹配的企业列表
3. 选择目标企业
4. 输入时间范围和金额门槛
5. 自动采集并保存结果

## 数据格式

### 输入：企业名单（Markdown 表格）

```markdown
| 索引 | 企业名称 | 所属领域 | 产品名称 | 城市 | 天眼查企业全称 | 天眼查链接 |
|------|----------|----------|----------|------|----------------|------------|
| 1 | 宇树科技 | 本体 | Unitree H1 | 杭州 | 宇树科技股份有限公司 | https://www.tianyancha.com/company/... |
```

### 输出 1：企业列表（CSV）

路径: `data/company_list.csv`

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

### 输出 2：招投标记录（CSV）

路径: `data/bidding_records.csv`

| 列名 | 说明 |
|------|------|
| 企业名称 | 企业全称 |
| 项目名称 | 招投标项目标题 |
| 公告类型 | 中标公告/招标公告等 |
| 采购人 | 招采单位 |
| 中标金额 | 原始金额文本 |
| 发布日期 | YYYY-MM-DD 格式 |
| 天眼查详情页链接 | 项目详情 URL |

## 兼容模式（旧命令）

旧版命令仍兼容可用：

```bash
npm run step1    # 等同于: node cli.js search
npm run step2    # 等同于: node cli.js download
npm run download # 等同于: node cli.js query
```

## 注意事项

1. **必须手动启动 Chrome** 远程调试模式
2. **需要登录天眼查** 后才能正常使用
3. **请勿频繁查询**（间隔 3-6 秒），避免触发平台风控
4. **如遇验证码/滑块**，请在 Chrome 窗口中手动完成
5. **建议单次查询不超过 200 家企业**

## 问题排查

### Chrome 未连接

```
未检测到 Chrome 远程调试服务
```

**解决**: 按上文说明启动 Chrome 远程调试模式。

### 需要安全验证

```
天眼查平台安全验证已触发
```

**解决**: 在 Chrome 窗口中手动完成验证码/滑块验证，工具会自动继续。

### 企业未找到

**可能原因**:
- 企业名称不准确，尝试使用简称
- 非大陆企业（如香港、美国等），已被自动跳过
- 天眼查平台未收录该企业

## 技术栈

- **Node.js** >= 18 (ES Modules)
- **puppeteer-core** ^24.0.0 - 浏览器自动化
- **csv-writer/csv-parse** - CSV 处理
- **winston** - 日志管理

## License

本项目为内部工具，未指定开源许可证。
