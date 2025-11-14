// 状态持久化封装
// 提供：loadState, saveState, withState
// 使用 electron-store；若不可用则回退为内存存储（不持久化）。

const path = require('path');
const fs = require('fs');
let ElectronStore = null;
let storeInstance = null;
let memoryState = {}; // 回退内存

function ensureStore() {
    if (storeInstance) return storeInstance;
    try {
        const mod = require('electron-store');
        ElectronStore = mod;
        const dataDir = path.join(process.cwd(), 'data');
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        storeInstance = new ElectronStore({ name: 'pet-state', cwd: dataDir });
    } catch (e) {
        console.error('[state-storage] 初始化 electron-store 失败，使用内存回退:', e);
        storeInstance = null;
    }
    return storeInstance;
}

function loadState(defaultState) {
    const st = ensureStore();
    if (!st) return { ...defaultState, ...memoryState };
    try {
        const saved = st.get('petState') || {};
        return { ...defaultState, ...saved };
    } catch (e) {
        console.error('[state-storage] 读取失败，返回默认:', e);
        return { ...defaultState };
    }
}

function saveState(state) {
    const st = ensureStore();
    if (!st) {
        memoryState = { ...state };
        return;
    }
    try {
        st.set('petState', state);
    } catch (e) {
        console.error('[state-storage] 写入失败:', e);
    }
}

// withState(mutator)：读取当前 -> mutator(current) -> 保存 -> 返回新
function withState(mutator, defaultState) {
    const current = loadState(defaultState);
    const next = mutator(current) || current;
    saveState(next);
    return next;
}

module.exports = { loadState, saveState, withState };
