import { useMemo } from 'react'
import { erc20Abi, type Address } from 'viem'
import { useReadContract, useReadContracts } from 'wagmi'
import { CHAIN_ID, SPLITSTREAM_ADDRESS, USDC_ADDRESS } from '@/appConfig'
import { splitStreamAbi, usdcBlocklistAbi } from '@/lib/abi'

export interface RecipientRow {
  address: Address
  shareBps: number
  claimable: bigint | undefined
  /** true when the USDC contract reports this address as blocklisted */
  blocked: boolean | undefined
}

/** Reads the recipient list live from the contract (never hardcoded), plus each recipient's claimable and blocklist status. */
export function useRecipientRows() {
  const recipientsQuery = useReadContract({
    address: SPLITSTREAM_ADDRESS,
    abi: splitStreamAbi,
    functionName: 'getRecipients',
    chainId: CHAIN_ID,
    query: { refetchInterval: 15_000 },
  })

  const addresses = useMemo(() => (recipientsQuery.data ? [...recipientsQuery.data[0]] : []), [recipientsQuery.data])
  const shares = recipientsQuery.data?.[1]

  const details = useReadContracts({
    allowFailure: true,
    contracts: addresses.flatMap((a) => [
      { address: SPLITSTREAM_ADDRESS, abi: splitStreamAbi, functionName: 'claimable', args: [a], chainId: CHAIN_ID } as const,
      { address: USDC_ADDRESS, abi: usdcBlocklistAbi, functionName: 'isBlacklisted', args: [a], chainId: CHAIN_ID } as const,
    ]),
    query: { enabled: addresses.length > 0, refetchInterval: 15_000 },
  })

  const rows: RecipientRow[] = addresses.map((address, i) => {
    const claimed = details.data?.[i * 2]
    const blocked = details.data?.[i * 2 + 1]
    return {
      address,
      shareBps: Number(shares?.[i] ?? 0),
      claimable: claimed?.status === 'success' ? (claimed.result as bigint) : undefined,
      blocked: blocked?.status === 'success' ? (blocked.result as boolean) : undefined,
    }
  })

  return {
    rows,
    isLoading: recipientsQuery.isLoading,
    error: recipientsQuery.error,
    refetch: recipientsQuery.refetch,
  }
}

/** USDC balance, allowance to SplitStream, and withdrawable credit for the connected wallet. */
export function useWalletState(account: Address | undefined) {
  const enabled = Boolean(account)
  const balance = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: account ? [account] : undefined,
    chainId: CHAIN_ID,
    query: { enabled, refetchInterval: 15_000 },
  })
  const allowance = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'allowance',
    args: account ? [account, SPLITSTREAM_ADDRESS] : undefined,
    chainId: CHAIN_ID,
    query: { enabled, refetchInterval: 15_000 },
  })
  const claimable = useReadContract({
    address: SPLITSTREAM_ADDRESS,
    abi: splitStreamAbi,
    functionName: 'claimable',
    args: account ? [account] : undefined,
    chainId: CHAIN_ID,
    query: { enabled, refetchInterval: 15_000 },
  })
  return {
    balance: balance.data,
    allowance: allowance.data,
    claimable: claimable.data,
    isLoading: balance.isLoading || allowance.isLoading || claimable.isLoading,
  }
}
