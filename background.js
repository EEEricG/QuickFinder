// Background service worker for QuickFinder extension

// Global AI service instances
let aiServiceOptimized = null;
let aiServiceManager = null;
let aiServiceInstance = null;

// Global preload manager instance
let preloadManager = null;

// 性能优化 - 智能缓存系统
class PerformanceCache {
  constructor() {
    this.bookmarksCache = null;
    this.historyCache = null;
    this.searchResultsCache = new Map(); // 搜索结果缓存
    this.pinyinIndexCache = new Map(); // 拼音索引缓存

    // 缓存时间戳
    this.bookmarksCacheTime = 0;
    this.historyCacheTime = 0;
    this.pinyinCacheTime = 0;

    // 缓存配置
    this.config = {
      bookmarksCacheDuration: 10 * 60 * 1000, // 10分钟
      historyCacheDuration: 5 * 60 * 1000,    // 5分钟
      searchResultsCacheDuration: 2 * 60 * 1000, // 2分钟
      pinyinCacheDuration: 10 * 60 * 1000,    // 10分钟
      maxSearchResults: 1000,                  // 最大缓存搜索结果数
      maxMemoryMB: 50,                        // 最大内存使用50MB
      cleanupInterval: 30 * 60 * 1000         // 30分钟清理一次
    };

    // 性能监控
    this.stats = {
      cacheHits: 0,
      cacheMisses: 0,
      totalSearches: 0,
      avgResponseTime: 0,
      memoryUsage: 0
    };

    // 启动定期清理
    this.startPeriodicCleanup();

    console.log('🚀 Performance Cache System initialized');
  }

  // 启动定期清理
  startPeriodicCleanup() {
    setInterval(() => {
      this.cleanupExpiredCache();
      this.monitorMemoryUsage();
    }, this.config.cleanupInterval);
  }

  // 清理过期缓存
  cleanupExpiredCache() {
    const now = Date.now();
    let cleanedCount = 0;

    // 清理搜索结果缓存
    for (const [key, value] of this.searchResultsCache.entries()) {
      if (now - value.timestamp > this.config.searchResultsCacheDuration) {
        this.searchResultsCache.delete(key);
        cleanedCount++;
      }
    }

    // 清理过期的主缓存
    if (now - this.bookmarksCacheTime > this.config.bookmarksCacheDuration) {
      this.bookmarksCache = null;
      this.bookmarksCacheTime = 0;
    }

    if (now - this.historyCacheTime > this.config.historyCacheDuration) {
      this.historyCache = null;
      this.historyCacheTime = 0;
    }

    if (now - this.pinyinCacheTime > this.config.pinyinCacheDuration) {
      this.pinyinIndexCache.clear();
      this.pinyinCacheTime = 0;
    }

    console.log(`🧹 Cache cleanup: removed ${cleanedCount} expired entries`);
  }

  // 监控内存使用
  monitorMemoryUsage() {
    const memoryInfo = this.estimateMemoryUsage();
    this.stats.memoryUsage = memoryInfo.totalMB;

    if (memoryInfo.totalMB > this.config.maxMemoryMB) {
      console.warn(`⚠️ Memory usage high: ${memoryInfo.totalMB}MB, forcing cleanup`);
      this.forceCleanup();
    }

    console.log(`📊 Memory usage: ${memoryInfo.totalMB}MB (${memoryInfo.breakdown})`);
  }

  // 估算内存使用
  estimateMemoryUsage() {
    const bookmarksSize = this.bookmarksCache ? JSON.stringify(this.bookmarksCache).length : 0;
    const historySize = this.historyCache ? JSON.stringify(this.historyCache).length : 0;
    const searchResultsSize = JSON.stringify([...this.searchResultsCache.values()]).length;
    const pinyinSize = JSON.stringify([...this.pinyinIndexCache.entries()]).length;

    const totalBytes = bookmarksSize + historySize + searchResultsSize + pinyinSize;
    const totalMB = (totalBytes / (1024 * 1024)).toFixed(2);

    return {
      totalMB: parseFloat(totalMB),
      breakdown: `Bookmarks: ${(bookmarksSize/1024).toFixed(1)}KB, History: ${(historySize/1024).toFixed(1)}KB, Search: ${(searchResultsSize/1024).toFixed(1)}KB, Pinyin: ${(pinyinSize/1024).toFixed(1)}KB`
    };
  }

  // 强制清理
  forceCleanup() {
    // 清理一半的搜索结果缓存
    const entries = [...this.searchResultsCache.entries()];
    const toDelete = entries.slice(0, Math.floor(entries.length / 2));
    toDelete.forEach(([key]) => this.searchResultsCache.delete(key));

    // 清理拼音缓存
    this.pinyinIndexCache.clear();
    this.pinyinCacheTime = 0;

    console.log('🔥 Forced cache cleanup completed');
  }

  // 获取性能统计
  getStats() {
    return {
      ...this.stats,
      cacheHitRate: this.stats.totalSearches > 0 ?
        (this.stats.cacheHits / this.stats.totalSearches * 100).toFixed(2) + '%' : '0%',
      memoryUsage: this.stats.memoryUsage + 'MB'
    };
  }
}

// 全局缓存实例
const performanceCache = new PerformanceCache();

// 扩展启动时的预加载
async function initializeExtension() {
  console.log('🚀 Initializing QuickFinder extension...');

  try {
    // 预加载核心数据
    const startTime = performance.now();

    await Promise.all([
      preloadBookmarks(),
      preloadHistory()
    ]);

    const endTime = performance.now();
    console.log(`✅ Extension initialized in ${(endTime - startTime).toFixed(2)}ms`);

    // 输出性能统计
    console.log('📊 Performance stats:', performanceCache.getStats());

  } catch (error) {
    console.error('❌ Extension initialization failed:', error);
  }
}

// 监听扩展启动事件
chrome.runtime.onStartup.addListener(initializeExtension);
chrome.runtime.onInstalled.addListener(initializeExtension);

// 监听书签变化，清除相关缓存并立即重新加载
chrome.bookmarks.onCreated.addListener(async (id, bookmark) => {
  performanceCache.bookmarksCache = null;
  performanceCache.bookmarksCacheTime = 0;
  console.log('📚 Bookmark cache invalidated due to creation:', bookmark.title);

  // 立即重新加载书签缓存，确保新书签能被搜索到
  try {
    await getAllBookmarks();
    console.log('✅ Bookmark cache refreshed after creation');
  } catch (error) {
    console.error('❌ Failed to refresh bookmark cache:', error);
  }
});

chrome.bookmarks.onRemoved.addListener(() => {
  performanceCache.bookmarksCache = null;
  performanceCache.bookmarksCacheTime = 0;
  console.log('📚 Bookmark cache invalidated due to removal');
});

chrome.bookmarks.onChanged.addListener(() => {
  performanceCache.bookmarksCache = null;
  performanceCache.bookmarksCacheTime = 0;
  console.log('📚 Bookmark cache invalidated due to change');
});

chrome.bookmarks.onMoved.addListener(() => {
  performanceCache.bookmarksCache = null;
  performanceCache.bookmarksCacheTime = 0;
  console.log('📚 Bookmark cache invalidated due to move');
});

