<template>
    <t-head-menu theme="light">
        <template #logo>
            <div style="display: flex;align-items: center;margin:0px 14px;">
                <img width="36" class="logo" :src="isThemeModeDark === 'dark' ? LogoWhite : Logo" />
                <span style="font-size: 22px;font-weight: bold;margin-left: 10px;">汇创 ADMIN</span>
            </div>
        </template>
        <t-space size="small" align="center">
            <t-button variant="text" shape="square" @click="goHomePage">
                <template #icon>
                    <HomeIcon />
                </template>
            </t-button>
            <div class="menu-search-wrapper" >
                <t-input v-model="menuSearchText" style="width: 195px;" :placeholder="$t('header.searchPlaceholder')" clearable
                    @focus="menuSearchPanelVisible = true" @input="menuSearchPanelVisible = true"
                    @blur="handleSearchBlur">
                    <template #prefix-icon><search-icon /></template>
                </t-input>

                <div v-if="menuSearchPanelVisible && (menuSearchText || recentSearches.length)"
                    class="menu-search-panel">
                    <!-- 有关键字：分类 + 详情两栏 -->
                    <div v-if="menuSearchText && groupedResults.length" class="menu-search-results">
                        <div class="menu-search-categories">
                            <div v-for="(group, idx) in groupedResults" :key="group.catalog"
                                class="menu-search-category-item" :class="{ active: idx === activeCatalogIndex }"
                                @mousedown.prevent="activeCatalogIndex = idx">
                                <span class="menu-search-category-name">{{ group.catalog }}</span>
                                <span class="menu-search-category-count">{{ group.items.length }}</span>
                            </div>
                        </div>
                        <div class="menu-search-detail">
                            <div v-for="item in activeGroupItems" :key="item.menu_id" class="menu-search-detail-item"
                                @mousedown.prevent="handleMenuResultClick(item)">
                                <div class="menu-search-item-name"
                                    v-html="highlightMatch(translateServerText(item.menu_name), menuSearchText)">
                                </div>
                                <div class="menu-search-item-catalog">{{ item.catalog ? translateServerText(item.catalog) : $t('header.topMenu') }}</div>
                            </div>
                        </div>
                    </div>

                    <!-- 有关键字但没搜到 -->
                    <div v-else-if="menuSearchText" class="menu-search-empty">{{ $t('header.noResult') }}</div>

                    <!-- 无关键字：最近搜索 -->
                    <div v-else class="menu-search-recent">
                        <div class="menu-search-recent-title">{{ $t('header.recentSearch') }}</div>
                        <div v-for="item in recentSearches" :key="item.menu_id" class="menu-search-recent-item"
                            @mousedown.prevent="handleMenuResultClick(item)">
                            <div class="menu-search-item-name">{{ translateServerText(item.menu_name) }}</div>
                            <div class="menu-search-item-catalog">{{ item.catalog ? translateServerText(item.catalog) : $t('header.topMenu') }}</div>
                            <t-icon name="close" class="menu-search-recent-remove"
                                @mousedown.stop.prevent="removeRecentSearch(item.menu_id)" />
                        </div>
                    </div>
                </div>
            </div>
        </t-space>
        <template #operations>
            <t-space align="center" size="small">
                <!-- 主题配置（主题色 + 暗黑模式） -->
                <theme-switcher />

                <!-- 多国语言 -->
                <language-switcher />

                <!-- 设置按钮 -->
                <t-tooltip :content="$t('header.systemDetail')">
                    <t-button variant="text" shape="square" @click="handleSystemSetting">
                        <template #icon>
                            <SettingIcon size="20px" />
                        </template>
                    </t-button>
                </t-tooltip>

                <!-- 全屏按钮 -->
                <t-tooltip :content="$t('header.fullscreen')">
                    <t-button variant="text" shape="square" @click="handleFullScreen">
                        <template #icon>
                            <Fullscreen1Icon size="20px" />
                        </template>
                    </t-button>
                </t-tooltip>

                <t-dropdown trigger="click" :options="options" placement="bottom">
                    <t-space>
                        <t-button variant="text">
                            <template #icon>
                                <div>
                                    <UserCircleIcon style="vertical-align: -2px;margin-right: 8px;" />
                                    <span>{{ userInfo?.username ?? '' }}</span>
                                </div>
                            </template>
                            <template #suffix>
                                <ChevronDownIcon />
                            </template>
                        </t-button>
                    </t-space>
                </t-dropdown>
            </t-space>
        </template>

    </t-head-menu>

    <ChangePasswordPage v-model:visible="changePasswordPageVisible" />
    <PersonCenterPage v-model:visible="personCenterPageVisible" />
    <SystemSetting v-model:visible="systemSettingVisible" />
