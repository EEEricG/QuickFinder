// AI Service Optimized - 全面优化后的AI服务
// 基于最佳实践的AI服务：模块化、缓存、健壮性、智能上下文、提示词模板化

class AIServiceOptimized {
  constructor() {
    // 保留原有的providers配置以兼容现有代码
    this.providers = this.initializeProviders();
    this.settings = null;
    
    // 初始化新的优化组件
    this.cacheManager = null;
    this.contextBuilder = null;
    this.promptTemplates = null;
    this.recommendationService = null;
    
    // 初始化标志
    this.isInitialized = false;
    
    console.log('🚀 AI Service Optimized starting initialization...');
    this.init();
  }
  
  /**
   * 异步初始化
   */
  async init() {
    try {
      await this.loadSettings();
      await this.initializeOptimizedComponents();
      this.isInitialized = true;
      console.log('✅ AI Service Optimized initialized successfully');
    } catch (error) {
      console.error('❌ AI Service Optimized initialization failed:', error);
    }
  }
  
  /**
   * 初始化优化组件
   */
  async initializeOptimizedComponents() {
    // 初始化缓存管理器
    this.cacheManager = new AICacheManager({
      maxSize: 2000,
      defaultTTL: 30 * 60 * 1000, // 30分钟
      cleanupInterval: 10 * 60 * 1000 // 10分钟清理一次
    });
    
    // 初始化上下文构建器
    this.contextBuilder = new AIContextBuilder();
    
    // 初始化提示词模板
    this.promptTemplates = new AIPromptTemplates();
    
    // 初始化推荐服务
    this.recommendationService = new AIRecommendationService(this, {
      cache: { maxSize: 1000 },
      maxRetries: 3,
      retryDelay: 1000,
      timeout: 45000,
      fallbackEnabled: true
    });
    
    console.log('🧩 All optimized components initialized');
  }
  
  /**
   * 初始化AI提供商配置（保持兼容性）
   */
  initializeProviders() {
    return {
      openai: {
        name: 'OpenAI',
        icon: '🤖',
        description: '业界领先的AI模型提供商',
        apiUrl: 'https://api.openai.com/v1/chat/completions',
        models: [
          { id: 'gpt-4o', name: 'GPT-4o', description: '最新的多模态模型，支持文本、图像和音频' },
          { id: 'gpt-4o-mini', name: 'GPT-4o mini', description: '轻量级版本，性价比高，适合大多数任务' },
          { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: '高性能模型，适合复杂推理任务' },
          { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: '经典快速模型，适合简单对话任务' }
        ],
        headers: (apiKey) => ({
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        }),
        buildRequest: (messages, model, options = {}) => ({
          model: model,
          messages: messages,
          temperature: options.temperature || 0.7,
          max_tokens: options.maxTokens || 2000
        }),
        parseResponse: (response) => {
          if (response.choices && response.choices[0] && response.choices[0].message) {
            return response.choices[0].message.content;
          }
          throw new Error('Invalid response format from OpenAI API');
        }
      },
      
      google: {
        name: 'Google Gemini',
        icon: '🔍',
        description: 'Google的最新Gemini系列模型，支持多模态AI',
        apiUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
        models: [
          { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: '最新的高性能Gemini模型' },
          { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: '快速响应的Gemini 2.5模型' },
          { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', description: '轻量级Gemini 2.5模型' },
          { id: 'gemini-2.5-flash-lite preview-06-17', name: 'Gemini 2.5 Flash Lite Preview', description: 'Gemini 2.5 Flash Lite预览版' },
          { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'Gemini 1.5 Pro模型' },
          { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: 'Gemini 1.5 Flash模型' }
        ],
        headers: (apiKey) => ({
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        }),
        buildRequest: (messages, model, options = {}) => {
          const contents = messages.map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.role === 'system' ? `System: ${msg.content}` : msg.content }]
          }));
          
