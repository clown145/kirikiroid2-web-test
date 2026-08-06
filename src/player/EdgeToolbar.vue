<script setup>
// 顶部边缘唤出工具条。
//
// 取代旧的 #game-controls-bar —— 那个常驻在右上角，永远挡着画面。
// 这里默认零 UI：只有把指针移到屏幕最顶端 6px，或从顶边下滑，才滑出。
// 露出后 3 秒无交互自动收起；指针停在条上时不收。

import { ref, onMounted, onUnmounted } from 'vue';

const props = defineProps({
    title: { type: String, default: '' },
    isFullscreen: { type: Boolean, default: false },
    fullscreenAvailable: { type: Boolean, default: true }
});

const emit = defineEmits(['exit', 'toggle-fullscreen', 'open-saves']);

const visible = ref(false);
const hovering = ref(false);
// 首次进入给一次性提示，让用户知道 UI 藏在哪儿
const showHint = ref(true);

const HOT_ZONE_PX = 6;
const AUTO_HIDE_MS = 3000;

let hideTimer = null;

function scheduleHide() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
        if (!hovering.value) visible.value = false;
    }, AUTO_HIDE_MS);
}

function reveal() {
    visible.value = true;
    showHint.value = false;
    scheduleHide();
}

function onPointerMove(e) {
    if (e.clientY <= HOT_ZONE_PX) reveal();
}

// 触屏：从顶部边缘起手下滑
let touchStartY = null;
function onTouchStart(e) {
    touchStartY = e.touches[0]?.clientY ?? null;
}
function onTouchMove(e) {
    if (touchStartY === null) return;
    const y = e.touches[0]?.clientY ?? 0;
    if (touchStartY <= 24 && y - touchStartY > 24) {
        reveal();
        touchStartY = null;
    }
}

function onKeydown(e) {
    // 输入框里不抢键
    if (e.target instanceof HTMLElement &&
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

    if (e.key === 'Escape') { reveal(); return; }
    if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        emit('toggle-fullscreen');
    }
}

function onBarEnter() {
    hovering.value = true;
    clearTimeout(hideTimer);
}

function onBarLeave() {
    hovering.value = false;
    scheduleHide();
}

onMounted(() => {
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('keydown', onKeydown);
    // 提示 4 秒后自行淡出
    setTimeout(() => { showHint.value = false; }, 4000);
});

onUnmounted(() => {
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('touchstart', onTouchStart);
    window.removeEventListener('touchmove', onTouchMove);
    window.removeEventListener('keydown', onKeydown);
    clearTimeout(hideTimer);
});
</script>

<template>
    <!-- 热区本身不可见、不吃事件，只用来兜住指针位置判断 -->
    <div class="hotzone" aria-hidden="true" />

    <Transition name="slide">
        <div
            v-show="visible"
            class="bar"
            @pointerenter="onBarEnter"
            @pointerleave="onBarLeave">
            <button class="btn btn-ghost btn-sm" @click="emit('exit')" title="退出游戏（回到游戏库）">
                <svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15" aria-hidden="true">
                    <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
                </svg>
                退出
            </button>

            <span class="title" :title="title">{{ title }}</span>

            <div class="right">
                <button class="btn btn-ghost btn-sm" @click="emit('open-saves')" title="存档空间">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15" aria-hidden="true">
                        <path d="M17 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7l-4-4zm-5 16a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm3-10H5V5h10v4z" />
                    </svg>
                    存档
                </button>

                <button
                    v-if="fullscreenAvailable"
                    class="btn btn-ghost btn-sm"
                    @click="emit('toggle-fullscreen')"
                    :title="isFullscreen ? '退出全屏 (F)' : '全屏 (F)'">
                    <svg v-if="!isFullscreen" viewBox="0 0 24 24" fill="currentColor" width="15" height="15" aria-hidden="true">
                        <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
                    </svg>
                    <svg v-else viewBox="0 0 24 24" fill="currentColor" width="15" height="15" aria-hidden="true">
                        <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
                    </svg>
                    {{ isFullscreen ? '退出全屏' : '全屏' }}
                </button>
            </div>
        </div>
    </Transition>

    <!-- 一次性提示：告诉用户控制条在哪，随后自行消失 -->
    <Transition name="fade">
        <div v-if="showHint && !visible" class="hint-toast">
            移动到顶部显示控制栏 · <kbd>F</kbd> 全屏
        </div>
    </Transition>
</template>

<style scoped>
.hotzone {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 6px;
    z-index: calc(var(--z-toolbar) - 1);
    pointer-events: none;
}

.bar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: var(--z-toolbar);
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-3);
    /* 顶部有刘海/状态栏时（全屏 + viewport-fit=cover）不被遮住 */
    padding-top: max(var(--space-2), env(safe-area-inset-top));
    background: rgba(10, 10, 11, 0.72);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    border-bottom: 1px solid var(--line);
}

.title {
    flex: 1;
    min-width: 0;
    font-size: 13px;
    font-weight: 500;
    color: var(--fg-1);
    text-align: center;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.right { display: flex; gap: var(--space-1); }

.slide-enter-active, .slide-leave-active {
    transition: transform var(--dur) var(--ease), opacity var(--dur) var(--ease);
}
.slide-enter-from, .slide-leave-to {
    transform: translateY(-100%);
    opacity: 0;
}

.hint-toast {
    position: fixed;
    top: var(--space-4);
    left: 50%;
    transform: translateX(-50%);
    z-index: var(--z-toolbar);
    padding: 7px 14px;
    border-radius: 999px;
    background: rgba(10, 10, 11, 0.8);
    backdrop-filter: blur(12px);
    border: 1px solid var(--line);
    font-size: 12px;
    color: var(--fg-1);
    pointer-events: none;
    white-space: nowrap;
}

.hint-toast kbd {
    padding: 1px 5px;
    border-radius: 4px;
    background: var(--bg-3);
    border: 1px solid var(--line);
    font-family: inherit;
    font-size: 11px;
}

.fade-enter-active, .fade-leave-active { transition: opacity 400ms var(--ease); }
.fade-enter-from, .fade-leave-to { opacity: 0; }

@media (max-width: 640px) {
    .title { font-size: 12px; }
}
</style>