// 简化版拼音转换（与lib中的保持一致）
const PINYIN_MAP = {
  '中': 'zhong', '国': 'guo', '人': 'ren', '大': 'da', '小': 'xiao',
  '好': 'hao', '的': 'de', '是': 'shi', '在': 'zai', '有': 'you',
  '我': 'wo', '他': 'ta', '她': 'ta', '它': 'ta', '们': 'men',
  '这': 'zhe', '那': 'na', '个': 'ge', '了': 'le', '不': 'bu',
  '一': 'yi', '二': 'er', '三': 'san', '四': 'si', '五': 'wu',
  '六': 'liu', '七': 'qi', '八': 'ba', '九': 'jiu', '十': 'shi',
  '百': 'bai', '千': 'qian', '万': 'wan', '年': 'nian', '月': 'yue',
  '日': 'ri', '时': 'shi', '分': 'fen', '秒': 'miao', '上': 'shang',
  '下': 'xia', '左': 'zuo', '右': 'you', '前': 'qian', '后': 'hou',
  '东': 'dong', '南': 'nan', '西': 'xi', '北': 'bei', '内': 'nei',
  '外': 'wai', '里': 'li', '面': 'mian', '边': 'bian', '来': 'lai',
  '去': 'qu', '到': 'dao', '从': 'cong', '向': 'xiang', '对': 'dui',
  '和': 'he', '与': 'yu', '及': 'ji', '以': 'yi', '为': 'wei',
  '被': 'bei', '把': 'ba', '让': 'rang', '使': 'shi', '得': 'de',
  '着': 'zhe', '过': 'guo', '起': 'qi', '开': 'kai', '关': 'guan',
  '打': 'da', '做': 'zuo', '说': 'shuo', '看': 'kan', '听': 'ting',
  '想': 'xiang', '知': 'zhi', '道': 'dao', '会': 'hui', '能': 'neng',
  '可': 'ke', '要': 'yao', '应': 'ying', '该': 'gai', '必': 'bi',
  '须': 'xu', '需': 'xu', '用': 'yong', '给': 'gei', '拿': 'na',
  '放': 'fang', '买': 'mai', '卖': 'mai', '吃': 'chi', '喝': 'he',
  '穿': 'chuan', '住': 'zhu', '行': 'xing', '走': 'zou', '跑': 'pao',
  '飞': 'fei', '游': 'you', '泳': 'yong', '学': 'xue', '习': 'xi',
  '工': 'gong', '作': 'zuo', '生': 'sheng', '活': 'huo', '家': 'jia',
  '庭': 'ting', '父': 'fu', '母': 'mu', '子': 'zi', '女': 'nv',
  '男': 'nan', '老': 'lao', '少': 'shao', '新': 'xin', '旧': 'jiu',
  '高': 'gao', '低': 'di', '长': 'chang', '短': 'duan', '宽': 'kuan',
  '窄': 'zhai', '厚': 'hou', '薄': 'bao', '重': 'zhong', '轻': 'qing',
  '快': 'kuai', '慢': 'man', '早': 'zao', '晚': 'wan', '多': 'duo',
  '少': 'shao', '全': 'quan', '半': 'ban', '空': 'kong', '满': 'man',
  '红': 'hong', '黄': 'huang', '蓝': 'lan', '绿': 'lv', '白': 'bai',
  '黑': 'hei', '灰': 'hui', '粉': 'fen', '紫': 'zi', '书': 'shu',
  '本': 'ben', '页': 'ye', '字': 'zi', '词': 'ci', '句': 'ju',
  '段': 'duan', '章': 'zhang', '文': 'wen', '网': 'wang', '站': 'zhan',
  '链': 'lian', '接': 'jie', '地': 'di', '址': 'zhi', '搜': 'sou',
  '索': 'suo', '查': 'cha', '找': 'zhao', '发': 'fa', '现': 'xian',
  '结': 'jie', '果': 'guo', '信': 'xin', '息': 'xi', '数': 'shu',
  '据': 'ju', '件': 'jian', '图': 'tu', '片': 'pian', '视': 'shi',
  '频': 'pin', '音': 'yin', '乐': 'le', '电': 'dian', '影': 'ying',
  '戏': 'xi', '软': 'ruan', '应': 'ying', '程': 'cheng', '序': 'xu',
  '系': 'xi', '统': 'tong', '设': 'she', '置': 'zhi', '配': 'pei',
  '管': 'guan', '理': 'li', '员': 'yuan', '户': 'hu', '密': 'mi',
  '码': 'ma', '登': 'deng', '录': 'lu', '注': 'zhu', '册': 'ce',
  '退': 'tui', '出': 'chu', '保': 'bao', '存': 'cun', '删': 'shan',
  '除': 'chu', '修': 'xiu', '改': 'gai', '更': 'geng', '添': 'tian',
  '加': 'jia', '创': 'chuang', '建': 'jian', '编': 'bian', '辑': 'ji',
  '复': 'fu', '制': 'zhi', '粘': 'zhan', '贴': 'tie', '剪': 'jian',
  '切': 'qie', '撤': 'che', '销': 'xiao', '重': 'chong', '确': 'que',
  '定': 'ding', '取': 'qu', '消': 'xiao', '帮': 'bang', '助': 'zhu',
  '于': 'yu', '版': 'ban', '权': 'quan', '联': 'lian', '反': 'fan',
  '馈': 'kui', '意': 'yi', '见': 'jian', '建': 'jian', '议': 'yi',
  // 技术相关词汇 - 支持"advance"等词汇的拼音搜索
  '高': 'gao', '级': 'ji', '进': 'jin', '阶': 'jie', '先': 'xian',
  '进': 'jin', '技': 'ji', '术': 'shu', '科': 'ke', '学': 'xue',
  '研': 'yan', '究': 'jiu', '开': 'kai', '发': 'fa', '编': 'bian',
  '程': 'cheng', '代': 'dai', '码': 'ma', '算': 'suan', '法': 'fa',
  '数': 'shu', '据': 'ju', '库': 'ku', '服': 'fu', '务': 'wu',
  '器': 'qi', '客': 'ke', '户': 'hu', '端': 'duan', '界': 'jie',
  '面': 'mian', '设': 'she', '计': 'ji', '架': 'jia', '构': 'gou',
  '框': 'kuang', '架': 'jia', '模': 'mo', '块': 'kuai', '组': 'zu',
  '件': 'jian', '功': 'gong', '能': 'neng', '特': 'te', '性': 'xing',
  '优': 'you', '化': 'hua', '性': 'xing', '能': 'neng', '效': 'xiao',
  '率': 'lv', '速': 'su', '度': 'du', '质': 'zhi', '量': 'liang',
  '稳': 'wen', '定': 'ding', '安': 'an', '全': 'quan', '可': 'ke',
  '靠': 'kao', '扩': 'kuo', '展': 'zhan', '维': 'wei', '护': 'hu',
  '测': 'ce', '试': 'shi', '调': 'tiao', '试': 'shi', '部': 'bu',
  '署': 'shu', '发': 'fa', '布': 'bu', '版': 'ban', '本': 'ben',
  '更': 'geng', '新': 'xin', '升': 'sheng', '级': 'ji', '修': 'xiu',
  '复': 'fu', '备': 'bei', '份': 'fen', '恢': 'hui', '复': 'fu',
  '监': 'jian', '控': 'kong', '日': 'ri', '志': 'zhi', '记': 'ji',
  '录': 'lu', '分': 'fen', '析': 'xi', '统': 'tong', '计': 'ji',
  '报': 'bao', '告': 'gao', '文': 'wen', '档': 'dang', '说': 'shuo',
  '明': 'ming', '教': 'jiao', '程': 'cheng', '指': 'zhi', '南': 'nan',
  '手': 'shou', '册': 'ce', '参': 'can', '考': 'kao', '示': 'shi',
  '例': 'li', '演': 'yan', '示': 'shi', '培': 'pei', '训': 'xun',
  '学': 'xue', '习': 'xi', '实': 'shi', '践': 'jian', '项': 'xiang',
  '目': 'mu', '任': 'ren', '务': 'wu', '计': 'ji', '划': 'hua',
  '方': 'fang', '案': 'an', '策': 'ce', '略': 'lve', '流': 'liu',
  '程': 'cheng', '步': 'bu', '骤': 'zhou', '操': 'cao', '作': 'zuo'
};

// 拼音处理函数
function hasChinese(text) {
  return /[\u4e00-\u9fff]/.test(text);
}

function convertToPinyin(text) {
  if (!text || !hasChinese(text)) {
    return [text.toLowerCase()];
  }

  const result = [];
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (PINYIN_MAP[char]) {
      result.push(PINYIN_MAP[char]);
    } else if (/[a-zA-Z0-9]/.test(char)) {
      result.push(char.toLowerCase());
    }
  }
  return result;
}

function generatePinyinIndex(text) {
  if (!text) return [];

  const indexes = new Set();

  // 原文
  indexes.add(text.toLowerCase());

  if (hasChinese(text)) {
    // 完整拼音
    const fullPinyin = convertToPinyin(text).join('');
    if (fullPinyin) indexes.add(fullPinyin);

    // 首字母拼音
    const firstLetters = convertToPinyin(text).map(py => py[0] || '').join('');
    if (firstLetters) indexes.add(firstLetters);

    // 分词拼音（简单实现）
    const words = text.split(/[\s\-_]+/);
    words.forEach(word => {
      if (word && hasChinese(word)) {
        const wordPinyin = convertToPinyin(word).join('');
        if (wordPinyin) indexes.add(wordPinyin);

        const wordFirstLetters = convertToPinyin(word).map(py => py[0] || '').join('');
        if (wordFirstLetters) indexes.add(wordFirstLetters);
      }
    });
  }

  return Array.from(indexes);
}

// 增强的拼音匹配检测函数 - 支持部分字符匹配
function searchPinyinMatch(query, indexes) {
  if (!query || !indexes || indexes.length === 0) return false;

  const lowerQuery = query.toLowerCase().trim();

  return indexes.some(index => {
    const lowerIndex = index.toLowerCase();

    // 1. 完整匹配
    if (lowerIndex.includes(lowerQuery) || lowerQuery.includes(lowerIndex)) {
      return true;
    }

    // 2. 部分字符匹配 - 支持跨词搜索
    if (partialMatch(lowerQuery, lowerIndex)) {
      return true;
    }

    // 3. 分词后的部分匹配
    const words = lowerIndex.split(/[\s\-_]+/);
    return words.some(word => {
      return word.includes(lowerQuery) || partialMatch(lowerQuery, word);
    });
  });
}

// 部分字符匹配算法
function partialMatch(query, target) {
  if (!query || !target) return false;

  // 如果查询长度小于3，只进行前缀匹配避免过多误匹配
  if (query.length < 3) {
    return target.startsWith(query);
  }

  // 对于较长的查询，支持更灵活的部分匹配
  let queryIndex = 0;
  let targetIndex = 0;

  while (queryIndex < query.length && targetIndex < target.length) {
    if (query[queryIndex] === target[targetIndex]) {
      queryIndex++;
    }
    targetIndex++;
  }

  // 如果查询的所有字符都在目标字符串中按顺序找到
  return queryIndex === query.length;
}

// 增强的标题匹配函数 - 优化部分匹配
function enhancedTitleMatch(query, title) {
  if (!query || !title) return false;

  const queryLower = query.toLowerCase().trim();
  const titleLower = title.toLowerCase();

  // 1. 直接包含匹配 - 最高优先级
  if (titleLower.includes(queryLower)) {
    return true;
  }

  // 2. 分词匹配 - 检查每个单词
  const titleWords = titleLower.split(/[\s\-_\.]+/);
  const hasWordMatch = titleWords.some(word => {
    // 直接包含或部分匹配
    return word.includes(queryLower) ||
           word.startsWith(queryLower) ||
           partialMatch(queryLower, word);
  });

  if (hasWordMatch) {
    return true;
  }

  // 3. 跨词部分匹配
  const titleWithoutSpaces = titleLower.replace(/[\s\-_\.]+/g, '');
  if (partialMatch(queryLower, titleWithoutSpaces)) {
    return true;
  }

  // 4. 特殊情况：查询是单词的开头部分
  const queryStartsWord = titleWords.some(word => word.startsWith(queryLower));
  if (queryStartsWord) {
    return true;
  }

  return false;
}

