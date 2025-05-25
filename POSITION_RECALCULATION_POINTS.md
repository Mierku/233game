# 瀑布流位置重新计算触发点分析

## 🎯 概述

在瀑布流布局中，位置计算是一个复杂的过程，有多个触发点会导致需要重新计算卡片位置。本文档详细分析了所有这些触发点。

## 📍 重新计算位置的触发点

### 1. **页面初始化时**

**触发函数**: `layoutCards()`
**触发时机**: `onMounted()`
**影响范围**: 所有卡片
**代码位置**: `pages/index.vue:1454`

```javascript
onMounted(() => {
	if (import.meta.client) {
		// 加载初始数据
		loadInitialData();
		// 其中会调用 layoutCards()
	}
});

const layoutCards = async () => {
	if (!container.value) return;
	await nextTick();

	// 清空缓存，重新计算
	cardPositionsCache.value = [];
	cardHeightsCache.value = [];
	columnHeights.value = [];

	// 为所有显示的卡片计算位置
	for (let i = 0; i < displayCards.value.length; i++) {
		calculateCardPosition(i);
	}

	updateTotalHeight();
};
```

### 2. **窗口大小变化时**

**触发函数**: `debouncedResize()` → `layoutCards()`
**触发时机**: 窗口 resize 事件
**影响范围**: 所有卡片
**代码位置**: `pages/index.vue:1190`

```javascript
const debouncedResize = debounce(() => {
	if (import.meta.client) {
		viewportHeight.value = window.innerHeight;
		layoutCards(); // 窗口大小变化时重新计算所有位置
	}
}, 300);
```

**原因**: 窗口大小变化会影响：

- 容器宽度 → 列数变化
- 卡片宽度变化 → 图片高度变化
- 整个布局需要重新计算

### 3. **图片宽高比变化时**

**触发函数**: `preloadImageAspectRatio()` → `recalculateFromIndex()`
**触发时机**: 图片预加载完成，发现宽高比与预估不同
**影响范围**: 从该卡片开始的所有后续卡片
**代码位置**: `pages/index.vue:924-928`

```javascript
const preloadImageAspectRatio = (imageUrl: string, index: number) => {
	const img = new Image();
	img.onload = () => {
		const oldAspectRatio = imageAspectRatios.value[index] || 1;
		imageAspectRatios.value[index] = img.width / img.height;

		// 如果宽高比发生变化，重新计算该卡片及后续卡片位置
		if (oldAspectRatio && oldAspectRatio !== imageAspectRatios.value[index]) {
			recalculateFromIndex(index);
		} else if (!cardPositionsCache.value[index]) {
			calculateCardPosition(index);
		}
	};
	img.src = imageUrl;
};
```

### 4. **图片加载完成后高度差异较大时**

**触发函数**: `onImageLoad()` → `updateAffectedCardsOnly()`
**触发时机**: 图片加载完成，实际高度与预估高度差异 > 15px
**影响范围**: 同列的后续卡片
**代码位置**: `pages/index.vue:1134-1139`

```javascript
const onImageLoad = (index: number) => {
	setTimeout(() => {
		const cardEl = cardRefs.value.get(index);
		if (cardEl) {
			const actualHeight = cardEl.offsetHeight;
			const estimatedHeight = cardHeightsCache.value[index];
			const diff = Math.abs(actualHeight - estimatedHeight);

			// 🎯 优化：使用智能局部更新替代全量重新计算
			if (diff > 15) {
				cardHeightsCache.value[index] = actualHeight;
				// 🚀 关键优化：只更新受影响的卡片，而不是重新计算所有
				updateAffectedCardsOnly(index, diff);
			}
		}
	}, 10);
};
```

### 5. **批量高度更新时**

**触发函数**: `processBatchUpdates()` → `adjustSubsequentCardsInColumn()`
**触发时机**: 批量处理高度差异较大的卡片
**影响范围**: 受影响列的后续卡片
**代码位置**: `pages/index.vue:700-750`

