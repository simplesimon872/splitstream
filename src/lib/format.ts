import { BaseError, ContractFunctionRevertedError } from 'viem'
import { formatUsdc } from '@/onchain-money'
import { buildAddressExplorerUrl, buildTxExplorerUrl } from '@/onchain-facts'
import { CHAIN_ID } from '@/appConfig'

export const shortAddr = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`
export const shortHash = (hash: string) => `${hash.slice(0, 10)}…${hash.slice(-6)}`

/** Basis points to a percentage string: 6000 -> "60%", 1250 -> "12.5%". */
export function bpsToPercent(bps: number): string {
  const pct = bps / 100
  return `${Number.isInteger(pct) ? pct.toString() : pct.toFixed(2).replace(/0+$/, '')}%`
}

/** USDC base units (6 decimals) to a human string with at least two decimals, e.g. 1000003n -> "1.000003". */
export function usdc(raw: bigint): string {
  const [int, frac = ''] = formatUsdc(raw).split('.')
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${grouped}.${frac.padEnd(2, '0')}`
}

export const txUrl = (hash: string) => buildTxExplorerUrl(CHAIN_ID, hash)
export const addressUrl = (address: string) => buildAddressExplorerUrl(CHAIN_ID, address)

const REVERT_COPY: Record<string, string> = {
  ZeroAmount: 'Amount must be greater than zero.',
  NothingToClaim: 'You have nothing to withdraw.',
  SafeERC20FailedOperation: 'The USDC transfer was rejected. Check your balance and allowance, and that the address is not restricted.',
  ReentrancyGuardReentrantCall: 'The contract rejected a re-entrant call.',
}

export interface ParsedError {
  rejected: boolean
  message: string
}

/** Turns a wallet/viem error into one short, readable sentence. User rejection is flagged, not reported as a failure. */
export function parseError(error: unknown): ParsedError {
  const text = error instanceof Error ? `${error.name} ${error.message}`.toLowerCase() : String(error).toLowerCase()
  if (text.includes('user rejected') || text.includes('userrejected') || text.includes('user denied') || (error as { code?: number })?.code === 4001) {
    return { rejected: true, message: 'Request cancelled in your wallet.' }
  }
  if (error instanceof BaseError) {
    const revert = error.walk((e) => e instanceof ContractFunctionRevertedError)
    if (revert instanceof ContractFunctionRevertedError) {
      const name = revert.data?.errorName
      if (name && REVERT_COPY[name]) return { rejected: false, message: REVERT_COPY[name] }
      if (revert.reason) return { rejected: false, message: `Transaction would fail: ${revert.reason}` }
    }
    if (text.includes('insufficient funds')) return { rejected: false, message: 'Not enough USDC to pay for gas. Get test USDC and try again.' }
    if (text.includes('chain') && text.includes('mismatch')) return { rejected: false, message: 'Your wallet is on the wrong network. Switch networks and try again.' }
    return { rejected: false, message: error.shortMessage || 'The transaction failed.' }
  }
  if (text.includes('insufficient funds')) return { rejected: false, message: 'Not enough USDC to pay for gas.' }
  if (text.includes('network') || text.includes('timeout') || text.includes('fetch')) {
    return { rejected: false, message: 'Network issue. Check your connection and try again.' }
  }
  return { rejected: false, message: 'Something went wrong. Please try again.' }
}
