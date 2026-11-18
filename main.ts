// Trend-Guarded Dip Buyer — cbBTC/USDC minute-bar bot for the make.fun 24h race.
//
// Idea: cbBTC spends most of a day chopping around a slow mean, and the moves
// worth paying fees for are the sharp dips below that mean that start to turn
// back up. A full round trip costs roughly 26 bps in fees, slippage and pool
// impact, so this bot only acts when the dip is at least 50 bps under its
// 60-bar mean and the last few bars show the fall has paused. It then rides
// the reversion back toward the mean and gets out — it never chases strength
// and never holds through the whole window hoping.
//
// Exits: reversion to within 20 bps of the mean, a 600-bar time stop, or a
// 300 bps disaster stop from the position's average cost. Position size is
// 90% of the cash on hand, capped by the harness weight room, so one good
// reversion matters but a single bad fill cannot sink the account.
//
// Two guards keep the live race window from hurting more than the dev
// window could: a slow-trend filter refuses to catch a dip while the
// 240-bar mean is falling steeply (a falling knife, not a reversion),
// unless the dip is panic-deep; and an equity guard flattens and parks
// the bot for the rest of the run if equity ever falls 8% under its peak,
// far inside the race's 25% drawdown bar.

import { runBars } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
const MEAN_BARS = 60; // bars in the mean the price reverts to
const DIP_BPS = 50; // how far below the mean a buy needs (bps)
const EXIT_DEV_BPS = -20; // sell once the price is this close to the mean
const TURN_BARS = 3; // close must be above the close this many bars back
const TIME_STOP_BARS = 600; // give up on a position after this long
const STOP_BPS = 300; // disaster stop from average cost (bps)
const BUY_FRACTION = 90n; // percent of cash put into one position
const SLIPPAGE_BPS = 250; // max move from the latest close we accept on a fill
const SLOW_BARS = 240; // bars in the slow mean behind the trend filter
const SLOW_LAG = 60; // bars back the slow mean's slope is measured over
const TREND_BLOCK_BPS = -35; // slow slope at or under this blocks shallow dips
const PANIC_BPS = 90; // a dip this deep is bought even in a steep downtrend
const EQUITY_GUARD = 0.92; // flatten + park if equity falls under this x peak

let barsSeen = 0;
let mean = 0; // EMA of closes over MEAN_BARS, in raw price units
let slowMean = 0; // EMA of closes over SLOW_BARS, in raw price units
let slowTrail: number[] = []; // slow mean values, newest last, SLOW_LAG + 1 kept
let prevCloses: number[] = []; // last TURN_BARS + 1 closes, raw price units
let entryBar = -1; // barsSeen when the current position was opened
let peakEquity = 0; // highest equity seen so far, quote units
let parked = false; // true once the equity guard has fired

function deviationBps(close: number): number {
  return ((close / mean) - 1) * 10_000;
}

await runBars({
  onBatch(state) {
    const closeBig = state.close(SYMBOL);
    if (closeBig === null) return [];
    const close = Number(closeBig);
    barsSeen += 1;

    // Fold this close into the running means and the short close history.
    if (barsSeen === 1) {
      mean = close;
      slowMean = close;
    } else {
      mean += (2 / (MEAN_BARS + 1)) * (close - mean);
      slowMean += (2 / (SLOW_BARS + 1)) * (close - slowMean);
    }
    slowTrail.push(slowMean);
    if (slowTrail.length > SLOW_LAG + 1) slowTrail.shift();
    prevCloses.push(close);
    if (prevCloses.length > TURN_BARS + 1) prevCloses.shift();

    if (state.warmingUp) return [];
    const position = state.positions.get(SYMBOL);
    const heldQty = position?.qty ?? 0n;

    // Equity guard: track the peak; a deep fall from it flattens any
    // position and parks the bot, whatever the dip logic thinks.
    const equityNow = Number(state.equity);
    if (equityNow > peakEquity) peakEquity = equityNow;
    if (!parked && peakEquity > 0 && equityNow < peakEquity * EQUITY_GUARD) parked = true;
    if (parked) {
      if (heldQty > 0n) {
        return [{ side: 'sell', symbol: SYMBOL, qty: heldQty, max_slippage_bps: SLIPPAGE_BPS }];
      }
      return [];
    }

    if (heldQty > 0n) {
      // Manage the open position: reversion, time stop, or disaster stop.
      const cost = Number(position!.cost);
      const valueNow = Number(state.value(SYMBOL, heldQty));
      const gainBps = cost > 0 ? ((valueNow / cost) - 1) * 10_000 : 0;
      const heldBars = entryBar >= 0 ? barsSeen - entryBar : 0;
      const reverted = barsSeen > MEAN_BARS && deviationBps(close) >= EXIT_DEV_BPS;
      if (reverted || heldBars >= TIME_STOP_BARS || gainBps <= -STOP_BPS) {
        return [{ side: 'sell', symbol: SYMBOL, qty: heldQty, max_slippage_bps: SLIPPAGE_BPS }];
      }
      return [];
    }

    // Flat: wait for a deep enough dip that has started to turn back up.
    if (barsSeen <= MEAN_BARS + 5) return [];
    if (prevCloses.length < TURN_BARS + 1) return [];
    const turnedUp = close > prevCloses[0]!;
    if (!turnedUp) return [];
    const dev = deviationBps(close);
    if (dev > -DIP_BPS) return [];

    // Trend filter: with enough slow history, a steeply falling slow mean
    // means this dip is a knife, not a reversion — stand aside unless the
    // dip is panic-deep, where the snap-back odds finally pay for the risk.
    if (barsSeen > SLOW_BARS + SLOW_LAG && slowTrail.length > SLOW_LAG) {
      const slopeBps = ((slowMean / slowTrail[0]!) - 1) * 10_000;
      if (slopeBps <= TREND_BLOCK_BPS && dev > -PANIC_BPS) return [];
    }

    let spend = (state.cash * BUY_FRACTION) / 100n;
    const room = state.weightRoom(SYMBOL);
    if (spend > room) spend = room;
    if (spend <= 0n || spend < BigInt(state.hello.fees.min_notional_quote_units)) return [];
    entryBar = barsSeen;
    return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: spend, max_slippage_bps: SLIPPAGE_BPS }];
  },
});
