<template>
	<div
		class="bg-gray-100 min-h-screen pb-16"
		@touchstart="onTouchStart"
		@touchmove="onTouchMove"
		@touchend="onTouchEnd"
	>
		<!-- 下拉刷新指示器 - 圆形logo -->
		<div
			v-if="showPullRefresh"
			class="fixed top-0 left-0 right-0 z-20 shadow-sm"
			:style="{ transform: `translateY(${Math.max(0, pullDistance - 80)}px)` }"
		>
			<div class="flex items-center justify-center py-4">
				<div
					v-if="isRefreshing"
					class="animate-spin rounded-full h-8 w-8 border-2 border-pink-500 border-t-transparent"
				></div>
				<div
					v-else
					class="rounded-full h-8 w-8 bg-gradient-to-r from-pink-400 to-pink-600 flex items-center justify-center text-white text-sm font-bold"
				>
					{{ pullDistance > 80 ? "↑" : "↓" }}
				</div>
				<span class="ml-2 text-sm text-gray-500">
					{{ pullDistance > 80 ? "松开刷新" : "下拉刷新" }}
				</span>
			</div>
		</div>

		<!-- 顶部导航栏 -->
		<header
			class="sticky top-0 z-10 bg-white flex items-center px-4 py-2 shadow-sm"
		>
			<span class="text-lg font-bold text-pink-500 mr-2">发现</span>
			<span class="text-gray-400 text-base">| 游戏圈</span>
			<span class="ml-auto text-xs text-gray-400">糯花酿圈</span>
			<svg
				class="w-6 h-6 ml-2 text-gray-400"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
				/>
			</svg>
		</header>

		<!-- 虚拟瀑布流容器 -->
		<div class="flex justify-center">
			<div ref="container" class="relative px-2 mt-2 max-w-6xl w-full">
				<!-- 初始加载指示器 -->
				<div
					v-if="allCards.length === 0 && isLoadingMore"
					class="flex flex-col items-center justify-center py-20"
				>
					<div
						class="animate-spin rounded-full h-12 w-12 border-4 border-pink-500 border-t-transparent mb-4"
					></div>
					<span class="text-gray-500 text-sm">正在加载内容...</span>
				</div>

				<!-- 空状态 -->
				<div
					v-else-if="allCards.length === 0 && !isLoadingMore && !hasMore"
					class="flex flex-col items-center justify-center py-20"
				>
					<div class="text-6xl mb-4">📱</div>
					<span class="text-gray-500 text-lg mb-2">暂无内容</span>
					<span class="text-gray-400 text-sm">请稍后再试或检查网络连接</span>
				</div>
				<!-- 外层容器维持总高度 - 动态计算所有卡片的总高度 -->
				<div :style="{ height: totalContentHeight + 'px' }" class="relative">
					<!-- 卡片渲染区域 - 只渲染可视区域内的卡片 -->
					<template v-for="card in visibleCards" :key="card.id">
						<div
							:ref="(el) => { if (el) setCardRef(el as HTMLElement, card.originalIndex) }"
							class="absolute bg-white rounded-xs shadow overflow-hidden"
							:style="{
								width: cardPositionsCache[card.originalIndex]?.width || '0px',
								transform: `translate3d(${
									cardPositionsCache[card.originalIndex]?.x || 0
								}px, ${cardPositionsCache[card.originalIndex]?.y || 0}px, 0)`,
							}"
						>
							<!-- 图片容器 -->
							<div class="relative">
								<!-- 图片占位容器 - 使用API尺寸预先设置高度 -->
								<div
									class="w-full bg-gray-100 relative flex items-center justify-center"
									:style="{ height: getImageHeight(card.originalIndex) + 'px' }"
								>
									<!-- 加载指示器 -->
									<div
										v-if="!imageLoadedStates[card.originalIndex]"
										class="absolute inset-0 flex items-center justify-center bg-gray-100"
									>
										<div class="animate-pulse flex space-x-1">
											<div class="w-2 h-2 bg-gray-300 rounded-full"></div>
											<div class="w-2 h-2 bg-gray-300 rounded-full"></div>
											<div class="w-2 h-2 bg-gray-300 rounded-full"></div>
										</div>
									</div>

									<!-- 封面图片 -->
									<img
										:src="card.img"
										class="w-full h-full object-cover transition-opacity duration-300"
										:class="{
											'opacity-0': playingVideos[card.id],
											'opacity-100': imageLoadedStates[card.originalIndex],
										}"
										:alt="card.title"
										@load="onImageLoad(card.originalIndex)"
									/>
								</div>

								<!-- 视频元素 - 仅对video类型显示 -->
								<video
									v-if="card.type === 'video'"
									ref="videoRef"
									:src="card.videoUrl || card.img"
									class="absolute top-0 left-0 w-full h-full object-cover transition-opacity duration-300"
									:class="{
										'opacity-100': playingVideos[card.id],
										'opacity-0': !playingVideos[card.id],
									}"
									:style="{ height: getImageHeight(card.originalIndex) + 'px' }"
									:muted="false"
									@ended="onVideoEnded(card.id)"
									@pause="onVideoPaused(card.id)"
								></video>

								<!-- 视频预览按钮 -->
								<div
									v-if="card.type === 'video'"
									class="absolute top-2 left-2 bg-[rgba(0,0,0,0.7)] rounded-full p-1 cursor-pointer hover:bg-opacity-50 transition-all z-10"
									:class="{
										'opacity-0 pointer-events-none': playingVideos[card.id],
									}"
									@click="previewVideo(card)"
								>
									<svg
										class="w-3 h-3 text-white"
										fill="currentColor"
										viewBox="0 0 24 24"
									>
										<path d="M8 5v14l11-7z" />
									</svg>
								</div>
							</div>

							<div class="p-3">
								<div
									class="text-sm font-semibold text-gray-800 leading-tight line-clamp-2"
								>
									{{ card.title }}
								</div>

								<!-- 标签容器 -->
								<div class="mt-2">
									<span
										class="inline-block bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded"
									>
										{{ card.category }}
									</span>
								</div>

								<div class="flex items-center justify-between mt-3">
									<div class="flex items-center space-x-1">
										<img :src="card.avatar" class="w-5 h-5 rounded-full" />
										<span class="text-xs text-gray-500">{{ card.user }}</span>
									</div>
									<div class="flex items-center text-xs text-gray-400">
										<svg
											width="24px"
											height="24px"
											viewBox="0 0 24 24"
											fill="none"
											xmlns="http://www.w3.org/2000/svg"
											stroke="#000000"
											stroke-width="0.00024000000000000003"
										>
											<g id="SVGRepo_bgCarrier" stroke-width="0"></g>
											<g
												id="SVGRepo_tracerCarrier"
												stroke-linecap="round"
												stroke-linejoin="round"
											></g>
											<g id="SVGRepo_iconCarrier">
												<path
													fill-rule="evenodd"
													clip-rule="evenodd"
													d="M15.0501 7.04419C15.4673 5.79254 14.5357 4.5 13.2163 4.5C12.5921 4.5 12.0062 4.80147 11.6434 5.30944L8.47155 9.75H5.85748L5.10748 10.5V18L5.85748 18.75H16.8211L19.1247 14.1428C19.8088 12.7747 19.5406 11.1224 18.4591 10.0408C17.7926 9.37439 16.8888 9 15.9463 9H14.3981L15.0501 7.04419ZM9.60751 10.7404L12.864 6.1813C12.9453 6.06753 13.0765 6 13.2163 6C13.5118 6 13.7205 6.28951 13.627 6.56984L12.317 10.5H15.9463C16.491 10.5 17.0133 10.7164 17.3984 11.1015C18.0235 11.7265 18.1784 12.6814 17.7831 13.472L15.8941 17.25H9.60751V10.7404ZM8.10751 17.25H6.60748V11.25H8.10751V17.25Z"
													fill="#5c5c5c"
												></path>
											</g>
										</svg>
										{{ card.like }}
									</div>
								</div>
							</div>
						</div>
					</template>
				</div>
			</div>
		</div>

		<!-- 上拉加载指示器 - 只在有数据且正在加载更多时显示 -->
		<div
			v-if="isLoadingMore && allCards.length > 0"
			class="flex items-center justify-center py-4"
		>
			<div
				class="animate-spin rounded-full h-6 w-6 border-b-2 border-pink-500"
			></div>
			<span class="ml-2 text-sm text-gray-500">加载中...</span>
		</div>

		<div
			v-if="hasMore && !isLoadingMore"
			class="flex items-center justify-center py-4"
		>
			<span class="text-sm text-gray-400">滑到底部加载更多</span>
		</div>

		<div v-if="!hasMore" class="flex items-center justify-center py-4">
			<span class="text-sm text-gray-400">没有更多内容了</span>
		</div>

		<!-- 视频播放模态框 -->
		<div
			v-if="showVideoModal"
			class="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(0,0,0,0.8)]"
			@click="closeVideoModal"
		>
			<div
				class="relative w-full h-full max-w-4xl flex items-center justify-center p-4"
			>
				<!-- 关闭按钮 -->
				<button
					class="absolute top-4 right-4 z-999 bg-opacity-20 hover:bg-opacity-30 rounded-full p-2 transition-all"
					@click="closeVideoModal"
				>
					<svg
						class="w-6 h-6 text-white"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>

				<!-- 视频容器 -->
				<div
					class="relative w-full h-full max-w-4xl max-h-full rounded-lg overflow-hidden flex items-center justify-center"
					@click.stop
				>
					<!-- 视频播放器容器 -->
					<div
						v-if="currentVideoData"
						class="relative z-10 w-full h-full rounded-2xl overflow-hidden shadow-2xl bg-black flex items-center justify-center"
					>
						<video
							ref="modalVideoRef"
							:src="currentVideoData.videoUrl || currentVideoData.img"
							class="w-auto h-auto max-w-full max-h-full object-contain video-responsive"
							controls
							autoplay
							@ended="onModalVideoEnded"
						></video>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
	import { ref, onMounted, onUnmounted, nextTick, computed } from "vue";

	// 数据转换函数
	const transformApiData = (apiData: any[]) => {
		return apiData.map((item: any) => ({
			id: item.id,
			img: `${item.cover.url}`,
			title: item.title,
			category: item.categories?.[0]?.name || item.category || "默认分类",
			user: item.author.name,
			avatar: `${item.author.avatar.url}`,
			like: item.like || 0,
			type: item.type || "image",
			videoUrl: item.video ? `${item.video.url}` : undefined,
			// 新增：从API获取图片尺寸
			coverWidth: item.cover?.width || 0,
			coverHeight: item.cover?.height || 0,
		}));
	};
	const route = useRoute();
	// route参数
	const category = route.query?.category;
	const like = route.query?.like;
	const start = Number(route.query?.start) || 1;
	const limit = Number(route.query?.limit) || 20;
	// 响应式数据
	const container = ref<HTMLElement | null>(null);
	const cardRefs = ref(new Map());
	const cardPositionsCache = ref<
		Array<{ x: number; y: number; width: string }>
	>([]);
	const cardHeightsCache = ref<number[]>([]); // 缓存卡片高度
	const imageAspectRatios = ref<number[]>([]);
	const columnHeights = ref<number[]>([]);
	const totalContentHeight = ref(0);
	const currentPage = ref(1);
	const isLoadingMore = ref(false);
	const isRefreshing = ref(false);
	const hasMore = ref(true);
	const showPullRefresh = ref(false);
	const pullDistance = ref(0);
	const startY = ref(0);
	const scrollTop = ref(0);
	const viewportHeight = ref(0);
	const bufferHeight = ref(600); // 🔧 移动端优化：增大缓冲区高度，减少计算频率
	const playingVideos = ref<Record<number, boolean>>({});
	const isUserScrolling = ref(false); // 新增：用于判断用户是否在滚动
	const imageLoadedStates = ref<Record<number, boolean>>({}); // 图片加载状态

	// 视频模态框相关
	const showVideoModal = ref(false);
	const currentVideoData = ref<any>(null);
	const modalVideoRef = ref<HTMLVideoElement | null>(null);

	// 防抖函数
	const debounce = (func: Function, delay: number) => {
		let timeoutId: ReturnType<typeof setTimeout>;
		return (...args: any[]) => {
			clearTimeout(timeoutId);
			timeoutId = setTimeout(() => func.apply(null, args), delay);
		};
	};

	// 存储所有卡片数据 - 服务端渲染时为空，客户端再加载
	const allCards = ref<any[]>([]);

	// 服务端渲染时不加载数据，客户端再请求
	// const { data: initialList, error: initialError } = await getList({
	// 	start,
	// 	limit,
	// 	category: category as string | null,
	// 	like: like as string | null,
	// });

	// if (initialList && initialList.value?.data) {
	// 	allCards.value = transformApiData(initialList.value.data);
	// } else {
	// 	console.error("Failed to load initial data:", initialError);
	// 	hasMore.value = false;
	// }

	// 计算当前显示的卡片
	const displayCards = computed(() => {
		return allCards.value;
	});

	// 缓存虚拟列表计算结果
	const visibleCardsCache = ref<any[]>([]);
	const lastScrollTop = ref(0);
	const lastViewportHeight = ref(0);

	// 🔧 使用 RAF 优化虚拟列表计算（移动端防抖优化）
	let rafId: number | null = null;
	let lastRequestTime = 0;
	const requestCalculateVisibleCards = () => {
		if (import.meta.client) {
			const now = performance.now();
			// 🔧 移动端防抖：限制最小间隔100ms，避免过于频繁的计算
			if (now - lastRequestTime < 100) {
				return;
			}
			lastRequestTime = now;

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

	// 性能监控
	const performanceStats = ref({
		lastCalculateTime: 0,
		averageCalculateTime: 0,
		calculateCount: 0,
	});

	// 手动调试函数 - 可在浏览器控制台调用 window.debugVirtualList()
	const debugVirtualList = () => {
		if (!import.meta.client) return;

		const cards = displayCards.value;
		const viewTop = scrollTop.value - bufferHeight.value;
		const viewBottom =
			scrollTop.value + viewportHeight.value + bufferHeight.value;

		console.clear();

		// 分析所有卡片的状态
		const cardAnalysis: {
			可见卡片: any[];
			应该可见但未显示: any[];
			位置未计算: any[];
			高度未测量: any[];
		} = {
			可见卡片: [],
			应该可见但未显示: [],
			位置未计算: [],
			高度未测量: [],
		};

		for (let i = 0; i < Math.min(cards.length, 100); i++) {
			const card = cards[i];
			const position = cardPositionsCache.value[i];
			const height = cardHeightsCache.value[i];
			const estimatedHeight = getEstimatedCardHeight(i);

			if (!position) {
				cardAnalysis.位置未计算.push({
					索引: i,
					标题: card?.title?.substring(0, 15) + "...",
				});
				continue;
			}

			if (!height) {
				cardAnalysis.高度未测量.push({
					索引: i,
					标题: card?.title?.substring(0, 15) + "...",
					位置: `(${position.x}, ${position.y})`,
					预估高度: estimatedHeight,
				});
			}

			const cardBottom = position.y + (height || estimatedHeight);
			const shouldBeVisible = cardBottom >= viewTop && position.y <= viewBottom;
			const isInVisibleList = visibleCardsCache.value.some(
				(v) => v.originalIndex === i
			);

			if (shouldBeVisible) {
				if (isInVisibleList) {
					cardAnalysis.可见卡片.push({
						索引: i,
						标题: card?.title?.substring(0, 15) + "...",
						位置: `(${position.x}, ${position.y})`,
						高度: height || "预估:" + estimatedHeight,
						范围: `${position.y} ~ ${cardBottom}`,
						状态: "✓ 正常显示",
					});
				} else {
					cardAnalysis.应该可见但未显示.push({
						索引: i,
						标题: card?.title?.substring(0, 15) + "...",
						位置: `(${position.x}, ${position.y})`,
						高度: height || "预估:" + estimatedHeight,
						范围: `${position.y} ~ ${cardBottom}`,
						状态: "❌ 缺失",
					});
				}
			}
		}

		// 打印分析结果
		Object.entries(cardAnalysis).forEach(([category, items]) => {
			if (items.length > 0) {
				console.group(`${category} (${items.length}项)`);
				items.forEach((item) => console.log(item));
				console.groupEnd();
			}
		});

		return {
			基础信息: {
				滚动位置: scrollTop.value,
				可视区域: `${viewTop} ~ ${viewBottom}`,
				卡片分析: cardAnalysis,
			},
		};
	};

	// 简化版调试函数 - 快速查看当前状态
	const quickDebug = () => {
		if (!import.meta.client) return;

		const viewTop = scrollTop.value - bufferHeight.value;
		const viewBottom =
			scrollTop.value + viewportHeight.value + bufferHeight.value;
		const visibleCount = visibleCardsCache.value.length;
	};

	// 将调试函数暴露到全局，方便在控制台调用
	if (import.meta.client) {
		(window as any).debugVirtualList = debugVirtualList;
		(window as any).quickDebug = quickDebug;

		// 添加键盘快捷键 Ctrl+Shift+D 触发快速调试
		window.addEventListener("keydown", (e) => {
			if (e.ctrlKey && e.shiftKey && e.key === "D") {
				e.preventDefault();
				quickDebug();
			}
		});
	}

	// 计算可视卡片的核心函数
	const calculateVisibleCards = () => {
		const startTime = import.meta.client ? performance.now() : 0;
		const cards = displayCards.value;
		const visible: any[] = [];

		// 如果没有卡片或容器未准备好，返回空数组
		if (cards.length === 0 || !container.value) {
			visibleCardsCache.value = visible;
			return;
		}

		// 计算可视区域
		const viewTop = scrollTop.value - bufferHeight.value;
		const viewBottom =
			scrollTop.value + viewportHeight.value + bufferHeight.value;

		// 修复：使用实际位置来查找可视卡片，添加调试信息
		let foundVisibleCards = 0;
		let skippedCards = 0;
		let totalCheckedCards = 0;

		for (let i = 0; i < cards.length; i++) {
			totalCheckedCards++;
			const position = cardPositionsCache.value[i];

			// 🔧 如果位置未计算，跳过（避免阻塞渲染和循环触发）
			if (!position) {
				skippedCards++;
				// 🔧 移除异步计算，避免循环触发虚拟列表重新计算
				// 位置计算应该在数据加载时完成，而不是在虚拟列表计算中
				continue;
			}

			const cardTop = position.y;
			// 优先使用缓存的高度，避免重复计算
			const cardHeight = cardHeightsCache.value[i]; // 使用默认高度避免计算
			const cardBottom = cardTop + cardHeight;

			// 判断卡片是否在可视区域内
			if (cardBottom >= viewTop && cardTop <= viewBottom) {
				visible.push({
					...cards[i],
					originalIndex: i,
				});
				foundVisibleCards++;
			}
		}

		// 🔧 减少调试日志输出，避免影响移动端性能
		if (import.meta.client && process.env.NODE_ENV === "development") {
			if (performanceStats.value.calculateCount % 100 === 0) {
				// 从20次改为100次
				console.log(`🔍 虚拟列表调试:`, {
					滚动位置: scrollTop.value,
					可视区域: `${viewTop} ~ ${viewBottom}`,
					找到可视卡片: foundVisibleCards,
					跳过未计算卡片: skippedCards,
					计算频率: `${performanceStats.value.calculateCount}次`,
					平均耗时: `${performanceStats.value.averageCalculateTime.toFixed(
						2
					)}ms`,
				});
			}
		}

		visibleCardsCache.value = visible;

		// 性能统计（仅客户端）
		if (import.meta.client) {
			const endTime = performance.now();
			const calculateTime = endTime - startTime;
			performanceStats.value.lastCalculateTime = calculateTime;
			performanceStats.value.calculateCount++;
			performanceStats.value.averageCalculateTime =
				(performanceStats.value.averageCalculateTime *
					(performanceStats.value.calculateCount - 1) +
					calculateTime) /
				performanceStats.value.calculateCount;
		}
	};

	// 🔧 虚拟列表：只渲染可视区域内的卡片（移动端优化）
	const visibleCards = computed(() => {
		// 🔧 移动端优化：提高滚动阈值，减少触发频率
		const scrollChanged = Math.abs(scrollTop.value - lastScrollTop.value) > 50; // 从5px提高到50px
		const viewportChanged =
			Math.abs(viewportHeight.value - lastViewportHeight.value) > 10;

		// 🔧 优化强制重新计算条件，避免频繁触发
		const forceRecalculate =
			visibleCardsCache.value.length === 0 || // 没有可视卡片
			(scrollChanged && visibleCardsCache.value.length < 3); // 从6个降低到3个，减少触发

		if (scrollChanged || viewportChanged || forceRecalculate) {
			lastScrollTop.value = scrollTop.value;
			lastViewportHeight.value = viewportHeight.value;
			requestCalculateVisibleCards();
		}

		return visibleCardsCache.value;
	});

	// 瀑布流布局参数
	const gap = 8; // 卡片间距（水平和垂直都使用相同间距）
	const containerPadding = 8; // 容器左右内边距（对应 px-2 = 8px）
	const topGap = 8; // 顶部间距，确保第一行也有间距

	// 🔒 位置锁定机制：跟踪修正状态
	const hasBeenCorrected = ref<Record<number, boolean>>({});

	// 🔒 设置卡片引用 - 唯一修正入口
	const setCardRef = (el: HTMLElement, index: number) => {
		cardRefs.value.set(index, el);

		// 🔒 确保只修正一次
		if (hasBeenCorrected.value[index]) {
			return; // 已修正过，不再修正
		}

		// 获取实际高度
		const actualHeight = el.offsetHeight;
		const estimatedHeight = cardHeightsCache.value[index];
		const diff = Math.abs(actualHeight - estimatedHeight);

		// 🎯 一次性修正：只在首次设置ref且差异较大时修正
		if (diff > 15) {
			// 标记已修正，防止重复修正
			hasBeenCorrected.value[index] = true;

			// 更新高度缓存
			cardHeightsCache.value[index] = actualHeight;

			// 只调整Y坐标，不重新计算位置
			adjustPositionsOnly(index, actualHeight - estimatedHeight);
		} else {
			// 小差异直接更新高度缓存
			cardHeightsCache.value[index] = actualHeight;
		}
	};

	// 🔒 位置调整函数 - 只调整Y坐标，不重新计算位置
	const adjustPositionsOnly = (changedIndex: number, heightDiff: number) => {
		const changedPosition = cardPositionsCache.value[changedIndex];
		if (!changedPosition) return;

		const changedColumn = Math.round(
			changedPosition.x / (getCardWidth() + gap)
		);

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

	// 计算列数
	const getColumnCount = () => {
		if (!container.value) return 2;
		const containerWidth = container.value.clientWidth - containerPadding * 2;

		// 根据屏幕宽度计算列数
		if (containerWidth < 480) return 2; // 小屏幕2列
		if (containerWidth < 768) return 3; // 中屏幕3列
		if (containerWidth < 1024) return 4; // 大屏幕4列
		return 5; // 超大屏幕5列
	};

	// 计算卡片宽度
	const getCardWidth = () => {
		if (!container.value) return 0;
		const containerWidth = container.value.clientWidth - containerPadding * 2;
		const columnCount = getColumnCount();
		return (containerWidth - gap * (columnCount - 1)) / columnCount;
	};

	// // 初始化图片宽高比缓存（使用API返回的尺寸）
	// const initializeImageAspectRatios = () => {
	// 	allCards.value.forEach((card, index) => {
	// 		if (card.coverWidth && card.coverHeight) {
	// 			// 使用API返回的真实宽高比
	// 			imageAspectRatios.value[index] = card.coverWidth / card.coverHeight;
	// 		} else {
	// 			// 如果API没有返回尺寸，使用默认值
	// 			imageAspectRatios.value[index] = 1;
	// 		}
	// 	});
	// };

	// 获取图片显示高度（根据宽高比计算）
	const getImageHeight = (index: number) => {
		const cardWidth = getCardWidth();
		const aspectRatio = imageAspectRatios.value[index] || 1;
		return cardWidth / aspectRatio;
	};

	// 精确计算卡片高度（使用API返回的图片尺寸）
	const getEstimatedCardHeight = (index: number) => {
		const card = displayCards.value[index];
		if (!card) {
			console.warn(`Card not found at index ${index}`);
			return 200;
		}

		const cardWidth = getCardWidth();

		// 如果容器未准备好，返回默认高度
		if (cardWidth <= 0) {
			console.warn(`Invalid card width ${cardWidth} for height calculation`);
			return 200;
		}

		// 使用API返回的图片尺寸计算精确高度
		let imageHeight = 200; // 默认高度
		if (
			card.coverWidth &&
			card.coverHeight &&
			card.coverWidth > 0 &&
			card.coverHeight > 0
		) {
			const aspectRatio = card.coverWidth / card.coverHeight;
			imageHeight = cardWidth / aspectRatio;
		} else if (
			imageAspectRatios.value[index] &&
			imageAspectRatios.value[index] > 0
		) {
			imageHeight = cardWidth / imageAspectRatios.value[index];
		}

		// 确保图片高度合理
		imageHeight = Math.max(100, Math.min(imageHeight, cardWidth * 2));

		// 更精确的标题高度计算（考虑实际字体渲染）
		const titleText = card.title || "";
		// 中文字符约14px宽，英文字符约8px宽，混合估算为11px
		const avgCharWidth = 11;
		const charsPerLine = Math.max(
			1,
			Math.floor((cardWidth - 24) / avgCharWidth)
		); // 减去padding
		const titleLines = Math.min(2, Math.ceil(titleText.length / charsPerLine)); // line-clamp-2限制
		const lineHeight = 20; // text-sm的实际行高
		const titleHeight = titleLines * lineHeight;

		// 分类标签高度：text-xs + px-2 + py-1 + rounded + mt-2
		const categoryHeight = 16 + 4 + 8; // 字体高度 + 垂直padding + margin

		// 用户信息区域高度：头像20px + mt-3
		const userInfoHeight = 20 + 12; // 头像高度 + margin

		// 卡片内边距：p-3 = 12px * 2
		const cardPadding = 24;

		// 各部分间距
		const spaceBetweenSections = 8; // mt-2 + mt-3的总和

		const totalHeight = Math.round(
			imageHeight +
				titleHeight +
				categoryHeight +
				userInfoHeight +
				cardPadding +
				spaceBetweenSections
		);

		// 确保返回合理的高度
		return Math.max(150, totalHeight);
	};

	// 初始化图片宽高比（优先使用API数据，fallback到图片加载）
	const initializeImageAspectRatio = (card: any, index: number) => {
		// 优先使用API返回的尺寸
		if (
			card.coverWidth &&
			card.coverHeight &&
			card.coverWidth > 0 &&
			card.coverHeight > 0
		) {
			const aspectRatio = card.coverWidth / card.coverHeight;
			// 确保宽高比合理（防止极端值）
			imageAspectRatios.value[index] = Math.max(0.1, Math.min(aspectRatio, 10));

			// 延迟计算位置，确保容器已准备好
			nextTick(() => {
				if (!cardPositionsCache.value[index] && container.value) {
					calculateCardPosition(index);
				}
			});
		} else {
			// 如果API没有尺寸信息，设置默认值并fallback到图片预加载
			imageAspectRatios.value[index] = 1; // 默认正方形
			preloadImageAspectRatio(card.img, index);
		}
	};

	// 预加载图片获取宽高比（仅在API没有尺寸时使用）
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

	// 🔒 限制使用：从指定索引开始重新计算卡片位置
	// 只在以下情况使用：1. 窗口大小变化 2. 数据刷新 3. 图片宽高比初始化时发现差异巨大
	const recalculateFromIndex = (startIndex: number) => {
		console.log("🔒 重新计算卡片位置（限制使用）", startIndex);
		// 确保容器已准备好
		if (!container.value) {
			console.warn("Container not ready for recalculation");
			return;
		}

		// 重置列高度到 startIndex 之前的状态
		const columnCount = getColumnCount();
		const cardWidth = getCardWidth();

		if (cardWidth <= 0) {
			console.warn("Invalid card width for recalculation");
			return;
		}

		// 初始化列高度为顶部间距
		const newColumnHeights = new Array(columnCount).fill(topGap);

		// 重新计算列高度到 startIndex 位置
		for (let i = 0; i < startIndex; i++) {
			const position = cardPositionsCache.value[i];
			if (position) {
				const columnIndex = Math.round(position.x / (cardWidth + gap));
				// 确保列索引有效
				if (columnIndex >= 0 && columnIndex < columnCount) {
					const cardHeight = cardHeightsCache.value[i];
					newColumnHeights[columnIndex] = Math.max(
						newColumnHeights[columnIndex],
						position.y + cardHeight + gap
					);
				}
			}
		}

		columnHeights.value = newColumnHeights;

		// 🔒 重新计算从 startIndex 开始的所有卡片位置（清除锁定状态）
		for (let i = startIndex; i < displayCards.value.length; i++) {
			// 清除旧位置和修正状态
			cardPositionsCache.value[i] = undefined as any;
			hasBeenCorrected.value[i] = false; // 重置修正状态
			calculateCardPosition(i);
		}

		updateTotalHeight();
	};

	// 🔒 计算单个卡片位置（一旦计算就永久锁定）
	const calculateCardPosition = (index: number) => {
		console.log("🔒 计算卡片位置", index);
		// 🔒 强化锁定检查
		if (cardPositionsCache.value[index]) {
			console.log("🔒 已锁定，绝不重新计算", index);
			return; // 已锁定，绝不重新计算
		}

		// 确保容器已准备好
		if (!container.value) {
			console.warn(`Container not ready for card ${index}`);
			return;
		}

		const columnCount = getColumnCount();
		const cardWidth = getCardWidth();

		// 确保卡片宽度有效
		if (cardWidth <= 0) {
			console.warn(`Invalid card width ${cardWidth} for card ${index}`);
			return;
		}

		// 如果列高度缓存不存在或列数发生变化，重新初始化
		if (columnHeights.value.length !== columnCount) {
			// 初始化所有列高度为顶部间距，确保第一行卡片也有顶部间距
			columnHeights.value = new Array(columnCount).fill(topGap);

			// 重新计算之前所有卡片对列高度的贡献
			for (let i = 0; i < index; i++) {
				const position = cardPositionsCache.value[i];
				if (position) {
					// 使用当前的cardWidth重新计算列索引
					const columnIndex = Math.round(position.x / (cardWidth + gap));
					// 确保列索引有效
					if (columnIndex >= 0 && columnIndex < columnCount) {
						const cardHeight = cardHeightsCache.value[i];
						columnHeights.value[columnIndex] = Math.max(
							columnHeights.value[columnIndex],
							position.y + cardHeight + gap
						);
					}
				}
			}
		}

		// 找到最短的列
		const shortestColumnIndex = columnHeights.value.indexOf(
			Math.min(...columnHeights.value)
		);

		// 计算卡片位置
		const x = shortestColumnIndex * (cardWidth + gap);
		const y = columnHeights.value[shortestColumnIndex];

		// 预估高度并缓存
		const cardHeight = getEstimatedCardHeight(index);
		if (cardHeight <= 0) {
			console.warn(`Invalid card height ${cardHeight} for card ${index}`);
			return;
		}

		// 🔒 一旦计算就永久锁定
		cardPositionsCache.value[index] = {
			x,
			y,
			width: `${cardWidth}px`,
		};

		// 缓存高度
		if (!cardHeightsCache.value[index]) {
			cardHeightsCache.value[index] = cardHeight;
		}

		// 更新列高度：当前位置 + 卡片高度 + 间距
		columnHeights.value[shortestColumnIndex] = y + cardHeight + gap;

		updateTotalHeight();
	};

	// 🔒 瀑布流布局算法 - 重新计算所有位置（仅在窗口大小变化时调用）
	const layoutCards = async () => {
		if (!container.value) return;

		await nextTick();

		// 🔒 清空缓存，重新计算（重置修正状态）
		cardPositionsCache.value = [];
		cardHeightsCache.value = [];
		columnHeights.value = [];
		hasBeenCorrected.value = {}; // 重置修正状态

		// 为所有显示的卡片计算位置
		for (let i = 0; i < displayCards.value.length; i++) {
			calculateCardPosition(i);
		}

		updateTotalHeight();

		// 布局完成后检查是否需要加载更多
		setTimeout(() => {
			checkIfNeedLoadMore();
		}, 100);
	};

	// 更新总高度
	const updateTotalHeight = () => {
		if (columnHeights.value.length === 0) return;
		// 总高度 = 最高列的高度 + 底部间距
		totalContentHeight.value = Math.max(...columnHeights.value) + gap;
	};

	// 分析实际高度组成
	const analyzeActualHeight = (cardEl: HTMLElement, index: number) => {
		const card = displayCards.value[index];
		if (!card) return;

		// 获取各部分的实际高度
		const imageContainer = cardEl.querySelector(
			".relative > div"
		) as HTMLElement;
		const contentContainer = cardEl.querySelector(".p-3") as HTMLElement;
		const titleEl = contentContainer?.querySelector(".text-sm") as HTMLElement;
		const categoryEl = contentContainer?.querySelector(".mt-2") as HTMLElement;
		const userInfoEl = contentContainer?.querySelector(".mt-3") as HTMLElement;

		const breakdown = {
			total: cardEl.offsetHeight,
			image: imageContainer?.offsetHeight || 0,
			content: contentContainer?.offsetHeight || 0,
			title: titleEl?.offsetHeight || 0,
			category: categoryEl?.offsetHeight || 0,
			userInfo: userInfoEl?.offsetHeight || 0,
		};

		return breakdown;
	};

	// 🔒 图片加载完成后仅标记状态（不再进行位置修正）
	const onImageLoad = (index: number) => {
		// 标记图片已加载
		imageLoadedStates.value[index] = true;

		// 🔒 移除位置修正逻辑，修正统一在setCardRef中进行
		setTimeout(() => {
			// 检查是否需要加载更多
			checkIfNeedLoadMore();
		}, 10);
	};

	// 防抖的窗口大小变化处理
	const debouncedResize = debounce(() => {
		if (import.meta.client) {
			viewportHeight.value = window.innerHeight;
			layoutCards(); // 窗口大小变化时重新计算所有位置
		}
	}, 300);
	// 检查是否需要加载更多数据（独立函数）
	const checkIfNeedLoadMore = async () => {
		if (
			isLoadingMore.value ||
			!hasMore.value ||
			isRefreshing.value ||
			!import.meta.client
		)
			return;

		await nextTick(); // 等待DOM更新

		const documentHeight = document.documentElement.scrollHeight;
		const windowHeight = window.innerHeight;
		const currentScrollTop =
			window.pageYOffset || document.documentElement.scrollTop;

		// 情况1: 内容高度不足填满屏幕（无滚动条）
		if (documentHeight <= windowHeight + 50) {
			loadMore();
			return;
		}

		// 情况2: 有滚动条且接近底部
		if (currentScrollTop + windowHeight >= documentHeight - 100) {
			loadMore();
		}
	};
	// 更新滚动位置（防抖处理）
	const updateScrollTop = () => {
		if (import.meta.client) {
			scrollTop.value =
				window.pageYOffset || document.documentElement.scrollTop;
		}
	};

	// 防抖的滚动处理
	const debouncedScrollHandler = debounce(() => {
		updateScrollTop();
		checkIfNeedLoadMore();
	}, 16); // 约60fps

	// 立即更新滚动位置（用于虚拟列表），延迟处理其他逻辑
	const handleScroll = () => {
		if (import.meta.client) {
			// 立即更新滚动位置，确保虚拟列表响应及时
			scrollTop.value =
				window.pageYOffset || document.documentElement.scrollTop;
			// 延迟处理其他逻辑
			debouncedScrollHandler();
		}
	};

	// 加载更多数据
	const loadMore = async () => {
		if (isLoadingMore.value || !hasMore.value) return;

		isLoadingMore.value = true;

		try {
			const nextPage = currentPage.value + 1;
			const nextList = (await getList({
				start: nextPage,
				limit,
				category: category as string | null,
				like: like as string | null,
			})) as any;
			if (nextList && nextList.data && nextList.data.length > 0) {
				const newCards = transformApiData(nextList.data);
				const oldLength = allCards.value.length;
				allCards.value.push(...newCards);
				currentPage.value = nextPage;

				// 为新加载的卡片初始化宽高比和计算位置
				for (let i = oldLength; i < allCards.value.length; i++) {
					initializeImageAspectRatio(allCards.value[i], i);
				}
			} else {
				hasMore.value = false;
			}
		} catch (error) {
			console.error("加载更多数据失败:", error);
		}

		isLoadingMore.value = false;
	};

	// 下拉刷新
	const refresh = async () => {
		if (isRefreshing.value) return;

		isRefreshing.value = true;

		try {
			const refreshList = (await getList({
				start,
				limit,
				category: category as string | null,
				like: like as string | null,
			})) as any;

			if (refreshList && refreshList.data) {
				// 🔒 重置状态（包括修正状态）
				currentPage.value = 1;
				hasMore.value = true;
				cardRefs.value.clear();
				cardPositionsCache.value = [];
				cardHeightsCache.value = [];
				columnHeights.value = [];
				imageAspectRatios.value = [];
				imageLoadedStates.value = {}; // 重置图片加载状态
				hasBeenCorrected.value = {}; // 🔒 重置修正状态
				scrollTop.value = 0;
				totalContentHeight.value = 0;

				// 更新数据
				allCards.value = transformApiData(refreshList.data);

				// 重新初始化图片宽高比和计算位置
				displayCards.value.forEach((card, index) => {
					initializeImageAspectRatio(card, index);
				});

				// 重新布局
				layoutCards();
			}
		} catch (error) {
			console.error("刷新数据失败:", error);
		}

		isRefreshing.value = false;
		showPullRefresh.value = false;
		pullDistance.value = 0;
	};

	// 触摸事件处理 - 修改逻辑，只有下滑时才显示
	const onTouchStart = (e: TouchEvent) => {
		if (import.meta.client && window.pageYOffset === 0) {
			startY.value = e.touches[0].clientY;
			isUserScrolling.value = false;
		}
	};

	const onTouchMove = (e: TouchEvent) => {
		if (isRefreshing.value) return;

		const currentY = e.touches[0].clientY;
		const distance = currentY - startY.value;

		// 只有在页面顶部且向下滑动且距离超过10px时才显示下拉刷新
		if (
			import.meta.client &&
			distance > 10 &&
			window.pageYOffset === 0 &&
			!isUserScrolling.value
		) {
			e.preventDefault();
			showPullRefresh.value = true;
			pullDistance.value = Math.min(distance, 150);
		} else if (import.meta.client && (distance < 0 || window.pageYOffset > 0)) {
			// 向上滑动或不在顶部时隐藏下拉刷新
			showPullRefresh.value = false;
			pullDistance.value = 0;
			isUserScrolling.value = true;
		}
	};

	const onTouchEnd = () => {
		if (
			showPullRefresh.value &&
			pullDistance.value > 80 &&
			!isRefreshing.value
		) {
			refresh();
		} else {
			showPullRefresh.value = false;
			pullDistance.value = 0;
		}
		isUserScrolling.value = false;
	};

	// 视频预览函数 - 打开模态框
	const previewVideo = (card: any) => {
		currentVideoData.value = card;
		showVideoModal.value = true;

		// 防止背景滚动
		document.body.style.overflow = "hidden";
	};

	// 关闭视频模态框
	const closeVideoModal = () => {
		showVideoModal.value = false;
		currentVideoData.value = null;

		// 恢复背景滚动
		document.body.style.overflow = "";

		// 停止视频播放
		if (modalVideoRef.value) {
			modalVideoRef.value.pause();
			modalVideoRef.value.currentTime = 0;
		}
	};

	// 模态框视频播放结束处理
	const onModalVideoEnded = () => {
		// 视频结束后可以选择关闭模态框或者其他操作
		// closeVideoModal();
	};

	// 视频播放结束处理
	const onVideoEnded = (id: number) => {
		playingVideos.value[id] = false;
	};

	// 视频播放暂停处理
	const onVideoPaused = (id: number) => {
		playingVideos.value[id] = false;
	};

	// 客户端初始数据加载
	const loadInitialData = async () => {
		if (!import.meta.client) return;

		try {
			isLoadingMore.value = true;

			const initialList = (await getList({
				start,
				limit,
				category: category as string | null,
				like: like as string | null,
			})) as any;

			if (initialList && initialList.data && initialList.data.length > 0) {
				allCards.value = transformApiData(initialList.data);

				// 初始化图片宽高比
				await nextTick();
				if (container.value) {
					// 先初始化所有卡片的图片宽高比
					allCards.value.forEach((card, index) => {
						if (
							card.coverWidth &&
							card.coverHeight &&
							card.coverWidth > 0 &&
							card.coverHeight > 0
						) {
							const aspectRatio = card.coverWidth / card.coverHeight;
							imageAspectRatios.value[index] = Math.max(
								0.1,
								Math.min(aspectRatio, 10)
							);
						} else {
							imageAspectRatios.value[index] = 1;
							// 异步预加载图片
							preloadImageAspectRatio(card.img, index);
						}
					});

					// 计算布局
					layoutCards();

					// 检查是否需要加载更多
					setTimeout(() => {
						checkIfNeedLoadMore();
					}, 100);
				}
			} else {
				hasMore.value = false;
			}
		} catch (error) {
			console.error("加载初始数据失败:", error);
			hasMore.value = false;
		} finally {
			isLoadingMore.value = false;
		}
	};

	onMounted(() => {
		// 只在客户端执行
		if (import.meta.client) {
			// 初始化视口高度
			viewportHeight.value = window.innerHeight;

			// 加载初始数据
			loadInitialData();

			window.addEventListener("resize", debouncedResize);
			window.addEventListener("scroll", handleScroll, { passive: true });
		}
	});

	onUnmounted(() => {
		// 只在客户端执行清理
		if (import.meta.client) {
			window.removeEventListener("resize", debouncedResize);
			window.removeEventListener("scroll", handleScroll);

			// 清理RAF
			if (rafId) {
				cancelAnimationFrame(rafId);
				rafId = null;
			}
		}

		// 清理缓存（可选，帮助垃圾回收）
		cardRefs.value.clear();
		visibleCardsCache.value = [];
		// 🔒 重置修正状态
		hasBeenCorrected.value = {};
	});
</script>

<style scoped>
	.line-clamp-2 {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.blur-background {
		background-size: cover;
		background-position: center;
		background-repeat: no-repeat;
		filter: blur(20px);
		transform: scale(1.1);
		will-change: transform;
	}

	.video-responsive {
		min-width: 0;
		min-height: 0;
		flex-shrink: 1;
	}

	/* 针对不同屏幕比例优化 */
	@media (max-aspect-ratio: 16/9) {
		.video-responsive {
			width: 100% !important;
			height: auto !important;
		}
	}

	@media (min-aspect-ratio: 16/9) {
		.video-responsive {
			width: auto !important;
			height: 100% !important;
		}
	}
</style>
