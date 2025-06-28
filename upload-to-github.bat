@echo off
echo ========================================
echo    QuickFinder GitHub 上传脚本
echo ========================================
echo.

REM 检查是否已经初始化Git
if not exist .git (
    echo 🚀 初始化Git仓库...
    git init
    echo ✅ Git仓库初始化完成
    echo.
) else (
    echo ✅ Git仓库已存在
    echo.
)

REM 添加所有文件
echo 📁 添加项目文件到Git...
git add .
echo ✅ 文件添加完成
echo.

REM 创建提交
echo 💾 创建提交...
git commit -m "🎉 QuickFinder智能书签管理扩展 - 支持14个AI提供商的智能搜索工具"
echo ✅ 提交创建完成
echo.

REM 提示用户输入GitHub仓库地址
echo 📝 请输入您的GitHub仓库地址:
echo 格式: https://github.com/您的用户名/仓库名.git
set /p repo_url="仓库地址: "

REM 添加远程仓库
echo 🔗 连接到GitHub仓库...
git remote add origin %repo_url%
echo ✅ 远程仓库连接完成
echo.

REM 设置主分支
echo 🌿 设置主分支...
git branch -M main
echo ✅ 主分支设置完成
echo.

REM 推送到GitHub
echo 🚀 推送到GitHub...
git push -u origin main
echo.

if %errorlevel% equ 0 (
    echo ========================================
    echo    🎉 上传成功！
    echo ========================================
    echo.
    echo ✅ QuickFinder项目已成功上传到GitHub
    echo 🔗 您可以访问: %repo_url%
    echo.
    echo 📋 后续操作建议:
    echo - 在GitHub上添加项目描述和标签
    echo - 上传项目截图到README
    echo - 创建第一个Release版本
    echo - 邀请其他开发者协作
    echo.
) else (
    echo ========================================
    echo    ❌ 上传失败
    echo ========================================
    echo.
    echo 可能的原因:
    echo - 仓库地址错误
    echo - 没有推送权限
    echo - 网络连接问题
    echo - 需要GitHub认证
    echo.
    echo 💡 解决方案:
    echo - 检查仓库地址是否正确
    echo - 确保已登录GitHub账户
    echo - 使用Personal Access Token作为密码
    echo.
)

echo 按任意键退出...
pause >nul
