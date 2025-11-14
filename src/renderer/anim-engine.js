// 轻量 Canvas 动画引擎
// - 不使用外部库
// - 支持根据 key 切换帧序列
// - 睡眠时降低刷新频率

console.log('[anim-engine] script start');

class AnimationEngine {
    constructor(canvas, opts = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.fpsActive = opts.fpsActive || 30;
        this.fpsSleep = opts.fpsSleep || 6;
        this.sequences = {}; // key -> { frames:[], frameDuration:number }
        this.currentKey = null;
        this._accum = 0;
        this._lastTs = 0;
        this._frameIndex = 0;
        this._running = false;
        this._sleepMode = false;
        this.bgColor = 'rgba(0,0,0,0)';
    }

    define(key, frames, frameDuration = 100) {
        this.sequences[key] = { frames, frameDuration };
    }

    play(key) {
        if (!this.sequences[key]) return;
        if (this.currentKey !== key) {
            this.currentKey = key;
            this._frameIndex = 0;
            this._accum = 0;
        }
        if (!this._running) this.start();
        // 立即绘制首帧，避免初始空白
        const seq = this.sequences[this.currentKey];
        if (seq) {
            this._renderFrame(seq.frames[this._frameIndex]);
        }
    }

    setSleepMode(on) { this._sleepMode = !!on; }

    start() {
        this._running = true;
        this._lastTs = performance.now();
        requestAnimationFrame(this._loop.bind(this));
    }

    stop() { this._running = false; }

    _loop(ts) {
        if (!this._running) return;
        const delta = ts - this._lastTs;
        this._lastTs = ts;
        this._accum += delta;

        const seq = this.sequences[this.currentKey];
        if (seq) {
            const targetFps = this._sleepMode ? this.fpsSleep : this.fpsActive;
            const frameInterval = 1000 / targetFps;
            if (this._accum >= frameInterval) {
                this._accum = 0;
                this._frameIndex = (this._frameIndex + 1) % seq.frames.length;
                this._renderFrame(seq.frames[this._frameIndex]);
            }
        }
        requestAnimationFrame(this._loop.bind(this));
    }

    _renderFrame(frame) {
        const { ctx, canvas } = this;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = this.bgColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        if (!frame) return;
        // frame: { draw(ctx, canvas, frameIndex) } OR string emoji
        if (typeof frame === 'string') {
            ctx.font = '64px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(frame, canvas.width / 2, canvas.height / 2);
        } else if (typeof frame.draw === 'function') {
            frame.draw(ctx, canvas, this._frameIndex);
        }
    }
}

// 生成占位帧帮助函数
function makeColorFrame(color, emoji) {
    return {
        draw(ctx, canvas) {
            // 绘制柔和渐变背景
            const gradient = ctx.createRadialGradient(
                canvas.width / 2, canvas.height / 2, 10,
                canvas.width / 2, canvas.height / 2, 70
            );
            gradient.addColorStop(0, color);
            gradient.addColorStop(1, adjustBrightness(color, -0.2));

            ctx.fillStyle = gradient;
            ctx.roundRect(10, 10, canvas.width - 20, canvas.height - 20, 30);
            ctx.fill();

            // 添加柔和阴影
            ctx.shadowColor = 'rgba(0,0,0,0.15)';
            ctx.shadowBlur = 8;
            ctx.shadowOffsetY = 4;

            // 绘制 emoji
            ctx.font = 'bold 64px "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#fff';
            ctx.fillText(emoji, canvas.width / 2, canvas.height / 2);

            // 重置阴影
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetY = 0;
        }
    };
}

