// 宠物前端动画与交互逻辑 (Canvas 动画版本)
console.log('[pet.js] script start');
const petEl = document.getElementById('pet');
const canvas = document.getElementById('pet-canvas');
console.log('[pet.js] elements:', { petEl, canvas });
// 使用全局挂载的 AnimationEngine（因渲染层禁用 nodeIntegration）
console.log('[pet.js] globals:', { AnimationEngine: window.AnimationEngine, makeAerialCat: window.makeAerialCat });
if (!window.AnimationEngine) {
    console.warn('[pet] AnimationEngine 未找到，回退到静态 SVG 模式');
}// 定义帧序列（占位实现，可后续替换为外部 sprite）

let engine = null;
if (window.AnimationEngine) {
    engine = new window.AnimationEngine(canvas, { fpsActive: 2, fpsSleep: 1 });
    window.__petEngineRefs.push(engine);
    engine.define('idle', [
        window.makeAerialCat('neutral', 0),
        window.makeAerialCat('neutral', 15)
    ], 1200);
    engine.define('walk', [
        window.makeAerialCat('joyful', 0),
        window.makeAerialCat('joyful', 10)
    ], 1000);

    // 睡觉专用动画：更慢的呼吸节奏，使用疲惫姿态
    engine.define('sleep', [
        window.makeAerialCat('exhausted', 0),
        window.makeAerialCat('exhausted', 5),
        window.makeAerialCat('exhausted', 10),
        window.makeAerialCat('exhausted', 5)
    ], 2000);  // 更慢的帧率，模拟平稳呼吸

    engine.define('ecstatic', [
        window.makeAerialCat('ecstatic', 0),
        window.makeAerialCat('ecstatic', 8),
        window.makeAerialCat('ecstatic', 16)
    ], 900);
    engine.define('exhausted', [
        window.makeAerialCat('exhausted', 0),
        window.makeAerialCat('exhausted', 15)
    ], 1400);
    engine.define('restless', [
        window.makeAerialCat('restless', 0),
        window.makeAerialCat('restless', 10)
    ], 1000);
    engine.define('anxious', [
        window.makeAerialCat('anxious', 0),
        window.makeAerialCat('anxious', 12)
    ], 1000);
    console.log('[pet] 动画序列已定义');
} let currentSeq = 'idle';
function playSeq(key) {
    if (!engine) return; // 回退模式不执行
    if (currentSeq === key) return;
    currentSeq = key;
    petEl.className = `pet ${key}`;
    engine.play(key);
}

// 根据状态派生动画 key
function selectAnimation(state) {
    if (!engine) return null;
    // 优先判断过程状态
    if (state.status === 'sleeping') return 'sleep';
    if (state.status === 'eating') return 'idle';  // 吃饭时保持静止
    if (state.status === 'playing') return 'ecstatic';  // 玩耍时用欢快动画
    if (state.status === 'foraging') return 'walk';  // 觅食时走动

    // 根据情绪选择动画
    switch (state.derivedMood) {
        case 'ecstatic': return 'ecstatic';
        case 'exhausted': return 'exhausted';
        case 'restless': return 'restless';
        case 'anxious': return 'anxious';
    }
    return state.direction === 'left' || state.direction === 'right' ? 'walk' : 'idle';
}

if (engine) engine.play('idle'); else {
    // 回退：显示一个简单 emoji 占位
    const fallback = document.createElement('div');
    fallback.textContent = '😺';
    fallback.style.fontSize = '72px';
    fallback.style.lineHeight = '128px';
    fallback.style.textAlign = 'center';
    fallback.style.width = '128px';
    fallback.style.height = '128px';
    petEl.appendChild(fallback);
}

// 拖动实现（窗口跟随移动）
let draggingWindow = false;
let lastScreenX = 0;
let lastScreenY = 0;
let passThroughActive = false; // 由状态更新同步（主进程持久化）

petEl.addEventListener('mousedown', (e) => {
    if (passThroughActive) return; // 穿透模式禁止拖动
    draggingWindow = true;
    lastScreenX = e.screenX;
    lastScreenY = e.screenY;
});

document.addEventListener('mousemove', (e) => {
    if (!draggingWindow) return;
    const dx = e.screenX - lastScreenX;
    const dy = e.screenY - lastScreenY;
    lastScreenX = e.screenX;
    lastScreenY = e.screenY;
    if (dx !== 0 || dy !== 0) {
        window.petAPI.moveWindow(dx, dy);
    }
});

document.addEventListener('mouseup', () => {
    draggingWindow = false;
});

