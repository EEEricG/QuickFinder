// AI Service Manager - 高性能异步AI服务管理器
// 实现Web Worker集成、错误处理、回退机制和性能优化

class AIServiceManager {
  constructor() {
    this.worker = null;
    this.settings = null;
    this.providers = null;
    this.requestId = 0;
    this.pendingRequests = new Map();
    this.isInitialized = false;
    this.fallbackEnabled = true;
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5分钟缓存
    
    console.log('🔧 AI Service Manager created');
  }

  // 初始化AI服务
  async initialize() {
    try {
      // 加载设置和提供商配置
      await this.loadSettings();
      await this.loadProviders();
      
      // 初始化Web Worker
      await this.initializeWorker();
      
      this.isInitialized = true;
      console.log('✅ AI Service Manager initialized successfully');
      
      return true;
    } catch (error) {
      console.error('❌ AI Service Manager initialization failed:', error);
      this.isInitialized = false;
      return false;
    }
  }

  // 加载AI设置 - 兼容多种存储格式
  async loadSettings() {
    try {
      let result = {};

      // 尝试从本地存储加载（新格式）
      try {
        result = await chrome.storage.local.get(['ai-settings', 'aiSettings']);
        console.log('📖 Local storage result:', result);
      } catch (localError) {
        console.warn('⚠️ Local storage failed:', localError);
      }

      // 如果本地存储没有数据，尝试同步存储
      if (!result['ai-settings'] && !result.aiSettings) {
        try {
          result = await chrome.storage.sync.get(['ai-settings', 'aiSettings']);
          console.log('📖 Sync storage result:', result);
        } catch (syncError) {
          console.warn('⚠️ Sync storage failed:', syncError);
        }
      }

      // 优先使用新格式，回退到旧格式
      this.settings = result['ai-settings'] || result.aiSettings || {
        provider: 'openai',
        model: 'gpt-4o',
        apiKey: '',
        enabledFeatures: ['smart-search', 'auto-categorize', 'summarize', 'recommendations']
      };

      console.log('📋 AI settings loaded:', {
        provider: this.settings.provider,
        model: this.settings.model,
        hasApiKey: !!this.settings.apiKey,
        enabledFeatures: this.settings.enabledFeatures
      });
    } catch (error) {
      console.error('Failed to load AI settings:', error);
      this.settings = {
        provider: 'openai',
        model: 'gpt-4o',
        apiKey: '',
        enabledFeatures: ['smart-search', 'auto-categorize', 'summarize', 'recommendations']
      };
    }
  }

