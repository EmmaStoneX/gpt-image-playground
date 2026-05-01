import { useEffect, useState } from 'react'

/**
 * 把 dataURL 转成 blob URL，仅用于 <img src> 显示。
 *
 * 背景：部分移动浏览器（已知 Alook）在长按 <img src="data:..."> 元素时，
 * 浏览器原生会同步解码超长 base64 字符串以准备"保存图片"等操作，
 * 大图（>1MB）会直接卡死渲染进程。改用 blob URL 后浏览器只读短引用，
 * 不会触发同步解码。
 *
 * blob URL 加载完成前返回空字符串，调用方应自行 fallback 到原 dataURL
 * 以避免空白闪烁；非 data: 开头的 src（如 http/blob）原样跳过转换。
 */
export function useBlobUrlFromDataUrl(dataUrl: string): string {
  const [blobUrl, setBlobUrl] = useState('')
  useEffect(() => {
    if (!dataUrl || !dataUrl.startsWith('data:')) {
      setBlobUrl('')
      return
    }
    let cancelled = false
    let url = ''
    fetch(dataUrl)
      .then((r) => r.blob())
      .then((blob) => {
        if (cancelled) return
        url = URL.createObjectURL(blob)
        setBlobUrl(url)
      })
      .catch(() => {
        if (!cancelled) setBlobUrl('')
      })
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [dataUrl])
  return blobUrl
}
