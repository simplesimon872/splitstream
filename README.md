# SplitStream

**An immutable, memo-tagged USDC revenue splitter on [Arc](https://arc.io).** Set the recipients and their shares *once* at deploy; after that, push any payment through and it's split instantly, every time — by a ratio nobody can change.

## What it is

SplitStream is a smart contract on Arc (Circle's stablecoin L1) that splits incoming USDC among a **fixed** set of recipients by preset percentages. You deploy it once with your recipients and their basis-point shares. From then on, anyone can send USDC through it and each recipient receives their share in a single, sub-second transaction.

The recipient list is **immutable** — no owner, no admin, no upgrade path. Every payee can verify on-chain that their share is locked and can never be quietly changed. The deployer gets no special power over the contract afterward.

## How you use it

1. **Deploy once** with `constructor(address[] recipients, uint16[] sharesBps)` — shares in basis points summing to **10,000**, up to **50** recipients. The last recipient receives any rounding dust.
2. **Approve** the contract to spend your USDC (6-decimal units — **1 USDC = 1,000,000**).
3. **Split** by calling `distribute(uint256 amount, string memo)` — it pulls `amount` and pays each recipient their share. Do this as often as you like; the split ratio is always the one locked at deploy.
4. **Withdraw** — if a recipient couldn't be paid directly (see below), they call `withdraw()` to claim their balance.

To use a *different* set of recipients, deploy another SplitStream — they're cheap, and you can run as many as you like (one per team, project, or payee set).

## Why it's built this way

- **Fixed, trustless split.** Recipients and shares are set at deploy and immutable thereafter. A payee can trust the contract, not a person.
- **Blocklist-safe.** USDC can blocklist addresses. A naive splitter that pushes to everyone would revert *for all* if *one* recipient is blocked — permanently bricking it. SplitStream pays each recipient directly, but if a transfer fails it **credits** that share to a claimable balance the recipient can `withdraw()` later. One bad address can never block the others.
- **Memo-tagged.** Each split can carry an on-chain reference ID via Arc's Memo contract. Arc's CallFrom precompile keeps the original caller as `msg.sender`, so the memo doesn't spoof the sender.
- **USDC-native.** Uses Arc's 6-decimal USDC ERC-20; gas is paid in USDC; settlement is final in under a second.

## Use cases

Payroll & wages · personal savings buckets · creator & royalty splits · co-founder profit sharing · agency & subcontractor payouts · affiliate / referral commissions · DAO contributor allocations · charity & tithing · marketplace fee routing · agent-to-agent settlement.

## Interface

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
