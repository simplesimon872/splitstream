import { Check, FileText, Send, ShieldCheck } from 'lucide-react'
import { ConnectKitButton } from 'connectkit'
import { TokenUSDC } from '@web3icons/react'
import { encodeFunctionData, erc20Abi, keccak256, stringToHex } from 'viem'
import { useAccount, useWriteContract } from 'wagmi'
import { CHAIN_ID, MEMO_ADDRESS, SPLITSTREAM_ADDRESS, USDC_ADDRESS } from '@/appConfig'
import { useTx } from '@/hooks/useTx'
import { useWalletState } from '@/hooks/useSplitStream'
import { splitStreamAbi, memoAbi } from '@/lib/abi'
import { parseAmountInput } from '@/lib/amount'
import { usdc } from '@/lib/format'
import { formatUsdc } from '@/onchain-money'
import { TxStatus } from './TxStatus'

interface Props {
  amount: string
  reference: string
  onAmountChange: (value: string) => void
  onReferenceChange: (value: string) => void
  onConfirmed: () => void
}

export function SplitCard({ amount, reference, onAmountChange, onReferenceChange, onConfirmed }: Props) {
  const { address, isConnected } = useAccount()
  const wallet = useWalletState(address)
  const { writeContractAsync } = useWriteContract()
  const tx = useTx(onConfirmed)

  const parsed = parseAmountInput(amount)
  const raw = parsed.raw
  const balance = wallet.balance
  const allowance = wallet.allowance
  const overBalance = raw !== undefined && balance !== undefined && raw > balance
  const amountError = parsed.error ?? (overBalance ? `That is more than your balance of ${usdc(balance)} USDC.` : undefined)
  const valid = raw !== undefined && !amountError
  const approved = valid && allowance !== undefined && allowance >= raw
  const ref = reference.trim()

  const clear = () => {
    onAmountChange('')
    onReferenceChange('')
  }

  const approve = () => {
    if (raw === undefined) return
    void tx.run('Approve USDC', () =>
      writeContractAsync({ address: USDC_ADDRESS, abi: erc20Abi, functionName: 'approve', args: [SPLITSTREAM_ADDRESS, raw], chainId: CHAIN_ID }),
    )
  }

  const split = async () => {
    if (raw === undefined) return
    const ok = await tx.run('Split', () =>
      writeContractAsync({ address: SPLITSTREAM_ADDRESS, abi: splitStreamAbi, functionName: 'distribute', args: [raw, reference], chainId: CHAIN_ID }),
    )
    if (ok) clear()
  }

  const splitWithMemo = async () => {
    if (raw === undefined || !ref) return
    // The EOA stays msg.sender: Arc's Memo contract forwards the call on the sender's behalf.
    const inner = encodeFunctionData({ abi: splitStreamAbi, functionName: 'distribute', args: [raw, reference] })
    const memoId = keccak256(stringToHex(reference))
    const memoData = stringToHex(reference)
    const ok = await tx.run('Split with on-chain memo', () =>
      writeContractAsync({ address: MEMO_ADDRESS, abi: memoAbi, functionName: 'memo', args: [SPLITSTREAM_ADDRESS, inner, memoId, memoData], chainId: CHAIN_ID }),
    )
    if (ok) clear()
  }

  const canSplit = valid && approved && !tx.busy
  const needsRef = approved && !ref

  return (
    <section className="card p-5 sm:p-6" aria-labelledby="split-heading">
      <h2 id="split-heading" className="display text-xl font-bold">
        Split USDC
      </h2>
      <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
        Send USDC once and it is divided between the recipients in one transaction.
      </p>

      <div className="field mt-5 p-4">
        <label htmlFor="amount" className="label">
          Amount
        </label>
        <div className="mt-2 flex items-center gap-3">
          <input
            id="amount"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            value={amount}
            onChange={(e) => onAmountChange(e.target.value.replace(/[^0-9.]/g, ''))}
            aria-invalid={Boolean(amountError)}
            aria-describedby="amount-help"
            className="display min-w-0 flex-1 text-4xl font-bold tabular-nums"
            disabled={tx.busy}
          />
          <span className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: 'var(--ink-2)' }}>
            <TokenUSDC variant="branded" size={22} /> USDC
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between text-xs" id="amount-help">
          <span style={{ color: amountError ? 'var(--danger)' : 'var(--subtle)' }}>{amountError ?? 'Up to 6 decimal places.'}</span>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={balance === undefined || balance === 0n || tx.busy}
            onClick={() => balance !== undefined && onAmountChange(formatUsdc(balance))}
          >
            {isConnected ? (balance !== undefined ? `Balance ${usdc(balance)} · Max` : 'Balance loading…') : 'Connect to see balance'}
          </button>
        </div>
      </div>

      <div className="field mt-3 p-4">
        <label htmlFor="reference" className="label">
          Reference / memo
        </label>
        <div className="mt-2 flex items-center gap-2">
          <FileText className="size-4 shrink-0" style={{ color: 'var(--subtle)' }} aria-hidden />
          <input
            id="reference"
            type="text"
            maxLength={120}
            autoComplete="off"
            placeholder="Invoice 2026-0001"
            value={reference}
            onChange={(e) => onReferenceChange(e.target.value)}
            className="text-sm"
            disabled={tx.busy}
          />
        </div>
      </div>

      {!isConnected ? (
        <div className="mt-5">
          <ConnectKitButton.Custom>
            {({ show }) => (
              <button type="button" className="btn btn-primary w-full" onClick={show}>
                Connect wallet to split
              </button>
            )}
          </ConnectKitButton.Custom>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          <div className="inner-muted flex items-center justify-between gap-3 p-3">
            <div className="text-sm">
              <div className="font-semibold">Step 1 · Allow USDC</div>
              <div className="text-xs" style={{ color: 'var(--muted)' }}>
                {valid && allowance !== undefined
                  ? approved
                    ? `Allowance ${usdc(allowance)} USDC covers this amount.`
                    : `Allowance ${usdc(allowance)} USDC. Approves exactly ${usdc(raw)} USDC.`
                  : 'Enter an amount to check your allowance.'}
              </div>
            </div>
            <button type="button" className="btn btn-secondary shrink-0" onClick={approve} disabled={!valid || approved || tx.busy}>
              {approved ? <Check className="size-4" aria-hidden /> : <ShieldCheck className="size-4" aria-hidden />}
              {approved ? 'Approved' : 'Approve USDC'}
            </button>
          </div>

          <div>
            <div className="mb-2 text-sm font-semibold">Step 2 · Split</div>
            <div className="grid gap-2 sm:grid-cols-2">
              <button type="button" className="btn btn-primary" onClick={() => void split()} disabled={!canSplit}>
                <Send className="size-4" aria-hidden /> Split
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => void splitWithMemo()} disabled={!canSplit || !ref}>
                Split with on-chain memo
              </button>
            </div>
            <p className="mt-2 text-xs text-pretty" style={{ color: 'var(--subtle)' }}>
              {needsRef
                ? 'Add a reference to use the on-chain memo.'
                : 'The on-chain memo goes through Arc’s Memo contract, which needs a regular wallet. Smart-contract wallets are not supported.'}
            </p>
          </div>

          <TxStatus state={tx.state} />
        </div>
      )}
    </section>
  )
}
