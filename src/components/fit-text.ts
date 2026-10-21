/**
 * Font size that fits `text` on one line in `width` px. Money must never be truncated, and
 * adjustsFontSizeToFit is not supported on web, so we estimate from the length instead.
 * 0.62em is a safe average glyph width for bold tabular digits; below `min` the text wraps instead.
 */
export function fitFontSize(text: string, width: number, max: number, min = 12): number {
  return Math.max(min, Math.min(max, Math.floor(width / (text.length * 0.62))));
}
