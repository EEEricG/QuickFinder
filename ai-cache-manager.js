// AI Cache Manager - 智能缓存系统
// 用于缓存AI请求结果，减少重复调用，提升性能和降低成本

class AICacheManager {
  constructor(options = {}) {
    this.cache = new Map();
    this.timeouts = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalRequests: 0
    };
    
    // 配置选项
    this.maxSize = options.maxSize || 1000;
    this.defaultTTL = options.defaultTTL || 30 * 60 * 1000; // 30分钟
    this.cleanupInterval = options.cleanupInterval || 5 * 60 * 1000; // 5分钟
    
    // 不同类型的缓存有不同的TTL
    this.ttlByType = {
      'smart-search': 10 * 60 * 1000,      // 10分钟
      'related-bookmarks': 20 * 60 * 1000,  // 20分钟  
      'suggested-searches': 15 * 60 * 1000, // 15分钟
      'topic-analysis': 60 * 60 * 1000,     // 1小时
      'learning-path': 2 * 60 * 60 * 1000,  // 2小时
      'categorization': 4 * 60 * 60 * 1000, // 4小时
      'summary': 24 * 60 * 60 * 1000,       // 24小时
      'duplicates': 60 * 60 * 1000,         // 1小时
      'interest-analysis': 2 * 60 * 60 * 1000 // 2小时
    };
    
    // 启动定期清理
    this.startCleanup();
    
