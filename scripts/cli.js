#!/usr/bin/env node
/**
 * embodied-bidding-tracker 统一 CLI 入口
 * 
 * 按照 Agent Skill 标准设计的命令行工具
 * 
 * 用法:
 *   node cli.js <command> [options]
 * 
 * 命令:
 *   search    搜索企业并确认天眼查信息
 *   download  下载招投标记录
 *   query     交互式查询单企业
 *   status    检查环境状态
 * 
 * 示例:
 *   node cli.js search
 *   node cli.js download --start-date 2026-01-01 --end-date 2026-03-31
 *   node cli.js query "宇树科技"
 *   node cli.js status
 */
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import readline from 'readline';

import { 
  PATHS, 
  BROWSER_CONFIG, 
  DateUtils, 
  EnvCheck, 
  CSV_HEADERS 
} from './config.js';
import { logger } from './utils/logger.js';
import { connectBrowser, openNewPage } from './browser.js';
import { parseCompanyList, updateCompanyList } from './modules/parseCompanyList.js';
import { searchCompanyOnTianyancha } from './modules/companySearch.js';
import { downloadBiddingRecords } from './modules/biddingDownload.js';
import { readCsv, writeCsv } from './utils/excel.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ==================== 帮助信息 ====================
const HELP_TEXT = `
embodied-bidding-tracker - 具身智能行业招投标数据查询工具

用法: node cli.js <command> [options]

命令:
  search [options]     搜索企业并确认天眼查信息
  download [options]   下载招投标记录
  query [name]         交互式查询单企业招投标
  status               检查环境状态
  help                 显示帮助信息

Options for search:
  --company-file <path>   自定义企业名单文件 (默认: assets/具身智能中游企业数据库.md)

Options for download:
  --start-date <date>     开始日期 (YYYY-MM-DD, 默认: 本季度第一天)
  --end-date <date>       结束日期 (YYYY-MM-DD, 默认: 今天)
  --min-amount <num>      最低金额门槛 (万元, 默认: 0)
  --company-file <path>   自定义企业名单文件

Options for query:
  --start-date <date>     开始日期
  --end-date <date>       结束日期
  --min-amount <num>      最低金额门槛

示例:
  node cli.js search
  node cli.js download --start-date 2026-01-01 --end-date 2026-03-31 --min-amount 100
  node cli.js query "宇树科技"
  node cli.js status
`;

// ==================== 参数解析 ====================
function parseArgs(args) {
  const result = {
    command: '',
    options: {},
    positional: [],
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg.startsWith('--')) {
      const key = arg.slice(2).replace(/-/g, '_');
      const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true;
      result.options[key] = value;
    } else if (!result.command) {
      result.command = arg;
    } else {
      result.positional.push(arg);
    }
  }
  
  return result;
}

