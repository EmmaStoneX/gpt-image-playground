import type { ImageComment } from '../types'

export function appendImageComments(prompt: string, comments: ImageComment[] | undefined): string {
  const notes = comments?.filter((comment) => comment.text.trim()) ?? []
  if (!notes.length) return prompt
  return `${prompt}\n\n图1的标注说明：\n${notes.map((comment, index) =>
    `${index + 1}. 位置（横向 ${Math.round(comment.x * 100)}%，纵向 ${Math.round(comment.y * 100)}%）：${comment.text.trim()}`,
  ).join('\n')}`
}
