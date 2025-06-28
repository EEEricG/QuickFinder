// 书签管理页面脚本
class BookmarkManager {
  constructor() {
    this.currentFolder = 'root';
    this.currentView = 'grid';
    this.bookmarks = [];
    this.folders = [];
    this.selectedItems = new Set();
    this.selectionMode = false;
    this.viewState = {
      scrollPosition: 0,
      searchQuery: '',
      currentFolder: 'root'
    };

    // 框选功能相关属性
    this.isSelecting = false;
    this.selectionBox = null;
    this.startX = 0;
    this.startY = 0;

    // 文件夹导航历史
    this.folderHistory = [];
    this.currentHistoryIndex = -1;

    this.init();
  }
  
  async init() {
    this.bindEvents();
    await this.loadBookmarks();

    // 加载并应用设置
    await this.loadAndApplySettings();

    this.renderSidebar();
    this.renderBookmarks();

    // 自动聚焦搜索框
    this.focusSearchInput();

    // 修复按钮图标显示
    this.fixButtonIcons();

    // 创建拖拽插入线
    this.createDragInsertLine();
  }

  // 加载并应用设置
  async loadAndApplySettings() {
    try {
      const settings = JSON.parse(localStorage.getItem('bookmarkManagerSettings') || '{}');

      // 设置默认值
      const defaultSettings = {
        defaultView: 'grid',
        showFavicons: true,
        showUrls: true
      };

      this.currentSettings = { ...defaultSettings, ...settings };

      // 应用设置（初始化时不显示消息）
      this.applySettings(this.currentSettings, false);

    } catch (error) {
      console.error('❌ 加载设置失败:', error);
      // 使用默认设置
      this.currentSettings = {
        defaultView: 'grid',
        showFavicons: true,
        showUrls: true
      };
    }
  }

  // 修复按钮图标显示
  fixButtonIcons() {
    try {
      // 修复添加书签按钮图标
      const addBookmarkBtn = document.querySelector('#add-bookmark-btn .icon');
      if (addBookmarkBtn && (addBookmarkBtn.textContent.includes('�') || addBookmarkBtn.textContent.trim() === '' || addBookmarkBtn.textContent.includes('+'))) {
        addBookmarkBtn.textContent = '📖';
      }

      // 修复新建文件夹按钮图标
      const addFolderBtn = document.querySelector('#add-folder-btn .icon');
      if (addFolderBtn && (addFolderBtn.textContent.includes('�') || addFolderBtn.textContent.trim() === '' || addFolderBtn.textContent.includes('+'))) {
        addFolderBtn.textContent = '📁';
      }

      // 修复返回按钮图标
      const backBtn = document.querySelector('#back-btn .icon');
      if (backBtn && (backBtn.textContent.includes('�') || backBtn.textContent.trim() === '')) {
        backBtn.textContent = '🔙';
      }

    } catch (error) {
      console.error('❌ 修复按钮图标失败:', error);
    }
  }

  // 创建拖拽插入线
  createDragInsertLine() {
    this.dragInsertLine = document.createElement('div');
    this.dragInsertLine.className = 'drag-insert-line';
    this.dragInsertLine.id = 'drag-insert-line';
    document.body.appendChild(this.dragInsertLine);
  }