// 状态展示面板
const panel = document.createElement('div');
panel.style.position = 'absolute';
panel.style.left = '0';
panel.style.top = '135px';
panel.style.fontSize = '12px';
panel.style.background = 'rgba(0,0,0,0.35)';
panel.style.color = '#fff';
panel.style.padding = '4px 6px';
panel.style.borderRadius = '6px';
panel.style.fontFamily = 'sans-serif';
panel.style.lineHeight = '1.3';
panel.style.pointerEvents = 'none';
panel.style.maxWidth = '260px';
panel.style.whiteSpace = 'normal';
panel.style.wordBreak = 'break-word';
petEl.appendChild(panel);

function moodText(derivedMood) {
    switch (derivedMood) {
        case 'ecstatic': return '情绪晶格高速共鸣 (极乐)';
        case 'joyful': return '能流充盈 (愉快)';
        case 'restless': return '能量尚可但饱食度偏低 (不安)';
        case 'anxious': return '饱食度极低且能量不足 (焦虑)';
        case 'exhausted': return '能量几乎枯竭 (疲惫)';
        default: return '情绪频谱稳定 (中性)';
    }
}

function renderPanel(state) {
    const moodLine = moodText(state.derivedMood) + (state.lastAction ? ` | 最近: ${state.lastAction}` : '');
    const activityLine = state.activity ? state.activity : '';
    panel.innerHTML = `🍖${state.hunger} 😃${state.mood} ⚡${state.energy}<br/>🧼${state.cleanliness} ❤️${state.health} Lv.${state.level}` +
        `<br/><span style='opacity:.85'>${moodLine}</span>` +
        (activityLine ? `<br/><span style='opacity:.7'>${activityLine}</span>` : '');
}

// 右键菜单
const menu = document.createElement('div');
menu.style.position = 'fixed';
menu.style.background = 'rgba(30,30,30,0.9)';
menu.style.color = '#fff';
menu.style.fontSize = '13px';
menu.style.border = '1px solid #444';
menu.style.borderRadius = '8px';
menu.style.padding = '4px 0';
menu.style.display = 'none';
menu.style.minWidth = '120px';
menu.style.zIndex = '9999';
menu.style.backdropFilter = 'blur(6px)';
document.body.appendChild(menu);

const actions = [
    { key: 'feed', label: '喂食 🍖' },
    { key: 'play', label: '玩耍 🎮' },
    { key: 'sleep', label: '睡觉 😴' }
];

let passThroughItem = null;
const PASS_THROUGH_OPACITY = 0.45;

actions.forEach(a => {
    const item = document.createElement('div');
    item.textContent = a.label;
    item.style.padding = '6px 14px';
    item.style.cursor = 'pointer';
    item.addEventListener('mouseenter', () => item.style.background = '#555');
    item.addEventListener('mouseleave', () => item.style.background = 'transparent');
    item.addEventListener('click', async () => {
        hideMenu();
        await window.petAPI.performAction(a.key);
    });
    menu.appendChild(item);
});

menu.appendChild(document.createElement('hr')).style.border = 'none';
menu.lastChild.style.height = '1px';
menu.lastChild.style.background = '#444';

passThroughItem = document.createElement('div');
passThroughItem.style.padding = '6px 14px';
passThroughItem.style.cursor = 'pointer';
passThroughItem.addEventListener('mouseenter', () => passThroughItem.style.background = '#555');
passThroughItem.addEventListener('mouseleave', () => passThroughItem.style.background = 'transparent');
passThroughItem.addEventListener('click', async () => {
    hideMenu();
    await window.petAPI.togglePassThrough();
});
menu.appendChild(passThroughItem);

// 添加聊天选项
const chatItem = document.createElement('div');
chatItem.textContent = '跟我说话 💬';
chatItem.style.padding = '6px 14px';
chatItem.style.cursor = 'pointer';
chatItem.addEventListener('mouseenter', () => chatItem.style.background = '#555');
chatItem.addEventListener('mouseleave', () => chatItem.style.background = 'transparent');

chatItem.addEventListener('click', () => {
    hideMenu();
    openChatPanel();
});
menu.appendChild(chatItem);

// 添加设置选项
const settingsItem = document.createElement('div');
settingsItem.textContent = '设置 ⚙️';
settingsItem.style.padding = '6px 14px';
settingsItem.style.cursor = 'pointer';
settingsItem.addEventListener('mouseenter', () => settingsItem.style.background = '#555');
settingsItem.addEventListener('mouseleave', () => settingsItem.style.background = 'transparent');
settingsItem.addEventListener('click', () => {
    hideMenu();
    // 触发设置面板显示
    const event = new CustomEvent('open-settings');
    document.dispatchEvent(event);
});
menu.appendChild(settingsItem);

