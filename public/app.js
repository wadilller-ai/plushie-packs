(function () {
  const CART_KEY = 'plushiepacks_cart_v1';

  const PRODUCTS = {
    standard_plushies: {
      name: 'Standard Plushies',
      image: './public/img/standard-plushies.svg',
      options: {
        sweet_dreams_og: { name: 'Sweet Dreams OG', price: 30 },
        frozen_pomegranate: { name: 'Frozen Pomegranate', price: 30 },
        habibi: { name: 'Habibi', price: 30 },
        bubblegum_burst: { name: 'Bubblegum Burst', price: 30 },
        horchata: { name: 'Horchata', price: 30 },
        dragon_berry_runtz: { name: 'Dragon Berry Runtz', price: 30 }
      }
    },
    plushie_buddies: {
      name: 'Plushie Buddies',
      image: './public/img/plushie-buddies.svg',
      options: {
        sour_neon_rings: { name: 'Sour Neon Rings', price: 10 },
        sour_gummy_bears: { name: 'Sour Gummy Bears', price: 10 },
        sour_gummy_worms: { name: 'Sour Gummy Worms', price: 10 },
        peach_rings: { name: 'Peach Rings', price: 10 },
        neon_gummy_bears: { name: 'Neon Gummy Bears', price: 10 }
      }
    },
    premium_plushies: {
      name: 'Premium Plushies',
      image: './public/img/premium-plushies.svg',
      options: {
        granddaddy_purple: { name: 'Granddaddy Purple 3.5g', price: 30 },
        gumbo: { name: 'Gumbo 3.5g', price: 30 },
        white_runtz: { name: 'White Runtz 3.5g', price: 25 },
        black_truffle: { name: 'Black Truffle 3.5g', price: 25 }
      }
    },
    designer_line: {
      name: 'Designer Line',
      image: './public/img/designer-line.svg',
      options: {
        blue_magic: { name: 'Blue Magic 3.5g', price: 90 },
        kryptochronic: { name: 'KryptoChronic 3.5g', price: 65 },
        biskante: { name: 'Biskanté 3.5g', price: 65 },
        atomic_apple: { name: 'Atomic Apple 3.5g', price: 65 },
        ghost_og: { name: 'Ghost OG 3.5g', price: 65 },
        tropical_z: { name: 'Tropical Z 3.5g', price: 65 }
      }
    },
    standard_plushies_bulk: {
      name: 'Standard Plushies (Bulk)',
      image: './public/img/standard-plushies.svg',
      options: {
        tier_10: { name: '10+ — $15 each', price: 15, minQty: 10 },
        tier_30: { name: '30+ — $13.50 each', price: 13.5, minQty: 30 },
        tier_50: { name: '50+ — $12 each', price: 12, minQty: 50 },
        tier_100: { name: '100+ — $10.50 each', price: 10.5, minQty: 100 },
        tier_500: { name: '500+ — $9 each', price: 9, minQty: 500 },
        tier_1000: { name: '1000+ — $8 each', price: 8, minQty: 1000 }
      }
    },
    plushie_buddies_bulk: {
      name: 'Plushie Buddies (Bulk)',
      image: './public/img/plushie-buddies.svg',
      options: {
        tier_10: { name: '10+ — $7 each', price: 7, minQty: 10 },
        tier_30: { name: '30+ — $6 each', price: 6, minQty: 30 },
        tier_50: { name: '50+ — $5 each', price: 5, minQty: 50 },
        tier_100: { name: '100+ — $4.50 each', price: 4.5, minQty: 100 },
        tier_500: { name: '500+ — $3.75 each', price: 3.75, minQty: 500 },
        tier_1000: { name: '1000+ — $3 each', price: 3, minQty: 1000 }
      }
    }
  };

  function getCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); }
    catch (_) { return []; }
  }

  function setCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    updateBadges();
  }

  function addToCart(productId, optionId, qty) {
    const product = PRODUCTS[productId];
    const option = product && product.options[optionId];
    if (!product || !option) return;
    const amount = Math.max(option.minQty || 1, Number(qty || 1));
    const cart = getCart();
    const existing = cart.find((i) => i.productId === productId && i.optionId === optionId);
    if (existing) existing.qty += amount;
    else cart.push({ productId, optionId, qty: amount });
    setCart(cart);
  }

  function cartCount() {
    return getCart().reduce((n, i) => n + Number(i.qty || 0), 0);
  }

  function updateBadges() {
    document.querySelectorAll('.badge').forEach((el) => { el.textContent = String(cartCount()); });
  }

  function lineFor(item) {
    const p = PRODUCTS[item.productId];
    const o = p && p.options[item.optionId];
    if (!p || !o) return null;
    const qty = Number(item.qty || 1);
    const total = qty * Number(o.price || 0);
    return { p, o, qty, total };
  }

  function renderCart() {
    const host = document.getElementById('cartRows');
    if (!host) return;
    const cart = getCart();
    host.innerHTML = '';
    let subtotal = 0;

    cart.forEach((item, index) => {
      const line = lineFor(item);
      if (!line) return;
      subtotal += line.total;
      const row = document.createElement('div');
      row.className = 'cartRow';
      row.innerHTML = `
        <div><b>${line.p.name}</b><div class="small muted">${line.o.name}</div></div>
        <div>$${line.o.price.toFixed(2)}</div>
        <div>
          <input class="qtyInput" type="number" min="1" value="${line.qty}" data-qty-index="${index}" />
        </div>
        <div><b>$${line.total.toFixed(2)}</b></div>
        <div><button class="btn btn-small" data-remove-index="${index}" type="button">✕</button></div>
      `;
      host.appendChild(row);
    });

    const shipping = cart.length ? 15 : 0;
    document.getElementById('cartSubtotal').textContent = `$${subtotal.toFixed(2)}`;
    document.getElementById('cartShipping').textContent = `$${shipping.toFixed(2)}`;
    document.getElementById('cartTotal').textContent = `$${(subtotal + shipping).toFixed(2)}`;

    host.querySelectorAll('[data-remove-index]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const cartNow = getCart();
        cartNow.splice(Number(btn.dataset.removeIndex), 1);
        setCart(cartNow);
        renderCart();
      });
    });

    host.querySelectorAll('[data-qty-index]').forEach((input) => {
      input.addEventListener('change', () => {
        const cartNow = getCart();
        cartNow[Number(input.dataset.qtyIndex)].qty = Math.max(1, Number(input.value || 1));
        setCart(cartNow);
        renderCart();
      });
    });
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-add]');
    if (!btn) return;
    const form = btn.closest('form');
    if (!form) return;
    e.preventDefault();
    const productId = form.dataset.product;
    const optionEl = form.querySelector('select[name="option"]');
    const qtyEl = form.querySelector('input[name="qty"]');
    addToCart(productId, optionEl?.value, qtyEl?.value || 1);
    btn.textContent = 'Added ✓';
    setTimeout(() => (btn.textContent = 'Add to Cart'), 900);
  });

  document.addEventListener('DOMContentLoaded', () => {
    updateBadges();
    renderCart();
  });
})();
