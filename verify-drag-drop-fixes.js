// QuickFinder拖放修复验证脚本
// 在浏览器控制台中运行此脚本来验证修复是否正确应用

console.log('🔧 开始验证QuickFinder拖放修复...');

// 验证函数
function verifyDragDropFixes() {
    const results = {
        passed: 0,
        failed: 0,
        issues: []
    };

    // 检查1: 验证BookmarkManager类是否存在
    if (typeof window.bookmarkManager === 'undefined') {
        results.issues.push('❌ BookmarkManager实例不存在');
        results.failed++;
    } else {
        console.log('✅ BookmarkManager实例存在');
        results.passed++;
    }

    // 检查2: 验证关键修复函数是否存在
    const requiredMethods = [
        'handleDrop',
        'insertItemAtPosition', 
        'showDragInsertLine',
        'hideDragInsertLine',
        'validateDropOperation',
        'validateInsertInfo',
        'rollbackToOriginalPosition',
        'handleInvalidDrop',
        'showInvalidDropFeedback'
    ];

    requiredMethods.forEach(method => {
        if (window.bookmarkManager && typeof window.bookmarkManager[method] === 'function') {
            console.log(`✅ ${method} 方法存在`);
            results.passed++;
        } else {
            results.issues.push(`❌ ${method} 方法不存在或不是函数`);
            results.failed++;
        }
    });

    // 检查3: 验证拖拽插入线元素是否存在
    const insertLine = document.getElementById('drag-insert-line');
    if (insertLine) {
        console.log('✅ 拖拽插入线元素存在');
        results.passed++;
    } else {
        results.issues.push('❌ 拖拽插入线元素不存在');
        results.failed++;
    }

    // 检查4: 验证CSS样式是否正确
    const insertLineStyles = window.getComputedStyle(insertLine || document.createElement('div'));
    if (insertLine && insertLine.className.includes('drag-insert-line')) {
        console.log('✅ 拖拽插入线样式类正确');
        results.passed++;
    } else {
        results.issues.push('❌ 拖拽插入线样式类不正确');
        results.failed++;
    }

    // 检查5: 验证事件绑定
    const bookmarkItems = document.querySelectorAll('.bookmark-item');
    if (bookmarkItems.length > 0) {
        console.log(`✅ 找到 ${bookmarkItems.length} 个书签项目`);
        results.passed++;
        
        // 检查第一个项目的事件监听器
        const firstItem = bookmarkItems[0];
        const hasEvents = firstItem.draggable === true;
        if (hasEvents) {
            console.log('✅ 书签项目具有拖拽属性');
            results.passed++;
        } else {
            results.issues.push('❌ 书签项目缺少拖拽属性');
            results.failed++;
        }
    } else {
        results.issues.push('❌ 没有找到书签项目');
        results.failed++;
    }

    // 检查6: 验证容器事件绑定
    const container = document.getElementById('bookmark-container');
    if (container) {
        console.log('✅ 书签容器存在');
        results.passed++;
    } else {
        results.issues.push('❌ 书签容器不存在');
        results.failed++;
    }

    return results;
}

// 模拟拖放操作测试
function simulateDragDropTest() {
    console.log('\n🧪 开始模拟拖放测试...');
    
    const bookmarkItems = document.querySelectorAll('.bookmark-item');
    if (bookmarkItems.length < 2) {
        console.log('❌ 书签项目不足，无法进行拖放测试');
        return false;
    }

    const sourceItem = bookmarkItems[0];
    const targetItem = bookmarkItems[1];

    // 模拟dragstart事件
    const dragStartEvent = new DragEvent('dragstart', {
        bubbles: true,
        cancelable: true,
        dataTransfer: new DataTransfer()
    });

    // 模拟dragover事件
    const dragOverEvent = new DragEvent('dragover', {
        bubbles: true,
        cancelable: true,
        clientX: targetItem.getBoundingClientRect().left + 10, // 左侧区域
        clientY: targetItem.getBoundingClientRect().top + 10,
        dataTransfer: new DataTransfer()
    });

    // 模拟drop事件
    const dropEvent = new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        clientX: targetItem.getBoundingClientRect().left + 10,
        clientY: targetItem.getBoundingClientRect().top + 10,
        dataTransfer: new DataTransfer()
    });

    try {
        console.log('🎯 触发dragstart事件...');
        sourceItem.dispatchEvent(dragStartEvent);
        
        console.log('🎯 触发dragover事件...');
        targetItem.dispatchEvent(dragOverEvent);
        
        console.log('🎯 检查插入信息...');
        if (window.bookmarkManager.dragInsertInfo) {
            console.log('✅ 插入信息已设置:', window.bookmarkManager.dragInsertInfo);
        } else {
            console.log('❌ 插入信息未设置');
        }
        
        console.log('🎯 触发drop事件...');
        targetItem.dispatchEvent(dropEvent);
        
        return true;
    } catch (error) {
        console.error('❌ 模拟拖放测试失败:', error);
        return false;
    }
}

