'use client'

import { useState } from 'react'
import { VariationEditor } from '@/components/builder/VariationEditor'
import {
  fieldWarning,
  formatFieldValue,
  parseFieldValue,
  setFieldAuto,
  setFieldManual,
} from '@/lib/editor/field-edit'
import {
  addVariation,
  defaultVariationFor,
  findVariationFor,
  removeVariation,
  updateVariation,
} from '@/lib/editor/variation-edit'
import type { PacketDef } from '@/lib/emulator/packet-def'
import type { FieldSpec, LayerInstance } from '@/lib/packet/model'
import { getLayer } from '@/lib/packet/registry'
import type { VariationRule } from '@/lib/variation/rules'

interface RowProps {
  layer: LayerInstance
  spec: FieldSpec
  /** The value actually written into the packet for this field (computed when auto). */
  resolved: unknown
  onManual: (value: unknown) => void
  onAuto: () => void
  variation: { rule: VariationRule; index: number } | undefined
  /** null means this field's type does not support variation, and the button is not shown. */
  defaultRule: VariationRule | null
  onAddVariation: (rule: VariationRule) => void
  onChangeVariation: (rule: VariationRule) => void
  onRemoveVariation: () => void
}

function FieldRow({
  layer,
  spec,
  resolved,
  onManual,
  onAuto,
  variation,
  defaultRule,
  onAddVariation,
  onChangeVariation,
  onRemoveVariation,
}: RowProps) {
  const field = layer.fields[spec.name]
  const isAuto = !field || field.mode === 'auto'

  /**
   * null means the user has not touched this input yet.
   *
   * Until then it shows the computed value: automatic fields are recomputed when
   * something else changes (changing TTL changes the checksum), and that must show
   * immediately.
   *
   * Once touched, the user's text wins and is no longer overwritten from outside: a
   * half-typed "0x2" parses as 2, and writing that back would turn the input into
   * "2", so the user could never finish typing a hex number.
   */
  const [typed, setTyped] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const shown = typed ?? formatFieldValue(spec.kind, resolved)
  const warning = isAuto ? null : fieldWarning(spec, resolved)

  return (
    <div className="border-b border-current/5 py-2">
      <div className="flex items-center gap-2">
        <label className="w-40 shrink-0 text-sm opacity-70">{spec.label}</label>

        <input
          value={shown}
          disabled={spec.kind === 'custom'}
          onChange={(e) => {
            const next = e.target.value
            setTyped(next)
            const parsed = parseFieldValue(spec.kind, next)
            if (parsed.ok) {
              setError(null)
              onManual(parsed.value)
            } else {
              // keep the user's half-typed text and just show the error
              setError(parsed.message)
            }
          }}
          className={`flex-1 rounded border bg-transparent px-2 py-1 font-mono text-sm outline-none
            ${error ? 'border-danger/70' : 'border-current/20 focus:border-current/40'}`}
        />

        {isAuto ? (
          <span className="w-24 shrink-0 text-xs opacity-50">自動</span>
        ) : spec.auto ? (
          <button
            onClick={() => {
              // hand control back: clear the local text so the input shows the computed value again
              setTyped(null)
              setError(null)
              onAuto()
            }}
            className="w-24 shrink-0 rounded px-2 py-1 text-xs opacity-60 hover:bg-current/10"
          >
            還原自動
          </button>
        ) : (
          <span className="w-24 shrink-0" />
        )}

        {/* No button for fields that cannot vary: boolean flags and bytes have no place in
            VariationValue, and a button that does nothing would just look broken */}
        {defaultRule && (
          <button
            onClick={() => onAddVariation(defaultRule)}
            disabled={!!variation}
            className={`shrink-0 rounded border px-2 py-0.5 text-xs transition ${
              variation
                ? 'border-warn bg-warn/20 text-warn'
                : 'border-dashed border-warn/60 text-warn/80 hover:bg-warn/10'
            }`}
          >
            變化
          </button>
        )}
      </div>

      {error && <p className="ml-42 pl-2 text-xs text-danger">{error}</p>}
      {warning && <p className="ml-42 pl-2 text-xs text-warn">{warning}</p>}

      {variation && (
        <VariationEditor
          rule={variation.rule}
          numeric={typeof resolved === 'number'}
          onChange={onChangeVariation}
          onRemove={onRemoveVariation}
        />
      )}
    </div>
  )
}

interface Props {
  def: PacketDef
  layerIndex: number
  /** The field values actually written for this layer, passed in by the caller from the build result. */
  resolvedValues: Record<string, unknown>
  onChange: (def: PacketDef) => void
}

export function FieldForm({ def, layerIndex, resolvedValues, onChange }: Props) {
  const layer = def.layers[layerIndex]
  if (!layer) {
    return <div className="text-sm opacity-50">沒有選取任何層</div>
  }
  const spec = getLayer(layer.layerId)

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="mb-1 text-xs opacity-60">{spec.name} 欄位</div>
      {spec.fields.map((f) => {
        const target = { instanceId: layer.instanceId, fieldName: f.name }
        const found = findVariationFor(def, target)
        return (
          <FieldRow
            /* Remount when the layer changes so local input text resets.
               Keying on f.name alone would make ethernet's and ipv4's src fields share state. */
            key={`${layer.instanceId}-${f.name}`}
            layer={layer}
            spec={f}
            resolved={resolvedValues[f.name]}
            onManual={(value) => onChange(setFieldManual(def, layer.instanceId, f.name, value))}
            onAuto={() => onChange(setFieldAuto(def, layer.instanceId, f.name))}
            variation={found}
            defaultRule={defaultVariationFor(target, resolvedValues[f.name])}
            onAddVariation={(rule) => onChange(addVariation(def, rule))}
            onChangeVariation={(rule) =>
              onChange(found ? updateVariation(def, found.index, rule) : addVariation(def, rule))
            }
            onRemoveVariation={() => {
              if (found) {
                onChange(removeVariation(def, found.index))
              }
            }}
          />
        )
      })}
    </div>
  )
}