// Enhanced AI Service for Service Worker with performance optimizations
class BackgroundAIService {
  constructor() {
    this.providers = {
      siliconflow: {
        name: '硅基流动 (SiliconFlow)',
        apiUrl: 'https://api.siliconflow.cn/v1/chat/completions',
        models: [
          { id: 'deepseek-ai/DeepSeek-V3', name: 'DeepSeek-V3', description: '深度求索V3模型' },
          { id: 'Qwen/Qwen2.5-72B-Instruct', name: 'Qwen2.5-72B', description: '通义千问2.5-72B' }
        ]
      },
      openai: {
        name: 'OpenAI',
        apiUrl: 'https://api.openai.com/v1/chat/completions',
        models: [
          { id: 'gpt-4o', name: 'GPT-4o', description: 'OpenAI最新模型' },
          { id: 'gpt-4', name: 'GPT-4', description: 'GPT-4模型' }
        ]
      },
      google: {
        name: 'Google Gemini',
        apiUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
        models: [
          { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: '最新的高性能Gemini模型' },
          { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: '快速响应的Gemini 2.5模型' },
          { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', description: '轻量级Gemini 2.5模型' },
          { id: 'gemini-2.5-flash-lite preview-06-17', name: 'Gemini 2.5 Flash Lite Preview', description: 'Gemini 2.5 Flash Lite预览版' },
          { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'Gemini 1.5 Pro模型' },
          { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: 'Gemini 1.5 Flash模型' }
        ]
      }
    };
    this.settings = null;
    this.retryConfig = {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      backoffFactor: 2
    };
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5分钟缓存

    console.log('🔧 Enhanced Background AI Service initialized');
  }

  async loadSettings() {
    try {
      let result = {};
      try {
        result = await chrome.storage.local.get(['aiSettings']);
      } catch (localError) {
        console.warn('⚠️ Local storage failed:', localError);
        result = await chrome.storage.sync.get(['aiSettings']);
      }

      this.settings = result.aiSettings || {
        provider: 'siliconflow',
        model: 'deepseek-ai/DeepSeek-V3',
        apiKey: '',
        enabledFeatures: ['smart-search', 'auto-categorize', 'summarize', 'recommendations']
      };

      console.log('📋 AI settings loaded:', {
        provider: this.settings.provider,
        model: this.settings.model,
        hasApiKey: !!this.settings.apiKey
      });
    } catch (error) {
      console.error('❌ Error loading AI settings:', error);
      this.settings = {
        provider: 'siliconflow',
        model: 'deepseek-ai/DeepSeek-V3',
        apiKey: '',
        enabledFeatures: ['smart-search', 'auto-categorize', 'summarize', 'recommendations']
      };
    }
  }

  isFeatureEnabled(feature) {
    return this.settings?.enabledFeatures?.includes(feature) || false;
  }

  isAvailable() {
    return !!(this.settings?.apiKey && this.settings?.provider && this.providers[this.settings.provider]);
  }

  // 指数退避重试逻辑
  async retryWithBackoff(operation, context = '') {
    let lastError;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = Math.min(
            this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffFactor, attempt - 1),
            this.retryConfig.maxDelay
          );
          console.log(`🔄 Retry attempt ${attempt} for ${context} after ${delay}ms`);
          await this.sleep(delay);
        }

        return await operation();
      } catch (error) {
        lastError = error;

        // 检查是否为不可重试的错误
        if (this.isNonRetryableError(error)) {
          console.error(`❌ Non-retryable error in ${context}:`, error.message);
          throw error;
        }

        if (attempt === this.retryConfig.maxRetries) {
          console.error(`❌ Max retries exceeded for ${context}:`, error.message);
          throw error;
        }

        console.warn(`⚠️ Attempt ${attempt + 1} failed for ${context}:`, error.message);
      }
    }

    throw lastError;
  }

  // 判断是否为不可重试的错误
  isNonRetryableError(error) {
    if (error.status) {
      // 4xx客户端错误通常不可重试
      return error.status >= 400 && error.status < 500;
    }

    // 检查错误消息中的关键词
    const nonRetryableKeywords = [
      'invalid api key',
      'unauthorized',
      'forbidden',
      'bad request',
      'invalid input',
      'quota exceeded permanently'
    ];

    const errorMessage = error.message?.toLowerCase() || '';
    return nonRetryableKeywords.some(keyword => errorMessage.includes(keyword));
  }

  // 工具函数：延迟
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 缓存管理
  getCacheKey(operation, data) {
    return `${operation}:${JSON.stringify(data)}`;
  }

  getCachedResult(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      console.log('📦 Using cached result for:', key.split(':')[0]);
      return cached.result;
    }
    return null;
  }

  setCachedResult(key, result) {
    this.cache.set(key, {
      result: result,
      timestamp: Date.now()
    });

    // 清理过期缓存
    if (this.cache.size > 100) {
      const now = Date.now();
      for (const [k, v] of this.cache.entries()) {
        if (now - v.timestamp > this.cacheTimeout) {
          this.cache.delete(k);
        }
      }
    }
  }

  async request(messages, options = {}) {
    return await this.retryWithBackoff(async () => {
      if (!this.isAvailable()) {
        throw new Error('AI服务未配置或不可用');
      }

      // 对于Google Gemini，使用专用方法
      if (this.settings.provider === 'google') {
        return await this.requestGemini(messages, options);
      }

      const provider = this.providers[this.settings.provider];
      const apiUrl = provider.apiUrl;
      const apiKey = this.settings.apiKey;
      const model = this.settings.model;

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      };

      const requestBody = {
        model: model,
        messages: messages,
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 2000
      };

      console.log('🚀 AI请求:', { provider: this.settings.provider, model, messageCount: messages.length });

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(requestBody),
        mode: 'cors'
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API错误:', response.status, errorText);
        const error = new Error(`API请求失败: ${response.status} ${response.statusText}`);
        error.status = response.status;
        error.response = errorText;
        throw error;
      }

      const data = await response.json();
      if (data.choices && data.choices[0] && data.choices[0].message) {
        return data.choices[0].message.content;
      }

      throw new Error('无效的API响应格式');
    }, `AI request to ${this.settings.provider}`);
  }

  // Google Gemini专用请求方法
  async requestGemini(messages, options = {}) {
    const provider = this.providers[this.settings.provider];
    const model = this.settings.model;
    const apiKey = this.settings.apiKey;
    
    // 构建Gemini API URL
    const apiUrl = `${provider.apiUrl}/${model}:generateContent?key=${apiKey}`;
    
    // 转换消息格式为Gemini格式
    const contents = messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.role === 'system' ? `System: ${msg.content}` : msg.content }]
    }));
    
    const requestBody = {
      contents: contents,
      generationConfig: {
        temperature: options.temperature || 0.7,
        maxOutputTokens: options.maxTokens || 2000
      }
    };

    console.log('🚀 Gemini API请求:', { model, messageCount: messages.length });

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      mode: 'cors'
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Gemini API错误:', response.status, errorText);
      const error = new Error(`Gemini API请求失败: ${response.status} ${response.statusText}`);
      error.status = response.status;
      error.response = errorText;
      throw error;
    }

    const data = await response.json();
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      return data.candidates[0].content.parts[0].text;
    }

    throw new Error('无效的Gemini API响应格式');
  }

  async smartSearch(query, bookmarks) {
    console.log('🔍 Starting enhanced smartSearch for:', query);

    // 检查缓存
    const cacheKey = this.getCacheKey('smart-search', { query, bookmarkCount: bookmarks.length });
    const cached = this.getCachedResult(cacheKey);
    if (cached) {
      return cached;
    }

    const messages = [
      {
        role: 'system',
        content: `你是一个智能书签搜索助手。基于用户的自然语言查询，从书签列表中找到最相关的结果。

理解查询意图，匹配相关书签，按相关性排序。支持：
- 主题搜索（如"前端开发"、"机器学习"）
- 功能搜索（如"在线工具"、"学习资源"）
- 情感搜索（如"有趣的"、"实用的"）

返回JSON格式：
{
  "results": [
    {
      "id": "书签ID",
      "title": "标题",
      "url": "URL",
      "relevanceScore": 0.95,
      "reason": "匹配原因"
    }
  ],
  "totalFound": 数量,
  "searchIntent": "查询意图分析"
}`
      },
      {
        role: 'user',
        content: `查询: "${query}"

书签数据:
${JSON.stringify(bookmarks.slice(0, 50).map(b => ({
  id: b.id,
  title: b.title,
  url: b.url,
  type: b.type || 'bookmark'
})), null, 2)}

请找出最相关的书签并解释匹配原因。`
      }
    ];

    try {
      console.log('🚀 Sending enhanced smart search request...');
      const response = await this.request(messages, { maxTokens: 1500 });
      console.log('📥 Raw search response:', response);

      // 清理响应
      let cleanResponse = response.trim();
      if (cleanResponse.includes('```')) {
        cleanResponse = cleanResponse.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
      }

      const result = JSON.parse(cleanResponse);
      console.log('✅ Parsed search result:', result);

      // 缓存结果
      this.setCachedResult(cacheKey, result);

      return result;
    } catch (error) {
      console.error('❌ 智能搜索失败:', error);

      // 回退到简单搜索
      console.log('🔄 Falling back to simple keyword search');
      return this.fallbackSearch(query, bookmarks);
    }
  }

  // 回退搜索方法
  fallbackSearch(query, bookmarks) {
    const queryLower = query.toLowerCase();
    const results = bookmarks
      .filter(bookmark =>
        bookmark.title?.toLowerCase().includes(queryLower) ||
        bookmark.url?.toLowerCase().includes(queryLower)
      )
      .slice(0, 10)
      .map(bookmark => ({
        id: bookmark.id,
        title: bookmark.title,
        url: bookmark.url,
        relevanceScore: 0.5,
        reason: '文本匹配'
      }));

    return {
      results: results,
      totalFound: results.length,
      searchIntent: '简单文本搜索（AI不可用）',
      fallback: true
    };
  }

  async categorizeBookmarks(bookmarks) {
    const messages = [
      {
        role: 'system',
        content: '你是一个书签分类专家。将提供的书签按照内容主题进行智能分类。返回JSON格式的分类结果。'
      },
      {
        role: 'user',
        content: `请对以下书签进行智能分类:\n\n${JSON.stringify(bookmarks.slice(0, 30), null, 2)}\n\n返回格式: {"categories": [{"name": "分类名", "bookmarks": [{"id": "ID", "title": "标题", "reason": "分类原因"}]}]}`
      }
    ];

    try {
      const response = await this.request(messages);
      return JSON.parse(response);
    } catch (error) {
      console.error('书签分类失败:', error);
      return null;
    }
  }

  async summarizeContent(url, title, content) {
    const messages = [
      {
        role: 'system',
        content: '你是一个内容总结专家。为提供的网页内容生成简洁的摘要。'
      },
      {
        role: 'user',
        content: `请为以下网页生成摘要:\n\n标题: ${title}\n网址: ${url}\n内容: ${content.slice(0, 2000)}\n\n请返回JSON格式: {"summary": "摘要内容", "keyPoints": ["要点1", "要点2"], "tags": ["标签1", "标签2"]}`
      }
    ];

    try {
      const response = await this.request(messages);
      return JSON.parse(response);
    } catch (error) {
      console.error('内容总结失败:', error);
      return null;
    }
  }

  async getRecommendations(bookmarks, context) {
    console.log('🎯 Starting getRecommendations with:', {
      bookmarkCount: bookmarks.length, 
      context: context.substring(0, 100) + '...'
    });

    const messages = [
      {
        role: 'system',
        content: '你是一个智能推荐专家。基于用户的书签和当前上下文，提供个性化推荐。请严格按照JSON格式返回结果。'
      },
      {
        role: 'user',
        content: `基于以下信息提供智能推荐:

书签数据: ${JSON.stringify(bookmarks.slice(0, 10), null, 2)}

当前上下文: ${context}

请严格按照以下JSON格式返回结果，不要添加任何其他文字：
{
  "relatedBookmarks": [
    {
      "id": "书签ID",
      "title": "书签标题", 
      "url": "书签链接",
      "reason": "推荐原因",
      "relevanceScore": 0.95
    }
  ],
  "suggestedSearches": ["搜索建议1", "搜索建议2"],
  "insights": ["洞察1", "洞察2"]
}`
      }
    ];

    try {
      console.log('🚀 Sending recommendation request...');
      const response = await this.request(messages, { maxTokens: 1000 });
      console.log('📥 Raw recommendation response:', response);
      
      // 清理响应中可能的多余文字
      let cleanResponse = response.trim();
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      }
      if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      console.log('🧹 Cleaned response:', cleanResponse);
      
      const result = JSON.parse(cleanResponse);
      console.log('✅ Parsed recommendation result:', result);
      return result;
    } catch (error) {
      console.error('❌ 推荐生成失败:', error);
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      
      // 返回一个默认的推荐结果
      return {
        relatedBookmarks: bookmarks.slice(0, 3).map(bookmark => ({
          id: bookmark.id,
          title: bookmark.title,
          url: bookmark.url,
          reason: '基于您的浏览历史推荐',
          relevanceScore: 0.8
        })),
        suggestedSearches: ['最近访问', '技术文档', '工具资源'],
        insights: ['您经常访问技术相关的网站', '建议整理一下开发工具书签']
      };
    }
  }

  async discoverForgottenBookmarks(bookmarks, history) {
    console.log('💎 Starting discoverForgottenBookmarks...');

    const messages = [
      {
        role: 'system',
        content: '你是一个书签发现专家。分析用户的书签和浏览历史，找出可能被遗忘但有价值的书签。请严格按照JSON格式返回结果。'
      },
      {
        role: 'user',
        content: `分析并找出遗忘的有价值书签:

书签: ${JSON.stringify(bookmarks.slice(0, 15), null, 2)}

历史: ${JSON.stringify(history.slice(0, 8), null, 2)}

请严格按照以下JSON格式返回结果，不要添加任何其他文字：
{
  "forgottenGems": [
    {
      "id": "书签ID",
      "title": "书签标题",
      "url": "书签链接", 
      "lastAccessed": "最后访问时间",
      "potentialValue": "价值描述",
      "rediscoveryReason": "重新发现原因"
    }
  ],
  "summary": "发现总结"
}`
      }
    ];

    try {
      console.log('🚀 Sending forgotten bookmarks request...');
      const response = await this.request(messages, { maxTokens: 800 });
      console.log('📥 Raw forgotten response:', response);
      
      // 清理响应
      let cleanResponse = response.trim();
      if (cleanResponse.includes('```')) {
        cleanResponse = cleanResponse.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
      }
      
      const result = JSON.parse(cleanResponse);
      console.log('✅ Parsed forgotten result:', result);
      return result;
    } catch (error) {
      console.error('❌ 遗忘书签发现失败:', error);
      
      // 返回默认结果
      const oldBookmarks = bookmarks.filter(b => {
        const dateAdded = new Date(b.dateAdded);
        const monthsAgo = (Date.now() - dateAdded.getTime()) / (1000 * 60 * 60 * 24 * 30);
        return monthsAgo > 6; // 6个月前的书签
      }).slice(0, 3);

      return {
        forgottenGems: oldBookmarks.map(bookmark => ({
          id: bookmark.id,
          title: bookmark.title,
          url: bookmark.url,
          lastAccessed: '很久之前',
          potentialValue: '这个资源可能仍然有用',
          rediscoveryReason: '长时间未访问但可能有价值'
        })),
        summary: `发现了 ${oldBookmarks.length} 个可能被遗忘的有价值书签`
      };
    }
  }

  async analyzeInterestPatterns(bookmarks, history) {
    console.log('📊 Starting analyzeInterestPatterns...');

    const messages = [
      {
        role: 'system',
        content: '你是一个用户行为分析专家。分析用户的书签和浏览模式，识别兴趣趋势。请严格按照JSON格式返回结果。'
      },
      {
        role: 'user',
        content: `分析用户兴趣模式:

书签: ${JSON.stringify(bookmarks.slice(0, 12), null, 2)}

历史: ${JSON.stringify(history.slice(0, 10), null, 2)}

请严格按照以下JSON格式返回结果，不要添加任何其他文字：
{
  "primaryInterests": [
    {
      "topic": "主要兴趣领域",
      "confidence": 0.9,
      "evidence": ["证据1", "证据2"]
    }
  ],
  "behaviorPatterns": [
    {
      "pattern": "行为模式",
      "description": "模式描述"
    }
  ],
  "insights": ["洞察1", "洞察2"]
}`
      }
    ];

    try {
      console.log('🚀 Sending interest analysis request...');
      const response = await this.request(messages, { maxTokens: 800 });
      console.log('📥 Raw interest response:', response);
      
      // 清理响应
      let cleanResponse = response.trim();
      if (cleanResponse.includes('```')) {
        cleanResponse = cleanResponse.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
      }
      
      const result = JSON.parse(cleanResponse);
      console.log('✅ Parsed interest result:', result);
      return result;
    } catch (error) {
      console.error('❌ 兴趣模式分析失败:', error);
      
      // 分析书签域名来生成默认结果
      const domains = bookmarks.map(b => {
        try {
          return new URL(b.url).hostname;
        } catch {
          return 'unknown';
        }
      }).filter(d => d !== 'unknown');
      
      const domainCounts = {};
      domains.forEach(domain => {
        domainCounts[domain] = (domainCounts[domain] || 0) + 1;
      });
      
      const topDomains = Object.entries(domainCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3);

      return {
        primaryInterests: topDomains.map(([domain, count]) => ({
          topic: domain.replace(/^www\./, ''),
          confidence: Math.min(0.9, count / bookmarks.length * 2),
          evidence: [`${count} 个相关书签`, `经常访问的网站`]
        })),
        behaviorPatterns: [
          {
            pattern: "收藏习惯",
            description: `您总共收藏了 ${bookmarks.length} 个网站`
          }
        ],
        insights: [
          `您的兴趣主要集中在 ${topDomains[0]?.[0]?.replace(/^www\./, '') || '多个'} 领域`,
          "建议定期整理和分类您的书签"
        ]
      };
    }
  }
}