</template>

<script lang="ts">
export default { name: 'LayoutHeader' }
</script>

<script lang="ts" setup>
import {
    UserCircleIcon, PoweroffIcon, SearchIcon,
    ChevronDownIcon, UserPasswordIcon, HomeIcon, SettingIcon, Fullscreen1Icon, BookIcon, 
} from 'tdesign-icons-vue-next'
import Logo from '@/assets/images/logo.png'
import LogoWhite from '@/assets/images/white_logo.png'
import router from '@/router/index'
import { onMounted, ref, watch, computed } from 'vue'
import { h } from 'vue'

import { MessagePlugin } from 'tdesign-vue-next'
import { useUserStore } from '@/stores/userStore'
import { useMenuStore } from '@/stores/menuStore'
import { useI18n } from 'vue-i18n'
import { translateServerText } from '@/locales'
import { themeMode } from '@/utils/theme'

import ChangePasswordPage from './ChangePassword.vue'
import PersonCenterPage from './PersonCenter.vue'
import SystemSetting from '@/components/SystemSetting/index.vue'

const userStore = useUserStore()
const menuStore = useMenuStore()
const { t } = useI18n()

const userInfo = ref<any>()
const changePasswordPageVisible = ref(false)
const personCenterPageVisible = ref(false)

const isThemeModeDark = themeMode

// 系统设置
const systemSettingVisible = ref(false)

const options = computed(() => [
    {
        content: t('header.personCenter'),
        value: 1,
        prefixIcon: () => h(UserCircleIcon),
        onClick: () => { personCenterPageVisible.value = true },
    },
    {
        content: t('header.changePassword'),
        value: 2,
        prefixIcon: () => h(UserPasswordIcon),
        onClick: () => { changePasswordPageVisible.value = true },
    },
    {
        content: t('header.logout'),
        value: 3,
        prefixIcon: () => h(PoweroffIcon),
        onClick: () => {
            userStore.clearUserInfo()
            menuStore.logout()
            MessagePlugin.success(t('header.logoutSuccess'))
        },
    },
])

/** 跳转主页 */
const goHomePage = () => { router.push('ETPHomePage') }

onMounted(() => {
    userInfo.value = JSON.parse(localStorage.getItem('userInfo') || '{}')
})

/**
 * 系统设置
 */
const handleSystemSetting = () => {
    systemSettingVisible.value = true
}

/** 全屏 */
const handleFullScreen = () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen()
    } else {
        document.exitFullscreen?.()
    }
}

/**
 * 搜索菜单相关内容
 */
const menuSearchText = ref('')
const menuSearchPanelVisible = ref(false)
const activeCatalogIndex = ref(0)

/**
 * 递归拍平菜单树：只保留"非目录"的可跳转菜单项，
 * 并记录它所属的目录名称路径（用于展示）和父级 id 路径（用于点击后展开侧边栏对应目录）
 */
