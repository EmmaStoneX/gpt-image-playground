import { forwardRef, type ImgHTMLAttributes } from 'react'
import { useBlobUrlFromDataUrl } from '../hooks/useBlobUrlFromDataUrl'

/**
 * 包装 <img>，把 dataURL src 转成 blob URL 显示。
 *
 * 用途：解决移动浏览器（已知 Alook）长按 <img src="data:..."> 时同步
 * 解码大 base64 字符串导致渲染进程卡死的问题。
 *
 * API 与原生 <img> 一致；非 dataURL 的 src（http / blob）原样透传。
 * dataURL 转换是异步的，加载完成前先用原 src 显示以避免空白闪烁。
 */
export const MobileSafeImage = forwardRef<HTMLImageElement, ImgHTMLAttributes<HTMLImageElement>>(
  function MobileSafeImage({ src = '', ...rest }, ref) {
    const blobUrl = useBlobUrlFromDataUrl(src)
    return <img ref={ref} src={blobUrl || src} {...rest} />
  },
)
