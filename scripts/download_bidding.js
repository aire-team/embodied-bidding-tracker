#!/usr/bin/env node
/**
 * 交互式企业招投标数据采集 (兼容模式)
 * 
 * ⚠️ 此脚本为兼容保留，新代码请直接使用 cli.js
 * 
 * 用法:
 *   node download_bidding.js [企业名称]
 * 
 * 推荐使用新 CLI:
 *   node cli.js query [企业名称]
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('ℹ️  正在使用新的 CLI 入口...\n');

const args = process.argv.slice(2);
const cliPath = path.join(__dirname, 'cli.js');

// 转换为新格式
const newArgs = ['query', ...args];

const child = spawn('node', [cliPath, ...newArgs], {
  stdio: 'inherit',
  cwd: __dirname
});

child.on('close', (code) => {
  process.exit(code);
});
