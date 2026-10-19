/** A field's two states: computed automatically, or set manually by the user. */
export type FieldValue =
  | { mode: 'auto' }
  | { mode: 'manual'; value: unknown }

export type FieldKind =
  | 'uint'
  | 'bool'
  | 'mac'
  | 'ipv4'
  | 'bytes'
  /** 純文字（DHCP 的 sname / file）。 */
  | 'string'
  /** 需要專屬編輯器的結構化欄位（DHCP 的 options 清單）。 */
  | 'custom'

export interface FieldSpec {
  /** The field's name in code, matching the key in the values object. */
  name: string
  /** The name shown in the UI. */
  label: string
  kind: FieldKind
  /** Bit width when kind is 'uint'. */
  bits?: number
  /** Whether this field supports automatic computation (lengths, checksums, protocol numbers, ...). */
  auto?: boolean
}

/** One layer the user placed in a packet definition. */
export interface LayerInstance {
  /** This layer instance's own id, used by variation rules to target fields. */
  instanceId: string
  /** The matching LayerSpec.id in the registry. */
  layerId: string
  fields: Record<string, FieldValue>
}

/** The context available when building a single layer. */
export interface BuildCtx {
  /** The whole packet's layer list, outermost first. */
  layers: LayerInstance[]
  /** This layer's index in layers. */
  index: number
  /** The already-built inner bytes (excluding this layer). */
  inner: Uint8Array
}

export interface BuildOutput {
  bytes: Uint8Array
  /** The resolved field values, used by describe / summary. */
  values: Record<string, unknown>
}

export interface LayerDecodeResult {
  values: Record<string, unknown>
  /** How many bytes this layer occupies. */
  consumed: number
  /** The next layer's layerId; null means payload follows. */
  nextLayerId: string | null
}

export interface TreeNode {
  label: string
  children?: TreeNode[]
}

export interface LayerSpec {
  id: string
  /** The full name used in the decode tree, e.g. 'Internet Protocol Version 4'. */
  name: string
  /** The short name used in narrow places such as tables, e.g. 'IPv4'. */
  shortName: string
  /** Whether layers of this type may repeat (true for VLAN). */
  stackable: boolean
  fields: FieldSpec[]
  defaults(): Record<string, FieldValue>
  build(fields: Record<string, FieldValue>, ctx: BuildCtx): BuildOutput
  decode(bytes: Uint8Array, offset: number): LayerDecodeResult
  describe(values: Record<string, unknown>): TreeNode
  summary(values: Record<string, unknown>): string
}
