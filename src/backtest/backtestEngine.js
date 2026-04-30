function calculatePanicScore(d) {
  let score = 50;

  if (d.vix > 30) score += 25;
  else if (d.vix > 25) score += 15;

  if (d.hy > 4.5) score += 20;
  if (d.sentiment < 30) score += 15;

  return Math.min(100, score);
}

function getSignal(score) {
  if (score >= 70) return "BUY";
  if (score <= 35) return "SELL";
  return "HOLD";
}

export function runBacktest(data) {
  let cash = 10000000;
  let position = 0;
  let entryPrice = 0;
  const trades = [];

  for (let i = 0; i < data.length; i += 1) {
    const d = data[i];
    const score = calculatePanicScore(d);
    const signal = getSignal(score);

    if (signal === "BUY" && position === 0) {
      position = cash / d.price;
      entryPrice = d.price;
      cash = 0;
      trades.push({
        type: "BUY",
        date: d.date,
        price: d.price,
        score,
      });
    }

    if (signal === "SELL" && position > 0) {
      cash = position * d.price;
      trades.push({
        type: "SELL",
        date: d.date,
        price: d.price,
        score,
        return: (((d.price - entryPrice) / entryPrice) * 100).toFixed(2),
      });
      position = 0;
      entryPrice = 0;
    }
  }

  const lastPrice = data.length ? data[data.length - 1].price : 0;
  const finalValue = cash + position * lastPrice;

  return { finalValue, trades };
}
