import { useState } from 'react'
import { ActivityFeed } from '@/components/ActivityFeed'
import { Header } from '@/components/Header'
import { NetworkBanner } from '@/components/NetworkBanner'
import { RecipientsPanel } from '@/components/RecipientsPanel'
import { SplitCard } from '@/components/SplitCard'
import { WithdrawCard } from '@/components/WithdrawCard'
import { useActivity } from '@/hooks/useActivity'
import { useRecipientRows } from '@/hooks/useSplitStream'
import { parseAmountInput } from '@/lib/amount'

export default function App() {
  const [amount, setAmount] = useState('')
  const [reference, setReference] = useState('')
  const activity = useActivity()
  const recipients = useRecipientRows()
  const previewAmount = parseAmountInput(amount).raw

  return (
    <div className="mx-auto min-h-dvh w-full max-w-5xl px-4 pb-24 pt-6 sm:px-6 sm:pt-10">
      <Header />

      <main className="mt-6 space-y-4 sm:mt-8">
        <NetworkBanner />
        <WithdrawCard onConfirmed={() => void activity.refresh()} />

        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
          <div className="space-y-4 lg:sticky lg:top-6">
            <SplitCard
              amount={amount}
              reference={reference}
              onAmountChange={setAmount}
              onReferenceChange={setReference}
              onConfirmed={() => void activity.refresh()}
            />
          </div>
          <div className="space-y-4">
            <RecipientsPanel
              rows={recipients.rows}
              isLoading={recipients.isLoading}
              error={recipients.error}
              onRetry={() => void recipients.refetch()}
              previewAmount={previewAmount}
            />
            <ActivityFeed activity={activity} />
          </div>
        </div>
      </main>
    </div>
  )
}
