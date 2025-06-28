// Options page script for QuickFinder AI Settings

let currentLanguage = 'zh'; // Default to Chinese
let aiService = null; // AI service instance

// 备用提供商数据，防止ai-service.js加载失败
const FALLBACK_PROVIDERS = {
  openai: {
    name: 'OpenAI',
    icon: '🤖',
    description: '业界领先的AI模型提供商',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', description: '最新的多模态模型' },
      { id: 'gpt-4o-mini', name: 'GPT-4o mini', description: '轻量级版本，性价比高' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: '高性能模型' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: '经典快速模型' }
    ]
  },
  google: {
    name: 'Google',
    icon: '🔍',
    description: 'Google的Gemini系列模型',
    models: [
      { id: 'gemini-1.5-pro-latest', name: 'Gemini 1.5 Pro', description: '最强大的Gemini模型' },
      { id: 'gemini-1.5-flash-latest', name: 'Gemini 1.5 Flash', description: '快速响应的Gemini模型' },
      { id: 'gemini-pro', name: 'Gemini 1.0 Pro', description: '稳定的Gemini模型' }
    ]
  },
  anthropic: {
    name: 'Anthropic',
    icon: '🎭',
    description: 'Anthropic的Claude系列模型',
    models: [
      { id: 'claude-3-5-sonnet-20240620', name: 'Claude 3.5 Sonnet', description: '最新的Claude模型' },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', description: '最强大的Claude模型' },
      { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', description: '最快的Claude模型' }
    ]
  },
  zhipu: {
    name: '智谱AI (Zhipu AI)',
    icon: '🧮',
    description: '清华系AI公司，GLM系列模型',
    models: [
      { id: 'glm-4', name: 'GLM-4', description: '智谱AI的旗舰模型' },
      { id: 'glm-4-plus', name: 'GLM-4-Plus', description: '增强版GLM-4模型' },
      { id: 'glm-4v', name: 'GLM-4V (视觉)', description: '支持视觉理解的多模态模型' }
    ]
  },
  moonshot: {
    name: '月之暗面 (Moonshot AI)',
    icon: '🌙',
    description: 'Kimi系列长上下文模型',
    models: [
      { id: 'moonshot-v1-128k', name: 'Kimi (128k)', description: '支持128K上下文的长文本模型' },
      { id: 'moonshot-v1-32k', name: 'Kimi (32k)', description: '支持32K上下文的模型' },
      { id: 'moonshot-v1-8k', name: 'Kimi (8k)', description: '标准上下文长度模型' }
    ]
  },
  siliconflow: {
    name: '硅基流动 (SiliconFlow)',
    icon: '🔥',
    description: '免费AI模型代理服务',
    models: [
      { id: 'deepseek-ai/DeepSeek-V3', name: 'DeepSeek-V3 (硅基)', description: '硅基流动提供的DeepSeek-V3' },
      { id: 'Qwen/Qwen2.5-72B-Instruct', name: 'Qwen2.5-72B (硅基)', description: '硅基流动提供的通义千问2.5-72B' }
    ]
  },
  doubao: {
    name: '豆包 (Doubao)',
    icon: '🫘',
    description: '字节跳动旗下AI助手，基于云雀模型',
    models: [
      { id: 'doubao-pro-4k', name: 'Doubao Pro (4K)', description: '豆包专业版，4K上下文' },
      { id: 'doubao-pro-32k', name: 'Doubao Pro (32K)', description: '豆包专业版，32K长上下文' },
      { id: 'doubao-pro-128k', name: 'Doubao Pro (128K)', description: '豆包专业版，128K超长上下文' },
      { id: 'doubao-lite-4k', name: 'Doubao Lite (4K)', description: '豆包轻量版，快速响应' },
      { id: 'doubao-lite-32k', name: 'Doubao Lite (32K)', description: '豆包轻量版，32K上下文' },
      { id: 'doubao-lite-128k', name: 'Doubao Lite (128K)', description: '豆包轻量版，128K长上下文' }
    ]
  },
  qwen: {
    name: '通义千问 (Qwen)',
    icon: '🤔',
    description: '阿里云旗下大语言模型',
    models: [
      { id: 'qwen-turbo', name: 'Qwen Turbo', description: '通义千问高速版，响应快速' },
      { id: 'qwen-plus', name: 'Qwen Plus', description: '通义千问增强版，能力均衡' },
      { id: 'qwen-max', name: 'Qwen Max', description: '通义千问旗舰版，性能最强' },
      { id: 'qwen-max-longcontext', name: 'Qwen Max (长文本)', description: '支持超长上下文的旗舰版' },
      { id: 'qwen2.5-72b-instruct', name: 'Qwen2.5-72B', description: '通义千问2.5系列72B参数模型' },
      { id: 'qwen2.5-32b-instruct', name: 'Qwen2.5-32B', description: '通义千问2.5系列32B参数模型' },
      { id: 'qwen2.5-14b-instruct', name: 'Qwen2.5-14B', description: '通义千问2.5系列14B参数模型' },
      { id: 'qwen2.5-7b-instruct', name: 'Qwen2.5-7B', description: '通义千问2.5系列7B参数模型' }
    ]
  },
  baidu: {
    name: '百度文心 (ERNIE)',
    icon: '🐻',
    description: '百度文心大模型系列',
    models: [
      { id: 'ernie-4.0-8k', name: 'ERNIE 4.0 (8K)', description: '文心大模型4.0，8K上下文' },
      { id: 'ernie-4.0-8k-preview', name: 'ERNIE 4.0 Preview', description: '文心大模型4.0预览版' },
      { id: 'ernie-3.5-8k', name: 'ERNIE 3.5 (8K)', description: '文心大模型3.5，8K上下文' },
      { id: 'ernie-3.5-8k-preview', name: 'ERNIE 3.5 Preview', description: '文心大模型3.5预览版' },
      { id: 'ernie-turbo-8k', name: 'ERNIE Turbo (8K)', description: '文心大模型Turbo版，快速响应' },
      { id: 'ernie-speed-8k', name: 'ERNIE Speed (8K)', description: '文心大模型Speed版，极速响应' },
      { id: 'ernie-lite-8k', name: 'ERNIE Lite (8K)', description: '文心大模型轻量版' }
    ]
  },
  spark: {
    name: '讯飞星火 (Spark)',
    icon: '✨',
    description: '科大讯飞星火认知大模型',
    models: [
      { id: 'spark-max', name: 'Spark Max', description: '星火大模型Max版，最强性能' },
      { id: 'spark-pro', name: 'Spark Pro', description: '星火大模型Pro版，专业级能力' },
      { id: 'spark-lite', name: 'Spark Lite', description: '星火大模型Lite版，轻量高效' },
      { id: 'spark-4.0-ultra', name: 'Spark 4.0 Ultra', description: '星火4.0超强版' },
      { id: 'spark-3.5', name: 'Spark 3.5', description: '星火3.5版本，稳定可靠' }
    ]
  },
  minimax: {
    name: 'MiniMax',
    icon: '🚀',
    description: 'MiniMax公司的ABAB系列模型',
    models: [
      { id: 'abab6.5s-chat', name: 'ABAB 6.5s', description: 'MiniMax ABAB 6.5s 对话模型' },
      { id: 'abab6.5g-chat', name: 'ABAB 6.5g', description: 'MiniMax ABAB 6.5g 通用模型' },
      { id: 'abab6.5t-chat', name: 'ABAB 6.5t', description: 'MiniMax ABAB 6.5t Turbo模型' },
      { id: 'abab5.5s-chat', name: 'ABAB 5.5s', description: 'MiniMax ABAB 5.5s 对话模型' },
      { id: 'abab5.5-chat', name: 'ABAB 5.5', description: 'MiniMax ABAB 5.5 基础模型' }
    ]
  }
};

