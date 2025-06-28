#!/bin/bash

echo "========================================"
echo "   QuickFinder GitHub 上传脚本"
echo "========================================"
echo

# 检查Git是否安装
if ! command -v git &> /dev/null; then
    echo "❌ Git未安装，请先安装Git"
    echo "macOS: brew install git"
    echo "Ubuntu: sudo apt-get install git"
    exit 1
fi

# 检查是否已经初始化Git
if [ ! -d ".git" ]; then
    echo "🚀 初始化Git仓库..."
    git init
    echo "✅ Git仓库初始化完成"
    echo
else
    echo "✅ Git仓库已存在"
    echo
fi

# 添加所有文件
echo "📁 添加项目文件到Git..."
git add .
echo "✅ 文件添加完成"
echo

# 创建提交
echo "💾 创建提交..."
git commit -m "🎉 QuickFinder智能书签管理扩展

✨ 功能特性:
- 支持14个AI提供商 (OpenAI, Google, Anthropic, 智谱AI等)
- 智能语义搜索和自然语言查询
- AI自动分类和书签整理
- 重复检测和智能清理
- 个性化推荐和遗忘发现
- 现代化UI设计和快捷键支持

🔧 技术栈:
- Manifest V3 Chrome Extension
- JavaScript ES6+
- AI Service Integration
- Modern CSS with Glassmorphism"

echo "✅ 提交创建完成"
echo

# 提示用户输入GitHub仓库地址
echo "📝 请输入您的GitHub仓库地址:"
echo "格式: https://github.com/您的用户名/仓库名.git"
read -p "仓库地址: " repo_url

# 验证输入
if [ -z "$repo_url" ]; then
    echo "❌ 仓库地址不能为空"
    exit 1
fi

# 添加远程仓库
echo "🔗 连接到GitHub仓库..."
git remote add origin "$repo_url" 2>/dev/null || git remote set-url origin "$repo_url"
echo "✅ 远程仓库连接完成"
echo

# 设置主分支
echo "🌿 设置主分支..."
git branch -M main
echo "✅ 主分支设置完成"
echo

# 推送到GitHub
echo "🚀 推送到GitHub..."
if git push -u origin main; then
    echo
    echo "========================================"
    echo "   🎉 上传成功！"
    echo "========================================"
    echo
    echo "✅ QuickFinder项目已成功上传到GitHub"
    echo "🔗 您可以访问: $repo_url"
    echo
    echo "📋 后续操作建议:"
    echo "- 在GitHub上添加项目描述和标签"
    echo "- 上传项目截图到README"
    echo "- 创建第一个Release版本"
    echo "- 邀请其他开发者协作"
    echo
else
    echo
    echo "========================================"
    echo "   ❌ 上传失败"
    echo "========================================"
    echo
    echo "可能的原因:"
    echo "- 仓库地址错误"
    echo "- 没有推送权限"
    echo "- 网络连接问题"
    echo "- 需要GitHub认证"
    echo
    echo "💡 解决方案:"
    echo "- 检查仓库地址是否正确"
    echo "- 确保已登录GitHub账户"
    echo "- 使用Personal Access Token作为密码"
    echo "- 运行: git config --global credential.helper store"
    echo
fi

echo "脚本执行完成"
