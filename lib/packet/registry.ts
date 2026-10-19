import type { LayerSpec } from './model'

const registry = new Map<string, LayerSpec>()

export function registerLayer(spec: LayerSpec): void {
  if (registry.has(spec.id)) {
    throw new Error(`層 id 重複註冊：${spec.id}`)
  }
  registry.set(spec.id, spec)
}

/** Get the given layer; a missing one is a programming error, so it throws. */
export function getLayer(id: string): LayerSpec {
  const spec = registry.get(id)
  if (!spec) {
    throw new Error(`未註冊的層 id：${id}`)
  }
  return spec
}

/** Look up the given layer; returns undefined if missing. Used when decoding meets an unknown protocol. */
export function findLayer(id: string): LayerSpec | undefined {
  return registry.get(id)
}

export function listLayers(): LayerSpec[] {
  return Array.from(registry.values())
}

/** Clear the registry (for isolated setups, before registering layers again). */
export function resetRegistry(): void {
  registry.clear()
}
