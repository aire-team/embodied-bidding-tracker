import puppeteer from 'puppeteer-core';
import os from 'os';
import { logger } from './utils/logger.js';

// ─── Chrome 连接管理 ───────────────────────────────────────────

/**
 * 检查 Chrome CDP 端口是否可用
 * @returns {Promise<boolean>}
 */
async function isChromePortAvailable() {
  try {
    const res = await fetch('http://127.0.0.1:9222/json/version');
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * 获取各平台的 Chrome 启动命令示例
 */
function getChromeLaunchCommands() {
  return {
    darwin: '/Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome_debug_profile',
    win32: '"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --remote-debugging-port=9222 --user-data-dir=%TEMP%\\chrome_debug_profile',
    linux: 'google-chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome_debug_profile',
  };
}

/**
 * 连接到 Chrome 浏览器
 * 只连接已运行的 CDP 实例，不自动启动浏览器（避免安全检测误报）
 */
export async function connectBrowser() {
  // 检查 Chrome CDP 端口是否可用
  if (await isChromePortAvailable()) {
    try {
      const browser = await puppeteer.connect({
        browserURL: 'http://127.0.0.1:9222',
        defaultViewport: null,
      });
      logger.info('成功连接到 Chrome 浏览器');
      return browser;
    } catch (err) {
      logger.warn(`连接到 Chrome 失败: ${err.message}`);
    }
  }

  // 未检测到 Chrome CDP 服务，提示用户手动启动
  const platform = os.platform();
  const commands = getChromeLaunchCommands();
  const cmd = commands[platform] || commands.linux;

  throw new Error(
    '未检测到 Chrome 远程调试服务。\n\n' +
    '请按以下步骤操作：\n' +
    '1. 关闭所有 Chrome 窗口\n' +
    '2. 在终端运行以下命令启动 Chrome（带远程调试）：\n\n' +
    `${cmd}\n\n` +
    '3. 启动后，在 Chrome 中访问 https://www.tianyancha.com 并登录\n' +
    '4. 登录完成后，重新运行此脚本\n\n' +
    '提示：如果需要指定其他 Chrome 路径，请修改上述命令中的路径。'
  );
}

/**
 * 在浏览器中打开新标签页
 */
export async function openNewPage(browser) {
  const page = await browser.newPage();
  page.setDefaultTimeout(30000);
  page.setDefaultNavigationTimeout(30000);
  return page;
}

/**
 * 安全等待 - 随机延迟避免触发平台安全机制
 */
export function delay(minMs = 2000, maxMs = 5000) {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise(resolve => setTimeout(resolve, ms));
}
