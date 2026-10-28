# SplitStream

**An immutable, memo-tagged USDC revenue splitter on [Arc](https://arc.io) — smart contract + web app.** Set the recipients and their shares *once* at deploy; after that, push any payment through and it's split instantly, every time, by a ratio nobody can change.

This repo contains the Solidity contract (`SplitStream.sol`) and a static web app that drives it.

## What it is

SplitStream is a smart contract on Arc (Circle's stablecoin L1) that splits incoming USDC among a **fixed** set of recipients by preset percentages. You deploy it once with your recipients and their basis-point shares. From then on, anyone can send USDC through it and each recipient receives their share in a single, sub-second transaction.

The recipient list is **immutable** — no owner, no admin, no upgrade path. Every payee can verify on-chain that their share is locked and can never be quietly changed. The deployer gets no special power over the contract afterward.

## Why it's built this way

- **Fixed, trustless split.** Recipients and shares are set at deploy and immutable thereafter. A payee can trust the contract, not a person.
- **Blocklist-safe.** USDC can blocklist addresses. A naive splitter that pushes to everyone would revert *for all* if *one* recipient is blocked — permanently bricking it. SplitStream pays each recipient directly, but if a transfer fails it **credits** that share to a claimable balance the recipient can `withdraw()` later. One bad address can never block the others.
- **Memo-tagged.** Each split can carry an on-chain reference ID via Arc's Memo contract. Arc's CallFrom precompile keeps the original caller as `msg.sender`, so the memo doesn't spoof the sender.
- **USDC-native.** Uses Arc's 6-decimal USDC ERC-20; gas is paid in USDC; settlement is final in under a second.

## Use cases

Payroll & wages · personal savings buckets · creator & royalty splits · co-founder profit sharing · agency & subcontractor payouts · affiliate / referral commissions · DAO contributor allocations · charity & tithing · marketplace fee routing · agent-to-agent settlement.

Wherever a payee needs to *trust* that their share won't be changed — royalties, profit shares, partnerships — the fact that it *can't* be is a genuine feature.

## Using the contract

1. **Deploy once** with `constructor(address[] recipients, uint16[] sharesBps)` — shares in basis points summing to **10,000**, up to **50** recipients. The last recipient receives any rounding dust.
2. **Approve** the contract to spend your USDC (6-decimal units — **1 USDC = 1,000,000**).
3. **Split** by calling `distribute(uint256 amount, string memo)` — it pulls `amount` and pays each recipient their share. Do this as often as you like; the ratio is always the one locked at deploy.
4. **Withdraw** — if a recipient couldn't be paid directly, they call `withdraw()` to claim their balance.

To use a *different* set of recipients, deploy another SplitStream — they're cheap, and you can run as many as you like (one per team, project, or payee set).

## The web app

A static web app for a deployed SplitStream contract. It shows the recipients and their shares live from the contract, lets a connected wallet approve USDC and split an amount (optionally with an Arc on-chain memo), shows recent activity, and lets a recipient withdraw credited funds. There is **no backend** — the app talks to the Arc RPC and the user's browser wallet only.

### Run & build

Requires Node 20+ (or Bun).

```bash
npm install          # or: bun install
npm run dev          # local dev server
npm run build        # type-checks, then writes the static site to dist/
npm run preview      # serve dist/ locally to check the production build
```

### Deploy

Deploy the contents of `dist/` to any static host (Cloudflare Pages, Netlify, Vercel, GitHub Pages, S3). The build uses relative asset paths and has no client-side routes, so no rewrite rules are needed.

**Cloudflare Pages:** connect this GitHub repo, set the build command to `npm run build` and the output directory to `dist`, and it rebuilds on every push.

### Network & contract config (one place)

Open `src/appConfig.ts`:

```ts
export const APP_CONFIG = {
  chainId: 5042002,                                          // Arc Testnet. Arc mainnet is 5042
  splitStream: '0x04ffda3829210d9314076f6a97a4d001d5424d55', // SplitStream on that network
  deployBlock: 69295097,                                     // block the contract was deployed at
}
```

The USDC and Memo addresses are identical on both networks, so they aren't configurable.

To point at mainnet: change `chainId` to `5042`, set `splitStream` to your mainnet deployment, and set `deployBlock` to its deployment block (or `0` if unknown). **The testnet contract does not exist on mainnet — you must deploy SplitStream there first, with the real recipients.** Recipients and shares are fixed at deploy.

The same three values can instead be supplied at build time (see `.env.example`): `VITE_CHAIN_ID`, `VITE_SPLITSTREAM_ADDRESS`, `VITE_DEPLOY_BLOCK`. When set, they override `appConfig.ts`. These are public values — **never put secrets in `VITE_` variables; they are bundled into the site.**

### App notes

- Amounts are USDC in 6-decimal base units (1 USDC = 1,000,000). You type human USDC; the app converts.
- Approvals cover exactly the amount you enter, not an unlimited allowance.
- "Split with on-chain memo" goes through Arc's Memo contract. It needs a regular (EOA) wallet; smart-contract wallets are not supported by Memo.
- If a recipient is blocklisted by USDC, their share is credited to the contract instead of sent, and only that address can withdraw it. The app flags such recipients.
- The activity feed reads logs straight from public Arc RPC endpoints, in small block windows, and never scans before `deployBlock`. Public endpoints can rate-limit; the app retries and falls back to other endpoints.
- Wallets: browser-injected wallets only. WalletConnect is not configured, so no project ID is needed.

## Contract interface

**Functions:** `distribute(uint256 amount, string memo)` · `withdraw()` · `getRecipients() → (address[], uint16[])` · `recipientCount()` · `claimable(address)` · `totalClaimable()` · `USDC()`

**Events:** `Distributed(address indexed from, uint256 amount, string memo)` · `Payout(address indexed to, uint256 amount, uint16 shareBps)` · `Credited(address indexed to, uint256 amount)` · `Withdrawn(address indexed to, uint256 amount)`

## Deployments

| Network | Chain ID | Contract |
| --- | --- | --- |
| Arc Testnet | `5042002` | `0x04ffda3829210d9314076f6a97a4d001d5424d55` |
| Arc Mainnet | `5042` | _coming_ |

USDC ERC-20 `0x3600000000000000000000000000000000000000` and Memo `0x5294E9927c3306DcBaDb03fe70b92e01cCede505` are identical on both networks.

## Proven on testnet

- **Direct split** — 3 recipients paid, 1 blocklisted recipient safely credited (not reverted): [`0x5b85…cdddb`](https://explorer.testnet.arc.io/tx/0x5b8527d1d399039b7509502df1b642461adc50b8ae384b7ce6fed0f5a03cdddb)
- **Memo-wrapped split** — on-chain memo emitted, caller preserved as `msg.sender` through CallFrom: [`0x82ff…a6e6`](https://explorer.testnet.arc.io/tx/0x82ff964d78bb507c9d967b6d69848965ce72230839b18a2a9f28c38d0182a6e6)

49 unit tests passing, including fuzz tests and a fund-conservation invariant.

## Built with

Designed, written, security-reviewed, tested and deployed with [Arc Studio](https://studio.arc.io).

## Roadmap

- Permissionless, timeout-based redistribution of permanently stuck credits
- Gasless (EIP-3009) payouts
- Agent-to-agent settlement via ERC-8004 agent identity
- Optional per-call recipient configuration (ad-hoc "disperse" mode)

## License

MIT — see [`SplitStream.sol`](./SplitStream.sol).