  bindEvents() {
    // 视图切换 - 修复事件绑定
    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        // 确保获取正确的view值，可能点击的是按钮内的子元素
        const target = e.target.closest('.view-btn');
        const view = target ? target.dataset.view : null;
        if (view) {
          this.switchView(view);
        }
      });
    });
    
    // 搜索
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', (e) => {
      this.handleSearch(e.target.value);
    });
    
    // 侧边栏导航
    document.addEventListener('click', (e) => {
      if (e.target.closest('.sidebar-item')) {
        const item = e.target.closest('.sidebar-item');
        const folder = item.dataset.folder;
        this.navigateToFolder(folder);
      }
    });
    
    // 右键菜单
    document.addEventListener('contextmenu', (e) => {
      if (e.target.closest('.bookmark-item')) {
        e.preventDefault();
        this.showContextMenu(e, e.target.closest('.bookmark-item'));
      }
    });
    
    // 隐藏右键菜单
    document.addEventListener('click', () => {
      this.hideContextMenu();
    });
    
    // 模态框
    document.getElementById('modal-close').addEventListener('click', () => {
      this.hideModal();
    });
    
    document.getElementById('modal-cancel').addEventListener('click', () => {
      this.hideModal();
    });
    
    document.getElementById('modal-save').addEventListener('click', () => {
      this.saveBookmark();
    });
    
    // 添加按钮
    document.getElementById('add-bookmark-btn').addEventListener('click', () => {
      this.showAddBookmarkModal();
    });

    document.getElementById('add-folder-btn').addEventListener('click', () => {
      this.showAddFolderModal();
    });

    // 多选功能按钮
    document.getElementById('toggle-selection-btn').addEventListener('click', () => {
      this.toggleSelectionMode();
    });

    // 退出多选按钮
    document.getElementById('exit-selection-btn').addEventListener('click', () => {
      this.exitSelectionMode();
    });

    document.getElementById('select-all-btn').addEventListener('click', () => {
      this.selectAll();
    });

    document.getElementById('clear-selection-btn').addEventListener('click', () => {
      this.clearSelection();
    });

    document.getElementById('delete-selected-btn').addEventListener('click', () => {
      this.showDeleteConfirmation();
    });

    // 删除确认对话框
    document.getElementById('delete-modal-close').addEventListener('click', () => {
      this.hideDeleteModal();
    });

    document.getElementById('delete-modal-cancel').addEventListener('click', () => {
      this.hideDeleteModal();
    });

    document.getElementById('delete-modal-confirm').addEventListener('click', () => {
      this.deleteSelectedItems();
    });

    // 键盘快捷键
    document.addEventListener('keydown', (e) => {
      this.handleKeyboardShortcuts(e);
    });

    // 框选功能事件绑定
    this.bindSelectionBoxEvents();

    // 鼠标侧键导航事件绑定
    this.bindMouseNavigationEvents();

    // 设置按钮事件绑定
    this.bindSettingsEvents();

    // 返回按钮事件绑定
    document.getElementById('back-btn').addEventListener('click', () => {
      this.goBack();
    });

    // 容器拖拽事件绑定
    this.bindContainerDragEvents();
  }
  
  async loadBookmarks() {
    try {
      const bookmarkTree = await chrome.bookmarks.getTree();
      this.processBookmarkTree(bookmarkTree);
    } catch (error) {
      console.error('Error loading bookmarks:', error);
    }
  }
  
  processBookmarkTree(tree) {
    this.bookmarks = [];
    this.folders = [];

    const processNode = (nodes, parentPath = '') => {
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (node.id === '0') {
          // 根节点，处理子节点
          if (node.children) {
            processNode(node.children, parentPath);
          }
          continue;
        }

        if (node.url) {
          // 这是一个书签
          this.bookmarks.push({
            id: node.id,
            title: node.title,
            url: node.url,
            parentId: node.parentId,
            parentPath: parentPath,
            dateAdded: node.dateAdded,
            index: node.index || i, // 保持原始顺序
            type: 'bookmark'
          });
        } else {
          // 这是一个文件夹
          this.folders.push({
            id: node.id,
            title: node.title,
            parentId: node.parentId,
            parentPath: parentPath,
            dateAdded: node.dateAdded,
            index: node.index || i, // 保持原始顺序
            type: 'folder',
            children: node.children || []
          });

          // 递归处理子节点
          if (node.children) {
            const newPath = parentPath ? `${parentPath} > ${node.title}` : node.title;
            processNode(node.children, newPath);
          }
        }
      }
    };

    processNode(tree);
  }
  
  renderSidebar() {
    const folderTree = document.getElementById('folder-tree');
    folderTree.innerHTML = '';
    
    // 渲染文件夹树
    const rootFolders = this.folders.filter(f => f.parentId === '1' || f.parentId === '2');
    
    rootFolders.forEach(folder => {
      const folderElement = this.createFolderTreeItem(folder);
      folderTree.appendChild(folderElement);
    });
  }
  
  createFolderTreeItem(folder) {
    const item = document.createElement('div');
    item.className = 'sidebar-item';
    item.dataset.folder = folder.id;
    
    item.innerHTML = `
      <span class="sidebar-icon">📁</span>
      <span class="sidebar-text">${folder.title}</span>
    `;
    
    return item;
  }
  
  renderBookmarks() {
    const container = document.getElementById('bookmark-container');
    const itemCount = document.getElementById('item-count');
    
    container.innerHTML = '<div class="loading">加载中...</div>';
    
    setTimeout(() => {
      let items = [];
      
      if (this.currentFolder === 'root') {
        // 根目录：显示书签栏和其他书签的内容，按原始顺序排序
        const rootFolders = this.folders.filter(f => f.parentId === '1' || f.parentId === '2')
          .sort((a, b) => (a.index || 0) - (b.index || 0));
        const rootBookmarks = this.bookmarks.filter(b => b.parentId === '1' || b.parentId === '2')
          .sort((a, b) => (a.index || 0) - (b.index || 0));
        items = [...rootFolders, ...rootBookmarks];
      } else if (this.currentFolder === 'recent') {
        items = this.bookmarks
          .sort((a, b) => (b.dateAdded || 0) - (a.dateAdded || 0))
          .slice(0, 20);
      } else if (this.currentFolder === 'frequent') {
        // 这里可以实现常用书签逻辑
        items = this.bookmarks.slice(0, 10);
      } else {
        // 特定文件夹：按原始顺序排序，文件夹在前
        const folderItems = this.folders.filter(f => f.parentId === this.currentFolder)
          .sort((a, b) => (a.index || 0) - (b.index || 0));
        const bookmarkItems = this.bookmarks.filter(b => b.parentId === this.currentFolder)
          .sort((a, b) => (a.index || 0) - (b.index || 0));
        items = [...folderItems, ...bookmarkItems];
      }
      
      container.innerHTML = '';
      container.className = `bookmark-grid ${this.currentView === 'list' ? 'list-view' : ''}`;
      
      if (items.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">📚</div>
            <div class="empty-title">暂无书签</div>
            <div class="empty-description">点击上方按钮添加您的第一个书签</div>
          </div>
        `;
      } else {
        items.forEach(item => {
          const element = this.createBookmarkItem(item);
          container.appendChild(element);
        });
      }
      
      // 更新统计数字
      this.updateItemCount(items);
    }, 300);
  }

  // 更新项目计数
  updateItemCount(currentItems) {
    const itemCount = document.getElementById('item-count');

    if (this.currentFolder === 'root') {
      // 根目录显示所有书签的总数
      const totalBookmarks = this.getTotalBookmarkCount();
      itemCount.textContent = `共 ${totalBookmarks} 个书签`;
    } else {
      // 子文件夹显示当前层级的项目数量
      itemCount.textContent = `${currentItems.length} 项`;
    }
  }

  // 递归计算所有书签的总数量（不包括文件夹）
  getTotalBookmarkCount() {
    return this.bookmarks.length;
  }

  createBookmarkItem(item) {
    const element = document.createElement('div');
    const isSelected = this.selectedItems.has(item.id);
    element.className = `bookmark-item ${this.currentView === 'list' ? 'list-view' : ''} ${item.type === 'folder' ? 'folder-item' : ''} ${this.selectionMode ? 'selection-mode' : ''} ${isSelected ? 'selected' : ''}`;
    element.dataset.id = item.id;
    element.dataset.type = item.type;

    // 添加拖拽支持
    element.draggable = true;
    element.dataset.index = item.index || 0;

    // 获取当前设置
    const settings = this.currentSettings || {};
    const showFavicons = settings.showFavicons !== false; // 默认显示
    const showUrls = settings.showUrls !== false; // 默认显示

    // 图标（根据设置决定是否显示）
    let favicon = '';
    if (showFavicons) {
      favicon = item.type === 'folder'
        ? '<div class="bookmark-favicon">📁</div>'
        : `<img class="bookmark-favicon" src="${this.getFaviconUrl(item.url)}" alt="favicon" onerror="this.src='data:image/svg+xml,<svg xmlns=&quot;http://www.w3.org/2000/svg&quot; viewBox=&quot;0 0 16 16&quot;><circle cx=&quot;8&quot; cy=&quot;8&quot; r=&quot;6&quot; fill=&quot;%23ccc&quot;/></svg>'">`;
    }

    // 多选模式下添加复选框
    const checkbox = this.selectionMode ? `
      <div class="bookmark-checkbox">
        <input type="checkbox" ${isSelected ? 'checked' : ''} data-id="${item.id}">
      </div>
    ` : '';

    // URL显示（根据设置决定是否显示）
    let urlDisplay = '';
    if (showUrls) {
      urlDisplay = `<div class="bookmark-url">${item.type === 'folder' ? `${item.children?.length || 0} 项` : item.url}</div>`;
    }

    element.innerHTML = `
      ${checkbox}
      ${favicon}
      <div class="bookmark-title">${item.title || 'Untitled'}</div>
      ${urlDisplay}
    `;

    // 添加点击事件
    element.addEventListener('click', (e) => {
      if (this.selectionMode) {
        // 多选模式下切换选择状态
        e.preventDefault();
        this.toggleItemSelection(item.id);
      } else {
        // 正常模式下的导航或打开
        if (item.type === 'folder') {
          this.navigateToFolder(item.id);
        } else {
          window.open(item.url, '_blank');
        }
      }
    });

    // 复选框事件
    if (this.selectionMode) {
      const checkboxInput = element.querySelector('input[type="checkbox"]');
      checkboxInput.addEventListener('change', (e) => {
        e.stopPropagation();
        this.toggleItemSelection(item.id);
      });
    }

    // 拖拽事件
    this.addDragEvents(element, item);

    return element;
  }
  
  getFaviconUrl(url) {
    try {
      const urlObj = new URL(url);
      return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`;
    } catch (error) {
      return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="%23ccc"/></svg>';
    }
  }
  
  switchView(view) {
    if (!view || (view !== 'grid' && view !== 'list')) {
      return;
    }

    this.currentView = view;

    // 更新按钮状态
    document.querySelectorAll('.view-btn').forEach(btn => {
      const isActive = btn.dataset.view === view;
      btn.classList.toggle('active', isActive);
    });

    // 重新渲染书签
    this.renderBookmarks();
  }
  
  navigateToFolder(folderId, addToHistory = true) {
    // 如果需要添加到历史记录
    if (addToHistory && folderId !== this.currentFolder) {
      // 清除当前位置之后的历史记录
      this.folderHistory = this.folderHistory.slice(0, this.currentHistoryIndex + 1);
      // 添加当前文件夹到历史记录
      this.folderHistory.push(this.currentFolder);
      this.currentHistoryIndex = this.folderHistory.length - 1;
    }

    this.currentFolder = folderId;

    // 更新侧边栏状态
    document.querySelectorAll('.sidebar-item').forEach(item => {
      item.classList.toggle('active', item.dataset.folder === folderId);
    });

    // 更新标题和返回按钮
    const titleElement = document.getElementById('content-title');
    const backBtn = document.getElementById('back-btn');

    if (folderId === 'root') {
      titleElement.textContent = '所有书签';
      backBtn.style.display = 'none'; // 根目录隐藏返回按钮
    } else if (folderId === 'recent') {
      titleElement.textContent = '最近添加';
      backBtn.style.display = 'none'; // 特殊页面隐藏返回按钮
    } else if (folderId === 'frequent') {
      titleElement.textContent = '常用书签';
      backBtn.style.display = 'none'; // 特殊页面隐藏返回按钮
    } else {
      const folder = this.folders.find(f => f.id === folderId);
      titleElement.textContent = folder ? folder.title : '未知文件夹';
      backBtn.style.display = 'flex'; // 子文件夹显示返回按钮
    }

    // 重新渲染书签
    this.renderBookmarks();
  }

  // 返回上级目录
  goBack() {
    if (this.currentFolder === 'root' || this.currentFolder === 'recent' || this.currentFolder === 'frequent') {
      return; // 已经在根目录或特殊页面，无法返回
    }

    // 查找当前文件夹的父文件夹
    const currentFolder = this.folders.find(f => f.id === this.currentFolder);
    if (currentFolder) {
      const parentId = currentFolder.parentId;

      // 如果父文件夹是书签栏(1)或其他书签(2)，返回到根目录
      if (parentId === '1' || parentId === '2') {
        this.navigateToFolder('root', false); // 不添加到历史记录
        this.showNotification('已返回到根目录', 'success');
      } else {
        const parentFolder = this.folders.find(f => f.id === parentId);
        this.navigateToFolder(parentId, false); // 不添加到历史记录
        this.showNotification(`已返回到 "${parentFolder ? parentFolder.title : '上级目录'}"`, 'success');
      }
    } else {
      // 如果找不到当前文件夹，返回到根目录
      this.navigateToFolder('root', false);
      this.showNotification('已返回到根目录', 'success');
    }
  }
  
  handleSearch(query) {
    if (!query.trim()) {
      this.renderBookmarks();
      return;
    }
    
    const filteredBookmarks = this.bookmarks.filter(bookmark => 
      bookmark.title.toLowerCase().includes(query.toLowerCase()) ||
      bookmark.url.toLowerCase().includes(query.toLowerCase())
    );
    
    const container = document.getElementById('bookmark-container');
    const itemCount = document.getElementById('item-count');
    
    container.innerHTML = '';
    container.className = `bookmark-grid ${this.currentView === 'list' ? 'list-view' : ''}`;
    
    if (filteredBookmarks.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔍</div>
          <div class="empty-title">未找到匹配的书签</div>
          <div class="empty-description">尝试使用不同的关键词搜索</div>
        </div>
      `;
    } else {
      filteredBookmarks.forEach(bookmark => {
        const element = this.createBookmarkItem(bookmark);
        container.appendChild(element);
      });
    }
    
    itemCount.textContent = `找到 ${filteredBookmarks.length} 个书签`;
  }
  
  showContextMenu(event, bookmarkElement) {
    const contextMenu = document.getElementById('context-menu');
    contextMenu.style.display = 'block';
    contextMenu.style.left = event.pageX + 'px';
    contextMenu.style.top = event.pageY + 'px';
    
    // 绑定菜单项事件
    contextMenu.onclick = (e) => {
      const action = e.target.closest('.context-item')?.dataset.action;
      if (action) {
        this.handleContextAction(action, bookmarkElement);
        this.hideContextMenu();
      }
    };
  }
  
  hideContextMenu() {
    document.getElementById('context-menu').style.display = 'none';
  }
  
  handleContextAction(action, bookmarkElement) {
    const bookmarkId = bookmarkElement.dataset.id;
    const bookmarkType = bookmarkElement.dataset.type;
    
    switch (action) {
      case 'open':
        if (bookmarkType === 'bookmark') {
          const bookmark = this.bookmarks.find(b => b.id === bookmarkId);
          if (bookmark) {
            window.location.href = bookmark.url;
          }
        }
        break;
      case 'open-new-tab':
        if (bookmarkType === 'bookmark') {
          const bookmark = this.bookmarks.find(b => b.id === bookmarkId);
          if (bookmark) {
            window.open(bookmark.url, '_blank');
          }
        }
        break;
      case 'edit':
        this.showEditModal(bookmarkId, bookmarkType);
        break;
      case 'delete':
        this.deleteBookmark(bookmarkId);
        break;
    }
  }
  
  showEditModal(bookmarkId, bookmarkType) {
    const modal = document.getElementById('edit-modal');
    const titleElement = document.getElementById('modal-title');
    const nameInput = document.getElementById('edit-name');
    const urlInput = document.getElementById('edit-url');
    
    if (bookmarkType === 'folder') {
      const folder = this.folders.find(f => f.id === bookmarkId);
      titleElement.textContent = '编辑文件夹';
      nameInput.value = folder ? folder.title : '';
      urlInput.style.display = 'none';
      urlInput.parentElement.style.display = 'none';
    } else {
      const bookmark = this.bookmarks.find(b => b.id === bookmarkId);
      titleElement.textContent = '编辑书签';
      nameInput.value = bookmark ? bookmark.title : '';
      urlInput.value = bookmark ? bookmark.url : '';
      urlInput.style.display = 'block';
      urlInput.parentElement.style.display = 'block';
    }
    
    modal.style.display = 'flex';
    modal.dataset.editId = bookmarkId;
    modal.dataset.editType = bookmarkType;
  }
  
  showAddBookmarkModal() {
    const modal = document.getElementById('edit-modal');
    const titleElement = document.getElementById('modal-title');
    const nameInput = document.getElementById('edit-name');
    const urlInput = document.getElementById('edit-url');
    
    titleElement.textContent = '添加书签';
    nameInput.value = '';
    urlInput.value = '';
    urlInput.style.display = 'block';
    urlInput.parentElement.style.display = 'block';
    
    modal.style.display = 'flex';
    modal.dataset.editId = '';
    modal.dataset.editType = 'bookmark';
  }
  
  showAddFolderModal() {
    const modal = document.getElementById('edit-modal');
    const titleElement = document.getElementById('modal-title');
    const nameInput = document.getElementById('edit-name');
    const urlInput = document.getElementById('edit-url');
    
    titleElement.textContent = '新建文件夹';
    nameInput.value = '';
    urlInput.style.display = 'none';
    urlInput.parentElement.style.display = 'none';
    
    modal.style.display = 'flex';
    modal.dataset.editId = '';
    modal.dataset.editType = 'folder';
  }
  
  hideModal() {
    document.getElementById('edit-modal').style.display = 'none';
  }
  
  async saveBookmark() {
    const modal = document.getElementById('edit-modal');
    const editId = modal.dataset.editId;
    const editType = modal.dataset.editType;
    const name = document.getElementById('edit-name').value.trim();
    const url = document.getElementById('edit-url').value.trim();

    if (!name) {
      this.showMessage('请输入名称', 'error');
      return;
    }

    if (editType === 'bookmark' && !url) {
      this.showMessage('请输入网址', 'error');
      return;
    }

    // URL格式验证（仅对书签）
    if (editType === 'bookmark' && url) {
      const urlPattern = /^(https?:\/\/|ftp:\/\/|chrome:\/\/|chrome-extension:\/\/|file:\/\/)/i;
      if (!urlPattern.test(url)) {
        // 如果没有协议，自动添加 https://
        const correctedUrl = 'https://' + url;
        document.getElementById('edit-url').value = correctedUrl;
        this.showMessage('已自动添加 https:// 前缀', 'info');
        return; // 让用户确认修正后的URL
      }
    }

    try {
      if (editId) {
        // 编辑现有项目
        if (editType === 'folder') {
          await chrome.bookmarks.update(editId, { title: name });
        } else {
          await chrome.bookmarks.update(editId, { title: name, url: url });
        }
        this.showMessage(`${editType === 'folder' ? '文件夹' : '书签'}更新成功`, 'success');
      } else {
        // 创建新项目
        let parentId = this.currentFolder === 'root' ? '1' : this.currentFolder;

        // 验证父文件夹ID
        if (parentId !== '1' && parentId !== '2') {
          try {
            await chrome.bookmarks.get(parentId);
          } catch (error) {
            parentId = '1'; // 书签栏
          }
        }

        if (editType === 'folder') {
          await chrome.bookmarks.create({
            parentId: parentId,
            title: name
          });
          this.showMessage('文件夹创建成功', 'success');
        } else {
          await chrome.bookmarks.create({
            parentId: parentId,
            title: name,
            url: url
          });
          this.showMessage('书签创建成功', 'success');
        }
      }

      // 重新加载书签
      await this.loadBookmarks();
      this.renderSidebar();
      this.renderBookmarks();
      this.hideModal();

    } catch (error) {
      console.error('❌ 保存失败:', error);
      this.showMessage(`保存失败: ${error.message || '未知错误'}`, 'error');
    }
  }
  
  async deleteBookmark(bookmarkId) {
    if (confirm('确定要删除这个项目吗？')) {
      try {
        await chrome.bookmarks.removeTree(bookmarkId);
        await this.loadBookmarks();
        this.renderSidebar();
        this.renderBookmarks();
      } catch (error) {
        console.error('Error deleting bookmark:', error);
        alert('删除失败，请重试');
      }
    }
  }

  // 多选删除功能方法
  toggleSelectionMode() {
    this.selectionMode = !this.selectionMode;
    this.selectedItems.clear();
    this.updateSelectionUI();
    this.renderBookmarks();
  }

  exitSelectionMode() {
    if (this.selectionMode) {
      this.selectionMode = false;
      this.selectedItems.clear();
      this.updateSelectionUI();
      this.renderBookmarks();
    }
  }

  updateSelectionUI() {
    const selectionActions = document.getElementById('selection-actions');
    const normalActions = document.getElementById('normal-actions');
    const toggleBtn = document.getElementById('toggle-selection-btn');
    const deleteBtn = document.getElementById('delete-selected-btn');
    const selectedCount = document.getElementById('selected-count');

    if (this.selectionMode) {
      selectionActions.style.display = 'flex';
      normalActions.style.display = 'none';
      toggleBtn.innerHTML = '<span class="icon">❌</span><span class="text">退出多选</span>';
    } else {
      selectionActions.style.display = 'none';
      normalActions.style.display = 'flex';
      toggleBtn.innerHTML = '<span class="icon">☑️</span><span class="text">多选模式</span>';
    }

    // 更新删除按钮状态
    const selectedItemsCount = this.selectedItems.size;
    deleteBtn.disabled = selectedItemsCount === 0;
    selectedCount.textContent = `(${selectedItemsCount})`;
  }

  toggleItemSelection(itemId) {
    if (this.selectedItems.has(itemId)) {
      this.selectedItems.delete(itemId);
    } else {
      this.selectedItems.add(itemId);
    }

    this.updateSelectionUI();
    this.updateItemVisualState(itemId);
  }

  updateItemVisualState(itemId) {
    const element = document.querySelector(`[data-id="${itemId}"]`);
    if (element) {
      const checkbox = element.querySelector('input[type="checkbox"]');
      const isSelected = this.selectedItems.has(itemId);

      if (isSelected) {
        element.classList.add('selected');
        if (checkbox) checkbox.checked = true;
      } else {
        element.classList.remove('selected');
        if (checkbox) checkbox.checked = false;
      }
    }
  }

  // 获取当前显示的项目（与renderBookmarks中的逻辑保持一致）
  getCurrentDisplayedItems() {
    let items = [];

    if (this.currentFolder === 'root') {
      items = [...this.folders, ...this.bookmarks];
    } else if (this.currentFolder === 'recent') {
      items = this.bookmarks
        .sort((a, b) => (b.dateAdded || 0) - (a.dateAdded || 0))
        .slice(0, 20);
    } else if (this.currentFolder === 'frequent') {
      items = this.bookmarks.slice(0, 10);
    } else {
      // 特定文件夹 - 只获取当前文件夹内的项目
      items = [
        ...this.folders.filter(f => f.parentId === this.currentFolder),
        ...this.bookmarks.filter(b => b.parentId === this.currentFolder)
      ];
    }

    // 如果有搜索查询，进一步过滤结果
    const searchQuery = document.getElementById('search-input').value.trim();
    if (searchQuery) {
      items = items.filter(item =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.url && item.url.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    return items;
  }

  selectAll() {
    const currentItems = this.getCurrentDisplayedItems();

    // 选择当前显示的所有项目
    currentItems.forEach(item => {
      this.selectedItems.add(item.id);
      this.updateItemVisualState(item.id);
    });

    this.updateSelectionUI();
    this.showMessage(`已选择 ${currentItems.length} 个项目`, 'info');
  }

  clearSelection() {
    // 先清除所有选中项的视觉状态
    this.selectedItems.forEach(itemId => {
      const element = document.querySelector(`[data-id="${itemId}"]`);
      if (element) {
        element.classList.remove('selected');
        const checkbox = element.querySelector('input[type="checkbox"]');
        if (checkbox) checkbox.checked = false;
      }
    });

    // 然后清空选中项集合
    this.selectedItems.clear();

    // 最后更新UI状态
    this.updateSelectionUI();
  }

  saveViewState() {
    this.viewState = {
      scrollPosition: window.scrollY,
      searchQuery: document.getElementById('search-input').value,
      currentFolder: this.currentFolder
    };
  }

  restoreViewState() {
    // 恢复搜索状态
    if (this.viewState.searchQuery) {
      document.getElementById('search-input').value = this.viewState.searchQuery;
    }

    // 恢复滚动位置
    setTimeout(() => {
      window.scrollTo(0, this.viewState.scrollPosition);
    }, 100);
  }

  showDeleteConfirmation() {
    if (this.selectedItems.size === 0) return;

    const modal = document.getElementById('delete-confirm-modal');
    const message = document.getElementById('delete-message');
    const details = document.getElementById('delete-details');

    // 设置确认消息
    const count = this.selectedItems.size;
    message.textContent = `您确定要删除选中的 ${count} 个项目吗？`;

    // 显示要删除的项目详情
    details.innerHTML = '';
    const allItems = [...this.bookmarks, ...this.folders];

    this.selectedItems.forEach(itemId => {
      const item = allItems.find(i => i.id === itemId);
      if (item) {
        const itemElement = document.createElement('div');
        itemElement.className = 'delete-item';
        itemElement.innerHTML = `
          <div class="delete-item-icon">${item.type === 'folder' ? '📁' : '🔖'}</div>
          <div class="delete-item-title">${item.title || 'Untitled'}</div>
        `;
        details.appendChild(itemElement);
      }
    });

    modal.style.display = 'flex';
  }

  hideDeleteModal() {
    document.getElementById('delete-confirm-modal').style.display = 'none';
  }

  async deleteSelectedItems() {
    if (this.selectedItems.size === 0) return;

    const deleteBtn = document.getElementById('delete-modal-confirm');
    const loadingSpinner = document.getElementById('delete-loading');
    const deleteText = deleteBtn.querySelector('.delete-text');

    // 显示加载状态
    deleteBtn.disabled = true;
    loadingSpinner.style.display = 'inline-block';
    deleteText.textContent = '删除中...';

    try {
      // 保存当前视图状态
      this.saveViewState();

      // 执行删除操作
      const deletePromises = Array.from(this.selectedItems).map(itemId => {
        return new Promise((resolve, reject) => {
          chrome.bookmarks.removeTree(itemId, () => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve();
            }
          });
        });
      });

      await Promise.all(deletePromises);

      // 删除成功
      this.selectedItems.clear();
      this.hideDeleteModal();

      // 重新加载书签并恢复视图状态
      await this.loadBookmarks();
      this.renderSidebar();
      this.renderBookmarks();
      this.restoreViewState();
      this.updateSelectionUI();

      // 显示成功消息
      this.showMessage('删除成功', 'success');

    } catch (error) {
      console.error('删除失败:', error);
      this.showMessage('删除失败: ' + error.message, 'error');
    } finally {
      // 恢复按钮状态
      deleteBtn.disabled = false;
      loadingSpinner.style.display = 'none';
      deleteText.textContent = '删除';
    }
  }

  handleKeyboardShortcuts(e) {
    // 全局快捷键处理（不依赖多选模式）

    // Ctrl+Shift+V 切换视图模式
    if (e.ctrlKey && e.shiftKey && e.key === 'V') {
      e.preventDefault();
      const newView = this.currentView === 'grid' ? 'list' : 'grid';
      this.switchView(newView);
      return;
    }

    // Escape 键退出多选模式（全局处理）
    if (e.key === 'Escape') {
      e.preventDefault();
      if (this.selectionMode) {
        this.toggleSelectionMode();
      }
      return;
    }

    // 以下快捷键只在多选模式下处理
    if (!this.selectionMode) return;

    // Ctrl+A 全选
    if (e.ctrlKey && e.key === 'a') {
      e.preventDefault();
      this.selectAll();
    }

    // Delete 键删除选中项
    if (e.key === 'Delete' && this.selectedItems.size > 0) {
      e.preventDefault();
      this.showDeleteConfirmation();
    }
  }

  showMessage(text, type = 'info') {
    // 创建消息提示
    const message = document.createElement('div');
    message.className = `message message-${type}`;
    message.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
      color: white;
      padding: 12px 20px;
      border-radius: 6px;
      z-index: 10000;
      font-size: 14px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    `;
    message.textContent = text;

    document.body.appendChild(message);

    // 3秒后自动移除
    setTimeout(() => {
      if (message.parentNode) {
        message.parentNode.removeChild(message);
      }
    }, 3000);
  }

  // 框选功能方法
  bindSelectionBoxEvents() {
    const container = document.getElementById('bookmark-container');

    container.addEventListener('mousedown', (e) => {
      // 只在多选模式下且点击空白区域时启用框选
      if (!this.selectionMode || e.target.closest('.bookmark-item')) return;

      this.startSelectionBox(e);
    });

    document.addEventListener('mousemove', (e) => {
      if (this.isSelecting) {
        this.updateSelectionBox(e);
      }
    });

    document.addEventListener('mouseup', (e) => {
      if (this.isSelecting) {
        this.endSelectionBox(e);
      }
    });
  }

  startSelectionBox(e) {
    this.isSelecting = true;
    this.startX = e.clientX;
    this.startY = e.clientY;

    // 创建选择框元素
    this.selectionBox = document.createElement('div');
    this.selectionBox.className = 'selection-box';
    this.selectionBox.style.cssText = `
      position: fixed;
      border: 2px dashed #2196F3;
      background: rgba(33, 150, 243, 0.1);
      pointer-events: none;
      z-index: 1000;
      left: ${this.startX}px;
      top: ${this.startY}px;
      width: 0;
      height: 0;
    `;

    document.body.appendChild(this.selectionBox);

    // 防止文本选择
    e.preventDefault();
  }

  updateSelectionBox(e) {
    if (!this.selectionBox) return;

    const currentX = e.clientX;
    const currentY = e.clientY;

    const left = Math.min(this.startX, currentX);
    const top = Math.min(this.startY, currentY);
    const width = Math.abs(currentX - this.startX);
    const height = Math.abs(currentY - this.startY);

    this.selectionBox.style.left = left + 'px';
    this.selectionBox.style.top = top + 'px';
    this.selectionBox.style.width = width + 'px';
    this.selectionBox.style.height = height + 'px';

    // 实时更新选中的项目
    this.updateBoxSelection(left, top, width, height);
  }

  updateBoxSelection(left, top, width, height) {
    const bookmarkItems = document.querySelectorAll('.bookmark-item');
    const selectionRect = { left, top, right: left + width, bottom: top + height };
    const currentDisplayedItems = this.getCurrentDisplayedItems();
    const currentItemIds = new Set(currentDisplayedItems.map(item => item.id));

    bookmarkItems.forEach(item => {
      const itemRect = item.getBoundingClientRect();
      const itemId = item.dataset.id;

      // 只处理当前显示的项目
      if (!currentItemIds.has(itemId)) {
        return;
      }

      // 检查元素是否与选择框相交
      const isIntersecting = !(
        itemRect.right < selectionRect.left ||
        itemRect.left > selectionRect.right ||
        itemRect.bottom < selectionRect.top ||
        itemRect.top > selectionRect.bottom
      );

      if (isIntersecting) {
        if (!this.selectedItems.has(itemId)) {
          this.selectedItems.add(itemId);
          this.updateItemVisualState(itemId);
        }
      }
    });

    this.updateSelectionUI();
  }

  endSelectionBox(e) {
    this.isSelecting = false;

    if (this.selectionBox) {
      document.body.removeChild(this.selectionBox);
      this.selectionBox = null;
    }
  }

  // 鼠标导航功能
  bindMouseNavigationEvents() {
    // 绑定鼠标按钮事件
    document.addEventListener('mousedown', (e) => {
      this.handleMouseNavigation(e);
    });

    // 绑定键盘后退快捷键
    document.addEventListener('keydown', (e) => {
      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        this.goBack();
      }
    });
  }

  handleMouseNavigation(e) {
    // 鼠标侧键（后退键）通常是按钮4
    if (e.button === 3 || e.button === 4) {
      e.preventDefault();
      this.goBack();
    }
  }



  canGoBack() {
    return this.currentHistoryIndex > 0;
  }

  // 专门的聚焦方法，确保书签管理器中搜索框能正常聚焦
  focusSearchInput() {
    const attemptFocus = (attempt = 1) => {
      if (attempt > 5) {
        return;
      }

      setTimeout(() => {
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
          try {
            // 确保元素可见且可聚焦
            if (searchInput.offsetParent !== null) {
              searchInput.focus();

              // 验证聚焦是否成功
              setTimeout(() => {
                if (document.activeElement !== searchInput) {
                  attemptFocus(attempt + 1);
                }
              }, 50);
            } else {
              attemptFocus(attempt + 1);
            }
          } catch (error) {
            attemptFocus(attempt + 1);
          }
        } else {
          attemptFocus(attempt + 1);
        }
      }, attempt * 150); // 递增延迟：150ms, 300ms, 450ms, 600ms, 750ms
    };

    attemptFocus();
  }

  // 绑定设置相关事件
  bindSettingsEvents() {
    // 设置按钮点击事件
    document.getElementById('settings-btn').addEventListener('click', () => {
      this.toggleSettingsPanel();
    });

    // 设置面板关闭按钮
    document.getElementById('settings-close').addEventListener('click', () => {
      this.closeSettingsPanel();
    });



    // 设置保存
    document.getElementById('settings-save').addEventListener('click', () => {
      this.saveSettings();
    });

    // 设置重置
    document.getElementById('settings-reset').addEventListener('click', () => {
      this.resetSettings();
    });

    // 导入书签
    document.getElementById('import-bookmarks-btn').addEventListener('click', () => {
      this.importBookmarks();
    });

    // 文件选择器变化事件
    document.getElementById('import-file-input').addEventListener('change', (e) => {
      this.handleImportFile(e);
    });

    // 导出书签
    document.getElementById('export-bookmarks-btn').addEventListener('click', () => {
      this.exportBookmarks();
    });

    // 清除缓存
    document.getElementById('clear-cache-btn').addEventListener('click', () => {
      this.clearCache();
    });

    // 实时设置变更监听
    document.getElementById('show-favicons').addEventListener('change', (e) => {
      this.updateSettingRealtime('showFavicons', e.target.checked);
    });

    document.getElementById('show-urls').addEventListener('change', (e) => {
      this.updateSettingRealtime('showUrls', e.target.checked);
    });

    document.getElementById('default-view-select').addEventListener('change', (e) => {
      this.updateSettingRealtime('defaultView', e.target.value);
    });



    // 点击面板外部关闭
    document.addEventListener('click', (e) => {
      const settingsPanel = document.getElementById('settings-panel');
      const settingsBtn = document.getElementById('settings-btn');

      if (settingsPanel.classList.contains('open') &&
          !settingsPanel.contains(e.target) &&
          !settingsBtn.contains(e.target)) {
        this.closeSettingsPanel();
      }
    });
  }

  // 实时更新设置
  updateSettingRealtime(key, value) {
    if (!this.currentSettings) {
      this.currentSettings = {};
    }

    this.currentSettings[key] = value;

    // 立即应用设置
    if (key === 'showFavicons' || key === 'showUrls') {
      this.renderBookmarks();
    } else if (key === 'defaultView') {
      this.switchView(value);
    }

    // 保存到localStorage
    try {
      localStorage.setItem('bookmarkManagerSettings', JSON.stringify(this.currentSettings));
    } catch (error) {
      console.error('❌ 保存设置失败:', error);
    }
  }

  // 切换设置面板
  toggleSettingsPanel() {
    const panel = document.getElementById('settings-panel');
    panel.classList.toggle('open');

    if (panel.classList.contains('open')) {
      this.loadSettings();
    }
  }

  // 关闭设置面板
  closeSettingsPanel() {
    document.getElementById('settings-panel').classList.remove('open');
  }



  // 加载设置
  loadSettings() {
    try {
      const settings = JSON.parse(localStorage.getItem('bookmarkManagerSettings') || '{}');

      // 加载默认视图设置
      if (settings.defaultView) {
        document.getElementById('default-view-select').value = settings.defaultView;
      }

      // 加载显示选项
      document.getElementById('show-favicons').checked = settings.showFavicons !== false;
      document.getElementById('show-urls').checked = settings.showUrls !== false;

    } catch (error) {
      console.error('加载设置失败:', error);
    }
  }

  // 保存设置
  saveSettings() {
    try {
      const settings = {
        defaultView: document.getElementById('default-view-select').value,
        showFavicons: document.getElementById('show-favicons').checked,
        showUrls: document.getElementById('show-urls').checked
      };

      localStorage.setItem('bookmarkManagerSettings', JSON.stringify(settings));

      // 应用设置（用户主动保存时显示消息）
      this.applySettings(settings, true);

      // 显示保存成功提示
      this.showNotification('设置已保存', 'success');

    } catch (error) {
      console.error('保存设置失败:', error);
      this.showNotification('保存设置失败', 'error');
    }
  }

  // 应用设置
  applySettings(settings, showMessage = true) {
    // 应用默认视图
    if (settings.defaultView && settings.defaultView !== this.currentView) {
      this.switchView(settings.defaultView);
    }

    // 应用显示设置
    this.currentSettings = settings;

    // 重新渲染以应用显示设置
    this.renderBookmarks();

    // 只在用户主动保存设置时显示消息
    if (showMessage) {
      this.showMessage('设置已应用', 'success');
    }
  }



  // 重置设置
  resetSettings() {
    if (confirm('确定要重置所有设置吗？这将恢复默认配置。')) {
      localStorage.removeItem('bookmarkManagerSettings');

      // 重置界面
      document.getElementById('default-view-select').value = 'grid';
      document.getElementById('show-favicons').checked = true;
      document.getElementById('show-urls').checked = true;

      this.showNotification('设置已重置', 'success');
    }
  }

  // 导入书签
  importBookmarks() {
    const fileInput = document.getElementById('import-file-input');
    fileInput.click();
  }

  // 处理导入文件 - 增强版本，包含进度指示器和文件夹结构修复
  async handleImportFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    // 验证文件类型
    if (!file.name.toLowerCase().endsWith('.html') && !file.name.toLowerCase().endsWith('.htm')) {
      this.showNotification('请选择HTML格式的书签文件', 'error');
      return;
    }

    try {
      // 显示进度指示器
      this.showProgressModal();
      this.updateProgress('正在读取文件...', 0, 0, 0);

      // 读取文件内容
      const content = await this.readFileContent(file);
      this.updateProgress('正在解析书签...', 5, 0, 0);

      // 解析书签数据
      const bookmarks = this.parseBookmarkHTML(content);

      if (bookmarks.length === 0) {
        this.hideProgressModal();
        this.showNotification('未找到有效的书签数据', 'warning');
        return;
      }

      // 修复计数逻辑：只计算实际要导入的项目
      const bookmarkItems = bookmarks.filter(b => b.type === 'bookmark');
      const folderItems = bookmarks.filter(b => b.type === 'folder');
      const totalBookmarks = bookmarkItems.length;
      const totalFolders = folderItems.length;

      console.log(`📊 解析统计: ${totalBookmarks} 个书签, ${totalFolders} 个文件夹`);
      this.updateProgress(`解析完成：${totalBookmarks} 个书签，${totalFolders} 个文件夹`, 10, totalBookmarks, totalFolders);

      // 创建导入文件夹
      this.updateProgress('创建导入文件夹...', 15, totalBookmarks, totalFolders);
      const importFolder = await chrome.bookmarks.create({
        parentId: '1', // 书签栏
        title: `导入的书签 - ${new Date().toLocaleDateString()}`
      });

      // 导入书签（带进度跟踪和文件夹结构修复）
      const importResult = await this.importBookmarkNodesWithProgress(bookmarks, importFolder.id, totalBookmarks, totalFolders);
      const actualCount = await this.countImportedBookmarks(importFolder.id);

      this.updateProgress('正在刷新书签数据...', 95, totalBookmarks, totalFolders);

      // 重新加载书签数据
      await this.loadBookmarks();
      this.renderBookmarks();

      this.updateProgress('导入完成！', 100, totalBookmarks, totalFolders);

      // 延迟隐藏进度条，让用户看到完成状态
      setTimeout(() => {
        this.hideProgressModal();
      }, 1500);

      // 显示详细的导入结果
      const { successCount, errorCount, skippedCount } = importResult;

      if (errorCount > 0 || skippedCount > 0) {
        this.showNotification(
          `导入完成：成功 ${successCount} 个，失败 ${errorCount} 个，跳过 ${skippedCount} 个（实际创建 ${actualCount} 个书签）`,
          'warning'
        );
      } else {
        this.showNotification(`成功导入 ${actualCount} 个书签到正确的文件夹中`, 'success');
      }

    } catch (error) {
      console.error('导入书签失败:', error);
      this.hideProgressModal();
      this.showNotification(`导入失败: ${error.message}`, 'error');
    } finally {
      // 清空文件选择器
      event.target.value = '';
    }
  }

  // 读取文件内容
  readFileContent(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error('文件读取失败'));
      reader.readAsText(file, 'UTF-8');
    });
  }

  // 解析书签HTML - 完全重写以修复深层嵌套解析问题
  parseBookmarkHTML(htmlContent) {
    console.log('🚀 开始解析书签HTML...');
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');

    const bookmarks = [];

    // 使用更简单直接的方法：找到所有书签链接
    const allLinks = doc.querySelectorAll('dt a[href]');
    console.log(`🔍 直接查找法：找到 ${allLinks.length} 个书签链接`);

    // 方法1：直接提取所有书签（简单有效）
    allLinks.forEach((link, index) => {
      if (link.href && link.href.startsWith('http')) {
        const bookmark = {
          type: 'bookmark',
          title: link.textContent.trim() || 'Untitled',
          url: link.href,
          path: this.getBookmarkPath(link) // 获取书签路径
        };
        bookmarks.push(bookmark);
        console.log(`📖 书签 ${index + 1}: ${bookmark.title}`);
      }
    });

    // 方法2：提取文件夹结构（如果需要的话）
    const allFolders = doc.querySelectorAll('dt h3');
    console.log(`📁 找到 ${allFolders.length} 个文件夹`);

    allFolders.forEach((folderElement, index) => {
      const folderName = folderElement.textContent.trim();

      // 跳过根级别的"Untitled Folder"
      if (folderName === 'Untitled Folder') {
        console.log(`⏭️ 跳过系统文件夹: ${folderName}`);
        return;
      }

      const folderPath = this.getFolderPath(folderElement);

      bookmarks.push({
        type: 'folder',
        title: folderName,
        path: folderPath
      });

      console.log(`📁 文件夹 ${index + 1}: ${folderName} (路径: ${folderPath.join(' > ')})`);
    });

    console.log(`📊 解析完成: 总共 ${bookmarks.length} 个项目`);
    console.log(`  - 书签: ${bookmarks.filter(b => b.type === 'bookmark').length} 个`);
    console.log(`  - 文件夹: ${bookmarks.filter(b => b.type === 'folder').length} 个`);

    return bookmarks;
  }

  // 获取书签的路径 - 兼容多种HTML结构的健壮版本
  getBookmarkPath(linkElement) {
    const path = [];

    console.log(`🔍 开始分析书签路径: "${linkElement.textContent.trim()}"`);
    console.log(`🔗 书签URL: ${linkElement.href}`);

    // 从包含链接的元素开始向上遍历
    let current = linkElement;
    let loopCount = 0;

    while (current && current.parentElement && loopCount < 25) {
      loopCount++;
      current = current.parentElement;

      console.log(`\n🔄 循环 ${loopCount}: 当前元素 ${current.tagName}`);

      // 如果当前元素是DL，查找对应的文件夹
      if (current.tagName.toLowerCase() === 'dl') {
        console.log(`📁 发现DL元素，查找对应的文件夹...`);

        // 查找DL的前一个兄弟元素
        let folderElement = current.previousElementSibling;
        console.log(`🔍 DL的前一个兄弟: ${folderElement ? folderElement.tagName : 'null'}`);

        // 跳过所有非元素节点（文本节点、注释等）
        while (folderElement && folderElement.nodeType !== Node.ELEMENT_NODE) {
          console.log(`⏭️ 跳过非元素节点，类型: ${folderElement.nodeType}`);
          folderElement = folderElement.previousSibling;
        }

        console.log(`📁 处理后的兄弟元素: ${folderElement ? folderElement.tagName : 'null'}`);

        if (folderElement) {
          let h3Element = null;

          // 情况1：H3直接作为DL的兄弟（非标准但可能存在）
          if (folderElement.tagName.toLowerCase() === 'h3') {
            console.log(`📂 发现H3直接作为DL兄弟（非标准格式）`);
            h3Element = folderElement;
          }
          // 情况2：标准格式 - DT包含H3
          else if (folderElement.tagName.toLowerCase() === 'dt') {
            console.log(`📂 发现DT元素，查找其中的H3...`);
            h3Element = folderElement.querySelector('h3');
            console.log(`🔍 DT中的H3: ${h3Element ? '找到' : '未找到'}`);
          }

          // 如果找到H3元素，提取文件夹名
          if (h3Element) {
            const folderName = h3Element.textContent.trim();
            console.log(`📂 文件夹名: "${folderName}"`);

            // 只跳过根级别的"Untitled Folder"
            if (folderName && folderName !== 'Untitled Folder') {
              path.unshift(folderName);
              console.log(`✅ 添加到路径: "${folderName}"`);
              console.log(`📊 当前路径: [${path.join(' > ')}]`);
            } else {
              console.log(`⏭️ 跳过文件夹: "${folderName}"`);
            }
          } else {
            console.log(`❌ 未找到H3元素`);
          }
        } else {
          console.log(`❌ DL没有前一个兄弟元素`);
        }
      }
    }

    if (loopCount >= 25) {
      console.log(`⚠️ 达到最大循环次数，强制停止`);
    }

    console.log(`\n📊 最终路径: [${path.join(' > ')}]`);
    console.log(`📊 路径长度: ${path.length}`);
    console.log(`${'='.repeat(50)}`);

    return path;
  }

  // 获取文件夹的路径 - 使用与书签相同的健壮逻辑
  getFolderPath(folderElement) {
    const path = [];
    const folderName = folderElement.textContent.trim();

    console.log(`📁 开始分析文件夹路径: "${folderName}"`);

    // 从包含H3的元素开始向上遍历
    let current = folderElement;
    let loopCount = 0;

    while (current && current.parentElement && loopCount < 25) {
      loopCount++;
      current = current.parentElement;

      console.log(`\n🔄 循环 ${loopCount}: 当前元素 ${current.tagName}`);

      // 如果当前元素是DL，查找对应的文件夹
      if (current.tagName.toLowerCase() === 'dl') {
        console.log(`📁 发现DL元素，查找对应的文件夹...`);

        // 查找DL的前一个兄弟元素
        let folderElement = current.previousElementSibling;
        console.log(`🔍 DL的前一个兄弟: ${folderElement ? folderElement.tagName : 'null'}`);

        // 跳过所有非元素节点（文本节点、注释等）
        while (folderElement && folderElement.nodeType !== Node.ELEMENT_NODE) {
          console.log(`⏭️ 跳过非元素节点，类型: ${folderElement.nodeType}`);
          folderElement = folderElement.previousSibling;
        }

        console.log(`📁 处理后的兄弟元素: ${folderElement ? folderElement.tagName : 'null'}`);

        if (folderElement) {
          let h3Element = null;

          // 情况1：H3直接作为DL的兄弟（非标准但可能存在）
          if (folderElement.tagName.toLowerCase() === 'h3') {
            console.log(`📂 发现H3直接作为DL兄弟（非标准格式）`);
            h3Element = folderElement;
          }
          // 情况2：标准格式 - DT包含H3
          else if (folderElement.tagName.toLowerCase() === 'dt') {
            console.log(`📂 发现DT元素，查找其中的H3...`);
            h3Element = folderElement.querySelector('h3');
            console.log(`🔍 DT中的H3: ${h3Element ? '找到' : '未找到'}`);
          }

          // 如果找到H3元素，提取文件夹名
          if (h3Element) {
            const parentFolderName = h3Element.textContent.trim();
            console.log(`📂 父文件夹名: "${parentFolderName}"`);

            // 只跳过根级别的"Untitled Folder"，且不要添加自己
            if (parentFolderName && parentFolderName !== 'Untitled Folder' && parentFolderName !== folderName) {
              path.unshift(parentFolderName);
              console.log(`✅ 添加到路径: "${parentFolderName}"`);
              console.log(`📊 当前路径: [${path.join(' > ')}]`);
            } else {
              console.log(`⏭️ 跳过文件夹: "${parentFolderName}"`);
            }
          } else {
            console.log(`❌ 未找到H3元素`);
          }
        } else {
          console.log(`❌ DL没有前一个兄弟元素`);
        }
      }
    }

    if (loopCount >= 25) {
      console.log(`⚠️ 达到最大循环次数，强制停止`);
    }

    console.log(`\n📊 文件夹 "${folderName}" 的路径: [${path.join(' > ')}]`);
    console.log(`📊 路径长度: ${path.length}`);
    console.log(`${'='.repeat(50)}`);

    return path;
  }

  // 导入书签节点 - 修复：添加详细调试和逐个处理机制
  async importBookmarkNodes(bookmarks, parentId) {
    console.log(`🚀 开始导入书签，总数: ${bookmarks.length}`);
    console.log(`📁 父文件夹ID: ${parentId}`);

    const folderMap = new Map(); // 路径 -> 文件夹ID的映射
    folderMap.set('', parentId); // 根路径映射到父文件夹ID

    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    // 首先创建所有文件夹
    const folders = bookmarks.filter(b => b.type === 'folder');
    console.log(`📂 需要创建 ${folders.length} 个文件夹`);

    for (let i = 0; i < folders.length; i++) {
      const bookmark = folders[i];
      const pathKey = bookmark.path.join('/');
      const parentFolderId = folderMap.get(pathKey) || parentId;

      console.log(`📂 创建文件夹 ${i + 1}/${folders.length}: "${bookmark.title}"`);

      let retryCount = 0;
      const maxRetries = 3;
      let created = false;

      while (retryCount < maxRetries && !created) {
        try {
          // 添加延迟以避免API速率限制
          if (i > 0 || retryCount > 0) {
            const delay = retryCount > 0 ? (retryCount * 200) : 50;
            await new Promise(resolve => setTimeout(resolve, delay));
          }

          const folder = await chrome.bookmarks.create({
            parentId: parentFolderId,
            title: bookmark.title
          });

          const currentPathKey = [...bookmark.path, bookmark.title].join('/');
          folderMap.set(currentPathKey, folder.id);
          successCount++;
          created = true;
          console.log(`✅ 文件夹创建成功: ${bookmark.title} (ID: ${folder.id})`);

        } catch (error) {
          retryCount++;
          console.error(`❌ 创建文件夹失败 (尝试 ${retryCount}/${maxRetries}): ${bookmark.title}`, error);

          if (retryCount >= maxRetries) {
            errorCount++;
            // 如果是权限错误，使用默认父文件夹
            if (error.message.includes('permission') || error.message.includes('access')) {
              const currentPathKey = [...bookmark.path, bookmark.title].join('/');
              folderMap.set(currentPathKey, parentId);
              console.log(`🔄 使用默认父文件夹作为回退: ${bookmark.title}`);
            }
          }
        }
      }
    }

    // 然后创建所有书签
    const bookmarkItems = bookmarks.filter(b => b.type === 'bookmark');
    console.log(`🔖 需要创建 ${bookmarkItems.length} 个书签`);

    for (let i = 0; i < bookmarkItems.length; i++) {
      const bookmark = bookmarkItems[i];
      const pathKey = bookmark.path.join('/');
      const targetFolderId = folderMap.get(pathKey) || parentId;

      console.log(`🔖 创建书签 ${i + 1}/${bookmarkItems.length}: "${bookmark.title}"`);
      console.log(`📍 目标文件夹ID: ${targetFolderId}, URL: ${bookmark.url}`);

      let retryCount = 0;
      const maxRetries = 3;
      let created = false;

      while (retryCount < maxRetries && !created) {
        try {
          // 验证URL格式
          if (!bookmark.url || !this.isValidUrl(bookmark.url)) {
            console.warn(`⚠️ 跳过无效URL: ${bookmark.url}`);
            skippedCount++;
            break; // 跳出重试循环
          }

          // 添加延迟以避免API速率限制 - 更保守的策略
          if (i > 0 || retryCount > 0) {
            const delay = retryCount > 0 ? (retryCount * 300) : 100;
            await new Promise(resolve => setTimeout(resolve, delay));
          }

          const createdBookmark = await chrome.bookmarks.create({
            parentId: targetFolderId,
            title: bookmark.title || 'Untitled',
            url: bookmark.url
          });

          successCount++;
          created = true;
          console.log(`✅ 书签创建成功: ${bookmark.title} (ID: ${createdBookmark.id})`);

        } catch (error) {
          retryCount++;
          console.error(`❌ 创建书签失败 (尝试 ${retryCount}/${maxRetries}): ${bookmark.title}`, error);
          console.error(`📍 失败详情 - 父ID: ${targetFolderId}, URL: ${bookmark.url}`);

          if (retryCount >= maxRetries) {
            errorCount++;
            console.error(`💥 书签创建最终失败: ${bookmark.title}`);
          }
        }
      }

      // 如果连续失败太多，增加额外延迟
      if (errorCount > 0 && errorCount % 3 === 0) {
        console.log(`⏸️ 连续失败较多，额外暂停1秒`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const totalProcessed = successCount + errorCount + skippedCount;
    console.log(`📊 导入完成统计:`);
    console.log(`  - 成功: ${successCount} 个`);
    console.log(`  - 失败: ${errorCount} 个`);
    console.log(`  - 跳过: ${skippedCount} 个`);
    console.log(`  - 总计: ${totalProcessed} 个`);

    return { successCount, errorCount, skippedCount };
  }

  // 验证URL格式
  isValidUrl(string) {
    try {
      const url = new URL(string);
      return url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'ftp:';
    } catch (_) {
      return false;
    }
  }

  // 显示进度模态框
  showProgressModal() {
    // 创建进度模态框HTML
    const progressHTML = `
      <div id="import-progress-modal" class="progress-modal-overlay">
        <div class="progress-modal">
          <div class="progress-header">
            <h3>📚 正在导入书签</h3>
          </div>
          <div class="progress-content">
            <div class="progress-status" id="progress-status">准备开始...</div>
            <div class="progress-bar-container">
              <div class="progress-bar" id="progress-bar">
                <div class="progress-fill" id="progress-fill" style="width: 0%"></div>
              </div>
              <div class="progress-percentage" id="progress-percentage">0%</div>
            </div>
            <div class="progress-details">
              <div class="progress-stats">
                <span id="progress-bookmarks">书签: 0</span>
                <span id="progress-folders">文件夹: 0</span>
                <span id="progress-current">当前: 0/0</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // 添加CSS样式
    const progressCSS = `
      <style id="progress-modal-styles">
        .progress-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 10000;
          backdrop-filter: blur(5px);
        }

        .progress-modal {
          background: white;
          border-radius: 12px;
          padding: 30px;
          min-width: 400px;
          max-width: 500px;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
          animation: progressModalSlideIn 0.3s ease-out;
        }

        @keyframes progressModalSlideIn {
          from {
            opacity: 0;
            transform: translateY(-20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .progress-header h3 {
          margin: 0 0 20px 0;
          color: #333;
          text-align: center;
          font-size: 18px;
        }

        .progress-status {
          color: #666;
          margin-bottom: 15px;
          font-weight: 500;
          text-align: center;
        }

        .progress-bar-container {
          display: flex;
          align-items: center;
          gap: 15px;
          margin-bottom: 20px;
        }

        .progress-bar {
          flex: 1;
          height: 8px;
          background: #e0e0e0;
          border-radius: 4px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #4CAF50, #45a049);
          border-radius: 4px;
          transition: width 0.3s ease;
        }

        .progress-percentage {
          font-weight: bold;
          color: #333;
          min-width: 40px;
        }

        .progress-details {
          border-top: 1px solid #eee;
          padding-top: 15px;
        }

        .progress-stats {
          display: flex;
          justify-content: space-between;
          font-size: 14px;
          color: #666;
        }
      </style>
    `;

    // 添加到页面
    document.head.insertAdjacentHTML('beforeend', progressCSS);
    document.body.insertAdjacentHTML('beforeend', progressHTML);
  }

  // 更新进度 - 优化版本，移除时间估算
  updateProgress(status, percentage, totalBookmarks = 0, totalFolders = 0, current = 0, total = 0) {
    const statusEl = document.getElementById('progress-status');
    const fillEl = document.getElementById('progress-fill');
    const percentageEl = document.getElementById('progress-percentage');
    const bookmarksEl = document.getElementById('progress-bookmarks');
    const foldersEl = document.getElementById('progress-folders');
    const currentEl = document.getElementById('progress-current');

    if (statusEl) statusEl.textContent = status;
    if (fillEl) fillEl.style.width = `${Math.min(100, Math.max(0, percentage))}%`;
    if (percentageEl) percentageEl.textContent = `${Math.round(percentage)}%`;
    if (bookmarksEl) bookmarksEl.textContent = `书签: ${totalBookmarks}`;
    if (foldersEl) foldersEl.textContent = `文件夹: ${totalFolders}`;
    if (currentEl && total > 0) currentEl.textContent = `当前: ${current}/${total}`;

    // 只在重要进度点记录日志，减少性能影响
    if (percentage % 10 === 0 || percentage >= 95) {
      console.log(`📊 进度更新: ${status} (${percentage}%)`);
    }
  }

  // 隐藏进度模态框
  hideProgressModal() {
    const modal = document.getElementById('import-progress-modal');
    const styles = document.getElementById('progress-modal-styles');

    if (modal) {
      modal.style.animation = 'progressModalSlideOut 0.3s ease-in forwards';
      setTimeout(() => {
        modal.remove();
      }, 300);
    }

    if (styles) {
      styles.remove();
    }

    // 添加退出动画CSS
    if (!document.getElementById('progress-modal-exit-styles')) {
      const exitCSS = `
        <style id="progress-modal-exit-styles">
          @keyframes progressModalSlideOut {
            from {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
            to {
              opacity: 0;
              transform: translateY(-20px) scale(0.95);
            }
          }
        </style>
      `;
      document.head.insertAdjacentHTML('beforeend', exitCSS);

      // 清理退出样式
      setTimeout(() => {
        const exitStyles = document.getElementById('progress-modal-exit-styles');
        if (exitStyles) exitStyles.remove();
      }, 500);
    }
  }

  // 备用导入策略：逐个导入（如果批量导入失败）
  async importBookmarkNodesOneByOne(bookmarks, parentId) {
    console.log(`🔄 使用备用策略：逐个导入 ${bookmarks.length} 个项目`);

    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    // 创建导入文件夹
    const importFolder = await chrome.bookmarks.create({
      parentId: parentId,
      title: `导入_${new Date().toLocaleString()}`
    });

    console.log(`📁 创建导入文件夹: ${importFolder.title} (ID: ${importFolder.id})`);

    // 只导入书签，忽略文件夹结构
    const bookmarkItems = bookmarks.filter(b => b.type === 'bookmark');

    for (let i = 0; i < bookmarkItems.length; i++) {
      const bookmark = bookmarkItems[i];

      console.log(`🔖 逐个导入 ${i + 1}/${bookmarkItems.length}: "${bookmark.title}"`);

      try {
        // 验证URL
        if (!bookmark.url || !this.isValidUrl(bookmark.url)) {
          console.warn(`⚠️ 跳过无效URL: ${bookmark.url}`);
          skippedCount++;
          continue;
        }

        // 更长的延迟确保稳定性
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }

        const createdBookmark = await chrome.bookmarks.create({
          parentId: importFolder.id,
          title: bookmark.title || 'Untitled',
          url: bookmark.url
        });

        successCount++;
        console.log(`✅ 逐个导入成功: ${bookmark.title} (ID: ${createdBookmark.id})`);

      } catch (error) {
        console.error(`❌ 逐个导入失败: ${bookmark.title}`, error);
        errorCount++;

        // 如果连续失败，暂停更长时间
        if (errorCount > 2) {
          console.log(`⏸️ 连续失败，暂停2秒`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }

    console.log(`📊 逐个导入完成: 成功 ${successCount}, 失败 ${errorCount}, 跳过 ${skippedCount}`);
    return { successCount, errorCount, skippedCount };
  }

  // 导入书签节点 - 带进度跟踪的增强版本
  async importBookmarkNodesWithProgress(bookmarks, parentId, totalBookmarks, totalFolders) {
    console.log(`🚀 开始导入书签，总数: ${bookmarks.length}`);
    console.log(`📁 父文件夹ID: ${parentId}`);

    const folderMap = new Map(); // 路径 -> 文件夹ID的映射
    folderMap.set('', parentId); // 根路径映射到父文件夹ID

    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    // 首先创建所有文件夹（按层级顺序）
    const folders = bookmarks.filter(b => b.type === 'folder');

    // 按路径深度排序，确保父文件夹先于子文件夹创建
    folders.sort((a, b) => a.path.length - b.path.length);

    console.log(`📂 需要创建 ${folders.length} 个文件夹`);
    this.updateProgress(`正在创建文件夹...`, 20, totalBookmarks, totalFolders, 0, folders.length);

    for (let i = 0; i < folders.length; i++) {
      const folder = folders[i];
      const pathKey = folder.path.join('/');
      const parentFolderId = folderMap.get(pathKey) || parentId;

      try {
        // 优化延迟：减少API调用间隔
        if (i > 0 && i % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }

        const createdFolder = await chrome.bookmarks.create({
          parentId: parentFolderId,
          title: folder.title
        });

        const currentPathKey = [...folder.path, folder.title].join('/');
        folderMap.set(currentPathKey, createdFolder.id);
        successCount++;

        // 更新进度
        const folderProgress = 20 + (i + 1) / folders.length * 30; // 20-50%
        this.updateProgress(`创建文件夹: ${folder.title}`, folderProgress, totalBookmarks, totalFolders, i + 1, folders.length);

      } catch (error) {
        console.error(`❌ 创建文件夹失败: ${folder.title}`, error);
        errorCount++;

        // 如果是权限错误，使用默认父文件夹
        if (error.message.includes('permission') || error.message.includes('access')) {
          const currentPathKey = [...folder.path, folder.title].join('/');
          folderMap.set(currentPathKey, parentId);
        }
      }
    }

    // 打印文件夹映射表用于调试
    console.log(`🗂️ 文件夹映射表:`);
    for (const [path, id] of folderMap.entries()) {
      console.log(`  "${path}" -> ${id}`);
    }

    // 然后创建所有书签
    const bookmarkItems = bookmarks.filter(b => b.type === 'bookmark');
    console.log(`🔖 需要创建 ${bookmarkItems.length} 个书签`);
    this.updateProgress(`正在导入书签...`, 50, totalBookmarks, totalFolders, 0, bookmarkItems.length);

    for (let i = 0; i < bookmarkItems.length; i++) {
      const bookmark = bookmarkItems[i];
      const pathKey = bookmark.path.join('/');
      const targetFolderId = folderMap.get(pathKey) || parentId;

      try {
        // 验证URL格式
        if (!bookmark.url || !this.isValidUrl(bookmark.url)) {
          skippedCount++;
          continue;
        }

        // 优化延迟：大幅减少等待时间
        if (i > 0 && i % 20 === 0) {
          // 每20个书签暂停一次，减少API压力
          await new Promise(resolve => setTimeout(resolve, 100));
        } else if (i > 0) {
          // 每个书签之间的最小延迟
          await new Promise(resolve => setTimeout(resolve, 25));
        }

        const createdBookmark = await chrome.bookmarks.create({
          parentId: targetFolderId,
          title: bookmark.title || 'Untitled',
          url: bookmark.url
        });

        successCount++;

        // 更新进度 - 减少更新频率以提高性能
        if (i % 5 === 0 || i === bookmarkItems.length - 1) {
          const bookmarkProgress = 50 + (i + 1) / bookmarkItems.length * 40; // 50-90%
          this.updateProgress(`导入书签: ${bookmark.title}`, bookmarkProgress, totalBookmarks, totalFolders, i + 1, bookmarkItems.length);
        }

      } catch (error) {
        console.error(`❌ 创建书签失败: ${bookmark.title}`, error);
        errorCount++;

        // 如果连续失败太多，暂停一下
        if (errorCount > 5 && errorCount > successCount) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }

    const totalProcessed = successCount + errorCount + skippedCount;
    console.log(`📊 导入完成统计:`);
    console.log(`  - 成功: ${successCount} 个`);
    console.log(`  - 失败: ${errorCount} 个`);
    console.log(`  - 跳过: ${skippedCount} 个`);
    console.log(`  - 总计: ${totalProcessed} 个`);

    return { successCount, errorCount, skippedCount };
  }

  // 统计导入的书签数量
  async countImportedBookmarks(folderId) {
    try {
      const children = await chrome.bookmarks.getChildren(folderId);
      let count = 0;

      for (const child of children) {
        if (child.url) {
          count++; // 这是一个书签
        } else if (child.children !== undefined) {
          count += await this.countImportedBookmarks(child.id); // 递归统计子文件夹
        }
      }

      return count;
    } catch (error) {
      console.error('统计书签数量失败:', error);
      return 0;
    }
  }

  // 导出书签
  async exportBookmarks() {
    try {
      const bookmarkTree = await chrome.bookmarks.getTree();
      const htmlContent = this.generateBookmarkHTML(bookmarkTree);

      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `bookmarks_${new Date().toISOString().slice(0, 10)}.html`;
      a.click();

      URL.revokeObjectURL(url);

      this.showNotification('书签导出成功', 'success');

    } catch (error) {
      console.error('导出书签失败:', error);
      this.showNotification('导出书签失败', 'error');
    }
  }

  // 生成书签HTML
  generateBookmarkHTML(bookmarkTree) {
    let html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
`;

    const processNode = (nodes, level = 0) => {
      for (const node of nodes) {
        if (node.url) {
          html += `${'  '.repeat(level)}<DT><A HREF="${node.url}">${node.title || 'Untitled'}</A>\n`;
        } else if (node.children) {
          html += `${'  '.repeat(level)}<DT><H3>${node.title || 'Untitled Folder'}</H3>\n`;
          html += `${'  '.repeat(level)}<DL><p>\n`;
          processNode(node.children, level + 1);
          html += `${'  '.repeat(level)}</DL><p>\n`;
        }
      }
    };

    processNode(bookmarkTree);
    html += '</DL><p>';

    return html;
  }



  // 清除缓存
  clearCache() {
    if (confirm('确定要清除所有缓存数据吗？这将清除本地存储的设置和临时数据。')) {
      try {
        // 清除设置
        localStorage.removeItem('bookmarkManagerSettings');

        // 清除其他可能的缓存数据
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
          if (key.startsWith('bookmark_') || key.startsWith('quickfinder_')) {
            localStorage.removeItem(key);
          }
        });

        this.showNotification('缓存已清除', 'success');

        // 重新加载页面以应用更改
        setTimeout(() => {
          window.location.reload();
        }, 1000);

      } catch (error) {
        console.error('清除缓存失败:', error);
        this.showNotification('清除缓存失败', 'error');
      }
    }
  }

  // 显示通知
  showNotification(message, type = 'info') {
    // 创建通知元素
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;

    // 添加样式
    Object.assign(notification.style, {
      position: 'fixed',
      top: '20px',
      right: '20px',
      padding: '12px 20px',
      borderRadius: '8px',
      color: 'white',
      fontWeight: '500',
      zIndex: '9999',
      transform: 'translateX(100%)',
      transition: 'transform 0.3s ease',
      maxWidth: '300px',
      wordWrap: 'break-word'
    });

    // 设置背景色
    switch (type) {
      case 'success':
        notification.style.background = '#10b981';
        break;
      case 'error':
        notification.style.background = '#f44336';
        break;
      case 'warning':
        notification.style.background = '#ff9800';
        break;
      default:
        notification.style.background = '#667eea';
    }

    document.body.appendChild(notification);

    // 显示动画
    setTimeout(() => {
      notification.style.transform = 'translateX(0)';
    }, 100);

    // 自动隐藏
    setTimeout(() => {
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }

  // 添加拖拽事件
  addDragEvents(element, item) {
    // 拖拽开始
    element.addEventListener('dragstart', (e) => {
      if (this.selectionMode) {
        e.preventDefault(); // 多选模式下禁用拖拽
        return;
      }

      this.draggedItem = item;
      element.classList.add('dragging');
      element.style.opacity = '0.5';

      // 设置拖拽数据
      e.dataTransfer.setData('text/plain', item.id);
      e.dataTransfer.effectAllowed = 'move';

      // 显示拖拽目标区域（如果不在根目录）
      this.showDragTargetArea();
    });

    // 拖拽结束
    element.addEventListener('dragend', (e) => {
      element.classList.remove('dragging');
      element.style.opacity = '1';
      this.draggedItem = null;

      // 清除所有拖拽样式
      document.querySelectorAll('.bookmark-item').forEach(item => {
        item.classList.remove('drag-over', 'drag-over-folder');
      });

      // 隐藏插入线和拖拽目标区域
      this.hideDragInsertLine();
      this.hideDragTargetArea();
    });

    // 拖拽进入
    element.addEventListener('dragenter', (e) => {
      if (this.draggedItem && this.draggedItem.id !== item.id) {
        e.preventDefault();
        // 如果拖拽的是文件夹到文件夹，或者书签到文件夹，显示文件夹高亮
        if (item.type === 'folder' && this.isDropIntoFolder(e, element)) {
          element.classList.add('drag-over-folder');
        } else {
          element.classList.add('drag-over');
        }
      }
    });

    // 拖拽离开
    element.addEventListener('dragleave', (e) => {
      // 检查是否真的离开了元素
      if (!element.contains(e.relatedTarget)) {
        element.classList.remove('drag-over', 'drag-over-folder');
      }
    });

    // 拖拽悬停
    element.addEventListener('dragover', (e) => {
      if (this.draggedItem && this.draggedItem.id !== item.id) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        // 判断是否要显示插入线还是文件夹高亮
        if (item.type === 'folder' && this.isDropIntoFolder(e, element)) {
          // 拖拽到文件夹中心区域，显示文件夹高亮
          this.hideDragInsertLine();
          element.classList.add('drag-over-folder');
        } else {
          // 拖拽到边缘区域或非文件夹，显示插入线
          element.classList.remove('drag-over-folder');
          this.showDragInsertLine(e, element, item);
        }
      }
    });

    // 拖拽放置
    element.addEventListener('drop', (e) => {
      e.preventDefault();
      element.classList.remove('drag-over', 'drag-over-folder');

      if (this.draggedItem && this.draggedItem.id !== item.id) {
        // 判断是拖拽到文件夹内部还是进行排序
        if (item.type === 'folder' && this.isDropIntoFolder(e, element)) {
          // 拖拽到文件夹中心区域，移动到文件夹内部
          this.handleDropIntoFolder(this.draggedItem, item);
        } else {
          // 拖拽到边缘区域，进行排序
          this.handleDrop(this.draggedItem, item);
        }
      }
    });
  }

  // 处理拖拽放置（排序）
  async handleDrop(draggedItem, targetItem) {
    try {
      console.log('🎯 开始处理拖放操作');
      console.log('拖动项:', draggedItem.title, '(ID:', draggedItem.id, ')');
      console.log('目标项:', targetItem.title, '(ID:', targetItem.id, ')');

      if (this.dragInsertInfo) {
        console.log('📍 使用精确插入模式');
        console.log('插入信息:', this.dragInsertInfo);
        // 使用插入线信息进行精确插入
        await this.insertItemAtPosition(draggedItem, this.dragInsertInfo);
      } else {
        console.log('📍 使用兼容模式重排序');
        // 拖拽到同级位置进行重排序（兼容旧逻辑）
        await this.reorderItems(draggedItem, targetItem);
      }

      console.log('🔄 重新加载书签数据');
      // 重新加载和渲染
      await this.loadBookmarks();
      this.renderBookmarks();

      this.showNotification(`已移动 "${draggedItem.title}"`, 'success');
      console.log('✅ 拖放操作完成');

    } catch (error) {
      console.error('❌ 拖拽操作失败:', error);
      this.showNotification('移动失败: ' + error.message, 'error');
    }
  }

  // 移动项目到文件夹
  async moveItemToFolder(item, targetFolder) {
    await chrome.bookmarks.move(item.id, {
      parentId: targetFolder.id
    });
  }

  // 精确插入项目到指定位置 - 修复从右到左拖动问题
  async insertItemAtPosition(draggedItem, insertInfo) {
    const { targetItem, insertBefore } = insertInfo;

    console.log('🎯 拖放调试信息:');
    console.log('拖动项:', draggedItem.title, '索引:', draggedItem.index);
    console.log('目标项:', targetItem.title, '索引:', targetItem.index);
    console.log('插入位置:', insertBefore ? '前面' : '后面');

    // 获取目标项目的索引
    let targetIndex = parseInt(targetItem.index) || 0;
    const draggedIndex = parseInt(draggedItem.index) || 0;

    // 如果插入到后面，索引+1
    if (!insertBefore) {
      targetIndex += 1;
    }

    console.log('初始目标索引:', targetIndex);

    // 关键修复：只有在同一父级内移动且需要调整时才减1
    if (draggedItem.parentId === targetItem.parentId) {
      // 如果拖动项在目标位置前面，且最终位置会受到拖动项移除的影响
      if (draggedIndex < targetIndex) {
        targetIndex -= 1;
        console.log('调整后索引:', targetIndex, '(拖动项在前面，索引-1)');
      }
    }

    console.log('最终目标索引:', targetIndex);

    // 移动拖拽项目到目标位置
    await chrome.bookmarks.move(draggedItem.id, {
      parentId: targetItem.parentId,
      index: targetIndex
    });

    console.log('✅ 移动完成');
  }

  // 重新排序项目（兼容旧逻辑）
  async reorderItems(draggedItem, targetItem) {
    // 获取目标项目的索引
    const targetIndex = parseInt(targetItem.index) || 0;

    // 移动拖拽项目到目标位置
    await chrome.bookmarks.move(draggedItem.id, {
      parentId: targetItem.parentId,
      index: targetIndex
    });
  }

  // 绑定容器拖拽事件
  bindContainerDragEvents() {
    const container = document.getElementById('bookmark-container');

    container.addEventListener('dragover', (e) => {
      if (this.draggedItem) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      }
    });

    container.addEventListener('drop', (e) => {
      e.preventDefault();

      // 如果拖拽到空白区域，移动到当前文件夹的末尾
      if (this.draggedItem && !e.target.closest('.bookmark-item')) {
        this.moveToEndOfFolder(this.draggedItem);
      }
    });
  }

  // 移动到文件夹末尾
  async moveToEndOfFolder(item) {
    try {
      await chrome.bookmarks.move(item.id, {
        parentId: this.currentFolder === 'root' ? '1' : this.currentFolder // 根目录默认移动到书签栏
      });

      // 重新加载和渲染
      await this.loadBookmarks();
      this.renderBookmarks();

      this.showNotification(`已移动 "${item.title}" 到末尾`, 'success');

    } catch (error) {
      console.error('移动到末尾失败:', error);
      this.showNotification('移动失败: ' + error.message, 'error');
    }
  }

  // 显示拖拽插入线
  showDragInsertLine(event, targetElement, targetItem) {
    if (!this.dragInsertLine) {
      this.hideDragInsertLine();
      return;
    }

    const rect = targetElement.getBoundingClientRect();
    const mouseX = event.clientX;
    const elementCenterX = rect.left + rect.width / 2;

    // 判断插入位置：鼠标在元素左半部分插入到前面，右半部分插入到后面
    const insertBefore = mouseX < elementCenterX;

    console.log('🖱️ 鼠标位置调试:');
    console.log('鼠标X:', mouseX);
    console.log('元素中心X:', elementCenterX);
    console.log('元素范围:', rect.left, '-', rect.right);
    console.log('插入位置:', insertBefore ? '前面' : '后面');

    // 计算插入线位置
    let lineX;
    if (insertBefore) {
      lineX = rect.left - 2; // 插入到目标元素左侧
    } else {
      lineX = rect.right - 1; // 插入到目标元素右侧
    }

    // 设置插入线样式和位置（垂直线）
    this.dragInsertLine.style.left = lineX + 'px';
    this.dragInsertLine.style.top = rect.top + 'px';
    this.dragInsertLine.style.height = rect.height + 'px';
    this.dragInsertLine.classList.add('visible');

    // 存储插入信息
    this.dragInsertInfo = {
      targetItem,
      insertBefore,
      targetElement
    };

    console.log('💾 存储插入信息:', this.dragInsertInfo);
  }

  // 隐藏拖拽插入线
  hideDragInsertLine() {
    if (this.dragInsertLine) {
      this.dragInsertLine.classList.remove('visible');
    }
    this.dragInsertInfo = null;
  }

  // 显示拖拽目标区域
  showDragTargetArea() {
    if (this.currentFolder === 'root' || this.currentFolder === 'recent' || this.currentFolder === 'frequent') {
      return; // 根目录和特殊页面不显示
    }

    const dragTargetArea = document.getElementById('drag-target-area');
    if (dragTargetArea) {
      dragTargetArea.style.display = 'flex';

      // 绑定拖拽事件（如果还没绑定）
      if (!dragTargetArea.hasAttribute('data-drag-events-bound')) {
        this.bindDragTargetAreaEvents(dragTargetArea);
        dragTargetArea.setAttribute('data-drag-events-bound', 'true');
      }
    }
  }

  // 隐藏拖拽目标区域
  hideDragTargetArea() {
    const dragTargetArea = document.getElementById('drag-target-area');
    if (dragTargetArea) {
      dragTargetArea.style.display = 'none';
      dragTargetArea.classList.remove('drag-over');
    }
  }

  // 绑定拖拽目标区域事件
  bindDragTargetAreaEvents(dragTargetArea) {
    dragTargetArea.addEventListener('dragover', (e) => {
      if (this.draggedItem) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        dragTargetArea.classList.add('drag-over');
      }
    });

    dragTargetArea.addEventListener('dragleave', (e) => {
      // 检查是否真的离开了区域
      if (!dragTargetArea.contains(e.relatedTarget)) {
        dragTargetArea.classList.remove('drag-over');
      }
    });

    dragTargetArea.addEventListener('drop', (e) => {
      e.preventDefault();
      dragTargetArea.classList.remove('drag-over');

      if (this.draggedItem) {
        this.handleDropToParent(this.draggedItem);
      }
    });
  }

  // 处理拖拽到父级目录
  async handleDropToParent(draggedItem) {
    try {
      // 查找当前文件夹的父文件夹
      const currentFolder = this.folders.find(f => f.id === this.currentFolder);
      let targetParentId = 'root';

      if (currentFolder) {
        const parentId = currentFolder.parentId;

        // 如果父文件夹是书签栏(1)或其他书签(2)，移动到根目录显示
        if (parentId === '1' || parentId === '2') {
          targetParentId = parentId;
        } else {
          targetParentId = parentId;
        }
      } else {
        // 如果找不到当前文件夹，移动到书签栏
        targetParentId = '1';
      }

      // 移动项目
      await chrome.bookmarks.move(draggedItem.id, {
        parentId: targetParentId
      });

      // 重新加载和渲染
      await this.loadBookmarks();
      this.renderBookmarks();

      const targetName = targetParentId === '1' ? '书签栏' :
                        targetParentId === '2' ? '其他书签' :
                        this.folders.find(f => f.id === targetParentId)?.title || '上级目录';

      this.showNotification(`已将 "${draggedItem.title}" 移动到 "${targetName}"`, 'success');

    } catch (error) {
      console.error('移动到上级目录失败:', error);
      this.showNotification('移动失败: ' + error.message, 'error');
    }
  }

  // 判断是否拖拽到文件夹内部（中心区域）
  isDropIntoFolder(event, element) {
    const rect = element.getBoundingClientRect();
    const mouseX = event.clientX;
    const mouseY = event.clientY;

    // 定义中心区域：距离边缘20px的区域
    const margin = 20;
    const centerLeft = rect.left + margin;
    const centerRight = rect.right - margin;
    const centerTop = rect.top + margin;
    const centerBottom = rect.bottom - margin;

    return mouseX >= centerLeft && mouseX <= centerRight &&
           mouseY >= centerTop && mouseY <= centerBottom;
  }

  // 处理拖拽到文件夹内部
  async handleDropIntoFolder(draggedItem, targetFolder) {
    try {
      await this.moveItemToFolder(draggedItem, targetFolder);

      // 重新加载和渲染
      await this.loadBookmarks();
      this.renderBookmarks();

      this.showNotification(`已将 "${draggedItem.title}" 移动到文件夹 "${targetFolder.title}"`, 'success');

    } catch (error) {
      console.error('移动到文件夹失败:', error);
      this.showNotification('移动失败: ' + error.message, 'error');
    }
  }
}

// 初始化书签管理器
document.addEventListener('DOMContentLoaded', () => {
  new BookmarkManager();
});
