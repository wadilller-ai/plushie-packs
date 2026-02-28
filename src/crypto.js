const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

async function getUsdPrice(coingeckoId) {
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(coingeckoId)}&vs_currencies=usd`;
  const res = await fetch(url, { headers: { "accept": "application/json" } });
  if (!res.ok) throw new Error(`CoinGecko error: ${res.status}`);
  const json = await res.json();
  const usd = json?.[coingeckoId]?.usd;
  if (!usd || typeof usd !== "number") throw new Error("Invalid price response");
  return usd;
}

function toCoinAmount(usdTotal, usdPrice) {
  if (!usdPrice || usdPrice <= 0) return null;
  return Number((usdTotal / usdPrice).toFixed(8));
}

module.exports = { getUsdPrice, toCoinAmount };
