// AI Prompt Templates - 提示词模板管理器
// 用于管理所有AI功能的提示词模板，实现提示词与代码逻辑的分离

class AIPromptTemplates {
  constructor() {
    this.templates = this.initializeTemplates();
    console.log('📝 AI Prompt Templates initialized with', Object.keys(this.templates).length, 'templates');
  }
  
  /**
   * 初始化所有提示词模板
   * @returns {Object} 模板集合
   */
  initializeTemplates() {
    return {
      // ===== 智能搜索相关模板 =====
      'smart-search': {
        system: `你是一个精确的书签搜索专家。根据用户查询，从提供的书签中找出最相关的结果。

要求：
1. 理解查询意图（语义匹配优于关键词匹配）
2. 考虑书签的标题、URL和上下文相关性
3. 提供简洁但有用的匹配原因
4. 相关性评分要准确（0.1-1.0）

输出格式：
{
  "matches": [
    {
      "id": "书签ID", 
      "title": "书签标题",
      "url": "书签URL",
      "relevanceScore": 0.95,
      "reason": "匹配原因说明"
    }
  ],
  "totalMatches": 数量
}

只返回JSON，不要其他解释。`,
        
        user: `用户查询: "{{query}}"
用户兴趣: {{userInterests}}
当前页面: {{currentPage}}

书签数据:
{{bookmarksData}}

找出最相关的书签（最多10个），按相关性排序。`
      },
      
      // ===== 相关书签推荐模板 =====
      'related-bookmarks': {
        system: `你是一个书签推荐专家。基于用户当前的上下文，从用户书签中推荐最相关的内容。

要求：
1. 分析当前页面的主题和用户兴趣
2. 找出真正相关且有价值的书签
3. 提供清晰的推荐理由
4. 相关性评分要合理

输出格式：
{
  "relatedBookmarks": [
    {
      "id": "书签ID",
      "title": "书签标题", 
      "reason": "推荐原因",
      "relevanceScore": 0.90
    }
  ]
}

只返回JSON，不要其他解释。`,
        
        user: `当前上下文:
- 页面: {{currentPage}}
- 域名: {{currentDomain}}
- 类别: {{currentCategory}}
- 用户兴趣: {{primaryInterests}}

用户书签数据:
{{bookmarksData}}

基于当前上下文推荐3-5个最相关的书签。`
      },
      
      // ===== 搜索建议模板 =====
      'suggested-searches': {
        system: `你是一个搜索建议专家。基于用户的兴趣和当前上下文，提供有洞察力的搜索建议。

要求：
1. 建议要具体且可操作
2. 考虑用户的技术水平和兴趣方向
3. 提供多样化的搜索角度
4. 避免过于宽泛或明显的建议

输出格式：
{
  "suggestedSearches": ["搜索建议1", "搜索建议2", "搜索建议3"]
}

只返回JSON，不要其他解释。`,
        
        user: `用户上下文:
- 主要兴趣: {{primaryInterests}}
- 当前页面: {{currentPage}}
- 时间段: {{timeWindow}}
- 活跃度: {{activityLevel}}

基于用户兴趣和当前上下文，建议3个有价值的搜索查询。`
      },
      
      // ===== 学习路径规划模板 =====
      'learning-path': {
        system: `你是一个学习路径规划专家。基于用户的书签和当前主题，创建一个结构化的学习路径。

要求：
1. 路径要有逻辑性和渐进性
2. 充分利用用户现有的书签资源
3. 提供清晰的学习步骤和目标
4. 考虑不同的学习风格

输出格式：
{
  "learningPath": {
    "topic": "学习主题",
    "difficulty": "初级|中级|高级", 
    "estimatedTime": "预计学习时间",
    "steps": [
      {
        "step": 1,
        "title": "步骤标题",
        "description": "步骤描述",
        "bookmarkIds": ["相关书签ID"],
        "goals": ["学习目标1", "学习目标2"]
      }
    ]
  }
}

只返回JSON，不要其他解释。`,
        
        user: `学习主题: {{topic}}
用户兴趣: {{primaryInterests}}
用户书签:
{{bookmarksData}}

创建一个包含4-6个步骤的学习路径，优先使用用户现有的书签资源。`
      },
      
      // ===== 书签分类模板 =====
      'categorization': {
        system: `你是一个信息架构专家。分析书签并提供智能分类建议。

要求：
1. 分类要合理且实用
2. 考虑用户的使用习惯
3. 避免过度细分或过于宽泛
4. 提供清晰的分类逻辑

输出格式：
{
  "suggestedFolders": [
    {
      "name": "文件夹名称",
      "description": "用途描述", 
      "bookmarkIds": ["书签ID1", "书签ID2"],
      "priority": "high|medium|low"
    }
  ],
  "organizationPrinciple": "分类原则说明"
}

只返回JSON，不要其他解释。`,
        
        user: `待分类书签:
{{bookmarksData}}

当前类别分布: {{mainCategories}}
用户多样性: {{diversity}}
总书签数: {{totalBookmarks}}

提供合理的文件夹分类建议。`
      },
      
      // ===== 重复检测模板 =====
      'duplicate-detection': {
        system: `你是一个书签清理专家。识别重复和相似的书签。

要求：
1. 识别完全重复和高度相似的内容
2. 区分不同类型的重复（URL、内容、主题）
3. 提供清理建议
4. 保留更有价值的版本

输出格式：
{
  "duplicates": [
    {
      "type": "exact|similar|thematic",
      "reason": "重复原因",
      "bookmarks": [
        {"id": "书签ID", "keepSuggestion": true|false, "reason": "保留/删除原因"}
      ]
    }
  ],
  "cleanupSuggestions": ["清理建议1", "清理建议2"]
}

只返回JSON，不要其他解释。`,
        
        user: `书签数据:
{{bookmarksData}}

分析这些书签，找出重复和相似的项目，并提供清理建议。`
      },
      
      // ===== 内容摘要模板 =====
      'content-summary': {
        system: `你是一个内容分析专家。为网页内容生成有价值的摘要和元数据。

要求：
1. 摘要要准确且简洁
2. 提取关键信息和要点
3. 识别内容类型和难度级别
4. 提供有用的标签和分类

输出格式：
{
  "summary": "2-3句话的简洁摘要",
  "keyPoints": ["关键点1", "关键点2"],
  "tags": ["标签1", "标签2"],
  "category": "内容类别",
  "contentType": "文章|工具|文档|视频|教程|其他",
  "difficulty": "初级|中级|高级",
  "targetAudience": "目标受众",
  "estimatedReadTime": "阅读时间（分钟）"
}

只返回JSON，不要其他解释。`,
        
        user: `网页信息:
标题: {{title}}
URL: {{url}}
内容: {{content}}

生成详细的内容摘要和元数据。`
      },
      
      // ===== 兴趣分析模板 =====
      'interest-analysis': {
        system: `你是一个用户行为分析专家。深度分析用户的兴趣模式和行为趋势。

要求：
1. 识别主要和新兴兴趣点
2. 分析行为模式和趋势
3. 提供个性化洞察
4. 给出实用的建议

输出格式：
{
  "primaryInterests": [
    {
      "topic": "兴趣主题",
      "confidence": 0.95,
      "evidence": ["证据1", "证据2"],
      "trend": "上升|稳定|下降"
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
      "type": "exploration|optimization|discovery",
      "suggestion": "具体建议",
      "reasoning": "建议理由"
    }
  ],
  "insights": ["洞察1", "洞察2"]
}

只返回JSON，不要其他解释。`,
        
        user: `用户数据分析:
书签类别: {{topCategories}}
主要兴趣: {{primaryInterests}}
最近趋势: {{recentTrends}}
活跃度: {{activityLevel}}

书签数据:
{{bookmarksData}}

浏览历史:
{{historyData}}

提供深度的兴趣分析和行为洞察。`
      },
      
      // ===== 遗忘书签发现模板 =====
      'forgotten-gems': {
        system: `你是一个书签价值发现专家。找出被遗忘但有价值的书签。

要求：
1. 识别长期未访问但仍有价值的内容
2. 考虑当前的相关性和实用性
3. 解释为什么现在值得重新关注
4. 按价值优先级排序

输出格式：
{
  "forgottenGems": [
    {
      "id": "书签ID",
      "title": "书签标题",
      "ageInDays": 天数,
      "currentRelevance": "当前相关性说明",
      "rediscoveryValue": "重新发现的价值",
      "actionSuggestion": "建议操作"
    }
  ],
  "summary": "发现总结"
}

只返回JSON，不要其他解释。`,
        
        user: `用户书签:
{{bookmarksData}}

最近浏览历史:
{{recentHistory}}

当前兴趣: {{primaryInterests}}
时间: {{currentTime}}

找出3-5个被遗忘但有价值的书签。`
      },
      
      // ===== 主题推荐模板 =====
      'topic-recommendations': {
        system: `你是一个主题推荐专家。基于用户兴趣，推荐相关的主题和内容方向。

要求：
1. 推荐要有深度和广度
2. 考虑用户的知识背景
3. 提供多样化的探索方向
4. 连接用户现有兴趣

输出格式：
{
  "topicRecommendations": [
    {
      "topic": "主题名称",
      "description": "主题描述",
      "relevanceReason": "相关性说明",
      "explorationSuggestions": ["探索建议1", "探索建议2"],
      "relatedBookmarks": ["相关书签ID"]
    }
  ]
}

只返回JSON，不要其他解释。`,
        
        user: `用户兴趣分析:
主要兴趣: {{primaryInterests}}
类别分布: {{topCategories}}
当前页面: {{currentPage}}

相关书签:
{{relevantBookmarks}}

推荐3-4个值得探索的主题方向。`
      }
    };
  }
  