```javascript
const processBatchUpdates = () => {
	if (pendingUpdates.value.size === 0) return;

	// 按索引排序，从前往后处理
	const sortedIndexes = Array.from(pendingUpdates.value).sort((a, b) => a - b);

	for (const index of sortedIndexes) {
		const estimatedHeight = getEstimatedCardHeight(index);
		const actualHeight = cardHeightsCache.value[index];
		const heightDiff = actualHeight - estimatedHeight;

		if (Math.abs(heightDiff) > 10) {
			const position = cardPositionsCache.value[index];
			if (position) {
				const columnIndex = Math.round(position.x / (getCardWidth() + gap));
				// 调整同列后续卡片的位置
				adjustSubsequentCardsInColumn(columnIndex, index, heightDiff);
			}
		}
	}

	pendingUpdates.value.clear();
	updateTotalHeight();
};
```

### 6. **虚拟列表计算时位置缺失**

**触发函数**: `calculateVisibleCards()` → `calculateCardPosition()`
**触发时机**: 虚拟列表计算时发现某些卡片位置未计算
**影响范围**: 单个卡片
**代码位置**: `pages/index.vue:556-558`

```javascript
const calculateVisibleCards = () => {
	for (let i = 0; i < cards.length; i++) {
		const position = cardPositionsCache.value[i];

		// 如果位置未计算，跳过（避免阻塞渲染）
		if (!position) {
			// 延迟计算，避免阻塞
			setTimeout(() => {
				if (!cardPositionsCache.value[i] && container.value) {
					calculateCardPosition(i);
					// 重新计算可视卡片
					requestCalculateVisibleCards();
				}
			}, 0);
		}
	}
};
```

### 7. **数据刷新时**

**触发函数**: `refresh()` → `layoutCards()`
**触发时机**: 下拉刷新完成
**影响范围**: 所有卡片
**代码位置**: `pages/index.vue:1316`

```javascript
const refresh = async () => {
	try {
		// 重置状态
		cardRefs.value.clear();
		cardPositionsCache.value = [];
		cardHeightsCache.value = [];
		columnHeights.value = [];
		imageAspectRatios.value = [];

		// 更新数据
		allCards.value = transformApiData(refreshList.data);

		// 重新布局
		layoutCards();
	} catch (error) {
		console.error("刷新数据失败:", error);
	}
};
```

### 8. **新数据加载完成时**

**触发函数**: `loadInitialData()` → `layoutCards()`
**触发时机**: 客户端初始数据加载完成
**影响范围**: 所有卡片
**代码位置**: `pages/index.vue:1454`

```javascript
const loadInitialData = async () => {
	if (initialList && initialList.data && initialList.data.length > 0) {
		allCards.value = transformApiData(initialList.data);

		await nextTick();
		if (container.value) {
			// 初始化图片宽高比
			allCards.value.forEach((card, index) => {
				initializeImageAspectRatio(card, index);
			});

			// 计算布局
			layoutCards();
		}
	}
};
```

### 9. **图片宽高比初始化时**

**触发函数**: `initializeImageAspectRatio()` → `calculateCardPosition()`
**触发时机**: 使用 API 返回的图片尺寸初始化宽高比
**影响范围**: 单个卡片
**代码位置**: `pages/index.vue:907`

```javascript
const initializeImageAspectRatio = (card: any, index: number) => {
	if (
		card.coverWidth &&
		card.coverHeight &&
		card.coverWidth > 0 &&
		card.coverHeight > 0
	) {
		const aspectRatio = card.coverWidth / card.coverHeight;
		imageAspectRatios.value[index] = Math.max(0.1, Math.min(aspectRatio, 10));

		// 延迟计算位置，确保容器已准备好
		nextTick(() => {
			if (!cardPositionsCache.value[index] && container.value) {
				calculateCardPosition(index);
			}
		});
	}
};
```

## 🔄 重新计算的类型和范围

### 全量重新计算 (Full Recalculation)

**触发场景**:

- 页面初始化
- 窗口大小变化
- 数据刷新

**特点**:

- 清空所有缓存
- 重新计算所有卡片位置
- 性能开销最大，但确保布局正确

```javascript
const layoutCards = async () => {
	// 清空缓存，重新计算
	cardPositionsCache.value = [];
	cardHeightsCache.value = [];
	columnHeights.value = [];

	// 重新计算所有卡片
	for (let i = 0; i < displayCards.value.length; i++) {
		calculateCardPosition(i);
	}
};
```

### 增量重新计算 (Incremental Recalculation)

**触发场景**:

- 图片宽高比变化
- 从某个索引开始的位置失效

**特点**:

- 保留前面卡片的位置
- 只重新计算受影响的后续卡片
- 性能较好，影响范围可控