    console.log('🗄️ AI Cache Manager initialized:', {
      maxSize: this.maxSize,
      defaultTTL: this.defaultTTL / 1000 / 60 + 'min',
      cleanupInterval: this.cleanupInterval / 1000 / 60 + 'min'
    });
  }
  
  /**
   * 生成缓存键
   * @param {string} type - 请求类型
   * @param {Object} context - 上下文信息
   * @returns {string} 缓存键
   */
  generateKey(type, context) {
    // 创建稳定的哈希键
    const keyParts = [
      type,
      context.query || '',
      context.currentPage || '',
      context.userContextHash || '',
      context.timeWindow || 'default'
    ];
    
    return keyParts.join('|');
  }
  
  /**
   * 生成用户上下文哈希
   * @param {Array} userBookmarks - 用户书签
   * @returns {string} 上下文哈希
   */
  generateUserContextHash(userBookmarks) {
    if (!userBookmarks || userBookmarks.length === 0) {
      return 'empty';
    }
    
    // 使用书签的主要特征生成哈希
    const features = userBookmarks.slice(0, 20).map(bookmark => ({
      domain: this.extractDomain(bookmark.url),
      titleWords: bookmark.title.toLowerCase().split(' ').slice(0, 3).join('')
    }));
    
    return this.simpleHash(JSON.stringify(features));
  }
  
  /**
   * 提取域名
   * @param {string} url - URL
   * @returns {string} 域名
   */
  extractDomain(url) {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return 'unknown';
    }
  }
  
  /**
   * 简单哈希函数
   * @param {string} str - 输入字符串
   * @returns {string} 哈希值
   */
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return Math.abs(hash).toString(36);
  }
  
  /**
   * 获取缓存项
   * @param {string} type - 请求类型
   * @param {Object} context - 上下文
   * @returns {any|null} 缓存的结果或null
   */
  get(type, context) {
    const key = this.generateKey(type, context);
    this.stats.totalRequests++;
    
    if (this.cache.has(key)) {
      const item = this.cache.get(key);
      
      if (Date.now() > item.expiresAt) {
        // 缓存已过期
        this.cache.delete(key);
        this.clearTimeout(key);
        this.stats.misses++;
        return null;
      }
      
      // 更新访问时间和访问次数
      item.lastAccessed = Date.now();
      item.accessCount++;
      
      this.stats.hits++;
      console.log(`💾 Cache HIT for ${type}:`, {
        key: key.substring(0, 50) + '...',
        age: Math.round((Date.now() - item.createdAt) / 1000) + 's',
        accessCount: item.accessCount
      });
      
      return item.data;
    }
    
    this.stats.misses++;
    console.log(`🔍 Cache MISS for ${type}:`, {
      key: key.substring(0, 50) + '...'
    });
    
    return null;
  }
  
  /**
   * 设置缓存项
   * @param {string} type - 请求类型
   * @param {Object} context - 上下文
   * @param {any} data - 要缓存的数据
   * @param {number} customTTL - 自定义TTL（可选）
   */
  set(type, context, data, customTTL = null) {
    const key = this.generateKey(type, context);
    const ttl = customTTL || this.ttlByType[type] || this.defaultTTL;
    const now = Date.now();
    
    // 如果缓存已满，清理最老的项目
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }
    
    const item = {
      data: data,
      createdAt: now,
      lastAccessed: now,
      expiresAt: now + ttl,
      accessCount: 1,
      type: type,
      size: this.estimateSize(data)
    };
    
    this.cache.set(key, item);
    
    // 设置自动清理定时器
    const timeout = setTimeout(() => {
      this.cache.delete(key);
      this.timeouts.delete(key);
    }, ttl);
    
    this.timeouts.set(key, timeout);
    
    console.log(`💾 Cache SET for ${type}:`, {
      key: key.substring(0, 50) + '...',
      ttl: Math.round(ttl / 1000 / 60) + 'min',
      size: item.size + 'B',
      cacheSize: this.cache.size
    });
  }
  
  /**
   * 估算数据大小
   * @param {any} data - 数据
   * @returns {number} 估算的字节数
   */
  estimateSize(data) {
    try {
      return JSON.stringify(data).length * 2; // 假设UTF-16编码
    } catch {
      return 1000; // 默认大小
    }
  }
  
  /**
   * 清理最老的缓存项
   */
  evictOldest() {
    let oldestKey = null;
    let oldestTime = Date.now();
    
    for (const [key, item] of this.cache.entries()) {
      if (item.lastAccessed < oldestTime) {
        oldestTime = item.lastAccessed;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.clearTimeout(oldestKey);
      this.stats.evictions++;
      
      console.log('🗑️ Evicted oldest cache item:', {
        key: oldestKey.substring(0, 50) + '...',
        age: Math.round((Date.now() - oldestTime) / 1000) + 's'
      });
    }
  }
  
  /**
   * 清理超时定时器
   * @param {string} key - 缓存键
   */
  clearTimeout(key) {
    if (this.timeouts.has(key)) {
      clearTimeout(this.timeouts.get(key));
      this.timeouts.delete(key);
    }
  }
  
  /**
   * 启动定期清理
   */
  startCleanup() {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.cleanupInterval);
  }
  
  /**
   * 执行清理操作
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiresAt) {
        this.cache.delete(key);
        this.clearTimeout(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`🧹 Cache cleanup: removed ${cleaned} expired items, ${this.cache.size} remaining`);
    }
  }
  
  /**
   * 使缓存失效
   * @param {string} type - 类型（可选）
   * @param {Object} context - 上下文（可选）
   */
  invalidate(type = null, context = null) {
    if (type && context) {
      // 失效特定项目
      const key = this.generateKey(type, context);
      if (this.cache.has(key)) {
        this.cache.delete(key);
        this.clearTimeout(key);
        console.log(`🗑️ Invalidated cache for ${type}`);
      }
    } else if (type) {
      // 失效特定类型的所有项目
      let removed = 0;
      for (const [key, item] of this.cache.entries()) {
        if (item.type === type) {
          this.cache.delete(key);
          this.clearTimeout(key);
          removed++;
        }
      }
      console.log(`🗑️ Invalidated ${removed} items of type ${type}`);
    } else {
      // 清空所有缓存
      this.clear();
    }
  }
  
  /**
   * 清空所有缓存
   */
  clear() {
    for (const key of this.timeouts.keys()) {
      this.clearTimeout(key);
    }
    
    this.cache.clear();
    this.timeouts.clear();
    
    console.log('🗑️ All cache cleared');
  }
  
  /**
   * 获取缓存统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    const hitRate = this.stats.totalRequests > 0 
      ? (this.stats.hits / this.stats.totalRequests * 100).toFixed(2)
      : 0;
    
    const totalSize = Array.from(this.cache.values())
      .reduce((sum, item) => sum + item.size, 0);
    
    return {
      ...this.stats,
      hitRate: hitRate + '%',
      currentSize: this.cache.size,
      maxSize: this.maxSize,
      totalSizeBytes: totalSize,
      totalSizeKB: Math.round(totalSize / 1024) + 'KB'
    };
  }
  
  /**
   * 销毁缓存管理器
   */
  destroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    this.clear();
    console.log('🗑️ AI Cache Manager destroyed');
  }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AICacheManager;
} else if (typeof window !== 'undefined') {
  window.AICacheManager = AICacheManager;
} 