          return {
            contents: contents,
            generationConfig: {
              temperature: options.temperature || 0.7,
              maxOutputTokens: options.maxTokens || 2000
            }
          };
        },
        parseResponse: (response) => {
          if (response.candidates && response.candidates[0] && response.candidates[0].content) {
            return response.candidates[0].content.parts[0].text;
          }
          throw new Error('Invalid response format from Google Gemini API');
        }
      },
      
      // 添加更多provider...（为简洁起见，这里只展示主要的）
      siliconflow: {
        name: '硅基流动 (SiliconFlow)',
        icon: '🔥',
        description: '免费AI模型代理服务',
        apiUrl: 'https://api.siliconflow.cn/v1/chat/completions',
        models: [
          { id: 'deepseek-ai/DeepSeek-V3', name: 'DeepSeek-V3 (硅基)', description: '硅基流动提供的DeepSeek-V3，稳定可靠' },
          { id: 'Qwen/Qwen2.5-72B-Instruct', name: 'Qwen2.5-72B (硅基)', description: '硅基流动提供的通义千问2.5-72B' }
        ],
        headers: (apiKey) => ({
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        }),
        buildRequest: (messages, model, options = {}) => ({
          model: model,
          messages: messages,
          temperature: options.temperature || 0.7,
          max_tokens: options.maxTokens || 4000,
          stream: false
        }),
        parseResponse: (response) => {
          if (response.choices && response.choices[0] && response.choices[0].message) {
            return response.choices[0].message.content;
          }
          throw new Error('Invalid response format from SiliconFlow API');
        }
      }
    };
  }
  
  // ===== 设置管理方法（保持兼容性）=====
  
  async loadSettings() {
    try {
      if (typeof chrome === 'undefined' || !chrome.storage) {
        throw new Error('Chrome storage API not available');
      }
      
      let result = {};
      try {
        result = await chrome.storage.local.get(['aiSettings']);
      } catch (localError) {
        result = await chrome.storage.sync.get(['aiSettings']);
      }
      
      this.settings = result.aiSettings || {
        provider: 'siliconflow',
        model: 'deepseek-ai/DeepSeek-V3',
        apiKey: '',
        enabledFeatures: ['smart-search', 'auto-categorize', 'summarize', 'recommendations']
      };
      
      console.log('📋 Loaded AI settings:', {
        provider: this.settings.provider,
        model: this.settings.model,
        hasApiKey: !!this.settings.apiKey,
        enabledFeatures: this.settings.enabledFeatures
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
  
  async saveSettings(settings) {
    try {
      this.settings = { ...this.settings, ...settings };
      
      const savePromises = [];
      try {
        savePromises.push(chrome.storage.local.set({ aiSettings: this.settings }));
        savePromises.push(chrome.storage.sync.set({ aiSettings: this.settings }));
      } catch (error) {
        console.warn('⚠️ Storage save warning:', error);
      }
      
      await Promise.allSettled(savePromises);
      console.log('✅ AI settings saved successfully');
      return true;
    } catch (error) {
      console.error('❌ Error saving AI settings:', error);
      return false;
    }
  }
  
  isFeatureEnabled(feature) {
    return this.settings?.enabledFeatures?.includes(feature) || false;
  }
  
  isAvailable() {
    return this.settings?.apiKey && this.settings?.provider && this.providers[this.settings.provider];
  }
  
  getCurrentProvider() {
    return this.providers[this.settings?.provider];
  }
  
  getCurrentModel() {
    const provider = this.getCurrentProvider();
    return provider?.models.find(m => m.id === this.settings?.model);
  }
  
  // ===== 核心AI请求方法（优化版）=====
  
  /**
   * 统一的AI请求接口（带健壮性优化）
   * @param {Array} messages - 消息数组
   * @param {Object} options - 请求选项
   * @returns {Promise<string>} AI响应
   */
  async request(messages, options = {}) {
    if (!this.isAvailable()) {
      throw new Error('AI服务未配置或不可用');
    }
    
    // 确保组件已初始化
    if (!this.isInitialized) {
      await this.init();
    }
    
    const provider = this.getCurrentProvider();
    const model = this.settings.model;
    const apiKey = this.settings.apiKey;
    
    console.log('🚀 发起优化AI请求:', {
      provider: this.settings.provider,
      model: model,
      messageCount: messages.length,
      hasCache: !!this.cacheManager
    });
    
    try {
      // 对于Google Gemini，使用专用的请求方法
      if (this.settings.provider === 'google') {
        return await this.requestGemini(messages, options);
      }
      
      const headers = provider.headers(apiKey);
      const requestBody = provider.buildRequest(messages, model, options);
      
      const response = await fetch(provider.apiUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(requestBody),
        mode: 'cors'
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API请求失败: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      return provider.parseResponse(data);
      
    } catch (error) {
      console.error('❌ AI请求错误:', error);
      throw error;
    }
  }
  
  /**
   * Google Gemini专用请求方法
   */
  async requestGemini(messages, options = {}) {
    const provider = this.getCurrentProvider();
    const model = this.settings.model;
    const apiKey = this.settings.apiKey;
    
    const apiUrl = `${provider.apiUrl}/${model}:generateContent?key=${apiKey}`;
    const requestBody = provider.buildRequest(messages, model, options);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      mode: 'cors'
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API request failed: ${response.status} ${errorText}`);
    }
    
    const responseData = await response.json();
    return provider.parseResponse(responseData);
  }
  
  // ===== 优化后的AI功能方法 =====
  
  /**
   * 智能搜索（优化版）
   * @param {string} query - 搜索查询
   * @param {Array} bookmarks - 书签数组
   * @param {string} currentPage - 当前页面URL
   * @returns {Promise<Object|null>} 搜索结果
   */
  async smartSearch(query, bookmarks, currentPage = '') {
    if (!this.isFeatureEnabled('smart-search') || !this.isInitialized) {
      return null;
    }
    
    try {
      console.log('🔍 Optimized smart search:', { query, bookmarkCount: bookmarks.length });
      
      // 构建智能搜索上下文
      const context = this.contextBuilder.buildSearchContext(query, bookmarks, currentPage);
      
      // 检查缓存
      const cacheKey = this.cacheManager.generateKey('smart-search', context);
      const cached = this.cacheManager.get('smart-search', context);
      if (cached) {
        return cached;
      }
      
      // 准备模板变量
      const variables = {
        query: query,
        userInterests: context.userInterests,
        currentPage: currentPage,
        bookmarksData: JSON.stringify(context.relevantBookmarks, null, 2)
      };
      
      // 使用模板生成消息
      const messages = this.promptTemplates.buildMessages('smart-search', variables);
      
      // 发起AI请求
      const rawResponse = await this.request(messages, {
        maxTokens: 1500,
        temperature: 0.3
      });
      
      // 安全解析JSON
      const result = this.safeJsonParse(rawResponse);
      
      if (result && result.matches) {
        // 缓存结果
        this.cacheManager.set('smart-search', context, result);
        
        console.log('✅ Smart search completed:', {
          matchCount: result.matches.length,
          totalMatches: result.totalMatches
        });
        
        return result;
      }
      
      return { matches: [], totalMatches: 0 };
      
    } catch (error) {
      console.error('❌ Smart search failed:', error);
      
      // 降级处理：基础关键词匹配
      const fallbackMatches = bookmarks
        .filter(b => b.title.toLowerCase().includes(query.toLowerCase()) || 
                    b.url.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 10)
        .map(b => ({
          id: b.id,
          title: b.title,
          url: b.url,
          relevanceScore: 0.6,
          reason: '基于关键词匹配'
        }));
      
      return { matches: fallbackMatches, totalMatches: fallbackMatches.length };
    }
  }
  
  /**
   * 安全的JSON解析
   * @param {string} text - 要解析的文本
   * @returns {Object|null} 解析结果
   */
  safeJsonParse(text) {
    if (!this.recommendationService) {
      // 如果推荐服务未初始化，使用基础解析
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
      } catch {
        return null;
      }
    }
    
    return this.recommendationService.safeJsonParse(text);
  }
  
  /**
   * 获取推荐（统一接口）
   * @param {string} type - 推荐类型
   * @param {Object} params - 参数
   * @returns {Promise<Object|null>} 推荐结果
   */
  async getRecommendation(type, params) {
    if (!this.isFeatureEnabled('recommendations') || !this.isInitialized) {
      return null;
    }
    
    if (!this.recommendationService) {
      console.error('❌ Recommendation service not initialized');
      return null;
    }
    
    return await this.recommendationService.getRecommendation(type, params);
  }
  
  /**
   * 获取相关书签推荐
   * @param {Array} userBookmarks - 用户书签
   * @param {string} currentPage - 当前页面
   * @param {Array} recentHistory - 最近历史
   * @returns {Promise<Object|null>} 相关书签
   */
  async getRelatedBookmarks(userBookmarks, currentPage, recentHistory = []) {
    return await this.getRecommendation('related-bookmarks', {
      userBookmarks,
      currentPage,
      recentHistory
    });
  }
  
  /**
   * 获取搜索建议
   * @param {Array} userBookmarks - 用户书签
   * @param {string} currentPage - 当前页面
   * @returns {Promise<Object|null>} 搜索建议
   */
  async getSuggestedSearches(userBookmarks, currentPage = '') {
    return await this.getRecommendation('suggested-searches', {
      userBookmarks,
      currentPage
    });
  }
  
  /**
   * 生成学习路径
   * @param {string} topic - 学习主题
   * @param {Array} userBookmarks - 用户书签
   * @returns {Promise<Object|null>} 学习路径
   */
  async generateLearningPath(topic, userBookmarks) {
    return await this.getRecommendation('learning-path', {
      topic,
      userBookmarks
    });
  }
  
  /**
   * 发现遗忘的书签
   * @param {Array} userBookmarks - 用户书签
   * @param {Array} recentHistory - 最近历史
   * @returns {Promise<Object|null>} 遗忘的书签
   */
  async discoverForgottenBookmarks(userBookmarks, recentHistory = []) {
    return await this.getRecommendation('forgotten-gems', {
      userBookmarks,
      recentHistory
    });
  }
  
  /**
   * 分析用户兴趣
   * @param {Array} userBookmarks - 用户书签
   * @param {Array} recentHistory - 最近历史
   * @returns {Promise<Object|null>} 兴趣分析
   */
  async analyzeUserInterests(userBookmarks, recentHistory = []) {
    return await this.getRecommendation('interest-analysis', {
      userBookmarks,
      recentHistory
    });
  }
  
  // ===== 兼容性方法（保持原有API） =====
  
  async categorizeBookmarks(bookmarks) {
    if (!this.isFeatureEnabled('auto-categorize')) return null;
    
    try {
      const context = this.contextBuilder?.buildCategorizationContext(bookmarks) || {};
      const variables = {
        bookmarksData: JSON.stringify(bookmarks.slice(0, 50), null, 2),
        mainCategories: context.mainCategories || [],
        diversity: context.diversity || {},
        totalBookmarks: bookmarks.length
      };
      
      const messages = this.promptTemplates?.buildMessages('categorization', variables) || [
        {
          role: 'system',
          content: '你是一个书签分类专家。分析书签并提供合理的分类建议。返回JSON格式。'
        },
        {
          role: 'user',
          content: `请为以下书签提供分类建议：\n${JSON.stringify(bookmarks.slice(0, 30), null, 2)}`
        }
      ];
      
      const response = await this.request(messages);
      return this.safeJsonParse(response);
    } catch (error) {
      console.error('分类书签失败:', error);
      return null;
    }
  }
  
  async generateSummary(url, title, content) {
    if (!this.isFeatureEnabled('summarize')) return null;
    
    try {
      const variables = {
        url: url,
        title: title,
        content: content ? content.substring(0, 3000) : '无法获取内容'
      };
      
      const messages = this.promptTemplates?.buildMessages('content-summary', variables) || [
        {
          role: 'system',
          content: '你是一个内容摘要专家。为网页内容生成简洁的摘要和关键信息。返回JSON格式。'
        },
        {
          role: 'user',
          content: `请为以下网页生成摘要：\n标题: ${title}\nURL: ${url}\n内容: ${content || '无法获取内容'}`
        }
      ];
      
      const response = await this.request(messages);
      return this.safeJsonParse(response);
    } catch (error) {
      console.error('生成摘要失败:', error);
      return null;
    }
  }
  
  // ===== 统计和管理方法 =====
  
  /**
   * 获取服务统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    return {
      isOptimized: true,
      isInitialized: this.isInitialized,
      provider: this.settings?.provider,
      model: this.settings?.model,
      featuresEnabled: this.settings?.enabledFeatures || [],
      cacheStats: this.cacheManager?.getStats() || null,
      hasRecommendationService: !!this.recommendationService
    };
  }
  
  /**
   * 清理缓存
   * @param {string} type - 可选的缓存类型
   */
  clearCache(type = null) {
    if (this.cacheManager) {
      this.cacheManager.invalidate(type);
      console.log(`🧹 Cache cleared${type ? ` for type: ${type}` : ''}`);
    }
    
    if (this.recommendationService) {
      this.recommendationService.clearCache(type);
    }
  }
  
  /**
   * 销毁服务
   */
  destroy() {
    if (this.cacheManager) {
      this.cacheManager.destroy();
    }
    
    if (this.recommendationService) {
      this.recommendationService.destroy();
    }
    
    console.log('🗑️ AI Service Optimized destroyed');
  }
}

// 导出和全局实例
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AIServiceOptimized;
} else if (typeof window !== 'undefined') {
  window.AIServiceOptimized = AIServiceOptimized;
  
  // 创建全局优化实例
  if (!window.aiServiceOptimized) {
    window.aiServiceOptimized = new AIServiceOptimized();
  }
} 