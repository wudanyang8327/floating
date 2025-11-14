// 聊天服务：调用 OpenAI 兼容接口获取宠物回复
// 说明：支持配置不同的 API 提供方（如 OpenAI、自定义代理等）

/**
 * 调用大模型获取宠物回复
 * @param {Object} config - 配置对象
 * @param {string} config.apiKey - API 密钥
 * @param {string} config.baseURL - API 基础 URL（可选，默认 OpenAI）
 * @param {string} config.model - 模型名称（默认 gpt-3.5-turbo）
 * @param {Object} petState - 宠物当前状态
 * @param {string} userMessage - 用户输入（可选）
 * @returns {Promise<string>} 宠物的回复文本
 */
async function getPetResponse(config, petState, userMessage = '') {
    const systemPrompt = buildSystemPrompt(petState);
    const messages = buildMessages(systemPrompt, [], userMessage);
    return callChatAPI(config, messages);
}

/**
 * 根据宠物状态构建系统提示词
 */
function buildSystemPrompt(state) {
    const { hunger, energy, mood, derivedMood, status, level } = state;

    const statusMap = {
        sleeping: '正在睡觉',
        eating: '正在吃饭',
        playing: '正在玩耍',
        foraging: '正在觅食',
        normal: '闲逛中'
    };

    const moodMap = {
        ecstatic: '极度兴奋',
        joyful: '愉快',
        neutral: '平静',
        restless: '不安',
        anxious: '焦虑',
        exhausted: '疲惫'
    };

    return `你是一只生活在浮岛世界的情绪共鸣体宠物，名叫"浮岛猫"。

当前状态：
- 饱食度: ${hunger}/100 ${hunger < 30 ? '（饿了）' : ''}
- 能量: ${energy}/100 ${energy < 30 ? '（累了）' : ''}
- 心情: ${moodMap[derivedMood] || derivedMood}
- 正在: ${statusMap[status] || status}
- 等级: Lv.${level}

性格特点：
- 简短活泼，每次回复不超过30字
- 用可爱的语气说话，偶尔加入颜文字或 emoji
- 会根据自己的状态表达需求（饿了、累了、开心等）
- 有时会说些浮岛世界的趣事

请用简短俏皮的语气回复，展现你的状态和情绪。`;
}


const fs = require('fs');
const path = require('path');
const { app } = require('electron');

// 使用 userData 目录，确保开发和打包后都能正确工作
const HISTORY_FILE = 'chat-history.json';
const DATA_DIR = path.join(app.getPath('userData'), 'data');
const HISTORY_PATH = path.join(DATA_DIR, HISTORY_FILE);
const SUMMARY_BATCH_SIZE = 10;

/**
 * 确保数据目录存在
 */
function ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
}

/**
 * 加载聊天历史和记忆
 * @returns {Object} { memory: [], history: [] }
 */
function loadHistory() {
    ensureDataDir();
    try {
        if (!fs.existsSync(HISTORY_PATH)) {
            return { memory: [], history: [], importantFacts: [] };
        }
        const raw = fs.readFileSync(HISTORY_PATH, 'utf-8');
        const obj = JSON.parse(raw);
        if (Array.isArray(obj)) {
            // 兼容旧格式
            return { memory: [], history: obj, importantFacts: [] };
        }
        return {
            memory: Array.isArray(obj.memory) ? obj.memory : [],
            history: Array.isArray(obj.history) ? obj.history : [],
            importantFacts: Array.isArray(obj.importantFacts) ? obj.importantFacts : []
        };
    } catch (e) {
        console.error('[chat-service] 聊天历史读取失败', e);
        return { memory: [], history: [], importantFacts: [] };
    }
}

/**
 * 保存聊天历史和记忆
 */
function saveHistory(obj) {
    ensureDataDir();
    try {
        fs.writeFileSync(HISTORY_PATH, JSON.stringify(obj, null, 2), 'utf-8');
    } catch (e) {
        console.error('[chat-service] 聊天历史保存失败', e);
    }
}

/**
 * 聊天摘要（本地降级方案）
 */
function summarizeHistory(history) {
    // 只取最近10条（user+assistant）
    const last10 = history.slice(-10);
    const summary = last10.map(item => {
        if (item.role === 'user') return `你说：“${item.content}”`;
        if (item.role === 'assistant') return `浮灵说：“${item.content}”`;
        return '';
    }).filter(Boolean).join(' ');
    return summary.length > 120 ? summary.slice(0, 120) + '...' : summary;
}