  /**
   * 获取指定类型的提示词模板
   * @param {string} type - 模板类型
   * @returns {Object|null} 模板对象
   */
  getTemplate(type) {
    const template = this.templates[type];
    if (!template) {
      console.error(`❌ Template not found: ${type}`);
      return null;
    }
    
    return { ...template }; // 返回副本避免意外修改
  }
  
  /**
   * 构建完整的消息数组
   * @param {string} type - 模板类型
   * @param {Object} variables - 模板变量
   * @returns {Array} 消息数组
   */
  buildMessages(type, variables = {}) {
    const template = this.getTemplate(type);
    if (!template) {
      throw new Error(`Template ${type} not found`);
    }
    
    const messages = [];
    
    // 添加系统消息
    if (template.system) {
      messages.push({
        role: 'system',
        content: this.interpolateTemplate(template.system, variables)
      });
    }
    
    // 添加用户消息
    if (template.user) {
      messages.push({
        role: 'user',
        content: this.interpolateTemplate(template.user, variables)
      });
    }
    
    // 添加助手消息（如果有）
    if (template.assistant) {
      messages.push({
        role: 'assistant',
        content: this.interpolateTemplate(template.assistant, variables)
      });
    }
    
    return messages;
  }
  
  /**
   * 模板插值 - 替换模板中的变量
   * @param {string} template - 模板字符串
   * @param {Object} variables - 变量对象
   * @returns {string} 插值后的字符串
   */
  interpolateTemplate(template, variables) {
    let result = template;
    
    // 替换 {{variable}} 格式的变量
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      let replacement = '';
      
      if (Array.isArray(value)) {
        replacement = value.join(', ');
      } else if (typeof value === 'object' && value !== null) {
        replacement = JSON.stringify(value, null, 2);
      } else if (value !== undefined && value !== null) {
        replacement = String(value);
      }
      
      result = result.replace(regex, replacement);
    }
    
