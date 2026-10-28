import { ExternalLink, ShieldAlert } from 'lucide-react'
import type { RecipientRow } from '@/hooks/useSplitStream'
import { previewPayouts } from '@/lib/amount'
import { addressUrl, bpsToPercent, shortAddr, usdc } from '@/lib/format'

interface Props {
  rows: RecipientRow[]
  isLoading: boolean
  error: Error | null
  onRetry: () => void
  previewAmount?: bigint
}

export function RecipientsPanel({ rows, isLoading, error, onRetry, previewAmount }: Props) {
  const preview = previewAmount !== undefined ? previewPayouts(previewAmount, rows.map((r) => r.shareBps)) : undefined

  return (
    <section className="card p-5 sm:p-6" aria-labelledby="recipients-heading">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="recipients-heading" className="display text-xl font-bold">
          Recipients
        </h2>
        <span className="label">Read live from the contract</span>
      </div>

      {isLoading && (
        <div className="mt-4 space-y-2" aria-busy="true" aria-label="Loading recipients">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-16" />
          ))}
        </div>
      )}

      {error && !isLoading && (
        <div className="inner mt-4 flex items-center justify-between gap-3 p-4 text-sm" role="alert">
          <span style={{ color: 'var(--danger)' }}>Could not read the recipient list from the network.</span>
          <button type="button" className="btn btn-secondary" onClick={onRetry}>
            Retry
          </button>
        </div>
      )}

      {!isLoading && !error && rows.length === 0 && (
        <p className="mt-4 text-sm" style={{ color: 'var(--muted)' }}>
          This contract has no recipients configured.
        </p>
      )}

      <ul className="mt-4 space-y-2">
        {rows.map((row, i) => {
          const last = i === rows.length - 1
          return (
            <li key={row.address} className="inner p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <a
                    href={addressUrl(row.address)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="link mono inline-flex items-center gap-1 text-sm"
                    title={row.address}
                  >
                    {shortAddr(row.address)} <ExternalLink className="size-3" aria-hidden />
                  </a>
                  <div className="mt-0.5 text-xs" style={{ color: 'var(--subtle)' }}>
                    {last ? 'Also receives rounding dust' : `Recipient ${i + 1}`}
                  </div>
                </div>
                <div className="text-right">
                  <div className="display text-xl font-bold tabular-nums">{bpsToPercent(row.shareBps)}</div>
                  <div className="text-xs tabular-nums" style={{ color: 'var(--subtle)' }}>
                    {row.shareBps} bps
                  </div>
                </div>
              </div>

              <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--surface-muted)' }} aria-hidden>
                <div className="h-full rounded-full" style={{ width: `${row.shareBps / 100}%`, background: 'var(--accent)' }} />
              </div>

              <dl className="mt-2.5 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <dt style={{ color: 'var(--subtle)' }}>Claimable</dt>
                  <dd className="text-sm font-semibold tabular-nums">{row.claimable !== undefined ? `${usdc(row.claimable)} USDC` : '…'}</dd>
                </div>
                {preview && (
                  <div className="text-right">
                    <dt style={{ color: 'var(--subtle)' }}>{row.blocked ? 'Would be credited' : 'Would receive'}</dt>
                    <dd className="text-sm font-semibold tabular-nums">{usdc(preview[i])} USDC</dd>
                  </div>
                )}
              </dl>

              {row.blocked && (
                <p className="mt-2 flex items-start gap-1.5 text-xs text-pretty" style={{ color: 'var(--warn)' }}>
                  <ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  USDC reports this address as blocklisted. Its share is credited to the contract instead of sent, and only this address can withdraw it.
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