// 检查修复代码特征
function checkFixCodeSignatures() {
    console.log('\n🔍 检查修复代码特征...');
    
    const bookmarkManager = window.bookmarkManager;
    if (!bookmarkManager) {
        console.log('❌ 无法访问BookmarkManager实例');
        return false;
    }

    // 检查handleDrop函数是否包含修复代码
    const handleDropStr = bookmarkManager.handleDrop.toString();
    const hasValidation = handleDropStr.includes('validateDropOperation') && 
                         handleDropStr.includes('validateInsertInfo');
    const hasRollback = handleDropStr.includes('rollbackToOriginalPosition');
    const hasOriginalPosition = handleDropStr.includes('originalPosition');

    console.log('修复代码检查结果:');
    console.log(`✅ 包含验证逻辑: ${hasValidation}`);
    console.log(`✅ 包含回滚机制: ${hasRollback}`);
    console.log(`✅ 保存原始位置: ${hasOriginalPosition}`);

    // 检查showDragInsertLine函数是否包含精确区域检测
    const showInsertLineStr = bookmarkManager.showDragInsertLine.toString();
    const hasPreciseDetection = showInsertLineStr.includes('leftZoneWidth') && 
                               showInsertLineStr.includes('rightZoneWidth') &&
                               showInsertLineStr.includes('isValidDropZone');

    console.log(`✅ 包含精确区域检测: ${hasPreciseDetection}`);

    return hasValidation && hasRollback && hasOriginalPosition && hasPreciseDetection;
}

// 生成测试报告
function generateTestReport() {
    console.log('\n📊 生成测试报告...');
    
    const verificationResults = verifyDragDropFixes();
    const codeSignatureCheck = checkFixCodeSignatures();
    const simulationResult = simulateDragDropTest();

    const report = {
        timestamp: new Date().toISOString(),
        verification: verificationResults,
        codeSignatures: codeSignatureCheck,
        simulation: simulationResult,
        overall: 'unknown'
    };

    // 计算总体结果
    const totalTests = verificationResults.passed + verificationResults.failed;
    const passRate = totalTests > 0 ? (verificationResults.passed / totalTests) * 100 : 0;

    if (passRate >= 90 && codeSignatureCheck && simulationResult) {
        report.overall = 'excellent';
        console.log('🎉 总体评估: 优秀 - 所有修复都已正确应用');
    } else if (passRate >= 70 && codeSignatureCheck) {
        report.overall = 'good';
        console.log('✅ 总体评估: 良好 - 大部分修复已应用');
    } else if (passRate >= 50) {
        report.overall = 'fair';
        console.log('⚠️ 总体评估: 一般 - 部分修复已应用');
    } else {
        report.overall = 'poor';
        console.log('❌ 总体评估: 差 - 修复未正确应用');
    }

    console.log('\n📋 详细报告:');
    console.log(`通过测试: ${verificationResults.passed}`);
    console.log(`失败测试: ${verificationResults.failed}`);
    console.log(`通过率: ${passRate.toFixed(1)}%`);
    
    if (verificationResults.issues.length > 0) {
        console.log('\n❌ 发现的问题:');
        verificationResults.issues.forEach(issue => console.log(`  ${issue}`));
    }

    return report;
}

// 提供修复建议
function provideFixes() {
    console.log('\n🔧 修复建议:');
    console.log('1. 确保页面已完全加载');
    console.log('2. 刷新页面以加载最新的修复代码');
    console.log('3. 检查浏览器控制台是否有JavaScript错误');
    console.log('4. 验证bookmarks.js文件是否包含最新的修复代码');
    console.log('5. 确保拖放事件正确绑定到书签项目');
    
    console.log('\n🧪 手动测试步骤:');
    console.log('1. 将第1个书签拖到第3个书签的右侧30%区域');
    console.log('2. 观察是否显示绿色插入线');
    console.log('3. 释放鼠标，检查书签是否移动到正确位置');
    console.log('4. 尝试拖动到中间40%区域，应该显示失败提示');
    console.log('5. 检查浏览器控制台的详细日志');
}

// 执行完整验证
function runFullVerification() {
    console.log('🚀 开始完整的拖放修复验证...');
    console.log('='.repeat(50));
    
    const report = generateTestReport();
    
    console.log('\n' + '='.repeat(50));
    console.log('🏁 验证完成');
    
    if (report.overall === 'poor' || report.overall === 'fair') {
        provideFixes();
    }
    
    return report;
}

// 自动运行验证
runFullVerification();