// Check if Chrome extension APIs are available
function checkChromeAPIs() {
  if (typeof chrome === 'undefined') {
    console.error('❌ Chrome extension APIs not available');
    return false;
  }

  if (!chrome.storage) {
    console.error('❌ Chrome storage API not available');
    return false;
  }

  console.log('✅ Chrome extension APIs available');
  return true;
}

// Safe storage operations with error handling
async function safeStorageGet(keys, useSync = true) {
  try {
    if (!checkChromeAPIs()) {
      throw new Error('Chrome APIs not available');
    }

    const storage = useSync ? chrome.storage.sync : chrome.storage.local;
    const result = await storage.get(keys);
    console.log('📖 Storage get successful:', keys, result);
    return result;
  } catch (error) {
    console.error('❌ Storage get failed:', error);
    return {};
  }
}

async function safeStorageSet(data, useSync = true) {
  try {
    if (!checkChromeAPIs()) {
      throw new Error('Chrome APIs not available');
    }

    const storage = useSync ? chrome.storage.sync : chrome.storage.local;
    await storage.set(data);
    console.log('💾 Storage set successful:', data);
    return true;
  } catch (error) {
    console.error('❌ Storage set failed:', error);
    return false;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 Options page loading...');

  // Check Chrome APIs first
  if (!checkChromeAPIs()) {
    showStatus('error', 'Chrome extension APIs not available. Please reload the extension.');
    return;
  }

  try {
    // Load saved language preference with error handling
    const result = await safeStorageGet(['language']);
    currentLanguage = result.language || 'zh';
    updateLanguage();
  } catch (error) {
    console.error('❌ Failed to load language preference:', error);
    // Continue with default language
  }

  // Add fallback mechanism with retry
  let initializationAttempts = 0;
  const maxAttempts = 3;

  async function attemptInitialization() {
    initializationAttempts++;
    console.log(`🔄 Initialization attempt ${initializationAttempts}/${maxAttempts}`);

    try {
      await initializeAIServiceAndUI();
      return true;
    } catch (error) {
      console.error(`❌ Initialization attempt ${initializationAttempts} failed:`, error);

      if (initializationAttempts < maxAttempts) {
        console.log(`⏳ Retrying in ${initializationAttempts * 1000}ms...`);
        await new Promise(resolve => setTimeout(resolve, initializationAttempts * 1000));
        return attemptInitialization();
      } else {
        console.error('❌ All initialization attempts failed');
        showStatus('error', 'Failed to initialize AI settings. Please reload the page.');
        return false;
      }
    }
  }

  await attemptInitialization();
});