```javascript
const recalculateFromIndex = (startIndex: number) => {
    // 重置列高度到 startIndex 之前的状态
    const newColumnHeights = new Array(columnCount).fill(topGap);

    // 重新计算列高度到 startIndex 位置
    for (let i = 0; i < startIndex; i++) {
        // 基于已有位置重建列高度
    }

    // 重新计算从 startIndex 开始的所有卡片位置
    for (let i = startIndex; i < displayCards.value.length; i++) {
        cardPositionsCache.value[i] = undefined as any;
        calculateCardPosition(i);
    }
};
```

### 局部位置调整 (Local Position Adjustment)

**触发场景**:

- 图片加载完成后高度微调
- 批量高度更新

**特点**:

- 不重新计算位置，只调整 Y 坐标
- 只影响同列的后续卡片
- 性能最好，影响范围最小

```javascript
const updateAffectedCardsOnly = (changedIndex: number, heightDiff: number) => {
	const changedPosition = cardPositionsCache.value[changedIndex];
	const changedColumn = Math.round(changedPosition.x / (getCardWidth() + gap));

	// 只调整同列且位置在后面的卡片
	for (let i = changedIndex + 1; i < displayCards.value.length; i++) {
		const position = cardPositionsCache.value[i];
		if (position) {
			const cardColumn = Math.round(position.x / (getCardWidth() + gap));
			if (cardColumn === changedColumn && position.y > changedPosition.y) {
				position.y += heightDiff; // 只调整Y坐标
				cardPositionsCache.value[i] = { ...position };
			}
		}
	}
};
```

### 单卡片位置计算 (Single Card Calculation)

**触发场景**:

- 虚拟列表发现位置缺失
- 新卡片需要计算位置

**特点**:

- 只计算单个卡片位置
- 基于当前列高度状态
- 性能开销最小

```javascript
const calculateCardPosition = (index: number) => {
	if (cardPositionsCache.value[index]) {
		return; // 已经计算过，不再改变
	}

	// 找到最短的列
	const shortestColumnIndex = columnHeights.value.indexOf(
		Math.min(...columnHeights.value)
	);

	// 计算位置并缓存
	const x = shortestColumnIndex * (cardWidth + gap);
	const y = columnHeights.value[shortestColumnIndex];
	cardPositionsCache.value[index] = { x, y, width: `${cardWidth}px` };

	// 更新列高度
	const cardHeight = getEstimatedCardHeight(index);
	columnHeights.value[shortestColumnIndex] = y + cardHeight + gap;
};
```

## 📊 性能影响分析

### 重新计算频率统计

| 触发场景     | 频率 | 影响范围 | 性能开销 | 优化策略     |
| ------------ | ---- | -------- | -------- | ------------ |
| 页面初始化   | 1 次 | 全部卡片 | 高       | 无法避免     |
| 窗口大小变化 | 低频 | 全部卡片 | 高       | 防抖处理     |
| 图片加载完成 | 高频 | 局部卡片 | 中       | 批量处理     |
| 虚拟列表计算 | 高频 | 单个卡片 | 低       | 延迟计算     |
| 数据刷新     | 低频 | 全部卡片 | 高       | 用户主动触发 |

### 优化策略总结

1. **防抖处理**: 窗口大小变化使用 300ms 防抖
2. **批量更新**: 高度差异较大的卡片批量处理，50ms 延迟
3. **延迟计算**: 虚拟列表中位置缺失的卡片延迟计算
4. **智能判断**: 只有差异超过阈值才触发重新计算
5. **缓存机制**: 已计算的位置不重复计算
6. **局部调整**: 优先使用位置调整而非重新计算

## 💡 总结

瀑布流位置重新计算是一个复杂的系统，涉及 9 个主要触发点：

1. **页面初始化** - 全量计算
2. **窗口大小变化** - 全量重新计算
3. **图片宽高比变化** - 增量重新计算
4. **图片加载完成** - 局部位置调整
5. **批量高度更新** - 局部位置调整
6. **虚拟列表位置缺失** - 单卡片计算
7. **数据刷新** - 全量重新计算
8. **新数据加载** - 全量计算
9. **图片宽高比初始化** - 单卡片计算

通过合理的优化策略，我们将重新计算的性能开销降到最低，同时确保布局的准确性和用户体验的流畅性。
