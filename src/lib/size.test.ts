import { describe, expect, it } from 'vitest'
import { formatImageRatio } from './size'

describe('formatImageRatio', () => {
  it('shows exact short ratios without an approximation marker', () => {
    expect(formatImageRatio(960, 1200)).toBe('4:5')
    expect(formatImageRatio(800, 1600)).toBe('1:2')
    expect(formatImageRatio(2100, 900)).toBe('21:9')
  })
})
