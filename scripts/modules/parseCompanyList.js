import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');

// 海外城市关键词 — 匹配到则跳过
const OVERSEAS_KEYWORDS = [
  '美国', '英国', '德国', '法国', '日本', '韩国', '挪威',
  '加州', '德州', '俄勒冈', '马萨诸塞', '宾州', '伦敦',
  '香港', '澳门', '台湾',
];

/**
 * 解析企业名单 MD 文件，提取企业列表
 * @param {string} [filePath] - 自定义 MD 文件路径，默认使用项目内 具身智能中游企业数据库.md
 * @returns {Array<{index, name, field, product, city, isOverseas, tianyanName, tianyanUrl}>}
 */
export function parseCompanyList(filePath) {
  const mdPath = filePath ? path.resolve(filePath) : path.join(projectRoot, 'assets', '具身智能中游企业数据库.md');
  
  if (!fs.existsSync(mdPath)) {
    logger.error(`文件不存在: ${mdPath}`);
    throw new Error('企业名单文件不存在');
  }

  const content = fs.readFileSync(mdPath, 'utf-8');
  const lines = content.split('\n');
  const companies = [];

  for (const line of lines) {
    // 跳过表头和分隔线
    if (!line.startsWith('|') || line.includes('索引') || line.includes('---')) continue;

    const cols = line.split('|').map(c => c.trim()).filter(c => c);
    if (cols.length < 5) continue;

    const [index, name, field, product, city, tianyanName = '', tianyanUrl = ''] = cols;
    const indexNum = parseInt(index);
    if (isNaN(indexNum)) continue;

    const isOverseas = OVERSEAS_KEYWORDS.some(kw => city.includes(kw));

    companies.push({
      index: indexNum,
      name: name.trim(),
      field: field.trim(),
      product: product.trim(),
      city: city.trim(),
      isOverseas,
      tianyanName: tianyanName.trim(),
      tianyanUrl: tianyanUrl.trim(),
    });
  }

  const domesticCount = companies.filter(c => !c.isOverseas).length;
  const overseasCount = companies.filter(c => c.isOverseas).length;
  const withTianyanInfo = companies.filter(c => c.tianyanName && c.tianyanUrl).length;
  
  logger.info(`解析企业名单完成: 共 ${companies.length} 家，国内 ${domesticCount} 家，海外/港澳台 ${overseasCount} 家(将跳过)，已补全天眼查信息 ${withTianyanInfo} 家`);
  
  return companies;
}

/**
 * 获取需要在天眼查搜索的企业列表（排除海外）
 */
export function getDomesticCompanies() {
  return parseCompanyList().filter(c => !c.isOverseas);
}

/**
 * 更新 MD 文件中的企业天眼查信息
 * @param {string} filePath - MD 文件路径
 * @param {Array<{index, tianyanName, tianyanUrl}>} updates - 要更新的企业信息
 */
export function updateCompanyList(filePath, updates) {
  const mdPath = filePath ? path.resolve(filePath) : path.join(projectRoot, 'assets', '具身智能中游企业数据库.md');
  
  if (!fs.existsSync(mdPath)) {
    throw new Error('企业名单文件不存在');
  }

  const content = fs.readFileSync(mdPath, 'utf-8');
  const lines = content.split('\n');
  
  // 创建更新映射
  const updateMap = new Map();
  for (const u of updates) {
    updateMap.set(u.index, { tianyanName: u.tianyanName, tianyanUrl: u.tianyanUrl });
  }

  const updatedLines = lines.map(line => {
    // 跳过表头和分隔线
    if (!line.startsWith('|') || line.includes('索引') || line.includes('---')) {
      return line;
    }

    const cols = line.split('|').map(c => c.trim());
    // 过滤空字符串后，重新处理
    const cleanCols = cols.filter(c => c);
    if (cleanCols.length < 5) return line;

    const index = parseInt(cleanCols[0]);
    if (isNaN(index) || !updateMap.has(index)) return line;

    const update = updateMap.get(index);
    // 重建行，保持7列格式
    const newCols = [
      cleanCols[0], // 索引
      cleanCols[1], // 企业名称
      cleanCols[2], // 所属领域
      cleanCols[3], // 产品名称
      cleanCols[4], // 城市
      update.tianyanName || cleanCols[5] || '',
      update.tianyanUrl || cleanCols[6] || '',
    ];

    return `| ${newCols.join(' | ')} |`;
  });

  fs.writeFileSync(mdPath, updatedLines.join('\n'), 'utf-8');
  logger.info(`已更新 MD 文件: ${updates.length} 家企业的天眼查信息`);
}
