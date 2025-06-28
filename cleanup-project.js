#!/usr/bin/env node

/**
 * QuickFinder 项目清理脚本
 * 清理调试输出、测试文件和不必要的文档
 */

const fs = require('fs');
const path = require('path');

// 需要删除的测试和调试文件
const filesToDelete = [
    'debug-search-issue.html',
    'test-search-fixes.html', 
    'test-adv-fix.html',
    'test-final-fix.html',
    'test-bug-fixes.html',
    'test-pinyin-search.html',
    'cleanup-project.js', // 删除自己
    
    // 临时文档文件
    'REFACTOR_SUMMARY.md',
    'SPECIAL_PAGES_ANALYSIS.md', 
    'EDGE_COMPATIBILITY_FIX.md',
    'AI_CONNECTION_FIX_REPORT.md',
    'AI_CONNECTION_TROUBLESHOOTING.md',
    'AI_OPTIMIZATION_README.md',
    'AI_REFACTOR_IMPLEMENTATION.md',
    'GEMINI_API_UPDATE.md',
    'GITHUB_UPLOAD_GUIDE.md',
    'PRELOAD_IMPLEMENTATION.md',
    'PROJECT_STRUCTURE.md',
    'URL_NAVIGATION_FEATURE.md',
    'AI-Settings-Complete-Guide.md',
    'KEYBOARD_SHORTCUT_UNIFICATION.md'
];

// 需要清理console输出的文件
const filesToCleanConsole = [
    'background.js',
    'content.js', 
    'ai-service.js',
    'ai-worker.js',
    'ai-recommendation-service.js',
    'options.js',
    'popup.js',
    'bookmarks.js',
    'sidepanel.js'
];

// 删除文件
function deleteFiles() {
    console.log('🗑️  开始删除测试和调试文件...');
    
    let deletedCount = 0;
    filesToDelete.forEach(file => {
        if (fs.existsSync(file)) {
            try {
                fs.unlinkSync(file);
                console.log(`✅ 已删除: ${file}`);
                deletedCount++;
            } catch (error) {
                console.error(`❌ 删除失败 ${file}:`, error.message);
            }
        }
    });
    
    console.log(`📊 共删除 ${deletedCount} 个文件\n`);
}

// 清理console输出
function cleanConsoleOutputs() {
    console.log('🧹 开始清理console调试输出...');
    
    let cleanedCount = 0;
    filesToCleanConsole.forEach(file => {
        if (fs.existsSync(file)) {
            try {
                let content = fs.readFileSync(file, 'utf8');
                const originalLength = content.length;
                
                // 移除console.log, console.warn, console.error等
                content = content.replace(/\s*console\.(log|warn|error|info|debug)\([^)]*\);?\s*/g, '');
                
                // 移除多余的空行
                content = content.replace(/\n\s*\n\s*\n/g, '\n\n');
                
                // 移除注释中的调试信息
                content = content.replace(/\/\/ 🔍.*\n/g, '');
                content = content.replace(/\/\/ ✅.*\n/g, '');
                content = content.replace(/\/\/ ❌.*\n/g, '');
                content = content.replace(/\/\/ 📊.*\n/g, '');
                content = content.replace(/\/\/ 🚀.*\n/g, '');
                
                if (content.length !== originalLength) {
                    fs.writeFileSync(file, content, 'utf8');
                    console.log(`✅ 已清理: ${file} (减少 ${originalLength - content.length} 字符)`);
                    cleanedCount++;
                } else {
                    console.log(`⏭️  跳过: ${file} (无需清理)`);
                }
            } catch (error) {
                console.error(`❌ 清理失败 ${file}:`, error.message);
            }
        }
    });
    
    console.log(`📊 共清理 ${cleanedCount} 个文件\n`);
}

// 更新.gitignore
function updateGitignore() {
    console.log('📝 更新.gitignore...');
    
    const gitignoreAdditions = `
# Test and debug files
test-*.html
debug-*.html
*-test.html
*-debug.html
cleanup-project.js

# Temporary documentation
*_ANALYSIS.md
*_FIX_REPORT.md
*_TROUBLESHOOTING.md
*_OPTIMIZATION_README.md
*_REFACTOR_IMPLEMENTATION.md
*_UPDATE.md
*_GUIDE.md
*_IMPLEMENTATION.md
*_STRUCTURE.md
*_FEATURE.md
*-Complete-Guide.md
*_UNIFICATION.md
REFACTOR_SUMMARY.md
`;

    try {
        if (fs.existsSync('.gitignore')) {
            const currentContent = fs.readFileSync('.gitignore', 'utf8');
            if (!currentContent.includes('# Test and debug files')) {
                fs.appendFileSync('.gitignore', gitignoreAdditions);
                console.log('✅ 已更新.gitignore');
            } else {
                console.log('⏭️  .gitignore已包含相关规则');
            }
        }
    } catch (error) {
        console.error('❌ 更新.gitignore失败:', error.message);
    }
}

// 生成清理报告
function generateCleanupReport() {
    const report = `# QuickFinder 项目清理报告

## 🧹 清理完成

### 已删除的文件
${filesToDelete.map(f => `- ${f}`).join('\n')}

### 已清理console输出的文件  
${filesToCleanConsole.map(f => `- ${f}`).join('\n')}

## 📦 生产环境准备

项目现在已经清理完毕，可以用于生产环境：

1. ✅ 移除了所有测试和调试文件
2. ✅ 清理了console调试输出
3. ✅ 更新了.gitignore规则
4. ✅ 保留了核心功能文件

## 🚀 下一步

1. 测试扩展功能是否正常
2. 打包扩展程序
3. 上传到Chrome Web Store

---
*清理时间: ${new Date().toLocaleString()}*
`;

    fs.writeFileSync('CLEANUP_REPORT.md', report);
    console.log('📋 已生成清理报告: CLEANUP_REPORT.md');
}

// 主函数
function main() {
    console.log('🚀 QuickFinder 项目清理开始...\n');
    
    deleteFiles();
    cleanConsoleOutputs();
    updateGitignore();
    generateCleanupReport();
    
    console.log('🎉 项目清理完成！');
    console.log('📦 项目现在已准备好用于生产环境');
}

// 运行清理
if (require.main === module) {
    main();
}

module.exports = { main };
