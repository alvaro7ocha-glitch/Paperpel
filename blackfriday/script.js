const products = {
  porta: { old: 31, price: 25, pack: 1, singular: 'porta-retrato 15×20 com foto', plural: 'porta-retratos 15×20 com foto' },
  polaroids: { old: 24, price: 20, pack: 12, singular: '12 Polaroids padrão', plural: 'Polaroids padrão' },
  fotos: { old: 100, price: 80, pack: 50, singular: '50 fotos 10×15 cm', plural: 'fotos 10×15 cm' },
  adesivos4: { old: 350, price: 196, pack: 500, singular: '500 adesivos vinil fosco 4 cm, meio-corte', plural: 'adesivos vinil fosco 4 cm, meio-corte' },
  adesivos5: { old: 280, price: 158, pack: 250, singular: '250 adesivos vinil fosco 5 cm, meio-corte', plural: 'adesivos vinil fosco 5 cm, meio-corte' },
  banner: { old: 154, price: 99, pack: 1, singular: 'banner 120 × 80 cm', plural: 'banners 120 × 80 cm' }
};
const cart = {};
const money = value => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const cartItems = document.getElementById('cart-items');
const cartCount = document.getElementById('cart-count');
const originalTotal = document.getElementById('original-total');
const savingsTotal = document.getElementById('savings-total');
const promoTotal = document.getElementById('promo-total');
const goPayment = document.getElementById('go-payment');
const sendWhatsapp = document.getElementById('send-whatsapp');
const paymentSection = document.getElementById('pagamento');
paymentSection.hidden = true;

