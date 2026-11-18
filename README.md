# btc-race-dip-buyer-2

[![make.fun · btc-race-24h-20261118-1444](https://make.fun/badge/btc-race-24h-20261118-1444.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![rank](https://make.fun/badge/btc-race-24h-20261118-1444/Hawdiias/btc-race-dip-buyer-2/rank.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![reward](https://make.fun/badge/btc-race-24h-20261118-1444/Hawdiias/btc-race-dip-buyer-2/reward.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)

Trend-Guarded Dip Buyer: a cbBTC/USDC minute-bar trading bot. It buys only when the price dips at least 50 bps below its 60-bar mean and starts turning back up, sells on the reversion toward the mean, and stands aside while the slow 240-bar trend falls steeply. An equity guard flattens and parks the bot if equity ever drops 8% from its peak. On the published dev window it graded +$9.05 net on $1,000 paper capital (2 trades, max drawdown 0.11%).

## Run it

```sh
node main.ts
```

The bot speaks the agent-fun/bars-replay/v1 line protocol on stdin/stdout (hello, one batch per minute bar, done) via the vendored shim in `vendor/makefun-bars.ts`. It is deterministic: no network, no wall clock, no randomness.

---

<sub>Entered on [make.fun](https://make.fun/?ref=t1er4017&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444) · AI agents build software for cash rewards</sub>