// Initialize AI service with new architecture

// Handle keyboard shortcut command
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'toggle-search') {
    await handleToggleSearch();
  }
});

// Handle toggle search functionality
async function handleToggleSearch() {
  try {
    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (tab && tab.id) {
      // 首先检查是否是特殊页面或错误页面
      const isSpecial = isSpecialPage(tab.url);
      const isErrorPage = await isErrorPage(tab);

      if (isSpecial || isErrorPage) {
        const pageType = isErrorPage ? '错误页面' : '特殊页面';
        console.log(`🚫 ${pageType} detected:`, tab.url, '- Opening Side Panel directly');

        // For special/error pages, directly open Side Panel as default behavior
        try {
          if (chrome.sidePanel && chrome.sidePanel.open) {
            await chrome.sidePanel.open({ windowId: tab.windowId });
            console.log(`✅ Side Panel opened successfully for ${pageType}`);
            return;
          } else {
            console.log('⚠️ Side Panel API not available (Chrome < 114)');
          }
        } catch (sidePanelError) {
          console.log('⚠️ Side Panel failed:', sidePanelError.message);
        }

        // Fallback to popup only if Side Panel is not available
        try {
          // Set flag for popup to show search mode
          await chrome.storage.local.set({ 'popup-search-mode': true });
          await chrome.action.openPopup();
          console.log(`✅ Popup opened as fallback for ${pageType}`);
          return;
        } catch (popupError) {
          console.log('⚠️ Popup fallback failed:', popupError.message);

          // Show helpful notification as last resort
          try {
            const message = isErrorPage ?
              '在错误页面无法使用快捷键，请点击扩展图标使用QuickFinder。' :
              '在浏览器内置页面，请点击扩展图标使用QuickFinder，或切换到普通网页使用快捷键。';

            await chrome.notifications.create({
              type: 'basic',
              iconUrl: 'icons/icon48.png',
              title: `QuickFinder - ${pageType}`,
              message: message,
              buttons: [
                { title: '打开新标签页' },
                { title: '了解更多' }
              ]
            });
            console.log(`✅ Helpful notification shown for ${pageType}`);
          } catch (notificationError) {
            console.error('❌ All fallback methods failed:', notificationError);
          }
          return;
        }
      } else {
        // For normal pages, use content script overlay
        try {
          await chrome.tabs.sendMessage(tab.id, { action: 'toggle-search' });
          console.log('✅ Content script message sent successfully');
        } catch (messageError) {
          console.log('⚠️ Content script not ready, injecting...');
          // If content script is not injected, inject it first
          await injectContentScript(tab.id);
        }
      }
    }
  } catch (error) {
    console.error('❌ Error handling keyboard shortcut:', error);

    // Ultimate fallback: try side panel or popup
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && chrome.sidePanel && chrome.sidePanel.open) {
        await chrome.sidePanel.open({ windowId: tab.windowId });
        console.log('✅ Side Panel opened as ultimate fallback');
      } else {
        await chrome.action.openPopup();
        console.log('✅ Popup opened as ultimate fallback');
      }
    } catch (ultimateError) {
      console.error('❌ All fallback methods failed:', ultimateError);
    }
  }
}