// Separate initialization function for better error handling
async function initializeAIServiceAndUI() {

  // Initialize AI service instance
  if (typeof AIService === 'undefined') {
    console.warn('⚠️ AIService class not found. Using fallback providers.');
    aiService = null;
  } else {
    try {
      console.log('🚀 Initializing AI service...');
      aiService = new AIService();
      await aiService.loadSettings();

      // Verify providers are available
      if (!aiService.providers || Object.keys(aiService.providers).length === 0) {
        console.warn('⚠️ AI providers not loaded correctly, using fallback');
        aiService = null;
      } else {
        console.log('✅ AI service initialized successfully');
        console.log('📋 Available providers:', Object.keys(aiService.providers));
      }
    } catch (error) {
      console.warn('⚠️ AI service initialization failed, using fallback:', error);
      aiService = null;
    }
  }

  // Setup UI regardless of AI service status
  setupProviderOptions();
  setupEventListeners();
  await loadCurrentSettings();

  // Verify everything is working correctly
  setTimeout(() => {
    verifyInitialization();
  }, 200);

  console.log('✅ UI setup completed successfully');
}

function setupProviderOptions() {
  console.log('🔧 Setting up provider options...');

  const providerSelect = document.getElementById('ai-provider');
  const modelSelect = document.getElementById('ai-model');
  const modelInfo = document.getElementById('model-info');
  const providerInfo = document.getElementById('provider-info');

  if (!providerSelect || !modelSelect) {
    console.error('❌ Required DOM elements not found');
    throw new Error('Required DOM elements not found');
  }

  // Use fallback providers if aiService is not available
  if (!aiService || !aiService.providers) {
    console.warn('⚠️ AI service not available during setup, using fallback providers');
  }

  // Populate provider options first
  populateProviderOptions();

  // Initial setup - populate models for default provider
  updateModelOptions();
  updateModelInfo();
  updateProviderInfo();

  console.log('✅ Provider options setup completed');
}

// Add new function to populate provider options
function populateProviderOptions() {
  console.log('📋 Populating provider options...');

  const providerSelect = document.getElementById('ai-provider');

  if (!providerSelect) {
    console.error('❌ Provider select element not found');
    return;
  }

  // Clear existing options
  providerSelect.innerHTML = '';

  // 使用AI服务的提供商数据，如果不可用则使用备用数据
  let providersData = null;
  if (aiService && aiService.providers) {
    providersData = aiService.providers;
    console.log('✅ Using AI service providers data');
  } else {
    providersData = FALLBACK_PROVIDERS;
    console.log('⚠️ AI service not available, using fallback providers data');
  }

  // Add provider options in preferred order
  const providerOrder = ['siliconflow', 'doubao', 'qwen', 'baidu', 'openai', 'google', 'anthropic', 'zhipu', 'moonshot', 'spark', 'minimax'];

  // 按优先顺序添加提供商
  providerOrder.forEach(providerKey => {
    if (providersData[providerKey]) {
      const provider = providersData[providerKey];
      const option = document.createElement('option');
      option.value = providerKey;
      option.textContent = `${provider.icon || '🤖'} ${provider.name}`;
      providerSelect.appendChild(option);
    }
  });

  // Add any remaining providers not in the preferred order
  Object.keys(providersData).forEach(providerKey => {
    if (!providerOrder.includes(providerKey)) {
      const provider = providersData[providerKey];
      const option = document.createElement('option');
      option.value = providerKey;
      option.textContent = `${provider.icon || '🤖'} ${provider.name}`;
      providerSelect.appendChild(option);
    }
  });

  console.log(`✅ Populated ${providerSelect.options.length} providers`);

  // 如果没有选中的提供商，默认选择第一个
  if (providerSelect.options.length > 0 && !providerSelect.value) {
    providerSelect.value = providerSelect.options[0].value;
    console.log(`🔧 Set default provider to: ${providerSelect.value}`);
  }
}