// 异世界小猫绘制函数
function makeAerialCat(mood, frame = 0) {
    return {
        draw(ctx, canvas) {
            const w = canvas.width;
            const h = canvas.height;
            const cx = w / 2;
            const cy = h / 2;

            // 清空背景
            ctx.clearRect(0, 0, w, h);

            // 根据情绪选择配色
            const colors = getMoodColors(mood);

            // 绘制环境能量粒子（背景）
            drawEnergyParticles(ctx, w, h, colors.particle, frame);

            // 绘制浮岛碎片（底座）
            drawFloatingIsland(ctx, cx, cy + 35, colors.island);

            // 绘制小猫身体
            drawCatBody(ctx, cx, cy, colors, frame);

            // 绘制情绪晶格光环
            drawEmotionAura(ctx, cx, cy, colors.aura, mood, frame);

            // 绘制能量流（前景）
            drawEnergyFlow(ctx, w, h, colors.flow, frame);
        }
    };
}

function getMoodColors(mood) {
    const palettes = {
        ecstatic: {
            primary: '#FFD700',
            secondary: '#FFA500',
            particle: '#FFEC8B',
            island: '#C8A696',
            aura: '#FFE87C',
            flow: '#FFB90F'
        },
        joyful: {
            primary: '#87CEEB',
            secondary: '#4682B4',
            particle: '#B0E2FF',
            island: '#8B7D6B',
            aura: '#87CEFF',
            flow: '#63B8FF'
        },
        neutral: {
            primary: '#B0C4DE',
            secondary: '#778899',
            particle: '#CAE1FF',
            island: '#8B8378',
            aura: '#B0C4DE',
            flow: '#9FB6CD'
        },
        restless: {
            primary: '#FF8C69',
            secondary: '#CD5C5C',
            particle: '#FFA07A',
            island: '#8B7355',
            aura: '#FF7F50',
            flow: '#FF6347'
        },
        anxious: {
            primary: '#DDA0DD',
            secondary: '#9370DB',
            particle: '#EED5D2',
            island: '#8B7B8B',
            aura: '#D8BFD8',
            flow: '#BA55D3'
        },
        exhausted: {
            primary: '#696969',
            secondary: '#2F4F4F',
            particle: '#B0B0B0',
            island: '#4A4A4A',
            aura: '#808080',
            flow: '#5F5F5F'
        }
    };
    return palettes[mood] || palettes.neutral;
}

function drawEnergyParticles(ctx, w, h, color, frame) {
    const count = 8;
    for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + frame * 0.02;
        const radius = 40 + Math.sin(frame * 0.03 + i) * 10;
        const x = w / 2 + Math.cos(angle) * radius;
        const y = h / 2 + Math.sin(angle) * radius;
        const size = 2 + Math.sin(frame * 0.05 + i) * 1;

        ctx.fillStyle = color;
        ctx.globalAlpha = 0.4 + Math.sin(frame * 0.04 + i) * 0.2;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

function drawFloatingIsland(ctx, cx, cy, color) {
    // 浮岛碎片
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 25, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // 底部细节
    ctx.fillStyle = adjustBrightness(color, -0.3);
    ctx.beginPath();
    ctx.ellipse(cx, cy + 2, 20, 6, 0, 0, Math.PI * 2);
    ctx.fill();
}

function drawCatBody(ctx, cx, cy, colors, frame) {
    const bounce = Math.sin(frame * 0.08) * 2;
    const catY = cy + bounce;

    // 阴影
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 30, 20, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // 尾巴
    ctx.strokeStyle = colors.secondary;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    const tailWave = Math.sin(frame * 0.1) * 10;
    ctx.moveTo(cx - 15, catY + 5);
    ctx.quadraticCurveTo(cx - 25 + tailWave, catY - 5, cx - 20, catY - 15);
    ctx.stroke();

    // 身体
    ctx.fillStyle = colors.primary;
    ctx.beginPath();
    ctx.ellipse(cx, catY, 18, 22, 0, 0, Math.PI * 2);
    ctx.fill();

    // 头部
    ctx.beginPath();
    ctx.arc(cx, catY - 18, 14, 0, Math.PI * 2);
    ctx.fill();

    // 耳朵
    ctx.beginPath();
    ctx.moveTo(cx - 10, catY - 26);
    ctx.lineTo(cx - 6, catY - 18);
    ctx.lineTo(cx - 14, catY - 20);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx + 10, catY - 26);
    ctx.lineTo(cx + 6, catY - 18);
    ctx.lineTo(cx + 14, catY - 20);
    ctx.fill();

    // 眼睛
    const blinkPhase = Math.sin(frame * 0.15);
    const eyeHeight = blinkPhase > 0.9 ? 2 : 4;
    ctx.fillStyle = '#2F4F4F';
    ctx.beginPath();
    ctx.ellipse(cx - 5, catY - 20, 2, eyeHeight, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 5, catY - 20, 2, eyeHeight, 0, 0, Math.PI * 2);
    ctx.fill();

    // 鼻子
    ctx.fillStyle = colors.secondary;
    ctx.beginPath();
    ctx.arc(cx, catY - 16, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // 腿
    ctx.strokeStyle = colors.secondary;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 8, catY + 10);
    ctx.lineTo(cx - 8, catY + 20);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + 8, catY + 10);
    ctx.lineTo(cx + 8, catY + 20);
    ctx.stroke();
}

