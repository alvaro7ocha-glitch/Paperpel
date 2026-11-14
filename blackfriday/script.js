const products = {
  'porta-retrato': { name: 'Porta-retrato 15×20 com foto', old: 31, price: 25 },
  polaroids: { name: '12 Polaroids padrão', old: 24, price: 20 },
  fotos: { name: '50 fotos 10×15 cm', old: 100, price: 80 },
  adesivos4: { name: '500 adesivos vinil fosco 4 cm', old: 350, price: 196 },
  adesivos5: { name: '250 adesivos vinil fosco 5 cm', old: 280, price: 158 },
  banner: { name: 'Banner 120 × 80 cm', old: 154, price: 99 }
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

function totals() {
  return Object.entries(cart).reduce((sum, [id, qty]) => {
    sum.old += products[id].old * qty;
    sum.promo += products[id].price * qty;
    sum.count += qty;
    return sum;
  }, { old: 0, promo: 0, count: 0 });
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
    return;
  }
  cartItems.innerHTML = entries.map(([id, qty]) => `<div class="cart-row"><div><div class="cart-product-name">${products[id].name}</div><div class="cart-unit">${money(products[id].price)} por unidade promocional</div></div><div class="quantity"><button type="button" data-change="${id}" data-delta="-1" aria-label="Diminuir quantidade">−</button><span>${qty}</span><button type="button" data-change="${id}" data-delta="1" aria-label="Aumentar quantidade">+</button></div><strong class="row-price">${money(products[id].price * qty)}</strong></div>`).join('');
}
document.querySelectorAll('[data-add]').forEach(button => button.addEventListener('click', () => {
  const id = button.dataset.add;
  cart[id] = (cart[id] || 0) + 1;
  renderCart();
  button.innerHTML = 'Adicionado! <span>✓</span>';
  setTimeout(() => { button.innerHTML = 'Adicionar ao pedido <span>+</span>'; }, 900);
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
goPayment.addEventListener('click', () => document.getElementById('pagamento').scrollIntoView({ behavior: 'smooth' }));
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
  const lines = Object.entries(cart).filter(([, qty]) => qty > 0).map(([id, qty]) => `• ${qty}x ${products[id].name} — ${money(products[id].price * qty)}`);
  return `Olá, Paperpel! Quero finalizar meu pedido da Black Friday:\n\n${lines.join('\n')}\n\nTotal promocional: ${money(t.promo)}\nEconomia: ${money(t.old - t.promo)}\n\nVou realizar o PIX e enviar o comprovante por aqui.\nNome: `;
}
sendWhatsapp.addEventListener('click', () => {
  if (!totals().count) return;
  const url = `https://wa.me/5531985268205?text=${encodeURIComponent(orderMessage())}`;
  window.open(url, '_blank', 'noopener,noreferrer');
});
document.getElementById('year').textContent = new Date().getFullYear();
renderCart();
