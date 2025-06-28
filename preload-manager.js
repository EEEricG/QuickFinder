// QuickFinder预加载管理器
// 负责数据预加载、图标缓存和性能优化

class PreloadManager {
  constructor() {
    this.isInitialized = false;
    this.isPreloading = false;
    this.preloadProgress = {
      total: 0,
      completed: 0,
      failed: 0,
      stage: 'idle'
    };
    
    // 配置参数
    this.config = {
      maxHistoryItems: 100,        // 最大历史记录数量
      maxConcurrentLoads: 10,      // 最大并发加载数
      iconCacheExpiry: 24 * 60 * 60 * 1000, // 24小时缓存过期
      retryAttempts: 3,            // 重试次数
      retryDelay: 1000,            // 重试延迟(ms)
      batchSize: 20                // 批处理大小
    };
    
    // 缓存存储
    this.iconCache = new Map();
    this.urlCache = new Set();
    this.domainCache = new Set();
    
    // 加载队列
    this.loadQueue = [];
    this.activeLoads = new Set();
    
    console.log('🚀 PreloadManager initialized');
  }

  // 初始化预加载管理器
  async initialize() {
    try {
      console.log('🔧 Initializing PreloadManager...');
      
      // 加载配置
      await this.loadConfig();
      
      // 加载现有缓存
      await this.loadIconCache();
      
      // 开始预加载
      await this.startPreload();
      
      this.isInitialized = true;
      console.log('✅ PreloadManager initialized successfully');
      
      return true;
    } catch (error) {
      console.error('❌ PreloadManager initialization failed:', error);
      return false;
    }
  }

  // 加载用户配置
  async loadConfig() {
    try {
      const result = await chrome.storage.local.get(['preloadConfig']);
      if (result.preloadConfig) {
        this.config = { ...this.config, ...result.preloadConfig };
      }
      console.log('📋 Preload config loaded:', this.config);
    } catch (error) {
      console.warn('⚠️ Failed to load preload config, using defaults:', error);
    }
  }

  // 保存配置
  async saveConfig() {
    try {
      await chrome.storage.local.set({ preloadConfig: this.config });
      console.log('💾 Preload config saved');
    } catch (error) {
      console.error('❌ Failed to save preload config:', error);
    }
  }

  // 加载图标缓存
  async loadIconCache() {
    try {
      const result = await chrome.storage.local.get(['iconCache', 'iconCacheTimestamp']);
      
      if (result.iconCache && result.iconCacheTimestamp) {
        const cacheAge = Date.now() - result.iconCacheTimestamp;
        
        if (cacheAge < this.config.iconCacheExpiry) {
          // 缓存仍然有效
          this.iconCache = new Map(Object.entries(result.iconCache));
          console.log(`📦 Loaded ${this.iconCache.size} cached icons`);
        } else {
          console.log('🗑️ Icon cache expired, will rebuild');
          await this.clearIconCache();
        }
      }
    } catch (error) {
      console.warn('⚠️ Failed to load icon cache:', error);
    }
  }

  // 保存图标缓存
  async saveIconCache() {
    try {
      const cacheObject = Object.fromEntries(this.iconCache);
      await chrome.storage.local.set({
        iconCache: cacheObject,
        iconCacheTimestamp: Date.now()
      });
      console.log(`💾 Saved ${this.iconCache.size} icons to cache`);
    } catch (error) {
      console.error('❌ Failed to save icon cache:', error);
    }
  }

  // 清除图标缓存
  async clearIconCache() {
    try {
      this.iconCache.clear();
      await chrome.storage.local.remove(['iconCache', 'iconCacheTimestamp']);
      console.log('🗑️ Icon cache cleared');
    } catch (error) {
      console.error('❌ Failed to clear icon cache:', error);
    }
  }

  // 开始预加载流程
  async startPreload() {
    if (this.isPreloading) {
      console.log('⚠️ Preload already in progress');
      return;
    }

    this.isPreloading = true;
    this.preloadProgress.stage = 'collecting';
    
    try {
      console.log('🔍 Starting data collection...');
      
      // 收集数据
      const data = await this.collectData();
      
      // 提取URL列表
      const urls = this.extractUrls(data);
      
      // 开始图标预加载
      await this.preloadIcons(urls);
      
      console.log('✅ Preload completed successfully');
      
    } catch (error) {
      console.error('❌ Preload failed:', error);
    } finally {
      this.isPreloading = false;
      this.preloadProgress.stage = 'completed';
    }
  }

