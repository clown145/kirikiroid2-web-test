// Vue 3 应用：游戏画廊与后台管理逻辑
(function () {
    const { createApp, ref, computed, onMounted } = Vue;

    const STORAGE_KEY = 'krkr2_custom_games_v1';

    const defaultPresetGames = [
      {
        id: 'fate-demo',
        title: '示例游戏：冥契的牧神节',
        coverUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80',
        downloadUrl: '',
        entryXp3: 'data.xp3',
        description: '演示用条目。点击此处可设置远程 ZIP/XP3 包链接下载并自动拉起 Kirikiroid2 引擎。',
        tags: ['ADV', '视觉小说']
      }
    ];

    const app = createApp({
        setup() {
            const games = ref([]);
            const searchQuery = ref('');
            const showAdmin = ref(false);
            const isEditing = ref(false);
            const isGameActive = ref(false);
            const activeGameTitle = ref('');

            const editForm = ref({
                id: '',
                title: '',
                coverUrl: '',
                downloadUrl: '',
                entryXp3: '',
                description: '',
                tags: ''
            });

            // 过滤搜索
            const filteredGames = computed(() => {
                if (!searchQuery.value.trim()) return games.value;
                const q = searchQuery.value.toLowerCase();
                return games.value.filter(g =>
                    (g.title && g.title.toLowerCase().includes(q)) ||
                    (g.description && g.description.toLowerCase().includes(q))
                );
            });

            // 初始化装载列表
            const loadGames = async () => {
                let saved = localStorage.getItem(STORAGE_KEY);
                if (saved) {
                    try {
                        games.value = JSON.parse(saved);
                        return;
                    } catch (e) {
                        console.error('Failed to parse stored games:', e);
                    }
                }
                // 尝试拉取远程 games.json
                try {
                    const res = await fetch('games.json');
                    if (res.ok) {
                        const json = await res.json();
                        games.value = json;
                        return;
                    }
                } catch (e) {
                    console.log('No games.json found, using fallback preset');
                }
                games.value = defaultPresetGames;
            };

            const saveToStorage = () => {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(games.value));
            };

            // 启动选定的游戏
            const playGame = (game) => {
                if (!game.downloadUrl || !game.downloadUrl.trim()) {
                    alert('请先在管理后台为 [' + game.title + '] 配置有效的游戏资源 URL (downloadUrl)');
                    openAdmin();
                    openEdit(game);
                    return;
                }

                activeGameTitle.value = game.title;
                isGameActive.value = true;

                // 根据文件后缀动态识别类型 (.json -> json-url, .xp3 -> xp3-url, .zip -> zip-url)
                const cleanUrl = game.downloadUrl.trim().toLowerCase();
                let sourceType = 'zip-url';
                if (cleanUrl.endsWith('.json') || cleanUrl.includes('.json?')) {
                    sourceType = 'json-url';
                } else if (cleanUrl.endsWith('.xp3') || cleanUrl.includes('.xp3?')) {
                    sourceType = 'xp3-url';
                }

                // 隐藏静态画廊大厅并使根节点透明穿透，以显示底层的 Canvas 游戏画面
                const galleryRoot = document.getElementById('gallery-root');
                const galleryMain = document.querySelector('.gallery-body');
                const galleryNav = document.querySelector('.nav-bar');
                if (galleryMain) galleryMain.style.display = 'none';
                if (galleryNav) galleryNav.style.display = 'none';
                if (galleryRoot) {
                    galleryRoot.style.background = 'transparent';
                    galleryRoot.style.pointerEvents = 'none';
                }

                // 调用 KrKr2App 启动远端资源
                window.KrKr2App.startRemote({
                    type: sourceType,
                    url: game.downloadUrl.trim(),
                    entry: game.entryXp3 ? game.entryXp3.trim() : undefined
                }).catch(err => {
                    console.error('[gallery] Failed to launch game:', err);
                    alert('加载游戏失败: ' + (err.message || err));
                    exitToGallery();
                });
            };

            // 手动上传本地文件启动
            const openLocalUpload = () => {
                document.getElementById('gallery-root').style.display = 'none';
                window.KrKr2UI.showFilePicker();
            };

            // 退出游戏返回大厅
            const exitToGallery = () => {
                isGameActive.value = false;
                const galleryRoot = document.getElementById('gallery-root');
                const galleryMain = document.querySelector('.gallery-body');
                const galleryNav = document.querySelector('.nav-bar');
                if (galleryMain) galleryMain.style.display = '';
                if (galleryNav) galleryNav.style.display = '';
                if (galleryRoot) {
                    galleryRoot.style.background = '';
                    galleryRoot.style.pointerEvents = '';
                }
            };

            // 管理后台 CRUD
            const openAdmin = () => {
                showAdmin.value = true;
            };

            const closeAdmin = () => {
                showAdmin.value = false;
                resetForm();
            };

            const resetForm = () => {
                isEditing.value = false;
                editForm.value = {
                    id: '',
                    title: '',
                    coverUrl: '',
                    downloadUrl: '',
                    entryXp3: '',
                    description: '',
                    tags: ''
                };
            };

            const openEdit = (game) => {
                isEditing.value = true;
                editForm.value = {
                    id: game.id,
                    title: game.title || '',
                    coverUrl: game.coverUrl || '',
                    downloadUrl: game.downloadUrl || '',
                    entryXp3: game.entryXp3 || '',
                    description: game.description || '',
                    tags: Array.isArray(game.tags) ? game.tags.join(', ') : (game.tags || '')
                };
            };

            const saveGame = () => {
                if (!editForm.value.title.trim()) {
                    alert('请输入游戏名称');
                    return;
                }
                const tagList = editForm.value.tags
                    ? editForm.value.tags.split(/[,，]/).map(t => t.trim()).filter(Boolean)
                    : [];

                if (isEditing.value) {
                    const idx = games.value.findIndex(g => g.id === editForm.value.id);
                    if (idx !== -1) {
                        games.value[idx] = {
                            ...games.value[idx],
                            title: editForm.value.title,
                            coverUrl: editForm.value.coverUrl,
                            downloadUrl: editForm.value.downloadUrl,
                            entryXp3: editForm.value.entryXp3,
                            description: editForm.value.description,
                            tags: tagList
                        };
                    }
                } else {
                    games.value.push({
                        id: 'game_' + Date.now(),
                        title: editForm.value.title,
                        coverUrl: editForm.value.coverUrl,
                        downloadUrl: editForm.value.downloadUrl,
                        entryXp3: editForm.value.entryXp3,
                        description: editForm.value.description,
                        tags: tagList
                    });
                }

                saveToStorage();
                resetForm();
            };

            const removeGame = (id) => {
                if (confirm('确定要从画廊中移除该游戏配置吗？')) {
                    games.value = games.value.filter(g => g.id !== id);
                    saveToStorage();
                }
            };

            // JSON 配置导出与导入
            const exportConfig = () => {
                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(games.value, null, 2));
                const downloadAnchor = document.createElement('a');
                downloadAnchor.setAttribute("href", dataStr);
                downloadAnchor.setAttribute("download", "games.json");
                document.body.appendChild(downloadAnchor);
                downloadAnchor.click();
                downloadAnchor.remove();
            };

            const importConfig = (event) => {
                const file = event.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const imported = JSON.parse(e.target.result);
                        if (Array.isArray(imported)) {
                            games.value = imported;
                            saveToStorage();
                            alert('导入配置文件成功！');
                        }
                    } catch (err) {
                        alert('解析 JSON 文件失败: ' + err.message);
                    }
                };
                reader.readAsText(file);
                event.target.value = '';
            };

            // 清理本地已下载的缓存与只读文件系统 (Cache Storage + OPFS + SW)
            const clearAllCaches = async () => {
                if (confirm('确定要清除本地已下载的游戏缓存、SW 缓存和临时文件吗？\n（这不会清空您的画廊配置，清理后页面将自动刷新）')) {
                    try {
                        // 1. 清理 Cache Storage
                        if ('caches' in window) {
                            const keys = await caches.keys();
                            await Promise.all(keys.map(k => caches.delete(k)));
                        }
                        // 2. 清理 OPFS 私有文件系统
                        if (navigator.storage && navigator.storage.getDirectory) {
                            try {
                                const root = await navigator.storage.getDirectory();
                                for await (const name of root.keys()) {
                                    await root.removeEntry(name, { recursive: true });
                                }
                            } catch (e) {}
                        }
                        // 3. 注销 Service Worker 强制重新激活
                        if ('serviceWorker' in navigator) {
                            const regs = await navigator.serviceWorker.getRegistrations();
                            for (let reg of regs) { await reg.unregister(); }
                        }
                        alert('已完成本地所有资源与缓存数据的清理！');
                        window.location.reload();
                    } catch (err) {
                        alert('清理过程遇到错误: ' + err.message);
                    }
                }
            };

            onMounted(() => {
                loadGames();
            });

            return {
                games,
                searchQuery,
                filteredGames,
                showAdmin,
                isEditing,
                editForm,
                isGameActive,
                activeGameTitle,
                playGame,
                openLocalUpload,
                exitToGallery,
                openAdmin,
                closeAdmin,
                openEdit,
                saveGame,
                removeGame,
                exportConfig,
                importConfig,
                clearAllCaches
            };
        }
    });

    app.mount('#gallery-root');
    window.KrKr2GalleryApp = app;
})();
