# 移动端 vs PC 端滚动差异分析

## 🎯 核心问题：为什么移动端有抖动，PC 端没有？

### 1. **滚动机制差异**

#### PC 端滚动特点：

```javascript
// PC端：鼠标滚轮滚动
- 滚动距离固定（通常每次120px的倍数）
- 滚动速度可控
- 滚动停止时立即停止
- 惯性滚动较少
- 滚动事件触发频率相对较低
```

#### 移动端滚动特点：

```javascript
// 移动端：触摸滚动
- 滚动距离不固定（手指滑动距离）
- 滚动速度变化大（快速滑动vs慢速滑动）
- 惯性滚动（momentum scrolling）
- 滚动事件触发频率极高
- 滚动停止有缓冲过程
```

### 2. **事件触发频率差异**

#### PC 端：

```javascript
// 滚动事件触发：约10-30次/秒
window.addEventListener("scroll", handler);
// 相对稳定的触发频率
```

#### 移动端：

```javascript
// 滚动事件触发：60-120次/秒
// 特别是快速滑动时，事件密集触发
// 导致虚拟列表计算频繁执行
```

### 3. **性能差异**

#### PC 端优势：

- CPU 性能强
- 内存充足
- GPU 加速好
- 浏览器优化成熟

#### 移动端限制：

- CPU 性能相对较弱
- 内存限制
- 电池续航考虑
- 浏览器优化程度不同

### 4. **渲染差异**

#### PC 端：

```javascript
// 渲染相对稳定
- 屏幕刷新率固定（60Hz/120Hz）
- 渲染管线优化好
- 重排重绘成本相对较低
```

#### 移动端：

```javascript
// 渲染挑战更大
- 屏幕尺寸多样
- 像素密度高（Retina屏）
- 重排重绘成本高
- 触摸响应要求高
```

## 🚨 移动端抖动的具体原因

### 1. **虚拟列表计算频繁**

```javascript
// 问题：移动端滚动事件触发过于频繁
const handleScroll = () => {
	scrollTop.value = window.pageYOffset;
	// 每次滚动都触发虚拟列表重新计算
	requestCalculateVisibleCards(); // 频繁执行
};

// 解决：增加防抖和节流
const handleScroll = throttle(() => {
	scrollTop.value = window.pageYOffset;
	requestCalculateVisibleCards();
}, 16); // 限制到60fps
```

### 2. **位置修正时机不当**

```javascript
// 问题：在滚动过程中进行位置修正
const setCardRef = (el, index) => {
	// 滚动时也会触发修正，导致抖动
	if (diff > 1) {
		// 阈值太低
		adjustPositions(); // 在滚动中修正位置
	}
};

// 解决：提高阈值，避免滚动中修正
const setCardRef = (el, index) => {
	if (diff > 15 && !isScrolling) {
		// 只在非滚动时修正
		adjustPositions();
	}
};
```

### 3. **惯性滚动冲突**

```javascript
// 移动端特有：惯性滚动期间继续触发事件
// 导致虚拟列表在惯性滚动时仍在计算
// 造成视觉上的抖动

// 解决：检测惯性滚动状态
let isInertiaScrolling = false;
let lastScrollTime = 0;

const detectInertiaScrolling = () => {
	const now = Date.now();
	const timeDiff = now - lastScrollTime;

	if (timeDiff < 16) {
		// 高频触发，可能是惯性滚动
		isInertiaScrolling = true;
	} else {
		isInertiaScrolling = false;
	}

	lastScrollTime = now;
};
```

### 4. **DOM 操作成本高**

```javascript
// 移动端DOM操作成本更高
// 频繁的transform变化导致重绘

// 问题：每次滚动都更新transform
cardElement.style.transform = `translate3d(${x}px, ${y}px, 0)`;

// 解决：批量更新，减少DOM操作
const batchUpdateTransforms = () => {
	requestAnimationFrame(() => {
		visibleCards.forEach((card) => {
			// 批量更新所有可见卡片的transform
		});
	});
};
```

## 💡 移动端优化策略

### 1. **滚动优化**

```javascript
// 使用passive事件监听
window.addEventListener("scroll", handleScroll, {
	passive: true, // 提升滚动性能
});

// 增加节流
const throttledScroll = throttle(handleScroll, 16);
```

### 2. **虚拟列表优化**

```javascript
// 减少计算频率
const shouldRecalculate = () => {
	const scrollDiff = Math.abs(scrollTop.value - lastScrollTop.value);
	return scrollDiff > 50; // 移动端使用更大的阈值
};
```

### 3. **渲染优化**

```javascript
// 使用will-change提示浏览器
.card {
    will-change: transform;
    transform: translate3d(0, 0, 0); // 开启硬件加速
}

// 避免layout thrashing
// 只修改transform，不修改width/height
```

### 4. **内存优化**

```javascript
// 移动端内存限制，需要更积极的清理
const cleanupOffscreenCards = () => {
	// 清理远离可视区域的卡片引用
	cardRefs.value.forEach((ref, index) => {
		if (isCardFarFromViewport(index)) {
			cardRefs.value.delete(index);
		}
	});
};
```

## 🎯 针对性解决方案

### 1. **检测设备类型**

```javascript
const isMobile =
	/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
		navigator.userAgent
	);

if (isMobile) {
	// 移动端特殊处理
	scrollThreshold = 50; // 更大的滚动阈值
	updateFrequency = 30; // 降低更新频率
} else {
	// PC端正常处理
	scrollThreshold = 10;
	updateFrequency = 60;
}
```

### 2. **移动端专用防抖**

```javascript
const mobileScrollHandler = debounce(
	() => {
		// 移动端使用更长的防抖时间
		updateVirtualList();
	},
	isMobile ? 50 : 16
);
```

### 3. **惯性滚动检测**

```javascript
let scrollVelocity = 0;
let lastScrollTop = 0;
let lastScrollTime = 0;

const handleScroll = () => {
	const now = Date.now();
	const currentScrollTop = window.pageYOffset;

	// 计算滚动速度
	const timeDiff = now - lastScrollTime;
	const scrollDiff = currentScrollTop - lastScrollTop;
	scrollVelocity = Math.abs(scrollDiff / timeDiff);

	// 高速滚动时减少计算
	if (scrollVelocity > 2) {
		// 快速滚动
		// 降低更新频率
		throttledUpdate();
	} else {
		// 正常更新
		normalUpdate();
	}

	lastScrollTop = currentScrollTop;
	lastScrollTime = now;
};
```

## 📊 性能对比

### PC 端：

```
✅ 滚动事件：10-30次/秒
✅ 计算延迟：1-2ms
✅ 渲染稳定：60fps
✅ 内存充足：不是瓶颈
```

### 移动端：

```
⚠️ 滚动事件：60-120次/秒
⚠️ 计算延迟：5-10ms
⚠️ 渲染波动：30-60fps
⚠️ 内存限制：需要优化
```

## 🎯 最终建议

1. **设备检测**：根据设备类型采用不同策略
2. **滚动优化**：移动端使用更保守的更新策略
3. **性能监控**：实时监控滚动性能
4. **渐进增强**：PC 端功能丰富，移动端注重稳定性
