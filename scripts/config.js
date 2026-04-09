/**
 * 统一配置管理模块
 * 
 * 按照 Skill 标准管理所有配置项
 * 支持环境变量覆盖
 */
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ==================== 基础路径配置 ====================
export const PATHS = {
  // Skill 根目录
  skillRoot: path.resolve(__dirname, '..'),
  // 脚本目录
  scriptsDir: __dirname,
  // 数据输出目录
  dataDir: path.resolve(__dirname, '..', 'data'),
  // 资产目录
  assetsDir: path.resolve(__dirname, '..', 'assets'),
  // 默认企业名单
  defaultCompanyList: path.resolve(__dirname, '..', 'assets', '具身智能中游企业数据库.md'),
};

// 确保数据目录存在
if (!fs.existsSync(PATHS.dataDir)) {
  fs.mkdirSync(PATHS.dataDir, { recursive: true });
}

// ==================== 浏览器配置 ====================
export const BROWSER_CONFIG = {
  // 远程调试端口
  debugPort: parseInt(process.env.TIANYANCHA_DEBUG_PORT) || 9222,
  // 默认超时（毫秒）
  defaultTimeout: 30000,
  // 页面加载等待时间
  navigationTimeout: 30000,
  // Chrome 启动参数
  get chromeArgs() {
    const userDataDir = process.platform === 'win32' 
      ? '%TEMP%\\chrome_debug_profile'
      : '/tmp/chrome_debug_profile';
    
    return [
      `--remote-debugging-port=${this.debugPort}`,
      `--user-data-dir=${userDataDir}`,
      '--no-first-run',
      '--no-default-browser-check',
    ];
  },
  // 获取 Chrome 可执行路径（跨平台）
  get chromeExecutable() {
    const platform = process.platform;
    switch (platform) {
      case 'darwin':
        return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
      case 'win32':
        return 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
      case 'linux':
        return 'google-chrome';
      default:
        return 'google-chrome';
    }
  },
};

// ==================== 搜索配置 ====================
export const SEARCH_CONFIG = {
  // 企业搜索间隔（毫秒）
  delayMin: 3000,
  delayMax: 6000,
  // 最大重试次数
  maxRetries: 3,
  // 安全验证等待时间（毫秒）
  securityCheckTimeout: 5 * 60 * 1000, // 5分钟
};

// ==================== 招投标配置 ====================
export const BIDDING_CONFIG = {
  // 默认年份
  year: new Date().getFullYear(),
  // 默认金额门槛（万元）
  minAmountWan: 0,
  // 最大翻页数
  maxPages: 10,
  // 翻页间隔（毫秒）
  pageDelayMin: 2000,
  pageDelayMax: 5000,
  // 公告类型筛选
  defaultNoticeType: '中标公告',
  // 发布时间筛选
  defaultTimeRange: '近3个月',
};

// ==================== 日期工具 ====================
export const DateUtils = {
  // 获取当前季度
  getCurrentQuarter() {
    const month = new Date().getMonth() + 1;
    if (month <= 3) return 1;
    if (month <= 6) return 2;
    if (month <= 9) return 3;
    return 4;
  },
  
  // 获取季度日期范围
  getQuarterRange(year = new Date().getFullYear(), quarter = this.getCurrentQuarter()) {
    const quarters = {
      1: { start: '01-01', end: '03-31' },
      2: { start: '04-01', end: '06-30' },
      3: { start: '07-01', end: '09-30' },
      4: { start: '10-01', end: '12-31' },
    };
    const q = quarters[quarter];
    return {
      startDate: `${year}-${q.start}`,
      endDate: `${year}-${q.end}`,
    };
  },
  
  // 解析日期
  parseDate(dateStr) {
    if (!dateStr) return null;
    const timestamp = new Date(dateStr).getTime();
    return isNaN(timestamp) ? null : timestamp;
  },
  
  // 格式化日期
  formatDate(date) {
    if (typeof date === 'string') date = new Date(date);
    if (!(date instanceof Date) || isNaN(date.getTime())) return '';
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },
};

// ==================== 海外城市关键词 ====================
export const OVERSEAS_KEYWORDS = [
  '美国', '英国', '德国', '法国', '日本', '韩国', '挪威',
  '加州', '德州', '俄勒冈', '马萨诸塞', '宾州', '伦敦',
  '香港', '澳门', '台湾',
];

// ==================== CSV 表头定义 ====================
export const CSV_HEADERS = {
  companyList: [
    { id: 'index', title: '索引' },
    { id: 'shortName', title: '企业简称(MD)' },
    { id: 'fullName', title: '企业全称(天眼查)' },
    { id: 'companyId', title: '公司ID' },
    { id: 'url', title: '天眼查链接' },
    { id: 'field', title: '所属领域' },
    { id: 'product', title: '产品名称' },
    { id: 'city', title: '城市' },
    { id: 'status', title: '搜索状态' },
  ],
  biddingRecords: [
    { id: 'companyName', title: '企业名称' },
    { id: 'title', title: '项目名称' },
    { id: 'type', title: '公告类型' },
    { id: 'buyer', title: '采购人' },
    { id: 'amount', title: '中标金额' },
    { id: 'date', title: '发布日期' },
    { id: 'link', title: '天眼查详情页链接' },
  ],
};

// ==================== 环境检查 ====================
export const EnvCheck = {
  // 检查 Node.js 版本
  checkNodeVersion() {
    const version = process.version;
    const major = parseInt(version.slice(1).split('.')[0]);
    if (major < 18) {
      throw new Error(`Node.js 版本过低: ${version}，需要 >= 18`);
    }
    return { version, major };
  },
  
  // 检查平台
  getPlatform() {
    return {
      platform: process.platform,
      isMac: process.platform === 'darwin',
      isWindows: process.platform === 'win32',
      isLinux: process.platform === 'linux',
    };
  },
  
  // 生成 Chrome 启动命令
  getChromeLaunchCommand() {
    const { platform } = this.getPlatform();
    const { chromeExecutable, debugPort } = BROWSER_CONFIG;
    const userDataDir = platform === 'win32' 
      ? '%TEMP%\\chrome_debug_profile'
      : '/tmp/chrome_debug_profile';
    
    const args = [
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${userDataDir}`,
    ];
    
    if (platform === 'win32') {
      return `"${chromeExecutable}" ${args.join(' ')}`;
    }
    return `${chromeExecutable} ${args.join(' ')}`;
  },
};

// ==================== 默认导出 ====================
export default {
  PATHS,
  BROWSER_CONFIG,
  SEARCH_CONFIG,
  BIDDING_CONFIG,
  DateUtils,
  OVERSEAS_KEYWORDS,
  CSV_HEADERS,
  EnvCheck,
};
