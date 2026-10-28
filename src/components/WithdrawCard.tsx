import { useAccount, useWriteContract } from 'wagmi'
import { Coins } from 'lucide-react'
import { CHAIN_ID, SPLITSTREAM_ADDRESS } from '@/appConfig'
import { useWalletState } from '@/hooks/useSplitStream'
import { useTx } from '@/hooks/useTx'
import { splitStreamAbi } from '@/lib/abi'
import { usdc } from '@/lib/format'
import { TxStatus } from './TxStatus'

/** Appears only while the connected wallet has a credited balance waiting in the contract. */
export function WithdrawCard({ onConfirmed }: { onConfirmed: () => void }) {
  const { address } = useAccount()
  const { claimable } = useWalletState(address)
  const { writeContractAsync } = useWriteContract()
  const tx = useTx(onConfirmed)

  const justWithdrew = tx.state.phase === 'success'
  if (!address || ((claimable === undefined || claimable === 0n) && !justWithdrew)) return null

  const withdraw = () =>
    void tx.run('Withdraw', () => writeContractAsync({ address: SPLITSTREAM_ADDRESS, abi: splitStreamAbi, functionName: 'withdraw', chainId: CHAIN_ID }))

  return (
    <section className="card p-5 sm:p-6" aria-labelledby="withdraw-heading">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-2xl" style={{ background: 'rgba(26,128,71,0.12)' }} aria-hidden>
            <Coins className="size-5" style={{ color: 'var(--success)' }} />
          </div>
          <div>
            <h2 id="withdraw-heading" className="label">
              Waiting for you
            </h2>
            <div className="display text-2xl font-bold tabular-nums">{usdc(claimable ?? 0n)} USDC</div>
          </div>
        </div>
        <button type="button" className="btn btn-primary" onClick={withdraw} disabled={tx.busy || !claimable}>
          Withdraw
        </button>
      </div>
      <p className="mt-2 text-xs text-pretty" style={{ color: 'var(--muted)' }}>
        A payout to your address could not be sent directly, so it was credited here. Withdrawing sends it to your wallet.
      </p>
      <div className="mt-3">
        <TxStatus state={tx.state} />
      </div>
    </section>
  )
}
