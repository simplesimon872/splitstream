import { useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { useAccount, useSwitchChain } from 'wagmi'
import { CHAIN_ID, NETWORK_NAME } from '@/appConfig'
import { parseError } from '@/lib/format'

/** Shown when a wallet is connected to the wrong network. Switching also adds the network to the wallet if it is missing. */
export function NetworkBanner() {
  const { isConnected, chainId } = useAccount()
  const { switchChainAsync, isPending } = useSwitchChain()
  const [error, setError] = useState<string | null>(null)

  if (!isConnected || chainId === CHAIN_ID) return null

  const onSwitch = async () => {
    setError(null)
    try {
      await switchChainAsync({ chainId: CHAIN_ID })
    } catch (e) {
      const parsed = parseError(e)
      if (!parsed.rejected) setError(parsed.message)
    }
  }

  return (
    <div className="inner flex flex-wrap items-center justify-between gap-3 p-4" role="alert" style={{ borderColor: 'var(--warn)' }}>
      <div className="flex items-start gap-2 text-sm">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" style={{ color: 'var(--warn)' }} aria-hidden />
        <div>
          <div className="font-semibold">Your wallet is on the wrong network</div>
          <div style={{ color: 'var(--muted)' }}>
            SplitStream runs on {NETWORK_NAME} (chain {CHAIN_ID}). Switch to continue; your wallet will offer to add it if it is missing.
          </div>
          {error && (
            <div className="mt-1" style={{ color: 'var(--danger)' }}>
              {error}
            </div>
          )}
        </div>
      </div>
      <button type="button" className="btn btn-primary" onClick={() => void onSwitch()} disabled={isPending}>
        {isPending && <Loader2 className="size-4 animate-spin" aria-hidden />} Switch to {NETWORK_NAME}
      </button>
    </div>
  )
}
