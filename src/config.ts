import { fallback, http, createConfig } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { ACTIVE_CHAIN } from '@/appConfig'

// One chain (set in src/appConfig.ts) and browser wallets (MetaMask, Rabby, Coinbase Wallet, ...).
export const config = createConfig({
  chains: [ACTIVE_CHAIN],
  connectors: [injected()],
  // Several public RPC endpoints: if one rate-limits or fails, the next is used.
  transports: { [ACTIVE_CHAIN.id]: fallback(ACTIVE_CHAIN.rpcUrls.default.http.map((url) => http(url))) },
})
