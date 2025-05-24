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
				<!-- 外层容器维持总高度 - 动态计算所有卡片的总高度 -->
				<div :style="{ height: totalContentHeight + 'px' }" class="relative">
					<!-- 卡片渲染区域 - 只渲染可视区域内的卡片 -->
					<div
						v-for="card in visibleCards"
						:key="card.id"
						:ref="(el) => { if (el) setCardRef(el as HTMLElement, card.originalIndex) }"
						class="absolute bg-white rounded-xs shadow overflow-hidden"
						:style="{
							width: cardPositionsCache[card.originalIndex]?.width || '0px',
							transform: `translate3d(${
								cardPositionsCache[card.originalIndex]?.x || 0
							}px, ${cardPositionsCache[card.originalIndex]?.y || 0}px, 0)`,
							willChange: 'transform',
						}"
					>
						<!-- 图片容器 -->
						<div class="relative">
							<!-- 封面图片 -->
							<img
								:src="card.img"
								class="w-full transition-opacity duration-300"
								:class="{ 'opacity-0': playingVideos[card.id] }"
								:style="{ height: getImageHeight(card.originalIndex) + 'px' }"
								:alt="card.title"
								@load="onImageLoad(card.originalIndex)"
							/>

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
								class="absolute top-1 left-1 bg-black bg-opacity-30 rounded-full p-1 cursor-pointer hover:bg-opacity-50 transition-all z-10"
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
										class="w-4 h-4 mr-1"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										viewBox="0 0 24 24"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											d="M14 10h4.764a2 2 0 011.789 2.894l-3.764 7.528A2 2 0 0115 22H9a2 2 0 01-1.789-1.578l-3.764-7.528A2 2 0 014.236 10H9m5 0V6a3 3 0 00-6 0v4"
										/>
									</svg>
									{{ card.like }}
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- 上拉加载指示器 -->
		<div v-if="isLoadingMore" class="flex items-center justify-center py-4">
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
	</div>
</template>

