// AI Recommendation Service - 优化后的AI推荐服务
// 基于最佳实践重构的推荐系统：模块化、缓存、健壮性、智能上下文

class AIRecommendationService {
  constructor(aiService, options = {}) {
    if (!aiService) {
      throw new Error('AI Service is required');
    }
    
    this.aiService = aiService;
    
    // 初始化依赖组件
    this.cacheManager = new AICacheManager(options.cache);
    this.contextBuilder = new AIContextBuilder();
    this.promptTemplates = new AIPromptTemplates();
    
    // 配置选项
    this.config = {
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 1000,
      timeout: options.timeout || 30000,
      fallbackEnabled: options.fallbackEnabled !== false,
      ...options
    };
    
    // 请求队列和速率限制
    this.requestQueue = [];
    this.isProcessingQueue = false;
    this.rateLimitDelay = 1000; // 1秒间隔
    
    console.log('🚀 AI Recommendation Service initialized:', {
      cacheEnabled: !!this.cacheManager,
      maxRetries: this.config.maxRetries,
      rateLimitDelay: this.rateLimitDelay
    });
  }
  
  /**
   * 安全的JSON解析 - 处理LLM返回的各种格式
   * @param {string} text - LLM返回的文本
   * @returns {Object|null} 解析后的对象
   */
  safeJsonParse(text) {
    try {
      // 1. 首先尝试提取 ```json ... ``` 包裹的代码块
      const jsonBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonBlockMatch && jsonBlockMatch[1]) {
        return JSON.parse(jsonBlockMatch[1]);
      }
      
      // 2. 尝试提取 ``` ... ``` 包裹的代码块
      const codeBlockMatch = text.match(/```\s*([\s\S]*?)\s*```/);
      if (codeBlockMatch && codeBlockMatch[1]) {
        const content = codeBlockMatch[1].trim();
        if (content.startsWith('{') || content.startsWith('[')) {
          return JSON.parse(content);
        }
      }
      
      // 3. 查找第一个JSON对象
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch && jsonMatch[0]) {
        return JSON.parse(jsonMatch[0]);
      }
      
      // 4. 查找JSON数组
      const arrayMatch = text.match(/\[[\s\S]*\]/);
      if (arrayMatch && arrayMatch[0]) {
        return JSON.parse(arrayMatch[0]);
      }
      
      // 5. 直接解析（如果已经是纯JSON）
      const cleanText = text.trim();
      if (cleanText.startsWith('{') || cleanText.startsWith('[')) {
        return JSON.parse(cleanText);
      }
      
