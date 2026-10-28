import { AlertTriangle, Check, ExternalLink, Loader2 } from 'lucide-react'
import type { TxState } from '@/hooks/useTx'
import { shortHash, txUrl } from '@/lib/format'

/** Honest transaction state: wallet prompt, confirming, confirmed, or failed. Hash links appear only for real transactions. */
export function TxStatus({ state }: { state: TxState }) {
  if (state.phase === 'idle') return null

  const link = state.hash ? (
    <a href={txUrl(state.hash)} target="_blank" rel="noopener noreferrer" className="link mono inline-flex items-center gap-1 text-xs">
      {shortHash(state.hash)} <ExternalLink className="size-3" aria-hidden />
    </a>
  ) : null

  return (
    <div className="inner p-4" role="status" aria-live="polite">
      {state.phase === 'wallet' && (
        <div className="flex items-center gap-2 text-sm font-medium">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Confirm “{state.label}” in your wallet…
        </div>
      )}
      {state.phase === 'confirming' && (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Confirming on Arc…
          </div>
          {link}
        </div>
      )}
      {state.phase === 'success' && (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--success)' }}>
            <Check className="size-4" aria-hidden /> {state.label} confirmed
          </div>
          {link}
        </div>
      )}
      {state.phase === 'error' && (
        <div className="space-y-1">
          <div className="flex items-start gap-2 text-sm font-medium" style={{ color: 'var(--danger)' }}>
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> {state.error}
          </div>
          {link}
        </div>
      )}
    </div>
  )
}
