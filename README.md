# embodied-bidding-tracker

具身智能行业招投标数据查询 AI Skill —— 基于浏览器自动化技术批量查询企业招投标/中标公示信息，输出结构化 CSV。

## 目录结构

```
embodied-bidding-tracker/
├── SKILL.md                          # AI Skill 定义（自动加载）
├── README.md                         # 本文件
├── assets/
│   └── 具身智能中游企业数据库.md        # 默认企业名单
├── scripts/
│   ├── package.json                   # npm 依赖
│   ├── settings.json                  # 浏览器与采集配置
│   ├── step1_search_companies.js      # Step 1: 企业搜索确认
│   ├── step2_download_bidding.js      # Step 2: 招投标下载
│   ├── browser.js                     # Puppeteer 浏览器连接
│   ├── modules/
│   │   ├── parseCompanyList.js        # MD 企业名单解析
│   │   ├── companySearch.js           # 天眼查企业搜索（含安全验证检测）
│   │   └── biddingDownload.js         # 招投标记录下载
│   └── utils/
│       ├── excel.js                   # CSV/Excel 读写
│       ├── logger.js                  # 日志（Winston）
│       └── retry.js                   # 重试与安全验证等待
└── data/                              # 运行时输出（自动创建）
    ├── company_list.csv               # Step 1 输出
    ├── bidding_records.csv            # Step 2 输出
    └── step2_progress.json            # 断点续传进度
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

3. 在 Chrome 中访问 https://www.tianyancha.com 并登录
4. 保持 Chrome 运行，然后执行下面的脚本

## 安装

Skill 目录位于 `~/.qclaw/skills/embodied-bidding-tracker`（优先）或 `~/.openclaw/skills/embodied-bidding-tracker`。Windows 用户对应 `%USERPROFILE%\.qclaw\skills\...` 或 `%USERPROFILE%\.openclaw\skills\...`。

```bash
# 进入实际的 skill 目录（以 qclaw 为例）
cd ~/.qclaw/skills/embodied-bidding-tracker/scripts
npm install
```

## 使用方式

### 方式一：通过 Claude Code 自然语言触发（推荐）

在 Claude Code 中直接用自然语言描述需求，Skill 会自动触发：

> "帮我查一下这些企业在天眼查的招投标记录：宇树科技、优必选、智元机器人"
>
> "采集具身智能企业 2026 年 Q1 的中标记录，金额门槛 100 万"
>
> "用默认企业名单跑一下具身智能行业招投标数据"

### 方式二：手动执行脚本

#### 1. Step 1：企业搜索确认

> 请先确保已按上述说明启动 Chrome 并登录天眼查。

```bash
cd ~/.qclaw/skills/embodied-bidding-tracker/scripts

# 使用内置默认企业名单
node step1_search_companies.js

# 使用自定义企业名单
node step1_search_companies.js --company-file /path/to/custom_list.md
```

输出：`data/company_list.csv`

#### 2. Step 2：招投标记录下载

```bash
node step2_download_bidding.js --start-date 2026-01-01 --end-date 2026-03-31 --min-amount 0
```

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--start-date` | 开始日期 (YYYY-MM-DD) | `2026-01-01` |
| `--end-date` | 结束日期 (YYYY-MM-DD) | `2026-03-31` |
| `--min-amount` | 最低金额（万元），0=无门槛 | `0` |

输出：`data/bidding_records.csv`

## 自定义企业名单格式

MD 文件需包含如下 Markdown 表格：

```markdown
| 索引 | 企业名称 | 所属领域 | 产品名称 | 城市 |
| --- | --- | --- | --- | --- |
| 1 | 宇树科技 | 人形机器人 | Unitree H1 | 杭州 |
| 2 | 优必选 | 人形机器人 | Walker S2 | 深圳 |
```

- 海外/港澳台企业（城市含美国、英国、香港等关键词）会自动跳过
- 所属领域、产品名称、城市可填 `-` 占位

## 平台安全验证处理

脚本内置了平台安全机制检测：
- 检测安全验证弹窗（登录窗口、验证码等）
- 检测页面跳转到安全验证页面
- 触发时会在终端输出提示，等待用户在 Chrome 中手动完成验证
- 验证通过后自动继续（最多等待 5 分钟）
- 支持断点续传：Step 2 中断后重新运行会跳过已处理的企业

## 跨平台支持

| 特性 | macOS | Windows |
|------|-------|---------|
| Chrome 启动 | 支持 | CMD / PowerShell 均支持 |
| 端口检测 | `lsof` | `netstat` / `Get-NetTCPConnection` |
| 路径分隔符 | Node.js `path` 模块自动处理 | 同左 |
| npm / Node.js | 支持 | 支持 |