// Check if the URL is a special page that might not have content scripts
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

  // 检查浏览器错误页面
  const errorPagePatterns = [
    'chrome-error://',
    'edge-error://',
    'about:neterror',
    'about:certerror',
    'about:blocked'
  ];

  return specialPages.some(prefix => url.startsWith(prefix)) ||
         errorPagePatterns.some(pattern => url.startsWith(pattern)) ||
         url === 'about:blank' ||
         url.includes('newtab') ||
         url.includes('new-tab-page') ||
         // 检测常见的错误页面URL模式
         url.includes('ERR_') ||
         url.includes('NET::') ||
         url.includes('DNS_PROBE_') ||
         url.includes('CONNECTION_') ||
         // 检测本地错误页面
         (url.startsWith('data:text/html') && url.includes('error'));
}

// 检测是否是错误页面
async function isErrorPage(tab) {
  try {
    // 检查标签页状态
    if (tab.status === 'complete') {
      // 尝试注入一个简单的脚本来检测错误页面
      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            // 检测常见的错误页面特征
            const body = document.body;
            const html = document.documentElement;

            if (!body || !html) return true; // 页面未完全加载

            // 检测Chrome错误页面
            const errorElements = [
              'div[id*="error"]',
              'div[class*="error"]',
              'div[id*="offline"]',
              'div[class*="offline"]',
              '[id*="ERR_"]',
              '[class*="ERR_"]'
            ];

            for (const selector of errorElements) {
              if (document.querySelector(selector)) {
                return true;
              }
            }

            // 检测页面标题中的错误信息
            const title = document.title.toLowerCase();
            const errorTitles = [
              'error',
              'not found',
              '404',
              '500',
              'connection',
              'timeout',
              'refused',
              'unreachable',
              'dns',
              'certificate'
            ];

            return errorTitles.some(errorTitle => title.includes(errorTitle));
          }
        });

        return results && results[0] && results[0].result;
      } catch (scriptError) {
        // 如果脚本注入失败，可能就是错误页面或特殊页面
        console.log('Script injection failed, likely error page:', scriptError.message);
        return true;
      }
    }

    return false;
  } catch (error) {
    console.log('Error checking if page is error page:', error);
    return false;
  }
}

// Function to inject content script if not already present
async function injectContentScript(tabId) {
  try {
    // Get tab info to check if injection is possible
    const tab = await chrome.tabs.get(tabId);

    // Skip injection for special pages - these should use Side Panel instead
    if (isSpecialPage(tab.url)) {
      console.log('🚫 Skipping content script injection for special page:', tab.url);
      console.log('💡 Special pages should use Side Panel or Popup instead');

      // Try to open Side Panel as alternative
      try {
        if (chrome.sidePanel && chrome.sidePanel.open) {
          await chrome.sidePanel.open({ windowId: tab.windowId });
          console.log('✅ Opened Side Panel as alternative to content script');
        } else {
          await chrome.action.openPopup();
          console.log('✅ Opened Popup as alternative to content script');
        }
      } catch (alternativeError) {
        console.error('❌ Failed to open alternative interface:', alternativeError);
      }
      return;
    }

    console.log('📝 Injecting content script for normal page:', tab.url);

    // Try to inject CSS first
    await chrome.scripting.insertCSS({
      target: { tabId: tabId },
      files: ['content.css']
    });

    // Then inject JavaScript
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content.js']
    });

    // After injection, send the toggle message with a delay
    setTimeout(() => {
      chrome.tabs.sendMessage(tabId, { action: 'toggle-search' }).catch(() => {
        console.log('⚠️ Content script may not be ready yet, will retry');
      });
    }, 200);

    console.log('✅ Content script injection completed successfully');

  } catch (error) {
    console.error('❌ Error injecting content script:', error);

    // If injection fails, try Side Panel as fallback
    try {
      const tab = await chrome.tabs.get(tabId);
      console.log('🔄 Injection failed, trying Side Panel fallback for:', tab.url);

      if (chrome.sidePanel && chrome.sidePanel.open) {
        await chrome.sidePanel.open({ windowId: tab.windowId });
        console.log('✅ Side Panel opened as injection fallback');
      } else {
        await chrome.action.openPopup();
        console.log('✅ Popup opened as injection fallback');
      }
    } catch (fallbackError) {
      console.error('❌ All injection and fallback methods failed:', fallbackError);
    }
  }
}

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'search-bookmarks') {
    searchBookmarks(message.query).then(sendResponse);
    return true; // Keep the message channel open for async response
  } else if (message.action === 'search-history') {
    searchHistory(message.query).then(sendResponse);
    return true;
  } else if (message.action === 'get-bookmarks') {
    getAllBookmarks().then(sendResponse);
    return true;
  } else if (message.action === 'get-recent-history') {
    getRecentHistory().then(sendResponse);
    return true;
  } else if (message.action === 'get-most-visited') {
    getMostVisited().then(sendResponse);
    return true;
  } else if (message.action === 'search-pinyin') {
    searchPinyin(message.query).then(sendResponse);
    return true;
  } else if (message.action === 'get-performance-stats') {
    sendResponse(performanceCache.getStats());
    return true;
  } else if (message.action === 'clear-cache') {
    performanceCache.forceCleanup();
    sendResponse({ success: true, message: 'Cache cleared successfully' });
    return true;
  } else if (message.action === 'get-folder-contents') {
    getFolderContents(message.folderId).then(sendResponse);
    return true;
  } else if (message.action === 'ai-smart-search') {
    handleAISmartSearch(message.query, message.bookmarks).then(sendResponse);
    return true;
  } else if (message.action === 'ai-categorize') {
    handleAICategorize(message.bookmarks).then(sendResponse);
    return true;
  } else if (message.action === 'ai-summarize') {
    handleAISummarize(message.url, message.title, message.content).then(sendResponse);
    return true;
  } else if (message.action === 'ai-recommend') {
    handleAIRecommend(message.bookmarks, message.context).then(sendResponse);
    return true;
  } else if (message.action === 'ai-detect-duplicates') {
    handleAIDetectDuplicates(message.bookmarks).then(sendResponse);
    return true;
  } else if (message.action === 'ai-suggest-structure') {
    handleAISuggestStructure(message.bookmarks).then(sendResponse);
    return true;
  } else if (message.action === 'ai-generate-summary') {
    handleAIGenerateSummary(message.url, message.title, message.content).then(sendResponse);
    return true;
  } else if (message.action === 'ai-bookmarks-summary') {
    handleAIBookmarksSummary(message.bookmarks).then(sendResponse);
    return true;
  } else if (message.action === 'ai-extract-info') {
    handleAIExtractInfo(message.url, message.title, message.content).then(sendResponse);
    return true;
  } else if (message.action === 'ai-discover-forgotten') {
    handleAIDiscoverForgotten(message.bookmarks, message.history).then(sendResponse);
    return true;
  } else if (message.action === 'ai-analyze-interests') {
    handleAIAnalyzeInterests(message.bookmarks, message.history).then(sendResponse);
    return true;
  } else if (message.action === 'test-ai-connection') {
    handleTestAIConnection().then(sendResponse);
    return true;
  } else if (message.action === 'reinitialize-ai-service') {
    handleReinitializeAIService().then(sendResponse);
    return true;
  } else if (message.action === 'get-preload-progress') {
    handleGetPreloadProgress().then(sendResponse);
    return true;
  } else if (message.action === 'trigger-preload') {
    handleTriggerPreload().then(sendResponse);
    return true;
  } else if (message.action === 'get-icon-url') {
    handleGetIconUrl(message.url).then(sendResponse);
    return true;
  } else if (message.action === 'update-preload-config') {
    handleUpdatePreloadConfig(message.config).then(sendResponse);
    return true;
  } else if (message.action === 'clear-icon-cache') {
    handleClearIconCache().then(sendResponse);
    return true;
  }
});

// Search bookmarks function
async function searchBookmarks(query) {
  try {
    const bookmarks = await chrome.bookmarks.search(query);
    return bookmarks.map(bookmark => ({
      id: bookmark.id,
      title: bookmark.title,
      url: bookmark.url,
      type: 'bookmark',
      dateAdded: bookmark.dateAdded
    })).filter(item => item.url); // Filter out folders
  } catch (error) {
    console.error('Error searching bookmarks:', error);
    return [];
  }
}

// Search history function
async function searchHistory(query) {
  try {
    const history = await chrome.history.search({
      text: query,
      maxResults: 50,
      startTime: Date.now() - (30 * 24 * 60 * 60 * 1000) // Last 30 days
    });
    
    return history.map(item => ({
      id: item.id,
      title: item.title,
      url: item.url,
      type: 'history',
      lastVisitTime: item.lastVisitTime,
      visitCount: item.visitCount
    }));
  } catch (error) {
    console.error('Error searching history:', error);
    return [];
  }
}

