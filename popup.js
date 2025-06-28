// Popup script for QuickFinder extension

let currentLanguage = 'zh'; // Default to Chinese
let searchMode = false; // Track if we're in search mode
let searchTimeout = null;
let currentResults = [];
let selectedIndex = -1;

// Category cache for popup
let categoryCache = {
  bookmarks: new Set(),
  frequent: new Set(),
  recent: new Set(),
  lastUpdated: 0,
  cacheTimeout: 30000 // 30 seconds
};

document.addEventListener('DOMContentLoaded', async () => {
  // Load saved language preference
  chrome.storage.sync.get(['language'], (result) => {
    currentLanguage = result.language || 'zh'; // Default to Chinese
    updateLanguage();
  });

  // Check if we should show search mode (for special pages)
  await checkAndInitializeMode();

  // Show unified shortcut for all platforms
  const shortcutDisplay = document.getElementById('shortcut-display');
  if (shortcutDisplay) {
    // 统一使用Ctrl+Q作为所有平台的快捷键
    shortcutDisplay.textContent = 'Ctrl+Q';

    // Add click handler to trigger search overlay
    shortcutDisplay.addEventListener('click', async () => {
      try {
        // Get the active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (tab && tab.id) {
          // Send message to content script to show the search overlay
          chrome.tabs.sendMessage(tab.id, { action: 'toggle-search' });

          // Close the popup
          window.close();
        }
      } catch (error) {
        console.error('Error triggering search:', error);
      }
    });
  }

  // Initialize search functionality if in search mode
  if (searchMode) {
    initializeSearch();
  }

  // Add language toggle event listener
  const langToggle = document.getElementById('lang-toggle');
  if (langToggle) {
    langToggle.addEventListener('click', toggleLanguage);
  }

  // Add bookmark manager button event listener
  const managerBtn = document.getElementById('open-manager-btn');
  if (managerBtn) {
    managerBtn.addEventListener('click', openBookmarkManager);
  }

  // Add AI settings button event listener
  const aiSettingsBtn = document.getElementById('ai-settings-btn');
  if (aiSettingsBtn) {
    aiSettingsBtn.addEventListener('click', openAISettings);
  }
});

function toggleLanguage() {
  currentLanguage = currentLanguage === 'en' ? 'zh' : 'en';
  updateLanguage();

  // Save language preference
  chrome.storage.sync.set({ language: currentLanguage });
}

function updateLanguage() {
  const elements = document.querySelectorAll('[data-en][data-zh]');
  const toggleButton = document.getElementById('lang-toggle');

  elements.forEach(element => {
    if (currentLanguage === 'zh') {
      element.textContent = element.getAttribute('data-zh');
    } else {
      element.textContent = element.getAttribute('data-en');
    }
  });

  // Update toggle button text
  if (toggleButton) {
    toggleButton.textContent = currentLanguage === 'en' ? '中文' : 'English';
  }
}

function openBookmarkManager() {
  // 打开自定义的书签管理页面
  chrome.tabs.create({ url: chrome.runtime.getURL('bookmarks.html') });

  // 关闭弹出窗口
  window.close();
}

function openAISettings() {
  // 打开AI设置页面
  chrome.runtime.openOptionsPage();

  // 关闭弹出窗口
  window.close();
}

// Check if we should show search mode (for special pages)
async function checkAndInitializeMode() {
  try {
    // Check if background script set search mode flag
    const result = await chrome.storage.local.get(['popup-search-mode']);

    if (result['popup-search-mode']) {
      // Clear the flag
      await chrome.storage.local.remove(['popup-search-mode']);

      // Show search mode
      searchMode = true;
      showSearchMode();
      return;
    }

    // Get the active tab to check if it's a special page
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (tab && tab.url) {
      // Check if it's a special page
      const isSpecial = isSpecialPage(tab.url);

      if (isSpecial) {
        // Show search mode for special pages
        searchMode = true;
        showSearchMode();
      } else {
        // Show intro mode for normal pages
        searchMode = false;
        showIntroMode();
      }
    } else {
      // Default to intro mode
      searchMode = false;
      showIntroMode();
    }
  } catch (error) {
    console.error('Error checking mode:', error);
    // Default to intro mode
    searchMode = false;
    showIntroMode();
  }
}

