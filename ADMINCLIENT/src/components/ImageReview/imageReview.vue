<template>
    <div class="image">
        <ImageReviewPopup v-if="image" :image="image" :z-index="zIndex" />
        <span v-else class="no-image">{{ emptyText || $t('common.noData') }}</span>
    </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import ImageReviewPopup from './ImageReviewPopup/imageReviewPopup.vue';

export default defineComponent({
    name: 'ImageReview',
    components: {
        ImageReviewPopup,
    },
    props: {
        // 图片地址，为空时展示占位文案
        image: {
            type: String,
            default: '',
        },
        // 无图片时展示的占位文案
        emptyText: {
            type: String,
            default: '',
        },
        // 预览弹层层级，透传给 ImageReviewPopup
        zIndex: {
            type: Number,
            default: 10000,
        },
    },
});
</script>

<style lang="scss" scoped>
    @import url("./index.scss");
</style>
