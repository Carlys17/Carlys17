# LI.FI Auto Swap & Bridge Bot

Automated swap and cross-chain bridge bot powered by the [LI.FI](https://li.fi) protocol.
Supports **10+ chains** and **hundreds of tokens** — same-chain swaps and multi-hop cross-chain bridges in one command.

---

## Features

- **Auto Swap** — best-rate DEX aggregation on any supported chain
- **Auto Bridge** — cross-chain token transfers via LI.FI's bridge aggregator
- **Dry-Run mode** — preview the quote & route without sending any transaction
- **Auto mode** — run on a configurable schedule (cron-like)
- **Status tracking** — polls LI.FI API until the bridge/swap is fully confirmed
- **ERC-20 approval** — auto-approves token spending before executing

## Supported Chains

| Chain | Chain ID |
|---|---|
| Ethereum | 1 |
| BSC | 56 |
| Polygon | 137 |
| Arbitrum | 42161 |
| Optimism | 10 |
| Avalanche | 43114 |
| Base | 8453 |
| zkSync Era | 324 |
| Scroll | 534352 |
| Linea | 59144 |

---

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```env
PRIVATE_KEY=your_private_key_here

FROM_CHAIN_ID=137      # Polygon
FROM_TOKEN=USDC
FROM_AMOUNT=10         # 10 USDC

TO_CHAIN_ID=42161      # Arbitrum
TO_TOKEN=USDC

SLIPPAGE=0.03          # 3%
```

> ⚠️ **NEVER share your private key** or commit `.env` to git.

### 3. Run the bot

```bash
# Preview quote (no transaction sent)
npm run dry-run

# Execute once
npm start

# Run on a schedule (set INTERVAL_MINUTES in .env)
npm run auto
```

---

## Configuration Reference

| Variable | Default | Description |
|---|---|---|
| `PRIVATE_KEY` | — | Wallet private key (required) |
| `FROM_CHAIN_ID` | `137` | Source chain ID |
| `FROM_TOKEN` | `USDC` | Token to send (symbol or address) |
| `FROM_AMOUNT` | `1` | Amount in human-readable units |
| `TO_CHAIN_ID` | `42161` | Destination chain ID |
| `TO_TOKEN` | `USDC` | Token to receive |
| `SLIPPAGE` | `0.03` | Slippage tolerance (0.03 = 3%) |
| `AUTO_MODE` | `false` | `true` = repeat on interval |
| `INTERVAL_MINUTES` | `60` | Minutes between auto-runs |
| `ETHEREUM_RPC` | public | Custom RPC for Ethereum |
| `POLYGON_RPC` | public | Custom RPC for Polygon |
| `ARBITRUM_RPC` | public | Custom RPC for Arbitrum |
| *(other chains)* | public | See `.env.example` |

---

## Example Workflows

**Same-chain swap** (Polygon: USDC → MATIC)
```env
FROM_CHAIN_ID=137
TO_CHAIN_ID=137
FROM_TOKEN=USDC
TO_TOKEN=MATIC
FROM_AMOUNT=10
```

**Cross-chain bridge** (Polygon USDC → Arbitrum USDC)
```env
FROM_CHAIN_ID=137
TO_CHAIN_ID=42161
FROM_TOKEN=USDC
TO_TOKEN=USDC
FROM_AMOUNT=10
```

**ETH bridge** (Ethereum → Base)
```env
FROM_CHAIN_ID=1
TO_CHAIN_ID=8453
FROM_TOKEN=ETH
TO_TOKEN=ETH
FROM_AMOUNT=0.01
```

---

## Project Structure

```
.
├── index.js          Entry point / CLI
├── src/
│   ├── bot.js        Main bot logic (quote → approve → execute → monitor)
│   ├── config.js     Chain registry & env config loader
│   ├── lifiApi.js    LI.FI REST API wrapper
│   └── wallet.js     Wallet creation, ERC-20 approve, tx send
├── .env.example      Config template
└── package.json
```

---

## Security Notes

- Store `PRIVATE_KEY` in `.env` (never commit it — `.env` is in `.gitignore`)
- Use a dedicated hot-wallet with only the funds needed for the bot
- Test with `--dry-run` before executing real transactions
- Always verify token addresses and chain IDs before running

---

## License

MIT
