#!/usr/bin/env node
/**
 * Step 2: 招投标记录下载 (兼容模式)
 * 
 * ⚠️ 此脚本为兼容保留，新代码请直接使用 cli.js
 * 
 * 用法:
 *   npm run step2
 *   node step2_download_bidding.js [-- --start-date <date> --end-date <date> --min-amount <num>]
 * 
 * 推荐使用新 CLI:
 *   node cli.js download [--start-date <date> --end-date <date> --min-amount <num>]
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('ℹ️  Step 2 正在使用新的 CLI 入口...\n');

const args = process.argv.slice(2);
const cliPath = path.join(__dirname, 'cli.js');

// 转换旧参数为新格式
const newArgs = ['download'];

// 参数映射
const argMap = {
  '--start-date': '--start-date',
  '--end-date': '--end-date',
  '--min-amount': '--min-amount',
};

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  const mapped = argMap[arg];
  
  if (mapped && args[i + 1] && !args[i + 1].startsWith('--')) {
    newArgs.push(mapped, args[i + 1]);
    i++;
  }
}

const child = spawn('node', [cliPath, ...newArgs], {
  stdio: 'inherit',
  cwd: __dirname
});

child.on('close', (code) => {
  process.exit(code);
});
