// API 配置管理：读写 data/petAPI.json
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const CONFIG_FILE = 'petAPI.json';
// 使用 userData 目录，开发和打包后都能正确工作
const DATA_DIR = path.join(app.getPath('userData'), 'data');
const CONFIG_PATH = path.join(DATA_DIR, CONFIG_FILE);

// 默认配置
const DEFAULT_CONFIG = {
    apiKey: '',
    baseURL: 'https://api.openai.com/v1',
    model: 'gpt-3.5-turbo'
};

/**
 * 确保数据目录存在
 */
function ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
}

/**
 * 读取 API 配置
 * @returns {Object} 配置对象
 */
function loadApiConfig() {
    ensureDataDir();

    try {
        if (fs.existsSync(CONFIG_PATH)) {
            const content = fs.readFileSync(CONFIG_PATH, 'utf-8');
            const config = JSON.parse(content);
            return { ...DEFAULT_CONFIG, ...config };
        }
    } catch (error) {
        console.error('[api-config] 读取配置失败:', error);
    }

    // 返回默认配置
    return { ...DEFAULT_CONFIG };
}

/**
 * 保存 API 配置
 * @param {Object} config - 配置对象
 * @returns {boolean} 是否成功
 */
function saveApiConfig(config) {
    ensureDataDir();

    try {
        const merged = { ...DEFAULT_CONFIG, ...config };
        const content = JSON.stringify(merged, null, 2);
        fs.writeFileSync(CONFIG_PATH, content, 'utf-8');
        console.log('[api-config] 配置已保存:', CONFIG_PATH);
        return true;
    } catch (error) {
        console.error('[api-config] 保存配置失败:', error);
        return false;
    }
}

/**
 * 更新部分配置
 * @param {Object} updates - 要更新的字段
 * @returns {Object} 更新后的完整配置
 */
function updateApiConfig(updates) {
    const current = loadApiConfig();
    const merged = { ...current, ...updates };
    saveApiConfig(merged);
    return merged;
}

/**
 * 获取配置路径（用于提示用户）
 * @returns {string} 配置文件绝对路径
 */
function getConfigPath() {
    return CONFIG_PATH;
}

module.exports = {
    loadApiConfig,
    saveApiConfig,
    updateApiConfig,
    getConfigPath,
    DEFAULT_CONFIG
};
