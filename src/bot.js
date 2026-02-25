/**
 * LiFiBot — core bot logic.
 *
 * Workflow:
 *   1. Load config & create wallet
 *   2. Resolve token decimals via LI.FI API
 *   3. Fetch the best quote (swap or bridge)
 *   4. Display route details
 *   5. (Unless dry-run) approve ERC-20 spend if needed, then broadcast tx
 *   6. Poll LI.FI status API until DONE / FAILED
 */

import { ethers }                                          from 'ethers';
import chalk                                               from 'chalk';
import { getQuote, getToken, getStatus }                   from './lifiApi.js';
import { createWallet, approveToken, sendTransaction,
         getBalance, isNativeToken }                       from './wallet.js';
import { getConfig, getRpcUrl, getChainName,
         getExplorerUrl, TOKEN_DECIMALS }                  from './config.js';

const POLL_INTERVAL_MS  = 15_000;   // 15 s between status polls
const MAX_WAIT_MS       = 30 * 60_000; // 30 min overall timeout

// ── helpers ─────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function fmtAmount(raw, decimals, symbol) {
  return `${parseFloat(ethers.formatUnits(raw, decimals)).toFixed(6)} ${symbol}`;
}

// ── LiFiBot class ────────────────────────────────────────────────────────────

export class LiFiBot {
  /**
   * @param {{ dryRun?: boolean }} [options]
   */
  constructor(options = {}) {
    this.config = getConfig();
    this.dryRun = options.dryRun ?? false;
    this.wallet = null;
  }

  // --------------------------------------------------------------------------
  // Initialization
  // --------------------------------------------------------------------------

  async init() {
    const rpcUrl  = getRpcUrl(this.config.fromChainId);
    this.wallet   = createWallet(this.config.privateKey, rpcUrl);
    const address = this.wallet.address;

    console.log(chalk.bold('═'.repeat(48)));
    console.log(chalk.bold.cyan('  LI.FI Auto Swap & Bridge Bot'));
    console.log(chalk.bold('═'.repeat(48)));
    console.log();
    console.log(`  Wallet : ${chalk.cyan(address)}`);
    console.log(`  From   : ${chalk.yellow(getChainName(this.config.fromChainId))} (${this.config.fromChainId})`);
    console.log(`  To     : ${chalk.yellow(getChainName(this.config.toChainId))} (${this.config.toChainId})`);
    console.log(`  Tokens : ${chalk.green(this.config.fromToken)} → ${chalk.green(this.config.toToken)}`);
    console.log(`  Amount : ${chalk.yellow(this.config.fromAmount)} ${this.config.fromToken}`);
    console.log(`  Slippage: ${chalk.yellow((this.config.slippage * 100).toFixed(1) + '%')}`);
    if (this.dryRun) console.log(chalk.magenta('\n  [DRY-RUN MODE — no transactions will be sent]'));
    console.log();
  }

  // --------------------------------------------------------------------------
  // Token resolution
  // --------------------------------------------------------------------------

  async resolveDecimals(chainId, tokenSymbol) {
    try {
      const info = await getToken(chainId, tokenSymbol);
      return info.decimals;
    } catch {
      const d = TOKEN_DECIMALS[tokenSymbol.toUpperCase()];
      if (d !== undefined) return d;
      console.warn(chalk.yellow(`  ⚠ Could not fetch decimals for ${tokenSymbol}; defaulting to 18.`));
      return 18;
    }
  }

  // --------------------------------------------------------------------------
  // Quote
  // --------------------------------------------------------------------------

  async fetchQuote() {
    process.stdout.write(chalk.yellow('  Fetching quote from LI.FI…'));

    const decimals     = await this.resolveDecimals(this.config.fromChainId, this.config.fromToken);
    const fromAmountWei = ethers.parseUnits(this.config.fromAmount, decimals).toString();

    const quote = await getQuote({
      fromChain:   this.config.fromChainId,
      toChain:     this.config.toChainId,
      fromToken:   this.config.fromToken,
      toToken:     this.config.toToken,
      fromAmount:  fromAmountWei,
      fromAddress: this.wallet.address,
      slippage:    this.config.slippage,
    });

    console.log(chalk.green(' done.'));
    return quote;
  }

  // --------------------------------------------------------------------------
  // Display quote
  // --------------------------------------------------------------------------

  printQuote(quote) {
    const { action, estimate, tool, toolDetails } = quote;
    const fromAmt    = fmtAmount(action.fromAmount, action.fromToken.decimals, action.fromToken.symbol);
    const toAmt      = fmtAmount(estimate.toAmount, action.toToken.decimals, action.toToken.symbol);
    const toAmtMin   = fmtAmount(estimate.toAmountMin, action.toToken.decimals, action.toToken.symbol);
    const rate       = (parseFloat(ethers.formatUnits(estimate.toAmount, action.toToken.decimals)) /
                        parseFloat(ethers.formatUnits(action.fromAmount, action.fromToken.decimals))).toFixed(6);

    const isBridge   = action.fromChainId !== action.toChainId;
    const routeType  = isBridge ? chalk.magenta('BRIDGE') : chalk.blue('SWAP');

    console.log();
    console.log(chalk.bold('┌─ Quote Details ' + '─'.repeat(30) + '┐'));
    console.log(`│  Type       : ${routeType}`);
    console.log(`│  Protocol   : ${chalk.cyan(toolDetails?.name ?? tool ?? 'N/A')}`);
    console.log(`│  Send       : ${chalk.yellow(fromAmt)}`);
    console.log(`│  Receive    : ${chalk.green(toAmt)}`);
    console.log(`│  Min Recv   : ${chalk.green(toAmtMin)}`);
    console.log(`│  Rate       : 1 ${action.fromToken.symbol} = ${chalk.cyan(rate)} ${action.toToken.symbol}`);

    const feesUSD = (estimate.feeCosts ?? []).reduce((s, f) => s + parseFloat(f.amountUSD ?? 0), 0);
    const gasUSD  = (estimate.gasCosts ?? []).reduce((s, g) => s + parseFloat(g.amountUSD ?? 0), 0);
    console.log(`│  Fees       : ~$${chalk.red(feesUSD.toFixed(4))}`);
    console.log(`│  Gas Cost   : ~$${chalk.red(gasUSD.toFixed(4))}`);

    if (estimate.executionDuration) {
      const mins = Math.ceil(estimate.executionDuration / 60);
      console.log(`│  Est. Time  : ${chalk.cyan(mins + ' min')}`);
    }
    console.log(chalk.bold('└' + '─'.repeat(46) + '┘'));
    console.log();
  }

