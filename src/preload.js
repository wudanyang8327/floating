// 预加载脚本：安全桥接 API
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('petAPI', {
    getState: () => ipcRenderer.invoke('get-state'),
    performAction: (action) => ipcRenderer.invoke('perform-action', action),
    moveWindow: (dx, dy) => ipcRenderer.invoke('move-window', dx, dy),
    getDisplayBounds: () => ipcRenderer.invoke('get-display-bounds'),
    togglePassThrough: () => ipcRenderer.invoke('toggle-pass-through'),
    // 聊天相关
    chat: (userMessage) => ipcRenderer.invoke('chat', userMessage),
    updateChatConfig: (config) => ipcRenderer.invoke('update-chat-config', config),
    getChatConfig: () => ipcRenderer.invoke('get-chat-config'),
    // 应用控制
    quit: () => ipcRenderer.send('quit-app'),
    onState: (cb) => {
        ipcRenderer.removeAllListeners('pet-state');
        ipcRenderer.on('pet-state', (_, state) => cb(state));
    },
    onShowSettings: (cb) => {
        ipcRenderer.removeAllListeners('show-settings');
        ipcRenderer.on('show-settings', () => cb());
    }
});
