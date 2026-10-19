'use client'

import { Listbox, type ListboxOption } from '@/components/Listbox'
import type { VariationRule, VariationValue } from '@/lib/variation/rules'

interface Props {
  rule: VariationRule
  /**
   * Whether this field's value is numeric.
   *
   * Random mode can only produce numbers (randomInRange returns number); applied to a
   * string field such as IPv4 / MAC it would insert a bare number and fail when
   * building. So non-numeric fields don't offer this option.
   */
  numeric: boolean
  onChange: (rule: VariationRule) => void
  onRemove: () => void
}

/** When switching modes, carry over the old rule's values where possible instead of resetting the user's input to 0. */
function seedValue(rule: VariationRule): VariationValue {
  if (rule.mode === 'enumerate') {
    return rule.values[0] ?? 0
  }
  if (rule.mode === 'random') {
    return rule.min
  }
  return rule.start
}

/** Convert text that looks numeric to a number; otherwise keep the string (MAC / IPv4 addresses). */
function coerce(text: string): VariationValue {
  const trimmed = text.trim()
  const n = Number(trimmed)
  return trimmed !== '' && !Number.isNaN(n) ? n : trimmed
}

export function VariationEditor({ rule, numeric, onChange, onRemove }: Props) {
  const modeOptions: ListboxOption[] = [
    { value: 'increment', label: '遞增' },
    { value: 'decrement', label: '遞減' },
    { value: 'enumerate', label: '列舉' },
    ...(numeric ? [{ value: 'random', label: '隨機' }] : []),
  ]

  return (
    <div
      className="ml-42 mt-1 flex flex-wrap items-center gap-2 rounded border border-warn/40
                 bg-warn/5 p-2 text-xs"
    >
      <Listbox
        options={modeOptions}
        value={rule.mode}
        onChange={(value) => {
          const mode = value as VariationRule['mode']
          const seed = seedValue(rule)
          if (mode === 'enumerate') {
            onChange({ target: rule.target, mode, values: [seed] })
          } else if (mode === 'random') {
            onChange({
              target: rule.target,
              mode,
              min: typeof seed === 'number' ? seed : 0,
              max: 65535,
              seed: 1,
            })
          } else {
            onChange({ target: rule.target, mode, start: seed, step: 1 })
          }
        }}
      />

      {(rule.mode === 'increment' || rule.mode === 'decrement') && (
        <>
          <label className="flex items-center gap-1">
            起始
            <input
              value={String(rule.start)}
              onChange={(e) => onChange({ ...rule, start: coerce(e.target.value) })}
              className="w-32 rounded border border-current/20 bg-transparent px-1 py-0.5 font-mono"
            />
          </label>
          {/* The step must be an explicit, editable field; this was an explicit requirement */}
          <label className="flex items-center gap-1">
            步進
            <input
              type="number"
              value={rule.step}
              onChange={(e) => onChange({ ...rule, step: Number(e.target.value) || 1 })}
              className="w-20 rounded border border-current/20 bg-transparent px-1 py-0.5"
            />
          </label>
        </>
      )}

      {rule.mode === 'enumerate' && (
        <label className="flex flex-1 items-center gap-1">
          值清單
          <input
            value={rule.values.join(',')}
            onChange={(e) =>
              onChange({ ...rule, values: e.target.value.split(',').map(coerce) })
            }
            className="flex-1 rounded border border-current/20 bg-transparent px-1 py-0.5 font-mono"
          />
        </label>
      )}

      {rule.mode === 'random' && (
        <>
          <label className="flex items-center gap-1">
            下界
            <input
              type="number"
              value={rule.min}
              onChange={(e) => onChange({ ...rule, min: Number(e.target.value) || 0 })}
              className="w-24 rounded border border-current/20 bg-transparent px-1 py-0.5"
            />
          </label>
          <label className="flex items-center gap-1">
            上界
            <input
              type="number"
              value={rule.max}
              onChange={(e) => onChange({ ...rule, max: Number(e.target.value) || 0 })}
              className="w-24 rounded border border-current/20 bg-transparent px-1 py-0.5"
            />
          </label>
          <label className="flex items-center gap-1">
            種子
            <input
              type="number"
              value={rule.seed}
              onChange={(e) => onChange({ ...rule, seed: Number(e.target.value) || 0 })}
              className="w-20 rounded border border-current/20 bg-transparent px-1 py-0.5"
            />
          </label>
        </>
      )}

      <button
        onClick={onRemove}
        className="ml-auto rounded px-2 py-0.5 opacity-60 hover:bg-current/10"
      >
        移除變化
      </button>
    </div>
  )
}