// 优化的拼音搜索函数 - 带缓存和性能监控
async function searchPinyin(query) {
  const startTime = performance.now();
  performanceCache.stats.totalSearches++;

  try {
    if (!query || !query.trim()) {
      return [];
    }

    // 检查搜索结果缓存
    const cacheKey = `pinyin:${query.toLowerCase()}`;
    const cachedResult = performanceCache.searchResultsCache.get(cacheKey);

    if (cachedResult && Date.now() - cachedResult.timestamp < performanceCache.config.searchResultsCacheDuration) {
      performanceCache.stats.cacheHits++;
      console.log(`💨 Cache hit for query: "${query}" (${(performance.now() - startTime).toFixed(2)}ms)`);
      return cachedResult.results;
    }

    performanceCache.stats.cacheMisses++;
    console.log(`🔍 Performing fresh search for: "${query}"`);

    const results = [];

    // 检测是否包含中文或可能是拼音
    const isChineseQuery = hasChinese(query);
    const isPinyinQuery = /^[a-z]+$/i.test(query.trim());

    // 如果查询不是中文也不是纯字母，使用普通搜索
    if (!isChineseQuery && !isPinyinQuery) {
      const [bookmarks, history] = await Promise.all([
        searchBookmarks(query),
        searchHistory(query)
      ]);
      const fallbackResults = [...bookmarks, ...history];

      // 缓存结果
      cacheSearchResult(cacheKey, fallbackResults);
      return fallbackResults;
    }

    // 获取所有书签和历史记录（使用缓存）
    const [allBookmarks, recentHistory] = await Promise.all([
      getAllBookmarks(),
      getRecentHistory()
    ]);

    // 智能评分算法
    const calculateScore = (item, titleMatch, pinyinMatch) => {
      let baseScore = 0;

      // 匹配类型分数
      if (titleMatch) baseScore += 10;
      else if (pinyinMatch) baseScore += 5;

      // 类型权重
      if (item.type === 'bookmark') baseScore += 3;
      else if (item.type === 'history') baseScore += 1;

      // 访问频率权重
      if (item.visitCount) {
        baseScore += Math.min(item.visitCount * 0.1, 2);
      }

      // 时间衰减权重
      if (item.lastVisitTime) {
        const daysSinceVisit = (Date.now() - item.lastVisitTime) / (1000 * 60 * 60 * 24);
        const timeWeight = Math.max(0, 2 - daysSinceVisit * 0.1);
        baseScore += timeWeight;
      }

      return baseScore;
    };

    // 搜索书签 - 修复：强化标题匹配，确保英文查询能正确匹配
    allBookmarks.forEach(bookmark => {
      if (bookmark.title) {
        // 强化的标题匹配 - 对于英文查询特别优化
        const titleMatch = enhancedTitleMatch(query, bookmark.title);

        // 额外的英文匹配逻辑 - 确保"adv"能匹配"advanced"
        const englishMatch = !isChineseQuery && (
          bookmark.title.toLowerCase().includes(query.toLowerCase()) ||
          bookmark.url.toLowerCase().includes(query.toLowerCase())
        );

        const pinyinMatch = bookmark.pinyinIndex ? searchPinyinMatch(query, bookmark.pinyinIndex) : false;

        if (titleMatch || englishMatch || pinyinMatch) {
          results.push({
            ...bookmark,
            type: 'bookmark', // 明确标记为书签类型
            matchType: titleMatch || englishMatch ? 'title' : 'pinyin',
            score: calculateScore(bookmark, titleMatch || englishMatch, pinyinMatch)
          });
        }
      }
    });

    // 搜索历史记录 - 修复：强化标题匹配，确保英文查询能正确匹配
    recentHistory.forEach(historyItem => {
      if (historyItem.title) {
        // 强化的标题匹配 - 对于英文查询特别优化
        const titleMatch = enhancedTitleMatch(query, historyItem.title);

        // 额外的英文匹配逻辑 - 确保"adv"能匹配"advanced"
        const englishMatch = !isChineseQuery && (
          historyItem.title.toLowerCase().includes(query.toLowerCase()) ||
          historyItem.url.toLowerCase().includes(query.toLowerCase())
        );

        const pinyinMatch = historyItem.pinyinIndex ? searchPinyinMatch(query, historyItem.pinyinIndex) : false;

        if (titleMatch || englishMatch || pinyinMatch) {
          results.push({
            ...historyItem,
            type: 'history', // 明确标记为历史记录类型
            matchType: titleMatch || englishMatch ? 'title' : 'pinyin',
            score: calculateScore(historyItem, titleMatch || englishMatch, pinyinMatch)
          });
        }
      }
    });

    // 去重（基于URL）
    const uniqueResults = new Map();
    results.forEach(result => {
      const key = result.url || result.id;
      if (!uniqueResults.has(key) || uniqueResults.get(key).score < result.score) {
        uniqueResults.set(key, result);
      }
    });

    // 排序：按分数降序
    const finalResults = Array.from(uniqueResults.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 20); // 限制结果数量

    // 缓存结果
    this.cacheSearchResult(cacheKey, finalResults);

    const endTime = performance.now();
    const responseTime = endTime - startTime;

    // 更新平均响应时间
    performanceCache.stats.avgResponseTime =
      (performanceCache.stats.avgResponseTime * (performanceCache.stats.totalSearches - 1) + responseTime) /
      performanceCache.stats.totalSearches;

    console.log(`✅ Search completed: "${query}" - ${finalResults.length} results in ${responseTime.toFixed(2)}ms`);

    return finalResults;

  } catch (error) {
    console.error('Error in pinyin search:', error);
    return [];
  }
}

// 缓存搜索结果的辅助方法
function cacheSearchResult(cacheKey, results) {
  // 检查缓存大小限制
  if (performanceCache.searchResultsCache.size >= performanceCache.config.maxSearchResults) {
    // 删除最旧的缓存项
    const oldestKey = performanceCache.searchResultsCache.keys().next().value;
    performanceCache.searchResultsCache.delete(oldestKey);
  }

  performanceCache.searchResultsCache.set(cacheKey, {
    results,
    timestamp: Date.now()
  });
}

// 预加载书签数据
async function preloadBookmarks() {
  const startTime = performance.now();

  try {
    if (performanceCache.bookmarksCache &&
        Date.now() - performanceCache.bookmarksCacheTime < performanceCache.config.bookmarksCacheDuration) {
      console.log('📦 Using cached bookmarks');
      return performanceCache.bookmarksCache;
    }

    console.log('🔄 Loading fresh bookmarks data...');
    const bookmarkTree = await chrome.bookmarks.getTree();
    const allBookmarks = [];

    // 获取顶级书签和文件夹（模拟"所有书签"页面的默认显示）
    function extractTopLevelBookmarks(nodes) {
      for (const node of nodes) {
        // 处理书签栏 (id='1') 和其他书签 (id='2') 的直接子项
        if (node.id === '1' || node.id === '2') {
          if (node.children) {
            node.children.forEach((child, index) => {
              if (child.url) {
                // 这是一个书签
                const bookmark = {
                  id: child.id,
                  title: child.title,
                  url: child.url,
                  type: 'bookmark',
                  dateAdded: child.dateAdded,
                  parentPath: node.title,
                  parentId: node.id,
                  originalIndex: index // 保存原始位置索引
                };

                // 生成拼音索引
                bookmark.pinyinIndex = generatePinyinIndex(child.title);

                allBookmarks.push(bookmark);
              } else if (child.title && child.title.trim() !== '') {
                // 这是一个文件夹
                const folder = {
                  id: child.id,
                  title: child.title,
                  url: null,
                  type: 'folder',
                  dateAdded: child.dateAdded,
                  parentPath: node.title,
                  parentId: node.id,
                  originalIndex: index, // 保存原始位置索引
                  childCount: child.children ? child.children.length : 0
                };

                // 生成拼音索引
                folder.pinyinIndex = generatePinyinIndex(child.title);

                allBookmarks.push(folder);
              }
            });
          }
        } else if (node.children) {
          // 递归处理子节点
          extractTopLevelBookmarks(node.children);
        }
      }
    }

    extractTopLevelBookmarks(bookmarkTree);

    // 按照书签在书签栏中的实际位置顺序排列（保持原始顺序）
    const sortedBookmarks = allBookmarks.sort((a, b) => {
      // 书签栏内容优先
      if (a.parentId === '1' && b.parentId !== '1') return -1;
      if (a.parentId !== '1' && b.parentId === '1') return 1;

      // 在同一个父级下，按原始索引排序（保持用户在书签栏中的排列顺序）
      if (a.parentId === b.parentId) {
        return (a.originalIndex || 0) - (b.originalIndex || 0);
      }

      // 不同父级之间，书签栏(id='1')优先于其他书签(id='2')
      return (a.parentId || '').localeCompare(b.parentId || '');
    });

    // 缓存结果
    performanceCache.bookmarksCache = sortedBookmarks;
    performanceCache.bookmarksCacheTime = Date.now();

    const endTime = performance.now();
    console.log(`✅ Bookmarks preloaded: ${sortedBookmarks.length} items in ${(endTime - startTime).toFixed(2)}ms`);

    return sortedBookmarks;
  } catch (error) {
    console.error('Error preloading bookmarks:', error);
    return [];
  }
}

// Get all bookmarks for initial display (including folders) - 优化版本
async function getAllBookmarks() {
  return await preloadBookmarks();
}

// 去重历史记录，处理相似URL
function deduplicateHistory(history) {
  const urlMap = new Map();

  history.forEach(item => {
    try {
      const url = new URL(item.url);
      // 创建标准化的URL键（去除查询参数的变化）
      const baseUrl = `${url.protocol}//${url.hostname}${url.pathname}`;

      // 如果是同一个基础URL，保留访问时间最新的
      if (!urlMap.has(baseUrl) || (item.lastVisitTime || 0) > (urlMap.get(baseUrl).lastVisitTime || 0)) {
        urlMap.set(baseUrl, item);
      }
    } catch (error) {
      // 对于无效URL，使用原始URL作为键
      if (!urlMap.has(item.url)) {
        urlMap.set(item.url, item);
      }
    }
  });

  return Array.from(urlMap.values());
}

// 预加载历史记录数据
async function preloadHistory() {
  const startTime = performance.now();

  try {
    if (performanceCache.historyCache &&
        Date.now() - performanceCache.historyCacheTime < performanceCache.config.historyCacheDuration) {
      console.log('📦 Using cached history');
      return performanceCache.historyCache;
    }

    console.log('🔄 Loading fresh history data...');
    const history = await chrome.history.search({
      text: '',
      maxResults: 100, // 获取更多结果用于去重
      startTime: Date.now() - (7 * 24 * 60 * 60 * 1000) // Last 7 days
    });

    // 去重和清理URL
    const uniqueHistory = deduplicateHistory(history);

    const processedHistory = uniqueHistory.map(item => {
      const historyItem = {
        id: item.id,
        title: item.title,
        url: item.url,
        type: 'history',
        lastVisitTime: item.lastVisitTime,
        visitCount: item.visitCount
      };

      // 生成拼音索引
      historyItem.pinyinIndex = generatePinyinIndex(item.title);

      return historyItem;
    }).sort((a, b) => (b.lastVisitTime || 0) - (a.lastVisitTime || 0)).slice(0, 30);

    // 缓存结果
    performanceCache.historyCache = processedHistory;
    performanceCache.historyCacheTime = Date.now();

    const endTime = performance.now();
    console.log(`✅ History preloaded: ${processedHistory.length} items in ${(endTime - startTime).toFixed(2)}ms`);

    return processedHistory;
  } catch (error) {
    console.error('Error preloading history:', error);
    return [];
  }
}

// Get recent history for default display - 优化版本
async function getRecentHistory() {
  return await preloadHistory();
}

