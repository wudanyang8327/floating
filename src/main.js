// 主进程入口
const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, screen, globalShortcut } = require('electron');
const path = require('path');

// 业务 & 存储模块
const { feed, play, sleepAction, applyTick, normalizeState, DEFAULT_STATE } = require('./core/state-rules');
const { loadState, saveState } = require('./services/state-storage');
const { sendMessage } = require('./services/chat-service');
const { loadApiConfig, updateApiConfig: saveApiConfig, getConfigPath } = require('./services/api-config');

// electron-store 原始实例用于窗口位置等附加字段保存
let store;

// 默认状态（来自核心模块）
const defaultState = { ...DEFAULT_STATE, lastAction: '初始', activity: '等待指令' };

let petState = { ...defaultState }; // 初始化后再合并持久化数据

// 聊天配置（从 data/petAPI.json 读取）
let chatConfig = {
    apiKey: '',
    baseURL: 'https://api.openai.com/v1',
    model: 'gpt-3.5-turbo'
};

async function initStore() {
    const mod = await import('electron-store');
    const ElectronStore = mod.default;
    const fs = require('fs');
    // 使用 userData 目录，开发和打包后都能正确工作
    const dataDir = path.join(app.getPath('userData'), 'data');
    try {
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    } catch (e) {
        console.error('创建数据目录失败:', e);
    }
    store = new ElectronStore({ name: 'pet-state', cwd: dataDir });
    // 使用新存储层读取并归一化
    const persisted = store.get('petState') || {};
    petState = normalizeState({ ...persisted });

    // 从 data/petAPI.json 读取聊天配置
    chatConfig = loadApiConfig();
    console.log('[main] API 配置已加载:', getConfigPath());
    console.log('[main] 数据目录:', dataDir);
}

let mainWindow;
let tray;
let moveDirection = 1; // 1 右 -1 左
let autoMoveInterval;
let sleepCheckInterval;
let boundsSaveTimer = null;

function createWindow() {
    // 读取窗口位置
    const storedBounds = store.get('windowBounds');
    mainWindow = new BrowserWindow({
        width: storedBounds?.width || 300,
        height: storedBounds?.height || 300,
        x: storedBounds?.x,
        y: storedBounds?.y,
        transparent: true,
        frame: false,
        resizable: false,
        alwaysOnTop: true,
        hasShadow: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            enableRemoteModule: false,
            nodeIntegration: false,
        }
    });

    mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

    // 开发模式打开开发者工具
    if (process.env.NODE_ENV !== 'production') {
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    }

    // 启动时应用穿透状态
    if (petState.passThrough) {
        mainWindow.setIgnoreMouseEvents(true, { forward: true });
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // 监听移动/关闭保存位置（节流）
    const scheduleSaveBounds = () => {
        if (boundsSaveTimer) clearTimeout(boundsSaveTimer);
        boundsSaveTimer = setTimeout(() => {
            if (!mainWindow) return;
            const b = mainWindow.getBounds();
            store.set('windowBounds', b);
        }, 400);
    };

    mainWindow.on('move', scheduleSaveBounds);
    mainWindow.on('close', () => {
        if (!mainWindow) return;
        store.set('windowBounds', mainWindow.getBounds());
    });
}

