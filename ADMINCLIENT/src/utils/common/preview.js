/**
 * PDF 文件预览（支持直接传入Blob对象）
 * @param {Blob|Response} res - 可以是响应对象或Blob对象
 */
import * as utils from '@/utils/index'

export default function preview(res) {
  let blob
  let contentType
  let fileName

  // 判断传入的是响应对象还是Blob对象
  if (res instanceof Blob) {
    blob = res
    contentType = 'application/pdf'
    fileName = 'preview.pdf'
  } else {
    // 处理响应对象
    contentType = res?.headers['content-type'] ?? 'none'

    fileName = decodeURIComponent(
      res.headers['content-disposition']?.split('filename=')[1] ||
      'file.pdf'
    )

    blob = new Blob([res.data], {
      type: contentType,
    })
  }

  if (contentType.includes('application/pdf')) {
    const blobUrl = URL.createObjectURL(blob)

    // 打开预览
    window.open(blobUrl, '_blank')

    // 不要立刻销毁
    setTimeout(() => {
      URL.revokeObjectURL(blobUrl)
    }, 60 * 1000) // 1分钟后释放
  } else {
    utils.downFile(res, fileName)
  }
}