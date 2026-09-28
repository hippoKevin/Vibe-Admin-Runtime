<template>
    <div class="thumb">
        <t-popup placement="right" show-arrow destroy-on-close>
            <template #content>
                <t-image :src="image" :alt="$t('imageReview.productImage')" style="height: 100px;" />
            </template>
            <t-image-viewer :images="[image]" :z-index="zIndex">
                <template #trigger="{ open }">
                    <div class="thumb__ui-image">
                        <img
                            :src="image"
                            :alt="$t('imageReview.productImage')"
                            class="thumb__ui-image--img"
                        />
                        <div class="thumb__ui-image--hover" @click="open">
                            <BrowseIcon size="1em" />
                        </div>
                    </div>
                </template>
            </t-image-viewer>
        </t-popup>
    </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { BrowseIcon } from 'tdesign-icons-vue-next';

export default defineComponent({
    name: 'ImageReviewPopup',
    components: {
        BrowseIcon,
    },
    props: {
        // 图片地址
        image: {
            type: String,
            required: true,
        },
        // t-image-viewer 弹层层级
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