// 添加分隔线
const separator = document.createElement('hr');
separator.style.border = 'none';
separator.style.height = '1px';
separator.style.background = '#444';
separator.style.margin = '4px 0';
menu.appendChild(separator);

// 添加退出选项
const quitItem = document.createElement('div');
quitItem.textContent = '沉寂 💤';
quitItem.style.padding = '6px 14px';
quitItem.style.cursor = 'pointer';
quitItem.addEventListener('mouseenter', () => quitItem.style.background = '#555');
quitItem.addEventListener('mouseleave', () => quitItem.style.background = 'transparent');
quitItem.addEventListener('click', () => {
    hideMenu();
    if (window.petAPI && window.petAPI.quit) {
        window.petAPI.quit();
    }
});
menu.appendChild(quitItem);

function showMenu(x, y) {
    menu.style.display = 'block';
    
    // 获取菜单尺寸
    const menuRect = menu.getBoundingClientRect();
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    // 确保菜单不会超出窗口边界
    let finalX = x;
    let finalY = y;
    
    if (x + menuRect.width > windowWidth) {
        finalX = windowWidth - menuRect.width - 5;
    }
    
    if (y + menuRect.height > windowHeight) {
        finalY = windowHeight - menuRect.height - 5;
    }
    
    menu.style.left = finalX + 'px';
    menu.style.top = finalY + 'px';
}

function hideMenu() {
    menu.style.display = 'none';
}

document.addEventListener('click', (e) => {
    if (menu.style.display === 'block') hideMenu();
});

petEl.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    showMenu(e.clientX, e.clientY);
});

// 聊天气泡
const chatBubble = document.createElement('div');
chatBubble.style.position = 'absolute';
chatBubble.style.left = '140px';
chatBubble.style.top = '20px';
chatBubble.style.maxWidth = '200px';
chatBubble.style.minWidth = '80px';
chatBubble.style.background = 'rgba(255, 255, 255, 0.95)';
chatBubble.style.color = '#333';
chatBubble.style.padding = '10px 14px';
chatBubble.style.borderRadius = '12px';
chatBubble.style.fontSize = '13px';
chatBubble.style.lineHeight = '1.5';
chatBubble.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
chatBubble.style.display = 'none';
chatBubble.style.pointerEvents = 'none';
chatBubble.style.wordBreak = 'break-word';
chatBubble.style.whiteSpace = 'normal';
chatBubble.style.wordWrap = 'break-word';
chatBubble.style.fontFamily = 'sans-serif';
chatBubble.style.zIndex = '1000';
chatBubble.style.writingMode = 'horizontal-tb';
chatBubble.style.textOrientation = 'mixed';
petEl.appendChild(chatBubble);

let chatBubbleTimer = null;

// 聊天输入面板
const chatPanel = document.createElement('div');
chatPanel.style.position = 'fixed';
chatPanel.style.left = '20px';
chatPanel.style.top = '20px';
chatPanel.style.width = '240px';
chatPanel.style.background = 'rgba(20,20,30,0.92)';
chatPanel.style.border = '1px solid rgba(255,255,255,0.12)';
chatPanel.style.borderRadius = '12px';
chatPanel.style.padding = '12px';
chatPanel.style.display = 'none';
chatPanel.style.flexDirection = 'column';
chatPanel.style.gap = '8px';
chatPanel.style.color = '#fff';
chatPanel.style.fontFamily = 'sans-serif';
chatPanel.style.fontSize = '13px';
chatPanel.style.boxShadow = '0 10px 30px rgba(0,0,0,0.28)';
chatPanel.style.zIndex = '900';

const chatTitle = document.createElement('div');
chatTitle.textContent = '和浮灵聊聊';
chatTitle.style.fontWeight = '600';
chatPanel.appendChild(chatTitle);

const chatForm = document.createElement('form');
chatForm.style.display = 'flex';
chatForm.style.flexDirection = 'column';
chatForm.style.gap = '8px';
chatPanel.appendChild(chatForm);

