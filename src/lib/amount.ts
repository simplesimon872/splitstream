import { parseUsdc } from '@/onchain-money'

export interface AmountInput {
  raw?: bigint
  error?: string
}

/** Parses a human USDC string (up to 6 decimals) into 6-decimal base units. Empty input is neither valid nor an error. */
export function parseAmountInput(value: string): AmountInput {
  const text = value.trim()
  if (text === '') return {}
  if (!/^\d*\.?\d*$/.test(text) || text === '.') return { error: 'Enter a number, for example 25 or 25.50.' }
  const fraction = text.split('.')[1]
  if (fraction && fraction.length > 6) return { error: 'USDC supports at most 6 decimal places.' }
  const normalized = (text.startsWith('.') ? `0${text}` : text).replace(/\.$/, '')
  try {
    const raw = parseUsdc(normalized)
    if (raw <= 0n) return { error: 'Amount must be greater than zero.' }
    return { raw }
  } catch {
    return { error: 'Enter a valid amount.' }
  }
}

/** Mirrors the contract: floor(amount * bps / 10000) for each recipient, remainder (dust) to the last one. */
export function previewPayouts(amount: bigint, sharesBps: number[]): bigint[] {
  if (sharesBps.length === 0) return []
  const payouts = sharesBps.map((bps) => (amount * BigInt(bps)) / 10_000n)
  const paid = payouts.slice(0, -1).reduce((sum, p) => sum + p, 0n)
  payouts[payouts.length - 1] = amount - paid
  return payouts
}
