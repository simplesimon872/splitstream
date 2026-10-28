import { ConnectKitButton } from 'connectkit'
import { ExternalLink, Wallet } from 'lucide-react'
import { IS_TESTNET, NETWORK_NAME, SPLITSTREAM_ADDRESS } from '@/appConfig'
import { addressUrl, shortAddr } from '@/lib/format'

export function Header() {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
		<svg width="40" height="40" viewBox="0 0 512 512" aria-hidden xmlns="http://www.w3.org/2000/svg">
		  <defs>
			<linearGradient id="ssLogoBg" x1="0" y1="0" x2="1" y2="1">
			  <stop offset="0" stopColor="#1E6FD9" />
			  <stop offset="1" stopColor="#2FC7A8" />
			</linearGradient>
		  </defs>
		  <rect x="0" y="0" width="512" height="512" rx="112" fill="url(#ssLogoBg)" />
		  <g fill="none" stroke="#FFFFFF" strokeWidth="24" strokeLinecap="round" opacity="0.96">
			<path d="M166,256 C 250,256 282,150 352,150" />
			<path d="M166,256 L 352,256" />
			<path d="M166,256 C 250,256 282,362 352,362" />
		  </g>
		  <g fill="#FFFFFF">
			<circle cx="356" cy="150" r="26" />
			<circle cx="356" cy="256" r="26" />
			<circle cx="356" cy="362" r="26" />
		  </g>
		  <circle cx="160" cy="256" r="42" fill="#FFFFFF" />
		  <circle cx="160" cy="256" r="20" fill="none" stroke="#1E6FD9" strokeWidth="10" />
		</svg>
        <div>
          <h1 className="display text-2xl font-bold leading-none">SplitStream</h1>
          <a
            href={addressUrl(SPLITSTREAM_ADDRESS)}
            target="_blank"
            rel="noopener noreferrer"
            className="link mono mt-1 inline-flex items-center gap-1 text-xs"
            aria-label="Open the SplitStream contract on the explorer"
          >
            {shortAddr(SPLITSTREAM_ADDRESS)} <ExternalLink className="size-3" aria-hidden />
          </a>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span
          className="inline-flex min-h-9 items-center gap-2 rounded-full px-3 text-xs font-semibold"
          style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)', color: 'var(--ink-2)' }}
        >
          <span className="size-2 rounded-full" style={{ background: IS_TESTNET ? 'var(--warn)' : 'var(--success)' }} aria-hidden />
          {NETWORK_NAME}
        </span>
        <ConnectKitButton.Custom>
          {({ isConnected, isConnecting, show, truncatedAddress }) => (
            <button type="button" onClick={show} className={`btn ${isConnected ? 'btn-secondary' : 'btn-primary'}`}>
              <Wallet className="size-4" aria-hidden />
              {isConnecting ? 'Connecting…' : isConnected ? truncatedAddress : 'Connect wallet'}
            </button>
          )}
        </ConnectKitButton.Custom>
      </div>
    </header>
  )
}