function updateModelOptions() {
  console.log('🔄 Updating model options...');

  const providerSelect = document.getElementById('ai-provider');
  const modelSelect = document.getElementById('ai-model');

  if (!providerSelect || !modelSelect) {
    console.error('❌ Provider or model select elements not found');
    return;
  }

  const selectedProvider = providerSelect.value;
  console.log('📍 Selected provider:', selectedProvider);

  // Clear existing options
  modelSelect.innerHTML = '';

  // 使用AI服务的提供商数据，如果不可用则使用备用数据
  let providersData = null;
  if (aiService && aiService.providers) {
    providersData = aiService.providers;
    console.log('✅ Using AI service providers data for models');
  } else {
    providersData = FALLBACK_PROVIDERS;
    console.log('⚠️ AI service not available, using fallback providers data for models');
  }

  // Get provider info
  const provider = providersData[selectedProvider];
  if (provider && provider.models && Array.isArray(provider.models)) {
    provider.models.forEach(model => {
      const option = document.createElement('option');
      option.value = model.id;
      option.textContent = model.name;
      modelSelect.appendChild(option);
    });
    console.log(`✅ Loaded ${provider.models.length} models for provider: ${selectedProvider}`);
  } else {
    console.warn(`⚠️ No models found for provider: ${selectedProvider}`);
    // Add a placeholder option
    const placeholderOption = document.createElement('option');
    placeholderOption.value = '';
    placeholderOption.textContent = 'No models available';
    placeholderOption.disabled = true;
    modelSelect.appendChild(placeholderOption);
  }

  // 如果没有选中的模型，默认选择第一个
  if (modelSelect.options.length > 0 && !modelSelect.value && !modelSelect.options[0].disabled) {
    modelSelect.value = modelSelect.options[0].value;
    console.log(`🔧 Set default model to: ${modelSelect.value}`);
  }
}

function updateModelInfo() {
  console.log('ℹ️ Updating model info...');

  const providerSelect = document.getElementById('ai-provider');
  const modelSelect = document.getElementById('ai-model');
  const modelInfo = document.getElementById('model-info');

  if (!providerSelect || !modelSelect || !modelInfo) {
    console.error('❌ Required elements not found for model info update');
    return;
  }

  const selectedProvider = providerSelect.value;
  const selectedModel = modelSelect.value;

  console.log('📍 Updating info for:', { provider: selectedProvider, model: selectedModel });

  // 使用AI服务的提供商数据，如果不可用则使用备用数据
  let providersData = null;
  if (aiService && aiService.providers) {
    providersData = aiService.providers;
  } else {
    providersData = FALLBACK_PROVIDERS;
  }

  const provider = providersData[selectedProvider];
  if (provider && provider.models && Array.isArray(provider.models)) {
    const model = provider.models.find(m => m.id === selectedModel);
    if (model && model.description) {
      modelInfo.textContent = model.description;
      console.log('✅ Model info updated:', model.description);
    } else {
      modelInfo.textContent = selectedModel ? 'No description available' : 'Please select a model';
      console.log('⚠️ No description found for model:', selectedModel);
    }
  } else {
    modelInfo.textContent = 'Provider not available';
    console.warn('⚠️ Provider or models not available:', selectedProvider);
  }
}

// Add function to update provider info
function updateProviderInfo() {
  console.log('ℹ️ Updating provider info...');

  const providerSelect = document.getElementById('ai-provider');
  const providerInfo = document.getElementById('provider-info');

  if (!providerSelect || !providerInfo) {
    console.error('❌ Required elements not found for provider info update');
    return;
  }

  const selectedProvider = providerSelect.value;

  // 使用AI服务的提供商数据，如果不可用则使用备用数据
  let providersData = null;
  if (aiService && aiService.providers) {
    providersData = aiService.providers;
  } else {
    providersData = FALLBACK_PROVIDERS;
  }

  const provider = providersData[selectedProvider];
  if (provider) {
    providerInfo.textContent = `${provider.icon || '🤖'} ${provider.description || provider.name}`;
    console.log('✅ Provider info updated:', provider.description);
  } else {
    providerInfo.textContent = 'Provider information not available';
  }
}

// Add API key validation function
function validateApiKey(apiKey, provider) {
  if (!apiKey || apiKey.trim() === '') {
    return { valid: false, message: '请输入API密钥' };
  }

  // Basic format validation based on provider
  const validationRules = {
    openai: /^sk-[a-zA-Z0-9]{48,}$/,
    anthropic: /^sk-ant-[a-zA-Z0-9\-_]{95,}$/,
    google: /^[a-zA-Z0-9\-_]{39}$/,
    zhipu: /^[a-zA-Z0-9]{32}\.[a-zA-Z0-9]{6}$/,
    moonshot: /^sk-[a-zA-Z0-9]{48,}$/,
    baidu: /^[a-zA-Z0-9]{24}$/,
    alibaba: /^sk-[a-zA-Z0-9]{32,}$/,
    siliconflow: /^sk-[a-zA-Z0-9]{48,}$/,
    doubao: /^[a-zA-Z0-9\-_]{32,}$/,
    qwen: /^sk-[a-zA-Z0-9]{24,}$/,
    spark: /^[a-zA-Z0-9]{32}$/,
    minimax: /^eyJ[a-zA-Z0-9\-_\.]{100,}$/
  };

  const rule = validationRules[provider];
  if (rule && !rule.test(apiKey)) {
    return { valid: false, message: 'API密钥格式不正确' };
  }

  return { valid: true, message: 'API密钥格式正确' };
}

