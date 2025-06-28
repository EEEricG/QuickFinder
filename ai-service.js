// AI Service Manager for QuickFinder
// 支持多种AI提供商的统一接口

class AIService {
  constructor() {
    this.providers = {
      openai: {
        name: 'OpenAI',
        icon: '🤖',
        description: '业界领先的AI模型提供商',
        apiUrl: 'https://api.openai.com/v1/chat/completions',
        models: [
          {
            id: 'gpt-4o',
            name: 'GPT-4o',
            description: '最新的多模态模型，支持文本、图像和音频'
          },
          {
            id: 'gpt-4o-mini',
            name: 'GPT-4o mini',
            description: '轻量级版本，性价比高，适合大多数任务'
          },
          {
            id: 'gpt-4-turbo',
            name: 'GPT-4 Turbo',
            description: '高性能模型，适合复杂推理任务'
          },
          {
            id: 'gpt-3.5-turbo',
            name: 'GPT-3.5 Turbo',
            description: '经典快速模型，适合简单对话任务'
          },
          {
            id: 'dall-e-3',
            name: 'DALL-E 3',
            description: '图像生成模型（暂不支持）'
          }
        ],
        headers: (apiKey) => ({
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        }),
        buildRequest: (messages, model, options = {}) => {
          const request = {
            model: model,
            messages: messages,
            temperature: options.temperature || 0.7,
            max_tokens: options.maxTokens || 2000
          };

          // 对于不同模型调整参数
          if (model === 'gpt-4o' || model === 'gpt-4-turbo') {
            request.max_tokens = options.maxTokens || 4000;
          } else if (model === 'gpt-4o-mini') {
            request.max_tokens = options.maxTokens || 1500;
          }

          return request;
        },
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
          {
            id: 'gemini-2.5-pro',
            name: 'Gemini 2.5 Pro',
            description: '最新的高性能Gemini模型，支持复杂推理和多模态任务'
          },
          {
            id: 'gemini-2.5-flash',
            name: 'Gemini 2.5 Flash',
            description: '快速响应的Gemini 2.5模型，平衡性能与速度'
          },
          {
            id: 'gemini-2.5-flash-lite-preview-06-17',
            name: 'Gemini 2.5 Flash-Lite Preview 06-17',
            description: 'Gemini 2.5 Flash-Lite预览版，最新功能测试'
          }
        ],
        headers: (apiKey) => ({
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        }),
        buildRequest: (messages, model, options = {}) => {
          // Convert OpenAI format to Gemini GenAI SDK format
          const contents = messages.map(msg => {
            // Handle system messages by converting to user message with context
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

          // Build request compatible with new GenAI SDK format
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

            // Check for content in the response
            if (candidate.content && candidate.content.parts && candidate.content.parts[0]) {
              return candidate.content.parts[0].text;
            }

            // Handle alternative response structure
            if (candidate.text) {
              return candidate.text;
            }
          }

          // Handle direct text response (for some SDK versions)
          if (response.text) {
            return response.text;
          }

          // Handle response with generateContent method result
          if (response.response && response.response.text) {
            return response.response.text();
          }

          throw new Error('Invalid response format from Google Gemini API');
        },
        // New method for GenAI SDK compatibility
        createClient: (apiKey) => {
          // This would be used if we import the SDK directly
          // For now, we'll use the REST API approach
          return {
            apiKey: apiKey,
            baseUrl: 'https://generativelanguage.googleapis.com/v1beta'
          };
        }
      },

      anthropic: {
        name: 'Anthropic',
        icon: '🎭',
        description: 'Anthropic的Claude系列模型',
        apiUrl: 'https://api.anthropic.com/v1/messages',
        models: [
          {
            id: 'claude-3-5-sonnet-20240620',
            name: 'Claude 3.5 Sonnet',
            description: '最新的Claude模型，平衡性能与效率'
          },
          {
            id: 'claude-3-opus-20240229',
            name: 'Claude 3 Opus',
            description: '最强大的Claude模型'
          },
          {
            id: 'claude-3-haiku-20240307',
            name: 'Claude 3 Haiku',
            description: '最快的Claude模型'
          }
        ],
        headers: (apiKey) => ({
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        }),
        buildRequest: (messages, model, options = {}) => {
          // Separate system message from other messages
          const systemMessage = messages.find(m => m.role === 'system');
          const otherMessages = messages.filter(m => m.role !== 'system');

          const request = {
            model: model,
            messages: otherMessages,
            max_tokens: options.maxTokens || 2000
          };

          if (systemMessage) {
            request.system = systemMessage.content;
          }

          return request;
        },
        parseResponse: (response) => {
          if (response.content && response.content[0] && response.content[0].text) {
            return response.content[0].text;
          }
          throw new Error('Invalid response format from Anthropic API');
        }
      },

      mistral: {
        name: 'Mistral AI',
        icon: '🌪️',
        description: '欧洲领先的开源AI模型',
        apiUrl: 'https://api.mistral.ai/v1/chat/completions',
        models: [
          {
            id: 'mistral-large-latest',
            name: 'Mistral Large',
            description: '最强大的Mistral模型'
          },
          {
            id: 'mistral-small-latest',
            name: 'Mistral Small',
            description: '轻量级Mistral模型'
          },
          {
            id: 'codestral-latest',
            name: 'Codestral (代码)',
            description: '专门用于代码生成的模型'
          },
          {
            id: 'open-mistral-7b',
            name: 'Open Mistral (开源)',
            description: '开源版本的Mistral模型'
          }
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
          throw new Error('Invalid response format from Mistral API');
        }
      },

      meta: {
        name: 'Meta',
        icon: '🦙',
        description: 'Meta的Llama系列开源模型',
        apiUrl: 'https://api.together.xyz/v1/chat/completions', // 使用Together AI作为代理
        models: [
          {
            id: 'llama-3-70b-instruct',
            name: 'Llama 3 70B',
            description: '大型Llama 3模型，性能强劲'
          },
          {
            id: 'llama-3-8b-instruct',
            name: 'Llama 3 8B',
            description: '轻量级Llama 3模型'
          }
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
          throw new Error('Invalid response format from Meta API');
        }
      },

      cohere: {
        name: 'Cohere',
        icon: '🧠',
        description: 'Cohere的Command系列模型',
        apiUrl: 'https://api.cohere.ai/v1/chat',
        models: [
          {
            id: 'command-r-plus',
            name: 'Command R+',
            description: '最强大的Command模型'
          },
          {
            id: 'command-r',
            name: 'Command R',
            description: '平衡性能的Command模型'
          },
          {
            id: 'command-light',
            name: 'Command Light',
            description: '轻量级Command模型'
          }
        ],
        headers: (apiKey) => ({
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        }),
        buildRequest: (messages, model, options = {}) => {
          // Convert to Cohere format
          const lastMessage = messages[messages.length - 1];
          const chatHistory = messages.slice(0, -1).map(msg => ({
            role: msg.role === 'assistant' ? 'CHATBOT' : 'USER',
            message: msg.content
          }));

          return {
            model: model,
            message: lastMessage.content,
            chat_history: chatHistory,
            temperature: options.temperature || 0.7,
            max_tokens: options.maxTokens || 2000
          };
        },
        parseResponse: (response) => {
          if (response.text) {
            return response.text;
          }
          throw new Error('Invalid response format from Cohere API');
        }
      },

      zhipu: {
        name: '智谱AI (Zhipu AI)',
        icon: '🧮',
        description: '清华系AI公司，GLM系列模型',
        apiUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
        models: [
          {
            id: 'glm-4',
            name: 'GLM-4',
            description: '智谱AI的旗舰模型'
          },
          {
            id: 'glm-4-plus',
            name: 'GLM-4-Plus',
            description: '增强版GLM-4模型'
          },
          {
            id: 'glm-4v',
            name: 'GLM-4V (视觉)',
            description: '支持视觉理解的多模态模型'
          },
          {
            id: 'glm-4-flash',
            name: 'GLM-4-Flash',
            description: '快速响应版本'
          },
          {
            id: 'glm-3-turbo',
            name: 'GLM-3 Turbo',
            description: '上一代高效模型'
          }
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
          throw new Error('Invalid response format from Zhipu API');
        }
      },

      moonshot: {
        name: '月之暗面 (Moonshot AI)',
        icon: '🌙',
        description: 'Kimi系列长上下文模型',
        apiUrl: 'https://api.moonshot.cn/v1/chat/completions',
        models: [
          {
            id: 'moonshot-v1-128k',
            name: 'Kimi (128k)',
            description: '支持128K上下文的长文本模型'
          },
          {
            id: 'moonshot-v1-32k',
            name: 'Kimi (32k)',
            description: '支持32K上下文的模型'
          },
          {
            id: 'moonshot-v1-8k',
            name: 'Kimi (8k)',
            description: '标准上下文长度模型'
          }
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
          throw new Error('Invalid response format from Moonshot API');
        }
      },

      baidu: {
        name: '百度文心 (Baidu ERNIE)',
        icon: '🐻',
        description: '百度的文心大模型系列',
        apiUrl: 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat',
        models: [
          {
            id: 'ernie-4.5-turbo-128k',
            name: 'ERNIE 4.5 Turbo (128k)',
            description: '最新的文心模型，支持长上下文'
          },
          {
            id: 'ernie-4.0-8k',
            name: 'ERNIE 4.0',
            description: '文心4.0模型'
          },
          {
            id: 'ernie-3.5-8k',
            name: 'ERNIE 3.5',
            description: '文心3.5模型'
          },
          {
            id: 'ernie-speed-128k',
            name: 'ERNIE Speed',
            description: '快速响应版本'
          }
        ],
        headers: (apiKey) => ({
          'Content-Type': 'application/json'
        }),
        buildRequest: (messages, model, options = {}) => ({
          messages: messages,
          temperature: options.temperature || 0.7,
          max_output_tokens: options.maxTokens || 2000
        }),
        parseResponse: (response) => {
          if (response.result) {
            return response.result;
          }
          throw new Error('Invalid response format from Baidu API');
        }
      },

      deepseek: {
        name: 'DeepSeek',
        icon: '🧠',
        description: 'DeepSeek深度求索AI模型',
        apiUrl: 'https://api.deepseek.com/v1/chat/completions',
        models: [
          {
            id: 'deepseek-reasoner',
            name: 'DeepSeek Reasoner',
            description: '具有推理能力的DeepSeek模型'
          },
          {
            id: 'deepseek-chat',
            name: 'DeepSeek Chat',
            description: '对话优化的DeepSeek模型'
          },
          {
            id: 'deepseek-coder',
            name: 'DeepSeek Coder',
            description: '代码生成专用的DeepSeek模型'
          }
        ],
        headers: (apiKey) => ({
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        }),
        buildRequest: (messages, model, options = {}) => {
          const request = {
            model: model,
            messages: messages,
            temperature: options.temperature || 0.7,
            max_tokens: options.maxTokens || 4000,
            stream: false
          };

          // 对于deepseek-reasoner模型，调整默认参数
          if (model === 'deepseek-reasoner') {
            request.max_tokens = options.maxTokens || 8000; // 推理模型需要更多输出空间
            request.temperature = options.temperature || 0.3; // 推理模型使用较低温度
          }

          return request;
        },
        parseResponse: (response) => {
          if (response.choices && response.choices[0] && response.choices[0].message) {
            const message = response.choices[0].message;
            let content = message.content || '';

            // 对于deepseek-reasoner模型，如果有推理内容，可以选择是否包含
            if (message.reasoning_content) {
              // 通常我们只需要最终答案，但可以在调试时包含推理过程
              // content = `推理过程：\n${message.reasoning_content}\n\n最终答案：\n${content}`;
            }

            return content;
          }
          throw new Error('Invalid response format from DeepSeek API');
        }
      },

      alibaba: {
        name: '阿里巴巴通义 (Alibaba Tongyi)',
        icon: '☁️',
        description: '阿里云通义千问系列模型',
        apiUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
        models: [
          {
            id: 'qwen-max',
            name: 'Qwen Max',
            description: '通义千问最强模型'
          },
          {
            id: 'qwen-max-longcontext',
            name: 'Qwen Max LongContext',
            description: '支持长上下文的最强模型'
          },
          {
            id: 'qwen-turbo',
            name: 'Qwen Turbo',
            description: '快速响应的通义模型'
          },
          {
            id: 'qwen-plus',
            name: 'Qwen Plus',
            description: '平衡性能的通义模型'
          },
          {
            id: 'qwen2-72b-instruct',
            name: 'Qwen2 72B Instruct',
            description: '开源版本的大型模型'
          }
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
          throw new Error('Invalid response format from Alibaba API');
        }
      },

      baichuan: {
        name: '百川智能 (Baichuan)',
        icon: '🏔️',
        description: '百川智能大模型系列',
        apiUrl: 'https://api.baichuan-ai.com/v1/chat/completions',
        models: [
          {
            id: 'Baichuan4',
            name: 'Baichuan 4',
            description: '最新的百川4模型'
          },
          {
            id: 'Baichuan3-Turbo',
            name: 'Baichuan 3 Turbo',
            description: '百川3加速版'
          },
          {
            id: 'Baichuan2-Turbo-192k',
            name: 'Baichuan 2 Turbo (192k)',
            description: '支持超长上下文的百川2模型'
          }
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
          throw new Error('Invalid response format from Baichuan API');
        }
      },

      yi: {
        name: '零一万物 (01.AI)',
        icon: '🔮',
        description: '零一万物Yi系列模型',
        apiUrl: 'https://api.lingyiwanwu.com/v1/chat/completions',
        models: [
          {
            id: 'yi-large',
            name: 'Yi-Large',
            description: '大型Yi模型'
          },
          {
            id: 'yi-medium',
            name: 'Yi-Medium',
            description: '中型Yi模型'
          },
          {
            id: 'yi-spark',
            name: 'Yi-Spark',
            description: '轻量级Yi模型'
          },
          {
            id: 'yi-vision',
            name: 'Yi-Vision',
            description: '支持视觉的Yi模型'
          }
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
          throw new Error('Invalid response format from Yi API');
        }
      },

      tencent: {
        name: '腾讯混元 (Tencent Hunyuan)',
        icon: '🐧',
        description: '腾讯混元大模型系列',
        apiUrl: 'https://hunyuan.tencentcloudapi.com/v1/chat/completions',
        models: [
          {
            id: 'hunyuan-pro',
            name: 'Hunyuan Pro',
            description: '混元专业版模型'
          },
          {
            id: 'hunyuan-standard',
            name: 'Hunyuan Standard',
            description: '混元标准版模型'
          },
          {
            id: 'hunyuan-lite',
            name: 'Hunyuan Lite',
            description: '混元轻量版模型'
          }
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
          throw new Error('Invalid response format from Tencent API');
        }
      },

      // 保留硅基流动作为兼容性选项
      siliconflow: {
        name: '硅基流动 (SiliconFlow)',
        icon: '🔥',
        description: '免费AI模型代理服务',
        apiUrl: 'https://api.siliconflow.cn/v1/chat/completions',
        models: [
          {
            id: 'deepseek-ai/DeepSeek-V3',
            name: 'DeepSeek-V3 (硅基)',
            description: '硅基流动提供的DeepSeek-V3，稳定可靠'
          },
          {
            id: 'Qwen/Qwen2.5-72B-Instruct',
            name: 'Qwen2.5-72B (硅基)',
            description: '硅基流动提供的通义千问2.5-72B'
          },
          {
            id: 'meta-llama/Llama-3.1-70B-Instruct',
            name: 'Llama-3.1-70B (硅基)',
            description: '硅基流动提供的Llama-3.1-70B'
          }
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
    
    this.settings = null;
    this.loadSettings();
  }
  
  // 加载AI设置
  async loadSettings() {
    try {
      // Check if Chrome storage API is available
      if (typeof chrome === 'undefined' || !chrome.storage) {
        console.error('❌ Chrome storage API not available');
        throw new Error('Chrome storage API not available');
      }

      // Try local storage first, then sync storage as fallback
      let result = {};
      try {
        result = await chrome.storage.local.get(['aiSettings']);
        console.log('📖 Local storage result:', result);
      } catch (localError) {
        console.warn('⚠️ Local storage failed:', localError);
      }

      if (!result.aiSettings) {
        console.log('🔄 AI settings not found in local storage, trying sync storage...');
        try {
          result = await chrome.storage.sync.get(['aiSettings']);
          console.log('📖 Sync storage result:', result);
        } catch (syncError) {
          console.warn('⚠️ Sync storage failed:', syncError);
        }
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
      console.log('🔧 Using default AI settings');
    }
  }
  
  // 保存AI设置
  async saveSettings(settings) {
    try {
      // Check if Chrome storage API is available
      if (typeof chrome === 'undefined' || !chrome.storage) {
        console.error('❌ Chrome storage API not available');
        throw new Error('Chrome storage API not available');
      }

      this.settings = { ...this.settings, ...settings };

      // Save to both local and sync storage with error handling
      const savePromises = [];

      try {
        savePromises.push(chrome.storage.local.set({ aiSettings: this.settings }));
      } catch (localError) {
        console.warn('⚠️ Local storage save failed:', localError);
      }

      try {
        savePromises.push(chrome.storage.sync.set({ aiSettings: this.settings }));
      } catch (syncError) {
        console.warn('⚠️ Sync storage save failed:', syncError);
      }

      if (savePromises.length === 0) {
        throw new Error('No storage methods available');
      }

      await Promise.allSettled(savePromises);
      console.log('✅ AI settings saved successfully:', this.settings);
      return true;
    } catch (error) {
      console.error('❌ Error saving AI settings:', error);
      return false;
    }
  }
  
  // 检查功能是否启用
  isFeatureEnabled(feature) {
    return this.settings?.enabledFeatures?.includes(feature) || false;
  }
  
  // 检查AI服务是否可用
  isAvailable() {
    return this.settings?.apiKey && this.settings?.provider && this.providers[this.settings.provider];
  }
  
  // 获取当前提供商信息
  getCurrentProvider() {
    return this.providers[this.settings?.provider];
  }
  
  // 获取当前模型信息
  getCurrentModel() {
    const provider = this.getCurrentProvider();
    return provider?.models.find(m => m.id === this.settings?.model);
  }
  
  // Google Gemini专用请求方法（支持新的GenAI SDK格式）
  async requestGemini(messages, options = {}) {
    if (this.settings.provider !== 'google') {
      throw new Error('This method is only for Google Gemini provider');
    }

    const provider = this.getCurrentProvider();
    const model = this.settings.model;
    const apiKey = this.settings.apiKey;

    console.log('🔍 发起Gemini API请求:', {
      model: model,
      messageCount: messages.length,
      newSDKFormat: true
    });

    try {
      // 构建符合新GenAI SDK格式的URL
      const apiUrl = `${provider.apiUrl}/${model}:generateContent?key=${apiKey}`;

      // 使用新的请求格式
      const requestBody = provider.buildRequest(messages, model, options);

      console.log('📡 Gemini请求详情:', {
        url: apiUrl,
        method: 'POST',
        bodyStructure: Object.keys(requestBody)
      });

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

  // 统一的AI请求接口
  async request(messages, options = {}) {
    if (!this.isAvailable()) {
      console.error('❌ AI服务不可用:', {
        hasApiKey: !!this.settings?.apiKey,
        hasProvider: !!this.settings?.provider,
        provider: this.settings?.provider,
        hasProviderConfig: !!this.providers[this.settings?.provider]
      });
      throw new Error('AI服务未配置或不可用');
    }

    // 对于Google Gemini，使用专用的请求方法
    if (this.settings.provider === 'google') {
      return await this.requestGemini(messages, options);
    }

    const provider = this.getCurrentProvider();
    const model = this.settings.model;
    const apiKey = this.settings.apiKey;

    console.log('🚀 发起AI请求:', {
      provider: this.settings.provider,
      model: model,
      apiUrl: provider.apiUrl,
      messageCount: messages.length,
      hasApiKey: !!apiKey
    });

    try {
      const headers = provider.headers(apiKey);
      const requestBody = provider.buildRequest(messages, model, options);

      console.log('📡 请求详情:', {
        url: provider.apiUrl,
        method: 'POST',
        headers: Object.keys(headers),
        bodySize: JSON.stringify(requestBody).length
      });

      const response = await fetch(provider.apiUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(requestBody),
        mode: 'cors'
      });

      console.log('📥 响应状态:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API响应错误:', {
          status: response.status,
          statusText: response.statusText,
          errorText: errorText
        });

        let errorData = {};
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          errorData = { message: errorText };
        }

        throw new Error(`API请求失败: ${response.status} - ${errorData.error?.message || errorData.message || response.statusText}`);
      }

      const data = await response.json();
      console.log('✅ API响应成功:', {
        hasData: !!data,
        dataKeys: Object.keys(data)
      });

      return provider.parseResponse(data);
    } catch (error) {
      console.error('❌ AI请求错误:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
  
  // 智能搜索
  async smartSearch(query, bookmarks) {
    if (!this.isFeatureEnabled('smart-search')) {
      return null;
    }

    const messages = [
      {
        role: 'system',
        content: `你是一个智能书签搜索助手。请根据用户的查询意图，从书签列表中找出最相关的书签。

请严格按照以下JSON格式返回结果：
{
  "matches": [
    {
      "id": "书签ID",
      "title": "书签标题",
      "url": "书签URL",
      "relevanceScore": 0.95,
      "reason": "匹配原因"
    }
  ],
  "totalMatches": 数量
}

只返回JSON，不要包含其他文字说明。`
      },
      {
        role: 'user',
        content: `用户查询: "${query}"

书签数据：
${JSON.stringify(bookmarks.slice(0, 30).map(b => ({
  id: b.id,
  title: b.title,
  url: b.url,
  type: b.type
})), null, 2)}

请找出与查询最相关的书签。`
      }
    ];

    try {
      const response = await this.request(messages, { maxTokens: 2000 });

      // 尝试解析JSON响应
      let result;
      try {
        // 清理响应中可能的额外文本
        const cleanResponse = response.trim();
        const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? jsonMatch[0] : cleanResponse;
        result = JSON.parse(jsonStr);
      } catch (parseError) {
        console.error('JSON解析失败，原始响应:', response);
        // 如果JSON解析失败，返回空结果
        return { matches: [], totalMatches: 0 };
      }

      // 验证结果格式
      if (result && result.matches && Array.isArray(result.matches)) {
        return result;
      } else {
        console.error('AI返回的结果格式不正确:', result);
        return { matches: [], totalMatches: 0 };
      }
    } catch (error) {
      console.error('智能搜索失败:', error);
      return null;
    }
  }
  
  // 自动分类
  async categorizeBookmarks(bookmarks) {
    if (!this.isFeatureEnabled('auto-categorize')) {
      return null;
    }

    const messages = [
      {
        role: 'system',
        content: `你是一个书签分类专家。请分析用户的书签，建议合适的分类和文件夹结构。

请返回JSON格式的结果，包含以下结构：
{
  "suggestedFolders": [
    {
      "name": "文件夹名称",
      "description": "文件夹描述",
      "bookmarks": ["书签ID1", "书签ID2"]
    }
  ],
  "uncategorized": ["未分类的书签ID"],
  "duplicates": [
    {
      "title": "重复书签标题",
      "bookmarks": ["重复书签ID1", "重复书签ID2"]
    }
  ],
  "recommendations": "整体建议和说明"
}`
      },
      {
        role: 'user',
        content: `请分析这些书签并建议分类：

书签数据：
${JSON.stringify(bookmarks.map(b => ({
  id: b.id,
  title: b.title,
  url: b.url,
  type: b.type
})), null, 2)}

请根据书签的标题、URL和内容特征，建议合理的文件夹分类。`
      }
    ];

    try {
      const response = await this.request(messages);
      return JSON.parse(response);
    } catch (error) {
      console.error('自动分类失败:', error);
      return null;
    }
  }

  // 检测重复书签
  async detectDuplicateBookmarks(bookmarks) {
    if (!this.isFeatureEnabled('auto-categorize')) {
      return null;
    }

    const messages = [
      {
        role: 'system',
        content: `你是一个书签清理专家。请分析书签列表，找出重复或相似的书签。

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
      console.error('检测重复书签失败:', error);
      return null;
    }
  }

  // 建议文件夹结构
  async suggestFolderStructure(bookmarks) {
    if (!this.isFeatureEnabled('auto-categorize')) {
      return null;
    }

    const messages = [
      {
        role: 'system',
        content: `你是一个信息架构专家。基于用户的书签集合，建议一个清晰、逻辑性强的文件夹结构。

返回JSON格式：
{
  "structure": [
    {
      "name": "主文件夹名",
      "description": "文件夹用途描述",
      "subfolders": [
        {
          "name": "子文件夹名",
          "description": "子文件夹描述",
          "estimatedBookmarks": 数量
        }
      ],
      "estimatedBookmarks": 数量
    }
  ],
  "principles": ["组织原则1", "组织原则2"],
  "benefits": "这种结构的优势"
}`
      },
      {
        role: 'user',
        content: `基于以下书签，建议一个合理的文件夹结构：
${JSON.stringify(bookmarks.slice(0, 50).map(b => ({
  title: b.title,
  url: b.url,
  type: b.type
})), null, 2)}`
      }
    ];

    try {
      const response = await this.request(messages);
      return JSON.parse(response);
    } catch (error) {
      console.error('建议文件夹结构失败:', error);
      return null;
    }
  }
  
  // 生成摘要
  async generateSummary(url, title, content) {
    if (!this.isFeatureEnabled('summarize')) {
      return null;
    }

    const messages = [
      {
        role: 'system',
        content: `你是一个内容摘要专家。请为给定的网页内容生成简洁的摘要和关键信息。

返回JSON格式：
{
  "summary": "2-3句话的简洁摘要",
  "keyPoints": ["关键点1", "关键点2", "关键点3"],
  "tags": ["标签1", "标签2", "标签3"],
  "category": "内容类别",
  "contentType": "文章|工具|文档|视频|其他",
  "difficulty": "初级|中级|高级",
  "estimatedReadTime": "预计阅读时间（分钟）",
  "relevantTopics": ["相关主题1", "相关主题2"]
}`
      },
      {
        role: 'user',
        content: `请为以下网页生成详细摘要：

标题: ${title}
URL: ${url}
内容: ${content ? content.substring(0, 3000) : '无法获取内容'}

请分析内容的主要信息、关键点和价值，生成有用的摘要。`
      }
    ];

    try {
      const response = await this.request(messages);
      return JSON.parse(response);
    } catch (error) {
      console.error('生成摘要失败:', error);
      return null;
    }
  }

  // 批量生成书签摘要
  async generateBookmarksSummary(bookmarks) {
    if (!this.isFeatureEnabled('summarize')) {
      return null;
    }

    const messages = [
      {
        role: 'system',
        content: `你是一个书签分析专家。请为书签列表生成摘要分析。

返回JSON格式：
{
  "overview": "整体概述",
  "categories": [
    {
      "name": "类别名称",
      "count": 数量,
      "description": "类别描述"
    }
  ],
  "topDomains": [
    {
      "domain": "域名",
      "count": 数量,
      "type": "网站类型"
    }
  ],
  "insights": ["洞察1", "洞察2"],
  "recommendations": ["建议1", "建议2"]
}`
      },
      {
        role: 'user',
        content: `请分析以下书签集合：

书签数据：
${JSON.stringify(bookmarks.slice(0, 50).map(b => ({
  title: b.title,
  url: b.url,
  type: b.type
})), null, 2)}

请提供整体分析和有用的洞察。`
      }
    ];

    try {
      const response = await this.request(messages);
      return JSON.parse(response);
    } catch (error) {
      console.error('生成书签摘要失败:', error);
      return null;
    }
  }

  // 提取网页关键信息
  async extractKeyInfo(url, title, content) {
    if (!this.isFeatureEnabled('summarize')) {
      return null;
    }

    const messages = [
      {
        role: 'system',
        content: `你是一个信息提取专家。请从网页内容中提取关键信息。

返回JSON格式：
{
  "mainTopic": "主要话题",
  "keyTerms": ["关键术语1", "关键术语2"],
  "actionItems": ["可执行项目1", "可执行项目2"],
  "resources": ["相关资源1", "相关资源2"],
  "prerequisites": ["前置知识1", "前置知识2"],
  "targetAudience": "目标受众",
  "lastUpdated": "最后更新时间（如果能识别）",
  "credibility": "可信度评估"
}`
      },
      {
        role: 'user',
        content: `请从以下网页中提取关键信息：

标题: ${title}
URL: ${url}
内容: ${content ? content.substring(0, 2500) : '无法获取内容'}

请识别和提取最重要的信息点。`
      }
    ];

    try {
      const response = await this.request(messages);
      return JSON.parse(response);
    } catch (error) {
      console.error('提取关键信息失败:', error);
      return null;
    }
  }
  
  // 个性化推荐
  async getRecommendations(userBookmarks, currentContext) {
    if (!this.isFeatureEnabled('recommendations')) {
      return null;
    }

    const messages = [
      {
        role: 'system',
        content: `你是一个个性化推荐专家。基于用户的书签历史和当前上下文，提供智能推荐。

返回JSON格式：
{
  "relatedBookmarks": [
    {
      "id": "书签ID",
      "title": "书签标题",
      "reason": "推荐原因",
      "relevanceScore": 0.95
    }
  ],
  "suggestedSearches": ["建议搜索1", "建议搜索2"],
  "topicRecommendations": [
    {
      "topic": "主题名称",
      "description": "主题描述",
      "bookmarks": ["相关书签ID1", "相关书签ID2"]
    }
  ],
  "learningPath": [
    {
      "step": 1,
      "title": "学习步骤标题",
      "bookmarks": ["书签ID1", "书签ID2"],
      "description": "步骤描述"
    }
  ],
  "insights": ["洞察1", "洞察2"],
  "nextActions": ["建议行动1", "建议行动2"]
}`
      },
      {
        role: 'user',
        content: `基于用户的书签模式和当前上下文，提供个性化推荐：

用户书签数据：
${JSON.stringify(userBookmarks.slice(0, 20).map(b => ({
  id: b.id,
  title: b.title,
  url: b.url,
  type: b.type
})), null, 2)}

当前上下文：
- 当前页面：${currentContext}
- 时间：${new Date().toLocaleString()}

请分析用户的兴趣模式，推荐相关书签和有用建议。`
      }
    ];

    try {
      const response = await this.request(messages);
      return JSON.parse(response);
    } catch (error) {
      console.error('获取推荐失败:', error);
      return null;
    }
  }

  // 发现遗忘的书签
  async discoverForgottenBookmarks(userBookmarks, recentHistory) {
    if (!this.isFeatureEnabled('recommendations')) {
      return null;
    }

    const messages = [
      {
        role: 'system',
        content: `你是一个书签发现专家。分析用户的书签和最近浏览历史，找出可能被遗忘但有价值的书签。

返回JSON格式：
{
  "forgottenGems": [
    {
      "id": "书签ID",
      "title": "书签标题",
      "lastAccessed": "最后访问时间",
      "potentialValue": "潜在价值描述",
      "relevanceToday": "今日相关性",
      "rediscoveryReason": "重新发现的原因"
    }
  ],
  "categories": [
    {
      "name": "类别名称",
      "bookmarks": ["书签ID1", "书签ID2"],
      "whyRelevant": "为什么现在相关"
    }
  ],
  "summary": "发现总结"
}`
      },
      {
        role: 'user',
        content: `请分析用户的书签，找出可能被遗忘的有价值内容：

用户书签：
${JSON.stringify(userBookmarks.slice(0, 30).map(b => ({
  id: b.id,
  title: b.title,
  url: b.url,
  dateAdded: b.dateAdded
})), null, 2)}

最近浏览历史：
${JSON.stringify(recentHistory.slice(0, 10).map(h => ({
  title: h.title,
  url: h.url,
  lastVisitTime: h.lastVisitTime
})), null, 2)}

请找出长期未访问但可能有价值的书签。`
      }
    ];

    try {
      const response = await this.request(messages);
      return JSON.parse(response);
    } catch (error) {
      console.error('发现遗忘书签失败:', error);
      return null;
    }
  }

  // 兴趣模式分析
  async analyzeInterestPatterns(userBookmarks, recentHistory) {
    if (!this.isFeatureEnabled('recommendations')) {
      return null;
    }

    const messages = [
      {
        role: 'system',
        content: `你是一个用户行为分析专家。分析用户的书签和浏览模式，识别兴趣趋势。

返回JSON格式：
{
  "primaryInterests": [
    {
      "topic": "主要兴趣",
      "confidence": 0.95,
      "evidence": ["证据1", "证据2"],
      "trend": "上升|稳定|下降"
    }
  ],
  "emergingInterests": [
    {
      "topic": "新兴兴趣",
      "confidence": 0.75,
      "indicators": ["指标1", "指标2"]
    }
  ],
  "behaviorPatterns": [
    {
      "pattern": "行为模式",
      "description": "模式描述",
      "frequency": "频率"
    }
  ],
  "recommendations": [
    {
      "type": "推荐类型",
      "suggestion": "具体建议",
      "reasoning": "推荐理由"
    }
  ],
  "insights": ["洞察1", "洞察2"]
}`
      },
      {
        role: 'user',
        content: `请分析用户的兴趣模式和行为趋势：

书签数据：
${JSON.stringify(userBookmarks.slice(0, 25), null, 2)}

浏览历史：
${JSON.stringify(recentHistory.slice(0, 15), null, 2)}

请识别用户的兴趣模式、行为趋势和潜在需求。`
      }
    ];

    try {
      const response = await this.request(messages);
      return JSON.parse(response);
    } catch (error) {
      console.error('分析兴趣模式失败:', error);
      return null;
    }
  }
}

// 导出AI服务类
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AIService;
} else if (typeof window !== 'undefined') {
  window.AIService = AIService;
} else if (typeof self !== 'undefined') {
  self.AIService = AIService;
} else if (typeof globalThis !== 'undefined') {
  globalThis.AIService = AIService;
}

// 创建全局AI服务实例（在需要时）
if (typeof window !== 'undefined') {
  window.aiService = new AIService();
}
