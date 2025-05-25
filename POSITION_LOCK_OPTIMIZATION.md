# 位置锁定优化方案

## 🎯 目标

实现"一次修正，永久锁定"的设计原则，确保卡片位置在真实 DOM 修正后不再变化。

## 🚨 当前问题分析

### 1. 多重修正机制冲突

```javascript
// 问题：存在3个不同的修正入口
// 1. onImageLoad() → updateAffectedCardsOnly()
// 2. setCardRef() → processBatchUpdates()
// 3. preloadImageAspectRatio() → recalculateFromIndex()
```

### 2. 阈值设置过于敏感

```javascript
// 当前：1px就触发修正
if (diff > 1) {
	// 几乎每个卡片都会触发修正
}

// 应该：合理阈值
if (diff > 15) {
	// 只有明显差异才修正
}
```

### 3. 违反锁定原则

```javascript
// recalculateFromIndex() 中违反锁定原则
cardPositionsCache.value[i] = undefined as any; // ❌ 清除已锁定位置
calculateCardPosition(i); // ❌ 重新计算
```

## ✅ 优化方案

### 1. 统一修正入口

```javascript
// 只保留一个修正入口：setCardRef()
const setCardRef = (el: HTMLElement, index: number) => {
	cardRefs.value.set(index, el);

	// 获取实际高度
	const actualHeight = el.offsetHeight;
	const estimatedHeight = cardHeightsCache.value[index];
	const diff = Math.abs(actualHeight - estimatedHeight);

	// 🎯 一次性修正：只在首次设置ref且差异较大时修正
	if (diff > 15 && !hasBeenCorrected[index]) {
		// 标记已修正，防止重复修正
		hasBeenCorrected[index] = true;

		// 更新高度缓存
		cardHeightsCache.value[index] = actualHeight;

		// 只调整Y坐标，不重新计算位置
		adjustPositionsOnly(index, diff);
	} else {
		// 小差异直接更新高度缓存
		cardHeightsCache.value[index] = actualHeight;
	}
};
```

### 2. 移除其他修正逻辑

```javascript
// 🗑️ 移除 onImageLoad() 中的修正逻辑
const onImageLoad = (index: number) => {
	imageLoadedStates.value[index] = true;
	// ❌ 移除：不再进行位置修正
	// if (diff > 1) {
	//     updateAffectedCardsOnly(index, diff);
	// }
};

// 🗑️ 移除 processBatchUpdates() 批量修正
// const processBatchUpdates = () => {
//     // 整个函数移除
// };

// 🗑️ 限制 recalculateFromIndex() 的使用
const recalculateFromIndex = (startIndex: number) => {
	// 🎯 只在特定情况下使用：
	// 1. 窗口大小变化
	// 2. 数据刷新
	// 3. 图片宽高比初始化时发现差异巨大
	// ❌ 不再用于常规的高度修正
};
```

### 3. 添加修正状态跟踪

```javascript
// 新增：跟踪修正状态
const hasBeenCorrected = ref<Record<number, boolean>>({});

// 重置函数中清理状态
const resetCorrectionStates = () => {
    hasBeenCorrected.value = {};
};
```

### 4. 优化位置调整函数

```javascript
// 重命名并优化
const adjustPositionsOnly = (changedIndex: number, heightDiff: number) => {
	const changedPosition = cardPositionsCache.value[changedIndex];
	if (!changedPosition) return;

	const changedColumn = Math.round(changedPosition.x / (getCardWidth() + gap));

	// 🎯 只调整Y坐标，不重新计算位置
	for (let i = changedIndex + 1; i < displayCards.value.length; i++) {
		const position = cardPositionsCache.value[i];
		if (position) {
			const cardColumn = Math.round(position.x / (getCardWidth() + gap));
			if (cardColumn === changedColumn && position.y > changedPosition.y) {
				// ✅ 只调整Y坐标，保持X坐标和列选择不变
				position.y += heightDiff;
				cardPositionsCache.value[i] = { ...position };
			}
		}
	}

	// 更新列高度
	columnHeights.value[changedColumn] += heightDiff;
	updateTotalHeight();
};
```

## 🔒 锁定机制强化

### 1. 位置计算的一次性保证

```javascript
const calculateCardPosition = (index: number) => {
	// 🔒 强化锁定检查
	if (cardPositionsCache.value[index]) {
		return; // 已锁定，绝不重新计算
	}

	// ... 计算逻辑

	// 🔒 一旦计算就永久锁定
	cardPositionsCache.value[index] = { x, y, width: `${cardWidth}px` };
};
```

### 2. 修正的一次性保证

```javascript
const setCardRef = (el: HTMLElement, index: number) => {
	// 🔒 确保只修正一次
	if (hasBeenCorrected.value[index]) {
		return; // 已修正过，不再修正
	}

	// ... 修正逻辑
};
```

### 3. 清理函数中重置状态

```javascript
const resetAllStates = () => {
	cardPositionsCache.value = [];
	cardHeightsCache.value = [];
	columnHeights.value = [];
	hasBeenCorrected.value = {}; // 🔒 重置修正状态
	imageAspectRatios.value = [];
	imageLoadedStates.value = {};
};
```

## 📊 修改对比

### 修改前（当前状态）

```javascript
❌ 3个修正入口，可能冲突
❌ 1px阈值，过于敏感
❌ recalculateFromIndex 违反锁定原则
❌ 可能重复修正同一卡片
❌ 位置可能被多次调整
```

### 修改后（优化状态）

```javascript
✅ 1个修正入口，逻辑清晰
✅ 15px阈值，合理敏感度
✅ 严格遵守锁定原则
✅ 每个卡片只修正一次
✅ 位置锁定后不再变化
```

## 🎯 实施步骤

1. **添加修正状态跟踪**
2. **修改 setCardRef()为唯一修正入口**
3. **移除 onImageLoad()中的修正逻辑**
4. **移除批量更新机制**
5. **限制 recalculateFromIndex()的使用场景**
6. **提高修正阈值到 15px**
7. **在重置函数中清理修正状态**

## 💡 预期效果

1. **布局稳定性**：卡片位置一旦确定就不再变化
2. **性能提升**：减少不必要的重复计算
3. **逻辑清晰**：单一修正入口，易于维护
4. **用户体验**：无布局抖动，视觉稳定
5. **可预测性**：行为一致，便于调试
