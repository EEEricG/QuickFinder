
# 🔍 QuickFinder - 智能书签管理扩展

[![Chrome Web Store](https://img.shields.io/badge/Chrome-Extension-blue?logo=google-chrome)](https://chrome.google.com/webstore)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-2.0.0-green.svg)](https://github.com/yourusername/quickfinder)
[![AI Powered](https://img.shields.io/badge/AI-Powered-purple.svg)](https://github.com/yourusername/quickfinder)

一款功能强大的Chrome浏览器扩展，集成了14个主流AI提供商，为用户提供智能书签管理和搜索体验。通过AI增强的搜索、自动分类和个性化推荐，让书签管理变得前所未有的智能和高效。

![QuickFinder Demo](icons/icon128.png)

## 🌟 核心亮点

- 🚀 **一键快速搜索** - `Ctrl+Q` 快速调用（所有平台统一）
- 🤖 **14个AI提供商** - OpenAI、Google、Anthropic、智谱AI等
- 🧠 **智能语义搜索** - 支持自然语言查询
- 📂 **AI自动分类** - 智能整理书签结构
- 🔍 **重复检测** - AI识别并清理重复书签
- 💡 **个性化推荐** - 基于行为模式的智能建议
- 🎯 **遗忘发现** - 挖掘长期未访问的价值内容

## 功能特点

### 🔍 核心搜索功能
- **快速访问**：在所有平台（Windows、Linux、macOS）下，按 `Ctrl+Q` 即可打开搜索浮层。
- **统一搜索**：在同一界面中搜索书签和浏览历史记录。
- **模糊匹配**：即使输入部分内容或近似文本，也能找到结果。
- **毛玻璃用户界面**：拥有带有模糊背景效果的精美浮层。
- **键盘导航**：使用箭头键浏览结果，按回车键选择，按Esc键关闭。
- **新标签页打开**：所有URL链接都在新标签页打开，不会覆盖当前页面。
- **文件夹导航**：支持点击书签文件夹进入查看内容，带有面包屑导航。
- **多种显示模式**：支持最近历史、最常访问和书签三种显示模式。

### 🤖 AI智能功能
- **智能搜索**：支持自然语言查询，如"找我上周保存的React教程"
- **自动分类**：AI分析书签内容，自动建议分类和文件夹结构
- **内容摘要**：为书签生成智能摘要和关键信息提取
- **个性化推荐**：基于浏览模式推荐相关书签和内容
- **遗忘发现**：主动发现长期未访问但有价值的书签
- **兴趣分析**：分析用户兴趣模式和行为趋势
- **智能清理**：检测重复和相似书签，建议清理方案
- **多AI支持**：支持OpenAI、DeepSeek、Anthropic等多种AI提供商

### ⚙️ 系统功能
- **自定义设置**：可自定义快捷键和其他个人偏好设置。
- **跨浏览器支持**：同时兼容Chrome和Edge浏览器。
- **隐私保护**：所有AI处理在本地进行，用户完全控制数据。

## 安装方法
### 开发环境安装
1. 克隆或下载本存储库。
2. 打开Chrome或Edge浏览器，进入扩展程序页面：
    - Chrome：`chrome://extensions/`
    - Edge：`edge://extensions/`
3. 启用 “开发者模式”。
4. 点击 “加载解压缩的扩展程序”，然后选择扩展程序目录。
5. 此时，扩展程序应已安装完毕并可使用。

### 使用方法

#### 基础搜索
1. 在任意网页上按 `Ctrl+Q`（所有平台统一快捷键）。
2. 输入内容，搜索你的书签和历史记录。
3. 使用箭头键浏览结果。
4. 按回车键打开所选结果。
5. 按Esc键关闭搜索浮层。

#### AI功能配置
1. 右键点击扩展图标，选择"选项"。
2. 选择AI提供商（OpenAI/DeepSeek/Anthropic）。
3. 输入API密钥并测试连接。
4. 选择要启用的AI功能。
5. 保存设置。

#### AI智能搜索
1. 打开搜索界面（`Ctrl+Q`，所有平台统一）。
2. 使用自然语言描述，如"找我关于React的教程"。
3. AI会自动识别并提供智能搜索结果。

#### AI建议和整理
1. 在搜索界面点击"✨ AI建议"标签。
2. 浏览智能推荐、遗忘宝藏、兴趣分析。
3. 点击"📂 智能整理"使用自动分类和清理功能。

## 文件结构
```
quickFinder/
├── manifest.json          # 扩展程序配置文件
├── background.js          # 用于处理快捷键的服务工作线程（已集成AI支持）
├── content.js            # 用于注入浮层的内容脚本（已增强AI界面）
├── content.css           # 搜索浮层的样式表（已添加AI样式）
├── ai-service.js         # AI服务核心类（多提供商支持）
├── options.html          # AI设置页面
├── options.js            # 设置页面逻辑
├── popup.html            # 扩展程序弹出窗口（可选）
├── popup.js              # 弹出窗口功能脚本
├── icons/                # 扩展程序图标
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
├── README.md             # 本文件
├── AI_FEATURES_IMPLEMENTATION.md  # AI功能实现详细文档
└── AI_USAGE_GUIDE.md     # AI功能使用指南
```

## 技术细节
- 基于Manifest V3构建，以实现与现代浏览器的兼容性。
- 使用Chrome扩展程序API来访问书签和历史记录。
- 通过注入内容脚本实现浮层功能。
- 支持键盘快捷键和导航操作。
- 采用具有毛玻璃效果的响应式设计。

## 权限要求
该扩展程序需要以下权限：
- `bookmarks`：用于搜索浏览器书签。
- `history`：用于搜索浏览历史记录。
- `activeTab`：用于将浮层注入当前页面。
- `scripting`：用于动态注入内容脚本。

## 浏览器兼容性
- Chrome 88+（支持Manifest V3）
- Edge 88+（基于Chromium内核） 

# QuickFinder - Bookmark & History Search Extension

A browser extension for Chrome and Edge that provides quick access to bookmarks and browsing history through a keyboard shortcut.

## Features

### 🔍 Core Search Features
- **Quick Access**: Press `Ctrl+Q` (unified shortcut for all platforms) to open the search overlay
- **Unified Search**: Search through both bookmarks and browsing history in one interface
- **Fuzzy Matching**: Find results even with partial or approximate text matching
- **Frosted Glass UI**: Beautiful overlay with blur background effect
- **Keyboard Navigation**: Navigate results with arrow keys, select with Enter, close with Escape
- **New Tab Opening**: All URL links open in new tabs, preserving the current page
- **Folder Navigation**: Click bookmark folders to browse contents with breadcrumb navigation
- **Multiple Display Modes**: Support for Recent History, Most Visited, and Bookmarks modes

### 🤖 AI-Powered Features
- **Smart Search**: Natural language queries like "find my React tutorial from last week"
- **Auto-Categorization**: AI analyzes bookmark content and suggests folder structures
- **Content Summarization**: Generate intelligent summaries and key information extraction
- **Personalized Recommendations**: Suggest related bookmarks based on browsing patterns
- **Forgotten Gems Discovery**: Proactively find valuable but long-unused bookmarks
- **Interest Analysis**: Analyze user interest patterns and behavioral trends
- **Smart Cleanup**: Detect duplicate and similar bookmarks with cleanup suggestions
- **Multi-AI Support**: Compatible with OpenAI, DeepSeek, Anthropic, and more

### ⚙️ System Features
- **Cross-Browser**: Compatible with both Chrome and Edge browsers
- **Privacy Protection**: All AI processing happens locally with full user data control

## Installation

### Development Installation

1. Clone or download this repository
2. Open Chrome or Edge and navigate to the extensions page:
   - Chrome: `chrome://extensions/`
   - Edge: `edge://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the extension directory
5. The extension should now be installed and ready to use

### Usage

1. Press `Ctrl+Q` (unified shortcut for all platforms) on any webpage
2. Type to search through your bookmarks and history
3. Use arrow keys to navigate results
4. Press Enter to open the selected result
5. Press Escape to close the search overlay

## File Structure

```
quickFinder/
├── manifest.json          # Extension configuration
├── background.js          # Service worker for handling shortcuts
├── content.js            # Content script for overlay injection
├── content.css           # Styles for the search overlay
├── popup.html            # Extension popup (optional)
├── popup.js              # Popup functionality
├── icons/                # Extension icons
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── README.md             # This file
```

## Technical Details

- Built with Manifest V3 for modern browser compatibility
- Uses Chrome Extensions API for bookmarks and history access
- Implements content script injection for overlay functionality
- Supports keyboard shortcuts and navigation
- Responsive design with frosted glass effect

## Permissions

The extension requires the following permissions:
- `bookmarks`: To search through browser bookmarks
- `history`: To search through browsing history
- `activeTab`: To inject the overlay into the current page
- `scripting`: To inject content scripts dynamically

## Browser Compatibility

- Chrome 88+ (Manifest V3 support)
- Edge 88+ (Chromium-based)