function itemLabel(id, qty) {
  const p = products[id];
  const total = p.pack * qty;
  if (id === 'porta') return `${qty} ${qty === 1 ? 'porta-retrato' : 'porta-retratos'} 15×20 com foto`;
  if (id === 'banner') return `${qty} ${qty === 1 ? 'banner' : 'banners'} 120 × 80 cm`;
  if (id === 'polaroids') return `${total.toLocaleString('pt-BR')} Polaroids padrão`;
  if (id === 'fotos') return `${total.toLocaleString('pt-BR')} fotos 10×15 cm`;
  if (id === 'adesivos4') return `${total.toLocaleString('pt-BR')} adesivos vinil fosco 4 cm, meio-corte`;
  if (id === 'adesivos5') return `${total.toLocaleString('pt-BR')} adesivos vinil fosco 5 cm, meio-corte`;
  return p.singular;
}
function totals() {
  return Object.entries(cart).reduce((sum, [id, qty]) => {
    sum.old += products[id].old * qty;
    sum.promo += products[id].price * qty;
    sum.count += qty;
    return sum;
  }, { old: 0, promo: 0, count: 0 });
}
function syncProductButtons() {
  document.querySelectorAll('[data-add]').forEach(button => {
    const selected = (cart[button.dataset.add] || 0) > 0;
    button.classList.toggle('is-added', selected);
    button.setAttribute('aria-pressed', String(selected));
    button.innerHTML = selected ? 'Adicionado ao pedido <span>✓</span>' : 'Adicionar ao pedido <span>+</span>';
    const cardTitle = button.closest('.product-info')?.querySelector('h2');
    if (cardTitle) cardTitle.textContent = itemLabel(button.dataset.add, cart[button.dataset.add] || 1);
  });
}
function renderCart() {
  const entries = Object.entries(cart).filter(([, qty]) => qty > 0);
  const t = totals();
  cartCount.textContent = t.count;
  originalTotal.textContent = money(t.old);
  savingsTotal.textContent = money(t.old - t.promo);
  promoTotal.textContent = money(t.promo);
  goPayment.disabled = t.count === 0;
  sendWhatsapp.disabled = t.count === 0;
  if (!entries.length) {
    cartItems.innerHTML = '<p class="empty-cart">Seu carrinho está vazio. Adicione uma oferta para começar!</p>';
  } else {
    cartItems.innerHTML = entries.map(([id, qty]) => `<div class="cart-row"><div><div class="cart-product-name">${itemLabel(id, qty)}</div><div class="cart-unit">${money(products[id].price)} por pacote promocional</div></div><div class="quantity"><button type="button" data-change="${id}" data-delta="-1" aria-label="Diminuir quantidade">−</button><span>${qty}</span><button type="button" data-change="${id}" data-delta="1" aria-label="Aumentar quantidade">+</button></div><strong class="row-price">${money(products[id].price * qty)}</strong></div>`).join('');
  }
  syncProductButtons();
}
document.querySelectorAll('[data-add]').forEach(button => button.addEventListener('click', () => {
  const id = button.dataset.add;
  if (cart[id]) delete cart[id];
  else cart[id] = 1;
  renderCart();
}));
cartItems.addEventListener('click', event => {
  const button = event.target.closest('[data-change]');
  if (!button) return;
  const id = button.dataset.change;
  cart[id] = (cart[id] || 0) + Number(button.dataset.delta);
  if (cart[id] <= 0) delete cart[id];
  renderCart();
});
document.getElementById('clear-cart').addEventListener('click', () => {
  Object.keys(cart).forEach(id => delete cart[id]);
  renderCart();
});
goPayment.addEventListener('click', () => {
  paymentSection.hidden = false;
  requestAnimationFrame(() => paymentSection.scrollIntoView({ behavior: 'smooth', block: 'start' }));
});
document.getElementById('copy-pix').addEventListener('click', async () => {
  const feedback = document.getElementById('copy-feedback');
  try {
    await navigator.clipboard.writeText('+5531985268205');
    feedback.textContent = 'Chave PIX copiada!';
  } catch {
    feedback.textContent = 'Copie manualmente: +55 31 98526-8205';
  }
});
function orderMessage() {
  const t = totals();
  const lines = Object.entries(cart).filter(([, qty]) => qty > 0).map(([id, qty]) => `• ${itemLabel(id, qty)} — ${money(products[id].price * qty)}`);
  const customerName = document.getElementById('customer-name')?.value.trim() || '';
  const savingsPercent = t.old > 0 ? ((t.old - t.promo) / t.old) * 100 : 0;
  const formattedPercent = savingsPercent.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const boldLines = lines.map(line => line.replace(/^• (.*?) — (.*)$/, '• *$1*'));
  return `Olá! me chamo ${customerName}.\nQuero finalizar meu pedido da\n*Black Friday da Paperpel*.\n\n${boldLines.join('\n')}\nTotal promocional: *${money(t.promo)}*\nEconomia de *${formattedPercent}%*\n\nVou enviar o comprovante do PIX por aqui.`;
}
sendWhatsapp.addEventListener('click', () => {
  if (!totals().count) return;
  const url = `https://wa.me/5531985268205?text=${encodeURIComponent(orderMessage())}`;
  window.open(url, '_blank', 'noopener,noreferrer');
});
function launchConfetti() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const layer = document.getElementById('confetti-layer');
  const colors = ['#087bd7', '#13a8ed', '#ffd400', '#ff9f1c', '#ffffff'];
  for (let i = 0; i < 54; i++) {
    const piece = document.createElement('i');
    piece.className = 'confetti';
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[i % colors.length];
    piece.style.setProperty('--fall-time', `${3.4 + Math.random() * 1.8}s`);
    piece.style.setProperty('--drift', `${Math.round(Math.random() * 180 - 90)}px`);
    piece.style.setProperty('--rotation', `${Math.round(Math.random() * 180)}deg`);
    piece.style.setProperty('--spin', `${Math.round(Math.random() * 900 + 360)}deg`);
    piece.style.animationDelay = `${Math.random() * .8}s`;
    layer.appendChild(piece);
  }
  window.setTimeout(() => layer.replaceChildren(), 5900);
}
document.getElementById('year').textContent = new Date().getFullYear();
renderCart();
const nameInput = document.getElementById('customer-name');
const revealButton = document.getElementById('reveal-offers');
nameInput.addEventListener('input', () => {
  revealButton.disabled = nameInput.value.trim().length < 2;
});
revealButton.addEventListener('click', () => {
  if (nameInput.value.trim().length < 2) return;
  document.getElementById('welcome-gate').hidden = true;
  document.getElementById('site-content').hidden = false;
  const entranceSound = new Audio('assets/verOfertas.mp3');
  entranceSound.volume = 0.85;
  entranceSound.play().catch(() => {});
  launchConfetti();
  window.scrollTo({ top: 0, behavior: 'instant' });
});