function flattenMenus(list: any[], parentNames: string[] = [], parentIds: number[] = []): any[] {
    let result: any[] = []
    for (const item of list) {
        if (item.children && item.children.length) {
            result = result.concat(
                flattenMenus(item.children, [...parentNames, item.menu_name], [...parentIds, item.menu_id])
            )
        } else if (item.is_show) {
            result.push({
                menu_id: item.menu_id,
                menu_name: item.menu_name,
                component_name: item.component_name,
                catalog: parentNames.join(' / '),
                parentIds,
            })
        }
    }
    return result
}

const flatMenuList = computed(() => {
    return flattenMenus(userStore.userInfo?.data?.menu_list || [])
})

const filteredMenuResults = computed(() => {
    const keyword = menuSearchText.value.trim().toLowerCase()
    if (!keyword) return []
    return flatMenuList.value.filter(item => item.menu_name?.toLowerCase().includes(keyword))
})

// 按目录分组，用于左侧分类栏展示
const groupedResults = computed(() => {
    const groups: Record<string, any[]> = {}
    filteredMenuResults.value.forEach(item => {
        const key = item.catalog || '顶级菜单'
        if (!groups[key]) groups[key] = []
        groups[key].push(item)
    })
    return Object.entries(groups).map(([catalog, items]) => ({ catalog, items }))
})

// 搜索结果变化时，重置选中的分类为第一个
watch(groupedResults, () => { activeCatalogIndex.value = 0 })

const activeGroupItems = computed(() => groupedResults.value[activeCatalogIndex.value]?.items || [])

// ── 关键字高亮 ──────────────────────────────────────────────
function escapeHtml(str: string) {
    return str.replace(/[&<>"']/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s] as string))
}

function highlightMatch(text: string, keyword: string) {
    if (!keyword) return escapeHtml(text)
    const idx = text.toLowerCase().indexOf(keyword.toLowerCase())
    if (idx === -1) return escapeHtml(text)
    const before = escapeHtml(text.slice(0, idx))
    const match = escapeHtml(text.slice(idx, idx + keyword.length))
    const after = escapeHtml(text.slice(idx + keyword.length))
    return `${before}<span class="menu-search-highlight">${match}</span>${after}`
}

// ── 最近搜索（本地持久化） ──────────────────────────────────
const RECENT_SEARCH_KEY = 'menu_recent_searches'

function loadRecentSearches() {
    try {
        return JSON.parse(localStorage.getItem(RECENT_SEARCH_KEY) || '[]')
    } catch {
        return []
    }
}

const recentSearches = ref<any[]>(loadRecentSearches())

function saveRecentSearches() {
    localStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(recentSearches.value))
}

function addRecentSearch(item: any) {
    const entry = {
        menu_id: item.menu_id,
        menu_name: item.menu_name,
        catalog: item.catalog,
        component_name: item.component_name,
        parentIds: item.parentIds || [],
    }
    recentSearches.value = [entry, ...recentSearches.value.filter(r => r.menu_id !== item.menu_id)].slice(0, 8)
    saveRecentSearches()
}

function removeRecentSearch(menu_id: number) {
    recentSearches.value = recentSearches.value.filter(r => r.menu_id !== menu_id)
    saveRecentSearches()
}

function handleSearchBlur() {
    // 延迟关闭面板，留出时间让 mousedown.prevent 里的点击逻辑先执行
    setTimeout(() => { menuSearchPanelVisible.value = false }, 150)
}

function handleMenuResultClick(item: any) {
    addRecentSearch(item)

    menuStore.menuRouterInfo.expanded = [
        ...new Set([...(menuStore.menuRouterInfo.expanded || []), ...(item.parentIds || [])])   // 加了 || []
    ]
    menuStore.menuRouterInfo.activeRouter = item.menu_id

    router.push({
        path: `/${item.component_name}`,
        query: { menu_id: item.menu_id }
    })

    menuSearchText.value = ''
    menuSearchPanelVisible.value = false
}
</script>

<style lang="scss" scoped>
.notice-drawer {
    display: flex;
    flex-direction: column;
    height: 100%;

    .notice-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 0 12px;
        border-bottom: 1px solid var(--td-component-stroke);
        margin-bottom: 12px;

        .notice-count {
            font-size: 13px;
            color: var(--td-text-color-secondary);
        }
    }

    .notice-list {
        flex: 1;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .notice-item {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 12px 10px;
        border-radius: var(--td-radius-default);
        cursor: pointer;
        transition: background 0.15s;

        &:hover {
            background: var(--td-bg-color-secondarycontainer);
        }

        &--important {
            background: var(--td-warning-color-1);

            &:hover {
                background: var(--td-warning-color-2);
            }
        }

        .notice-item-left {
            padding-top: 2px;
            flex-shrink: 0;
        }

        .notice-item-right {
            flex: 1;
            min-width: 0;

            .notice-item-title {
                font-size: 13px;
                font-weight: 500;
                color: var(--td-text-color-primary);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                margin-bottom: 4px;
            }

            .notice-item-time {
                font-size: 11px;
                color: var(--td-text-color-placeholder);
            }
        }
    }

    .notice-empty {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 12px;
        color: var(--td-text-color-placeholder);
        font-size: 13px;
    }
}

.menu-search-wrapper {
    position: relative;
}

.menu-search-panel {
    position: absolute;
    top: 100%;
    left: 0;
    margin-top: 6px;
    width: 460px;
    background: var(--td-bg-color-container);
    border: 1px solid var(--td-component-stroke);
    border-radius: var(--td-radius-medium);
    box-shadow: var(--td-shadow-2);
    z-index: 2000;
    overflow: hidden;
}

.menu-search-results {
    display: flex;
    max-height: 340px;
}

.menu-search-categories {
    width: 160px;
    flex-shrink: 0;
    background: var(--td-bg-color-secondarycontainer);
    overflow-y: auto;
    padding: 6px 0;

    .menu-search-category-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 12px;
        font-size: 13px;
        color: var(--td-text-color-secondary);
        cursor: pointer;

        &.active {
            background: var(--td-bg-color-container);
            color: var(--td-text-color-primary);
            font-weight: 600;
        }

        .menu-search-category-count {
            font-size: 12px;
            color: var(--td-text-color-placeholder);
        }
    }
}

