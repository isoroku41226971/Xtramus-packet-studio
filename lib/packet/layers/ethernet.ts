import { manualOr } from '../fields'
import { formatMac, parseMac } from '../format'
import type { BuildCtx, BuildOutput, LayerDecodeResult, LayerSpec, TreeNode } from '../model'
import { ETHERTYPE_BY_LAYER, layerIdForEtherType } from '../protocol-numbers'

const HEADER_LENGTH = 14

export const ethernetLayer: LayerSpec = {
  id: 'ethernet',
  name: 'Ethernet II',
  shortName: 'Ethernet',
  stackable: false,

  fields: [
    { name: 'dst', label: 'Destination', kind: 'mac' },
    { name: 'src', label: 'Source', kind: 'mac' },
    { name: 'etherType', label: 'Type', kind: 'uint', bits: 16, auto: true },
  ],

  defaults: () => ({
    dst: { mode: 'manual', value: 'ff:ff:ff:ff:ff:ff' },
    src: { mode: 'manual', value: '00:11:22:33:44:55' },
    etherType: { mode: 'auto' },
  }),

  build(fields, ctx: BuildCtx): BuildOutput {
    const dst = manualOr<string>(fields.dst, () => 'ff:ff:ff:ff:ff:ff')
    const src = manualOr<string>(fields.src, () => '00:11:22:33:44:55')
    const etherType = manualOr<number>(fields.etherType, () => {
      const innerLayerId = ctx.layers[ctx.index + 1]?.layerId
      const auto = innerLayerId ? ETHERTYPE_BY_LAYER[innerLayerId] : undefined
      if (auto === undefined) {
        throw new Error(
          `無法自動決定 etherType：內層是 ${innerLayerId ?? '（沒有內層）'}，請手動指定`,
        )
      }
      return auto
    })

    const bytes = new Uint8Array(HEADER_LENGTH)
    bytes.set(parseMac(dst), 0)
    bytes.set(parseMac(src), 6)
    bytes[12] = (etherType >>> 8) & 0xff
    bytes[13] = etherType & 0xff

    return { bytes, values: { dst, src, etherType } }
  },

  decode(bytes: Uint8Array, offset: number): LayerDecodeResult {
    if (bytes.length - offset < HEADER_LENGTH) {
      throw new Error(`Ethernet 標頭需要 ${HEADER_LENGTH} bytes，只剩 ${bytes.length - offset}`)
    }
    const etherType = (bytes[offset + 12] << 8) | bytes[offset + 13]
    return {
      values: {
        dst: formatMac(bytes, offset),
        src: formatMac(bytes, offset + 6),
        etherType,
      },
      consumed: HEADER_LENGTH,
      nextLayerId: layerIdForEtherType(etherType),
    }
  },

  describe(values): TreeNode {
    return {
      label: `Ethernet II, Src: ${values.src}, Dst: ${values.dst}`,
      children: [
        { label: `Destination: ${values.dst}` },
        { label: `Source: ${values.src}` },
        { label: `Type: 0x${(values.etherType as number).toString(16).padStart(4, '0')}` },
      ],
    }
  },

  summary(values): string {
    return `${values.src} → ${values.dst}`
  },
}