// Check if the URL is a special page
function isSpecialPage(url) {
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

// Show search mode
function showSearchMode() {
  const searchSection = document.getElementById('search-section');
  const introSection = document.getElementById('intro-section');

  if (searchSection) {
    searchSection.style.display = 'block';
  }
  if (introSection) {
    introSection.style.display = 'none';
  }
}

// Show intro mode
function showIntroMode() {
  const searchSection = document.getElementById('search-section');
  const introSection = document.getElementById('intro-section');

  if (searchSection) {
    searchSection.style.display = 'none';
  }
  if (introSection) {
    introSection.style.display = 'block';
  }
}

// Initialize search functionality
function initializeSearch() {
  const searchInput = document.getElementById('popup-search-input');
  const searchResults = document.getElementById('popup-search-results');

  if (!searchInput || !searchResults) return;

  // Focus on search input
  setTimeout(() => {
    searchInput.focus();
  }, 100);

  // Add search input event listener
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();

    // Clear previous timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    // Debounce search
    searchTimeout = setTimeout(() => {
      if (query.length > 0) {
        performSearch(query);
      } else {
        showPlaceholder();
      }
    }, 300);
  });

  // Add keyboard navigation
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      navigateResults(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      navigateResults(-1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      openSelectedResult();
    } else if (e.key === 'Escape') {
      window.close();
    }
  });
}

// Perform search
// 检测是否需要拼音搜索 - 暂时禁用拼音搜索以修复搜索问题
function needsPinyinSearch(query) {
  if (!query || !query.trim()) return false;

  // 检测中文字符
  const hasChinese = /[\u4e00-\u9fff]/.test(query);

  // 只有纯中文查询才使用拼音搜索，英文查询一律使用普通搜索
  return hasChinese;
}

async function performSearch(query) {
  // Update category cache for tag detection
  await updateCategoryCache();

  try {
    let results = [];

    // 检测是否需要拼音搜索
    if (needsPinyinSearch(query)) {
      // 使用拼音搜索
      const pinyinResults = await chrome.runtime.sendMessage({
        action: 'search-pinyin',
        query
      }).catch(() => []);

      // 转换为popup格式
      results = (pinyinResults || []).map(item => ({
        type: item.type,
        title: item.title || item.url,
        url: item.url,
        favicon: `chrome://favicon/${item.url}`
      }));
    } else {
      // 使用普通搜索
      const bookmarks = await chrome.bookmarks.search(query);
      const history = await chrome.history.search({
        text: query,
        maxResults: 20
      });

      // Add bookmarks
      bookmarks.forEach(bookmark => {
        if (bookmark.url) {
          results.push({
            type: 'bookmark',
            title: bookmark.title || bookmark.url,
            url: bookmark.url,
            favicon: `chrome://favicon/${bookmark.url}`
          });
        }
      });

      // Add history
      history.forEach(item => {
        if (item.url) {
          results.push({
            type: 'history',
            title: item.title || item.url,
            url: item.url,
            favicon: `chrome://favicon/${item.url}`
          });
        }
      });
    }

    // Remove duplicates and limit results
    const uniqueResults = results.filter((result, index, self) =>
      index === self.findIndex(r => r.url === result.url)
    ).slice(0, 10);

    currentResults = uniqueResults;
    selectedIndex = uniqueResults.length > 0 ? 0 : -1;
    displayResults(uniqueResults);

  } catch (error) {
    console.error('Search error:', error);
    showError('搜索出错，请重试');
  }
}

// Display search results
function displayResults(results) {
  const searchResults = document.getElementById('popup-search-results');
  if (!searchResults) return;

  if (results.length === 0) {
    searchResults.innerHTML = `
      <div class="search-placeholder">
        <div class="placeholder-icon">😔</div>
        <div class="placeholder-text">未找到相关结果</div>
      </div>
    `;
    return;
  }

  const html = results.map((result, index) => {
    const tags = getCategoryTags(result);
    const tagsHTML = tags.length > 0 ?
      `<div class="popup-category-tags">${tags.map(createCategoryTagHTML).join('')}</div>` : '';

    return `
      <div class="search-result-item ${index === selectedIndex ? 'selected' : ''}"
           data-index="${index}" data-url="${result.url}">
        <img class="result-favicon" src="${result.favicon}" alt="" onerror="this.style.display='none'">
        <div class="result-content">
          <div class="result-title">${escapeHtml(result.title)}</div>
          <div class="result-url-container">
            <div class="result-url">${escapeHtml(result.url)}</div>
            ${tagsHTML}
          </div>
        </div>
      </div>
    `;
  }).join('');

  searchResults.innerHTML = html;

  // Add click handlers
  searchResults.querySelectorAll('.search-result-item').forEach(item => {
    item.addEventListener('click', () => {
      const url = item.dataset.url;
      if (url) {
        chrome.tabs.create({ url });
        window.close();
      }
    });
  });
}