  // 收集书签和历史数据
  async collectData() {
    console.log('📚 Collecting bookmarks and history...');
    
    const data = {
      bookmarks: [],
      history: [],
      mostVisited: []
    };

    try {
      // 获取书签
      this.preloadProgress.stage = 'bookmarks';
      data.bookmarks = await this.getBookmarks();
      console.log(`📖 Collected ${data.bookmarks.length} bookmarks`);

      // 获取历史记录
      this.preloadProgress.stage = 'history';
      data.history = await this.getRecentHistory();
      console.log(`📜 Collected ${data.history.length} history items`);

      // 获取最常访问
      this.preloadProgress.stage = 'mostVisited';
      data.mostVisited = await this.getMostVisited();
      console.log(`⭐ Collected ${data.mostVisited.length} most visited items`);

    } catch (error) {
      console.error('❌ Failed to collect data:', error);
    }

    return data;
  }

  // 获取所有书签
  async getBookmarks() {
    try {
      const bookmarkTree = await chrome.bookmarks.getTree();
      const bookmarks = [];
      
      const extractBookmarks = (nodes) => {
        for (const node of nodes) {
          if (node.url) {
            bookmarks.push({
              id: node.id,
              title: node.title,
              url: node.url,
              type: 'bookmark',
              priority: 3 // 书签优先级最高
            });
          }
          if (node.children) {
            extractBookmarks(node.children);
          }
        }
      };
      
      extractBookmarks(bookmarkTree);
      return bookmarks;
    } catch (error) {
      console.error('❌ Failed to get bookmarks:', error);
      return [];
    }
  }

  // 获取最近历史记录
  async getRecentHistory() {
    try {
      const history = await chrome.history.search({
        text: '',
        maxResults: this.config.maxHistoryItems,
        startTime: Date.now() - (7 * 24 * 60 * 60 * 1000) // 最近7天
      });
      
      return history.map(item => ({
        id: item.id,
        title: item.title,
        url: item.url,
        type: 'history',
        visitCount: item.visitCount,
        lastVisitTime: item.lastVisitTime,
        priority: 1 // 历史记录优先级最低
      }));
    } catch (error) {
      console.error('❌ Failed to get history:', error);
      return [];
    }
  }

  // 获取最常访问的网站
  async getMostVisited() {
    try {
      const topSites = await chrome.topSites.get();
      return topSites.map(site => ({
        title: site.title,
        url: site.url,
        type: 'topSite',
        priority: 2 // 常访问网站优先级中等
      }));
    } catch (error) {
      console.error('❌ Failed to get most visited:', error);
      return [];
    }
  }

  // 提取并去重URL列表
  extractUrls(data) {
    console.log('🔗 Extracting and deduplicating URLs...');
    
    const allItems = [
      ...data.bookmarks,
      ...data.history,
      ...data.mostVisited
    ];

    // 按优先级排序并去重
    const urlMap = new Map();
    
    for (const item of allItems) {
      if (!item.url) continue;
      
      try {
        const url = new URL(item.url);
        const domain = url.hostname;
        
        // 跳过无效的URL
        if (!domain || domain === 'localhost') continue;
        
        const key = item.url;
        
        if (!urlMap.has(key) || urlMap.get(key).priority < item.priority) {
          urlMap.set(key, {
            url: item.url,
            domain: domain,
            title: item.title,
            priority: item.priority,
            type: item.type
          });
        }
      } catch (error) {
        // 跳过无效URL
        continue;
      }
    }

    // 转换为数组并按优先级排序
    const urls = Array.from(urlMap.values()).sort((a, b) => b.priority - a.priority);
    
    console.log(`🎯 Extracted ${urls.length} unique URLs for preloading`);
    return urls;
  }

  // 预加载图标
  async preloadIcons(urls) {
    console.log(`🖼️ Starting icon preload for ${urls.length} URLs...`);
    
    this.preloadProgress.stage = 'icons';
    this.preloadProgress.total = urls.length;
    this.preloadProgress.completed = 0;
    this.preloadProgress.failed = 0;

    // 分批处理
    for (let i = 0; i < urls.length; i += this.config.batchSize) {
      const batch = urls.slice(i, i + this.config.batchSize);
      await this.processBatch(batch);
      
      // 保存进度
      if (i % (this.config.batchSize * 2) === 0) {
        await this.saveIconCache();
      }
    }

    // 最终保存
    await this.saveIconCache();
    
    console.log(`✅ Icon preload completed: ${this.preloadProgress.completed} success, ${this.preloadProgress.failed} failed`);
  }

