const fs = require('fs').promises;
const path = require('path');

// 基础URL前缀（用于拼接Marp幻灯片的在线访问链接）
const BASE_URL = 'https://xiaoxuan668.github.io/TAOYANZUHUI/';
const OUTPUT_PATH = './menu.md';
const SPLITE_LINES = 10; // 每隔多少行插入---分割线
const MD_TEMPLATE = `---
marp: true
lang: zh-CN
title: 目录
description: 目录
theme: uncover
transition: fade
paginate: true
_paginate: false
---
# 目录

---

`;

/**
 * 从Markdown文件的frontmatter区域提取title字段
 * @param {string} fileContent - Markdown文件的完整内容
 * @returns {string} 提取到的title（无title时返回空字符串）
 */
const extractTitleFromFrontmatter = (fileContent) => {
    // 匹配frontmatter区块（以---开头和结尾，支持内部换行）
    const frontmatterMatch = fileContent.match(/^---\s*([\s\S]*?)\s*---/m);
    if (!frontmatterMatch) return '';

    // 匹配title字段（支持前后空格、单/双引号包裹、不区分大小写）
    const titleRegex = /^\s*title\s*:\s*(['"]?)(.*?)\1\s*$/im;
    const titleMatch = frontmatterMatch[1].match(titleRegex);

    // 去除title内容前后的空格，无匹配时返回空字符串
    return titleMatch?.[2]?.trim() || '';
};

/**
 * 处理文件路径：转换分隔符、替换后缀、拼接基础URL
 * @param {string} relativePath - 文件相对于根目录的原始路径
 * @returns {string} 处理后的完整在线访问URL
 */
const processFilePath = (relativePath) => {
    // 1. 将Windows路径分隔符\转为URL标准分隔符/
    const normalizedPath = relativePath.replace(/\\/g, '/');
    // 2. 将.md后缀（不区分大小写）替换为.html（适配Marp编译后的在线页面）
    const htmlPath = normalizedPath.replace(/\.[mM][dD]$/, '.html');
    // 3. 拼接基础URL，避免重复/（处理BASE_URL末尾有/和无/的两种情况）
    const baseUrlNormalized = BASE_URL.replace(/\/$/, ''); // 移除BASE_URL末尾可能的/
    return `${baseUrlNormalized}/${htmlPath.replace(/^\//, '')}`; // 移除路径开头可能的/
};

/**
 * 递归遍历目录，筛选含"marp: true"的Markdown文件并构建目录树
 * @param {string} currentDir - 当前遍历的目录路径
 * @param {string} rootDir - 根目录路径（用于计算文件相对路径，默认与currentDir一致）
 * @returns {Promise<Object>} 目录树对象（isDir标识是否为目录，children存储子节点）
 */
const buildFileTree = async (currentDir, rootDir = currentDir) => {
    const treeNode = {
        isDir: true,
        children: {} // 子节点：key为文件名/目录名，value为节点对象
    };

    try {
        // 读取当前目录下的所有条目（文件/目录），并获取类型信息
        const entries = await fs.readdir(currentDir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(currentDir, entry.name);
            const relativePath = path.relative(rootDir, fullPath);

            if (entry.isDirectory()) {
                // 递归处理子目录，仅保留包含有效Marp文件的目录（过滤空目录）
                const subDirTree = await buildFileTree(fullPath, rootDir);
                if (Object.keys(subDirTree.children).length > 0) {
                    treeNode.children[entry.name] = subDirTree;
                }
            } else if (entry.isFile() && entry.name.endsWith('.md')) {
                // 处理Markdown文件：检查是否含"marp: true"，并提取title和处理路径
                try {
                    const fileContent = await fs.readFile(fullPath, 'utf8');
                    if (fileContent.includes('marp: true')) {
                        var title = extractTitleFromFrontmatter(fileContent) || '';
                        const fileName = path.basename(entry.name, '.md');
                        if (title === null || title === '') {
                            title = fileName; // 无title时使用文件名作为标题
                        }
                        const fileUrl = processFilePath(relativePath);

                        // 将文件信息存入目录树（isDir为false标识文件）
                        treeNode.children[entry.name] = {
                            isDir: false,
                            title,
                            url: fileUrl
                        };
                    }
                } catch (readErr) {
                    console.error(`⚠️  读取文件失败：${fullPath}，错误信息：${readErr.message}`);
                }
            }
        }
    } catch (dirErr) {
        console.error(`⚠️  访问目录失败：${currentDir}，错误信息：${dirErr.message}`);
    }

    return treeNode;
};

/**
 * 将目录树转换为Markdown列表格式（文件显示为链接，目录显示为名称）
 * @param {Object} tree - 目录树对象
 * @param {number} depth - 当前节点的层级（控制缩进，2个空格为1级，默认0）
 * @returns {string} Markdown格式的文件树字符串
 */
const treeToMarkdown = (tree, depth = 0) => {
    const indent = '  '.repeat(depth); // 按层级生成缩进
    const entries = Object.entries(tree.children);
    let markdownStr = '';

    entries.forEach(([name, node]) => {
        // 文件夹显示名称，文件显示为「[标题](URL)」格式的Markdown链接
        const displayContent = node.isDir
            ? name
            : `[${node.title}](${node.url})`;

        // 拼接当前层级的列表项
        markdownStr += `${indent}- ${displayContent}\n`;

        // 递归处理子目录（层级+1，缩进增加）
        if (node.isDir) {
            markdownStr += treeToMarkdown(node, depth + 1);
        }
    });


    // 2. 按行分割，过滤空行（避免空行影响计数）
    const validLines = markdownStr.split('\n').filter(line => line.trim() !== '');
    const processedLines = [];

    // 3. 每5行后插入---（最后一行后不插入）
    validLines.forEach((line, index) => {
        processedLines.push(line);
        // 判断：当前是第5/10/15...行（index从0开始，第5行对应index=4），且不是最后一行
        if ((index + 1) % SPLITE_LINES === 0 && index !== validLines.length - 1) {
            processedLines.push('---');
        }
    });

    // 4. 重新拼接成字符串返回
    return processedLines.join('\n') + '\n';;
};

const generateNowTimeMd = () => {
    // 生成当前时间 YYYY-MM-DD HH:mm:ss
    const now = new Date();
    const beijingTime = now.toLocaleString('zh-CN', {
        timeZone: 'Asia/Shanghai', // 指定时区
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false // 24小时制
    });
    var timeMD = `\n --- \n ### 生成时间 \n # ${beijingTime}`;
    return timeMD;
};

/**
 * 主函数：执行目录扫描、目录树构建、Markdown生成与保存
 */
const main = async () => {
    const rootDirectory = process.cwd(); // 以当前执行目录为根目录
    console.log(`📂 开始扫描目录：${rootDirectory}\n`);

    try {
        // 1. 构建包含有效Marp文件的目录树
        const marpFileTree = await buildFileTree(rootDirectory);
        // 2. 将目录树转换为Markdown格式
        var markdownResult = '';
        markdownResult += MD_TEMPLATE;
        markdownResult += treeToMarkdown(marpFileTree);
        markdownResult += generateNowTimeMd();

        // 3. 输出结果到控制台
        console.log('✅ 包含 "marp: true" 的Marp文件树（带在线访问链接）：');
        console.log(markdownResult);

        // 4. 保存结果到Markdown文件（路径：根目录/marp-file-tree.md）
        const outputFilePath = path.join(rootDirectory, OUTPUT_PATH);
        await fs.writeFile(outputFilePath, markdownResult, 'utf8');
        console.log(`📄 文件树已保存至：${outputFilePath}`);
    } catch (mainErr) {
        console.error(`❌ 执行失败，错误信息：${mainErr.message}`);
    }
};

// 启动主函数
main();