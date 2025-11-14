# GitHub Copilot 项目协作指令 (`floating`)

每次尽量少量生成代码片段，优先小步迭代，遵循以下约定与偏好。

说明性文字尽量精简，以减少token使用

> 目标：让 Copilot 在本项目中生成“轻量、可维护、上下文一致”的代码与文档，减少无关依赖与过度复杂抽象，优先可靠性与可读性。

---

## 1. 项目概览
| 属性 | 说明 |
|------|------|
| 类型 | 桌面应用（可能基于 Electron，`main.js` / `preload.js` / 渲染层 `renderer/`） |
| 语言 | Node.js (ES2020+)，前端原生 JS + HTML + CSS |
| 数据 | `data/pet-state.json`（本地状态持久化） |
| 运行环境 | macOS（需保持跨平台潜在兼容性） |

## 2. 设计原则
1. 单一职责：文件与函数保持聚焦（理想函数 < 40 行）。
2. 显式优于隐式：避免隐藏副作用（如静默写文件、全局状态污染）。
3. 渐进增强：先实现核心，再考虑动画/特效。
4. 可撤销：对状态修改集中封装，便于“回退 / 重置”。

## 3. 命名与结构规范
| 场景 | 约定 |
|------|------|
| 变量 | `camelCase`，语义清晰：`petState`, `lastFeedTime` |
| 常量 | `UPPER_CASE_WITH_UNDERSCORE`：`DEFAULT_HUNGER_DECREMENT` |
| 文件 | 小写、中划线或简单驼峰：`pet.js`, `state-manager.js`（避免过度嵌套） |
| 事件 | 前缀动词：`handleFeed`, `emitGrowth`, `onPetSleep` |
| 模块边界 | 数据持久化 / 渲染交互 / 业务逻辑 分层：禁止跨层直接操作 DOM 与文件系统混杂 |

目录建议（可逐步演进）：
```
src/
	core/          // 纯业务逻辑（状态计算、规则）
	services/      // IO（文件读写、持久化）
	ui/            // 与 DOM / 样式交互
	bridge/        // preload 与 renderer 通信（如使用 Electron）
```

## 4. 代码风格偏好
- 使用 `const` 默认；需要重新赋值才用 `let`，禁止 `var`。
- 条件优先卫语句：
	```js
	if (!isAlive) return;
	// 后续逻辑
	```
- 尽量纯函数：接收 `state` 返回新 `state`，避免直接修改全局。
- 数据结构：优先用对象与数组；避免不必要的 `Map/Set` unless 性能或语义明显更好。
- 错误处理：文件 IO / JSON 解析必须 try-catch + 降级策略（返回默认 state）。
- 注释：仅在“非直觉逻辑 / 魔法数字”附近添加单行注释；禁止堆砌解释显而易见代码。

## 5. 状态管理约定
`pet-state.json` 读写封装在单一模块（例如 `services/state-storage.js`）：
- 提供：`loadState()`, `saveState(state)`, `withState(mutator)`。
- 自动：失败时返回默认结构：
	```json
	{
		"hunger": 0,
		"energy": 100,
		"mood": "neutral",
		"lastUpdated": ISO_STRING
	}
	```
- 更新策略：所有计算集中在 `core/state-rules.js` 中，例如 `applyTick(state)`、`feed(state)`。

## 6. 交互与渲染
- DOM 查询缓存：避免重复 `document.querySelector`。
- 样式变更：添加/移除类名，避免直接操作行内样式除非必要。
- 动画：优先使用 CSS 过渡；JS 动画仅在需定制时。
- 尽量不引入框架（React/Vue 等），保持简单。

## 7. 安全与健壮性
- 禁止直接在渲染层执行危险 Node API（若使用 Electron，需通过 `preload` 安全暴露）。
- 严格校验 JSON 结构；缺失字段填充默认值。
- 防御：所有外部输入（若后续有）先规范化再使用。

## 8. 性能注意点
- 定时器：集中管理（例如 `tickScheduler`），避免散落的 `setInterval`。
- 批量 DOM 更新：合并写操作；可使用 `requestAnimationFrame` 驱动逐帧逻辑。
- 文件写入节流：状态频繁变化时，批量（例如 1s 内合并一次）。

## 9. 提交信息（建议）
格式：`type(scope): message`
常见 type：`feat`, `fix`, `refactor`, `chore`, `docs`。
示例：`feat(state): 添加喂食衰减与能量恢复逻辑`。

## 10. Copilot 生成偏好指令
请遵循：
1. 先给最小可运行版本，再给可选增强（用注释标记 `// enhancement`）。
2. 如需新文件，列出文件名与职责，避免一次性生成多个含糊文件。
3. 提供 1-2 个可测试的入口函数（例如 `feedPet(state)`）。
4. 避免引入未在 `package.json` 中的依赖；若确需，注明理由与替代方案。
5. 若逻辑含时间或随机性，封装到可注入的 `clock` / `rng` 接口以便测试。

### 触发提示模板（可复制给助手）
```
请基于现有结构生成一个纯函数 `applyTick(state, now)`：
- 规则：每 tick hunger +1（上限 100），energy -1（下限 0）。
- mood 根据 hunger 与 energy 自动调整。
- 返回新的不可变对象，不修改入参。
- 加入必要边界检查与默认值回填。
```

