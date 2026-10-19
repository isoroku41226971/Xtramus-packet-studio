import { internetChecksum, ipv4PseudoHeader } from './checksum'
import { parseIpv4 } from './format'
import type { BuildCtx } from './model'

/** Search outward from this layer for the nearest IPv4 layer and take its source/destination addresses. */
function findOuterIpv4Addresses(ctx: BuildCtx): { src: string; dst: string } | undefined {
  for (let i = ctx.index - 1; i >= 0; i--) {
    if (ctx.layers[i].layerId !== 'ipv4') {
      continue
    }
    const { src, dst } = ctx.layers[i].fields
    if (src?.mode === 'manual' && dst?.mode === 'manual') {
      return { src: src.value as string, dst: dst.value as string }
    }
    return undefined
  }
  return undefined
}

/**
 * Checksum shared by UDP and TCP: pseudo-header + transport header + payload.
 *
 * The checksum field in headerBytes must already be zeroed, or the result is wrong.
 * transportLength is the length of the transport header plus the payload.
 */
export function computeTransportChecksum(
  ctx: BuildCtx,
  protocol: number,
  headerBytes: Uint8Array,
  transportLength: number,
): number {
  const addresses = findOuterIpv4Addresses(ctx)
  if (!addresses) {
    throw new Error(
      '無法計算傳輸層 checksum：找不到外層 IPv4 的來源/目的位址，請手動指定 checksum',
    )
  }
  const pseudo = ipv4PseudoHeader(
    parseIpv4(addresses.src),
    parseIpv4(addresses.dst),
    protocol,
    transportLength,
  )
  const all = new Uint8Array(pseudo.length + headerBytes.length + ctx.inner.length)
  all.set(pseudo, 0)
  all.set(headerBytes, pseudo.length)
  all.set(ctx.inner, pseudo.length + headerBytes.length)
  return internetChecksum(all)
}
