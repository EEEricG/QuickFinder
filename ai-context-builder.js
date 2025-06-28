// AI Context Builder - 智能上下文构建器
// 用于分析用户数据并生成高质量、精简的AI请求上下文

class AIContextBuilder {
  constructor() {
    this.domainCategories = new Map();
    this.initializeDomainCategories();
    
    console.log('🧠 AI Context Builder initialized');
  }
  
  /**
   * 初始化域名分类
   */
  initializeDomainCategories() {
    const categories = {
      'development': [
        'github.com', 'stackoverflow.com', 'mdn.mozilla.org', 'developer.mozilla.org',
        'docs.microsoft.com', 'nodejs.org', 'reactjs.org', 'vuejs.org', 'angular.io',
        'tailwindcss.com', 'bootstrap.com', 'codepen.io', 'jsfiddle.net', 'replit.com'
      ],
      'design': [
        'figma.com', 'sketch.com', 'adobe.com', 'dribbble.com', 'behance.net',
        'unsplash.com', 'freepik.com', 'flaticon.com', 'iconify.design', 'material.io'
      ],
      'productivity': [
        'notion.so', 'obsidian.md', 'trello.com', 'asana.com', 'todoist.com',
        'evernote.com', 'onenote.com', 'google.com', 'microsoft.com'
      ],
      'learning': [
        'coursera.org', 'udemy.com', 'edx.org', 'khanacademy.org', 'pluralsight.com',
        'lynda.com', 'skillshare.com', 'youtube.com', 'medium.com', 'dev.to'
      ],
      'documentation': [
        'docs.python.org', 'docs.djangoproject.com', 'flask.palletsprojects.com',
        'laravel.com', 'symfony.com', 'spring.io', 'expressjs.com'
      ],
      'tools': [
        'vercel.com', 'netlify.com', 'heroku.com', 'aws.amazon.com', 'cloud.google.com',
        'azure.microsoft.com', 'digitalocean.com', 'cloudflare.com'
      ],
      'social': [
        'twitter.com', 'linkedin.com', 'facebook.com', 'instagram.com', 'reddit.com',
        'discord.com', 'slack.com', 'telegram.org'
      ],
      'news': [
        'techcrunch.com', 'theverge.com', 'arstechnica.com', 'wired.com', 'engadget.com',
        'hacker-news.firebaseio.com', 'news.ycombinator.com'
      ]
    };
    
    for (const [category, domains] of Object.entries(categories)) {
      for (const domain of domains) {
        this.domainCategories.set(domain, category);
      }
    }
  }
  
  /**
   * 构建用户兴趣摘要
   * @param {Array} userBookmarks - 用户书签
   * @param {number} maxBookmarks - 最大书签数量
   * @returns {Object} 用户兴趣摘要
   */
  buildUserInterestSummary(userBookmarks, maxBookmarks = 30) {
    if (!userBookmarks || userBookmarks.length === 0) {
      return {
        topics: [],
        domains: [],
        categories: {},
        summary: '用户暂无书签数据'
      };
    }
    
    const analysis = this.analyzeBookmarks(userBookmarks.slice(0, maxBookmarks));
    
    return {
      topics: analysis.topTopics.slice(0, 8),
      domains: analysis.topDomains.slice(0, 6),
      categories: analysis.categories,
      patterns: analysis.patterns,
      summary: this.generateInterestSummary(analysis)
    };
  }
  