<script setup lang="ts">
	import { ref, onMounted, onUnmounted, nextTick, computed } from "vue";

	// 数据转换函数
	const transformApiData = (apiData: any[]): any[] => {
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
		}));
	};

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
	const pageSize = 20;
	const isLoadingMore = ref(false);
	const isRefreshing = ref(false);
	const hasMore = ref(true);
	const showPullRefresh = ref(false);
	const pullDistance = ref(0);
	const startY = ref(0);
	const scrollTop = ref(0);
	const viewportHeight = ref(0);
	const bufferHeight = ref(200); // 缓冲区高度
	const playingVideos = ref<Record<number, boolean>>({});
	const isUserScrolling = ref(false); // 新增：用于判断用户是否在滚动

	// 存储所有卡片数据
	const allCards = ref<any[]>([]);

	// 初始化加载数据
	const { data: initialList, error: initialError } = await getList({
		start: 1,
		limit: pageSize,
	});

	if (initialList && initialList.value?.data) {
		allCards.value = transformApiData(initialList.value.data);
	} else {
		console.error("Failed to load initial data:", initialError);
		hasMore.value = false;
	}

	// 计算当前显示的卡片
	const displayCards = computed(() => {
		return allCards.value;
	});

	// 虚拟列表：只渲染可视区域内的卡片
	const visibleCards = computed(() => {
		const cards = displayCards.value;
		const visible: any[] = [];

		// 计算可视区域
		const viewTop = scrollTop.value - bufferHeight.value;
		const viewBottom =
			scrollTop.value + viewportHeight.value + bufferHeight.value;

		for (let i = 0; i < cards.length; i++) {
			const position = cardPositionsCache.value[i];
			if (!position) continue;

			const cardTop = position.y;
			const cardHeight = cardHeightsCache.value[i] || getEstimatedCardHeight(i);
			const cardBottom = cardTop + cardHeight;

			// 判断卡片是否在可视区域内
			if (cardBottom >= viewTop && cardTop <= viewBottom) {
				visible.push({
					...cards[i],
					originalIndex: i,
				});
			}
		}

		return visible;
	});

	// 瀑布流布局参数
	const gap = 8; // 卡片间距
	const padding = 8; // 容器内边距

	// 防抖函数
	const debounce = (func: Function, delay: number) => {
		let timeoutId: ReturnType<typeof setTimeout>;
		return (...args: any[]) => {
			clearTimeout(timeoutId);
			timeoutId = setTimeout(() => func.apply(null, args), delay);
		};
	};

	// 设置卡片引用
	const setCardRef = (el: HTMLElement, index: number) => {
		cardRefs.value.set(index, el);
		// 更新实际高度缓存
		const actualHeight = el.offsetHeight;
		if (cardHeightsCache.value[index] !== actualHeight) {
			cardHeightsCache.value[index] = actualHeight;
			// 高度发生变化时，重新计算后续卡片位置
			recalculateFromIndex(index + 1);
		}
	};

	// 计算列数
	const getColumnCount = () => {
		if (!container.value) return 2;
		const containerWidth = container.value.clientWidth - padding * 2;

		// 根据屏幕宽度计算列数
		if (containerWidth < 480) return 2; // 小屏幕2列
		if (containerWidth < 768) return 3; // 中屏幕3列
		if (containerWidth < 1024) return 4; // 大屏幕4列
		return 5; // 超大屏幕5列
	};

	// 计算卡片宽度
	const getCardWidth = () => {
		if (!container.value) return 0;
		const containerWidth = container.value.clientWidth - padding * 2;
		const columnCount = getColumnCount();
		return (containerWidth - gap * (columnCount - 1)) / columnCount;
	};

	// 获取图片显示高度（根据宽高比计算）
	const getImageHeight = (index: number): number => {
		const cardWidth = getCardWidth();
		const aspectRatio = imageAspectRatios.value[index] || 1;
		return cardWidth / aspectRatio;
	};

	// 预估卡片高度（用于未渲染的卡片）
	const getEstimatedCardHeight = (index: number): number => {
		const card = displayCards.value[index];
		if (!card) return 200;

		const titleLines = Math.ceil(card.title.length / 20); // 估算标题行数
		const imageHeight = getImageHeight(index);
		return imageHeight + 16 + titleLines * 20 + 40 + 32; // 图片+间距+标题+描述+底部信息+padding
	};

	// 预加载图片获取宽高比
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

	// 从指定索引开始重新计算卡片位置
	const recalculateFromIndex = (startIndex: number) => {
		// 重置列高度到 startIndex 之前的状态
		const columnCount = getColumnCount();
		const newColumnHeights = new Array(columnCount).fill(0);

		// 重新计算列高度到 startIndex 位置
		for (let i = 0; i < startIndex; i++) {
			const position = cardPositionsCache.value[i];
			if (position) {
				const cardWidth = getCardWidth();
				const columnIndex = Math.round(position.x / (cardWidth + gap));
				const cardHeight =
					cardHeightsCache.value[i] || getEstimatedCardHeight(i);
				newColumnHeights[columnIndex] = Math.max(
					newColumnHeights[columnIndex],
					position.y + cardHeight + gap
				);
			}
		}

		columnHeights.value = newColumnHeights;

		// 重新计算从 startIndex 开始的所有卡片位置
		for (let i = startIndex; i < displayCards.value.length; i++) {
			// 清除旧位置
			if (cardPositionsCache.value[i]) {
				cardPositionsCache.value[i] = undefined as any;
			}
			calculateCardPosition(i);
		}

		updateTotalHeight();
	};

	// 计算单个卡片位置（一旦计算就缓存）
	const calculateCardPosition = (index: number) => {
		if (cardPositionsCache.value[index]) {
			return; // 已经计算过，不再改变
		}

		const columnCount = getColumnCount();
		const cardWidth = getCardWidth();

		// 如果列高度缓存不存在，重新计算
		if (columnHeights.value.length !== columnCount) {
			columnHeights.value = new Array(columnCount).fill(0);

			// 重新计算之前所有卡片对列高度的贡献
			for (let i = 0; i < index; i++) {
				const position = cardPositionsCache.value[i];
				if (position) {
					const columnIndex = Math.round(position.x / (cardWidth + gap));
					const cardHeight =
						cardHeightsCache.value[i] || getEstimatedCardHeight(i);
					columnHeights.value[columnIndex] = Math.max(
						columnHeights.value[columnIndex],
						position.y + cardHeight + gap
					);
				}
			}
		}

		// 找到最短的列
		const shortestColumnIndex = columnHeights.value.indexOf(
			Math.min(...columnHeights.value)
		);

		// 计算卡片位置 - 移除padding，从x=0开始
		const x = shortestColumnIndex * (cardWidth + gap);
		const y = columnHeights.value[shortestColumnIndex];

		// 缓存位置（不再改变）
		cardPositionsCache.value[index] = {
			x,
			y,
			width: `${cardWidth}px`,
		};

		// 预估高度并缓存
		const cardHeight =
			cardHeightsCache.value[index] || getEstimatedCardHeight(index);
		if (!cardHeightsCache.value[index]) {
			cardHeightsCache.value[index] = cardHeight;
		}

		// 更新列高度
		columnHeights.value[shortestColumnIndex] = y + cardHeight + gap;

		updateTotalHeight();
	};

	// 瀑布流布局算法 - 重新计算所有位置（仅在窗口大小变化时调用）
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

	// 更新总高度
	const updateTotalHeight = () => {
		if (columnHeights.value.length === 0) return;
		totalContentHeight.value = Math.max(...columnHeights.value);
	};

	// 图片加载完成后更新高度
	const onImageLoad = (index: number) => {
		setTimeout(() => {
			const cardEl = cardRefs.value.get(index);
			if (cardEl) {
				const actualHeight = cardEl.offsetHeight;
				const estimatedHeight = cardHeightsCache.value[index];

				// 如果实际高度与预估高度差异较大，重新计算后续位置
				if (Math.abs(actualHeight - estimatedHeight) > 5) {
					cardHeightsCache.value[index] = actualHeight;
					recalculateFromIndex(index + 1);
				} else {
					cardHeightsCache.value[index] = actualHeight;
					updateTotalHeight();
				}
			}
		}, 10);
	};

	// 防抖的窗口大小变化处理
	const debouncedResize = debounce(() => {
		viewportHeight.value = window.innerHeight;
		layoutCards(); // 窗口大小变化时重新计算所有位置
	}, 300);

	// 更新滚动位置
	const updateScrollTop = () => {
		scrollTop.value = window.pageYOffset || document.documentElement.scrollTop;

		// 检查是否需要加载更多
		const documentHeight = document.documentElement.scrollHeight;
		const windowHeight = window.innerHeight;

		// 距离底部100px时开始加载
		if (!isLoadingMore.value && !isRefreshing.value && hasMore.value) {
			if (scrollTop.value + windowHeight >= documentHeight - 100) {
				loadMore();
			}
		}
	};

	// 加载更多数据
	const loadMore = async () => {
		if (isLoadingMore.value || !hasMore.value) return;

		isLoadingMore.value = true;

		try {
			const nextPage = currentPage.value + 1;
			const { data: nextData } = await getList({
				start: nextPage,
				limit: pageSize,
			});

			if (nextData && nextData.value?.data && nextData.value.data.length > 0) {
				const newCards = transformApiData(nextData.value.data);
				const oldLength = allCards.value.length;
				allCards.value.push(...newCards);
				currentPage.value = nextPage;

				// 为新加载的图片预加载宽高比和计算位置
				for (let i = oldLength; i < allCards.value.length; i++) {
					preloadImageAspectRatio(allCards.value[i].img, i);
					calculateCardPosition(i);
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
			const { data: refreshData } = await getList({
				start: 1,
				limit: pageSize,
			});

			if (refreshData && refreshData.value?.data) {
				// 重置状态
				currentPage.value = 1;
				hasMore.value = true;
				cardRefs.value.clear();
				cardPositionsCache.value = [];
				cardHeightsCache.value = [];
				columnHeights.value = [];
				imageAspectRatios.value = [];
				scrollTop.value = 0;
				totalContentHeight.value = 0;

				// 更新数据
				allCards.value = transformApiData(refreshData.value.data);

				// 重新预加载图片和计算位置
				displayCards.value.forEach((card, index) => {
					preloadImageAspectRatio(card.img, index);
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
		if (window.pageYOffset === 0) {
			startY.value = e.touches[0].clientY;
			isUserScrolling.value = false;
		}
	};

	const onTouchMove = (e: TouchEvent) => {
		if (isRefreshing.value) return;

		const currentY = e.touches[0].clientY;
		const distance = currentY - startY.value;

		// 只有在页面顶部且向下滑动且距离超过10px时才显示下拉刷新
		if (distance > 10 && window.pageYOffset === 0 && !isUserScrolling.value) {
			e.preventDefault();
			showPullRefresh.value = true;
			pullDistance.value = Math.min(distance, 150);
		} else if (distance < 0 || window.pageYOffset > 0) {
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

	// 视频预览函数
	const previewVideo = (card: any) => {
		// 切换播放状态
		playingVideos.value[card.id] = true;

		// 获取对应的video元素并播放
		setTimeout(() => {
			const videoElements = document.querySelectorAll(
				`video[src*="${card.videoUrl || card.img}"]`
			);
			if (videoElements.length > 0) {
				const videoElement = videoElements[0] as HTMLVideoElement;
				videoElement.play().catch((error) => {
					console.error("视频播放失败:", error);
					playingVideos.value[card.id] = false;
				});
			}
		}, 100);
	};

	// 视频播放结束处理
	const onVideoEnded = (id: number) => {
		playingVideos.value[id] = false;
	};

	// 视频播放暂停处理
	const onVideoPaused = (id: number) => {
		playingVideos.value[id] = false;
	};

	onMounted(() => {
		// 初始化视口高度
		viewportHeight.value = window.innerHeight;

		// 预加载所有初始图片获取宽高比
		displayCards.value.forEach((card, index) => {
			preloadImageAspectRatio(card.img, index);
		});

		layoutCards();
		window.addEventListener("resize", debouncedResize);
		window.addEventListener("scroll", updateScrollTop);
	});

	onUnmounted(() => {
		window.removeEventListener("resize", debouncedResize);
		window.removeEventListener("scroll", updateScrollTop);
	});
</script>

<style scoped>
	.line-clamp-2 {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>
