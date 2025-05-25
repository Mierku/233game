# 虚拟列表性能优化说明

## 优化前的问题

1. **频繁计算触发**：每次滚动都会触发 `visibleCards` 计算
2. **缺少防抖机制**：滚动事件没有防抖处理，导致过度计算
3. **过多日志输出**：大量 console.log 影响性能
4. **不必要的函数调用**：频繁调用 `getEstimatedCardHeight`
5. **阻塞渲染**：在虚拟列表计算中使用 `nextTick`

## 优化措施

### 1. 使用 RequestAnimationFrame 替代防抖（SSR 兼容）

```javascript
// 使用 RAF 优化虚拟列表计算（仅客户端）
let rafId: number | null = null;
const requestCalculateVisibleCards = () => {
	if (import.meta.client) {
		if (rafId) return; // 避免重复请求
		rafId = requestAnimationFrame(() => {
			calculateVisibleCards();
			rafId = null;
		});
	} else {
		// 服务端直接执行
		calculateVisibleCards();
	}
};
```

### 2. 缓存机制优化

- **结果缓存**：缓存虚拟列表计算结果，避免重复计算
- **条件触发**：只在滚动距离超过阈值时才重新计算
- **高度缓存**：优先使用已缓存的卡片高度

### 3. 滚动事件优化（SSR 兼容）

```javascript
// 立即更新滚动位置（用于虚拟列表），延迟处理其他逻辑
const handleScroll = () => {
	if (import.meta.client) {
		// 立即更新滚动位置，确保虚拟列表响应及时
		scrollTop.value = window.pageYOffset || document.documentElement.scrollTop;
		// 延迟处理其他逻辑
		debouncedScrollHandler();
	}
};

// 只在客户端添加事件监听器
if (import.meta.client) {
	window.addEventListener("scroll", handleScroll, { passive: true });
}
```

### 4. 智能范围计算

```javascript
// 优化：只检查可能在可视区域的卡片
const estimatedCardHeight = 300; // 平均卡片高度估算
const estimatedStartIndex = Math.max(
	0,
	Math.floor(viewTop / estimatedCardHeight) - 5
);
const estimatedEndIndex = Math.min(
	cards.length - 1,
	Math.ceil(viewBottom / estimatedCardHeight) + 5
);
```

### 5. 减少日志输出

- 只在开发环境输出调试信息
- 限制日志输出频率
- 使用性能统计替代频繁日志

### 6. 内存管理（SSR 兼容）

```javascript
onUnmounted(() => {
	// 只在客户端执行清理
	if (process.client) {
		// 清理RAF
		if (rafId) {
			cancelAnimationFrame(rafId);
			rafId = null;
		}
		// 移除事件监听器
		window.removeEventListener("resize", debouncedResize);
		window.removeEventListener("scroll", handleScroll);
	}

	// 清理缓存
	cardRefs.value.clear();
	visibleCardsCache.value = [];
});
```

### 7. 性能监控

添加性能统计功能，监控虚拟列表计算耗时：

```javascript
const performanceStats = ref({
	lastCalculateTime: 0,
	averageCalculateTime: 0,
	calculateCount: 0,
});
```

## 性能提升效果

1. **减少计算频率**：从每次滚动触发改为 RAF 控制，约 60fps
2. **降低 CPU 占用**：通过缓存和智能范围计算减少不必要的计算
3. **提升响应速度**：立即更新滚动位置，延迟处理其他逻辑
4. **减少内存泄漏**：添加清理机制，及时释放资源
5. **更好的调试体验**：性能统计帮助监控和优化

## 使用建议

1. **监控性能**：在开发环境查看性能统计信息
2. **调整参数**：根据实际卡片大小调整 `estimatedCardHeight`
3. **缓冲区大小**：根据设备性能调整 `bufferHeight`
4. **阈值设置**：根据需要调整滚动触发阈值

## SSR 兼容性

### 客户端检查

所有浏览器 API 都使用 `process.client` 进行检查：

- `window`、`document` 对象访问
- `requestAnimationFrame`、`cancelAnimationFrame`
- `performance.now()`
- 事件监听器的添加和移除

### 服务端降级

- RAF 在服务端直接执行函数
- 性能统计在服务端跳过
- 事件监听器仅在客户端添加

## 注意事项

1. 优化后虚拟列表计算变为异步，可能有轻微延迟
2. 性能统计仅在开发环境启用
3. 需要根据实际数据调整估算参数
4. **SSR 兼容**：所有浏览器 API 都有客户端检查，确保服务端渲染正常