// Add API key status update function
function updateApiKeyStatus() {
  const apiKeyInput = document.getElementById('api-key');
  const providerSelect = document.getElementById('ai-provider');
  const statusElement = document.getElementById('api-key-status');

  if (!apiKeyInput || !providerSelect || !statusElement) return;

  const apiKey = apiKeyInput.value;
  const provider = providerSelect.value;

  if (!apiKey) {
    statusElement.style.display = 'none';
    return;
  }

  const validation = validateApiKey(apiKey, provider);
  statusElement.className = `api-key-status ${validation.valid ? 'valid' : 'invalid'}`;
  statusElement.textContent = validation.message;
  statusElement.style.display = 'block';
}

function setupEventListeners() {
  console.log('🎧 Setting up event listeners...');

  const saveBtn = document.getElementById('save-btn');
  const resetBtn = document.getElementById('reset-btn');
  const testBtn = document.getElementById('test-connection');
  const langToggle = document.getElementById('lang-toggle');

  // Save button
  if (saveBtn) saveBtn.addEventListener('click', saveSettings);

  // Reset button
  if (resetBtn) resetBtn.addEventListener('click', resetToDefault);

  // Test connection button
  if (testBtn) testBtn.addEventListener('click', testConnection);

  // Language toggle
  if (langToggle) langToggle.addEventListener('click', toggleLanguage);

  // API key toggle visibility
  const toggleApiKeyBtn = document.getElementById('toggle-api-key');
  if (toggleApiKeyBtn) {
    toggleApiKeyBtn.addEventListener('click', toggleApiKeyVisibility);
  }

  // API key validation
  const apiKeyInput = document.getElementById('api-key');
  if (apiKeyInput) {
    apiKeyInput.addEventListener('input', updateApiKeyStatus);
    apiKeyInput.addEventListener('blur', updateApiKeyStatus);
  }

  // Provider change events
  const providerSelect = document.getElementById('ai-provider');
  if (providerSelect) {
    providerSelect.addEventListener('change', () => {
      updateModelOptions();
      updateModelInfo();
      updateProviderInfo();
      updateApiKeyStatus();
    });
  }

  // Model change events
  const modelSelect = document.getElementById('ai-model');
  if (modelSelect) {
    modelSelect.addEventListener('change', updateModelInfo);
  }

  // Quick setup buttons
  const setupFreeBtn = document.getElementById('setup-free');
  const setupPremiumBtn = document.getElementById('setup-premium');
  const setupChineseBtn = document.getElementById('setup-chinese');

  if (setupFreeBtn) setupFreeBtn.addEventListener('click', () => quickSetup('free'));
  if (setupPremiumBtn) setupPremiumBtn.addEventListener('click', () => quickSetup('premium'));
  if (setupChineseBtn) setupChineseBtn.addEventListener('click', () => quickSetup('chinese'));
}

async function loadCurrentSettings() {
  console.log('📖 Loading current settings...');

  // Load settings from storage if AI service is not available
  let settings = null;
  if (aiService && aiService.settings) {
    settings = aiService.settings;
    console.log('📋 Current settings from AI service:', settings);
  } else {
    console.warn('⚠️ AI service not available, loading settings from storage');
    try {
      const result = await safeStorageGet(['aiSettings']);
      settings = result.aiSettings;
      console.log('📋 Current settings from storage:', settings);
    } catch (error) {
      console.error('❌ Failed to load settings from storage:', error);
      settings = null;
    }
  }

  if (settings) {
    try {
      // Set provider first
      const providerSelect = document.getElementById('ai-provider');
      const modelSelect = document.getElementById('ai-model');
      const apiKeyInput = document.getElementById('api-key');

      if (providerSelect) {
        providerSelect.value = settings.provider || 'siliconflow';
        console.log('✅ Provider set to:', providerSelect.value);
      }

      // Update model options for the selected provider
      updateModelOptions();

      // Set model after options are populated
      if (modelSelect && settings.model) {
        // Use setTimeout to ensure options are populated
        setTimeout(() => {
          modelSelect.value = settings.model;
          updateModelInfo();
          console.log('✅ Model set to:', modelSelect.value);
        }, 100);
      }

      // Set API key
      if (apiKeyInput) {
        apiKeyInput.value = settings.apiKey || '';
        console.log('✅ API key loaded');
      }

      // Set enabled features
      const enabledFeatures = settings.enabledFeatures || [];
      document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        checkbox.checked = enabledFeatures.includes(checkbox.value);
      });
      console.log('✅ Features loaded:', enabledFeatures);

      console.log('✅ Current settings loaded successfully');
    } catch (error) {
      console.error('❌ Error applying settings:', error);
    }
  } else {
    console.warn('⚠️ No settings found, using defaults');
    // Set default values
    const providerSelect = document.getElementById('ai-provider');
    if (providerSelect) {
      providerSelect.value = 'siliconflow';
      updateModelOptions();
    }
  }
}

