// Side Panel Script for QuickFinder
class SidePanelQuickFinder {
  constructor() {
    this.currentResults = [];
    this.selectedIndex = -1;
    this.searchTimeout = null;
    
    this.init();
  }
  
  init() {
    this.searchInput = document.getElementById('sidepanel-search-input');
    this.resultsContainer = document.getElementById('sidepanel-results');
    
    this.setupEventListeners();
    this.loadInitialContent();
  }
  
  setupEventListeners() {
    // Search input
    this.searchInput.addEventListener('input', (e) => {
      this.handleSearch(e.target.value);
    });
    
    // Keyboard navigation
    this.searchInput.addEventListener('keydown', (e) => {
      this.handleKeyDown(e);
    });
    
    // Focus search input when panel opens with enhanced reliability
    this.focusSearchInput();
  }
  
  handleSearch(query) {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    
    this.searchTimeout = setTimeout(() => {
      if (query.trim() === '') {
        this.loadInitialContent();
      } else {
        this.performSearch(query);
      }
    }, 150);
  }
  
  async loadInitialContent() {
    try {
      // Load recent bookmarks and history
      const [bookmarks, history] = await Promise.all([
        this.sendMessage({ action: 'get-bookmarks' }),
        this.sendMessage({ action: 'get-recent-history' })
      ]);
      
      // Combine and limit results
      const combined = [
        ...(bookmarks || []).slice(0, 15),
        ...(history || []).slice(0, 15)
      ];
      
      this.currentResults = combined.slice(0, 20);
      this.selectedIndex = this.currentResults.length > 0 ? 0 : -1;
      this.renderResults();
      this.updateSelection();
    } catch (error) {
      console.error('Error loading initial content:', error);
      this.showError('加载内容失败');
    }
  }
  
  async performSearch(query) {
    try {
      const [bookmarks, history] = await Promise.all([
        this.sendMessage({ action: 'search-bookmarks', query }),
        this.sendMessage({ action: 'search-history', query })
      ]);
      
      // Combine and deduplicate results
      const combined = [
        ...(bookmarks || []),
        ...(history || [])
      ];
      
      // Remove duplicates based on URL
      const uniqueResults = [];
      const seenUrls = new Set();
      
      for (const item of combined) {
        if (item.url && !seenUrls.has(item.url)) {
          seenUrls.add(item.url);
          uniqueResults.push(item);
        }
      }
      
      this.currentResults = uniqueResults.slice(0, 30);
      this.selectedIndex = this.currentResults.length > 0 ? 0 : -1;
      this.renderResults();
      this.updateSelection();
    } catch (error) {
      console.error('Error performing search:', error);
      this.showError('搜索失败');
    }
  }
  
  renderResults() {
    if (this.currentResults.length === 0) {
      this.resultsContainer.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #666;">
          <div style="font-size: 48px; margin-bottom: 10px;">😔</div>
          <div>没有找到匹配的结果</div>
        </div>
      `;
      return;
    }
    
    this.resultsContainer.innerHTML = '';
    
    this.currentResults.forEach((result, index) => {
      const item = this.createResultItem(result, index);
      this.resultsContainer.appendChild(item);
    });
  }
  
  createResultItem(result, index) {
    const item = document.createElement('div');
    item.className = 'quickfinder-result-item';
    item.dataset.index = index;
    
    const icon = result.type === 'bookmark' ? '⭐' : '🕒';
    const typeText = result.type === 'bookmark' ? '书签' : '历史';
    
    item.innerHTML = `
      <div class="quickfinder-result-icon">${icon}</div>
      <div class="quickfinder-result-content">
        <div class="quickfinder-result-title">${this.escapeHtml(result.title || 'Untitled')}</div>
        <div class="quickfinder-result-url">${this.escapeHtml(result.url || '')}</div>
        <div class="quickfinder-result-type">${typeText}</div>
      </div>
    `;
    
    // Click handler
    item.addEventListener('click', () => {
      this.openResult(result);
    });
    
    // Hover handler
    item.addEventListener('mouseenter', () => {
      this.selectedIndex = index;
      this.updateSelection();
    });
    
    return item;
  }
  
  handleKeyDown(e) {
    if (this.currentResults.length === 0) return;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.selectedIndex = Math.min(this.selectedIndex + 1, this.currentResults.length - 1);
        this.updateSelection();
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
        this.updateSelection();
        break;
        
      case 'Enter':
        e.preventDefault();
        if (this.selectedIndex >= 0 && this.currentResults[this.selectedIndex]) {
          this.openResult(this.currentResults[this.selectedIndex]);
        }
        break;
        
      case 'Escape':
        e.preventDefault();
        this.searchInput.value = '';
        this.loadInitialContent();
        break;
    }
  }
  
  updateSelection() {
    const items = this.resultsContainer.querySelectorAll('.quickfinder-result-item');
    items.forEach((item, index) => {
      if (index === this.selectedIndex) {
        item.classList.add('selected');
        item.scrollIntoView({ block: 'nearest' });
      } else {
        item.classList.remove('selected');
      }
    });
  }
  
  openResult(result) {
    if (result.url) {
      // Open in new tab
      chrome.tabs.create({ url: result.url });
    } else if (result.type === 'folder') {
      // Handle folder navigation
      this.loadFolderContent(result.id);
    }
  }
  
  async loadFolderContent(folderId) {
    try {
      const folderContents = await this.sendMessage({ 
        action: 'get-folder-contents', 
        folderId 
      });
      
      this.currentResults = folderContents || [];
      this.selectedIndex = this.currentResults.length > 0 ? 0 : -1;
      this.renderResults();
      this.updateSelection();
    } catch (error) {
      console.error('Error loading folder content:', error);
      this.showError('加载文件夹内容失败');
    }
  }
  
  showError(message) {
    this.resultsContainer.innerHTML = `
      <div style="text-align: center; padding: 40px; color: #dc3545;">
        <div style="font-size: 48px; margin-bottom: 10px;">❌</div>
        <div>${message}</div>
      </div>
    `;
  }
  
  sendMessage(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      });
    });
  }
  
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // 专门的聚焦方法，确保Side Panel中搜索框能正常聚焦
  focusSearchInput() {
    const attemptFocus = (attempt = 1) => {
      if (attempt > 5) {
        console.warn('⚠️ Side Panel: Failed to focus search input after 5 attempts');
        return;
      }

      setTimeout(() => {
        if (this.searchInput) {
          try {
            // 确保元素可见且可聚焦
            if (this.searchInput.offsetParent !== null) {
              this.searchInput.focus();
              console.log(`✅ Side Panel: Search input focused on attempt ${attempt}`);

              // 验证聚焦是否成功
              setTimeout(() => {
                if (document.activeElement !== this.searchInput) {
                  console.log(`⚠️ Side Panel: Focus verification failed on attempt ${attempt}, retrying...`);
                  attemptFocus(attempt + 1);
                }
              }, 50);
            } else {
              console.log(`⚠️ Side Panel: Search input not visible on attempt ${attempt}, retrying...`);
              attemptFocus(attempt + 1);
            }
          } catch (error) {
            console.error(`❌ Side Panel: Error focusing search input on attempt ${attempt}:`, error);
            attemptFocus(attempt + 1);
          }
        } else {
          console.log(`⚠️ Side Panel: Search input not available on attempt ${attempt}, retrying...`);
          attemptFocus(attempt + 1);
        }
      }, attempt * 100); // 递增延迟：100ms, 200ms, 300ms, 400ms, 500ms
    };

    attemptFocus();
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new SidePanelQuickFinder();
});
