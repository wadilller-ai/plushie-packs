module.exports = {
  brand: {
    siteName: "Plushie Packs",
    accent: {
      purple: "#7c3aed",
      green: "#22c55e"
    }
  },

  order: {
    prefix: "ORD",
    codeLength: 6
  },

  shipping: {
    flatFeeUsd: 15.00
  },

  // Bulk pricing tiers (auto-applies on regular items)
  bulkPricing: {
    standard_plushies: [
      { minQty: 1000, price: 8.00 },
      { minQty: 500,  price: 9.00 },
      { minQty: 100,  price: 10.50 },
      { minQty: 50,   price: 12.00 },
      { minQty: 30,   price: 13.50 },
      { minQty: 10,   price: 15.00 }
    ],
    plushie_buddies: [
      { minQty: 1000, price: 3.00 },
      { minQty: 500,  price: 3.75 },
      { minQty: 100,  price: 4.50 },
      { minQty: 50,   price: 5.00 },
      { minQty: 30,   price: 6.00 },
      { minQty: 10,   price: 7.00 }
    ]
  },

  payments: {
    methods: [
      { key: "chime", label: "Chime" },

      { key: "btc", label: "Bitcoin (BTC)", isCrypto: true, coingeckoId: "bitcoin" },
      { key: "ltc", label: "Litecoin (LTC)", isCrypto: true, coingeckoId: "litecoin" },
      { key: "eth", label: "Ethereum (ETH)", isCrypto: true, coingeckoId: "ethereum" },
      { key: "sol", label: "Solana (SOL)", isCrypto: true, coingeckoId: "solana" },
      { key: "xrp", label: "XRP", isCrypto: true, coingeckoId: "ripple" }
    ],

    manualDetails: {
      chime:   { display: "$plushiepacks" }
    },

    wallets: {
      btc: { address: "bc1qf4rg4vr92e6svftuyc3rxzskschgkxknt2g7u3" },
      ltc: { address: "LLd1xWz7FsSCqq9rM7enaqNTxB8Sr5SPwz" },
      eth: { address: "0xb4FAC811E8332092BD969C1c93148672fBadb04D" },
      sol: { address: "6pdxD2XDrcTTxF7REz1R7afJScJxhLaz9oZFcbhGA1Yk" },
      xrp: { address: "rVL42QUa8Fq2ZyW35MEfscDkpeAD1HriH" }
    }
  },

  products: [
    {
      id: "standard_plushies",
      name: "Standard Plushies",
      image: "/public/img/standard-plushies.svg",
      options: [
        { id: "sweet_dreams_og", name: "Sweet Dreams OG", price: 30.0 },
        { id: "frozen_pomegranate", name: "Frozen Pomegranate", price: 30.0 },
        { id: "habibi", name: "Habibi", price: 30.0 },
        { id: "bubblegum_burst", name: "Bubblegum Burst", price: 30.0 },
        { id: "horchata", name: "Horchata", price: 30.0 },
        { id: "dragon_berry_runtz", name: "Dragon Berry Runtz", price: 30.0 }
      ]
    },
    {
      id: "plushie_buddies",
      name: "Plushie Buddies",
      image: "/public/img/plushie-buddies.svg",
      options: [
        { id: "sour_neon_rings", name: "Sour Neon Rings", price: 10.0 },
        { id: "sour_gummy_bears", name: "Sour Gummy Bears", price: 10.0 },
        { id: "sour_gummy_worms", name: "Sour Gummy Worms", price: 10.0 },
        { id: "peach_rings", name: "Peach Rings", price: 10.0 },
        { id: "neon_gummy_bears", name: "Neon Gummy Bears", price: 10.0 }
      ]
    },

    // Bulk products as separate selectable items (tier is an option; min qty enforced)
    {
      id: "standard_plushies_bulk",
      name: "Standard Plushies (Bulk)",
      image: "/public/img/standard-plushies.svg",
      options: [
        { id: "tier_10",   name: "10+ — $15 each",    price: 15.00, minQty: 10 },
        { id: "tier_30",   name: "30+ — $13.50 each", price: 13.50, minQty: 30 },
        { id: "tier_50",   name: "50+ — $12 each",    price: 12.00, minQty: 50 },
        { id: "tier_100",  name: "100+ — $10.50 each",price: 10.50, minQty: 100 },
        { id: "tier_500",  name: "500+ — $9 each",    price: 9.00,  minQty: 500 },
        { id: "tier_1000", name: "1000+ — $8 each",   price: 8.00,  minQty: 1000 }
      ]
    },
    {
      id: "plushie_buddies_bulk",
      name: "Plushie Buddies (Bulk)",
      image: "/public/img/plushie-buddies.svg",
      options: [
        { id: "tier_10",   name: "10+ — $7 each",      price: 7.00,  minQty: 10 },
        { id: "tier_30",   name: "30+ — $6 each",      price: 6.00,  minQty: 30 },
        { id: "tier_50",   name: "50+ — $5 each",      price: 5.00,  minQty: 50 },
        { id: "tier_100",  name: "100+ — $4.50 each",  price: 4.50,  minQty: 100 },
        { id: "tier_500",  name: "500+ — $3.75 each",  price: 3.75,  minQty: 500 },
        { id: "tier_1000", name: "1000+ — $3 each",    price: 3.00,  minQty: 1000 }
      ]
    },

    {
      id: "premium_plushies",
      name: "Premium Plushies",
      image: "/public/img/premium-plushies.svg",
      options: [
        { id: "granddaddy_purple", name: "Granddaddy Purple 3.5g", price: 30.0 },
        { id: "gumbo", name: "Gumbo 3.5g", price: 30.0 },
        { id: "white_runtz", name: "White Runtz 3.5g", price: 25.0 },
        { id: "black_truffle", name: "Black Truffle 3.5g", price: 25.0 }
      ]
    },
    {
      id: "designer_line",
      name: "Designer Line",
      image: "/public/img/designer-line.svg",
      options: [
        { id: "blue_magic", name: "Blue Magic 3.5g", price: 90.0 },
        { id: "kryptochronic", name: "KryptoChronic 3.5g", price: 65.0 },
        { id: "biskante", name: "Biskanté 3.5g", price: 65.0 },
        { id: "atomic_apple", name: "Atomic Apple 3.5g", price: 65.0 },
        { id: "ghost_og", name: "Ghost OG 3.5g", price: 65.0 },
        { id: "tropical_z", name: "Tropical Z 3.5g", price: 65.0 }
      ]
    }
  ]
};