// ==================== 交互式输入 ====================
function askQuestion(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// ==================== 命令: status ====================
async function cmdStatus() {
  logger.info('=== 环境状态检查 ===\n');
  
  // Node.js 版本
  try {
    const { version } = EnvCheck.checkNodeVersion();
    logger.info(`✅ Node.js: ${version}`);
  } catch (err) {
    logger.error(`❌ Node.js: ${err.message}`);
    return;
  }
  
  // 操作系统
  const platform = EnvCheck.getPlatform();
  logger.info(`✅ 操作系统: ${platform.platform}`);
  
  // Chrome 远程调试
  try {
    const response = await fetch(`http://127.0.0.1:${BROWSER_CONFIG.debugPort}/json/version`);
    if (response.ok) {
      const data = await response.json();
      logger.info(`✅ Chrome 远程调试: 已连接 (端口 ${BROWSER_CONFIG.debugPort})`);
      logger.info(`   浏览器: ${data.Browser || 'Unknown'}`);
    }
  } catch {
    logger.warn(`⚠️  Chrome 远程调试: 未连接 (端口 ${BROWSER_CONFIG.debugPort})`);
    logger.info(`\n请手动启动 Chrome:`);
    logger.info(EnvCheck.getChromeLaunchCommand());
    logger.info(`\n启动后访问 https://www.tianyancha.com 完成登录`);
  }
  
  // npm 依赖
  const nodeModulesPath = path.join(PATHS.scriptsDir, 'node_modules');
  if (fs.existsSync(nodeModulesPath)) {
    logger.info(`✅ npm 依赖: 已安装`);
  } else {
    logger.warn(`⚠️  npm 依赖: 未安装`);
    logger.info(`   请运行: cd scripts && npm install`);
  }
  
  // 企业数据库
  try {
    const companies = parseCompanyList();
    const domestic = companies.filter(c => !c.isOverseas);
    const withTianyan = domestic.filter(c => c.tianyanName && c.tianyanUrl);
    logger.info(`✅ 企业数据库: ${companies.length} 家`);
    logger.info(`   国内企业: ${domestic.length} 家`);
    logger.info(`   已补全天眼查信息: ${withTianyan.length} 家`);
  } catch (err) {
    logger.warn(`⚠️  企业数据库: ${err.message}`);
  }
  
  logger.info('\n=== 检查完成 ===');
}

// ==================== 命令: search ====================
async function cmdSearch(options) {
  logger.info('=== Step 1: 企业搜索确认 ===\n');
  
  const companyFile = options.company_file || PATHS.defaultCompanyList;
  
  // 解析企业名单
  logger.info(`加载企业名单: ${companyFile}`);
  const allCompanies = parseCompanyList(companyFile);
  const domesticCompanies = allCompanies.filter(c => !c.isOverseas);
  const overseasCompanies = allCompanies.filter(c => c.isOverseas);
  
  logger.info(`共 ${allCompanies.length} 家企业:`);
  logger.info(`  国内企业: ${domesticCompanies.length} 家`);
  logger.info(`  海外/港澳台: ${overseasCompanies.length} 家 (将跳过)\n`);
  
  // 连接浏览器
  const browser = await connectBrowser();
  
  const results = [];
  let searchedCount = 0;
  let confirmedCount = 0;
  let notFoundCount = 0;
  
  for (const company of domesticCompanies) {
    // 如果已有天眼查信息，直接使用
    if (company.tianyanName && company.tianyanUrl) {
      results.push({
        index: company.index,
        shortName: company.name,
        fullName: company.tianyanName,
        companyId: company.tianyanUrl.match(/\/company\/(\d+)/)?.[1] || '',
        url: company.tianyanUrl,
        field: company.field,
        product: company.product,
        city: company.city,
        status: '已确认',
      });
      confirmedCount++;
      continue;
    }
    
    const page = await openNewPage(browser);
    
    try {
      logger.info(`[${searchedCount + 1}/${domesticCompanies.length}] 搜索: ${company.name}`);
      
      const searchResult = await searchCompanyOnTianyancha(page, company.name);
      
      results.push({
        index: company.index,
        shortName: company.name,
        fullName: searchResult.fullName,
        companyId: searchResult.url?.match(/\/company\/(\d+)/)?.[1] || '',
        url: searchResult.url,
        field: company.field,
        product: company.product,
        city: company.city,
        status: searchResult.status,
      });
      
      if (searchResult.status === '已确认') {
        confirmedCount++;
        logger.info(`  ✅ ${company.name} → ${searchResult.fullName}`);
      } else {
        notFoundCount++;
        logger.warn(`  ⚠️ ${company.name}: ${searchResult.status}`);
      }
      
      searchedCount++;
      
      // 每10家保存一次
      if (searchedCount % 10 === 0) {
        await writeCsv(
          path.join(PATHS.dataDir, 'company_list.csv'),
          CSV_HEADERS.companyList,
          results
        );
        logger.info(`  💾 已保存中间结果\n`);
      }
      
      await page.close().catch(() => {});
      await delay(3000, 6000);
    } catch (err) {
      logger.error(`  ❌ ${company.name}: ${err.message}`);
      results.push({
        index: company.index,
        shortName: company.name,
        fullName: '',
        companyId: '',
        url: '',
        field: company.field,
        product: company.product,
        city: company.city,
        status: `失败: ${err.message}`,
      });
      await page.close().catch(() => {});
    }
  }
  
  // 添加海外企业
  for (const company of overseasCompanies) {
    results.push({
      index: company.index,
      shortName: company.name,
      fullName: '',
      companyId: '',
      url: '',
      field: company.field,
      product: company.product,
      city: company.city,
      status: '海外企业-跳过',
    });
  }
  
  // 保存最终结果
  results.sort((a, b) => a.index - b.index);
  await writeCsv(
    path.join(PATHS.dataDir, 'company_list.csv'),
    CSV_HEADERS.companyList,
    results
  );
  
  // 统计
  logger.info('\n=== 搜索完成 ===');
  logger.info(`已确认: ${confirmedCount} 家`);
  logger.info(`未找到: ${notFoundCount} 家`);
  logger.info(`海外跳过: ${overseasCompanies.length} 家`);
  logger.info(`输出文件: ${path.join('data', 'company_list.csv')}`);
}

// ==================== 命令: download ====================
async function cmdDownload(options) {
  // 日期参数
  let startDate = options.start_date;
  let endDate = options.end_date;
  
  if (!startDate || !endDate) {
    const quarterRange = DateUtils.getQuarterRange();
    startDate = startDate || quarterRange.startDate;
    endDate = endDate || quarterRange.endDate;
  }
  
  const minAmount = parseInt(options.min_amount) || 0;
  
  logger.info('=== Step 2: 招投标记录下载 ===\n');
  logger.info(`时间范围: ${startDate} 至 ${endDate}`);
  logger.info(`金额门槛: ${minAmount === 0 ? '无门槛' : minAmount + '万元'}\n`);
  
  // 读取企业列表
  const companyListPath = path.join(PATHS.dataDir, 'company_list.csv');
  if (!fs.existsSync(companyListPath)) {
    logger.error('未找到企业列表，请先运行: node cli.js search');
    return;
  }
  
  const companies = readCsv(companyListPath);
  const validCompanies = companies.filter(c => 
    c['搜索状态'] === '已确认' && c['天眼查链接']
  );
  
  logger.info(`共 ${validCompanies.length} 家企业需要查询\n`);
  
  // 连接浏览器
  const browser = await connectBrowser();
  
  const allRecords = [];
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < validCompanies.length; i++) {
    const company = validCompanies[i];
    const companyName = company['企业全称(天眼查)'];
    const companyUrl = company['天眼查链接'];
    
    logger.info(`[${i + 1}/${validCompanies.length}] ${companyName}`);
    
    const page = await openNewPage(browser);
    
    try {
      const records = await downloadBiddingRecords(page, companyUrl, companyName, {
        startDate,
        endDate,
        minAmount,
      });
      
      if (records.length > 0) {
        allRecords.push(...records);
        successCount++;
        logger.info(`  ✅ 找到 ${records.length} 条记录`);
      } else {
        logger.info(`  ⚪ 无符合条件的记录`);
      }
      
      await page.close().catch(() => {});
      
      // 每3家保存一次
      if ((i + 1) % 3 === 0 && allRecords.length > 0) {
        await writeCsv(
          path.join(PATHS.dataDir, 'bidding_records.csv'),
          CSV_HEADERS.biddingRecords,
          allRecords
        );
        logger.info(`  💾 已保存中间结果\n`);
      } else {
        logger.info('');
      }
      
      await delay(3000, 6000);
    } catch (err) {
      failCount++;
      logger.error(`  ❌ 失败: ${err.message}\n`);
      await page.close().catch(() => {});
    }
  }
  
  // 保存最终结果
  if (allRecords.length > 0) {
    await writeCsv(
      path.join(PATHS.dataDir, 'bidding_records.csv'),
      CSV_HEADERS.biddingRecords,
      allRecords
    );
  }
  
  // 统计
  logger.info('=== 下载完成 ===');
  logger.info(`有记录企业: ${successCount} / ${validCompanies.length} 家`);
  logger.info(`总记录数: ${allRecords.length} 条`);
  logger.info(`失败: ${failCount} 家`);
  logger.info(`输出文件: ${path.join('data', 'bidding_records.csv')}`);
}

