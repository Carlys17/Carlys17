/**
 * Configuration loader — reads .env and exposes typed config objects.
 */

import 'dotenv/config';

// ---------------------------------------------------------------------------
// Chain registry
// ---------------------------------------------------------------------------

export const CHAINS = {
  1:       { name: 'Ethereum',   rpcEnv: 'ETHEREUM_RPC',  publicRpc: 'https://eth.llamarpc.com',                  explorer: 'https://etherscan.io/tx/' },
  56:      { name: 'BSC',        rpcEnv: 'BSC_RPC',       publicRpc: 'https://bsc-dataseed1.binance.org',          explorer: 'https://bscscan.com/tx/' },
  137:     { name: 'Polygon',    rpcEnv: 'POLYGON_RPC',   publicRpc: 'https://polygon-rpc.com',                    explorer: 'https://polygonscan.com/tx/' },
  42161:   { name: 'Arbitrum',   rpcEnv: 'ARBITRUM_RPC',  publicRpc: 'https://arb1.arbitrum.io/rpc',               explorer: 'https://arbiscan.io/tx/' },
  10:      { name: 'Optimism',   rpcEnv: 'OPTIMISM_RPC',  publicRpc: 'https://mainnet.optimism.io',                explorer: 'https://optimistic.etherscan.io/tx/' },
  43114:   { name: 'Avalanche',  rpcEnv: 'AVALANCHE_RPC', publicRpc: 'https://api.avax.network/ext/bc/C/rpc',      explorer: 'https://snowtrace.io/tx/' },
  8453:    { name: 'Base',       rpcEnv: 'BASE_RPC',      publicRpc: 'https://mainnet.base.org',                   explorer: 'https://basescan.org/tx/' },
  324:     { name: 'zkSync Era', rpcEnv: 'ZKSYNC_RPC',    publicRpc: 'https://mainnet.era.zksync.io',              explorer: 'https://explorer.zksync.io/tx/' },
  534352:  { name: 'Scroll',     rpcEnv: 'SCROLL_RPC',    publicRpc: 'https://rpc.scroll.io',                      explorer: 'https://scrollscan.com/tx/' },
  59144:   { name: 'Linea',      rpcEnv: 'LINEA_RPC',     publicRpc: 'https://rpc.linea.build',                    explorer: 'https://lineascan.build/tx/' },
};

// Fallback token decimals when the API call fails
export const TOKEN_DECIMALS = {
  ETH: 18, WETH: 18, BNB: 18, WBNB: 18, MATIC: 18, WMATIC: 18,
  AVAX: 18, WAVAX: 18, OP: 18, ARB: 18, LINK: 18, UNI: 18,
  USDC: 6, 'USDC.E': 6, USDT: 6, DAI: 18, WBTC: 8, FRAX: 18,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Get the RPC URL for a chain (custom env var takes precedence over public RPC).
 *
 * @param {number} chainId
 * @returns {string}
 */
export function getRpcUrl(chainId) {
  const chain = CHAINS[chainId];
  if (!chain) throw new Error(`Chain ${chainId} is not configured. Add it to src/config.js.`);
  return process.env[chain.rpcEnv] || chain.publicRpc;
}

/**
 * Human-readable chain name.
 *
 * @param {number} chainId
 * @returns {string}
 */
export function getChainName(chainId) {
  return CHAINS[chainId]?.name ?? `Chain ${chainId}`;
}

/**
 * Block explorer URL for a transaction.
 *
 * @param {number} chainId
 * @param {string} txHash
 * @returns {string}
 */
export function getExplorerUrl(chainId, txHash) {
  const base = CHAINS[chainId]?.explorer ?? 'https://blockscan.com/tx/';
  return `${base}${txHash}`;
}

// ---------------------------------------------------------------------------
// Main config loader
// ---------------------------------------------------------------------------

/**
 * Load and validate bot configuration from environment variables.
 *
 * @returns {object} Validated config object
 */
export function getConfig() {
  const privateKey = process.env.PRIVATE_KEY?.trim();
  if (!privateKey || privateKey === 'your_private_key_here_without_0x_prefix') {
    throw new Error('PRIVATE_KEY is not set. Copy .env.example to .env and fill in your key.');
  }

  const fromChainId = parseInt(process.env.FROM_CHAIN_ID ?? '137', 10);
  const toChainId   = parseInt(process.env.TO_CHAIN_ID   ?? '42161', 10);

  if (!CHAINS[fromChainId]) throw new Error(`FROM_CHAIN_ID=${fromChainId} is not a supported chain.`);
  if (!CHAINS[toChainId])   throw new Error(`TO_CHAIN_ID=${toChainId} is not a supported chain.`);

  const fromToken  = (process.env.FROM_TOKEN ?? 'USDC').toUpperCase();
  const toToken    = (process.env.TO_TOKEN   ?? 'USDC').toUpperCase();
  const fromAmount = process.env.FROM_AMOUNT ?? '1';

  if (isNaN(parseFloat(fromAmount)) || parseFloat(fromAmount) <= 0) {
    throw new Error(`FROM_AMOUNT="${fromAmount}" is not a valid positive number.`);
  }

  const slippage         = parseFloat(process.env.SLIPPAGE ?? '0.03');
  const autoMode         = process.env.AUTO_MODE === 'true';
  const intervalMinutes  = parseInt(process.env.INTERVAL_MINUTES ?? '60', 10);

  return {
    privateKey,
    fromChainId,
    toChainId,
    fromToken,
    toToken,
    fromAmount,
    slippage,
    autoMode,
    intervalMinutes,
  };
}