// Show placeholder
function showPlaceholder() {
  const searchResults = document.getElementById('popup-search-results');
  if (!searchResults) return;

  searchResults.innerHTML = `
    <div class="search-placeholder">
      <div class="placeholder-icon">🔍</div>
      <div class="placeholder-text">输入内容开始搜索...</div>
    </div>
  `;

  currentResults = [];
  selectedIndex = -1;
}

// Show error
function showError(message) {
  const searchResults = document.getElementById('popup-search-results');
  if (!searchResults) return;

  searchResults.innerHTML = `
    <div class="search-placeholder">
      <div class="placeholder-icon">⚠️</div>
      <div class="placeholder-text">${escapeHtml(message)}</div>
    </div>
  `;
}

// Navigate results with keyboard
function navigateResults(direction) {
  if (currentResults.length === 0) return;

  selectedIndex += direction;

  if (selectedIndex < 0) {
    selectedIndex = currentResults.length - 1;
  } else if (selectedIndex >= currentResults.length) {
    selectedIndex = 0;
  }

  // Update visual selection
  const items = document.querySelectorAll('.search-result-item');
  items.forEach((item, index) => {
    if (index === selectedIndex) {
      item.classList.add('selected');
    } else {
      item.classList.remove('selected');
    }
  });
}

// Open selected result
function openSelectedResult() {
  if (selectedIndex >= 0 && selectedIndex < currentResults.length) {
    const result = currentResults[selectedIndex];
    chrome.tabs.create({ url: result.url });
    window.close();
  }
}

// Update category cache for popup
async function updateCategoryCache() {
  const now = Date.now();

  if (now - categoryCache.lastUpdated < categoryCache.cacheTimeout) {
    return;
  }

  try {
    categoryCache.bookmarks.clear();
    categoryCache.frequent.clear();
    categoryCache.recent.clear();

    // Load data from background script
    const [bookmarks, mostVisited, recentHistory] = await Promise.all([
      chrome.runtime.sendMessage({ action: 'get-bookmarks' }),
      chrome.runtime.sendMessage({ action: 'get-most-visited' }),
      chrome.runtime.sendMessage({ action: 'get-recent-history' })
    ]);

    if (bookmarks) {
      bookmarks.forEach(bookmark => {
        if (bookmark.url) categoryCache.bookmarks.add(bookmark.url);
      });
    }

    if (mostVisited) {
      mostVisited.forEach(item => {
        if (item.url) categoryCache.frequent.add(item.url);
      });
    }

    if (recentHistory) {
      recentHistory.forEach(item => {
        if (item.url) categoryCache.recent.add(item.url);
      });
    }

    categoryCache.lastUpdated = now;
  } catch (error) {
    console.warn('Error updating category cache:', error);
  }
}

// Get category tags for a result
function getCategoryTags(result) {
  const tags = [];

  if (!result.url) return tags;

  if (categoryCache.bookmarks.has(result.url)) {
    tags.push({ type: 'bookmark', label: '书签', icon: '📚', priority: 3 });
  }

  if (categoryCache.frequent.has(result.url)) {
    tags.push({ type: 'frequent', label: '常用', icon: '⭐', priority: 2 });
  }

  if (categoryCache.recent.has(result.url)) {
    tags.push({ type: 'recent', label: '最近', icon: '🕒', priority: 1 });
  }

  return tags.sort((a, b) => b.priority - a.priority).slice(0, 3);
}

// Create category tag HTML
function createCategoryTagHTML(tag) {
  return `<span class="popup-category-tag popup-category-tag-${tag.type}">${tag.icon} ${tag.label}</span>`;
}

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}