// ==================== 命令: query ====================
async function cmdQuery(options, positional) {
  // 获取企业名称
  let companyName = positional[0];
  if (!companyName) {
    companyName = await askQuestion('请输入企业名称: ');
  }
  
  if (!companyName) {
    logger.error('未输入企业名称');
    return;
  }
  
  // 模糊查找
  const companies = parseCompanyList();
  const matches = companies.filter(c => 
    !c.isOverseas && (
      c.name.toLowerCase().includes(companyName.toLowerCase()) ||
      (c.tianyanName && c.tianyanName.toLowerCase().includes(companyName.toLowerCase()))
    )
  );
  
  if (matches.length === 0) {
    logger.error(`未找到与 "${companyName}" 匹配的企业`);
    return;
  }
  
  let selected;
  if (matches.length === 1) {
    selected = matches[0];
    logger.info(`\n找到企业: ${selected.name}`);
    logger.info(`全称: ${selected.tianyanName || '未补全'}`);
  } else {
    logger.info(`\n找到 ${matches.length} 个匹配:`);
    matches.slice(0, 10).forEach((m, i) => {
      logger.info(`[${i + 1}] ${m.name} (${m.city})`);
    });
    
    const answer = await askQuestion('\n请选择序号: ');
    const idx = parseInt(answer) - 1;
    if (idx < 0 || idx >= Math.min(matches.length, 10)) {
      logger.info('已取消');
      return;
    }
    selected = matches[idx];
  }
  
  if (!selected.tianyanName || !selected.tianyanUrl) {
    logger.error('该企业没有天眼查信息，请先运行 search 命令');
    return;
  }
  
  // 日期参数
  let startDate = options.start_date;
  let endDate = options.end_date;
  
  if (!startDate || !endDate) {
    const quarterRange = DateUtils.getQuarterRange();
    startDate = startDate || quarterRange.startDate;
    endDate = endDate || quarterRange.endDate;
  }
  
  const minAmount = parseInt(options.min_amount) || 0;
  
  logger.info(`\n开始采集: ${selected.tianyanName}`);
  logger.info(`时间范围: ${startDate} 至 ${endDate}`);
  logger.info(`金额门槛: ${minAmount === 0 ? '无门槛' : minAmount + '万元'}\n`);
  
  // 连接浏览器并采集
  const browser = await connectBrowser();
  const page = await openNewPage(browser);
  
  try {
    const records = await downloadBiddingRecords(page, selected.tianyanUrl, selected.tianyanName, {
      startDate,
      endDate,
      minAmount,
    });
    
    if (records.length === 0) {
      logger.info('未找到符合条件的记录');
    } else {
      logger.info(`\n找到 ${records.length} 条记录:\n`);
      
      // 显示前5条
      records.slice(0, 5).forEach((r, i) => {
        logger.info(`[${i + 1}] ${r.title}`);
        logger.info(`    日期: ${r.date} | 金额: ${r.amount || '未披露'}`);
        logger.info(`    采购人: ${r.buyer || '未知'}\n`);
      });
      
      // 保存结果
      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = `bidding_${selected.name}_${timestamp}.csv`;
      const filepath = path.join(PATHS.dataDir, filename);
      
      await writeCsv(filepath, CSV_HEADERS.biddingRecords, records);
      logger.info(`✅ 结果已保存: ${filepath}`);
    }
  } catch (err) {
    logger.error(`采集失败: ${err.message}`);
  } finally {
    await page.close().catch(() => {});
  }
}

// ==================== 主函数 ====================
async function main() {
  const args = process.argv.slice(2);
  const { command, options, positional } = parseArgs(args);
  
  if (!command || command === 'help' || options.help) {
    console.log(HELP_TEXT);
    return;
  }
  
  try {
    switch (command) {
      case 'status':
        await cmdStatus();
        break;
      case 'search':
        await cmdSearch(options);
        break;
      case 'download':
        await cmdDownload(options);
        break;
      case 'query':
        await cmdQuery(options, positional);
        break;
      default:
        logger.error(`未知命令: ${command}`);
        console.log(HELP_TEXT);
        process.exit(1);
    }
  } catch (err) {
    logger.error(`\n执行失败: ${err.message}`);
    process.exit(1);
  }
}

main();

// Helper function
function delay(min, max) {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, ms));
}
