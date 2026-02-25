/**
 * LI.FI API wrapper
 * Docs: https://apidocs.li.fi/
 */

import axios from 'axios';

const BASE_URL = 'https://li.quest/v1';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

/**
 * Get a swap/bridge quote from LI.FI.
 * Returns a single best-route quote with a ready-to-sign transactionRequest.
 *
 * @param {object} params
 * @param {number|string} params.fromChain   - Source chain ID
 * @param {number|string} params.toChain     - Destination chain ID
 * @param {string}        params.fromToken   - Source token symbol or address
 * @param {string}        params.toToken     - Destination token symbol or address
 * @param {string}        params.fromAmount  - Amount in smallest unit (wei / 10^decimals)
 * @param {string}        params.fromAddress - Sender wallet address
 * @param {number}        [params.slippage]  - Slippage tolerance (default 0.03 = 3%)
 * @returns {Promise<object>} LI.FI quote object
 */
export async function getQuote({ fromChain, toChain, fromToken, toToken, fromAmount, fromAddress, slippage = 0.03 }) {
  const { data } = await api.get('/quote', {
    params: { fromChain, toChain, fromToken, toToken, fromAmount, fromAddress, slippage },
  });
  return data;
}

/**
 * Get detailed information for a token on a specific chain.
 *
 * @param {number|string} chain - Chain ID
 * @param {string}        token - Token symbol or address
 * @returns {Promise<object>} Token info including decimals, address, etc.
 */
export async function getToken(chain, token) {
  const { data } = await api.get('/token', { params: { chain, token } });
  return data;
}

/**
 * Poll the status of a submitted swap or bridge transaction.
 *
 * @param {string}        txHash    - Transaction hash on the source chain
 * @param {string}        [bridge]  - Bridge/tool name returned by the quote (e.g. "stargate")
 * @param {number|string} [fromChain] - Source chain ID
 * @param {number|string} [toChain]   - Destination chain ID
 * @returns {Promise<object>} Status object: { status, substatus, substatusMessage, sending, receiving }
 */
export async function getStatus(txHash, bridge, fromChain, toChain) {
  const params = { txHash };
  if (bridge)    params.bridge    = bridge;
  if (fromChain) params.fromChain = fromChain;
  if (toChain)   params.toChain   = toChain;

  const { data } = await api.get('/status', { params });
  return data;
}

/**
 * Get a list of all chains supported by LI.FI.
 *
 * @returns {Promise<object[]>} Array of chain objects
 */
export async function getChains() {
  const { data } = await api.get('/chains');
  return data.chains;
}

/**
 * Get available tokens for a given chain.
 *
 * @param {number|string} chainId - Chain ID
 * @returns {Promise<object[]>} Array of token objects
 */
export async function getTokensByChain(chainId) {
  const { data } = await api.get('/tokens', { params: { chains: chainId } });
  return data.tokens?.[chainId] ?? [];
}