.menu-search-detail {
    flex: 1;
    overflow-y: auto;
    padding: 8px;

    .menu-search-detail-item {
        padding: 10px 12px;
        border-radius: var(--td-radius-default);
        cursor: pointer;

        &:hover {
            background: var(--td-bg-color-secondarycontainer);
        }
    }
}

.menu-search-item-name {
    font-size: 14px;
    font-weight: 600;
    color: var(--td-text-color-primary);
}

.menu-search-item-catalog {
    font-size: 12px;
    color: var(--td-text-color-placeholder);
    margin-top: 2px;
}

.menu-search-highlight {
    color: var(--td-brand-color);
    font-weight: 700;
}

.menu-search-empty {
    padding: 16px;
    text-align: center;
    font-size: 13px;
    color: var(--td-text-color-placeholder);
}

.menu-search-recent {
    padding: 10px 8px;
    max-height: 340px;
    overflow-y: auto;

    .menu-search-recent-title {
        font-size: 12px;
        color: var(--td-text-color-placeholder);
        padding: 4px 8px 8px;
    }

    .menu-search-recent-item {
        position: relative;
        display: flex;
        flex-direction: column;
        padding: 8px 32px 8px 12px;
        border-radius: var(--td-radius-default);
        cursor: pointer;

        &:hover {
            background: var(--td-bg-color-secondarycontainer);

            .menu-search-recent-remove {
                visibility: visible;
            }
        }
    }

    .menu-search-recent-remove {
        position: absolute;
        right: 10px;
        top: 50%;
        transform: translateY(-50%);
        visibility: hidden;
        color: var(--td-text-color-placeholder);
        cursor: pointer;

        &:hover {
            color: var(--td-text-color-primary);
        }
    }
}
</style>
