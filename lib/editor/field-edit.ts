import type { PacketDef } from '../emulator/packet-def'
import { formatIpv4, formatMac, parseIpv4, parseMac } from '../packet/format'
import type { FieldKind, FieldSpec, LayerInstance } from '../packet/model'

export type ParseResult = { ok: true; value: unknown } | { ok: false; message: string }

const fail = (message: string): ParseResult => ({ ok: false, message })

/**
 * Parse the text the user typed into a field value.
 *
 * "Cannot parse" and "invalid value" are different things: typing abc into a
 * numeric field is the former (it is not a value, so the old value is kept);
 * setting TTL to 999 is the latter (the user is deliberately building a test
 * packet, so it is accepted with only a warning).
 */
export function parseFieldValue(kind: FieldKind, text: string): ParseResult {
  const trimmed = text.trim()

  switch (kind) {
    case 'uint': {
      if (trimmed === '') {
        return fail('不可空白')
      }
      const isHex = /^0[xX][0-9a-fA-F]+$/.test(trimmed)
      if (!isHex && !/^\d+$/.test(trimmed)) {
        return fail('請輸入十進位數字，或 0x 開頭的十六進位')
      }
      return { ok: true, value: isHex ? parseInt(trimmed.slice(2), 16) : Number(trimmed) }
    }

    case 'bool':
      if (trimmed === 'true') {
        return { ok: true, value: true }
      }
      if (trimmed === 'false') {
        return { ok: true, value: false }
      }
      return fail('只接受 true 或 false')

    case 'mac':
      try {
        return { ok: true, value: formatMac(parseMac(trimmed)) }
      } catch (e) {
        return fail(e instanceof Error ? e.message : String(e))
      }

    case 'ipv4':
      try {
        return { ok: true, value: formatIpv4(parseIpv4(trimmed)) }
      } catch (e) {
        return fail(e instanceof Error ? e.message : String(e))
      }

    case 'bytes': {
      const compact = trimmed.replace(/\s+/g, '')
      if (compact === '') {
        return { ok: true, value: new Uint8Array(0) }
      }
      if (!/^[0-9a-fA-F]+$/.test(compact) || compact.length % 2 !== 0) {
        return fail('請輸入偶數個十六進位字元')
      }
      const out = new Uint8Array(compact.length / 2)
      for (let i = 0; i < out.length; i++) {
        out[i] = parseInt(compact.slice(i * 2, i * 2 + 2), 16)
      }
      return { ok: true, value: out }
    }

    case 'string':
      return { ok: true, value: text }

    case 'custom':
      return fail('這個欄位沒有文字編輯器')
  }
}

/** Turn a field value into the text shown in its input box. */
export function formatFieldValue(kind: FieldKind, value: unknown): string {
  if (kind === 'bytes') {
    return Array.from(value as Uint8Array)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  }
  if (kind === 'custom') {
    // structured content such as DHCP options gets a readable summary, not [object Object]
    if (Array.isArray(value)) {
      return `${value.length} 個項目`
    }
    return String(value)
  }
  return String(value)
}

/**
 * Warning text for a value that exceeds the field's declared bit width.
 *
 * It only warns and never blocks: deliberately out-of-range values are a
 * legitimate use of test packets.
 */
export function fieldWarning(spec: FieldSpec, value: unknown): string | null {
  if (spec.bits === undefined || typeof value !== 'number') {
    return null
  }
  const max = 2 ** spec.bits - 1
  if (value > max) {
    return `超出 ${spec.bits} 位元的範圍（最大 ${max}），寫入時會被截斷`
  }
  return null
}

function replaceLayerField(
  def: PacketDef,
  instanceId: string,
  fieldName: string,
  next: LayerInstance['fields'][string],
): PacketDef {
  const index = def.layers.findIndex((l) => l.instanceId === instanceId)
  if (index === -1) {
    throw new Error(`封包裡沒有這一層：${instanceId}`)
  }
  const layers = [...def.layers]
  layers[index] = {
    ...layers[index],
    fields: { ...layers[index].fields, [fieldName]: next },
  }
  return { ...def, layers }
}

export function setFieldManual(
  def: PacketDef,
  instanceId: string,
  fieldName: string,
  value: unknown,
): PacketDef {
  return replaceLayerField(def, instanceId, fieldName, { mode: 'manual', value })
}

export function setFieldAuto(def: PacketDef, instanceId: string, fieldName: string): PacketDef {
  return replaceLayerField(def, instanceId, fieldName, { mode: 'auto' })
}