const chatInput = document.createElement('textarea');
chatInput.rows = 3;
chatInput.placeholder = '输入想说的话...';
chatInput.style.resize = 'none';
chatInput.style.borderRadius = '8px';
chatInput.style.border = '1px solid rgba(255,255,255,0.2)';
chatInput.style.padding = '8px';
chatInput.style.fontSize = '13px';
chatInput.style.fontFamily = 'inherit';
chatInput.style.background = 'rgba(255,255,255,0.08)';
chatInput.style.color = '#fff';
chatForm.appendChild(chatInput);
chatInput.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        chatForm.requestSubmit();
    }
});

const quickReplySection = document.createElement('div');
quickReplySection.style.display = 'flex';
quickReplySection.style.flexWrap = 'wrap';
quickReplySection.style.gap = '6px';
quickReplySection.style.marginTop = '4px';

const quickReplies = [
    '浮灵，今天感觉怎么样？',
    '给我一点鼓励吧！',
    '讲个浮岛上的趣事',
    '提醒我放松一下~'
];

quickReplies.forEach(text => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = text;
    btn.style.border = '1px solid rgba(255,255,255,0.2)';
    btn.style.background = 'rgba(255,255,255,0.08)';
    btn.style.color = '#fff';
    btn.style.borderRadius = '14px';
    btn.style.padding = '4px 10px';
    btn.style.fontSize = '12px';
    btn.style.cursor = 'pointer';
    btn.addEventListener('click', () => {
        chatInput.value = text;
        chatInput.focus();
    });
    quickReplySection.appendChild(btn);
});

chatForm.appendChild(quickReplySection);

const chatActions = document.createElement('div');
chatActions.style.display = 'flex';
chatActions.style.gap = '8px';
chatActions.style.justifyContent = 'flex-end';
chatForm.appendChild(chatActions);

const cancelBtn = document.createElement('button');
cancelBtn.type = 'button';
cancelBtn.textContent = '取消';
cancelBtn.style.background = 'transparent';
cancelBtn.style.border = 'none';
cancelBtn.style.color = 'rgba(255,255,255,0.7)';
cancelBtn.style.cursor = 'pointer';
cancelBtn.addEventListener('click', () => closeChatPanel());
chatActions.appendChild(cancelBtn);

const sendBtn = document.createElement('button');
sendBtn.type = 'submit';
sendBtn.textContent = '发送';
sendBtn.style.background = '#5c7cfa';
sendBtn.style.border = 'none';
sendBtn.style.color = '#fff';
sendBtn.style.padding = '6px 14px';
sendBtn.style.borderRadius = '6px';
sendBtn.style.cursor = 'pointer';
chatActions.appendChild(sendBtn);

petEl.appendChild(chatPanel);

function openChatPanel(prefill = '') {
    chatInput.value = prefill;
    chatPanel.style.display = 'flex';
    setTimeout(() => chatInput.focus(), 0);
}

function closeChatPanel() {
    chatPanel.style.display = 'none';
}

function showChatBubble(message, duration = 5000) {
    chatBubble.textContent = message;
    chatBubble.style.display = 'block';

    if (chatBubbleTimer) clearTimeout(chatBubbleTimer);
    chatBubbleTimer = setTimeout(() => {
        chatBubble.style.display = 'none';
    }, duration);
}

let chatBusy = false;

function setChatBusy(isBusy) {
    chatBusy = isBusy;
    chatInput.disabled = isBusy;
    sendBtn.disabled = isBusy;
    sendBtn.textContent = isBusy ? '发送中…' : '发送';
}

async function triggerChat(userMessage = '') {
    const message = userMessage.trim();
    if (chatBusy) return;
    setChatBusy(true);
    if (message) {
        showChatBubble(`你：「${message}」\n浮灵思考中...`, 30000);
    } else {
        showChatBubble('浮灵思考中...', 30000);
    }

    let success = false;
    try {
        const result = await window.petAPI.chat(message);
        if (result.success) {
            showChatBubble(result.message, 8000);
            success = true;
        } else {
            showChatBubble(`呜... ${result.error}`, 5000);
        }
    } catch (error) {
        showChatBubble('哎呀，我说不出话了...', 3000);
        console.error('[pet] 聊天失败:', error);
    } finally {
        setChatBusy(false);
        if (success) {
            chatInput.value = '';
        } else if (!message) {
            chatInput.value = '';
        } else {
            chatInput.value = message;
        }
        setTimeout(() => chatInput.focus(), 0);
    }
}

chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await triggerChat(chatInput.value);
});

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        closeChatPanel();
    }
});

// 双击触发聊天
petEl.addEventListener('dblclick', (e) => {
    e.preventDefault();
    triggerChat('');
});