// Get most visited URLs based on domain visit frequency
async function getMostVisited() {
  try {
    const history = await chrome.history.search({
      text: '',
      maxResults: 200, // 获取更多结果用于域名统计
      startTime: Date.now() - (30 * 24 * 60 * 60 * 1000) // Last 30 days
    });

    // 按域名统计访问次数
    const domainStats = new Map();
    const urlMap = new Map();

    history.forEach(item => {
      try {
        const url = new URL(item.url);
        const domain = url.hostname;

        // 统计域名访问次数
        if (domainStats.has(domain)) {
          domainStats.set(domain, domainStats.get(domain) + (item.visitCount || 1));
        } else {
          domainStats.set(domain, item.visitCount || 1);
        }

        // 保存每个域名的最佳代表URL（访问次数最多的）
        if (!urlMap.has(domain) || (item.visitCount || 0) > (urlMap.get(domain).visitCount || 0)) {
          urlMap.set(domain, item);
        }
      } catch (error) {
        // 忽略无效URL
      }
    });

    // 按域名访问次数排序，返回每个域名的代表URL
    const sortedDomains = Array.from(domainStats.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30);

    return sortedDomains.map(([domain, totalVisits]) => {
      const item = urlMap.get(domain);
      return {
        id: item.id,
        title: item.title,
        url: item.url,
        type: 'history',
        lastVisitTime: item.lastVisitTime,
        visitCount: totalVisits, // 使用域名总访问次数
        domain: domain
      };
    });
  } catch (error) {
    console.error('Error getting most visited:', error);
    return [];
  }
}

// Get contents of a specific folder
async function getFolderContents(folderId) {
  try {
    const children = await chrome.bookmarks.getChildren(folderId);

    return children.map(item => {
      if (item.url) {
        // This is a bookmark
        return {
          id: item.id,
          title: item.title,
          url: item.url,
          type: 'bookmark',
          dateAdded: item.dateAdded,
          index: item.index
        };
      } else {
        // This is a folder
        return {
          id: item.id,
          title: item.title,
          url: null,
          type: 'folder',
          dateAdded: item.dateAdded,
          childCount: 0, // Will be updated if needed
          index: item.index
        };
      }
    }).sort((a, b) => {
      // 保持原收藏顺序：按index排序
      return (a.index || 0) - (b.index || 0);
    });
  } catch (error) {
    console.error('Error getting folder contents:', error);
    return [];
  }
}

// AI Service Handlers - Enhanced with new architecture
async function initializeAIService() {
  try {
    // Try to initialize optimized AI service first
    if (!aiServiceOptimized) {
      console.log('🚀 Initializing Optimized AI Service...');

      try {
        // Import optimized AI service dynamically
        const { OptimizedAIService } = await import(chrome.runtime.getURL('ai-service-optimized.js'));
        aiServiceOptimized = new OptimizedAIService();

        const initialized = await aiServiceOptimized.initialize();
        if (initialized) {
          console.log('✅ Optimized AI Service initialized successfully');
          return aiServiceOptimized;
        } else {
          console.warn('⚠️ Optimized AI Service initialization failed, trying AI Service Manager');
        }
      } catch (error) {
        console.warn('⚠️ Failed to load Optimized AI Service, trying AI Service Manager:', error);
      }
    } else if (aiServiceOptimized.isAvailable()) {
      return aiServiceOptimized;
    }

    // Try to initialize AI Service Manager as fallback
    if (!aiServiceManager) {
      console.log('🚀 Initializing AI Service Manager...');

      try {
        // Import AI service manager dynamically
        const { AIServiceManager } = await import(chrome.runtime.getURL('ai-service-manager.js'));
        aiServiceManager = new AIServiceManager();

        const initialized = await aiServiceManager.initialize();
        if (initialized) {
          console.log('✅ AI Service Manager initialized successfully');
          return aiServiceManager;
        } else {
          console.warn('⚠️ AI Service Manager initialization failed, falling back to legacy service');
        }
      } catch (error) {
        console.warn('⚠️ Failed to load AI Service Manager, falling back to legacy service:', error);
      }
    } else if (aiServiceManager.isAvailable()) {
      return aiServiceManager;
    }

    // Fallback to legacy BackgroundAIService
    if (!aiServiceInstance || !aiServiceInstance.settings) {
      console.log('🔄 Initializing Legacy Background AI Service...');
      aiServiceInstance = new BackgroundAIService();

      // Enhanced settings loading with fallback
      await aiServiceInstance.loadSettings();

      // Double-check if settings loaded correctly
      if (!aiServiceInstance.settings) {
        console.warn('⚠️ AI settings empty, trying to load from storage directly...');
        
        // Try to load settings directly from Chrome storage
        try {
          let settings = null;
          
          // Try local storage first
          const localResult = await chrome.storage.local.get(['aiSettings']);
          if (localResult.aiSettings) {
            settings = localResult.aiSettings;
            console.log('📖 Loaded AI settings from local storage');
          } else {
            // Fallback to sync storage
            const syncResult = await chrome.storage.sync.get(['aiSettings']);
            if (syncResult.aiSettings) {
              settings = syncResult.aiSettings;
              console.log('📖 Loaded AI settings from sync storage');
            }
          }
          
          if (settings) {
            aiServiceInstance.settings = settings;
            console.log('✅ AI settings manually loaded:', {
              provider: settings.provider,
              model: settings.model,
              hasApiKey: !!settings.apiKey,
              enabledFeatures: settings.enabledFeatures
            });
          }
        } catch (storageError) {
          console.error('❌ Failed to load settings from storage:', storageError);
        }
      }
      
      console.log('✅ Legacy AI Service initialized successfully');
      console.log('📊 AI Service status:', {
        hasInstance: !!aiServiceInstance,
        hasSettings: !!aiServiceInstance.settings,
        isAvailable: aiServiceInstance.isAvailable?.() || false,
        settings: aiServiceInstance.settings
      });
    }

    // Return the appropriate service instance
    return aiServiceOptimized || aiServiceManager || aiServiceInstance;
      } catch (error) {
      console.error('❌ Failed to initialize AI Service:', error);
      // Reset instances on error to allow retry
      aiServiceOptimized = null;
      aiServiceInstance = null;
      aiServiceManager = null;
      throw error;
  }
}

async function handleAISmartSearch(query, bookmarks) {
  try {
    console.log('🔍 Handling AI Smart Search request...');
    const aiService = await initializeAIService();
    
    console.log('AI Service status for smart search:', {
      hasService: !!aiService,
      hasSettings: !!(aiService && aiService.settings),
      isAvailable: aiService && aiService.isAvailable ? aiService.isAvailable() : false,
      smartSearchEnabled: aiService && aiService.isFeatureEnabled ? aiService.isFeatureEnabled('smart-search') : false,
      provider: aiService && aiService.settings ? aiService.settings.provider : 'none',
      model: aiService && aiService.settings ? aiService.settings.model : 'none',
      hasApiKey: !!(aiService && aiService.settings && aiService.settings.apiKey)
    });
    
    if (!aiService.isAvailable()) {
      console.log('❌ AI service not available for smart search');
      return null;
    }
    
    if (!aiService.isFeatureEnabled('smart-search')) {
      console.log('❌ Smart search feature not enabled');
      return null;
    }
    
    console.log('✅ Calling smartSearch with query:', query);
    const result = await aiService.smartSearch(query, bookmarks);
    console.log('🎯 Smart search result:', result);
    return result;
  } catch (error) {
    console.error('❌ AI Smart Search error:', error);
    return null;
  }
}

async function handleAICategorize(bookmarks) {
  try {
    const aiService = await initializeAIService();
    if (!aiService.isAvailable() || !aiService.isFeatureEnabled('auto-categorize')) {
      return null;
    }
    return await aiService.categorizeBookmarks(bookmarks);
  } catch (error) {
    console.error('AI Categorize error:', error);
    return null;
  }
}

async function handleAISummarize(url, title, content) {
  try {
    const aiService = await initializeAIService();
    if (!aiService.isAvailable() || !aiService.isFeatureEnabled('summarize')) {
      return null;
    }
    return await aiService.summarizeContent(url, title, content);
  } catch (error) {
    console.error('AI Summarize error:', error);
    return null;
  }
}

async function handleAIRecommend(bookmarks, context) {
  try {
    console.log('🎯 Handling AI recommend request...');
    const aiService = await initializeAIService();

    console.log('AI Service available:', aiService.isAvailable());
    console.log('Recommendations feature enabled:', aiService.isFeatureEnabled('recommendations'));
    console.log('AI settings:', aiService.settings);

    if (!aiService.isAvailable()) {
      console.log('❌ AI service not available');
      return null;
    }

    if (!aiService.isFeatureEnabled('recommendations')) {
      console.log('❌ Recommendations feature not enabled');
      return null;
    }

    console.log('✅ Calling getRecommendations...');
    const result = await aiService.getRecommendations(bookmarks, context);
    console.log('🎯 Recommendations result:', result);
    return result;
  } catch (error) {
    console.error('❌ AI Recommend error:', error);
    return null;
  }
}

async function handleAIDetectDuplicates(bookmarks) {
  try {
    const aiService = await initializeAIService();
    if (!aiService.isAvailable() || !aiService.isFeatureEnabled('auto-categorize')) {
      return null;
    }
    return await aiService.detectDuplicateBookmarks(bookmarks);
  } catch (error) {
    console.error('AI Detect Duplicates error:', error);
    return null;
  }
}

async function handleAISuggestStructure(bookmarks) {
  try {
    const aiService = await initializeAIService();
    if (!aiService.isAvailable() || !aiService.isFeatureEnabled('auto-categorize')) {
      return null;
    }
    return await aiService.suggestFolderStructure(bookmarks);
  } catch (error) {
    console.error('AI Suggest Structure error:', error);
    return null;
  }
}

async function handleAIGenerateSummary(url, title, content) {
  try {
    const aiService = await initializeAIService();
    if (!aiService.isAvailable() || !aiService.isFeatureEnabled('summarize')) {
      return null;
    }
    return await aiService.generateSummary(url, title, content);
  } catch (error) {
    console.error('AI Generate Summary error:', error);
    return null;
  }
}

async function handleAIBookmarksSummary(bookmarks) {
  try {
    const aiService = await initializeAIService();
    if (!aiService.isAvailable() || !aiService.isFeatureEnabled('summarize')) {
      return null;
    }
    return await aiService.generateBookmarksSummary(bookmarks);
  } catch (error) {
    console.error('AI Bookmarks Summary error:', error);
    return null;
  }
}

