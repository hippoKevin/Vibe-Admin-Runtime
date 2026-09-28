export function getPaperConfig(page: any) {

    const paperSize =
        page?.paperSize || 'A4'

    const orientation =
        page?.orientation || 'portrait'

    // 默认 A4
    let width = 794
    let height = 1123

    switch (paperSize) {

        // ========================================
        // A4
        // ========================================

        case 'A4':

            width = 794
            height = 1123
            break

        // ========================================
        // 一等分
        // ========================================

        case '一等分':

            width = 910
            height = 1052
            break

        // ========================================
        // 二等分
        // ========================================

        case '二等分':

            width = 910
            height = 526
            break

        // ========================================
        // 三等分
        // ========================================

        case '三等分':

            width = 910
            height = 351
            break

        // ========================================
        // 自定义
        // ========================================

        case 'custom':

            width =
                Number(page?.customWidth) * 3.7795 || 900

            height =
                Number(page?.customHeight) * 3.7795 || 320

            break
    }

    // ========================================
    // 横向
    // ========================================

    if (orientation === 'landscape') {

        return {
            width: height,
            height: width,
            unit: 'px',
        }
    }

    // ========================================
    // 纵向
    // ========================================

    return {
        width,
        height,
        unit: 'px',
    }
}