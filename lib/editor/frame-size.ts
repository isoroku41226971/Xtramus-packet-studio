export type FrameSizeResult = { ok: true; size: number } | { ok: false; message: string }

/**
 * Validate what was typed into the frame-size field.
 *
 * minimum is the header length. Anything smaller would make the payload length
 * negative; the underlying payloadSizeOf clamps it to 0, so the built packet
 * would not match what the user asked for. It is rejected here instead, before
 * the number reaches the packet definition.
 */
export function validateFrameSize(text: string, minimum: number): FrameSizeResult {
  const trimmed = text.trim()
  // reject blanks first: Number('   ') is 0, which would read as "typed 0" instead of "left empty"
  if (trimmed === '') {
    return { ok: false, message: '請輸入封包大小' }
  }

  const value = Number(trimmed)
  // Number.isInteger rejects NaN ('abc'), decimals and Infinity in one go
  if (!Number.isInteger(value)) {
    return { ok: false, message: '封包大小要是整數' }
  }

  if (value < minimum) {
    return { ok: false, message: `標頭就佔了 ${minimum} bytes，封包大小不能小於這個值` }
  }

  return { ok: true, size: value }
}