  /**
   * 分析书签集合
   * @param {Array} bookmarks - 书签数组
   * @returns {Object} 分析结果
   */
  analyzeBookmarks(bookmarks) {
    const topicFreq = new Map();
    const domainFreq = new Map();
    const categoryFreq = new Map();
    const timePatterns = [];
    
    for (const bookmark of bookmarks) {
      // 分析标题中的主题词
      const topics = this.extractTopics(bookmark.title);
      for (const topic of topics) {
        topicFreq.set(topic, (topicFreq.get(topic) || 0) + 1);
      }
      
      // 分析域名
      const domain = this.extractDomain(bookmark.url);
      if (domain) {
        domainFreq.set(domain, (domainFreq.get(domain) || 0) + 1);
        
        // 分析类别
        const category = this.domainCategories.get(domain) || this.categorizeDomain(domain);
        if (category) {
          categoryFreq.set(category, (categoryFreq.get(category) || 0) + 1);
        }
      }
      
      // 分析时间模式
      if (bookmark.dateAdded) {
        timePatterns.push(new Date(bookmark.dateAdded));
      }
    }
    
    return {
      topTopics: this.sortByFrequency(topicFreq, 10),
      topDomains: this.sortByFrequency(domainFreq, 8),
      categories: Object.fromEntries(categoryFreq),
      patterns: this.analyzeTimePatterns(timePatterns),
      totalBookmarks: bookmarks.length
    };
  }
  