  // --------------------------------------------------------------------------
  // Execute
  // --------------------------------------------------------------------------

  async executeQuote(quote) {
    const { action, estimate, transactionRequest } = quote;

    this.printQuote(quote);

    if (this.dryRun) {
      console.log(chalk.magenta('  [DRY-RUN] Skipping execution.'));
      return null;
    }

    // ERC-20 approval (skip for native tokens)
    if (!isNativeToken(action.fromToken.address) && estimate.approvalAddress) {
      await approveToken(this.wallet, action.fromToken.address, estimate.approvalAddress, action.fromAmount);
    }

    console.log(chalk.yellow('  Broadcasting transaction…'));
    const tx = await sendTransaction(this.wallet, transactionRequest);

    console.log(chalk.green(`\n  ✓ Transaction submitted!`));
    console.log(`  TX Hash  : ${chalk.cyan(tx.hash)}`);
    console.log(`  Explorer : ${chalk.underline(getExplorerUrl(this.config.fromChainId, tx.hash))}`);
    console.log();

    return tx;
  }

  // --------------------------------------------------------------------------
  // Status polling
  // --------------------------------------------------------------------------

  async waitForCompletion(txHash, tool, fromChainId, toChainId) {
    const isCrossChain = fromChainId !== toChainId;

    if (!isCrossChain) {
      console.log(chalk.yellow('  Waiting for on-chain confirmation…'));
      const receipt = await this.wallet.provider.waitForTransaction(txHash);
      if (receipt.status === 1) {
        console.log(chalk.green('  ✓ Swap confirmed on-chain!'));
      } else {
        throw new Error('Transaction reverted on-chain.');
      }
      return;
    }

    console.log(chalk.yellow('  Monitoring cross-chain status via LI.FI…'));
    console.log(chalk.gray('  (Cross-chain bridges usually take 1–30 minutes.)\n'));

    const deadline   = Date.now() + MAX_WAIT_MS;
    let   lastStatus = '';
    let   dots       = 0;

    while (Date.now() < deadline) {
      try {
        const s = await getStatus(txHash, tool, fromChainId, toChainId);

        if (s.status !== lastStatus) {
          if (dots > 0) process.stdout.write('\n');
          dots = 0;
          lastStatus = s.status;

          const icon = { PENDING: '⏳', DONE: '✅', FAILED: '❌', NOT_FOUND: '🔍' }[s.status] ?? '🔄';
          console.log(`  ${icon} Status: ${chalk.bold(s.status)}${s.substatus ? '  (' + s.substatus + ')' : ''}`);
          if (s.substatusMessage) console.log(chalk.gray(`     ${s.substatusMessage}`));
        }

        if (s.status === 'DONE') {
          process.stdout.write('\n');
          console.log(chalk.bold.green('  ✓ Cross-chain transaction completed!'));

          if (s.receiving) {
            const rcv = fmtAmount(s.receiving.amount, s.receiving.token.decimals, s.receiving.token.symbol);
            console.log(`  Received : ${chalk.green(rcv)}`);
            if (s.receiving.txHash) {
              console.log(`  Dest TX  : ${chalk.cyan(s.receiving.txHash)}`);
              console.log(`  Explorer : ${chalk.underline(getExplorerUrl(toChainId, s.receiving.txHash))}`);
            }
          }
          return s;
        }

        if (s.status === 'FAILED') {
          throw new Error(`Bridge failed: ${s.substatusMessage ?? 'unknown error'}`);
        }

      } catch (err) {
        if (err.message.startsWith('Bridge failed')) throw err;
        // Transient API error — continue polling
      }

      process.stdout.write('.');
      dots++;
      if (dots % 30 === 0) {
        const elapsed = Math.floor((Date.now() - (deadline - MAX_WAIT_MS)) / 1000);
        process.stdout.write(` ${elapsed}s\n`);
      }

      await sleep(POLL_INTERVAL_MS);
    }

    throw new Error('Timeout: transaction not confirmed within 30 minutes. Check manually.');
  }

  // --------------------------------------------------------------------------
  // Public entry-point
  // --------------------------------------------------------------------------

  async run() {
    await this.init();

    const quote = await this.fetchQuote();
    const tx    = await this.executeQuote(quote);
    if (!tx) return; // dry-run

    await this.waitForCompletion(
      tx.hash,
      quote.tool,
      this.config.fromChainId,
      this.config.toChainId,
    );

    console.log(chalk.bold.green('\n  🎉 Done!\n'));
  }
}