      console.warn('⚠️ Could not extract JSON from LLM response:', text.substring(0, 200) + '...');
      return null;
      
    } catch (error) {
      console.error('❌ JSON parsing failed:', {
        error: error.message,
        text: text.substring(0, 300) + '...'
      });
      return null;
    }
  }
  
  /**
   * 带重试机制的AI请求
   * @param {Array} messages - 消息数组
   * @param {Object} options - 请求选项
   * @returns {Promise<string>} AI响应
   */
  async requestWithRetry(messages, options = {}) {
    let lastError;
    
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        console.log(`🔄 AI request attempt ${attempt}/${this.config.maxRetries}`);
        
        const response = await Promise.race([
          this.aiService.request(messages, options),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Request timeout')), this.config.timeout)
          )
        ]);
        
        if (response && response.trim()) {
          console.log(`✅ AI request succeeded on attempt ${attempt}`);
          return response;
        } else {
          throw new Error('Empty response from AI service');
        }
        
      } catch (error) {
        lastError = error;
        console.warn(`⚠️ AI request attempt ${attempt} failed:`, error.message);
        
        if (attempt < this.config.maxRetries) {
          const delay = this.config.retryDelay * Math.pow(2, attempt - 1); // 指数退避
          console.log(`⏰ Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw new Error(`AI request failed after ${this.config.maxRetries} attempts: ${lastError.message}`);
  }
  
  /**
   * 核心推荐方法 - 支持多种推荐类型
   * @param {string} type - 推荐类型
   * @param {Object} params - 参数
   * @returns {Promise<Object|null>} 推荐结果
   */
  async getRecommendation(type, params) {
    try {
      // 验证推荐类型
      const availableTypes = [
        'related-bookmarks', 'suggested-searches', 'learning-path',
        'topic-recommendations', 'forgotten-gems', 'interest-analysis'
      ];
      
      if (!availableTypes.includes(type)) {
        throw new Error(`Unsupported recommendation type: ${type}`);
      }
      
      // 构建上下文
      const context = this.buildContext(type, params);
      
      // 检查缓存
      const cached = this.cacheManager.get(type, context);
      if (cached) {
        return cached;
      }
      
      // 生成推荐
      const result = await this.generateRecommendation(type, context, params);
      
      // 缓存结果
      if (result) {
        this.cacheManager.set(type, context, result);
      }
      
      return result;
      
    } catch (error) {
      console.error(`❌ Recommendation failed for type ${type}:`, error);
      
      // 降级处理
      if (this.config.fallbackEnabled) {
        return this.getFallbackRecommendation(type, params);
      }
      
      return null;
    }
  }
  
  /**
   * 构建推荐上下文
   * @param {string} type - 推荐类型
   * @param {Object} params - 参数
   * @returns {Object} 上下文对象
   */
  buildContext(type, params) {
    const { userBookmarks = [], currentPage = '', recentHistory = [] } = params;
    
    switch (type) {
      case 'related-bookmarks':
        return this.contextBuilder.buildRecommendationContext(
          userBookmarks, currentPage, recentHistory
        );
        
      case 'suggested-searches':
        return {
          userContextHash: this.cacheManager.generateUserContextHash(userBookmarks),
          currentPage,
          timeWindow: this.contextBuilder.getTimeWindow(),
          primaryInterests: this.contextBuilder.buildUserInterestSummary(userBookmarks).topics.slice(0, 5)
        };
        
      case 'learning-path':
        return {
          userContextHash: this.cacheManager.generateUserContextHash(userBookmarks),
          topic: params.topic || '',
          currentPage,
          timeWindow: this.contextBuilder.getTimeWindow()
        };
        
      case 'topic-recommendations':
        return this.contextBuilder.buildRecommendationContext(
          userBookmarks, currentPage, recentHistory
        );
        
      case 'forgotten-gems':
        return {
          userContextHash: this.cacheManager.generateUserContextHash(userBookmarks),
          currentTime: new Date().toISOString(),
          timeWindow: this.contextBuilder.getTimeWindow()
        };
        
      case 'interest-analysis':
        return {
          userContextHash: this.cacheManager.generateUserContextHash(userBookmarks),
          analysisDepth: params.depth || 'standard',
          timeWindow: this.contextBuilder.getTimeWindow()
        };
        
      default:
        return {
          userContextHash: this.cacheManager.generateUserContextHash(userBookmarks),
          timeWindow: this.contextBuilder.getTimeWindow()
        };
    }
  }
  
  /**
   * 生成推荐结果
   * @param {string} type - 推荐类型
   * @param {Object} context - 上下文
   * @param {Object} params - 参数
   * @returns {Promise<Object|null>} 推荐结果
   */
  async generateRecommendation(type, context, params) {
    const variables = this.prepareTemplateVariables(type, context, params);
    const messages = this.promptTemplates.buildMessages(type, variables);
    
    console.log(`🎯 Generating ${type} recommendation:`, {
      contextHash: context.userContextHash,
      variableKeys: Object.keys(variables)
    });
    
    const rawResponse = await this.requestWithRetry(messages, {
      maxTokens: this.getMaxTokensForType(type),
      temperature: this.getTemperatureForType(type)
    });
    
    const result = this.safeJsonParse(rawResponse);
    
    if (!result) {
      throw new Error(`Failed to parse ${type} recommendation response`);
    }
    
    // 验证结果格式
    const validatedResult = this.validateRecommendationResult(type, result);
    
    console.log(`✅ Generated ${type} recommendation:`, {
      hasResult: !!validatedResult,
      resultKeys: validatedResult ? Object.keys(validatedResult) : []
    });
    
    return validatedResult;
  }
  
  /**
   * 准备模板变量
   * @param {string} type - 推荐类型
   * @param {Object} context - 上下文
   * @param {Object} params - 参数
   * @returns {Object} 模板变量
   */
  prepareTemplateVariables(type, context, params) {
    const { userBookmarks = [], currentPage = '', recentHistory = [] } = params;
    
    // 基础变量
    const baseVariables = {
      currentPage: currentPage || '',
      currentDomain: context.currentDomain || '',
      currentCategory: context.currentCategory || '',
      timeWindow: context.timeWindow || '',
      primaryInterests: context.primaryInterests || [],
      activityLevel: context.activityLevel || 'unknown'
    };
    
    // 根据类型添加特定变量
    switch (type) {
      case 'related-bookmarks':
        return {
          ...baseVariables,
          topCategories: context.topCategories || [],
          bookmarksData: this.formatBookmarksForTemplate(userBookmarks, 15)
        };
        
      case 'suggested-searches':
        return {
          ...baseVariables,
          // 搜索建议不需要完整书签数据
        };
        
      case 'learning-path':
        return {
          ...baseVariables,
          topic: params.topic || '通用技能学习',
          bookmarksData: this.formatBookmarksForTemplate(userBookmarks, 20)
        };
        
      case 'topic-recommendations':
        const relevantBookmarks = this.contextBuilder.findRelevantBookmarks(
          params.query || '', userBookmarks, 10
        );
        return {
          ...baseVariables,
          topCategories: context.topCategories || [],
          relevantBookmarks: this.formatBookmarksForTemplate(relevantBookmarks, 10)
        };
        
      case 'forgotten-gems':
        return {
          ...baseVariables,
          bookmarksData: this.formatBookmarksForTemplate(userBookmarks, 25),
          recentHistory: this.formatHistoryForTemplate(recentHistory, 10),
          currentTime: context.currentTime || new Date().toISOString()
        };
        
      case 'interest-analysis':
        return {
          ...baseVariables,
          topCategories: context.topCategories || [],
          recentTrends: context.recentTrends || {},
          bookmarksData: this.formatBookmarksForTemplate(userBookmarks, 30),
          historyData: this.formatHistoryForTemplate(recentHistory, 15)
        };
        
      default:
        return {
          ...baseVariables,
          bookmarksData: this.formatBookmarksForTemplate(userBookmarks, 20)
        };
    }
  }
  
  /**
   * 格式化书签数据用于模板
   * @param {Array} bookmarks - 书签数组
   * @param {number} limit - 限制数量
   * @returns {string} 格式化后的书签数据
   */
  formatBookmarksForTemplate(bookmarks, limit = 20) {
    return JSON.stringify(
      bookmarks.slice(0, limit).map(b => ({
        id: b.id,
        title: b.title,
        url: b.url,
        type: b.type || 'bookmark'
      })),
      null,
      2
    );
  }
  
  /**
   * 格式化历史数据用于模板
   * @param {Array} history - 历史数组
   * @param {number} limit - 限制数量
   * @returns {string} 格式化后的历史数据
   */
  formatHistoryForTemplate(history, limit = 15) {
    return JSON.stringify(
      history.slice(0, limit).map(h => ({
        title: h.title,
        url: h.url,
        lastVisitTime: h.lastVisitTime,
        visitCount: h.visitCount
      })),
      null,
      2
    );
  }
  
  /**
   * 获取不同类型推荐的最大token数
   * @param {string} type - 推荐类型
   * @returns {number} 最大token数
   */
  getMaxTokensForType(type) {
    const tokenLimits = {
      'related-bookmarks': 1000,
      'suggested-searches': 500,
      'learning-path': 2000,
      'topic-recommendations': 1500,
      'forgotten-gems': 1200,
      'interest-analysis': 2500
    };
    
    return tokenLimits[type] || 1000;
  }
  
  /**
   * 获取不同类型推荐的温度参数
   * @param {string} type - 推荐类型
   * @returns {number} 温度值
   */
  getTemperatureForType(type) {
    const temperatures = {
      'related-bookmarks': 0.3,      // 需要精确性
      'suggested-searches': 0.7,     // 需要创造性
      'learning-path': 0.4,          // 需要结构化
      'topic-recommendations': 0.6,  // 平衡精确性和创造性
      'forgotten-gems': 0.5,         // 中等创造性
      'interest-analysis': 0.3       // 需要精确性
    };
    
    return temperatures[type] || 0.5;
  }
  
  /**
   * 验证推荐结果格式
   * @param {string} type - 推荐类型
   * @param {Object} result - 推荐结果
   * @returns {Object|null} 验证后的结果
   */
  validateRecommendationResult(type, result) {
    if (!result || typeof result !== 'object') {
      console.error(`❌ Invalid result format for ${type}:`, result);
      return null;
    }
    
    try {
      switch (type) {
        case 'related-bookmarks':
          if (result.relatedBookmarks && Array.isArray(result.relatedBookmarks)) {
            return {
              relatedBookmarks: result.relatedBookmarks.filter(item => 
                item.id && item.title && typeof item.relevanceScore === 'number'
              ).slice(0, 8) // 限制数量
            };
          }
          break;
          
        case 'suggested-searches':
          if (result.suggestedSearches && Array.isArray(result.suggestedSearches)) {
            return {
              suggestedSearches: result.suggestedSearches
                .filter(search => typeof search === 'string' && search.trim())
                .slice(0, 5)
            };
          }
          break;
          
        case 'learning-path':
          if (result.learningPath && result.learningPath.steps && Array.isArray(result.learningPath.steps)) {
            return {
              learningPath: {
                topic: result.learningPath.topic || '学习路径',
                difficulty: result.learningPath.difficulty || '中级',
                estimatedTime: result.learningPath.estimatedTime || '未知',
                steps: result.learningPath.steps.slice(0, 8)
              }
            };
          }
          break;
          
        case 'topic-recommendations':
          if (result.topicRecommendations && Array.isArray(result.topicRecommendations)) {
            return {
              topicRecommendations: result.topicRecommendations.slice(0, 6)
            };
          }
          break;
          
        case 'forgotten-gems':
          if (result.forgottenGems && Array.isArray(result.forgottenGems)) {
            return {
              forgottenGems: result.forgottenGems.slice(0, 6),
              summary: result.summary || '发现了一些有价值的书签'
            };
          }
          break;
          
        case 'interest-analysis':
          if (result.primaryInterests || result.behaviorPatterns || result.insights) {
            return {
              primaryInterests: result.primaryInterests || [],
              behaviorPatterns: result.behaviorPatterns || [],
              recommendations: result.recommendations || [],
              insights: result.insights || []
            };
          }
          break;
          
        default:
          return result;
      }
      
      console.error(`❌ Result validation failed for ${type}:`, result);
      return null;
      
    } catch (error) {
      console.error(`❌ Result validation error for ${type}:`, error);
      return null;
    }
  }
  
  /**
   * 降级推荐 - 当AI服务失败时提供基础推荐
   * @param {string} type - 推荐类型
   * @param {Object} params - 参数
   * @returns {Object|null} 降级推荐结果
   */
  getFallbackRecommendation(type, params) {
    console.log(`🔄 Providing fallback recommendation for ${type}`);
    
    const { userBookmarks = [], currentPage = '' } = params;
    
    try {
      switch (type) {
        case 'related-bookmarks':
          // 基于简单关键词匹配
          const currentDomain = this.contextBuilder.extractDomain(currentPage);
          const related = userBookmarks
            .filter(b => currentDomain && b.url.includes(currentDomain))
            .slice(0, 3)
            .map(b => ({
              id: b.id,
              title: b.title,
              reason: `与当前网站 ${currentDomain} 相关`,
              relevanceScore: 0.7
            }));
          
          return { relatedBookmarks: related };
          
        case 'suggested-searches':
          // 基于用户兴趣的基础搜索建议
          const interests = this.contextBuilder.buildUserInterestSummary(userBookmarks);
          const searches = interests.topics.slice(0, 3).map(topic => 
            `${topic.item} 最佳实践`
          );
          
          return { suggestedSearches: searches };
          
        case 'forgotten-gems':
          // 找出较老的书签
          const oldBookmarks = userBookmarks
            .filter(b => b.dateAdded)
            .sort((a, b) => new Date(a.dateAdded) - new Date(b.dateAdded))
            .slice(0, 3)
            .map(b => ({
              id: b.id,
              title: b.title,
              ageInDays: Math.floor((Date.now() - new Date(b.dateAdded)) / (1000 * 60 * 60 * 24)),
              currentRelevance: '可能仍然有用',
              rediscoveryValue: '值得重新查看',
              actionSuggestion: '点击查看内容是否仍然相关'
            }));
          
          return { 
            forgottenGems: oldBookmarks,
            summary: '基于时间发现的可能被遗忘的书签'
          };
          
        default:
          return null;
      }
    } catch (error) {
      console.error(`❌ Fallback recommendation failed for ${type}:`, error);
      return null;
    }
  }
  
  /**
   * 获取缓存统计信息
   * @returns {Object} 缓存统计
   */
  getCacheStats() {
    return this.cacheManager.getStats();
  }
  
  /**
   * 清理缓存
   * @param {string} type - 可选，指定类型
   */
  clearCache(type = null) {
    this.cacheManager.invalidate(type);
  }
  
  /**
   * 销毁服务
   */
  destroy() {
    if (this.cacheManager) {
      this.cacheManager.destroy();
    }
    
    console.log('🗑️ AI Recommendation Service destroyed');
  }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AIRecommendationService;
} else if (typeof window !== 'undefined') {
  window.AIRecommendationService = AIRecommendationService;
} 