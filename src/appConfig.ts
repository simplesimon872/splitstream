import { defineChain, getAddress, isAddress, type Address, type Chain } from 'viem'
import { arc, arcTestnet } from 'viem/chains'
import { getUsdc, requireChain } from '@/onchain-facts'

/**
 * THE place to switch networks.
 *
 * Testnet -> mainnet is a change to `chainId` and `splitStream` below
 * (mainnet chain ID is 5042, and it needs its own SplitStream deployment).
 * The USDC and Memo addresses are identical on both networks, so they never change.
 *
 *   chainId       5042002 = Arc Testnet, 5042 = Arc mainnet
 *   splitStream   the deployed SplitStream contract on that network
 *   deployBlock   block the contract was deployed at; the activity feed never scans before it
 *                 (use 0 if unknown, the feed then only looks back a bounded number of blocks)
 *
 * Optional overrides at build time (public values only, never secrets):
 *   VITE_CHAIN_ID, VITE_SPLITSTREAM_ADDRESS, VITE_DEPLOY_BLOCK
 */
export const APP_CONFIG = {
  chainId: 5042002,
  splitStream: '0x04ffda3829210d9314076f6a97a4d001d5424d55',
  deployBlock: 69295097,
} as const

/** Arc's transaction Memo wrapper: the same address on testnet and mainnet. */
export const MEMO_ADDRESS: Address = '0x5294E9927c3306DcBaDb03fe70b92e01cCede505'

const SUPPORTED: Record<number, Chain> = { [arcTestnet.id]: arcTestnet, [arc.id]: arc }

function readChainId(): number {
  const raw = import.meta.env.VITE_CHAIN_ID
  const id = raw ? Number(raw) : APP_CONFIG.chainId
  if (!SUPPORTED[id]) throw new Error(`Unsupported chain ID ${String(raw ?? id)}. Use 5042002 (Arc Testnet) or 5042 (Arc).`)
  return id
}

function readSplitStream(): Address {
  const raw = import.meta.env.VITE_SPLITSTREAM_ADDRESS || APP_CONFIG.splitStream
  if (!isAddress(raw, { strict: false })) throw new Error('SplitStream address is not a valid address.')
  return getAddress(raw)
}

function readDeployBlock(): bigint {
  const raw = import.meta.env.VITE_DEPLOY_BLOCK
  const n = raw ? Number(raw) : APP_CONFIG.deployBlock
  if (!Number.isInteger(n) || n < 0) throw new Error('Deploy block must be a non-negative integer.')
  return BigInt(n)
}

export const CHAIN_ID = readChainId()
export const SPLITSTREAM_ADDRESS = readSplitStream()
export const DEPLOY_BLOCK = readDeployBlock()

const facts = requireChain(CHAIN_ID)
const usdcFact = getUsdc(CHAIN_ID)
if (!usdcFact) throw new Error(`USDC is not registered for chain ${CHAIN_ID}`)

export const USDC_ADDRESS = getAddress(usdcFact.address)
export const IS_TESTNET = CHAIN_ID === arcTestnet.id
export const NETWORK_NAME = facts.name

/**
 * The active chain. The registry's RPC URL comes first; viem's other public Arc endpoints follow
 * so the app can fall back if one endpoint rate-limits.
 */
export const ACTIVE_CHAIN: Chain = defineChain({
  ...SUPPORTED[CHAIN_ID],
  rpcUrls: { default: { http: [...new Set([...facts.rpcUrls, ...SUPPORTED[CHAIN_ID].rpcUrls.default.http])] } },
})