  // 加载提供商配置
  async loadProviders() {
    try {
      this.providers = {
        openai: {
          name: 'OpenAI',
          apiUrl: 'https://api.openai.com/v1/chat/completions',
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
        siliconflow: {
          name: '硅基流动 (SiliconFlow)',
          apiUrl: 'https://api.siliconflow.cn/v1/chat/completions',
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
            throw new Error('Invalid response format from SiliconFlow API');
          }
        },
        deepseek: {
          name: 'DeepSeek',
          apiUrl: 'https://api.deepseek.com/v1/chat/completions',
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
            throw new Error('Invalid response format from DeepSeek API');
          }
        },
        google: {
          name: 'Google Gemini',
          apiUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
          headers: (apiKey) => ({
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey
          }),
          buildRequest: (messages, model, options = {}) => {
            // Convert OpenAI format to Gemini GenAI SDK format
            const contents = messages.map(msg => {
              if (msg.role === 'system') {
                return {
                  role: 'user',
                  parts: [{ text: `System: ${msg.content}` }]
                };
              }

              return {
                role: msg.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: msg.content }]
              };
            });

            const request = {
              model: model,
              contents: contents,
              generationConfig: {
                temperature: options.temperature || 0.7,
                maxOutputTokens: options.maxTokens || 2000,
                topP: options.topP || 0.95,
                topK: options.topK || 40
              }
            };

            // Adjust parameters for different models
            if (model === 'gemini-2.5-pro') {
              request.generationConfig.maxOutputTokens = options.maxTokens || 4000;
              request.generationConfig.temperature = options.temperature || 0.8;
            } else if (model === 'gemini-2.5-flash-lite') {
              request.generationConfig.maxOutputTokens = options.maxTokens || 1500;
              request.generationConfig.temperature = options.temperature || 0.6;
            }

            return request;
          },
          parseResponse: (response) => {
            // Handle new GenAI SDK response format
            if (response.candidates && response.candidates[0]) {
              const candidate = response.candidates[0];

              if (candidate.content && candidate.content.parts && candidate.content.parts[0]) {
                return candidate.content.parts[0].text;
              }

              if (candidate.text) {
                return candidate.text;
              }
            }

            if (response.text) {
              return response.text;
            }

            if (response.response && response.response.text) {
              return response.response.text();
            }

            throw new Error('Invalid response format from Google Gemini API');
          }
        }
      };
      console.log('🔌 AI providers loaded:', Object.keys(this.providers));
    } catch (error) {
      console.error('Failed to load AI providers:', error);
      this.providers = {};
    }
  }

  // 初始化Web Worker
  async initializeWorker() {
    try {
      // 创建Web Worker
      this.worker = new Worker(chrome.runtime.getURL('ai-worker.js'));
      
      // 设置消息处理
      this.worker.onmessage = (e) => {
        this.handleWorkerMessage(e.data);
      };
      
      this.worker.onerror = (error) => {
        console.error('AI Worker error:', error);
      };
      
      // 初始化Worker
      await this.sendToWorker('initialize', {
        providers: this.providers,
        settings: this.settings
      });
      
      console.log('🔧 AI Worker initialized');
    } catch (error) {
      console.error('Failed to initialize AI Worker:', error);
      throw error;
    }
  }

  // 处理Worker消息
  handleWorkerMessage(data) {
    const { id, success, result, error } = data;
    const pendingRequest = this.pendingRequests.get(id);
    
    if (!pendingRequest) {
      console.warn('Received response for unknown request:', id);
      return;
    }
    
    this.pendingRequests.delete(id);
    
    if (success) {
      pendingRequest.resolve(result);
    } else {
      const errorObj = new Error(error.message);
      errorObj.type = error.type;
      errorObj.status = error.status;
      pendingRequest.reject(errorObj);
    }
  }

  // 向Worker发送消息
  async sendToWorker(type, data, timeout = 30000) {
    if (!this.worker) {
      throw new Error('AI Worker not initialized');
    }
    
    const id = ++this.requestId;
    
    return new Promise((resolve, reject) => {
      // 设置超时
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`AI operation timeout after ${timeout}ms`));
      }, timeout);
      
      // 存储请求
      this.pendingRequests.set(id, {
        resolve: (result) => {
          clearTimeout(timeoutId);
          resolve(result);
        },
        reject: (error) => {
          clearTimeout(timeoutId);
          reject(error);
        }
      });
      
      // 发送消息
      this.worker.postMessage({
        id: id,
        type: type,
        data: data
      });
    });
  }

  // 检查服务可用性
  isAvailable() {
    return this.isInitialized &&
           this.worker &&
           this.settings?.provider &&
           this.settings?.apiKey &&
           this.providers?.[this.settings.provider];
  }

  // Google Gemini专用请求方法
  async requestGemini(messages, options = {}) {
    if (this.settings.provider !== 'google') {
      throw new Error('This method is only for Google Gemini provider');
    }

    const provider = this.providers.google;
    const model = this.settings.model;
    const apiKey = this.settings.apiKey;

    console.log('🔍 AI Service Manager - Gemini request:', {
      model: model,
      messageCount: messages.length,
      newSDKFormat: true
    });

    try {
      // 构建符合新GenAI SDK格式的URL
      const apiUrl = `${provider.apiUrl}/${model}:generateContent?key=${apiKey}`;

      // 使用新的请求格式
      const requestBody = provider.buildRequest(messages, model, options);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
        mode: 'cors'
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Gemini API错误:', {
          status: response.status,
          statusText: response.statusText,
          errorText: errorText
        });
        throw new Error(`Gemini API request failed: ${response.status} ${response.statusText}`);
      }

      const responseData = await response.json();
      console.log('📥 Gemini响应:', responseData);

      return provider.parseResponse(responseData);
    } catch (error) {
      console.error('❌ Gemini请求失败:', error);
      throw error;
    }
  }

  // 生成缓存键
  getCacheKey(operation, data) {
    return `${operation}:${JSON.stringify(data)}`;
  }

  // 获取缓存结果
  getCachedResult(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      console.log('📦 Using cached result for:', key.split(':')[0]);
      return cached.result;
    }
    return null;
  }

  // 设置缓存结果
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

  // 智能搜索（带缓存和回退）
  async smartSearch(query, bookmarks) {
    const cacheKey = this.getCacheKey('smart-search', { query, bookmarkCount: bookmarks.length });
    
    // 检查缓存
    const cached = this.getCachedResult(cacheKey);
    if (cached) {
      return cached;
    }
    
    try {
      if (!this.isAvailable()) {
        throw new Error('AI服务不可用');
      }
      
      const result = await this.sendToWorker('smart-search', {
        query: query,
        bookmarks: bookmarks
      });
      
      // 缓存结果
      this.setCachedResult(cacheKey, result);
      
      return result;
    } catch (error) {
      console.error('Smart search failed:', error);
      
      // 回退到简单搜索
      if (this.fallbackEnabled) {
        console.log('🔄 Falling back to simple search');
        return this.fallbackSearch(query, bookmarks);
      }
      
      throw error;
    }
  }

  // 回退搜索（简单文本匹配）
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

  // 书签分类
  async categorizeBookmarks(bookmarks) {
    try {
      if (!this.isAvailable()) {
        throw new Error('AI服务不可用');
      }
      
      return await this.sendToWorker('categorize', {
        bookmarks: bookmarks
      });
    } catch (error) {
      console.error('Categorization failed:', error);
      throw error;
    }
  }

  // 检测重复
  async detectDuplicates(bookmarks) {
    try {
      if (!this.isAvailable()) {
        throw new Error('AI服务不可用');
      }
      
      return await this.sendToWorker('detect-duplicates', {
        bookmarks: bookmarks
      });
    } catch (error) {
      console.error('Duplicate detection failed:', error);
      throw error;
    }
  }

  // 生成推荐
  async generateRecommendations(bookmarks, context) {
    try {
      if (!this.isAvailable()) {
        throw new Error('AI服务不可用');
      }
      
      return await this.sendToWorker('recommendations', {
        bookmarks: bookmarks,
        context: context
      });
    } catch (error) {
      console.error('Recommendations failed:', error);
      throw error;
    }
  }

  // 更新设置
  async updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    
    try {
      await chrome.storage.local.set({ 'ai-settings': this.settings });
      
      // 重新初始化Worker
      if (this.worker) {
        await this.sendToWorker('initialize', {
          providers: this.providers,
          settings: this.settings
        });
      }
      
      console.log('✅ AI settings updated');
    } catch (error) {
      console.error('Failed to update AI settings:', error);
      throw error;
    }
  }

  // 清理资源
  destroy() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    
    this.pendingRequests.clear();
    this.cache.clear();
    this.isInitialized = false;
    
    console.log('🧹 AI Service Manager destroyed');
  }

  // 获取状态信息
  getStatus() {
    return {
      initialized: this.isInitialized,
      available: this.isAvailable(),
      provider: this.settings?.provider,
      model: this.settings?.model,
      hasApiKey: !!this.settings?.apiKey,
      pendingRequests: this.pendingRequests.size,
      cacheSize: this.cache.size
    };
  }
}

// 导出单例实例
if (typeof window !== 'undefined') {
  window.AIServiceManager = AIServiceManager;
} else if (typeof self !== 'undefined') {
  self.AIServiceManager = AIServiceManager;
}
