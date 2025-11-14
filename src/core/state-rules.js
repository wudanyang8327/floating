// 业务纯函数集合：状态归一化与规则应用
// 说明：当前已有 main.js 中的状态逻辑使用 "hunger" 代表饱食度（高=饱），与世界观文档中 "hunger 高=耗损" 存在语义差异。
// 为避免突然反转导致 UI 与现有持久化错配，此处暂保持现有语义（高=饱）。后续若迁移：可新增字段或统一重命名。

const CLAMP_MIN = 0;
const CLAMP_MAX = 100;

// 经验升级需求基数（level * EXP_BASE）
const EXP_BASE = 50;

// Mood 阈值（基于世界观建议，适配当前变量意义：低 hunger 更差，这里做简单映射继续使用现有范围）
// 解释：因为当前 hunger 高代表更饱，我们将原文条件中 "hunger ≤ 10" (耗损低) 映射为 "hunger ≥ 90" (饱足高)
// 后续如语义调整，可直接替换映射逻辑而不是阈值常量。
const MOOD_THRESHOLDS = Object.freeze({
    ECSTATIC_ENERGY: 90,
    ECSTATIC_HUNGER: 90,
    JOYFUL_ENERGY: 70,
    JOYFUL_HUNGER: 75, // 原 ≤25 转换为 ≥75
    RESTLESS_HUNGER: 40, // 原 ≥60(耗损大) -> 低饱 ≤40
    RESTLESS_ENERGY: 40,
    ANXIOUS_HUNGER: 25, // 原 ≥75(耗损巨大) -> 低饱 ≤25
    ANXIOUS_ENERGY: 40,
    EXHAUSTED_ENERGY: 15
});

function clamp(v) { return Math.max(CLAMP_MIN, Math.min(CLAMP_MAX, v)); }

// 默认状态基线
const DEFAULT_STATE = Object.freeze({
    hunger: 80,
    mood: 70,
    cleanliness: 90,
    energy: 85,
    health: 95,
    exp: 0,
    level: 1,
    status: 'normal',
    direction: 'right',
    passThrough: false,
    feedingProgress: 0,  // 喂食后缓慢恢复进度 (0-100)
    playingProgress: 0,  // 玩耍进度 (0-100)
    eatingDuration: 0    // 吃饭动作持续时间（tick 计数）
});

function normalizeState(state) {
    const s = { ...DEFAULT_STATE, ...(state || {}) };
    // 基本数值归一化
    for (const k of ['hunger', 'mood', 'cleanliness', 'energy', 'health']) {
        s[k] = clamp(Number.isFinite(s[k]) ? s[k] : DEFAULT_STATE[k]);
    }
    s.exp = Number.isFinite(s.exp) ? Math.max(0, s.exp) : 0;
    s.level = Number.isFinite(s.level) ? Math.max(1, Math.round(s.level)) : 1;
    s.feedingProgress = Number.isFinite(s.feedingProgress) ? clamp(s.feedingProgress) : 0;
    s.playingProgress = Number.isFinite(s.playingProgress) ? clamp(s.playingProgress) : 0;
    s.eatingDuration = Number.isFinite(s.eatingDuration) ? Math.max(0, s.eatingDuration) : 0;
    const validStatuses = ['sleeping', 'normal', 'foraging', 'eating', 'playing'];
    if (!validStatuses.includes(s.status)) s.status = 'normal';
    if (s.direction !== 'left' && s.direction !== 'right') s.direction = 'right';
    s.passThrough = !!s.passThrough;
    return s;
}

// mood 派生：返回字符串，不修改入参
function deriveMood(state) {
    const s = normalizeState(state);
    const { hunger, energy } = s;
    // 顺序即优先级
    if (energy >= MOOD_THRESHOLDS.ECSTATIC_ENERGY && hunger >= MOOD_THRESHOLDS.ECSTATIC_HUNGER) return 'ecstatic';
    if (energy >= MOOD_THRESHOLDS.JOYFUL_ENERGY && hunger >= MOOD_THRESHOLDS.JOYFUL_HUNGER) return 'joyful';
    // 低能量优先判断极端状态
    if (energy <= MOOD_THRESHOLDS.EXHAUSTED_ENERGY) return 'exhausted';
    // restless 与 anxious 根据饱食度低与能量组合
    if (hunger <= MOOD_THRESHOLDS.RESTLESS_HUNGER && energy >= MOOD_THRESHOLDS.RESTLESS_ENERGY) return 'restless';
    if (hunger <= MOOD_THRESHOLDS.ANXIOUS_HUNGER && energy < MOOD_THRESHOLDS.ANXIOUS_ENERGY) return 'anxious';
    return 'neutral';
}