// IPC 状态更新监听
window.petAPI.onState((state) => {
    renderPanel(state);
    updatePassThroughLabel(state.passThrough);
    applyDirection(state.direction);
    applySleep(state.status === 'sleeping');
    passThroughActive = !!state.passThrough;
});

// 初始加载状态
(async () => {
    const s = await window.petAPI.getState();
    renderPanel(s);
    updatePassThroughLabel(s.passThrough);
    applyDirection(s.direction);
    applySleep(s.status === 'sleeping');
    passThroughActive = !!s.passThrough;
})();

function updatePassThroughLabel(isOn) {
    passThroughItem.textContent = isOn ? '关闭穿透 ⛔' : '开启穿透 🌀';
    applyPassThrough(isOn);
}

function applyPassThrough(isOn) {
    // 降低整体不透明度，以便更好地融入桌面
    petEl.style.opacity = isOn ? PASS_THROUGH_OPACITY : 1;
}

function applyDirection(dir) {
    if (!dir) return;
    petEl.classList.toggle('direction-left', dir === 'left');
}

function applySleep(isSleeping) {
    if (engine) engine.setSleepMode(isSleeping);
}

// 初始化已在 engine.play('idle') 完成

// 在状态更新回调中增加动画选择
const originalOnState = window.petAPI.onState;
// (保持已有调用方式，已在上面绑定，这里不改原 expose，只添加逻辑在现有监听内)
// 由于我们已注册一次 onState，上面代码段即可，这里补充在现有 listener 内：
// 直接覆盖之前注册的回调：
window.petAPI.onState((state) => {
    renderPanel(state);
    updatePassThroughLabel(state.passThrough);
    applyDirection(state.direction);
    applySleep(state.status === 'sleeping');
    passThroughActive = !!state.passThrough;
    const seq = selectAnimation(state);
    if (seq) playSeq(seq);
});

(async () => {
    const s = await window.petAPI.getState();
    renderPanel(s);
    updatePassThroughLabel(s.passThrough);
    applyDirection(s.direction);
    applySleep(s.status === 'sleeping');
    passThroughActive = !!s.passThrough;
    const seq = selectAnimation(s);
    if (seq) playSeq(seq);
    console.log('[pet] 初始状态加载完成');
})();

// === 设置面板逻辑 ===
// 等待 DOM 加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    const settingsPanel = document.getElementById('settings-panel');
    const apiKeyInput = document.getElementById('api-key');
    const baseUrlInput = document.getElementById('base-url');
    const modelInput = document.getElementById('model');
    const saveBtn = document.getElementById('save-config');
    const cancelBtn = document.getElementById('cancel-config');
    const statusDiv = document.getElementById('config-status');

    if (!settingsPanel || !apiKeyInput || !baseUrlInput || !modelInput) {
        console.warn('[settings] 设置面板元素未找到');
        return;
    }

    function showSettings() {
        settingsPanel.classList.remove('hidden');
        loadCurrentConfig();
    }

    function hideSettings() {
        settingsPanel.classList.add('hidden');
        statusDiv.textContent = '';
        statusDiv.className = 'config-status';
    }

    async function loadCurrentConfig() {
        try {
            const config = await window.petAPI.getChatConfig();
            apiKeyInput.value = config.apiKey === '***已配置***' ? '' : config.apiKey;
            baseUrlInput.value = config.baseURL || '';
            modelInput.value = config.model || '';
        } catch (e) {
            console.error('[settings] 加载配置失败:', e);
        }
    }

    async function saveConfig() {
        const config = {
            apiKey: apiKeyInput.value.trim(),
            baseURL: baseUrlInput.value.trim(),
            model: modelInput.value.trim()
        };

        if (!config.apiKey) {
            statusDiv.textContent = '请输入 API Key';
            statusDiv.className = 'config-status error';
            return;
        }

        try {
            await window.petAPI.updateChatConfig(config);
            statusDiv.textContent = '保存成功！';
            statusDiv.className = 'config-status success';
            setTimeout(() => hideSettings(), 1500);
        } catch (e) {
            statusDiv.textContent = '保存失败: ' + e.message;
            statusDiv.className = 'config-status error';
        }
    }

    saveBtn.addEventListener('click', saveConfig);
    cancelBtn.addEventListener('click', hideSettings);

    // 监听来自主进程的显示设置事件
    if (window.petAPI && window.petAPI.onShowSettings) {
        window.petAPI.onShowSettings(() => {
            showSettings();
        });
    }

    // 监听来自右键菜单的显示设置事件
    document.addEventListener('open-settings', () => {
        showSettings();
    });
});

