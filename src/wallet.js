/**
 * Wallet utilities: create wallet, ERC-20 approval, send transaction.
 */

import { ethers } from 'ethers';

const NATIVE_ADDRESSES = new Set([
  '0x0000000000000000000000000000000000000000',
  '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
]);

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
];

/**
 * Returns true if the token address represents a native coin (ETH, MATIC, BNB…).
 */
export function isNativeToken(address) {
  return NATIVE_ADDRESSES.has(address?.toLowerCase());
}

/**
 * Create an ethers Wallet connected to the given RPC URL.
 *
 * @param {string} privateKey - Hex private key (with or without 0x prefix)
 * @param {string} rpcUrl     - JSON-RPC provider URL
 * @returns {ethers.Wallet}
 */
export function createWallet(privateKey, rpcUrl) {
  const key = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  return new ethers.Wallet(key, provider);
}

/**
 * Approve an ERC-20 token for spending by a spender (e.g. LI.FI router).
 * Skips approval if the token is native or if allowance is already sufficient.
 *
 * @param {ethers.Wallet} wallet        - Connected signer wallet
 * @param {string}        tokenAddress  - ERC-20 contract address
 * @param {string}        spender       - Address to approve (LI.FI approval address)
 * @param {string|bigint} amountNeeded  - Amount in wei that needs to be approved
 * @returns {Promise<ethers.TransactionReceipt|null>} Receipt or null if already approved / native
 */
export async function approveToken(wallet, tokenAddress, spender, amountNeeded) {
  if (isNativeToken(tokenAddress)) return null;

  const token = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);

  const allowance = await token.allowance(wallet.address, spender);
  if (BigInt(allowance) >= BigInt(amountNeeded)) {
    console.log('  ✓ Token allowance already sufficient — skipping approval.');
    return null;
  }

  console.log('  Approving token spend (max allowance)…');
  const tx = await token.approve(spender, ethers.MaxUint256);
  console.log(`  Approval tx: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log('  ✓ Approval confirmed.');
  return receipt;
}

/**
 * Sign and broadcast the transaction request returned by LI.FI quote.
 *
 * @param {ethers.Wallet} wallet    - Connected signer wallet
 * @param {object}        txRequest - transactionRequest from LI.FI quote
 * @returns {Promise<ethers.TransactionResponse>}
 */
export async function sendTransaction(wallet, txRequest) {
  const tx = {
    to:    txRequest.to,
    data:  txRequest.data,
    value: txRequest.value ? BigInt(txRequest.value) : 0n,
  };

  if (txRequest.gasLimit)              tx.gasLimit             = BigInt(txRequest.gasLimit);
  if (txRequest.gasPrice)              tx.gasPrice             = BigInt(txRequest.gasPrice);
  if (txRequest.maxFeePerGas)          tx.maxFeePerGas         = BigInt(txRequest.maxFeePerGas);
  if (txRequest.maxPriorityFeePerGas)  tx.maxPriorityFeePerGas = BigInt(txRequest.maxPriorityFeePerGas);

  return wallet.sendTransaction(tx);
}

/**
 * Fetch the on-chain balance of a token for the wallet.
 *
 * @param {ethers.Wallet} wallet       - Connected signer wallet
 * @param {string}        tokenAddress - ERC-20 address or native address
 * @returns {Promise<bigint>} Balance in wei
 */
export async function getBalance(wallet, tokenAddress) {
  if (isNativeToken(tokenAddress)) {
    return wallet.provider.getBalance(wallet.address);
  }
  const token = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);
  return token.balanceOf(wallet.address);
}