  /**
   * 从标题中提取主题词
   * @param {string} title - 书签标题
   * @returns {Array} 主题词数组
   */
  extractTopics(title) {
    if (!title) return [];
    
    // 移除常见的停用词
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'how', 'what', 'when', 'where', 'why', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'can', 'may',
      'home', 'page', 'site', 'website', 'blog', 'article', 'post', 'guide', 'tutorial',
      '的', '了', '和', '与', '或', '但', '在', '上', '下', '中', '是', '有', '无', '为', '从'
    ]);
    
    // 技术关键词权重提升
    const techKeywords = new Set([
      'javascript', 'python', 'java', 'react', 'vue', 'angular', 'node', 'css', 'html',
      'typescript', 'go', 'rust', 'swift', 'kotlin', 'flutter', 'docker', 'kubernetes',
      'aws', 'azure', 'gcp', 'ai', 'ml', 'machine', 'learning', 'deep', 'data', 'science',
      'frontend', 'backend', 'fullstack', 'api', 'rest', 'graphql', 'database', 'sql',
      'mongodb', 'postgresql', 'redis', 'git', 'github', 'gitlab', 'devops', 'cicd'
    ]);
    
    const words = title.toLowerCase()
      .replace(/[^\w\s\u4e00-\u9fff]/g, ' ') // 保留字母、数字、空格和中文
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word));
    
    // 技术词汇加权
    const topics = words.map(word => ({
      word,
      weight: techKeywords.has(word) ? 2 : 1
    }));
    
    return topics.map(t => t.word);
  }
  
  /**
   * 提取域名
   * @param {string} url - URL
   * @returns {string|null} 域名
   */
  extractDomain(url) {
    try {
      const domain = new URL(url).hostname.replace('www.', '');
      return domain;
    } catch {
      return null;
    }
  }
  
  /**
   * 对域名进行分类
   * @param {string} domain - 域名
   * @returns {string|null} 分类
   */
  categorizeDomain(domain) {
    // 简单的启发式分类
    if (domain.includes('github') || domain.includes('gitlab')) return 'development';
    if (domain.includes('stackoverflow') || domain.includes('dev')) return 'development';
    if (domain.includes('design') || domain.includes('figma')) return 'design';
    if (domain.includes('learn') || domain.includes('course') || domain.includes('edu')) return 'learning';
    if (domain.includes('doc') || domain.includes('api')) return 'documentation';
    if (domain.includes('news') || domain.includes('blog')) return 'news';
    if (domain.includes('tool') || domain.includes('app')) return 'tools';
    
    return 'other';
  }
  
  /**
   * 按频率排序
   * @param {Map} frequencyMap - 频率映射
   * @param {number} limit - 限制数量
   * @returns {Array} 排序后的数组
   */
  sortByFrequency(frequencyMap, limit) {
    return Array.from(frequencyMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([item, freq]) => ({ item, frequency: freq }));
  }
  
  /**
   * 分析时间模式
   * @param {Array} dates - 日期数组
   * @returns {Object} 时间模式分析
   */
  analyzeTimePatterns(dates) {
    if (dates.length === 0) return {};
    
    const sortedDates = dates.sort((a, b) => b - a);
    const recentDates = sortedDates.slice(0, 10);
    
    // 分析添加频率
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const recentWeek = recentDates.filter(d => d >= oneWeekAgo).length;
    const recentMonth = recentDates.filter(d => d >= oneMonthAgo).length;
    
    let activity = 'low';
    if (recentWeek >= 3) activity = 'high';
    else if (recentMonth >= 5) activity = 'medium';
    
    return {
      activity,
      recentBookmarks: recentWeek,
      monthlyBookmarks: recentMonth,
      oldestBookmark: sortedDates[sortedDates.length - 1],
      newestBookmark: sortedDates[0]
    };
  }
  
  /**
   * 生成兴趣摘要
   * @param {Object} analysis - 分析结果
   * @returns {string} 兴趣摘要
   */
  generateInterestSummary(analysis) {
    const topCategories = Object.entries(analysis.categories)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([cat, count]) => `${cat}(${count})`);
    
    const topTopics = analysis.topTopics.slice(0, 5).map(t => t.item);
    const topDomains = analysis.topDomains.slice(0, 3).map(d => d.item);
    
    return [
      `主要兴趣类别: ${topCategories.join(', ')}`,
      `关键主题: ${topTopics.join(', ')}`,
      `常用网站: ${topDomains.join(', ')}`,
      `活跃度: ${analysis.patterns.activity || 'unknown'}`
    ].join('; ');
  }
  
  /**
   * 构建智能搜索上下文
   * @param {string} query - 搜索查询
   * @param {Array} userBookmarks - 用户书签
   * @param {string} currentPage - 当前页面URL
   * @returns {Object} 搜索上下文
   */
  buildSearchContext(query, userBookmarks, currentPage = '') {
    const userSummary = this.buildUserInterestSummary(userBookmarks, 20);
    const queryTopics = this.extractTopics(query);
    const currentDomain = this.extractDomain(currentPage);
    
    // 找出与查询最相关的书签
    const relevantBookmarks = this.findRelevantBookmarks(query, userBookmarks, 8);
    
    return {
      query: query.trim(),
      userContextHash: this.generateContextHash(userSummary),
      userInterests: userSummary.topics.slice(0, 5).map(t => t.item),
      queryTopics,
      currentPage: currentPage || '',
      currentDomain: currentDomain || '',
      relevantBookmarks: relevantBookmarks.map(b => ({
        id: b.id,
        title: b.title,
        url: b.url,
        relevance: b.relevance
      })),
      timeWindow: this.getTimeWindow()
    };
  }
  
  /**
   * 找出与查询相关的书签
   * @param {string} query - 查询
   * @param {Array} bookmarks - 书签列表
   * @param {number} limit - 限制数量
   * @returns {Array} 相关书签
   */
  findRelevantBookmarks(query, bookmarks, limit) {
    const queryWords = new Set(this.extractTopics(query));
    
    const scored = bookmarks.map(bookmark => {
      const titleWords = new Set(this.extractTopics(bookmark.title));
      const urlWords = new Set(this.extractTopics(bookmark.url));
      
      // 计算相关性分数
      let score = 0;
      
      // 标题匹配权重更高
      for (const word of queryWords) {
        if (titleWords.has(word)) score += 3;
        if (urlWords.has(word)) score += 1;
        
        // 模糊匹配
        for (const titleWord of titleWords) {
          if (titleWord.includes(word) || word.includes(titleWord)) {
            score += 1;
          }
        }
      }
      
      return {
        ...bookmark,
        relevance: score
      };
    })
    .filter(b => b.relevance > 0)
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, limit);
    
    return scored;
  }
  
  /**
   * 生成上下文哈希
   * @param {Object} context - 上下文对象
   * @returns {string} 哈希值
   */
  generateContextHash(context) {
    const key = JSON.stringify({
      topics: context.topics.slice(0, 5),
      categories: context.categories,
      summary: context.summary.substring(0, 100)
    });
    
    return this.simpleHash(key);
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
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }
  
  /**
   * 获取时间窗口
   * @returns {string} 时间窗口标识
   */
  getTimeWindow() {
    const hour = new Date().getHours();
    
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'afternoon';
    if (hour >= 18 && hour < 22) return 'evening';
    return 'night';
  }
  
  /**
   * 构建推荐上下文
   * @param {Array} userBookmarks - 用户书签
   * @param {string} currentPage - 当前页面
   * @param {Array} recentHistory - 最近历史
   * @returns {Object} 推荐上下文
   */
  buildRecommendationContext(userBookmarks, currentPage = '', recentHistory = []) {
    const userSummary = this.buildUserInterestSummary(userBookmarks, 25);
    const currentDomain = this.extractDomain(currentPage);
    const currentCategory = currentDomain ? 
      this.domainCategories.get(currentDomain) || this.categorizeDomain(currentDomain) : null;
    
    // 分析最近的浏览趋势
    const recentTrends = this.analyzeRecentTrends(recentHistory);
    
    return {
      userContextHash: this.generateContextHash(userSummary),
      primaryInterests: userSummary.topics.slice(0, 6).map(t => t.item),
      topCategories: Object.entries(userSummary.categories)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([cat, count]) => ({ category: cat, count })),
      currentPage: currentPage || '',
      currentDomain: currentDomain || '',
      currentCategory: currentCategory || '',
      recentTrends,
      timeWindow: this.getTimeWindow(),
      activityLevel: userSummary.patterns?.activity || 'unknown'
    };
  }
  
  /**
   * 分析最近浏览趋势
   * @param {Array} recentHistory - 最近历史
   * @returns {Object} 趋势分析
   */
  analyzeRecentTrends(recentHistory) {
    if (!recentHistory || recentHistory.length === 0) {
      return { domains: [], topics: [], pattern: 'inactive' };
    }
    
    const domainFreq = new Map();
    const topicFreq = new Map();
    
    for (const item of recentHistory.slice(0, 15)) {
      const domain = this.extractDomain(item.url);
      if (domain) {
        domainFreq.set(domain, (domainFreq.get(domain) || 0) + 1);
      }
      
      const topics = this.extractTopics(item.title);
      for (const topic of topics) {
        topicFreq.set(topic, (topicFreq.get(topic) || 0) + 1);
      }
    }
    
    return {
      domains: this.sortByFrequency(domainFreq, 5),
      topics: this.sortByFrequency(topicFreq, 8),
      pattern: recentHistory.length > 10 ? 'active' : 'moderate'
    };
  }
  
  /**
   * 构建分类上下文
   * @param {Array} bookmarks - 书签列表
   * @returns {Object} 分类上下文
   */
  buildCategorizationContext(bookmarks) {
    const analysis = this.analyzeBookmarks(bookmarks);
    
    // 生成分类建议的种子信息
    const categorySeeds = Object.entries(analysis.categories)
      .map(([category, count]) => ({ category, count, percentage: (count / bookmarks.length * 100).toFixed(1) }))
      .sort((a, b) => b.count - a.count);
    
    return {
      userContextHash: this.generateContextHash({ topics: analysis.topTopics, categories: analysis.categories }),
      totalBookmarks: bookmarks.length,
      mainCategories: categorySeeds.slice(0, 6),
      topDomains: analysis.topDomains.slice(0, 8),
      topTopics: analysis.topTopics.slice(0, 10),
      diversity: this.calculateDiversity(analysis),
      timeWindow: this.getTimeWindow()
    };
  }
  
  /**
   * 计算书签多样性
   * @param {Object} analysis - 分析结果
   * @returns {Object} 多样性指标
   */
  calculateDiversity(analysis) {
    const categoryCount = Object.keys(analysis.categories).length;
    const domainCount = analysis.topDomains.length;
    const topicCount = analysis.topTopics.length;
    
    let diversityScore = 'low';
    if (categoryCount >= 5 && domainCount >= 10) diversityScore = 'high';
    else if (categoryCount >= 3 && domainCount >= 6) diversityScore = 'medium';
    
    return {
      score: diversityScore,
      categories: categoryCount,
      domains: domainCount,
      topics: topicCount
    };
  }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AIContextBuilder;
} else if (typeof window !== 'undefined') {
  window.AIContextBuilder = AIContextBuilder;
} 