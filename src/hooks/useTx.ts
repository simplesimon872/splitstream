import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAccount, usePublicClient, useSwitchChain } from 'wagmi'
import type { Hash } from 'viem'
import { CHAIN_ID } from '@/appConfig'
import { parseError } from '@/lib/format'

export type TxPhase = 'idle' | 'wallet' | 'confirming' | 'success' | 'error'

export interface TxState {
  phase: TxPhase
  label: string
  hash?: Hash
  error?: string
}

const IDLE: TxState = { phase: 'idle', label: '' }

/**
 * Runs one wallet transaction through its real lifecycle:
 * switch network if needed -> wallet signature -> receipt -> refresh all live reads.
 * Every phase comes from the wallet or the chain, never from a timer.
 */
export function useTx(onConfirmed?: () => void) {
  const { chainId } = useAccount()
  const { switchChainAsync } = useSwitchChain()
  const publicClient = usePublicClient({ chainId: CHAIN_ID })
  const queryClient = useQueryClient()
  const [state, setState] = useState<TxState>(IDLE)

  const run = useCallback(
    async (label: string, send: () => Promise<Hash>): Promise<boolean> => {
      let hash: Hash | undefined
      setState({ phase: 'wallet', label })
      try {
        if (chainId !== CHAIN_ID) await switchChainAsync({ chainId: CHAIN_ID })
        hash = await send()
        setState({ phase: 'confirming', label, hash })
        if (!publicClient) throw new Error('network: no RPC client')
        const receipt = await publicClient.waitForTransactionReceipt({ hash })
        if (receipt.status !== 'success') {
          setState({ phase: 'error', label, hash, error: 'The transaction was mined but reverted. Nothing was changed.' })
          return false
        }
        setState({ phase: 'success', label, hash })
        await queryClient.invalidateQueries()
        onConfirmed?.()
        return true
      } catch (e) {
        const parsed = parseError(e)
        setState(parsed.rejected ? IDLE : { phase: 'error', label, hash, error: parsed.message })
        return false
      }
    },
    [chainId, switchChainAsync, publicClient, queryClient, onConfirmed],
  )

  const reset = useCallback(() => setState(IDLE), [])
  const busy = state.phase === 'wallet' || state.phase === 'confirming'

  return { state, run, reset, busy }
}
