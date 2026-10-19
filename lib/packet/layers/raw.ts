import { manualOr } from '../fields'
import type { BuildOutput, LayerDecodeResult, LayerSpec, TreeNode } from '../model'

/**
 * A run of unstructured bytes.
 *
 * Lets users insert arbitrary content by hand: for a protocol not yet supported,
 * or deliberately malformed data, add a Raw layer and type the hex directly.
 */
export const rawLayer: LayerSpec = {
  id: 'raw',
  name: 'Data',
  shortName: 'Data',
  stackable: false,

  fields: [{ name: 'data', label: 'Data', kind: 'bytes' }],

  defaults: () => ({
    data: { mode: 'manual', value: new Uint8Array(0) },
  }),

  build(fields): BuildOutput {
    const data = manualOr<Uint8Array>(fields.data, () => new Uint8Array(0))
    return { bytes: data, values: { data } }
  },

  decode(bytes: Uint8Array, offset: number): LayerDecodeResult {
    const data = bytes.slice(offset)
    return {
      values: { data },
      consumed: data.length,
      nextLayerId: null,
    }
  },

  describe(values): TreeNode {
    const data = values.data as Uint8Array
    return { label: `Data (${data.length} bytes)` }
  },

  summary(values): string {
    return `${(values.data as Uint8Array).length} bytes`
  },
}
