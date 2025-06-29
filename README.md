# 🔍 QuickFinder - 快速书签搜索扩展

[![Chrome Web Store](https://img.shields.io/badge/Chrome-Extension-blue?logo=google-chrome)](https://chrome.google.com/webstore)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-1.1.0-green.svg)](https://github.com/EEEricG/QuickFinder)

一款功能强大的Chrome浏览器扩展，为用户提供快速便捷的书签和历史记录搜索体验。通过统一的搜索界面和智能匹配算法，让书签管理变得更加高效。

![QuickFinder Demo](icons/icon128.png)

## 🌟 核心亮点

- 🚀 **一键快速搜索** - `Ctrl+Q` 快速调用（所有平台统一）
- 🔍 **统一搜索界面** - 同时搜索书签和历史记录
- 🧠 **智能拼音搜索** - 支持中文拼音搜索和首字母匹配
- 📂 **文件夹导航** - 支持书签文件夹浏览和面包屑导航
- ⚡ **模糊匹配** - 部分内容匹配，快速找到目标
- 🎨 **现代化界面** - 毛玻璃效果的精美浮层设计
- ⌨️ **完整键盘支持** - 全键盘操作，提升效率

## 功能特点

### 🔍 核心搜索功能
- **快速访问**：在所有平台（Windows、Linux、macOS）下，按 `Ctrl+Q` 即可打开搜索浮层
- **统一搜索**：在同一界面中搜索书签和浏览历史记录
- **智能匹配**：支持模糊匹配、拼音搜索、首字母缩写等多种匹配方式
- **毛玻璃界面**：拥有带有模糊背景效果的精美浮层
- **键盘导航**：使用箭头键浏览结果，按回车键选择，按Esc键关闭
- **新标签页打开**：所有URL链接都在新标签页打开，不会覆盖当前页面
- **文件夹导航**：支持点击书签文件夹进入查看内容，带有面包屑导航
- **多种显示模式**：支持最近历史、最常访问和书签三种显示模式

### 📚 书签管理功能
- **可视化管理**：专门的书签管理页面，支持Grid和List两种视图
- **拖拽整理**：支持拖拽排序和文件夹整理
- **批量操作**：多选、框选、批量删除和移动功能
- **导入导出**：支持HTML格式的书签导入和导出
- **搜索过滤**：实时搜索过滤书签内容
- **分类标签**：自动为书签添加分类标签（书签、常用、最近）

### ⚙️ 系统功能
- **自定义设置**：可自定义快捷键和其他个人偏好设置
- **跨浏览器支持**：同时兼容Chrome和Edge浏览器
- **隐私保护**：所有数据处理均在本地进行，保护用户隐私
- **性能优化**：智能缓存机制，快速响应用户操作
- **错误恢复**：自动处理页面刷新和扩展重载情况

## 安装方法

### 开发环境安装
1. 克隆或下载本存储库
2. 打开Chrome或Edge浏览器，进入扩展程序页面：
    - Chrome：`chrome://extensions/`
    - Edge：`edge://extensions/`
3. 启用 "开发者模式"
4. 点击 "加载解压缩的扩展程序"，然后选择扩展程序目录
5. 此时，扩展程序应已安装完毕并可使用

## 使用方法

### 基础搜索
1. 在任意网页上按 `Ctrl+Q`（所有平台统一快捷键）
2. 输入内容，搜索你的书签和历史记录
3. 使用箭头键浏览结果
4. 按回车键打开所选结果
5. 按Esc键关闭搜索浮层

### 书签管理
1. 点击扩展图标，选择"书签管理"
2. 在管理页面中可以：
   - 切换Grid/List视图
   - 拖拽整理书签和文件夹
   - 批量选择和操作
   - 导入/导出书签
   - 搜索和过滤书签

### 键盘快捷键
- `Ctrl+Q`：打开/关闭搜索浮层
- `↑/↓`：在搜索结果中导航
- `Enter`：打开选中的结果
- `Esc`：关闭搜索浮层
- `Ctrl+A`：在书签管理中全选
- `Delete`：删除选中的书签

## 文件结构
```
quickFinder/
├── manifest.json          # 扩展程序配置文件
├── background.js          # 后台服务工作脚本
├── content.js            # 内容脚本，负责搜索浮层
├── content.css           # 搜索浮层样式表
├── popup.html            # 扩展弹出窗口
├── popup.js              # 弹出窗口逻辑
├── bookmarks.html        # 书签管理页面
├── bookmarks.js          # 书签管理逻辑
├── bookmarks.css         # 书签管理样式
├── options.html          # 设置页面
├── options.js            # 设置页面逻辑
├── lib/                  # 第三方库
│   └── pinyin-pro.min.js # 拼音转换库
├── icons/                # 扩展程序图标
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── README.md             # 本文件
```

## 技术特点

- **Manifest V3**：基于最新的扩展程序标准构建
- **Service Worker**：使用现代化的后台服务架构
- **Content Script**：安全的页面内容交互机制
- **智能缓存**：优化的数据缓存策略，提升性能
- **拼音搜索**：集成拼音转换库，支持中文搜索
- **响应式设计**：适配不同屏幕尺寸和分辨率
- **无障碍支持**：完整的键盘操作和屏幕阅读器支持

## 权限要求

该扩展程序需要以下权限：
- `bookmarks`：用于访问和管理浏览器书签
- `history`：用于搜索浏览历史记录
- `activeTab`：用于在当前页面注入搜索浮层
- `scripting`：用于动态注入内容脚本
- `storage`：用于保存用户设置和缓存数据

## 浏览器兼容性

- Chrome 88+（支持Manifest V3）
- Edge 88+（基于Chromium内核）

## 性能特点

- **快速响应**：平均搜索响应时间 < 100ms
- **内存优化**：智能缓存管理，最大内存使用 < 50MB
- **批量处理**：支持处理大量书签（10,000+）
- **实时同步**：书签变化实时反映到搜索结果

---

# QuickFinder - Bookmark & History Search Extension

A powerful browser extension for Chrome and Edge that provides quick access to bookmarks and browsing history through a unified search interface.

## Features

### 🔍 Core Search Features
- **Quick Access**: Press `Ctrl+Q` (unified shortcut for all platforms) to open the search overlay
- **Unified Search**: Search through both bookmarks and browsing history in one interface
- **Smart Matching**: Support for fuzzy matching, pinyin search, and abbreviation matching
- **Frosted Glass UI**: Beautiful overlay with blur background effect
- **Keyboard Navigation**: Navigate results with arrow keys, select with Enter, close with Escape
- **New Tab Opening**: All URL links open in new tabs, preserving the current page
- **Folder Navigation**: Click bookmark folders to browse contents with breadcrumb navigation
- **Multiple Display Modes**: Support for Recent History, Most Visited, and Bookmarks modes

### 📚 Bookmark Management
- **Visual Management**: Dedicated bookmark management page with Grid and List views
- **Drag & Drop**: Support for drag-and-drop organizing and folder arrangement
- **Batch Operations**: Multi-select, box-select, batch delete and move functionality
- **Import/Export**: Support for HTML format bookmark import and export
- **Real-time Search**: Live search filtering of bookmark content
- **Category Tags**: Automatic categorization tags for bookmarks

### ⚙️ System Features
- **Cross-Browser**: Compatible with both Chrome and Edge browsers
- **Privacy Protection**: All data processing happens locally
- **Performance Optimized**: Smart caching mechanism for fast response
- **Error Recovery**: Automatic handling of page refresh and extension reload

## Installation

### Development Installation

1. Clone or download this repository
2. Open Chrome or Edge and navigate to the extensions page:
   - Chrome: `chrome://extensions/`
   - Edge: `edge://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the extension directory
5. The extension should now be installed and ready to use

## Usage

### Basic Search
1. Press `Ctrl+Q` (unified shortcut for all platforms) on any webpage
2. Type to search through your bookmarks and history
3. Use arrow keys to navigate results
4. Press Enter to open the selected result
5. Press Escape to close the search overlay

### Bookmark Management
1. Click the extension icon and select "Bookmark Manager"
2. In the management page you can:
   - Switch between Grid/List views
   - Drag and drop to organize bookmarks and folders
   - Select and perform batch operations
   - Import/export bookmarks
   - Search and filter bookmarks

## File Structure

```
quickFinder/
├── manifest.json          # Extension configuration
├── background.js          # Background service worker
├── content.js            # Content script for search overlay
├── content.css           # Styles for the search overlay
├── popup.html            # Extension popup
├── popup.js              # Popup functionality
├── bookmarks.html        # Bookmark management page
├── bookmarks.js          # Bookmark management logic
├── bookmarks.css         # Bookmark management styles
├── lib/                  # Third-party libraries
│   └── pinyin-pro.min.js # Pinyin conversion library
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
- Smart caching mechanism for performance optimization
- Integrated pinyin library for Chinese search support
- Responsive design with frosted glass effect

## Permissions

The extension requires the following permissions:
- `bookmarks`: To access and manage browser bookmarks
- `history`: To search through browsing history
- `activeTab`: To inject the search overlay into the current page
- `scripting`: To inject content scripts dynamically
- `storage`: To save user settings and cache data

## Browser Compatibility

- Chrome 88+ (Manifest V3 support)
- Edge 88+ (Chromium-based)
