// AI Worker for QuickFinder - 异步AI处理
// 将所有计算密集型AI任务卸载到Web Worker以保持UI响应性

class AIWorker {
  constructor() {
    this.providers = null;
    this.settings = null;
    this.retryConfig = {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      backoffFactor: 2
    };
    
    console.log('🔧 AI Worker initialized');
  }

  // 初始化AI配置
  async initialize(providers, settings) {
    this.providers = providers;
    this.settings = settings;
    console.log('✅ AI Worker configured:', {
      provider: settings?.provider,
      model: settings?.model,
      hasApiKey: !!settings?.apiKey
    });
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

  // 验证AI服务可用性
  isAvailable() {
    return !!(this.settings?.provider && 
              this.settings?.apiKey && 
              this.providers?.[this.settings.provider]);
  }

  // 获取当前提供商配置
  getCurrentProvider() {
    if (!this.isAvailable()) {
      throw new Error('AI服务未配置或不可用');
    }
    return this.providers[this.settings.provider];
  }

  // 核心AI请求方法（带重试机制）
  async request(messages, options = {}) {
    return await this.retryWithBackoff(async () => {
      if (!this.isAvailable()) {
        throw new Error('AI服务未配置或不可用');
      }

      const provider = this.getCurrentProvider();
      const model = this.settings.model;
      const apiKey = this.settings.apiKey;

      const headers = provider.headers(apiKey);
      const requestBody = provider.buildRequest(messages, model, options);

      console.log('📡 AI Worker making request:', {
        provider: this.settings.provider,
        model: model,
        messageCount: messages.length
      });

      const response = await fetch(provider.apiUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(requestBody),
        mode: 'cors'
      });

      if (!response.ok) {
        const errorText = await response.text();
        const error = new Error(`AI API request failed: ${response.status} ${response.statusText}`);
        error.status = response.status;
        error.response = errorText;
        throw error;
      }

      const responseData = await response.json();
      return provider.parseResponse(responseData);
    }, `AI request to ${this.settings.provider}`);
  }

  // 智能搜索
  async smartSearch(query, bookmarks) {
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
${JSON.stringify(bookmarks.slice(0, 100).map(b => ({
  id: b.id,
  title: b.title,
  url: b.url,
  type: b.type || 'bookmark'
})), null, 2)}

请找出最相关的书签并解释匹配原因。`
      }
    ];

    try {
      const response = await this.request(messages);
      return JSON.parse(response);
    } catch (error) {
      console.error('Smart search failed:', error);
      throw error;
    }
  }

  // 书签分类
  async categorizeBookmarks(bookmarks) {
    const messages = [
      {
        role: 'system',
        content: `你是一个书签分类专家。分析书签并按主题分类。

返回JSON格式：
{
  "categories": [
    {
      "name": "类别名称",
      "description": "类别描述",
      "bookmarks": [
        {
          "id": "书签ID",
          "title": "标题",
          "url": "URL",
          "confidence": 0.95
        }
      ],
      "count": 数量
    }
  ],
  "uncategorized": [书签列表],
  "summary": "分类总结"
}`
      },
      {
        role: 'user',
        content: `请对以下书签进行智能分类：

${JSON.stringify(bookmarks.slice(0, 50).map(b => ({
  id: b.id,
  title: b.title,
  url: b.url
})), null, 2)}`
      }
    ];

    try {
      const response = await this.request(messages);
      return JSON.parse(response);
    } catch (error) {
      console.error('Categorization failed:', error);
      throw error;
    }
  }

  // 检测重复书签
  async detectDuplicates(bookmarks) {
    const messages = [
      {
        role: 'system',
        content: `你是一个重复检测专家。分析书签找出重复和相似项目。

返回JSON格式：
{
  "duplicates": [
    {
      "reason": "重复原因",
      "bookmarks": [
        {"id": "书签ID", "title": "标题", "url": "URL", "similarity": 0.95}
      ]
    }
  ],
  "similar": [
    {
      "reason": "相似原因", 
      "bookmarks": [
        {"id": "书签ID", "title": "标题", "url": "URL", "similarity": 0.80}
      ]
    }
  ]
}`
      },
      {
        role: 'user',
        content: `请分析这些书签，找出重复和相似的项目：
${JSON.stringify(bookmarks.slice(0, 100), null, 2)}`
      }
    ];

    try {
      const response = await this.request(messages);
      return JSON.parse(response);
    } catch (error) {
      console.error('Duplicate detection failed:', error);
      throw error;
    }
  }

  // 生成推荐
  async generateRecommendations(userBookmarks, currentContext) {
    const messages = [
      {
        role: 'system',
        content: `你是一个个性化推荐专家。基于用户书签和当前上下文提供智能推荐。

返回JSON格式：
{
  "relatedBookmarks": [
    {
      "id": "书签ID",
      "title": "标题", 
      "url": "URL",
      "relevanceScore": 0.90,
      "reason": "推荐原因"
    }
  ],
  "suggestedSearches": ["搜索建议1", "搜索建议2"],
  "insights": ["洞察1", "洞察2"]
}`
      },
      {
        role: 'user',
        content: `当前上下文：${currentContext}

用户书签：
${JSON.stringify(userBookmarks.slice(0, 30).map(b => ({
  title: b.title,
  url: b.url
})), null, 2)}

请提供个性化推荐。`
      }
    ];

    try {
      const response = await this.request(messages);
      return JSON.parse(response);
    } catch (error) {
      console.error('Recommendations failed:', error);
      throw error;
    }
  }
}

// Worker消息处理
const aiWorker = new AIWorker();

self.onmessage = async function(e) {
  const { id, type, data } = e.data;
  
  try {
    let result;
    
    switch (type) {
      case 'initialize':
        await aiWorker.initialize(data.providers, data.settings);
        result = { success: true };
        break;
        
      case 'smart-search':
        result = await aiWorker.smartSearch(data.query, data.bookmarks);
        break;
        
      case 'categorize':
        result = await aiWorker.categorizeBookmarks(data.bookmarks);
        break;
        
      case 'detect-duplicates':
        result = await aiWorker.detectDuplicates(data.bookmarks);
        break;
        
      case 'recommendations':
        result = await aiWorker.generateRecommendations(data.bookmarks, data.context);
        break;
        
      default:
        throw new Error(`Unknown operation type: ${type}`);
    }
    
    // 发送成功结果
    self.postMessage({
      id: id,
      success: true,
      result: result
    });
    
  } catch (error) {
    console.error(`AI Worker error for ${type}:`, error);
    
    // 发送错误结果
    self.postMessage({
      id: id,
      success: false,
      error: {
        message: error.message,
        type: error.constructor.name,
        status: error.status
      }
    });
  }
};

console.log('🚀 AI Worker ready');