function drawEmotionAura(ctx, cx, cy, color, mood, frame) {
    const pulseSize = 35 + Math.sin(frame * 0.06) * 5;
    const gradient = ctx.createRadialGradient(cx, cy, 10, cx, cy, pulseSize);
    gradient.addColorStop(0, 'transparent');
    gradient.addColorStop(0.7, color + '20');
    gradient.addColorStop(1, 'transparent');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, pulseSize, 0, Math.PI * 2);
    ctx.fill();
}

function drawEnergyFlow(ctx, w, h, color, frame) {
    // 晶丝能量流（前景细线）
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.3;

    for (let i = 0; i < 3; i++) {
        const startY = (frame * 0.5 + i * 30) % h;
        ctx.beginPath();
        ctx.moveTo(0, startY);
        for (let x = 0; x < w; x += 10) {
            const y = startY + Math.sin(x * 0.05 + frame * 0.02) * 5;
            ctx.lineTo(x, y);
        }
        ctx.stroke();
    }
    ctx.globalAlpha = 1;
}

// 调整颜色亮度辅助函数
function adjustBrightness(hex, percent) {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent * 100);
    const R = Math.max(0, Math.min(255, (num >> 16) + amt));
    const G = Math.max(0, Math.min(255, (num >> 8 & 0x00FF) + amt));
    const B = Math.max(0, Math.min(255, (num & 0x0000FF) + amt));
    return '#' + (0x1000000 + (R * 0x10000) + (G * 0x100) + B).toString(16).slice(1);
}// 圆角扩展（Safari 兼容性：如果不存在则替代）
CanvasRenderingContext2D.prototype.roundRect = CanvasRenderingContext2D.prototype.roundRect || function (x, y, w, h, r) {
    const radius = r || 0;
    this.beginPath();
    this.moveTo(x + radius, y);
    this.lineTo(x + w - radius, y);
    this.quadraticCurveTo(x + w, y, x + w, y + radius);
    this.lineTo(x + w, y + h - radius);
    this.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    this.lineTo(x + radius, y + h);
    this.quadraticCurveTo(x, y + h, x, y + h - radius);
    this.lineTo(x, y + radius);
    this.quadraticCurveTo(x, y, x + radius, y);
    this.closePath();
    return this;
};

// UMD 兼容：在无 module.exports 时挂载到 window
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AnimationEngine, makeColorFrame };
}
// 始终挂载到 window 以便 contextIsolation 下访问
window.AnimationEngine = AnimationEngine;
window.makeColorFrame = makeColorFrame;
window.makeAerialCat = makeAerialCat;
window.adjustBrightness = adjustBrightness;
// 调试：暴露当前实例引用容器
window.__petEngineRefs = window.__petEngineRefs || [];
console.log('[anim-engine] loaded, globals set');
