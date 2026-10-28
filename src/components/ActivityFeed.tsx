import { ArrowDownToLine, ArrowUpRight, Clock, ExternalLink, FileText, Loader2, RefreshCw } from 'lucide-react'
import type { ActivityItem, ActivityKind } from '@/hooks/useActivity'
import { useActivity } from '@/hooks/useActivity'
import { addressUrl, bpsToPercent, shortAddr, shortHash, txUrl, usdc } from '@/lib/format'

const META: Record<ActivityKind, { label: string; tone: string; verb: string }> = {
  Payout: { label: 'Payout', tone: 'var(--success)', verb: 'Paid to' },
  Credited: { label: 'Credited', tone: 'var(--warn)', verb: 'Credited to' },
  Distributed: { label: 'Distributed', tone: 'var(--accent-hover)', verb: 'Split by' },
  Withdrawn: { label: 'Withdrawn', tone: 'var(--ink-2)', verb: 'Withdrawn by' },
}

function Icon({ kind }: { kind: ActivityKind }) {
  const props = { className: 'size-4', 'aria-hidden': true as const, style: { color: META[kind].tone } }
  if (kind === 'Distributed') return <FileText {...props} />
  if (kind === 'Withdrawn') return <ArrowDownToLine {...props} />
  if (kind === 'Credited') return <Clock {...props} />
  return <ArrowUpRight {...props} />
}

function Row({ item }: { item: ActivityItem }) {
  const meta = META[item.kind]
  return (
    <li className="inner flex items-start gap-3 p-3">
      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl" style={{ background: 'var(--surface-muted)' }}>
        <Icon kind={item.kind} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-semibold">{meta.label}</span>
          <span className="text-sm font-semibold tabular-nums">{usdc(item.amount)} USDC</span>
        </div>
        <div className="text-xs" style={{ color: 'var(--muted)' }}>
          {meta.verb}{' '}
          <a href={addressUrl(item.account)} target="_blank" rel="noopener noreferrer" className="link mono">
            {shortAddr(item.account)}
          </a>
          {item.shareBps !== undefined && <span> · {bpsToPercent(item.shareBps)}</span>}
        </div>
        {item.memo && (
          <div className="mt-1 truncate text-xs" style={{ color: 'var(--ink-2)' }} title={item.memo}>
            “{item.memo}”
          </div>
        )}
        <div className="mt-1 flex items-center justify-between text-xs" style={{ color: 'var(--subtle)' }}>
          <span className="tabular-nums">Block {item.blockNumber.toString()}</span>
          <a href={txUrl(item.txHash)} target="_blank" rel="noopener noreferrer" className="link mono inline-flex items-center gap-1">
            {shortHash(item.txHash)} <ExternalLink className="size-3" aria-hidden />
          </a>
        </div>
      </div>
    </li>
  )
}

export function ActivityFeed({ activity }: { activity: ReturnType<typeof useActivity> }) {
  const { items, loading, loadingOlder, error, scannedFrom, scannedTo, reachedStart, refresh, loadOlder } = activity

  return (
    <section className="card p-5 sm:p-6" aria-labelledby="activity-heading">
      <div className="flex items-center justify-between gap-2">
        <h2 id="activity-heading" className="display text-xl font-bold">
          Activity
        </h2>
        <button type="button" className="btn btn-ghost" onClick={() => void refresh()} aria-label="Refresh activity">
          <RefreshCw className="size-4" aria-hidden /> Refresh
        </button>
      </div>

      {scannedFrom !== undefined && scannedTo !== undefined && (
        <p className="mt-1 text-xs tabular-nums" style={{ color: 'var(--subtle)' }}>
          Showing blocks {scannedFrom.toString()} to {scannedTo.toString()}
          {reachedStart ? ' (since the contract was deployed)' : ''}
        </p>
      )}

      {loading && (
        <div className="mt-4 space-y-2" aria-busy="true" aria-label="Loading activity">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-16" />
          ))}
        </div>
      )}

      {error && (
        <div className="mt-4 text-sm" role="alert" style={{ color: 'var(--danger)' }}>
          {error}
        </div>
      )}

      {!loading && items.length === 0 && !error && (
        <p className="mt-4 text-sm" style={{ color: 'var(--muted)' }}>
          No splits in this range yet. Activity appears here as soon as a split is confirmed.
        </p>
      )}

      <ul className="mt-4 space-y-2">
        {items.map((item) => (
          <Row key={item.id} item={item} />
        ))}
      </ul>

      {!loading && !reachedStart && (
        <div className="mt-4 flex justify-center">
          <button type="button" className="btn btn-secondary" onClick={() => void loadOlder()} disabled={loadingOlder}>
            {loadingOlder && <Loader2 className="size-4 animate-spin" aria-hidden />} Load older activity
          </button>
        </div>
      )}
    </section>
  )
}
