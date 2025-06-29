// Content script for QuickFinder extension

class QuickFinder {
  constructor() {
    this.overlay = null;
    this.searchInput = null;
    this.resultsContainer = null;
    this.modeToggle = null;
    this.breadcrumb = null;
    this.isVisible = false;
    this.currentResults = [];
    this.selectedIndex = -1;
    this.searchTimeout = null;
    this.displayMode = 'visited'; // 'recent' or 'visited'
    this.currentFolderId = null; // 当前文件夹ID
    this.folderHistory = []; // 文件夹导航历史
    this.buttonOrder = ['visited', 'recent', 'bookmarks']; // 按钮顺序
    this.lastSelectedMode = 'visited'; // 记住上次选中的模式
    this.settingsLoaded = false; // 标记设置是否已加载
    this.currentTab = 'search'; // 当前标签页: 'search', 'ai-suggest', 'ai-organize'
    this.aiEnabled = false; // AI功能是否启用

    // 拼音库加载状态
    this.pinyinLibLoaded = false;
    this.pinyinLibLoading = false;

    // Category data cache for efficient tag detection
    this.categoryCache = {
      bookmarks: new Set(),
      frequent: new Set(),
      recent: new Set(),
      lastUpdated: 0,
      cacheTimeout: 30000 // 30 seconds cache
    };

    // 图标缓存和加载优化
    this.iconCache = new Map(); // URL -> 图标数据缓存
    this.iconLoadingQueue = new Set(); // 正在加载的图标URL
    this.defaultIcon = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTggMTRBNiA2IDAgMSAwIDggMkE2IDYgMCAwIDAgOCAxNFoiIGZpbGw9IiM2NjdlZWEiLz4KPHN2Zz4K'; // 默认图标
    
    // 事件屏蔽相关
    this.globalEventHandler = null;
    this.isBlockingEvents = false;
    this.originalPushState = null;
    this.originalReplaceState = null;
    this.beforeUnloadHandler = null;

    this.init();
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.local.get(['buttonOrder', 'lastSelectedMode']);
      // Try local storage first, then sync storage as fallback
      let aiResult = await chrome.storage.local.get(['aiSettings']);
      if (!aiResult.aiSettings) {
        console.log('🔄 AI settings not found in local storage, trying sync storage...');
        aiResult = await chrome.storage.sync.get(['aiSettings']);
      }

      console.log('Loaded settings from storage:', result);
      console.log('Loaded AI settings from storage:', aiResult);

      if (result.buttonOrder && Array.isArray(result.buttonOrder)) {
        this.buttonOrder = result.buttonOrder;
        console.log('Loaded button order:', this.buttonOrder);
      } else {
        console.log('Using default button order:', this.buttonOrder);
      }

      if (result.lastSelectedMode) {
        this.lastSelectedMode = result.lastSelectedMode;
        this.displayMode = result.lastSelectedMode;
        console.log('Loaded last selected mode:', this.lastSelectedMode);
      } else {
        console.log('Using default mode:', this.displayMode);
      }

      // Check if AI is enabled and configured
      const aiSettings = aiResult.aiSettings;
      console.log('AI settings object:', aiSettings);

      if (aiSettings) {
        console.log('AI settings details:', {
          provider: aiSettings.provider,
          model: aiSettings.model,
          hasApiKey: !!aiSettings.apiKey,
          apiKeyLength: aiSettings.apiKey ? aiSettings.apiKey.length : 0,
          enabledFeatures: aiSettings.enabledFeatures
        });
      }

      this.aiEnabled = aiSettings &&
                      aiSettings.apiKey &&
                      aiSettings.apiKey.trim() !== '' &&
                      aiSettings.provider &&
                      aiSettings.enabledFeatures &&
                      aiSettings.enabledFeatures.length > 0;

      console.log('AI enabled final result:', this.aiEnabled);

      // Also check if smart-search is specifically enabled
      const smartSearchEnabled = aiSettings &&
                                 aiSettings.enabledFeatures &&
                                 aiSettings.enabledFeatures.includes('smart-search');
      console.log('Smart search enabled:', smartSearchEnabled);

    } catch (error) {
      console.error('Error loading settings:', error);
      this.aiEnabled = false;
    }
  }

  async saveSettings() {
    try {
      await chrome.storage.local.set({
        buttonOrder: this.buttonOrder,
        lastSelectedMode: this.lastSelectedMode
      });
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  }
  
  init() {
    // 加载拼音库
    this.loadPinyinLibrary();

    // 初始化时清理任何可能存在的beforeunload监听器
    this.cleanupBeforeUnloadListeners();

    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'toggle-search') {
        this.toggle();
      }
    });

    // 统一使用Ctrl+Q快捷键（所有平台）
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'q') {
        e.preventDefault();
        e.stopPropagation();
        this.toggle();
      }

      // Additional focus shortcut: Ctrl+F or Cmd+F when overlay is visible
      if (this.isVisible && (e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        e.stopPropagation();
        this.focusSearchInput();
      }

      // Escape key to focus search input when overlay is visible
      if (this.isVisible && e.key === 'Escape' && this.searchInput && this.searchInput.value === '') {
        e.preventDefault();
        this.focusSearchInput();
      }
    }, true);
  }
  
  toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }
  
  async show() {
    if (this.isVisible) return;

    // 每次显示时都重新加载设置，确保AI配置是最新的
    console.log('🔄 Reloading settings on show...');
    await this.loadSettings();
    this.settingsLoaded = true;

    // Update category cache for tag detection
    this.updateCategoryCache().catch(error => {
      console.warn('Failed to update category cache:', error);
    });

    this.createOverlay();
    document.body.appendChild(this.overlay);
    this.isVisible = true;

    // 添加全局事件监听器，阻止与下层页面的交互
    this.addGlobalEventBlockers();

    // Focus the search input with multiple attempts for reliability
    this.focusSearchInput();

    // Load initial content based on current mode
    this.loadInitialContent();
  }
  
  hide() {
    if (!this.isVisible) return;

    // 保存当前状态
    this.saveSelectedMode();

    // 清除URL提示和样式
    if (this.searchInput) {
      this.searchInput.classList.remove('url-detected');
    }
    this.hideURLHint();

    // 清理beforeunload监听器，防止页面离开确认对话框
    this.cleanupBeforeUnloadListeners();

    // 移除全局事件监听器
    this.removeGlobalEventBlockers();

    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
    this.isVisible = false;
    this.selectedIndex = -1;
    this.currentResults = [];
  }

  // 专门的聚焦方法，确保在所有情况下都能正常工作
  focusSearchInput() {
    const attemptFocus = (attempt = 1) => {
      if (attempt > 5) {
        console.warn('⚠️ Failed to focus search input after 5 attempts');
        return;
      }

      setTimeout(() => {
        if (this.searchInput && this.isVisible) {
          try {
            // 确保元素可见且可聚焦
            if (this.searchInput.offsetParent !== null) {
              this.searchInput.focus();
              console.log(`✅ Search input focused on attempt ${attempt}`);

              // 验证聚焦是否成功
              setTimeout(() => {
                if (document.activeElement !== this.searchInput) {
                  console.log(`⚠️ Focus verification failed on attempt ${attempt}, retrying...`);
                  attemptFocus(attempt + 1);
                }
              }, 50);
            } else {
              console.log(`⚠️ Search input not visible on attempt ${attempt}, retrying...`);
              attemptFocus(attempt + 1);
            }
          } catch (error) {
            console.error(`❌ Error focusing search input on attempt ${attempt}:`, error);
            attemptFocus(attempt + 1);
          }
        } else {
          console.log(`⚠️ Search input not available on attempt ${attempt}, retrying...`);
          attemptFocus(attempt + 1);
        }
      }, attempt * 50); // 递增延迟：50ms, 100ms, 150ms, 200ms, 250ms
    };

    attemptFocus();
  }
  
  createOverlay() {
    // Create main overlay container
    this.overlay = document.createElement('div');
    this.overlay.id = 'quickfinder-overlay';
    this.overlay.className = 'quickfinder-overlay';
    
    // 检测页面背景是否为深色，设置相应属性
    this.detectAndSetTheme();

    // Create tabs container
    const tabsContainer = document.createElement('div');
    tabsContainer.className = 'quickfinder-tabs';
    this.createTabs(tabsContainer);

    // Create search container
    const searchContainer = document.createElement('div');
    searchContainer.className = 'quickfinder-search-container';

    // Create search input
    this.searchInput = document.createElement('input');
    this.searchInput.type = 'text';
    this.searchInput.placeholder = '搜索书签和历史记录...';
    this.searchInput.className = 'quickfinder-search-input';

    // Create mode toggle container
    const modeContainer = document.createElement('div');
    modeContainer.className = 'quickfinder-mode-container';

    // Create buttons based on saved order
    this.createModeButtons(modeContainer);

    // Create breadcrumb navigation (initially hidden)
    this.breadcrumb = document.createElement('div');
    this.breadcrumb.className = 'quickfinder-breadcrumb';
    this.breadcrumb.style.display = 'none';

    // Create results container
    this.resultsContainer = document.createElement('div');
    this.resultsContainer.className = 'quickfinder-results';

    // Assemble the overlay
    searchContainer.appendChild(this.searchInput);
    searchContainer.appendChild(modeContainer);
    this.overlay.appendChild(tabsContainer);
    this.overlay.appendChild(searchContainer);
    this.overlay.appendChild(this.breadcrumb);
    this.overlay.appendChild(this.resultsContainer);

    // Add event listeners
    this.addEventListeners();
  }

  createTabs(container) {
    const tabs = [
      { id: 'search', label: '搜索', icon: '🔍', enabled: true },
      { id: 'ai-suggest', label: 'AI建议', icon: '✨', enabled: this.aiEnabled },
      { id: 'ai-organize', label: '智能整理', icon: '📂', enabled: this.aiEnabled }
    ];

    tabs.forEach(tab => {
      const tabElement = document.createElement('div');
      tabElement.className = `quickfinder-tab ${tab.enabled ? '' : 'disabled'}`;
      tabElement.dataset.tabId = tab.id;
      tabElement.innerHTML = `${tab.icon} ${tab.label}`;

      if (tab.enabled) {
        tabElement.addEventListener('click', () => this.switchTab(tab.id));
      }

      container.appendChild(tabElement);
    });

    // Set default active tab
    const defaultTab = container.querySelector('[data-tab-id="search"]');
    if (defaultTab) {
      defaultTab.classList.add('active');
    }
  }

  createModeButtons(container) {
    console.log('Creating buttons with order:', this.buttonOrder);

    const buttonConfigs = {
      'visited': { text: '常访问', mode: 'visited' },
      'recent': { text: '最近历史', mode: 'recent' },
      'bookmarks': { text: '书签', mode: 'bookmarks' }
    };

    // Create buttons in saved order
    this.buttonOrder.forEach((mode, index) => {
      const config = buttonConfigs[mode];
      const button = document.createElement('button');
      button.textContent = config.text;
      button.className = 'quickfinder-mode-btn';
      button.dataset.mode = mode;
      button.draggable = true;

      // Set active state based on last selected mode
      if (mode === this.lastSelectedMode) {
        button.classList.add('active');
        this.displayMode = mode;
      }

      button.onclick = () => this.setDisplayMode(mode);

      // Add drag event listeners
      button.addEventListener('dragstart', (e) => this.handleDragStart(e));
      button.addEventListener('dragover', (e) => this.handleDragOver(e));
      button.addEventListener('drop', (e) => this.handleDrop(e));
      button.addEventListener('dragend', (e) => this.handleDragEnd(e));

      container.appendChild(button);
      console.log(`Button ${index}: ${mode} (${config.text})`);
    });
  }

  handleDragStart(e) {
    this.draggedElement = e.target;
    e.target.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.target.outerHTML);
  }

  handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    // 只在拖拽到按钮容器时处理
    const container = e.target.closest('.quickfinder-mode-container');
    if (!container || !this.draggedElement) return;

    const afterElement = this.getDragAfterElement(container, e.clientX);
    const dragging = this.draggedElement;

    if (afterElement == null) {
      container.appendChild(dragging);
    } else {
      container.insertBefore(dragging, afterElement);
    }
  }

  handleDrop(e) {
    e.preventDefault();

    // 只有当顺序真的改变时才保存
    if (this.updateButtonOrder()) {
      this.saveButtonOrder();
      console.log('Button order saved:', this.buttonOrder);
    }
  }

  async saveButtonOrder() {
    try {
      console.log('Saving button order to storage:', this.buttonOrder);
      await chrome.storage.local.set({
        buttonOrder: this.buttonOrder
      });

      // 验证保存是否成功
      const verification = await chrome.storage.local.get(['buttonOrder']);
      console.log('Verification - saved button order:', verification.buttonOrder);
    } catch (error) {
      console.error('Error saving button order:', error);
    }
  }

  handleDragEnd(e) {
    e.target.classList.remove('dragging');
    this.draggedElement = null;
  }

  getDragAfterElement(container, x) {
    const draggableElements = [...container.querySelectorAll('.quickfinder-mode-btn:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = x - box.left - box.width / 2;

      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: child };
      } else {
        return closest;
      }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  }

  updateButtonOrder() {
    const buttons = this.overlay.querySelectorAll('.quickfinder-mode-btn');
    const newOrder = Array.from(buttons).map(btn => btn.dataset.mode);

    // 只有当顺序真的改变时才更新
    if (JSON.stringify(newOrder) !== JSON.stringify(this.buttonOrder)) {
      console.log('Button order changed from:', this.buttonOrder, 'to:', newOrder);
      this.buttonOrder = newOrder;
      return true; // 返回true表示顺序确实改变了
    }
    return false; // 返回false表示顺序没有改变
  }

  // Switch between tabs
  switchTab(tabId) {
    this.currentTab = tabId;

    // Update tab states
    const tabs = this.overlay.querySelectorAll('.quickfinder-tab');
    tabs.forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tabId === tabId);
    });

    // Update content based on tab
    switch(tabId) {
      case 'search':
        this.showSearchContent();
        break;
      case 'ai-suggest':
        this.showAISuggestions();
        break;
      case 'ai-organize':
        this.showAIOrganizeOptions();
        break;
    }
  }

  showSearchContent() {
    // Show normal search interface
    const searchContainer = this.overlay.querySelector('.quickfinder-search-container');
    const breadcrumb = this.overlay.querySelector('.quickfinder-breadcrumb');

    searchContainer.style.display = 'block';
    if (this.currentFolderId) {
      breadcrumb.style.display = 'block';
    }

    // Focus search input when switching to search tab
    setTimeout(() => {
      if (this.searchInput) {
        this.searchInput.focus();
        console.log('✅ Search input focused when switching to search tab');
      }
    }, 100);

    // Load current content
    if (this.searchInput.value.trim() === '') {
      this.loadInitialContent();
    } else {
      this.performSearch(this.searchInput.value);
    }
  }

  async showAISuggestions() {
    // Hide search interface
    const searchContainer = this.overlay.querySelector('.quickfinder-search-container');
    const breadcrumb = this.overlay.querySelector('.quickfinder-breadcrumb');

    searchContainer.style.display = 'none';
    breadcrumb.style.display = 'none';

    // Show AI suggestions with tabs
    this.resultsContainer.innerHTML = `
      <div class="ai-suggestions-container">
        <div class="ai-suggestion-tabs">
          <button class="ai-tab-btn active" data-tab="recommendations">📋 智能推荐</button>
          <button class="ai-tab-btn" data-tab="forgotten">💎 遗忘宝藏</button>
          <button class="ai-tab-btn" data-tab="interests">📊 兴趣分析</button>
        </div>
        <div class="ai-suggestion-content">
          <div class="quickfinder-loading">正在生成AI建议...</div>
        </div>
      </div>
    `;

    // Add tab event listeners
    const tabButtons = this.resultsContainer.querySelectorAll('.ai-tab-btn');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => this.switchAISuggestionTab(btn.dataset.tab));
    });

    // Load default tab
    this.switchAISuggestionTab('recommendations');
  }

  async switchAISuggestionTab(tabType) {
    // Update tab states
    const tabButtons = this.resultsContainer.querySelectorAll('.ai-tab-btn');
    tabButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabType);
    });

    const contentArea = this.resultsContainer.querySelector('.ai-suggestion-content');
    contentArea.innerHTML = '<div class="quickfinder-loading">正在加载...</div>';

    try {
      // First, test if AI service is available
      console.log('🧪 Testing AI service availability...');
      const aiTest = await chrome.runtime.sendMessage({ action: 'test-ai-connection' });
      
      if (!aiTest || !aiTest.success) {
        console.log('❌ AI service not available:', aiTest);
        
        contentArea.innerHTML = `
          <div class="quickfinder-no-results">
            <div>AI功能未配置或不可用</div>
            <div style="margin-top: 8px; font-size: 12px; color: #666;">
              ${aiTest ? aiTest.error || '服务不可用' : '连接失败'}
            </div>
            <div style="margin-top: 10px; font-size: 12px; opacity: 0.7;">
              <button id="ai-diagnostic-btn" style="background: #4CAF50; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer;">
                🔧 诊断AI配置
              </button>
            </div>
          </div>
        `;
        
        // Add diagnostic button event
        const diagnosticBtn = contentArea.querySelector('#ai-diagnostic-btn');
        if (diagnosticBtn) {
          diagnosticBtn.addEventListener('click', async () => {
            await this.showAIDiagnostic(contentArea);
          });
        }
        return;
      }

      console.log('✅ AI service is available, proceeding with', tabType);

      const bookmarks = await chrome.runtime.sendMessage({ action: 'get-bookmarks' });
      const history = await chrome.runtime.sendMessage({ action: 'get-recent-history' });
      const currentContext = window.location.href;

      let result;

      switch(tabType) {
        case 'recommendations':
          result = await chrome.runtime.sendMessage({
            action: 'ai-recommend',
            bookmarks: bookmarks.slice(0, 20),
            context: currentContext
          });
          if (result) {
            this.renderRecommendations(result, contentArea);
          }
          break;

        case 'forgotten':
          result = await chrome.runtime.sendMessage({
            action: 'ai-discover-forgotten',
            bookmarks: bookmarks.slice(0, 30),
            history: history.slice(0, 10)
          });
          if (result) {
            this.renderForgottenBookmarks(result, contentArea);
          }
          break;

        case 'interests':
          result = await chrome.runtime.sendMessage({
            action: 'ai-analyze-interests',
            bookmarks: bookmarks.slice(0, 25),
            history: history.slice(0, 15)
          });
          if (result) {
            this.renderInterestAnalysis(result, contentArea);
          }
          break;
      }

      if (!result) {
        console.log('❌ AI function returned null result');
        contentArea.innerHTML = `
          <div class="quickfinder-no-results">
            <div>AI处理失败</div>
            <div style="margin-top: 8px; font-size: 12px; color: #666;">
              可能是API调用失败或返回数据格式错误
            </div>
            <div style="margin-top: 10px;">
              <button onclick="location.reload()" style="background: #2196F3; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer;">
                🔄 重试
              </button>
            </div>
          </div>
        `;
      }
    } catch (error) {
      console.error(`Error loading ${tabType}:`, error);
      contentArea.innerHTML = `
        <div class="quickfinder-no-results">
          <div>加载失败</div>
          <div style="margin-top: 8px; font-size: 12px; color: #666;">
            ${error.message || error.toString()}
          </div>
        </div>
      `;
    }
  }

  async showAIOrganizeOptions() {
    // Hide search interface
    const searchContainer = this.overlay.querySelector('.quickfinder-search-container');
    const breadcrumb = this.overlay.querySelector('.quickfinder-breadcrumb');

    searchContainer.style.display = 'none';
    breadcrumb.style.display = 'none';

    // Show AI organize options
    this.resultsContainer.innerHTML = `
      <div class="quickfinder-ai-organize">
        <h3>智能整理选项</h3>
        <div class="ai-organize-options">
          <button class="ai-organize-btn" data-action="categorize">
            📂 自动分类书签
          </button>
          <button class="ai-organize-btn" data-action="cleanup">
            🧹 清理重复和失效书签
          </button>
          <button class="ai-organize-btn" data-action="summarize">
            📝 生成书签摘要
          </button>
          <button class="ai-organize-btn" data-action="tags">
            🏷️ 自动添加标签
          </button>
        </div>
      </div>
    `;

    // Add event listeners for organize buttons
    const organizeButtons = this.resultsContainer.querySelectorAll('.ai-organize-btn');
    organizeButtons.forEach(btn => {
      btn.addEventListener('click', () => this.handleAIOrganize(btn.dataset.action));
    });
  }

  renderRecommendations(recommendations, container) {
    container.innerHTML = `
      <div class="recommendations-content">
        ${recommendations.relatedBookmarks && recommendations.relatedBookmarks.length > 0 ? `
          <div class="related-bookmarks-section">
            <h4>🔗 相关书签</h4>
            <div class="related-bookmarks-list">
              ${recommendations.relatedBookmarks.map(bookmark => `
                <div class="related-bookmark-item" data-url="${bookmark.url || '#'}">
                  <div class="bookmark-title">${bookmark.title}</div>
                  <div class="bookmark-reason">${bookmark.reason}</div>
                  <div class="relevance-score">相关度: ${Math.round(bookmark.relevanceScore * 100)}%</div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        ${recommendations.suggestedSearches && recommendations.suggestedSearches.length > 0 ? `
          <div class="suggested-searches-section">
            <h4>🔍 建议搜索</h4>
            <div class="suggested-searches">
              ${recommendations.suggestedSearches.map(search => `
                <button class="suggested-search-btn" data-search="${search}">${search}</button>
              `).join('')}
            </div>
          </div>
        ` : ''}

        ${recommendations.topicRecommendations && recommendations.topicRecommendations.length > 0 ? `
          <div class="topic-recommendations-section">
            <h4>📚 主题推荐</h4>
            <div class="topic-recommendations">
              ${recommendations.topicRecommendations.map(topic => `
                <div class="topic-item">
                  <h5>${topic.topic}</h5>
                  <p>${topic.description}</p>
                  <div class="topic-bookmarks">${topic.bookmarks.length} 个相关书签</div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        ${recommendations.insights && recommendations.insights.length > 0 ? `
          <div class="insights-section">
            <h4>💡 洞察</h4>
            <ul class="insights-list">
              ${recommendations.insights.map(insight => `<li>${insight}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
      </div>
    `;

    // Add click handlers for related bookmarks
    const bookmarkItems = container.querySelectorAll('.related-bookmark-item');
    bookmarkItems.forEach(item => {
      item.addEventListener('click', () => {
        const url = item.dataset.url;
        if (url && url !== '#') {
          window.open(url, '_blank');
          this.hide();
        }
      });
    });

    // Add click handlers for suggested searches
    const searchButtons = container.querySelectorAll('.suggested-search-btn');
    searchButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const searchTerm = btn.dataset.search;
        this.searchInput.value = searchTerm;
        this.switchTab('search');
        this.performSearch(searchTerm);
      });
    });
  }

  renderForgottenBookmarks(forgotten, container) {
    container.innerHTML = `
      <div class="forgotten-content">
        ${forgotten.forgottenGems && forgotten.forgottenGems.length > 0 ? `
          <div class="forgotten-gems-section">
            <h4>💎 遗忘的宝藏</h4>
            <div class="forgotten-gems-list">
              ${forgotten.forgottenGems.map(gem => `
                <div class="forgotten-gem-item" data-id="${gem.id}">
                  <div class="gem-title">${gem.title}</div>
                  <div class="gem-value">${gem.potentialValue}</div>
                  <div class="gem-relevance">${gem.relevanceToday}</div>
                  <div class="gem-reason">${gem.rediscoveryReason}</div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        ${forgotten.categories && forgotten.categories.length > 0 ? `
          <div class="forgotten-categories-section">
            <h4>📂 相关类别</h4>
            <div class="forgotten-categories">
              ${forgotten.categories.map(category => `
                <div class="forgotten-category-item">
                  <h5>${category.name}</h5>
                  <p>${category.whyRelevant}</p>
                  <div class="category-count">${category.bookmarks.length} 个书签</div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        ${forgotten.summary ? `
          <div class="forgotten-summary-section">
            <h4>📝 发现总结</h4>
            <p>${forgotten.summary}</p>
          </div>
        ` : ''}
      </div>
    `;
  }

  renderInterestAnalysis(analysis, container) {
    container.innerHTML = `
      <div class="interest-analysis-content">
        ${analysis.primaryInterests && analysis.primaryInterests.length > 0 ? `
          <div class="primary-interests-section">
            <h4>🎯 主要兴趣</h4>
            <div class="primary-interests">
              ${analysis.primaryInterests.map(interest => `
                <div class="interest-item">
                  <div class="interest-topic">${interest.topic}</div>
                  <div class="interest-confidence">置信度: ${Math.round(interest.confidence * 100)}%</div>
                  <div class="interest-trend trend-${interest.trend}">${interest.trend}</div>
                  <div class="interest-evidence">
                    证据: ${interest.evidence.join(', ')}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        ${analysis.emergingInterests && analysis.emergingInterests.length > 0 ? `
          <div class="emerging-interests-section">
            <h4>🌱 新兴兴趣</h4>
            <div class="emerging-interests">
              ${analysis.emergingInterests.map(interest => `
                <div class="emerging-interest-item">
                  <div class="interest-topic">${interest.topic}</div>
                  <div class="interest-confidence">置信度: ${Math.round(interest.confidence * 100)}%</div>
                  <div class="interest-indicators">
                    指标: ${interest.indicators.join(', ')}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        ${analysis.behaviorPatterns && analysis.behaviorPatterns.length > 0 ? `
          <div class="behavior-patterns-section">
            <h4>📈 行为模式</h4>
            <div class="behavior-patterns">
              ${analysis.behaviorPatterns.map(pattern => `
                <div class="pattern-item">
                  <div class="pattern-name">${pattern.pattern}</div>
                  <div class="pattern-description">${pattern.description}</div>
                  <div class="pattern-frequency">频率: ${pattern.frequency}</div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        ${analysis.recommendations && analysis.recommendations.length > 0 ? `
          <div class="analysis-recommendations-section">
            <h4>💡 个性化建议</h4>
            <div class="analysis-recommendations">
              ${analysis.recommendations.map(rec => `
                <div class="analysis-recommendation-item">
                  <div class="rec-type">${rec.type}</div>
                  <div class="rec-suggestion">${rec.suggestion}</div>
                  <div class="rec-reasoning">${rec.reasoning}</div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  async handleAIOrganize(action) {
    const actionBtn = this.resultsContainer.querySelector(`[data-action="${action}"]`);
    const originalText = actionBtn.textContent;

    actionBtn.textContent = '处理中...';
    actionBtn.disabled = true;

    try {
      let result;
      const bookmarks = await chrome.runtime.sendMessage({ action: 'get-bookmarks' });

      switch(action) {
        case 'categorize':
          result = await chrome.runtime.sendMessage({
            action: 'ai-categorize',
            bookmarks: bookmarks.slice(0, 50)
          });
          if (result) {
            this.showCategorizationResult(result);
          }
          break;

        case 'cleanup':
          result = await chrome.runtime.sendMessage({
            action: 'ai-detect-duplicates',
            bookmarks: bookmarks.slice(0, 100)
          });
          if (result) {
            this.showCleanupResult(result);
          }
          break;

        case 'summarize':
          result = await chrome.runtime.sendMessage({
            action: 'ai-bookmarks-summary',
            bookmarks: bookmarks.slice(0, 50)
          });
          if (result) {
            this.showBookmarksSummaryResult(result);
          }
          break;

        case 'tags':
          // Generate tags for bookmarks
          result = await this.generateBookmarkTags(bookmarks.slice(0, 30));
          if (result) {
            this.showTagsResult(result);
          }
          break;
      }

      if (!result) {
        actionBtn.textContent = 'AI功能不可用';
      }
    } catch (error) {
      console.error(`AI ${action} error:`, error);
      actionBtn.textContent = '处理失败';
    } finally {
      setTimeout(() => {
        actionBtn.textContent = originalText;
        actionBtn.disabled = false;
      }, 2000);
    }
  }

  showCategorizationResult(result) {
    const resultDiv = document.createElement('div');
    resultDiv.className = 'ai-categorization-result';
    resultDiv.innerHTML = `
      <h4>📂 自动分类建议</h4>
      <div class="categorization-content">
        ${result.suggestedFolders ? result.suggestedFolders.map(folder => `
          <div class="folder-suggestion">
            <h5>${folder.name}</h5>
            <p>${folder.description}</p>
            <div class="bookmark-count">${folder.bookmarks.length} 个书签</div>
          </div>
        `).join('') : ''}

        ${result.recommendations ? `
          <div class="ai-recommendations">
            <h5>💡 建议</h5>
            <p>${result.recommendations}</p>
          </div>
        ` : ''}
      </div>
    `;

    this.resultsContainer.appendChild(resultDiv);
  }

  showCleanupResult(result) {
    const resultDiv = document.createElement('div');
    resultDiv.className = 'ai-cleanup-result';
    resultDiv.innerHTML = `
      <h4>🧹 重复书签检测</h4>
      <div class="cleanup-content">
        ${result.duplicates && result.duplicates.length > 0 ? `
          <div class="duplicates-section">
            <h5>重复书签 (${result.duplicates.length}组)</h5>
            ${result.duplicates.map(group => `
              <div class="duplicate-group">
                <p><strong>原因:</strong> ${group.reason}</p>
                <ul>
                  ${group.bookmarks.map(bookmark => `
                    <li>${bookmark.title} (相似度: ${Math.round(bookmark.similarity * 100)}%)</li>
                  `).join('')}
                </ul>
              </div>
            `).join('')}
          </div>
        ` : '<p>未发现重复书签</p>'}

        ${result.similar && result.similar.length > 0 ? `
          <div class="similar-section">
            <h5>相似书签 (${result.similar.length}组)</h5>
            ${result.similar.map(group => `
              <div class="similar-group">
                <p><strong>原因:</strong> ${group.reason}</p>
                <ul>
                  ${group.bookmarks.map(bookmark => `
                    <li>${bookmark.title} (相似度: ${Math.round(bookmark.similarity * 100)}%)</li>
                  `).join('')}
                </ul>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;

    this.resultsContainer.appendChild(resultDiv);
  }

  showStructureResult(result) {
    const resultDiv = document.createElement('div');
    resultDiv.className = 'ai-structure-result';
    resultDiv.innerHTML = `
      <h4>📝 文件夹结构建议</h4>
      <div class="structure-content">
        ${result.structure ? result.structure.map(folder => `
          <div class="structure-folder">
            <h5>${folder.name}</h5>
            <p>${folder.description}</p>
            <div class="estimated-count">预计 ${folder.estimatedBookmarks} 个书签</div>
            ${folder.subfolders && folder.subfolders.length > 0 ? `
              <div class="subfolders">
                <h6>子文件夹:</h6>
                <ul>
                  ${folder.subfolders.map(sub => `
                    <li>${sub.name} - ${sub.description} (${sub.estimatedBookmarks}个)</li>
                  `).join('')}
                </ul>
              </div>
            ` : ''}
          </div>
        `).join('') : ''}

        ${result.principles ? `
          <div class="organization-principles">
            <h5>🎯 组织原则</h5>
            <ul>
              ${result.principles.map(principle => `<li>${principle}</li>`).join('')}
            </ul>
          </div>
        ` : ''}

        ${result.benefits ? `
          <div class="structure-benefits">
            <h5>✨ 优势</h5>
            <p>${result.benefits}</p>
          </div>
        ` : ''}
      </div>
    `;

    this.resultsContainer.appendChild(resultDiv);
  }

  async generateBookmarkTags(bookmarks) {
    try {
      // This would use AI to generate tags for bookmarks
      // For now, return a simple example
      return {
        tags: bookmarks.map(bookmark => ({
          id: bookmark.id,
          title: bookmark.title,
          suggestedTags: ['网站', '工具', '参考']
        }))
      };
    } catch (error) {
      console.error('Generate tags error:', error);
      return null;
    }
  }

  showBookmarksSummaryResult(result) {
    const resultDiv = document.createElement('div');
    resultDiv.className = 'ai-summary-result';
    resultDiv.innerHTML = `
      <h4>📝 书签集合分析</h4>
      <div class="summary-content">
        ${result.overview ? `
          <div class="overview-section">
            <h5>📊 整体概述</h5>
            <p>${result.overview}</p>
          </div>
        ` : ''}

        ${result.categories && result.categories.length > 0 ? `
          <div class="categories-section">
            <h5>📂 内容分类</h5>
            <div class="categories-grid">
              ${result.categories.map(cat => `
                <div class="category-item">
                  <div class="category-name">${cat.name}</div>
                  <div class="category-count">${cat.count} 个</div>
                  <div class="category-desc">${cat.description}</div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        ${result.topDomains && result.topDomains.length > 0 ? `
          <div class="domains-section">
            <h5>🌐 主要网站</h5>
            <div class="domains-list">
              ${result.topDomains.map(domain => `
                <div class="domain-item">
                  <span class="domain-name">${domain.domain}</span>
                  <span class="domain-count">${domain.count} 个</span>
                  <span class="domain-type">${domain.type}</span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        ${result.insights && result.insights.length > 0 ? `
          <div class="insights-section">
            <h5>💡 洞察分析</h5>
            <ul class="insights-list">
              ${result.insights.map(insight => `<li>${insight}</li>`).join('')}
            </ul>
          </div>
        ` : ''}

        ${result.recommendations && result.recommendations.length > 0 ? `
          <div class="recommendations-section">
            <h5>🎯 优化建议</h5>
            <ul class="recommendations-list">
              ${result.recommendations.map(rec => `<li>${rec}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
      </div>
    `;

    this.resultsContainer.appendChild(resultDiv);
  }

  showTagsResult(result) {
    const resultDiv = document.createElement('div');
    resultDiv.className = 'ai-tags-result';
    resultDiv.innerHTML = `
      <h4>🏷️ 自动标签建议</h4>
      <div class="tags-content">
        <p>标签功能正在开发中，敬请期待...</p>
      </div>
    `;

    this.resultsContainer.appendChild(resultDiv);
  }

  showAIResult(action, result) {
    const resultDiv = document.createElement('div');
    resultDiv.className = 'ai-result';
    resultDiv.innerHTML = `
      <h4>${this.getActionTitle(action)}结果</h4>
      <div class="ai-result-content">${typeof result === 'string' ? result : JSON.stringify(result, null, 2)}</div>
    `;

    this.resultsContainer.appendChild(resultDiv);
  }

  getActionTitle(action) {
    const titles = {
      'categorize': '自动分类',
      'cleanup': '智能清理',
      'summarize': '内容摘要',
      'tags': '自动标签'
    };
    return titles[action] || action;
  }
  
  addEventListeners() {
    // Search input events
    this.searchInput.addEventListener('input', (e) => {
      this.handleSearch(e.target.value);
    });
    
    // Keyboard navigation
    this.searchInput.addEventListener('keydown', (e) => {
      this.handleKeyNavigation(e);
    });
    
    // Click outside to close
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.hide();
      }
    });
    
    // Prevent clicks inside from closing and ensure events don't leak
    this.overlay.querySelector('.quickfinder-search-container').addEventListener('click', (e) => {
      e.stopPropagation();
    });
    
    this.resultsContainer.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    // Add mouse button event listener for back navigation within overlay
    this.overlay.addEventListener('mousedown', (e) => {
      // Mouse button 3 is the back button (side button)
      if (e.button === 3) {
        e.preventDefault();
        e.stopPropagation();
        this.handleBackNavigation();
      }
    });

    // Also listen for the auxclick event as a fallback
    this.overlay.addEventListener('auxclick', (e) => {
      if (e.button === 3) {
        e.preventDefault();
        e.stopPropagation();
        this.handleBackNavigation();
      }
    });

    // Add wheel event listener to results container for internal scrolling
    this.resultsContainer.addEventListener('wheel', (e) => {
      // Allow scrolling within results, but prevent it from bubbling
      e.stopPropagation();
    });
  }

  handleBackNavigation() {
    // Only handle back navigation if we're in a folder
    if (this.currentFolderId && this.displayMode === 'bookmarks') {
      this.goBack();
    }
  }
  
  handleKeyNavigation(e) {
    // 检查是否在搜索框中
    const isInSearchInput = e.target === this.searchInput;

    // 全局快捷键（在所有标签页都可用）
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        this.hide();
        return;
      case 'F1':
      case '?':
        if (!isInSearchInput) {
          e.preventDefault();
          this.showKeyboardHelp();
          return;
        }
        break;
      case '1':
      case '2':
      case '3':
        if (e.ctrlKey && !isInSearchInput) {
          e.preventDefault();
          this.switchToTab(parseInt(e.key) - 1);
          return;
        }
        break;
      case 'f':
        if (e.ctrlKey) {
          e.preventDefault();
          this.focusSearchInput();
          return;
        }
        break;
    }

    // 搜索标签页特有的导航
    if (this.currentTab === 'search') {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          this.selectNext();
          break;
        case 'ArrowUp':
          e.preventDefault();
          this.selectPrevious();
          break;
        case 'Enter':
          e.preventDefault();
          this.handleEnterKey();
          break;
        case 'Home':
          if (!isInSearchInput) {
            e.preventDefault();
            this.selectFirst();
          }
          break;
        case 'End':
          if (!isInSearchInput) {
            e.preventDefault();
            this.selectLast();
          }
          break;
        case 'PageUp':
          if (!isInSearchInput) {
            e.preventDefault();
            this.selectPreviousPage();
          }
          break;
        case 'PageDown':
          if (!isInSearchInput) {
            e.preventDefault();
            this.selectNextPage();
          }
          break;
        case 'Tab':
          if (!isInSearchInput) {
            if (e.shiftKey) {
              e.preventDefault();
              this.selectPrevious();
            } else {
              e.preventDefault();
              this.selectNext();
            }
          }
          break;
      }
    }
  }

  // 处理Enter键 - 支持URL直接跳转
  handleEnterKey() {
    const query = this.searchInput.value.trim();

    // 检查是否为URL
    if (this.isValidURL(query)) {
      this.navigateToURL(query);
    } else {
      // 正常的搜索结果选择
      this.openSelected();
    }
  }
  
  // URL检测函数
  isValidURL(string) {
    try {
      // 检查常见的URL格式
      const urlPatterns = [
        /^https?:\/\/.+/i,                    // http:// 或 https://
        /^www\..+\..+/i,                      // www.example.com
        /^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}.*$/i,   // example.com
        /^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}\/.*$/i, // example.com/path
        /^localhost(:\d+)?(\/.*)?$/i,         // localhost
        /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?(\/.*)?$/i // IP地址
      ];

      // 检查是否匹配任何URL模式
      const matchesPattern = urlPatterns.some(pattern => pattern.test(string));

      if (matchesPattern) {
        // 进一步验证URL的有效性
        let testUrl = string;

        // 如果没有协议，添加https://
        if (!testUrl.match(/^https?:\/\//i)) {
          testUrl = 'https://' + testUrl;
        }

        // 尝试创建URL对象来验证
        new URL(testUrl);
        return true;
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  // 导航到URL
  navigateToURL(url) {
    try {
      console.log('🌐 Navigating to URL:', url);

      // 标准化URL
      let targetUrl = url;
      if (!targetUrl.match(/^https?:\/\//i)) {
        targetUrl = 'https://' + targetUrl;
      }

      // 禁用页面离开确认对话框
      this.disableBeforeUnloadWarning();

      // 隐藏搜索界面
      this.hide();

      // 短暂延迟后导航，确保界面已隐藏
      setTimeout(() => {
        // 在当前标签页中导航
        window.location.href = targetUrl;
      }, 100);

    } catch (error) {
      console.error('❌ Failed to navigate to URL:', error);
      // 如果导航失败，回退到在新标签页打开
      window.open(url.match(/^https?:\/\//i) ? url : 'https://' + url, '_blank');
      this.hide();
    }
  }

  // 禁用页面离开警告
  disableBeforeUnloadWarning() {
    this.cleanupBeforeUnloadListeners();

    // 设置一个短暂的标志来阻止新的beforeunload监听器
    window._quickfinderNavigating = true;
    setTimeout(() => {
      delete window._quickfinderNavigating;
    }, 1000);
  }

  // 清理所有beforeunload监听器
  cleanupBeforeUnloadListeners() {
    // 移除现有的beforeunload事件监听器
    window.onbeforeunload = null;

    // 移除QuickFinder自己的beforeunload监听器
    if (this.beforeUnloadHandler) {
      window.removeEventListener('beforeunload', this.beforeUnloadHandler);
      this.beforeUnloadHandler = null;
    }

    // 清除所有beforeunload事件监听器（如果浏览器支持getEventListeners）
    try {
      const events = window.getEventListeners ? window.getEventListeners(window) : {};
      if (events.beforeunload) {
        events.beforeunload.forEach(event => {
          window.removeEventListener('beforeunload', event.listener, event.useCapture);
        });
      }
    } catch (error) {
      console.warn('无法清理所有beforeunload监听器:', error);
    }

    console.log('🧹 已清理所有beforeunload监听器');
  }

  selectNext() {
    if (this.currentResults.length === 0) return;

    // Implement circular navigation
    this.selectedIndex++;
    if (this.selectedIndex >= this.currentResults.length) {
      this.selectedIndex = 0; // Loop back to first item
    }
    this.updateSelection();
  }

  selectPrevious() {
    if (this.currentResults.length === 0) return;

    // Implement circular navigation
    this.selectedIndex--;
    if (this.selectedIndex < 0) {
      this.selectedIndex = this.currentResults.length - 1; // Loop to last item
    }
    this.updateSelection();
  }

  // 新增的键盘导航方法
  selectFirst() {
    if (this.currentResults.length === 0) return;
    this.selectedIndex = 0;
    this.updateSelection();
  }

  selectLast() {
    if (this.currentResults.length === 0) return;
    this.selectedIndex = this.currentResults.length - 1;
    this.updateSelection();
  }

  selectNextPage() {
    if (this.currentResults.length === 0) return;
    const pageSize = 10; // 每页10个结果
    this.selectedIndex = Math.min(
      this.selectedIndex + pageSize,
      this.currentResults.length - 1
    );
    this.updateSelection();
  }

  selectPreviousPage() {
    if (this.currentResults.length === 0) return;
    const pageSize = 10; // 每页10个结果
    this.selectedIndex = Math.max(this.selectedIndex - pageSize, 0);
    this.updateSelection();
  }

  // 切换标签页
  switchToTab(tabIndex) {
    const tabs = ['search', 'ai-suggest', 'ai-organize'];
    if (tabIndex >= 0 && tabIndex < tabs.length) {
      this.switchTab(tabs[tabIndex]);
    }
  }

  // 显示键盘帮助
  showKeyboardHelp() {
    const helpContent = `
      <div class="keyboard-help-overlay">
        <div class="keyboard-help-content">
          <h3>⌨️ 键盘快捷键</h3>
          <div class="help-section">
            <h4>🔍 搜索导航</h4>
            <div class="help-item"><kbd>↑</kbd> <kbd>↓</kbd> 选择结果</div>
            <div class="help-item"><kbd>Enter</kbd> 打开选中项</div>
            <div class="help-item"><kbd>Home</kbd> / <kbd>End</kbd> 首个/最后一个结果</div>
            <div class="help-item"><kbd>Page Up</kbd> / <kbd>Page Down</kbd> 翻页</div>
          </div>
          <div class="help-section">
            <h4>🎛️ 界面控制</h4>
            <div class="help-item"><kbd>Ctrl</kbd> + <kbd>1/2/3</kbd> 切换标签页</div>
            <div class="help-item"><kbd>Ctrl</kbd> + <kbd>F</kbd> 聚焦搜索框</div>
            <div class="help-item"><kbd>Ctrl</kbd> + <kbd>Q</kbd> 打开/关闭QuickFinder</div>
            <div class="help-item"><kbd>Esc</kbd> 关闭QuickFinder</div>
          </div>
          <div class="help-section">
            <h4>❓ 帮助</h4>
            <div class="help-item"><kbd>F1</kbd> 或 <kbd>?</kbd> 显示此帮助</div>
          </div>
          <div class="help-footer">
            <button class="help-close-btn">关闭 (Esc)</button>
          </div>
        </div>
      </div>
    `;

    // 创建帮助覆盖层
    const helpOverlay = document.createElement('div');
    helpOverlay.innerHTML = helpContent;
    helpOverlay.className = 'quickfinder-keyboard-help';

    // 添加样式
    const style = document.createElement('style');
    style.textContent = `
      .quickfinder-keyboard-help {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10001;
        backdrop-filter: blur(5px);
      }
      .keyboard-help-content {
        background: white;
        border-radius: 12px;
        padding: 24px;
        max-width: 500px;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
      }
      .keyboard-help-content h3 {
        margin: 0 0 20px 0;
        color: #333;
        text-align: center;
      }
      .help-section {
        margin-bottom: 20px;
      }
      .help-section h4 {
        margin: 0 0 10px 0;
        color: #667eea;
        font-size: 14px;
      }
      .help-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 6px 0;
        border-bottom: 1px solid #f0f0f0;
      }
      .help-item:last-child {
        border-bottom: none;
      }
      .help-item kbd {
        background: #f5f5f5;
        border: 1px solid #ddd;
        border-radius: 4px;
        padding: 2px 6px;
        font-size: 11px;
        margin: 0 2px;
      }
      .help-footer {
        text-align: center;
        margin-top: 20px;
      }
      .help-close-btn {
        background: #667eea;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        cursor: pointer;
      }
      .help-close-btn:hover {
        background: #5a67d8;
      }
    `;

    document.head.appendChild(style);
    document.body.appendChild(helpOverlay);

    // 关闭帮助
    const closeHelp = () => {
      document.body.removeChild(helpOverlay);
      document.head.removeChild(style);
    };

    // 绑定关闭事件
    helpOverlay.querySelector('.help-close-btn').addEventListener('click', closeHelp);
    helpOverlay.addEventListener('click', (e) => {
      if (e.target === helpOverlay) closeHelp();
    });

    // 键盘关闭
    const helpKeyHandler = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeHelp();
        document.removeEventListener('keydown', helpKeyHandler);
      }
    };
    document.addEventListener('keydown', helpKeyHandler);
  }
  
  updateSelection() {
    const resultElements = this.resultsContainer.querySelectorAll('.quickfinder-result-item');
    resultElements.forEach((el, index) => {
      el.classList.toggle('selected', index === this.selectedIndex);
    });
    
    // Scroll selected item into view
    if (this.selectedIndex >= 0 && resultElements[this.selectedIndex]) {
      resultElements[this.selectedIndex].scrollIntoView({
        block: 'nearest',
        behavior: 'smooth'
      });
    }
  }
  
  openSelected() {
    if (this.selectedIndex >= 0 && this.currentResults[this.selectedIndex]) {
      const result = this.currentResults[this.selectedIndex];
      if (result.url) {
        // Open URL in new tab
        window.open(result.url, '_blank');
        this.hide();
      } else if (result.type === 'folder') {
        // For folders, navigate into the folder
        this.navigateToFolder(result.id);
      }
    }
  }
  
  handleSearch(query) {
    // Clear previous timeout
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    // 检查URL并更新视觉提示
    this.updateURLHint(query);

    // Debounce search
    this.searchTimeout = setTimeout(() => {
      if (query.trim() === '') {
        this.loadInitialContent();
      } else {
        this.performSearch(query);
      }
    }, 150);
  }

  // 更新URL提示
  updateURLHint(query) {
    const isURL = this.isValidURL(query.trim());

    // 更新搜索框样式
    if (isURL) {
      this.searchInput.classList.add('url-detected');
      this.showURLHint(query.trim());
    } else {
      this.searchInput.classList.remove('url-detected');
      this.hideURLHint();
    }
  }

  // 显示URL提示
  showURLHint(url) {
    // 移除现有提示
    this.hideURLHint();

    // 创建提示元素
    const hint = document.createElement('div');
    hint.className = 'quickfinder-url-hint';
    hint.innerHTML = `
      <span class="quickfinder-url-hint-icon">🌐</span>
      <span class="quickfinder-url-hint-text">按 Enter 直接跳转到 ${url}</span>
      <span class="quickfinder-url-hint-shortcut">Enter</span>
    `;

    // 添加到搜索容器
    const searchContainer = this.overlay.querySelector('.quickfinder-search-container');
    searchContainer.style.position = 'relative';
    searchContainer.appendChild(hint);

    // 存储引用以便后续移除
    this.currentURLHint = hint;
  }

  // 隐藏URL提示
  hideURLHint() {
    if (this.currentURLHint) {
      this.currentURLHint.remove();
      this.currentURLHint = null;
    }
  }
  
  setDisplayMode(mode) {
    this.displayMode = mode;
    this.lastSelectedMode = mode;

    // Update button states
    const buttons = this.overlay.querySelectorAll('.quickfinder-mode-btn');
    buttons.forEach(btn => btn.classList.remove('active'));

    const activeButton = Array.from(buttons).find(btn => btn.dataset.mode === mode);

    if (activeButton) {
      activeButton.classList.add('active');
    }

    // Reset selection when switching modes
    this.selectedIndex = -1;

    // Clear current folder when switching modes (except for bookmarks)
    if (mode !== 'bookmarks') {
      this.currentFolderId = null;
      this.folderHistory = [];
      this.updateBreadcrumb();
    }

    // Save only the selected mode, not the button order
    this.saveSelectedMode();

    // Load content for the selected mode
    this.loadInitialContent();
  }

  async saveSelectedMode() {
    try {
      await chrome.storage.local.set({
        lastSelectedMode: this.lastSelectedMode
      });
    } catch (error) {
      console.error('Error saving selected mode:', error);
    }
  }

  async loadInitialContent() {
    try {
      let results = [];

      switch (this.displayMode) {
        case 'recent':
          results = await chrome.runtime.sendMessage({ action: 'get-recent-history' });
          break;
        case 'visited':
          results = await chrome.runtime.sendMessage({ action: 'get-most-visited' });
          break;
        case 'bookmarks':
          results = await chrome.runtime.sendMessage({ action: 'get-bookmarks' });
          break;
      }

      // Apply deduplication for history modes (bookmarks mode includes folders so no deduplication needed)
      if (this.displayMode !== 'bookmarks') {
        results = this.removeDuplicates(results || []);
      }

      this.currentResults = results ? results.slice(0, 30) : []; // Increased to 30 for bookmarks with folders
      this.selectedIndex = this.currentResults.length > 0 ? 0 : -1; // 自动选中第一条数据
      this.renderResults();
      if (this.selectedIndex >= 0) {
        this.updateSelection(); // 更新选中状态
      }
    } catch (error) {
      console.error('Error loading initial content:', error);
      this.currentResults = [];
      this.selectedIndex = -1;
      this.renderResults();
    }
  }

  // Keep the old function name for compatibility
  async loadInitialBookmarks() {
    await this.loadInitialContent();
  }

  // Navigate to a specific folder
  async navigateToFolder(folderId) {
    // 如果不是书签模式，先切换到书签模式
    if (this.displayMode !== 'bookmarks') {
      this.setDisplayMode('bookmarks');
    }

    // 保存当前文件夹到历史
    if (this.currentFolderId) {
      this.folderHistory.push(this.currentFolderId);
    }

    this.currentFolderId = folderId;
    await this.loadFolderContent(folderId);
    this.updateBreadcrumb();
  }

  // Load content of a specific folder
  async loadFolderContent(folderId) {
    try {
      const folderContents = await chrome.runtime.sendMessage({
        action: 'get-folder-contents',
        folderId: folderId
      });

      this.currentResults = folderContents ? folderContents.slice(0, 30) : [];
      this.selectedIndex = this.currentResults.length > 0 ? 0 : -1; // 自动选中第一条数据
      this.renderResults();
      if (this.selectedIndex >= 0) {
        this.updateSelection(); // 更新选中状态
      }
    } catch (error) {
      console.error('Error loading folder content:', error);
      this.currentResults = [];
      this.selectedIndex = -1;
      this.renderResults();
    }
  }

  // Update breadcrumb navigation
  updateBreadcrumb() {
    if (!this.currentFolderId) {
      this.breadcrumb.style.display = 'none';
      return;
    }

    this.breadcrumb.style.display = 'block';
    this.breadcrumb.innerHTML = '';

    // 创建一个包含整个面包屑的可点击容器
    const breadcrumbContainer = document.createElement('div');
    breadcrumbContainer.className = 'quickfinder-breadcrumb-container';
    breadcrumbContainer.style.cursor = 'pointer';
    breadcrumbContainer.onclick = () => this.goBack();

    // 添加返回按钮
    const backBtn = document.createElement('span');
    backBtn.className = 'quickfinder-breadcrumb-btn';
    backBtn.textContent = '← 返回';
    breadcrumbContainer.appendChild(backBtn);

    // 添加当前文件夹名称
    const currentFolderName = document.createElement('span');
    currentFolderName.className = 'quickfinder-breadcrumb-current';
    currentFolderName.textContent = ' 文件夹内容';
    breadcrumbContainer.appendChild(currentFolderName);

    // 将整个容器添加到面包屑中
    this.breadcrumb.appendChild(breadcrumbContainer);
  }

  // Go back to previous folder or main view
  goBack() {
    if (this.folderHistory.length > 0) {
      this.currentFolderId = this.folderHistory.pop();
      this.loadFolderContent(this.currentFolderId);
      this.updateBreadcrumb();
    } else {
      // 返回到主书签视图
      this.currentFolderId = null;
      this.folderHistory = [];
      this.breadcrumb.style.display = 'none';

      // 确保在书签模式下加载正确的内容
      if (this.displayMode === 'bookmarks') {
        this.loadInitialContent();
      }
    }
  }

  // 检测是否需要拼音搜索 - 暂时禁用拼音搜索以修复搜索问题
  needsPinyinSearch(query) {
    if (!query || !query.trim()) return false;

    // 检测中文字符
    const hasChinese = /[\u4e00-\u9fff]/.test(query);

    // 只有纯中文查询才使用拼音搜索，英文查询一律使用普通搜索
    return hasChinese;
  }

  // 异步加载图标
  async loadIcon(url) {
    if (!url) return this.defaultIcon;

    // 检查缓存
    if (this.iconCache.has(url)) {
      return this.iconCache.get(url);
    }

    // 检查是否正在加载
    if (this.iconLoadingQueue.has(url)) {
      // 等待加载完成
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (this.iconCache.has(url)) {
            clearInterval(checkInterval);
            resolve(this.iconCache.get(url));
          } else if (!this.iconLoadingQueue.has(url)) {
            // 加载失败
            clearInterval(checkInterval);
            resolve(this.defaultIcon);
          }
        }, 50);
      });
    }

    // 开始加载
    this.iconLoadingQueue.add(url);

    try {
      const faviconUrl = `chrome://favicon/${url}`;

      // 创建图片元素测试加载
      const img = new Image();

      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          this.iconLoadingQueue.delete(url);
          this.iconCache.set(url, this.defaultIcon);
          resolve(this.defaultIcon);
        }, 2000); // 2秒超时

        img.onload = () => {
          clearTimeout(timeout);
          this.iconLoadingQueue.delete(url);
          this.iconCache.set(url, faviconUrl);
          resolve(faviconUrl);
        };

        img.onerror = () => {
          clearTimeout(timeout);
          this.iconLoadingQueue.delete(url);
          this.iconCache.set(url, this.defaultIcon);
          resolve(this.defaultIcon);
        };

        img.src = faviconUrl;
      });
    } catch (error) {
      this.iconLoadingQueue.delete(url);
      this.iconCache.set(url, this.defaultIcon);
      return this.defaultIcon;
    }
  }

  // 创建图标元素
  createIconElement(url, className = 'quickfinder-result-icon') {
    const icon = document.createElement('img');
    icon.className = className;
    icon.src = this.defaultIcon; // 先显示默认图标
    icon.alt = '';

    // 异步加载真实图标
    this.loadIcon(url).then(iconUrl => {
      if (icon.parentNode) { // 确保元素还在DOM中
        icon.src = iconUrl;
      }
    });

    return icon;
  }

  async performSearch(query) {
    try {
      console.log('🔍 Performing search with query:', query);
      console.log('🤖 AI enabled:', this.aiEnabled);

      const isNaturalLanguage = this.isNaturalLanguageQuery(query);
      console.log('🗣️ Is natural language query:', isNaturalLanguage);

      // Check if AI smart search is enabled and available
      if (this.aiEnabled && isNaturalLanguage) {
        console.log('✨ Triggering AI search');
        await this.performAISearch(query);
        return;
      } else {
        console.log('📝 Using regular search because:');
        console.log('   - AI enabled:', this.aiEnabled);
        console.log('   - Natural language:', isNaturalLanguage);
      }

      // Fallback to regular search
      await this.performRegularSearch(query);
    } catch (error) {
      console.error('Error performing search:', error);
      this.currentResults = [];
      this.selectedIndex = -1;
      this.renderResults();
    }
  }

  // Check if query looks like natural language
  isNaturalLanguageQuery(query) {
    // Simple heuristics to detect natural language queries
    const naturalLanguageIndicators = [
      '找', '搜索', '查找', '我想', '帮我', '显示', '给我',
      'find', 'search', 'show me', 'i want', 'help me', 'get me',
      '上周', '昨天', '最近', '之前', '关于',
      'last week', 'yesterday', 'recent', 'about', 'related to'
    ];

    const hasIndicators = naturalLanguageIndicators.some(indicator =>
      query.toLowerCase().includes(indicator)
    );

    // Also check for question words
    const questionWords = ['什么', '怎么', '为什么', '哪里', 'what', 'how', 'why', 'where', 'when'];
    const hasQuestionWords = questionWords.some(word =>
      query.toLowerCase().includes(word)
    );

    // Consider it natural language if it has indicators, question words, or is longer than 10 characters
    return hasIndicators || hasQuestionWords || query.length > 10;
  }

  async performAISearch(query) {
    try {
      console.log('🚀 Starting AI search for query:', query);

      // Show loading state
      this.resultsContainer.innerHTML = '<div class="quickfinder-loading">AI正在理解您的查询...</div>';

      // Get all bookmarks for AI context
      console.log('📚 Getting bookmarks and history...');
      const [bookmarks, history] = await Promise.all([
        chrome.runtime.sendMessage({ action: 'get-bookmarks' }).catch((err) => {
          console.error('Failed to get bookmarks:', err);
          return [];
        }),
        chrome.runtime.sendMessage({ action: 'get-recent-history' }).catch((err) => {
          console.error('Failed to get history:', err);
          return [];
        })
      ]);

      console.log('📊 Data retrieved:', {
        bookmarks: bookmarks?.length || 0,
        history: history?.length || 0
      });

      const allData = [...(bookmarks || []), ...(history || [])];
      console.log('📋 Total data items:', allData.length);

      // Request AI smart search
      console.log('🤖 Sending AI search request...');
      const aiResults = await chrome.runtime.sendMessage({
        action: 'ai-smart-search',
        query: query,
        bookmarks: allData.slice(0, 100) // Limit for API efficiency
      });

      console.log('🎯 AI search results:', aiResults);

      if (aiResults && Array.isArray(aiResults) && aiResults.length > 0) {
        console.log('✅ AI found', aiResults.length, 'relevant results');

        // AI found relevant results - convert to our format
        this.currentResults = aiResults.map(match => {
          // Find the original bookmark/history item
          const originalItem = allData.find(item => item.id === match.id || item.url === match.url || item.title === match.title);
          return {
            ...originalItem,
            ...match,
            aiRelevanceScore: match.relevanceScore,
            aiReason: match.reason
          };
        }).filter(item => item.url); // Filter out items without URL

        console.log('📝 Processed results:', this.currentResults.length);

        this.selectedIndex = this.currentResults.length > 0 ? 0 : -1; // 自动选中第一条数据
        this.renderResults();
        if (this.selectedIndex >= 0) {
          this.updateSelection(); // 更新选中状态
        }

        // Add AI indicator
        this.addAISearchIndicator();
      } else {
        // Fallback to regular search if AI doesn't return results
        console.log('❌ AI search returned no results, falling back to regular search');
        console.log('AI results object:', aiResults, 'Type:', typeof aiResults);
        await this.performRegularSearch(query);
      }
    } catch (error) {
      console.error('💥 AI search failed, falling back to regular search:', error);
      await this.performRegularSearch(query);
    }
  }

  async performRegularSearch(query) {
    try {
      // 检测是否需要拼音搜索
      const needsPinyinSearch = this.needsPinyinSearch(query);

      let allResults = [];

      if (needsPinyinSearch) {
        // 使用拼音搜索
        const pinyinResults = await chrome.runtime.sendMessage({
          action: 'search-pinyin',
          query
        }).catch(() => []);

        allResults = pinyinResults || [];
      } else {
        // 使用普通搜索
        const [bookmarks, history] = await Promise.all([
          chrome.runtime.sendMessage({ action: 'search-bookmarks', query }).catch(() => []),
          chrome.runtime.sendMessage({ action: 'search-history', query }).catch(() => [])
        ]);

        allResults = [...(bookmarks || []), ...(history || [])];
      }

      // Remove duplicates based on URL
      const uniqueResults = this.removeDuplicates(allResults);

      // Sort by relevance (bookmarks first, then by visit count/date)
      uniqueResults.sort((a, b) => {
        if (a.type === 'bookmark' && b.type === 'history') return -1;
        if (a.type === 'history' && b.type === 'bookmark') return 1;

        if (a.type === 'history' && b.type === 'history') {
          return (b.visitCount || 0) - (a.visitCount || 0);
        }

        return (b.dateAdded || 0) - (a.dateAdded || 0);
      });

      this.currentResults = uniqueResults.slice(0, 50); // Limit to 50 results
      this.selectedIndex = this.currentResults.length > 0 ? 0 : -1; // 自动选中第一条数据
      this.renderResults();
      if (this.selectedIndex >= 0) {
        this.updateSelection(); // 更新选中状态
      }
    } catch (error) {
      console.error('Error performing regular search:', error);
      this.currentResults = [];
      this.selectedIndex = -1;
      this.renderResults();
    }
  }

  addAISearchIndicator() {
    // Add a small indicator that AI was used for this search
    const indicator = document.createElement('div');
    indicator.className = 'ai-search-indicator';
    indicator.innerHTML = '✨ AI智能搜索结果';

    // Insert at the top of results
    this.resultsContainer.insertBefore(indicator, this.resultsContainer.firstChild);
  }

  // Remove duplicate URLs, prioritizing bookmarks over history
  removeDuplicates(results) {
    const urlMap = new Map();

    results.forEach(result => {
      if (!result.url) return; // 跳过没有URL的项目（如文件夹）

      let urlKey = result.url;

      // 对于历史记录，尝试标准化URL以减少重复
      if (result.type === 'history') {
        try {
          const url = new URL(result.url);
          // 创建标准化的URL键（去除查询参数的细微变化）
          urlKey = `${url.protocol}//${url.hostname}${url.pathname}`;

          // 如果查询参数很短（可能是重要的），保留原始URL
          if (url.search && url.search.length < 20) {
            urlKey = result.url;
          }
        } catch (error) {
          // 无效URL，使用原始URL
          urlKey = result.url;
        }
      }

      if (!urlMap.has(urlKey)) {
        urlMap.set(urlKey, result);
      } else {
        // If we already have this URL, keep the bookmark version if available
        const existing = urlMap.get(urlKey);
        if (result.type === 'bookmark' && existing.type === 'history') {
          urlMap.set(urlKey, result);
        }
        // If both are bookmarks or both are history, keep the more recent one
        else if (result.type === existing.type) {
          const resultTime = result.lastVisitTime || result.dateAdded || 0;
          const existingTime = existing.lastVisitTime || existing.dateAdded || 0;
          if (resultTime > existingTime) {
            urlMap.set(urlKey, result);
          }
        }
        // 对于历史记录，如果新的访问次数更高，也替换
        else if (result.type === 'history' && existing.type === 'history') {
          if ((result.visitCount || 0) > (existing.visitCount || 0)) {
            urlMap.set(urlKey, result);
          }
        }
      }
    });

    return Array.from(urlMap.values());
  }

  // Update category cache
  async updateCategoryCache() {
    const now = Date.now();

    // Check if cache is still valid
    if (now - this.categoryCache.lastUpdated < this.categoryCache.cacheTimeout) {
      return;
    }

    try {
      // Clear existing cache
      this.categoryCache.bookmarks.clear();
      this.categoryCache.frequent.clear();
      this.categoryCache.recent.clear();

      // Load bookmarks
      const bookmarks = await chrome.runtime.sendMessage({ action: 'get-bookmarks' });
      if (bookmarks) {
        bookmarks.forEach(bookmark => {
          if (bookmark.url) {
            this.categoryCache.bookmarks.add(bookmark.url);
          }
        });
      }

      // Load most visited
      const mostVisited = await chrome.runtime.sendMessage({ action: 'get-most-visited' });
      if (mostVisited) {
        mostVisited.forEach(item => {
          if (item.url) {
            this.categoryCache.frequent.add(item.url);
          }
        });
      }

      // Load recent history
      const recentHistory = await chrome.runtime.sendMessage({ action: 'get-recent-history' });
      if (recentHistory) {
        recentHistory.forEach(item => {
          if (item.url) {
            this.categoryCache.recent.add(item.url);
          }
        });
      }

      this.categoryCache.lastUpdated = now;
    } catch (error) {
      console.warn('Error updating category cache:', error);
    }
  }

  // Determine category tags for a search result (optimized with cache)
  async getCategoryTags(result) {
    const tags = [];

    if (!result.url) {
      return tags;
    }

    // Ensure cache is up to date
    await this.updateCategoryCache();

    // Check categories using cached data
    if (this.categoryCache.bookmarks.has(result.url)) {
      tags.push({
        type: 'bookmark',
        label: '书签',
        icon: '📚',
        priority: 3
      });
    }

    if (this.categoryCache.frequent.has(result.url)) {
      tags.push({
        type: 'frequent',
        label: '常用',
        icon: '⭐',
        priority: 2
      });
    }

    if (this.categoryCache.recent.has(result.url)) {
      tags.push({
        type: 'recent',
        label: '最近',
        icon: '🕒',
        priority: 1
      });
    }

    // Sort by priority (Bookmark > Frequent > Recent) and limit to 3 tags
    return tags
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 3);
  }

  // Create category tag element
  createCategoryTag(tag) {
    const tagElement = document.createElement('span');
    tagElement.className = `quickfinder-category-tag quickfinder-category-tag-${tag.type}`;
    tagElement.innerHTML = `${tag.icon} ${tag.label}`;
    return tagElement;
  }

  renderResults() {
    this.resultsContainer.innerHTML = '';
    
    if (this.currentResults.length === 0) {
      const noResults = document.createElement('div');
      noResults.className = 'quickfinder-no-results';
      noResults.textContent = 'No results found';
      this.resultsContainer.appendChild(noResults);
      return;
    }
    
    this.currentResults.forEach((result, index) => {
      const resultElement = this.createResultElement(result, index);
      this.resultsContainer.appendChild(resultElement);
    });
  }
  
  createResultElement(result, index) {
    const item = document.createElement('div');
    item.className = 'quickfinder-result-item';
    item.dataset.index = index;

    const iconContainer = document.createElement('div');
    iconContainer.className = 'quickfinder-result-icon-container';

    // Handle different types of results
    if (result.type === 'folder') {
      // For folders, show folder icon
      const folderIcon = document.createElement('div');
      folderIcon.className = 'quickfinder-result-icon folder';
      folderIcon.textContent = '📁';
      iconContainer.appendChild(folderIcon);
    } else if (result.url) {
      // For bookmarks and history with URLs, show favicon
      const favicon = document.createElement('img');
      favicon.className = 'quickfinder-result-favicon';
      favicon.alt = result.type === 'bookmark' ? 'Bookmark' : 'History';

      // Load favicon asynchronously
      this.getFaviconUrl(result.url).then(iconUrl => {
        favicon.src = iconUrl;
      }).catch(error => {
        console.warn('Failed to load favicon:', error);
        // 使用更安全的回退机制
        try {
          const urlObj = new URL(result.url);
          favicon.src = `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=16`;
        } catch (urlError) {
          // 最终回退到默认图标
          favicon.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="%23ccc"/></svg>';
        }
      });

      // Create fallback icon
      const fallbackIcon = document.createElement('div');
      fallbackIcon.className = `quickfinder-result-icon ${result.type}`;
      fallbackIcon.textContent = result.type === 'bookmark' ? '★' : '🕒';
      fallbackIcon.style.display = 'none';

      // Handle favicon load error
      favicon.onerror = () => {
        favicon.style.display = 'none';
        fallbackIcon.style.display = 'flex';
      };

      // Handle favicon load success
      favicon.onload = () => {
        favicon.style.display = 'block';
        fallbackIcon.style.display = 'none';
      };

      iconContainer.appendChild(favicon);
      iconContainer.appendChild(fallbackIcon);
    } else {
      // Fallback for items without URLs
      const fallbackIcon = document.createElement('div');
      fallbackIcon.className = `quickfinder-result-icon ${result.type}`;
      fallbackIcon.textContent = result.type === 'bookmark' ? '★' : '🕒';
      iconContainer.appendChild(fallbackIcon);
    }

    const content = document.createElement('div');
    content.className = 'quickfinder-result-content';

    const title = document.createElement('div');
    title.className = 'quickfinder-result-title';
    title.textContent = result.title || 'Untitled';

    const urlAndTags = document.createElement('div');
    urlAndTags.className = 'quickfinder-result-url-container';

    const url = document.createElement('div');
    url.className = 'quickfinder-result-url';

    if (result.type === 'folder') {
      // For folders, show child count and path
      const folderInfo = `${result.childCount || 0} 项目`;
      const pathInfo = result.parentPath ? ` • ${result.parentPath}` : '';
      url.textContent = folderInfo + pathInfo;
    } else {
      // For URLs, show the URL and visit count if available
      let urlText = result.url || '';
      if (result.domain && result.visitCount && result.visitCount > 1) {
        urlText += ` • 访问 ${result.visitCount} 次`;
      }
      url.textContent = urlText;
    }

    urlAndTags.appendChild(url);

    // Add category tags for all results with URLs
    if (result.url) {
      const tagsContainer = document.createElement('div');
      tagsContainer.className = 'quickfinder-category-tags';

      // Load tags asynchronously to avoid blocking UI
      this.getCategoryTags(result).then(tags => {
        if (tags.length > 0) {
          tags.forEach(tag => {
            const tagElement = this.createCategoryTag(tag);
            tagsContainer.appendChild(tagElement);
          });
        }
      }).catch(error => {
        console.warn('Failed to load category tags:', error);
      });

      urlAndTags.appendChild(tagsContainer);
    }

    content.appendChild(title);
    content.appendChild(urlAndTags);
    item.appendChild(iconContainer);
    item.appendChild(content);

    // Add click handler
    item.addEventListener('click', () => {
      if (result.url) {
        // Open URL in new tab
        window.open(result.url, '_blank');
        this.hide();
      } else if (result.type === 'folder') {
        // For folders, navigate into the folder
        this.navigateToFolder(result.id);
      }
    });

    return item;
  }

  async getFaviconUrl(url) {
    try {
      // Try to get preloaded icon first
      const response = await chrome.runtime.sendMessage({
        action: 'get-icon-url',
        url: url
      });

      if (response && response.success && response.iconUrl) {
        return response.iconUrl;
      }
    } catch (error) {
      console.warn('Failed to get preloaded icon for:', url, error);
    }

    try {
      const urlObj = new URL(url);

      // 检测浏览器类型并使用相应的favicon服务
      const isEdge = navigator.userAgent.includes('Edg');
      const isChrome = navigator.userAgent.includes('Chrome') && !isEdge;

      if (isEdge) {
        // Edge浏览器使用Google的favicon服务作为回退
        return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=16`;
      } else if (isChrome) {
        // Chrome浏览器使用chrome://favicon
        return `chrome://favicon/${url}`;
      } else {
        // 其他浏览器使用Google的favicon服务
        return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=16`;
      }
    } catch (error) {
      // If URL parsing fails, return a generic icon
      return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="%23ccc"/></svg>';
    }
  }

  // 优化的图标获取方法 - 使用缓存和异步加载
  async getFaviconUrlOptimized(url) {
    return await this.loadIcon(url);
  }

  async showAIDiagnostic(container) {
    container.innerHTML = '<div class="quickfinder-loading">正在诊断AI配置...</div>';
    
    try {
      // Test AI connection through background script
      const testResult = await chrome.runtime.sendMessage({ action: 'test-ai-connection' });
      
      // Also check local settings
      const localSettings = await chrome.storage.local.get(['aiSettings']);
      const syncSettings = await chrome.storage.sync.get(['aiSettings']);
      
      let diagnosticInfo = `
        <div class="ai-diagnostic-info" style="padding: 15px; font-family: monospace; font-size: 12px; line-height: 1.4;">
          <h4>🔧 AI配置诊断结果</h4>
          
          <div style="margin: 10px 0;">
            <strong>📊 存储状态:</strong><br>
            • 本地存储: ${localSettings.aiSettings ? '✅ 有数据' : '❌ 无数据'}<br>
            • 同步存储: ${syncSettings.aiSettings ? '✅ 有数据' : '❌ 无数据'}<br>
          </div>
          
          ${localSettings.aiSettings ? `
            <div style="margin: 10px 0;">
              <strong>⚙️ 本地设置详情:</strong><br>
              • 提供商: ${localSettings.aiSettings.provider || '未设置'}<br>
              • 模型: ${localSettings.aiSettings.model || '未设置'}<br>
              • API密钥: ${localSettings.aiSettings.apiKey ? '✅ 已设置 (' + localSettings.aiSettings.apiKey.length + ' 字符)' : '❌ 未设置'}<br>
              • 启用功能: ${localSettings.aiSettings.enabledFeatures ? localSettings.aiSettings.enabledFeatures.join(', ') : '无'}<br>
            </div>
          ` : ''}
          
          <div style="margin: 10px 0;">
            <strong>🧪 后台服务测试:</strong><br>
            ${testResult ? (testResult.success ? '✅ 连接成功' : `❌ 连接失败: ${testResult.error}`) : '❌ 测试超时或失败'}
          </div>
          
          <div style="margin: 15px 0;">
            <button id="retry-ai-config" style="background: #2196F3; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
              🔄 重新加载配置
            </button>
            <button id="open-ai-settings" style="background: #FF9800; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin-left: 10px;">
              ⚙️ 打开AI设置
            </button>
          </div>
        </div>
      `;
      
      container.innerHTML = diagnosticInfo;
      
      // Add event listeners
      const retryBtn = container.querySelector('#retry-ai-config');
      if (retryBtn) {
        retryBtn.addEventListener('click', async () => {
          // Reload settings and retry
          await this.loadSettings();
          this.switchAISuggestionTab('recommendations');
        });
      }
      
      const settingsBtn = container.querySelector('#open-ai-settings');
      if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
          chrome.runtime.openOptionsPage();
          this.hide();
        });
      }
      
    } catch (error) {
      console.error('Diagnostic failed:', error);
      container.innerHTML = `
        <div class="quickfinder-no-results">
          诊断失败: ${error.message}
          <div style="margin-top: 10px;">
            <button onclick="chrome.runtime.openOptionsPage(); this.closest('.quickfinder-overlay').style.display='none';" 
                    style="background: #FF9800; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
              ⚙️ 打开AI设置
            </button>
          </div>
        </div>
      `;
    }
  }

  // 检测页面主题并设置相应属性
  detectAndSetTheme() {
    try {
      // 检测是否是特殊页面
      const isSpecialPage = this.isSpecialPage(window.location.href);
      
      // 检测页面背景颜色
      const bodyStyle = window.getComputedStyle(document.body);
      const bgColor = bodyStyle.backgroundColor;
      const htmlStyle = window.getComputedStyle(document.documentElement);
      const htmlBgColor = htmlStyle.backgroundColor;
      
      // 检测系统主题偏好
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      
      // 判断是否是深色背景
      let isDarkBackground = false;
      
      if (isSpecialPage || prefersDark) {
        isDarkBackground = true;
      } else {
        // 尝试解析背景颜色判断亮度
        const color = bgColor !== 'rgba(0, 0, 0, 0)' ? bgColor : htmlBgColor;
        if (this.isColorDark(color)) {
          isDarkBackground = true;
        }
      }
      
      // 设置相应的属性
      if (isDarkBackground) {
        this.overlay.setAttribute('data-dark-background', 'true');
        document.body.setAttribute('data-special-page', 'true');
        console.log('🌙 检测到深色背景，应用白色文字样式');
      } else {
        console.log('☀️ 检测到浅色背景，使用默认样式');
      }
      
    } catch (error) {
      console.warn('主题检测失败，使用默认样式:', error);
    }
  }

  // 判断颜色是否为深色
  isColorDark(color) {
    if (!color || color === 'transparent' || color === 'rgba(0, 0, 0, 0)') {
      return false;
    }
    
    try {
      // 解析RGB值
      const rgb = color.match(/\d+/g);
      if (rgb && rgb.length >= 3) {
        const r = parseInt(rgb[0]);
        const g = parseInt(rgb[1]);
        const b = parseInt(rgb[2]);
        
        // 计算亮度 (使用相对亮度公式)
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance < 0.5; // 亮度小于0.5认为是深色
      }
    } catch (error) {
      console.warn('颜色解析失败:', error);
    }
    
    return false;
  }

  // 检测是否是特殊页面
  isSpecialPage(url) {
    if (!url) return true;
    
    const specialPages = [
      'chrome://',
      'chrome-extension://',
      'edge://',
      'about:',
      'moz-extension://',
      'file://',
      'data:',
      'javascript:'
    ];
    
    return specialPages.some(prefix => url.startsWith(prefix)) ||
           url === 'about:blank' ||
           url.includes('newtab') ||
           url.includes('new-tab-page');
  }

  // 添加全局事件屏蔽器
  addGlobalEventBlockers() {
    if (this.isBlockingEvents) return;
    
    this.isBlockingEvents = true;
    
    // 创建全局事件处理器
    this.globalEventHandler = (e) => {
      // 如果事件来自QuickFinder overlay内部，则允许通过
      if (e.target.closest('.quickfinder-overlay')) {
        return;
      }
      
      // 阻止事件传播的通用方法
      const preventDefault = () => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return false;
      };
      
      // 阻止键盘事件
      if (e.type === 'keydown' || e.type === 'keyup' || e.type === 'keypress') {
        // 允许QuickFinder的快捷键（统一使用Ctrl+Q）
        if (e.ctrlKey && e.key === 'q') {
          return;
        }
        
        // 允许在QuickFinder overlay内的所有键盘操作（包括导航键）
        if (e.target.closest('.quickfinder-overlay')) {
          return;
        }
        
        // 阻止所有其他键盘事件
        return preventDefault();
      }
      
      // 阻止鼠标事件
      if (e.type === 'mousedown' || e.type === 'mouseup' || e.type === 'click' || e.type === 'auxclick') {
        // 阻止鼠标侧键（返回/前进按钮）
        if (e.button === 3 || e.button === 4) {
          return preventDefault();
        }
        
        // 阻止中键点击
        if (e.button === 1) {
          return preventDefault();
        }
        
        // 阻止左键和右键点击（除非在overlay内）
        return preventDefault();
      }
      
      // 阻止历史导航事件
      if (e.type === 'popstate') {
        return preventDefault();
      }
      
      // 阻止滚轮事件（除了在结果容器内）
      if (e.type === 'wheel') {
        // 允许在结果容器内滚动
        if (e.target.closest('.quickfinder-results')) {
          return;
        }
        return preventDefault();
      }
      
      // 阻止右键菜单
      if (e.type === 'contextmenu') {
        return preventDefault();
      }
      
      // 阻止触摸事件
      if (e.type.startsWith('touch')) {
        return preventDefault();
      }
      
      // 阻止拖拽事件
      if (e.type.startsWith('drag')) {
        return preventDefault();
      }
    };
    
    // 监听的事件类型
    const eventTypes = [
      'keydown', 'keyup', 'keypress',
      'mousedown', 'mouseup', 'click', 'dblclick', 'auxclick',
      'wheel', 'scroll',
      'contextmenu',
      'touchstart', 'touchmove', 'touchend',
      'dragstart', 'dragover', 'drop',
      'popstate'  // 添加历史状态变化事件
    ];
    
    // 为每种事件类型添加监听器
    eventTypes.forEach(eventType => {
      document.addEventListener(eventType, this.globalEventHandler, {
        capture: true,  // 在捕获阶段拦截
        passive: false  // 允许调用preventDefault
      });
    });
    
    // 阻止页面滚动
    document.body.style.overflow = 'hidden';
    
    // 额外的历史导航阻止机制
    this.originalPushState = history.pushState;
    this.originalReplaceState = history.replaceState;
    
    // 暂时禁用history API
    history.pushState = function() {
      console.log('🚫 History.pushState blocked while QuickFinder is active');
    };
    history.replaceState = function() {
      console.log('🚫 History.replaceState blocked while QuickFinder is active');
    };
    
    // 注意：不再设置beforeunload监听器，因为它会导致页面离开确认对话框
    // 如果需要阻止页面导航，应该使用其他方法
    
    console.log('✅ 全局事件屏蔽器已启用');
  }
  
  // 移除全局事件屏蔽器
  removeGlobalEventBlockers() {
    if (!this.isBlockingEvents) return;
    
    this.isBlockingEvents = false;
    
    if (this.globalEventHandler) {
      const eventTypes = [
        'keydown', 'keyup', 'keypress',
        'mousedown', 'mouseup', 'click', 'dblclick', 'auxclick',
        'wheel', 'scroll',
        'contextmenu',
        'touchstart', 'touchmove', 'touchend',
        'dragstart', 'dragover', 'drop',
        'popstate'
      ];
      
      // 移除所有事件监听器
      eventTypes.forEach(eventType => {
        document.removeEventListener(eventType, this.globalEventHandler, {
          capture: true
        });
      });
      
      this.globalEventHandler = null;
    }
    
    // 恢复页面滚动
    document.body.style.overflow = '';
    
    // 恢复history API
    if (this.originalPushState) {
      history.pushState = this.originalPushState;
      this.originalPushState = null;
    }
    if (this.originalReplaceState) {
      history.replaceState = this.originalReplaceState;
      this.originalReplaceState = null;
    }
    
    // 清理任何可能残留的beforeunload监听器
    this.cleanupBeforeUnloadListeners();
    
    console.log('✅ 全局事件屏蔽器已移除');
  }
  // 加载拼音库 - CDN方式
  async loadPinyinLibrary() {
    if (this.pinyinLibLoaded || this.pinyinLibLoading) {
      return;
    }

    this.pinyinLibLoading = true;
    console.log('🔄 Loading pinyin library from CDN...');

    try {
      // 检查是否已经存在拼音库
      if (typeof window.pinyin !== 'undefined') {
        this.pinyinLibLoaded = true;
        this.pinyinLibLoading = false;
        console.log('✅ Pinyin library already loaded');
        return;
      }

      // 创建script标签加载CDN版本
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/pinyin-pro@3.19.6/dist/index.js';
      script.type = 'text/javascript';

      // 设置加载超时
      const timeout = setTimeout(() => {
        console.warn('⚠️ Pinyin library CDN loading timeout, falling back to local functionality');
        this.pinyinLibLoading = false;
        if (script.parentNode) {
          document.head.removeChild(script);
        }
      }, 10000); // 10秒超时

      script.onload = () => {
        clearTimeout(timeout);
        this.pinyinLibLoaded = true;
        this.pinyinLibLoading = false;
        console.log('✅ Pinyin library loaded successfully from CDN');

        // 验证库是否正确加载
        if (typeof window.pinyin === 'function') {
          console.log('🧪 Testing pinyin library:', window.pinyin('测试'));
        }
      };

      script.onerror = () => {
        clearTimeout(timeout);
        this.pinyinLibLoading = false;
        console.error('❌ Failed to load pinyin library from CDN, using fallback');
        if (script.parentNode) {
          document.head.removeChild(script);
        }

        // 降级处理：使用简单的拼音匹配
        this.setupFallbackPinyin();
      };

      document.head.appendChild(script);

    } catch (error) {
      this.pinyinLibLoading = false;
      console.error('❌ Error loading pinyin library:', error);
      this.setupFallbackPinyin();
    }
  }

  // 降级拼音处理
  setupFallbackPinyin() {
    console.log('🔧 Setting up fallback pinyin functionality');

    // 简单的拼音映射表（常用字符）
    window.pinyin = function(text) {
      const pinyinMap = {
        '中': 'zhong', '国': 'guo', '搜': 'sou', '索': 'suo',
        '网': 'wang', '站': 'zhan', '书': 'shu', '签': 'qian',
        '历': 'li', '史': 'shi', '记': 'ji', '录': 'lu',
        '测': 'ce', '试': 'shi', '文': 'wen', '件': 'jian'
      };

      return text.split('').map(char => pinyinMap[char] || char).join(' ');
    };

    this.pinyinLibLoaded = true;
    console.log('✅ Fallback pinyin functionality ready');
  }
}

// Initialize QuickFinder when content script loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new QuickFinder();
  });
} else {
  new QuickFinder();
}