## 11. 禁止事项
- 生成与项目无关的大段教学性文字。
- 引入重量级框架（React/Vue/Angular 等）。
- 使用未解释的魔法数字（必须常量命名）。
- 静默失败（必须 `console.error` 或返回安全降级）。
- 随意修改现有文件结构造成耦合。

## 12. 推荐的后续增强（可选）
- 添加简单单元测试（如使用 `vitest` 或内置轻量测试脚本）。
- 引入持久化写入节流（Debounce）。
- 增加状态快照导出/导入功能（JSON）。
- 添加简易事件总线取代直接函数链调用。

## 13. 默认期望输出格式（当请求新逻辑）
请按以下层次输出：
1. 简述目标与约束
2. 文件/函数列表与职责
3. 代码（必要部分，不冗余）
4. 可选增强（列表）
5. 测试示例（若适用）

## 14. 质量检查清单
- [ ] 无未使用变量
- [ ] 函数命名语义明确
- [ ] 纯函数不修改入参
- [ ] I/O 错误有处理分支
- [ ] Magic Number 已常量化
- [ ] DOM 操作最小化且集中
- [ ] JSON 读写有异常捕获

## 15. 示例：`feed(state)` 期望模式
```js
// core/state-rules.js
export function feed(state, amount = 10) {
	const safe = normalizeState(state);
	const nextHunger = Math.max(0, safe.hunger - amount);
	return {
		...safe,
		hunger: nextHunger,
		mood: deriveMood({ ...safe, hunger: nextHunger }),
		lastUpdated: new Date().toISOString()
	};
}
```

## 16. 世界观：浮岛生态与情绪能量系统（新增 2025-11-07）
本项目的“宠物”存在于名为「浮陆簇（Aerial Archipelago）」的异世界：由大小不一的浮岛组成，岛间通过漂浮晶丝传导能量。宠物并非传统动物，而是“情绪共鸣体”（Emotion Resonant Entity，简称 ERE）。其核心指标与故事要素对应如下：

| 状态字段 | 世界观含义 | 可能的扩展事件钩子 |
|----------|------------|--------------------|
| `hunger` | 情绪晶格的耗损程度，越高代表需要补充“慰藉粒子” | 喂食（投喂安抚碎片）、环境互动（抚摸、音乐） |
| `energy` | 浮岛环境能流对 ERE 的充能水平 | 睡眠、岛屿昼夜循环、能量风暴事件 |
| `mood` | 当前主导情绪频谱标签 | 触发不同动画 / 粒子特效 / 可解锁交互 |
| `lastUpdated` | 最近一次与环境或玩家交互的时间 | 时间驱动的衰减 / 恢复 / 事件调度 |

### 情绪频谱建议（可用于 `deriveMood` 扩展）
采用层级+条件组合：
1. `ecstatic`：energy ≥ 90 且 hunger ≤ 10
2. `joyful`：energy ≥ 70 且 hunger ≤ 25
3. `neutral`：默认兜底
4. `restless`：hunger ≥ 60 且 energy ≥ 40
5. `anxious`：hunger ≥ 75 且 energy < 40
6. `exhausted`：energy ≤ 15
（具体数值后续可常量化：`MOOD_THRESHOLDS`）

### 世界观驱动的规则映射
- “时间流逝” (`applyTick`)：浮岛能流轻微波动 → hunger +1（晶格耗损），energy -1（背景能流衰减）。
- “喂食” (`feed`)：投放安抚碎片（Soothing Shard）→ hunger 减少，可能小幅提升 mood。
- “休眠” (`sleep`)：进入共鸣茧态，暂停 hunger 增长，energy 恢复速率加倍（节流防止频繁写）。
- “事件风暴”：可未来加入随机事件（能量风暴、低语迷雾）调整阈值或临时锁定 mood。

### 设计约束（把控复杂度）
1. 世界观文本不直接耦合业务逻辑：所有派生仍走 `core/state-rules.js`。
2. mood 计算必须纯函数，不访问时间，除非通过注入 `now`。
3. 后续新增状态字段（如 `affinity` 亲密度）需在存储层做向后兼容填充默认值。
4. 世界观相关的 UI 文案集中在单一映射表（避免散落硬编码）。

### 可选扩展字段（暂不实现，仅预留）
| 字段 | 含义 | 默认值 | 备注 |
|------|------|--------|------|
| `affinity` | 与玩家的情绪同步度 | 0 | 影响特殊动画触发概率 |
| `environmentCycle` | 当前浮岛昼夜或能流阶段 | `"day"` | 驱动被动恢复/衰减 |
| `statusEffects` | 临时状态列表 | `[]` | 如：`"stormShield"`, `"soothingAura"` |

### 最小落地步骤建议
1. 现有状态文件保持不变，仅在 `deriveMood` 中按当前三四档实现。
2. 后续迭代再分层：新增 `core/world-context.js` 提供环境（昼夜、事件）。
3. 引入节流：风暴或休眠模式下写文件频率下降。

### 提示模板示例（世界观驱动逻辑）
```
请实现 `deriveMood(state)`：
- 使用世界观情绪频谱优先级。
- 需要常量化阈值并避免魔法数字。
- 不修改入参，返回字符串 mood。
- hunger, energy 为空或无效时回填默认值 0 / 100。
```

> 变更原因：添加异世界世界观支撑后续可视化与扩展玩法。

---
若需修改本文件：保持结构分节，更新时注明日期与变更原因。

最后更新：2025-11-07
