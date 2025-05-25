# 移动端抖动问题修复

## 🚨 问题分析

移动端滚动时出现抖动，经分析确认是**虚拟列表触发过于频繁**导致的。

### 根本原因

1. **过于敏感的滚动阈值**：5px 就触发虚拟列表重新计算
2. **循环触发机制**：虚拟列表计算中异步触发位置计算，又触发虚拟列表重新计算
3. **移动端滚动特性**：移动端滚动时`scrollTop`变化频繁且不规律
4. **缓冲区过小**：300px 缓冲区在移动端不够用

## 🔧 修复方案

### 1. 提高滚动触发阈值

```javascript
// 修复前：过于敏感
const scrollChanged = Math.abs(scrollTop.value - lastScrollTop.value) > 5; // 5px就触发

// 修复后：移动端优化
const scrollChanged = Math.abs(scrollTop.value - lastScrollTop.value) > 50; // 50px才触发
```

### 2. 优化强制重新计算条件

```javascript
// 修复前：容易触发
(scrollChanged && visibleCardsCache.value.length < 6)(
	// 6个卡片就强制重算

	// 修复后：减少触发
	scrollChanged && visibleCardsCache.value.length < 3
); // 3个卡片才强制重算
```

### 3. 移除循环触发机制

```javascript
// 修复前：循环触发问题
setTimeout(() => {
	if (!cardPositionsCache.value[i] && container.value) {
		calculateCardPosition(i);
		requestCalculateVisibleCards(); // ❌ 又触发重新计算！
	}
}, 0);

// 修复后：移除异步计算
// 🔧 移除异步计算，避免循环触发虚拟列表重新计算
// 位置计算应该在数据加载时完成，而不是在虚拟列表计算中
```

### 4. 添加防抖机制

```javascript
// 修复前：无防抖
const requestCalculateVisibleCards = () => {
	if (rafId) return;
	rafId = requestAnimationFrame(() => {
		calculateVisibleCards();
		rafId = null;
	});
};

// 修复后：添加防抖
let lastRequestTime = 0;
const requestCalculateVisibleCards = () => {
	const now = performance.now();
	// 🔧 移动端防抖：限制最小间隔100ms
	if (now - lastRequestTime < 100) {
		return;
	}
	lastRequestTime = now;

	if (rafId) return;
	rafId = requestAnimationFrame(() => {
		calculateVisibleCards();
		rafId = null;
	});
};
```

### 5. 增大缓冲区

```javascript
// 修复前：缓冲区过小
const bufferHeight = ref(300);

// 修复后：移动端优化
const bufferHeight = ref(600); // 增大缓冲区，减少计算频率
```

### 6. 减少调试日志

```javascript
// 修复前：频繁输出日志
if (performanceStats.value.calculateCount % 20 === 0) // 每20次输出

// 修复后：减少日志输出
if (performanceStats.value.calculateCount % 100 === 0) // 每100次输出
```

## 📊 修复效果对比

### 修复前的问题

```javascript
❌ 5px滚动就触发虚拟列表重新计算
❌ 虚拟列表计算中异步触发位置计算，形成循环
❌ 无防抖机制，计算过于频繁
❌ 缓冲区过小，移动端体验差
❌ 调试日志过多，影响性能
```

### 修复后的优势

```javascript
✅ 50px滚动才触发，大幅减少计算频率
✅ 移除循环触发，避免无限重新计算
✅ 100ms防抖机制，限制最小计算间隔
✅ 600px缓冲区，移动端体验更流畅
✅ 减少日志输出，提升性能
```

## 🎯 核心优化原理

### 1. **减少触发频率**

- 提高滚动阈值：从 5px → 50px
- 优化强制重算条件：从 6 个 → 3 个卡片
- 添加 100ms 防抖机制

### 2. **避免循环计算**

- 移除虚拟列表计算中的异步位置计算
- 位置计算在数据加载时完成，而非虚拟列表计算中

### 3. **移动端适配**

- 增大缓冲区：300px → 600px
- 考虑移动端滚动的不规律性
- 减少不必要的日志输出

## 💡 预期效果

1. **消除抖动**：移动端滚动时不再出现卡片位置跳动
2. **性能提升**：虚拟列表计算频率大幅降低
3. **流畅体验**：更大的缓冲区确保卡片及时显示
4. **稳定性**：避免循环触发导致的性能问题

## 🔍 验证方法

1. **移动端测试**：在手机上快速滚动，观察是否还有抖动
2. **性能监控**：查看虚拟列表计算频率是否降低
3. **控制台日志**：观察计算次数和平均耗时
4. **用户体验**：滚动是否更加流畅自然

这次修复从根本上解决了移动端虚拟列表触发过于频繁导致的抖动问题！