// 升级判定（不修改入参），返回 { state, leveledUp: boolean }
function applyExp(state, gained) {
    const s = normalizeState(state);
    const expGain = Math.max(0, gained || 0);
    let newExp = s.exp + expGain;
    let newLevel = s.level;
    let newHealth = s.health;
    let leveledUp = false;
    const need = newLevel * EXP_BASE;
    if (newExp >= need) {
        newExp -= need;
        newLevel += 1;
        leveledUp = true;
        newHealth = clamp(newHealth + 5);
    }
    const res = { ...s, exp: newExp, level: newLevel, health: newHealth };
    res.mood = clamp(res.mood); // ensure
    return { state: res, leveledUp };
}

// 通用状态合成与 mood 更新
function finalize(next) {
    const normalized = normalizeState(next);
    return { ...normalized, mood: clamp(normalized.mood), derivedMood: deriveMood(normalized) };
}

// Action: 喂食（进入吃饭状态，设置进度）
function feed(state) {
    const s = normalizeState(state);
    // 进入吃饭状态：显示吃饭动画 3 个 tick，然后启动消化进度
    let next = {
        ...s,
        status: 'eating',
        eatingDuration: 3,  // 吃饭动作持续 3 tick (3分钟)
        feedingProgress: 100,
        mood: clamp(s.mood + 3)
    };
    const expApplied = applyExp(next, 5);
    next = expApplied.state;
    return finalize(next);
}

// Action: 玩耍（进入玩耍状态）
function play(state) {
    const s = normalizeState(state);
    // 进入玩耍状态：持续 5 tick，期间提升心情
    let next = {
        ...s,
        status: 'playing',
        playingProgress: 5,  // 玩耍持续 5 tick (5分钟)
        mood: clamp(s.mood + 5),
        energy: clamp(s.energy - 3)
    };
    const expApplied = applyExp(next, 6);
    next = expApplied.state;
    return finalize(next);
}

// Action: 睡觉（主动触发）
function sleepAction(state) {
    const s = normalizeState(state);
    let next = { ...s, energy: clamp(s.energy + 20), mood: clamp(s.mood + 3) };
    next.status = 'sleeping';
    return finalize(next);
}

// Tick 衰减（每分钟）
function applyTick(state) {
    const s = normalizeState(state);
    let next = { ...s };

    // 处理吃饭动作
    if (next.status === 'eating') {
        if (next.eatingDuration > 0) {
            next.eatingDuration -= 1;
            // 吃饭中不消耗，稍微提升心情
            next.mood = clamp(next.mood + 1);
        }
        if (next.eatingDuration <= 0) {
            next.status = 'normal';  // 吃完恢复正常
        }
    }

    // 处理玩耍进度
    if (next.status === 'playing') {
        if (next.playingProgress > 0) {
            next.playingProgress -= 1;
            next.mood = clamp(next.mood + 2);  // 每 tick 提升心情
            next.energy = clamp(next.energy - 1);  // 消耗能量
        }
        if (next.playingProgress <= 0) {
            next.status = 'normal';  // 玩完恢复正常
        }
    }

    // 处理喂食进度：每 tick 消耗 10 进度，恢复 2 饱食度
    if (next.feedingProgress > 0) {
        const consumeProgress = Math.min(10, next.feedingProgress);
        next.feedingProgress -= consumeProgress;
        next.hunger = clamp(next.hunger + Math.floor(consumeProgress / 5)); // 每消耗5进度恢复1饱食
        next.mood = clamp(next.mood + 1);
    }

    if (s.status === 'sleeping') {
        next.energy = clamp(s.energy + 4);
        next.mood = clamp(s.mood + 1);
        if (next.energy >= 65) { // 醒来阈值与现有逻辑保持一致
            next.status = 'normal';
        }
    } else if (s.status === 'foraging') {
        // 觅食中：缓慢恢复饱食度，消耗少量能量
        next.hunger = clamp(s.hunger + 3);
        next.energy = clamp(s.energy - 0.5);
        next.mood = clamp(s.mood + 1);
        // 觅食成功条件：饱食度恢复到 50 以上
        if (next.hunger >= 50) {
            next.status = 'normal';
        }
    } else if (s.status === 'normal') {
        // 正常状态衰减（吃饭和玩耍中不衰减）
        next.hunger = clamp(s.hunger - 1); // 现有语义：饱食度下降
        next.mood = clamp(s.mood - (next.hunger < 30 ? 2 : 1));
        next.energy = clamp(s.energy - 1);

        // 自动觅食触发：饱食度低于 25 且能量足够
        if (next.hunger < 25 && next.energy > 30) {
            next.status = 'foraging';
        }

        if (next.energy < 15) {
            next.status = 'sleeping';
        }
        if (next.energy < 20) next.mood = clamp(next.mood - 1);
    }
    return finalize(next);
}

module.exports = {
    normalizeState,
    deriveMood,
    applyTick,
    feed,
    play,
    sleepAction,
    applyExp,
    DEFAULT_STATE,
    MOOD_THRESHOLDS
};