function createTray() {
    // 简易的 tray 图标（使用 emoji 创建 dataURL）
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'><text x='50%' y='54%' font-size='48' text-anchor='middle' dominant-baseline='middle'>😺</text></svg>`;
    const img = nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`);
    tray = new Tray(img);
    tray.setToolTip('桌面宠物');
    updateTrayTitle();
    buildTrayMenu();
    console.log('[main] Tray 创建成功');
}

function buildTrayMenu() {
    const contextMenu = Menu.buildFromTemplate([
        { label: `等级 Lv.${petState.level}`, enabled: false },
        { type: 'separator' },
        { label: '喂食', click: () => performAction('feed') },
        { label: '玩耍', click: () => performAction('play') },
        { label: '睡觉', click: () => performAction('sleep') },
        { type: 'separator' },
        { label: '设置', click: () => showSettings() },
        { label: '退出', click: () => app.quit() }
    ]);
    tray.setContextMenu(contextMenu);
}

function updateTrayTitle() {
    if (!tray) return;
    tray.setTitle(`🍖${petState.hunger} 😃${petState.mood}`);
    tray.setToolTip(`饱食:${petState.hunger} 心情:${petState.mood} 等级:${petState.level}`);
}

function clamp(val) { return Math.max(0, Math.min(100, val)); }

function performAction(action) {
    const beforeStatus = petState.status;
    let next;
    switch (action) {
        case 'feed':
            next = feed(petState);
            break;
        case 'play':
            next = play(petState);
            break;
        case 'sleep':
            next = sleepAction(petState);
            break;
        default:
            return petState;
    }
    // 保留 derivedMood + 设置动作描述
    petState = { ...normalizeState({ ...petState, ...next }), derivedMood: next.derivedMood };
    switch (action) {
        case 'feed':
            petState.lastAction = '喂食';
            petState.activity = '正在享用安抚碎片 🍖';
            break;
        case 'play':
            petState.lastAction = '玩耍';
            petState.activity = '正在开心玩耍 🎮';
            break;
        case 'sleep':
            petState.lastAction = '睡觉';
            petState.activity = '进入共鸣休眠状态 😴';
            break;
    }
    // 根据状态变化控制自动移动
    if (beforeStatus !== petState.status) {
        // 停止自动移动的状态：睡觉、吃饭、玩耍
        const shouldStopMove = ['sleeping', 'eating', 'playing'].includes(petState.status);
        if (shouldStopMove) {
            stopAutoMove();
        } else {
            startAutoMove();
        }
    }
    broadcastState();
    persistState();
    updateTrayTitle();
    buildTrayMenu();
    return petState;
}

// 经验计算已移动至核心纯函数中 (feed/play 内部处理)

function decayTick() {
    const previousStatus = petState.status;
    const tickResult = applyTick(petState);
    petState = { ...normalizeState({ ...petState, ...tickResult }), derivedMood: tickResult.derivedMood };

    // 根据状态更新活动描述
    switch (petState.status) {
        case 'sleeping':
            petState.activity = '休眠恢复能量 💤';
            break;
        case 'eating':
            petState.activity = '正在享用安抚碎片 🍖';
            break;
        case 'playing':
            petState.activity = '正在开心玩耍 🎮';
            break;
        case 'foraging':
            petState.activity = '自主觅食中 🌿';
            break;
        default:
            petState.activity = '漂浮游走，缓慢消耗能流';
    }

    // 处理状态变化的自动移动副作用
    if (previousStatus !== petState.status) {
        const shouldStopMove = ['sleeping', 'eating', 'playing'].includes(petState.status);
        if (shouldStopMove) {
            stopAutoMove();
        } else {
            startAutoMove();
        }
    }
    persistState();
    broadcastState();
    updateTrayTitle();
}

// 睡眠/醒来逻辑已整合到纯函数与 performAction + decayTick 里，保留占位避免误调用
function startSleep() { /* deprecated: use performAction('sleep') */ }
function wakeUp() { /* deprecated: managed by applyTick */ }

function persistState() { if (store) store.set('petState', petState); }

function broadcastState() {
    if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('pet-state', petState);
    }
}

function startDecayLoop() {
    setInterval(decayTick, 60 * 1000); // 每分钟衰减一次
}

function startAutoMove() {
    stopAutoMove();
    const display = screen.getPrimaryDisplay();
    autoMoveInterval = setInterval(() => {
        if (!mainWindow) return;
        // 静止状态（睡觉、吃饭、玩耍）不自动移动
        if (['sleeping', 'eating', 'playing'].includes(petState.status)) return;
        const { x, y } = mainWindow.getBounds();
        const newX = x + (4 * moveDirection); // 降低移动距离：8 -> 4
        // 屏幕边界检查
        if (newX + 300 > display.bounds.width - 10) moveDirection = -1;
        if (newX < 10) moveDirection = 1;
        petState.direction = moveDirection === 1 ? 'right' : 'left';
        mainWindow.setPosition(x + (4 * moveDirection), y);
        broadcastState(); // 更新方向
    }, 1800); // 增加间隔：1200ms -> 1800ms
}

function stopAutoMove() {
    if (autoMoveInterval) clearInterval(autoMoveInterval);
    autoMoveInterval = null;
}

function togglePassThrough() {
    petState.passThrough = !petState.passThrough;
    if (mainWindow) {
        if (petState.passThrough) {
            console.log('[main] enable pass-through');
            mainWindow.setIgnoreMouseEvents(true, { forward: true });
        } else {
            console.log('[main] disable pass-through');
            mainWindow.setIgnoreMouseEvents(false);
        }
    }
    persistState();
    broadcastState();
}

// 聊天相关函数
async function chat(userMessage = '') {
    try {
        const response = await sendMessage(chatConfig, petState, userMessage);
        return { success: true, message: response };
    } catch (error) {
        console.error('[main] 聊天失败:', error);
        return { success: false, error: error.message };
    }
}

function updateChatConfig(newConfig) {
    chatConfig = saveApiConfig(newConfig);
    return chatConfig;
}

function getChatConfig() {
    return {
        ...chatConfig,
        apiKey: chatConfig.apiKey ? '***已配置***' : '',
        configPath: getConfigPath()
    };
}

function showSettings() {
    console.log('[main] showSettings 被调用');
    if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('show-settings');
        console.log('[main] 已发送 show-settings 事件');
    } else {
        console.error('[main] mainWindow 不存在或未就绪');
    }
}


// IPC
ipcMain.handle('perform-action', (_, action) => { performAction(action); return petState; });
ipcMain.handle('get-state', () => petState);
ipcMain.handle('move-window', (_, dx, dy) => {
    if (!mainWindow) return;
    const { x, y } = mainWindow.getBounds();
    mainWindow.setPosition(x + dx, y + dy);
});
ipcMain.handle('get-display-bounds', () => screen.getPrimaryDisplay().bounds);
ipcMain.handle('toggle-pass-through', () => { togglePassThrough(); return petState.passThrough; });
ipcMain.handle('chat', async (_, userMessage) => await chat(userMessage));
ipcMain.handle('update-chat-config', (_, config) => updateChatConfig(config));
ipcMain.handle('get-chat-config', () => getChatConfig());
ipcMain.on('quit-app', () => {
    console.log('[main] 收到退出请求');
    app.quit();
});

app.whenReady().then(async () => {
    await initStore();
    createWindow();
    createTray();
    startDecayLoop();
    startAutoMove();

    // 注册全局快捷键：Cmd+Ctrl+8 切换穿透
    globalShortcut.register('CommandOrControl+Ctrl+8', () => {
        console.log('[main] global shortcut triggered: toggle pass-through');
        togglePassThrough();
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    // macOS 上通常保持应用，其他平台则退出
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('will-quit', () => {
    // 注销所有快捷键
    globalShortcut.unregisterAll();
});