  // 处理批次
  async processBatch(batch) {
    const promises = batch.map(item => this.loadIcon(item));
    
    // 限制并发数
    const semaphore = new Semaphore(this.config.maxConcurrentLoads);
    const limitedPromises = promises.map(promise => 
      semaphore.acquire().then(() => 
        promise.finally(() => semaphore.release())
      )
    );
    
    await Promise.allSettled(limitedPromises);
  }

  // 获取适合当前浏览器的favicon URL
  getFaviconUrlForBrowser(url) {
    try {
      const urlObj = new URL(url);

      // 检测浏览器类型
      const userAgent = navigator.userAgent;
      const isEdge = userAgent.includes('Edg');
      const isChrome = userAgent.includes('Chrome') && !isEdge;

      if (isEdge) {
        // Edge浏览器使用Google的favicon服务
        return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=16`;
      } else if (isChrome) {
        // Chrome浏览器使用chrome://favicon
        return `chrome://favicon/${url}`;
      } else {
        // 其他浏览器使用Google的favicon服务
        return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=16`;
      }
    } catch (error) {
      // URL解析失败，返回默认图标
      return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="%23ccc"/></svg>';
    }
  }

  // 加载单个图标
  async loadIcon(item) {
    const { url, domain } = item;

    // 检查是否已缓存
    if (this.iconCache.has(url)) {
      this.preloadProgress.completed++;
      return;
    }

    // 检查域名是否已处理过
    if (this.domainCache.has(domain)) {
      this.preloadProgress.completed++;
      return;
    }

    try {
      const faviconUrl = this.getFaviconUrlForBrowser(url);

      // 预加载图标
      await this.preloadImage(faviconUrl);

      // 缓存成功
      this.iconCache.set(url, {
        faviconUrl: faviconUrl,
        domain: domain,
        timestamp: Date.now(),
        success: true
      });

      this.domainCache.add(domain);
      this.preloadProgress.completed++;

    } catch (error) {
      // 尝试回退到Google favicon服务
      try {
        const urlObj = new URL(url);
        const fallbackUrl = `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=16`;

        await this.preloadImage(fallbackUrl);

        // 缓存回退成功
        this.iconCache.set(url, {
          faviconUrl: fallbackUrl,
          domain: domain,
          timestamp: Date.now(),
          success: true,
          fallback: true
        });

        this.domainCache.add(domain);
        this.preloadProgress.completed++;

      } catch (fallbackError) {
        // 缓存失败信息
        this.iconCache.set(url, {
          faviconUrl: null,
          domain: domain,
          timestamp: Date.now(),
          success: false,
          error: error.message
        });

        this.preloadProgress.failed++;
        console.warn(`⚠️ Failed to load icon for ${url}:`, error.message);
      }
    }
  }

  // 预加载图片
  preloadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      const timeout = setTimeout(() => {
        reject(new Error('Image load timeout'));
      }, 5000);
      
      img.onload = () => {
        clearTimeout(timeout);
        resolve();
      };
      
      img.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('Image load failed'));
      };
      
      img.src = src;
    });
  }

  // 获取图标URL
  getIconUrl(url) {
    const cached = this.iconCache.get(url);
    if (cached && cached.success) {
      return cached.faviconUrl;
    }

    // 返回适合当前浏览器的默认图标URL
    return this.getFaviconUrlForBrowser(url);
  }

  // 检查图标是否已缓存
  isIconCached(url) {
    return this.iconCache.has(url);
  }

  // 获取预加载进度
  getProgress() {
    return { ...this.preloadProgress };
  }

  // 更新配置
  async updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    await this.saveConfig();
    console.log('⚙️ Preload config updated:', this.config);
  }

  // 手动触发预加载
  async triggerPreload() {
    if (!this.isPreloading) {
      console.log('🔄 Manually triggering preload...');
      await this.startPreload();
    }
  }

  // 清理资源
  destroy() {
    this.iconCache.clear();
    this.urlCache.clear();
    this.domainCache.clear();
    this.loadQueue = [];
    this.activeLoads.clear();
    console.log('🧹 PreloadManager destroyed');
  }
}

// 信号量类用于控制并发
class Semaphore {
  constructor(max) {
    this.max = max;
    this.current = 0;
    this.queue = [];
  }

  async acquire() {
    return new Promise((resolve) => {
      if (this.current < this.max) {
        this.current++;
        resolve();
      } else {
        this.queue.push(resolve);
      }
    });
  }

  release() {
    this.current--;
    if (this.queue.length > 0) {
      this.current++;
      const resolve = this.queue.shift();
      resolve();
    }
  }
}

// 导出
if (typeof window !== 'undefined') {
  window.PreloadManager = PreloadManager;
} else if (typeof self !== 'undefined') {
  self.PreloadManager = PreloadManager;
}