async function saveSettings() {
  try {
    if (!checkChromeAPIs()) {
      throw new Error('Chrome APIs not available');
    }

    const provider = document.getElementById('ai-provider').value;
    const model = document.getElementById('ai-model').value;
    const apiKey = document.getElementById('api-key').value;

    // Get enabled features
    const enabledFeatures = [];
    document.querySelectorAll('input[type="checkbox"]:checked').forEach(checkbox => {
      enabledFeatures.push(checkbox.value);
    });

    const settings = {
      provider,
      model,
      apiKey,
      enabledFeatures
    };

    console.log('💾 Saving AI settings:', settings);

    // Save to both local and sync storage for reliability with error handling
    const localSaveSuccess = await safeStorageSet({ aiSettings: settings }, false);
    const syncSaveSuccess = await safeStorageSet({ aiSettings: settings }, true);

    if (!localSaveSuccess && !syncSaveSuccess) {
      throw new Error('Failed to save to both local and sync storage');
    }

    // Verify save was successful
    const verification = await safeStorageGet(['aiSettings'], false);
    if (!verification.aiSettings) {
      console.warn('⚠️ Settings save verification failed, but continuing...');
    }

    // Also save via aiService if available
    if (aiService && typeof aiService.saveSettings === 'function') {
      try {
        await aiService.saveSettings(settings);
      } catch (error) {
        console.warn('⚠️ Failed to save via AI service, but settings saved to storage:', error);
      }
    }

    console.log('✅ AI settings saved successfully');

    showStatus('success', currentLanguage === 'en' ?
      'Settings saved successfully!' :
      '设置保存成功！');

  } catch (error) {
    console.error('❌ Error saving settings:', error);
    showStatus('error', currentLanguage === 'en' ?
      'Failed to save settings' :
      '保存设置失败');
  }
}

async function resetToDefault() {
  const defaultSettings = {
    provider: 'siliconflow',
    model: 'deepseek-ai/DeepSeek-V3',
    apiKey: '',
    enabledFeatures: ['smart-search', 'auto-categorize', 'summarize', 'recommendations']
  };
  
  // Save to storage
  await safeStorageSet({ aiSettings: defaultSettings }, false);
  await safeStorageSet({ aiSettings: defaultSettings }, true);
  
  // Also save via aiService if available
  if (aiService && typeof aiService.saveSettings === 'function') {
    try {
      await aiService.saveSettings(defaultSettings);
    } catch (error) {
      console.warn('⚠️ Failed to save via AI service:', error);
    }
  }
  
  await loadCurrentSettings();
  
  showStatus('success', currentLanguage === 'en' ? 
    'Settings reset to default' : 
    '设置已重置为默认值');
}

async function testConnection() {
  const testBtn = document.getElementById('test-connection');
  const testResult = document.getElementById('test-result');
  
  // Disable button and show loading
  testBtn.disabled = true;
  testBtn.textContent = currentLanguage === 'en' ? 'Testing...' : '测试中...';
  testResult.style.display = 'block';
  testResult.textContent = currentLanguage === 'en' ? 'Testing connection...' : '正在测试连接...';
  
  try {
    // Get current settings from form
    const provider = document.getElementById('ai-provider').value;
    const model = document.getElementById('ai-model').value;
    const apiKey = document.getElementById('api-key').value;
    
    // Validate inputs
    if (!provider || !model || !apiKey) {
      throw new Error('请填写完整的AI提供商、模型和API密钥信息');
    }
    
    // Save current settings first
    await saveSettings();
    
    // Test with a simple message
    const testMessages = [
      {
        role: 'system',
        content: 'You are a helpful assistant. Please respond with a simple greeting.'
      },
      {
        role: 'user',
        content: 'Hello, please confirm you can receive this message.'
      }
    ];
    
    let response;
    
    if (aiService && typeof aiService.request === 'function') {
      // Use AI service if available
      response = await aiService.request(testMessages, { maxTokens: 50 });
    } else {
      // Direct API call if AI service is not available
      response = await directApiCall(provider, model, apiKey, testMessages);
    }
    
    testResult.textContent = currentLanguage === 'en' ? 
      `✅ Connection successful!\n\nResponse: ${response}` :
      `✅ 连接成功！\n\n响应: ${response}`;
    
    showStatus('success', currentLanguage === 'en' ? 
      'AI connection test successful!' : 
      'AI连接测试成功！');
      
  } catch (error) {
    console.error('Connection test failed:', error);
    testResult.textContent = currentLanguage === 'en' ? 
      `❌ Connection failed!\n\nError: ${error.message}` :
      `❌ 连接失败！\n\n错误: ${error.message}`;
    
    showStatus('error', currentLanguage === 'en' ? 
      'AI connection test failed' : 
      'AI连接测试失败');
  } finally {
    // Re-enable button
    testBtn.disabled = false;
    testBtn.textContent = currentLanguage === 'en' ? 'Test Connection' : '测试连接';
  }
}