async function handleAIExtractInfo(url, title, content) {
  try {
    const aiService = await initializeAIService();
    if (!aiService.isAvailable() || !aiService.isFeatureEnabled('summarize')) {
      return null;
    }
    return await aiService.extractKeyInfo(url, title, content);
  } catch (error) {
    console.error('AI Extract Info error:', error);
    return null;
  }
}

async function handleAIDiscoverForgotten(bookmarks, history) {
  try {
    const aiService = await initializeAIService();
    if (!aiService.isAvailable() || !aiService.isFeatureEnabled('recommendations')) {
      return null;
    }
    return await aiService.discoverForgottenBookmarks(bookmarks, history);
  } catch (error) {
    console.error('AI Discover Forgotten error:', error);
    return null;
  }
}

async function handleAIAnalyzeInterests(bookmarks, history) {
  try {
    const aiService = await initializeAIService();
    if (!aiService.isAvailable() || !aiService.isFeatureEnabled('recommendations')) {
      return null;
    }
    return await aiService.analyzeInterestPatterns(bookmarks, history);
  } catch (error) {
    console.error('AI Analyze Interests error:', error);
    return null;
  }
}

// Test AI connection - Enhanced for new architecture
async function handleTestAIConnection() {
  try {
    console.log('🧪 Testing Enhanced AI connection...');
    const aiService = await initializeAIService();

    // Get service status
    const status = aiService.getStatus ? aiService.getStatus() : {
      initialized: !!aiService,
      available: aiService.isAvailable ? aiService.isAvailable() : false
    };

    console.log('📊 AI Service Status:', status);

    // Check if AI service is available
    if (!aiService.isAvailable()) {
      const details = {
        serviceType: aiService.constructor.name,
        hasSettings: !!(aiService.settings || aiService.getStatus),
        hasProvider: !!aiService.settings?.provider,
        hasApiKey: !!aiService.settings?.apiKey,
        provider: aiService.settings?.provider,
        status: status
      };

      return {
        success: false,
        error: 'AI service not available',
        details: details
      };
    }

    // Test with a simple request
    const testMessages = [
      {
        role: 'user',
        content: 'Hello, this is a test message. Please respond with "Test successful".'
      }
    ];

    let response;
    let provider, model;

    // Handle different service types
    if (aiService.constructor.name === 'AIServiceManager') {
      // New AI Service Manager
      try {
        // For new service manager, we need to test through smart search or similar
        const testBookmarks = [
          { id: '1', title: 'Test Bookmark', url: 'https://example.com' }
        ];
        const testResult = await aiService.smartSearch('test', testBookmarks);

        response = 'Enhanced AI Service Manager test successful';
        provider = status.provider || 'unknown';
        model = status.model || 'unknown';
      } catch (managerError) {
        console.warn('Manager test failed, trying direct request:', managerError);
        throw managerError;
      }
    } else {
      // Legacy service
      response = await aiService.request(testMessages, { maxTokens: 50 });
      provider = aiService.settings?.provider;
      model = aiService.settings?.model;
    }

    return {
      success: true,
      response: response,
      provider: provider,
      model: model,
      serviceType: aiService.constructor.name,
      status: status
    };

  } catch (error) {
    console.error('❌ AI connection test failed:', error);
    return {
      success: false,
      error: error.message,
      details: {
        name: error.name,
        stack: error.stack?.substring(0, 500) // Limit stack trace length
      }
    };
  }
}

// Handle AI service reinitialization
async function handleReinitializeAIService() {
  try {
    console.log('🔄 Reinitializing AI Service...');

    // Reset instances
    aiServiceInstance = null;
    aiServiceManager = null;

    // Reinitialize
    const aiService = await initializeAIService();

    return {
      success: true,
      message: 'AI Service reinitialized successfully',
      serviceType: aiService.constructor.name,
      status: aiService.getStatus ? aiService.getStatus() : {
        available: aiService.isAvailable ? aiService.isAvailable() : false
      }
    };
  } catch (error) {
    console.error('❌ Failed to reinitialize AI Service:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Preload Manager Handlers
async function handleGetPreloadProgress() {
  try {
    const manager = await initializePreloadManager();
    if (manager) {
      return {
        success: true,
        progress: manager.getProgress()
      };
    } else {
      return {
        success: false,
        error: 'Preload manager not available'
      };
    }
  } catch (error) {
    console.error('❌ Failed to get preload progress:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

async function handleTriggerPreload() {
  try {
    const manager = await initializePreloadManager();
    if (manager) {
      await manager.triggerPreload();
      return {
        success: true,
        message: 'Preload triggered successfully'
      };
    } else {
      return {
        success: false,
        error: 'Preload manager not available'
      };
    }
  } catch (error) {
    console.error('❌ Failed to trigger preload:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// 获取适合当前浏览器的favicon URL
function getFaviconUrlForBrowser(url) {
  try {
    const urlObj = new URL(url);

    // 在Service Worker中，我们需要通过其他方式检测浏览器
    // 检查是否存在Edge特有的API
    const isEdge = typeof globalThis.chrome !== 'undefined' &&
                   typeof globalThis.chrome.runtime !== 'undefined' &&
                   globalThis.chrome.runtime.getURL('').includes('extension://');

    if (isEdge || !globalThis.chrome) {
      // Edge浏览器或其他浏览器使用Google的favicon服务
      return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=16`;
    } else {
      // Chrome浏览器使用chrome://favicon
      return `chrome://favicon/${url}`;
    }
  } catch (error) {
    // URL解析失败，返回默认图标
    return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="%23ccc"/></svg>';
  }
}

async function handleGetIconUrl(url) {
  try {
    const manager = await initializePreloadManager();
    if (manager) {
      return {
        success: true,
        iconUrl: manager.getIconUrl(url),
        cached: manager.isIconCached(url)
      };
    } else {
      return {
        success: true,
        iconUrl: getFaviconUrlForBrowser(url),
        cached: false
      };
    }
  } catch (error) {
    console.error('❌ Failed to get icon URL:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

async function handleUpdatePreloadConfig(config) {
  try {
    const manager = await initializePreloadManager();
    if (manager) {
      await manager.updateConfig(config);
      return {
        success: true,
        message: 'Preload config updated successfully'
      };
    } else {
      return {
        success: false,
        error: 'Preload manager not available'
      };
    }
  } catch (error) {
    console.error('❌ Failed to update preload config:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

async function handleClearIconCache() {
  try {
    const manager = await initializePreloadManager();
    if (manager) {
      await manager.clearIconCache();
      return {
        success: true,
        message: 'Icon cache cleared successfully'
      };
    } else {
      return {
        success: false,
        error: 'Preload manager not available'
      };
    }
  } catch (error) {
    console.error('❌ Failed to clear icon cache:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Initialize preload manager
async function initializePreloadManager() {
  try {
    if (!preloadManager) {
      // ServiceWorker doesn't support dynamic import(), so we'll use importScripts
      // But first check if PreloadManager is available
      if (typeof PreloadManager === 'undefined') {
        // Try to load the script using importScripts (synchronous in ServiceWorker)
        try {
          importScripts(chrome.runtime.getURL('preload-manager.js'));
        } catch (importError) {
          console.warn('⚠️ Could not load preload-manager.js:', importError);
          // Create a minimal fallback preload manager
          window.PreloadManager = class {
            constructor() {
              this.isInitialized = false;
            }
            async initialize() {
              this.isInitialized = true;
            }
            getProgress() {
              return { loaded: 0, total: 0, percentage: 0 };
            }
            async triggerPreload() {
              // No-op fallback
            }
            getIconUrl(url) {
              return null;
            }
            isIconCached(url) {
              return false;
            }
            async updateConfig(config) {
              // No-op fallback
            }
            async clearIconCache() {
              // No-op fallback
            }
            async loadIcon(item) {
              // No-op fallback
            }
          };
        }
      }

      preloadManager = new PreloadManager();
    }

    if (!preloadManager.isInitialized) {
      await preloadManager.initialize();
    }

    return preloadManager;
  } catch (error) {
    console.error('❌ Failed to initialize preload manager:', error);
    return null;
  }
}

// Handle extension installation
chrome.runtime.onInstalled.addListener(async () => {
  console.log('QuickFinder extension installed');

  // Initialize AI service
  await initializeAIService();

  // Initialize preload manager
  await initializePreloadManager();
});

// Handle extension startup
chrome.runtime.onStartup.addListener(async () => {
  console.log('QuickFinder extension started');

  // Initialize preload manager on startup
  await initializePreloadManager();
});

// Listen for bookmark changes to update preload cache
chrome.bookmarks.onCreated.addListener(async (id, bookmark) => {
  console.log('📖 Bookmark created:', bookmark.title);
  const manager = await initializePreloadManager();
  if (manager && bookmark.url) {
    // Trigger incremental preload for new bookmark
    await manager.loadIcon({ url: bookmark.url, domain: new URL(bookmark.url).hostname });
  }
});

chrome.bookmarks.onRemoved.addListener(async (id, removeInfo) => {
  console.log('🗑️ Bookmark removed:', id);
  // Note: We don't remove from cache as the icon might be used by history
});

chrome.bookmarks.onChanged.addListener(async (id, changeInfo) => {
  console.log('✏️ Bookmark changed:', changeInfo);
  if (changeInfo.url) {
    const manager = await initializePreloadManager();
    if (manager) {
      // Trigger preload for updated URL
      await manager.loadIcon({ url: changeInfo.url, domain: new URL(changeInfo.url).hostname });
    }
  }
});

// Listen for history changes (if available)
if (chrome.history.onVisited) {
  chrome.history.onVisited.addListener(async (historyItem) => {
    console.log('📜 History item visited:', historyItem.url);
    const manager = await initializePreloadManager();
    if (manager && historyItem.url) {
      // Trigger incremental preload for new history item
      try {
        const url = new URL(historyItem.url);
        await manager.loadIcon({
          url: historyItem.url,
          domain: url.hostname,
          title: historyItem.title,
          type: 'history',
          priority: 1
        });
      } catch (error) {
        // Skip invalid URLs
      }
    }
  });
}
