import { manualOr } from '../fields'
import type { BuildCtx, BuildOutput, LayerDecodeResult, LayerSpec, TreeNode } from '../model'
import { ETHERTYPE_BY_LAYER, layerIdForEtherType } from '../protocol-numbers'

const HEADER_LENGTH = 4

export const vlanLayer: LayerSpec = {
  id: 'vlan',
  name: 'IEEE 802.1Q VLAN',
  shortName: 'VLAN',
  // Q-in-Q (802.1ad) stacks two or more layers, which is normal usage
  stackable: true,

  fields: [
    { name: 'pcp', label: 'Priority Code Point', kind: 'uint', bits: 3 },
    { name: 'dei', label: 'Drop Eligible Indicator', kind: 'bool' },
    { name: 'vid', label: 'VLAN ID', kind: 'uint', bits: 12 },
    { name: 'etherType', label: 'Type', kind: 'uint', bits: 16, auto: true },
  ],

  defaults: () => ({
    pcp: { mode: 'manual', value: 0 },
    dei: { mode: 'manual', value: false },
    vid: { mode: 'manual', value: 1 },
    etherType: { mode: 'auto' },
  }),

  build(fields, ctx: BuildCtx): BuildOutput {
    const pcp = manualOr<number>(fields.pcp, () => 0)
    const dei = manualOr<boolean>(fields.dei, () => false)
    const vid = manualOr<number>(fields.vid, () => 1)
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

    const tci = ((pcp & 0x07) << 13) | (dei ? 0x1000 : 0) | (vid & 0x0fff)

    const bytes = new Uint8Array(HEADER_LENGTH)
    bytes[0] = (tci >>> 8) & 0xff
    bytes[1] = tci & 0xff
    bytes[2] = (etherType >>> 8) & 0xff
    bytes[3] = etherType & 0xff

    return { bytes, values: { pcp, dei, vid, etherType } }
  },

  decode(bytes: Uint8Array, offset: number): LayerDecodeResult {
    if (bytes.length - offset < HEADER_LENGTH) {
      throw new Error(`VLAN 標籤需要 ${HEADER_LENGTH} bytes，只剩 ${bytes.length - offset}`)
    }
    const tci = (bytes[offset] << 8) | bytes[offset + 1]
    const etherType = (bytes[offset + 2] << 8) | bytes[offset + 3]
    return {
      values: {
        pcp: (tci >>> 13) & 0x07,
        dei: (tci & 0x1000) !== 0,
        vid: tci & 0x0fff,
        etherType,
      },
      consumed: HEADER_LENGTH,
      nextLayerId: layerIdForEtherType(etherType),
    }
  },

  describe(values): TreeNode {
    return {
      label: `IEEE 802.1Q VLAN, PRI: ${values.pcp}, DEI: ${values.dei ? 1 : 0}, ID: ${values.vid}`,
      children: [
        { label: `Priority Code Point: ${values.pcp}` },
        { label: `Drop Eligible Indicator: ${values.dei ? 1 : 0}` },
        { label: `VLAN ID: ${values.vid}` },
        { label: `Type: 0x${(values.etherType as number).toString(16).padStart(4, '0')}` },
      ],
    }
  },

  summary(values): string {
    return `VLAN ${values.vid}`
  },
}
