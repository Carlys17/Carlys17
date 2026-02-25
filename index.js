/**
 * LI.FI Auto Swap & Bridge Bot — Entry Point
 *
 * Usage:
 *   node index.js               Run once (executes the swap/bridge)
 *   node index.js --dry-run     Preview quote without sending any transaction
 *   node index.js --auto        Run on a repeating schedule (INTERVAL_MINUTES in .env)
 */

import 'dotenv/config';
import chalk      from 'chalk';
import { LiFiBot } from './src/bot.js';

const args    = process.argv.slice(2);
const dryRun  = args.includes('--dry-run') || args.includes('-d');
const autoRun = args.includes('--auto')    || args.includes('-a');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const bot = new LiFiBot({ dryRun });

  if (autoRun) {
    const intervalMinutes = parseInt(process.env.INTERVAL_MINUTES ?? '60', 10);
    console.log(chalk.bold.yellow(`Auto mode enabled — running every ${intervalMinutes} minutes.\n`));

    let iteration = 1;
    while (true) {
      console.log(chalk.gray(`\n[${new Date().toLocaleString()}] — Execution #${iteration}\n`));
      try {
        await bot.run();
      } catch (err) {
        console.error(chalk.red(`  Run #${iteration} failed: ${err.message}`));
        console.error(chalk.gray('  Will retry on next interval.'));
      }
      iteration++;
      console.log(chalk.gray(`  Next run in ${intervalMinutes} minutes…`));
      await sleep(intervalMinutes * 60_000);
    }
  } else {
    await bot.run();
  }
}

main().catch(err => {
  // Print a clean error without a stack trace for user-facing config errors
  const isConfig = err.message.includes('not set') ||
                   err.message.includes('not configured') ||
                   err.message.includes('not a supported');

  if (isConfig) {
    console.error(chalk.red(`\n  Configuration error: ${err.message}\n`));
  } else {
    console.error(chalk.red(`\n  Fatal: ${err.message}`));
    if (err.response?.data) {
      const d = err.response.data;
      console.error(chalk.red(`  API: ${d.message ?? JSON.stringify(d)}`));
    }
  }
  process.exit(1);
});