// Add direct API call function for testing when AI service is not available
async function directApiCall(provider, model, apiKey, messages) {
  console.log('🔗 Making direct API call for test...');
  
  // Use fallback providers data
  const providersData = aiService?.providers || FALLBACK_PROVIDERS;
  const providerInfo = providersData[provider];
  
  if (!providerInfo) {
    throw new Error(`Unknown provider: ${provider}`);
  }
  
  let apiUrl = providerInfo.apiUrl;
  let headers = {};
  let requestBody = {};
  
  // Build request based on provider
  switch (provider) {
    case 'openai':
    case 'moonshot':
      apiUrl = provider === 'openai' ? 'https://api.openai.com/v1/chat/completions' : 'https://api.moonshot.cn/v1/chat/completions';
      headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      };
      requestBody = {
        model: model,
        messages: messages,
        max_tokens: 50,
        temperature: 0.7
      };
      break;
      
    case 'google':
      apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      headers = {
        'Content-Type': 'application/json'
      };
      // Convert messages to Gemini format
      const contents = messages.filter(m => m.role !== 'system').map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }));
      requestBody = {
        contents: contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 50
        }
      };
      break;
      
    case 'anthropic':
      apiUrl = 'https://api.anthropic.com/v1/messages';
      headers = {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      };
      const systemMessage = messages.find(m => m.role === 'system');
      const otherMessages = messages.filter(m => m.role !== 'system');
      requestBody = {
        model: model,
        messages: otherMessages,
        max_tokens: 50
      };
      if (systemMessage) {
        requestBody.system = systemMessage.content;
      }
      break;
      
    case 'zhipu':
      apiUrl = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
      headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      };
      requestBody = {
        model: model,
        messages: messages,
        max_tokens: 50,
        temperature: 0.7
      };
      break;
      
    case 'siliconflow':
      apiUrl = 'https://api.siliconflow.cn/v1/chat/completions';
      headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      };
      requestBody = {
        model: model,
        messages: messages,
        max_tokens: 50,
        temperature: 0.7
      };
      break;
      
    case 'doubao':
      apiUrl = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
      headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      };
      requestBody = {
        model: model,
        messages: messages,
        max_tokens: 50,
        temperature: 0.7
      };
      break;
      
    case 'qwen':
      apiUrl = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';
      headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      };
      requestBody = {
        model: model,
        input: {
          messages: messages
        },
        parameters: {
          max_tokens: 50,
          temperature: 0.7
        }
      };
      break;
      
    case 'baidu':
      // 百度文心需要获取access_token，这里简化处理
      apiUrl = `https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/${model}?access_token=${apiKey}`;
      headers = {
        'Content-Type': 'application/json'
      };
      requestBody = {
        messages: messages,
        max_output_tokens: 50,
        temperature: 0.7
      };
      break;
      
    case 'spark':
      // 讯飞星火需要特殊的WebSocket连接，这里作为占位符
      throw new Error('讯飞星火暂不支持直接API调用测试，请在实际使用中配置');
      
    case 'minimax':
      apiUrl = 'https://api.minimax.chat/v1/text/chatcompletion_v2';
      headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      };
      requestBody = {
        model: model,
        messages: messages,
        max_tokens: 50,
        temperature: 0.7
      };
      break;
      
    default:
      throw new Error(`Unsupported provider for direct API call: ${provider}`);
  }
  
  console.log('📡 Making API request to:', apiUrl);
  
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(requestBody)
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API request failed (${response.status}): ${errorText}`);
  }
  
  const data = await response.json();
  console.log('📨 API response:', data);
  
  // Parse response based on provider
  switch (provider) {
    case 'openai':
    case 'moonshot':
    case 'zhipu':
    case 'siliconflow':
    case 'doubao':
    case 'minimax':
      if (data.choices && data.choices[0] && data.choices[0].message) {
        return data.choices[0].message.content;
      }
      break;
      
    case 'google':
      if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        return data.candidates[0].content.parts[0].text;
      }
      break;
      
    case 'anthropic':
      if (data.content && data.content[0] && data.content[0].text) {
        return data.content[0].text;
      }
      break;
      
    case 'qwen':
      if (data.output && data.output.text) {
        return data.output.text;
      } else if (data.output && data.output.choices && data.output.choices[0] && data.output.choices[0].message) {
        return data.output.choices[0].message.content;
      }
      break;
      
    case 'baidu':
      if (data.result) {
        return data.result;
      }
      break;
  }
  
  throw new Error('Invalid response format from API');
}

function showStatus(type, message) {
  const statusEl = document.getElementById('status-message');
  statusEl.className = `status-message status-${type} show`;
  statusEl.textContent = message;
  
  setTimeout(() => {
    statusEl.classList.remove('show');
  }, 5000);
}

async function toggleLanguage() {
  currentLanguage = currentLanguage === 'en' ? 'zh' : 'en';
  updateLanguage();
  updatePlaceholders();

  // Save language preference
  await safeStorageSet({ language: currentLanguage }, true);
}

// Add initialization verification function
function verifyInitialization() {
  console.log('🔍 Verifying initialization...');

  const checks = {
    aiService: !!aiService,
    providers: !!(aiService && aiService.providers),
    providerCount: aiService?.providers ? Object.keys(aiService.providers).length : 0,
    providerSelect: !!document.getElementById('ai-provider'),
    modelSelect: !!document.getElementById('ai-model'),
    providerOptions: document.getElementById('ai-provider')?.options.length || 0,
    modelOptions: document.getElementById('ai-model')?.options.length || 0
  };

  console.log('📊 Initialization status:', checks);

  // Check for critical issues
  const issues = [];
  if (!checks.aiService) issues.push('AI service not initialized');
  if (!checks.providers) issues.push('AI providers not loaded');
  if (checks.providerCount === 0) issues.push('No providers available');
  if (checks.providerOptions === 0) issues.push('Provider dropdown empty');
  if (checks.modelOptions === 0) issues.push('Model dropdown empty');

  if (issues.length > 0) {
    console.error('❌ Initialization issues found:', issues);
    showStatus('error', `Initialization issues: ${issues.join(', ')}`);
    return false;
  } else {
    console.log('✅ All initialization checks passed');
    showStatus('success', 'AI settings loaded successfully');
    return true;
  }
}

function updateLanguage() {
  const elements = document.querySelectorAll('[data-en][data-zh]');
  const toggleButton = document.getElementById('lang-toggle');

  elements.forEach(element => {
    if (currentLanguage === 'zh') {
      element.textContent = element.getAttribute('data-zh');
    } else {
      element.textContent = element.getAttribute('data-en');
    }
  });

  // Update toggle button text
  if (toggleButton) {
    toggleButton.textContent = currentLanguage === 'en' ? '中文' : 'English';
  }
}

function updatePlaceholders() {
  const inputs = document.querySelectorAll('[data-placeholder-en][data-placeholder-zh]');

  inputs.forEach(input => {
    if (currentLanguage === 'zh') {
      input.placeholder = input.getAttribute('data-placeholder-zh');
    } else {
      input.placeholder = input.getAttribute('data-placeholder-en');
    }
  });
}

// Add API key visibility toggle function
function toggleApiKeyVisibility() {
  const apiKeyInput = document.getElementById('api-key');
  const toggleBtn = document.getElementById('toggle-api-key');

  if (!apiKeyInput || !toggleBtn) return;

  if (apiKeyInput.type === 'password') {
    apiKeyInput.type = 'text';
    toggleBtn.textContent = '🙈';
    toggleBtn.title = '隐藏API密钥';
  } else {
    apiKeyInput.type = 'password';
    toggleBtn.textContent = '👁️';
    toggleBtn.title = '显示API密钥';
  }
}

// Add quick setup function
function quickSetup(type) {
  console.log(`🚀 Quick setup: ${type}`);

  const providerSelect = document.getElementById('ai-provider');
  const modelSelect = document.getElementById('ai-model');

  if (!providerSelect || !modelSelect) return;

  let recommendedProvider = '';
  let recommendedModel = '';
  let statusMessage = '';

  switch (type) {
    case 'free':
      recommendedProvider = 'siliconflow';
      recommendedModel = 'deepseek-ai/DeepSeek-V3';
      statusMessage = '已选择免费选项：硅基流动 + DeepSeek-V3';
      break;

    case 'premium':
      recommendedProvider = 'openai';
      recommendedModel = 'gpt-4o';
      statusMessage = '已选择付费选项：OpenAI + GPT-4o';
      break;

    case 'chinese':
      recommendedProvider = 'zhipu';
      recommendedModel = 'glm-4';
      statusMessage = '已选择国产模型：智谱AI + GLM-4';
      break;
      
    case 'doubao':
      recommendedProvider = 'doubao';
      recommendedModel = 'doubao-pro-32k';
      statusMessage = '已选择豆包模型：字节跳动豆包 + Doubao Pro (32K)';
      break;
      
    case 'qwen':
      recommendedProvider = 'qwen';
      recommendedModel = 'qwen-plus';
      statusMessage = '已选择千问模型：阿里云通义千问 + Qwen Plus';
      break;
      
    case 'baidu':
      recommendedProvider = 'baidu';
      recommendedModel = 'ernie-4.0-8k';
      statusMessage = '已选择文心模型：百度文心 + ERNIE 4.0';
      break;
  }

  if (recommendedProvider && aiService?.providers[recommendedProvider]) {
    providerSelect.value = recommendedProvider;
    providerSelect.dispatchEvent(new Event('change'));

    // Wait for model options to update, then set the model
    setTimeout(() => {
      const modelOption = Array.from(modelSelect.options).find(opt => opt.value === recommendedModel);
      if (modelOption) {
        modelSelect.value = recommendedModel;
        modelSelect.dispatchEvent(new Event('change'));
      }
      showStatus('info', statusMessage);
    }, 100);
  }
}
