import { useCallback, useEffect, useRef, useState } from 'react'
import { parseAbi, type Address, type Hash } from 'viem'
import { usePublicClient } from 'wagmi'
import { CHAIN_ID, DEPLOY_BLOCK, SPLITSTREAM_ADDRESS } from '@/appConfig'

export type ActivityKind = 'Payout' | 'Credited' | 'Distributed' | 'Withdrawn'

export interface ActivityItem {
  id: string
  kind: ActivityKind
  blockNumber: bigint
  logIndex: number
  txHash: Hash
  account: Address
  amount: bigint
  /** Payout: share in bps. Distributed: memo text. */
  shareBps?: number
  memo?: string
}

const activityEvents = parseAbi([
  'event Payout(address indexed to, uint256 amount, uint16 shareBps)',
  'event Credited(address indexed to, uint256 amount)',
  'event Distributed(address indexed from, uint256 amount, string memo)',
  'event Withdrawn(address indexed to, uint256 amount)',
])

/** The RPC rejects large log ranges, so scan in small block pages. */
const PAGE = 5_000n
/** Blocks covered by the first load and by each "Load older". */
const WINDOW = 25_000n
/** Without a known deploy block, never look back further than this. */
const MAX_LOOKBACK_UNKNOWN_DEPLOY = 300_000n
const CONCURRENCY = 2
const POLL_MS = 12_000

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** Public RPCs rate-limit bursts of log queries, so each page retries with a short backoff. */
async function withBackoff<T>(task: () => Promise<T>, attempts = 4): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await task()
    } catch (e) {
      if (attempt >= attempts) throw e
      await sleep(600 * attempt)
    }
  }
}

const byNewest = (a: ActivityItem, b: ActivityItem) =>
  a.blockNumber === b.blockNumber ? b.logIndex - a.logIndex : a.blockNumber > b.blockNumber ? -1 : 1

function mergeItems(existing: ActivityItem[], incoming: ActivityItem[]): ActivityItem[] {
  const map = new Map(existing.map((i) => [i.id, i]))
  for (const item of incoming) map.set(item.id, item)
  return [...map.values()].sort(byNewest)
}

/**
 * Live activity feed read straight from the Arc RPC.
 * Starts at the chain head and walks backwards in bounded windows. It never starts at block 0 and never goes
 * before the contract's deploy block.
 */
export function useActivity() {
  const client = usePublicClient({ chainId: CHAIN_ID })
  const [items, setItems] = useState<ActivityItem[]>([])
  const [range, setRange] = useState<{ oldest: bigint; newest: bigint } | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const rangeRef = useRef<{ oldest: bigint; newest: bigint } | null>(null)
  const busyRef = useRef(false)

  /** Keeps the ref (read inside async callbacks) and the rendered state in step. */
  const commitRange = useCallback((next: { oldest: bigint; newest: bigint }) => {
    rangeRef.current = next
    setRange(next)
  }, [])

  const scan = useCallback(
    async (from: bigint, to: number | bigint): Promise<ActivityItem[]> => {
      if (!client) return []
      const end = BigInt(to)
      const pages: Array<[bigint, bigint]> = []
      for (let start = from; start <= end; start += PAGE) {
        const stop = start + PAGE - 1n
        pages.push([start, stop > end ? end : stop])
      }
      const found: ActivityItem[] = []
      for (let i = 0; i < pages.length; i += CONCURRENCY) {
        const batch = await Promise.all(
          pages.slice(i, i + CONCURRENCY).map(([fromBlock, toBlock]) =>
            withBackoff(() => client.getLogs({ address: SPLITSTREAM_ADDRESS, events: activityEvents, fromBlock, toBlock })),
          ),
        )
        for (const log of batch.flat()) {
          if (log.blockNumber === null || log.logIndex === null || log.transactionHash === null) continue
          const base = { id: `${log.transactionHash}-${log.logIndex}`, blockNumber: log.blockNumber, logIndex: log.logIndex, txHash: log.transactionHash }
          switch (log.eventName) {
            case 'Payout':
              found.push({ ...base, kind: 'Payout', account: log.args.to as Address, amount: log.args.amount as bigint, shareBps: Number(log.args.shareBps) })
              break
            case 'Credited':
              found.push({ ...base, kind: 'Credited', account: log.args.to as Address, amount: log.args.amount as bigint })
              break
            case 'Distributed':
              found.push({ ...base, kind: 'Distributed', account: log.args.from as Address, amount: log.args.amount as bigint, memo: log.args.memo })
              break
            case 'Withdrawn':
              found.push({ ...base, kind: 'Withdrawn', account: log.args.to as Address, amount: log.args.amount as bigint })
              break
          }
        }
      }
      return found
    },
    [client],
  )

  const floorFor = useCallback((head: bigint) => {
    if (DEPLOY_BLOCK > 0n) return DEPLOY_BLOCK
    return head > MAX_LOOKBACK_UNKNOWN_DEPLOY ? head - MAX_LOOKBACK_UNKNOWN_DEPLOY : 0n
  }, [])

  /** First load: the latest window. Later calls: only blocks newer than what we already have. */
  const refresh = useCallback(async () => {
    if (!client || busyRef.current) return
    busyRef.current = true
    try {
      const head = await client.getBlockNumber()
      const current = rangeRef.current
      if (!current) {
        const floor = floorFor(head)
        const from = head + 1n > WINDOW && head + 1n - WINDOW > floor ? head + 1n - WINDOW : floor
        const found = await scan(from, head)
        setItems(mergeItems([], found))
        commitRange({ oldest: from, newest: head })
      } else if (head > current.newest) {
        const found = await scan(current.newest + 1n, head)
        setItems((prev) => mergeItems(prev, found))
        commitRange({ oldest: current.oldest, newest: head })
      }
      setError(null)
    } catch {
      setError('Could not read recent activity from the network. Retrying shortly.')
    } finally {
      busyRef.current = false
      setLoading(false)
    }
  }, [client, scan, floorFor, commitRange])

  const loadOlder = useCallback(async () => {
    const current = rangeRef.current
    if (!client || !current || busyRef.current) return
    busyRef.current = true
    setLoadingOlder(true)
    try {
      const floor = floorFor(current.newest)
      if (current.oldest <= floor) return
      const to = current.oldest - 1n
      const from = to + 1n - WINDOW > floor ? to + 1n - WINDOW : floor
      const found = await scan(from, to)
      setItems((prev) => mergeItems(prev, found))
      commitRange({ oldest: from, newest: current.newest })
      setError(null)
    } catch {
      setError('Could not load older activity. Try again.')
    } finally {
      busyRef.current = false
      setLoadingOlder(false)
    }
  }, [client, scan, floorFor, commitRange])

  useEffect(() => {
    const first = setTimeout(() => void refresh(), 0)
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void refresh()
    }, POLL_MS)
    return () => {
      clearTimeout(first)
      clearInterval(timer)
    }
  }, [refresh])

  const floor = range ? floorFor(range.newest) : 0n
  return {
    items,
    loading,
    loadingOlder,
    error,
    scannedFrom: range?.oldest,
    scannedTo: range?.newest,
    reachedStart: range ? range.oldest <= floor : false,
    refresh,
    loadOlder,
  }
}