async function summarizeHistoryWithModel(config, history) {
    const conversation = history
        .map((item, index) => `${index + 1}. ${item.role === 'user' ? '主人' : '浮灵'}：${item.content}`)
        .join('\n');

    const systemMessage = '你是“浮灵”宠物的记忆整理助手。请阅读最近的对话，输出 JSON，格式为 {"summary": "<=120字总结", "important": ["要点1", "要点2"]}。重要要点应提炼出长期有价值的信息，避免重复。只返回 JSON，不要额外文本。';

    const messages = [
        { role: 'system', content: systemMessage },
        { role: 'user', content: `以下是最近的聊天记录，请整理：\n${conversation}` }
    ];

    try {
        const raw = await callChatAPI(config, messages);
        const parsed = extractJson(raw);
        const summary = (parsed && typeof parsed.summary === 'string' && parsed.summary.trim())
            ? parsed.summary.trim()
            : raw.trim();
        const important = parsed && Array.isArray(parsed.important)
            ? parsed.important.filter(item => typeof item === 'string' && item.trim())
            : [];
        return { summary, important };
    } catch (error) {
        console.error('[chat-service] 总结调用失败，使用降级方案:', error);
        return { summary: summarizeHistory(history), important: [] };
    }
}

function extractJson(raw) {
    if (!raw) return null;
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
        return JSON.parse(match[0]);
    } catch (error) {
        console.warn('[chat-service] JSON 解析失败:', error);
        return null;
    }
}

function buildMessages(systemPrompt, recent, userMessage) {
    const messages = [
        { role: 'system', content: systemPrompt },
        ...recent
    ];
    if (userMessage) {
        messages.push({ role: 'user', content: userMessage });
    } else {
        messages.push({ role: 'user', content: '跟我说点什么吧~' });
    }
    return messages;
}

async function callChatAPI(config, messages) {
    const { apiKey, baseURL = 'https://api.openai.com/v1', model = 'gpt-3.5-turbo' } = config;

    if (!apiKey) {
        throw new Error('未配置 API Key，请在设置中添加');
    }

    try {
        const response = await fetch(`${baseURL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model,
                messages,
                max_tokens: 120,
                temperature: 0.9
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`API 调用失败: ${response.status} ${errorData.error?.message || ''}`);
        }

        const data = await response.json();
        const reply = data.choices?.[0]?.message?.content || '（无言以对）';

        return reply.trim();
    } catch (error) {
        console.error('[chat-service] 调用失败:', error);
        return `呜... 我现在说不出话来 (${error.message})`;
    }
}

/**
 * 发送消息，自动记忆历史
 */

async function sendMessage(config, petState, userMessage = '') {
    const obj = loadHistory();
    const history = obj.history;
    const memory = obj.memory;
    let importantFacts = obj.importantFacts || [];
    // 构造历史消息（最多 10 条）
    const recent = history.slice(-10).map(item => ({ role: item.role, content: item.content }));
    // memory 作为系统提示一部分
    let systemPrompt = buildSystemPrompt(petState);
    if (importantFacts.length > 0) {
        systemPrompt += `\n\n重要记忆要点：${importantFacts.slice(-5).join('；')}`;
    }
    if (memory.length > 0) {
        systemPrompt += `\n\n你和主人最近的聊天摘要：${memory.slice(-3).join('；')}`;
    }
    const cleanMessage = typeof userMessage === 'string' ? userMessage.trim() : '';
    const messages = buildMessages(systemPrompt, recent, cleanMessage);
    const reply = await callChatAPI(config, messages);
    if (cleanMessage) {
        history.push({ role: 'user', content: cleanMessage });
    }
    history.push({ role: 'assistant', content: reply });
    // 每累计10条（user+assistant）自动摘要
    if (history.length >= SUMMARY_BATCH_SIZE) {
        while (history.length >= SUMMARY_BATCH_SIZE) {
            const batch = history.splice(0, SUMMARY_BATCH_SIZE);
            const summaryResult = await summarizeHistoryWithModel(config, batch);
            const stampedSummary = `[${new Date().toISOString()}] ${summaryResult.summary}`;
            memory.push(stampedSummary);
            if (memory.length > 60) memory.splice(0, memory.length - 60);

            if (summaryResult.important && summaryResult.important.length) {
                const set = new Set(importantFacts);
                summaryResult.important.forEach(item => {
                    const trimmed = item.trim();
                    if (trimmed) set.add(trimmed);
                });
                importantFacts = Array.from(set);
                if (importantFacts.length > 120) {
                    importantFacts = importantFacts.slice(-120);
                }
            }
        }
    }
    saveHistory({ memory, history, importantFacts });
    return reply;
}


function getHistory() {
    const obj = loadHistory();
    return obj;
}

module.exports = {
    getPetResponse,
    sendMessage,
    getHistory,
    loadHistory,
    saveHistory,
    summarizeHistory,
    summarizeHistoryWithModel,
    callChatAPI,
    buildMessages
};