    // 清理未替换的变量占位符
    result = result.replace(/\{\{[^}]+\}\}/g, '');
    
    return result.trim();
  }
  
  /**
   * 验证模板变量
   * @param {string} type - 模板类型
   * @param {Object} variables - 变量对象
   * @returns {Object} 验证结果
   */
  validateTemplateVariables(type, variables) {
    const template = this.getTemplate(type);
    if (!template) {
      return { valid: false, errors: [`Template ${type} not found`] };
    }
    
    // 从模板中提取所需的变量
    const fullTemplate = (template.system || '') + ' ' + (template.user || '') + ' ' + (template.assistant || '');
    const requiredVars = this.extractTemplateVariables(fullTemplate);
    
    const errors = [];
    const warnings = [];
    
    // 检查必需的变量
    for (const varName of requiredVars) {
      if (!(varName in variables)) {
        errors.push(`Missing required variable: ${varName}`);
      } else if (variables[varName] === undefined || variables[varName] === null) {
        warnings.push(`Variable ${varName} is null or undefined`);
      }
    }
    
    // 检查额外的变量
    for (const varName of Object.keys(variables)) {
      if (!requiredVars.includes(varName)) {
        warnings.push(`Unused variable: ${varName}`);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      requiredVariables: requiredVars,
      providedVariables: Object.keys(variables)
    };
  }
  
  /**
   * 从模板字符串中提取变量名
   * @param {string} template - 模板字符串
   * @returns {Array} 变量名数组
   */
  extractTemplateVariables(template) {
    const matches = template.match(/\{\{([^}]+)\}\}/g) || [];
    return [...new Set(matches.map(match => match.slice(2, -2).trim()))];
  }
  
  /**
   * 获取所有可用的模板类型
   * @returns {Array} 模板类型列表
   */
  getAvailableTemplates() {
    return Object.keys(this.templates).map(type => ({
      type,
      description: this.getTemplateDescription(type),
      requiredVariables: this.extractTemplateVariables(
        (this.templates[type].system || '') + ' ' + (this.templates[type].user || '')
      )
    }));
  }
  
  /**
   * 获取模板描述
   * @param {string} type - 模板类型
   * @returns {string} 模板描述
   */
  getTemplateDescription(type) {
    const descriptions = {
      'smart-search': '智能搜索书签内容',
      'related-bookmarks': '基于上下文推荐相关书签',
      'suggested-searches': '生成搜索建议',
      'learning-path': '创建学习路径',
      'categorization': '书签分类建议',
      'duplicate-detection': '检测重复书签',
      'content-summary': '生成内容摘要',
      'interest-analysis': '分析用户兴趣模式',
      'forgotten-gems': '发现遗忘的有价值书签',
      'topic-recommendations': '推荐相关主题'
    };
    
    return descriptions[type] || '未知模板类型';
  }
  
  /**
   * 添加或更新模板
   * @param {string} type - 模板类型
   * @param {Object} template - 模板对象
   */
  addTemplate(type, template) {
    if (!template.system && !template.user) {
      throw new Error('Template must have at least system or user message');
    }
    
    this.templates[type] = { ...template };
    console.log(`📝 Template ${type} added/updated`);
  }
  
  /**
   * 删除模板
   * @param {string} type - 模板类型
   */
  removeTemplate(type) {
    if (this.templates[type]) {
      delete this.templates[type];
      console.log(`🗑️ Template ${type} removed`);
    }
  }
  
  /**
   * 导出模板到JSON
   * @returns {string} JSON格式的模板
   */
  exportTemplates() {
    return JSON.stringify(this.templates, null, 2);
  }
  
  /**
   * 从JSON导入模板
   * @param {string} jsonString - JSON格式的模板
   */
  importTemplates(jsonString) {
    try {
      const imported = JSON.parse(jsonString);
      this.templates = { ...this.templates, ...imported };
      console.log('📥 Templates imported successfully');
    } catch (error) {
      console.error('❌ Failed to import templates:', error);
      throw error;
    }
  }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AIPromptTemplates;
} else if (typeof window !== 'undefined') {
  window.AIPromptTemplates = AIPromptTemplates;
} 