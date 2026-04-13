import { supabase } from './supabaseClient.js';

// ─── ÉTAT ───
let currentUser = null;
let cart = [];
let taxRate = 20;
let taxEnabled = false;
let amountGiven = 0;
let pendingArticle = null;
let lastSaleData = null;
let stripeInstance = null;
let stripeElements = null;
let stripeCardElement = null;
let virtualKeyboard = null;
let currentInputTarget = null; // 'scan', 'search', 'price'
let lastTransactions = [];

const STRIPE_PUBLIC_KEY = 'pk_test_51T9DBURq7ukXBvuPlqzY6YGQjobMWNxfdUx88YlpNT3iFgsppTne56qWj8UPIbLcUgsvBcH1NxNXrq2FHvlCjGjJ00EetKx4ko';
const SUPABASE_FUNCTION_URL = 'https://lanxxvocjwpyegoxxxkj.supabase.co/functions/v1/create-payment-intent';

const denominations = [500, 200, 100, 50, 20, 10, 5, 2, 1, 0.50, 0.20, 0.10, 0.05, 0.02, 0.01];
const counts = {};
denominations.forEach(d => counts[d] = 0);

// ─── DOM ───
const usernameDisplay     = document.getElementById('usernameDisplay');
const scanInput           = document.getElementById('scanInput');
const scanBtn             = document.getElementById('scanBtn');
const searchNameInput     = document.getElementById('searchNameInput');
const searchNameBtn       = document.getElementById('searchNameBtn');
const searchResults       = document.getElementById('searchResults');
const resultsList         = document.getElementById('resultsList');
const closeResultsBtn     = document.getElementById('closeResultsBtn');
const priceCheckInput     = document.getElementById('priceCheckInput');
const priceCheckBtn       = document.getElementById('priceCheckBtn');
const priceDisplay        = document.getElementById('priceDisplay');
const cartBody            = document.getElementById('cartBody');
const totalTVA            = document.getElementById('totalTVA');
const totalTTC            = document.getElementById('totalTTC');
const taxLine             = document.getElementById('taxLine');
const taxRateSpan         = document.getElementById('taxRate');
const amountGivenDisplay  = document.getElementById('amountGivenDisplay');
const resetAmountBtn      = document.getElementById('resetAmountBtn');
const changeDisplay       = document.getElementById('changeDisplay');
const changeAmount        = document.getElementById('changeAmount');
const insufficientDisplay = document.getElementById('insufficientDisplay');
const missingAmount       = document.getElementById('missingAmount');
const validateSaleBtn     = document.getElementById('validateSaleBtn');
const btnTotal            = document.getElementById('btnTotal');
const clearCartBtn        = document.getElementById('clearCartBtn');
const logoutBtn           = document.getElementById('logoutBtn');
const quantityModal       = document.getElementById('quantityModal');
const quantityArticleName = document.getElementById('quantityArticleName');
const modalQuantity       = document.getElementById('modalQuantity');
const availableStock      = document.getElementById('availableStock');
const confirmQuantityBtn  = document.getElementById('confirmQuantityBtn');
const saleModal           = document.getElementById('saleModal');
const closeSaleBtn        = document.getElementById('closeSaleBtn');
const printTicketBtn      = document.getElementById('printTicketBtn');
const ticketPrint         = document.getElementById('ticketPrint');
const stripeModal         = document.getElementById('stripeModal');
const closeStripeModal    = document.getElementById('closeStripeModal');
const stripePayBtn        = document.getElementById('stripePayBtn');
const stripeError         = document.getElementById('stripeError');
const qrModal             = document.getElementById('qrModal');
const closeQrModal        = document.getElementById('closeQrModal');
const qrContainer         = document.getElementById('qrContainer');
const qrAmount            = document.getElementById('qrAmount');
const btnPayCard          = document.getElementById('btnPayCard');
const btnPayQr            = document.getElementById('btnPayQr');
const addSplitBtn         = document.getElementById('addSplitBtn');

// ─── INIT ───
function init() {
    loadCurrentUser();
    loadTaxConfig();
    checkCaisseAccess();
    loadStripe();
    setupEventListeners();
    updateCartDisplay();
    setupBeforeUnload();
}

function loadCurrentUser() {
    const userJson = sessionStorage.getItem('current_user');
    if (!userJson) { window.location.href = 'accueil.html'; return; }
    currentUser = JSON.parse(userJson);
    usernameDisplay.textContent = currentUser.username;
}

function loadTaxConfig() {
    const perms = currentUser?.permissions;
    taxEnabled = perms?.caisse_tax_enabled || false;
    taxRate = perms?.caisse_tax_rate || 20;
    if (taxRateSpan) taxRateSpan.textContent = taxRate;
    if (taxLine) taxLine.style.display = taxEnabled ? 'flex' : 'none';
}

function checkCaisseAccess() {
    const hasCaissePerm = currentUser?.permissions?.caisse === true;
    const isModuleEnabled = currentUser?.permissions?.caisse_module_enabled === true;
    if (!hasCaissePerm || !isModuleEnabled) window.location.href = 'accueil.html';
}

function loadStripe() {
    const script = document.createElement('script');
    script.src = 'https://js.stripe.com/v3/';
    script.onload = () => { stripeInstance = Stripe(STRIPE_PUBLIC_KEY); };
    document.head.appendChild(script);
}

function setupBeforeUnload() {
    window.addEventListener('beforeunload', e => { if (cart.length > 0) { e.preventDefault(); e.returnValue = ''; } });
}

// ─── ÉVÉNEMENTS ───
function setupEventListeners() {
    // ⚠️ NE PAS CACHER les événements existants, seulement AJOUTER ces nouveaux

    // Scanner - clic sur la carte
    const scanCard = document.querySelector('.scan-block');
    if (scanCard) {
        scanCard.addEventListener('click', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;

            // Sur PC avec clavier physique, focus normal
            // Sur mobile ou PC sans clavier, clavier virtuel
            if (!hasPhysicalKeyboard() || e.ctrlKey) {
                currentInputTarget = 'scan';
                createVirtualKeyboard('numeric');
            } else {
                document.getElementById('scanInput').focus();
            }
        });
    }

    // Recherche - clic sur la carte
    const searchCard = document.querySelector('.search-block');
    if (searchCard) {
        searchCard.addEventListener('click', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;

            if (!hasPhysicalKeyboard() || e.ctrlKey) {
                currentInputTarget = 'search';
                createVirtualKeyboard('alphabet');
            } else {
                document.getElementById('searchNameInput').focus();
            }
        });
    }

    // Prix - clic sur la carte
    const priceCard = document.querySelector('.price-block');
    if (priceCard) {
        priceCard.addEventListener('click', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;

            if (!hasPhysicalKeyboard() || e.ctrlKey) {
                currentInputTarget = 'price';
                createVirtualKeyboard('numeric');
            } else {
                document.getElementById('priceCheckInput').focus();
            }
        });
    }

    // Dernières transactions
    const transactionsBlock = document.querySelector('.transactions-block');
    if (transactionsBlock) {
        transactionsBlock.addEventListener('click', loadLastTransactions);
    }

    // === GARDER TOUS VOS ÉVÉNEMENTS EXISTANTS ===
    scanInput.addEventListener('keypress', e => { if (e.key === 'Enter') handleScan(scanInput.value); });
    scanBtn.addEventListener('click', () => handleScan(scanInput.value));

    searchNameBtn.addEventListener('click', handleSearchByName);
    searchNameInput.addEventListener('keypress', e => { if (e.key === 'Enter') handleSearchByName(); });
    closeResultsBtn.addEventListener('click', () => { searchResults.style.display = 'none'; searchNameInput.value = ''; });

    priceCheckBtn.addEventListener('click', handlePriceCheck);
    priceCheckInput.addEventListener('keypress', e => { if (e.key === 'Enter') handlePriceCheck(); });

    clearCartBtn.addEventListener('click', clearCart);
    validateSaleBtn.addEventListener('click', validateSaleCash);
    logoutBtn.addEventListener('click', handleLogout);
    resetAmountBtn.addEventListener('click', resetAmount);

    closeSaleBtn.addEventListener('click', () => { saleModal.style.display = 'none'; });
    printTicketBtn.addEventListener('click', printTicket);

    btnPayCard?.addEventListener('click', openStripeModal);
    btnPayQr?.addEventListener('click', openQrModal);
    closeStripeModal?.addEventListener('click', () => { stripeModal.style.display = 'none'; });
    closeQrModal?.addEventListener('click', () => { qrModal.style.display = 'none'; });
    stripePayBtn?.addEventListener('click', handleStripePayment);

    // Billets/pièces
    document.querySelectorAll('.mc-btn.plus.money-btn').forEach(btn => {
        btn.addEventListener('click', () => addMoney(parseFloat(btn.dataset.value)));
    });
    document.querySelectorAll('.mc-btn.minus').forEach(btn => {
        btn.addEventListener('click', () => removeMoney(parseFloat(btn.dataset.value)));
    });
    document.querySelectorAll('.money-img').forEach(img => {
        img.addEventListener('click', () => {
            const val = parseFloat(img.closest('.money-item').dataset.value);
            addMoney(val);
        });
    });

    // Modal quantité
    confirmQuantityBtn.addEventListener('click', addToCartWithQuantity);
    document.querySelector('.minus-qty')?.addEventListener('click', () => {
        const v = parseInt(modalQuantity.value) || 1;
        if (v > 1) modalQuantity.value = v - 1;
    });
    document.querySelector('.plus-qty')?.addEventListener('click', () => {
        modalQuantity.value = (parseInt(modalQuantity.value) || 1) + 1;
    });
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => { quantityModal.style.display = 'none'; pendingArticle = null; });
    });

    quantityModal.addEventListener('click', e => { if (e.target === quantityModal) { quantityModal.style.display = 'none'; pendingArticle = null; } });
    saleModal.addEventListener('click', e => { if (e.target === saleModal) saleModal.style.display = 'none'; });
    stripeModal?.addEventListener('click', e => { if (e.target === stripeModal) stripeModal.style.display = 'none'; });
    qrModal?.addEventListener('click', e => { if (e.target === qrModal) qrModal.style.display = 'none'; });

    // Bouton paiement multiple
    if (addSplitBtn) {
        addSplitBtn.addEventListener('click', () => {
            if (cart.length === 0) {
                alert('Panier vide');
                return;
            }
            const total = getCartTotal();
            document.getElementById('multiPayTotal').textContent = formatEur(total);
            document.getElementById('multiTotalDue').textContent = formatEur(total);
            document.getElementById('multiTotalPaid').textContent = '0,00 €';
            document.getElementById('multiRemaining').textContent = formatEur(total);
            document.getElementById('multiPayModal').style.display = 'flex';
        });
    }

    // Fermeture modale
    document.getElementById('closeMultiPayModal')?.addEventListener('click', () => {
        document.getElementById('multiPayModal').style.display = 'none';
        resetMultiPayModal();
    });
    document.getElementById('cancelMultiPayBtn')?.addEventListener('click', () => {
        document.getElementById('multiPayModal').style.display = 'none';
        resetMultiPayModal();
    });
    document.getElementById('addMultiRowBtn')?.addEventListener('click', addMultiPaymentRow);
    document.getElementById('validateMultiPayBtn')?.addEventListener('click', async () => {
        const { total, totalPaid } = updateMultiTotals();
        if (totalPaid < total) {
            alert('Montant total insuffisant');
            return;
        }

        const payments = [];
        document.querySelectorAll('#multiPaymentsList .multi-payment-row').forEach(row => {
            const method = row.querySelector('.multi-method').value;
            const amount = parseFloat(row.querySelector('.multi-amount').value) || 0;
            if (amount > 0) payments.push({ method, amount });
        });

        document.getElementById('multiPayModal').style.display = 'none';

        const cardPayment = payments.find(p => p.method === 'card');
        const qrPayment   = payments.find(p => p.method === 'qr');

        if (cardPayment) {
            sessionStorage.setItem('multiPayAllPayments', JSON.stringify(payments));
            sessionStorage.setItem('multiPayPending', JSON.stringify({ type: 'card', amount: cardPayment.amount }));
            await processCardPaymentOnly(cardPayment.amount);
        } else if (qrPayment) {
            sessionStorage.setItem('multiPayAllPayments', JSON.stringify(payments));
            sessionStorage.setItem('multiPayPending', JSON.stringify({ type: 'qr', amount: qrPayment.amount }));
            await processQrPaymentOnly(qrPayment.amount, payments);
        } else {
            const cashTotal = payments.reduce((s, p) => s + p.amount, 0);
            await enregistrerVente(total, cashTotal, 'espèces', payments);
        }

        resetMultiPayModal();
    });
}

// ─── MONNAIE ───
function addMoney(val) {
    counts[val] = (counts[val] || 0) + 1;
    updateCountDisplay(val);
    amountGiven = +((amountGiven * 100 + val * 100) / 100).toFixed(2);
    updateAmountDisplay();
}

function removeMoney(val) {
    if ((counts[val] || 0) <= 0) return;
    counts[val]--;
    updateCountDisplay(val);
    amountGiven = Math.max(0, +((amountGiven * 100 - val * 100) / 100).toFixed(2));
    updateAmountDisplay();
}

function updateCountDisplay(val) {
    const id = 'count-' + String(val).replace('.', '');
    const el = document.getElementById(id);
    if (el) {
        el.textContent = counts[val] || 0;
        el.style.color = (counts[val] > 0) ? 'var(--accent)' : 'var(--text)';
        el.style.fontWeight = (counts[val] > 0) ? '800' : '700';
    }
}

function updateAmountDisplay() {
    amountGivenDisplay.textContent = formatEur(amountGiven);
    calculateChange();
}

function resetAmount() {
    amountGiven = 0;
    denominations.forEach(d => { counts[d] = 0; updateCountDisplay(d); });
    amountGivenDisplay.textContent = '0,00 €';
    changeDisplay.style.display = 'none';
    insufficientDisplay.style.display = 'none';
}

function calculateChange() {
    const total = getCartTotal();
    if (amountGiven === 0 || total === 0) { changeDisplay.style.display = 'none'; insufficientDisplay.style.display = 'none'; return; }
    if (amountGiven >= total) {
        changeAmount.textContent = formatEur(+(amountGiven - total).toFixed(2));
        changeDisplay.style.display = 'flex';
        insufficientDisplay.style.display = 'none';
    } else {
        missingAmount.textContent = formatEur(+(total - amountGiven).toFixed(2));
        insufficientDisplay.style.display = 'flex';
        changeDisplay.style.display = 'none';
    }
}

// ─── SCAN ───
async function handleScan(code) {
    if (!code.trim()) return;
    const { data: article, error } = await supabase
        .from('w_articles').select('id, nom, code_barre, prix_unitaire, stock_actuel, photo_url')
        .eq('code_barre', code.trim()).eq('actif', true).single();
    if (error || !article) { alert('Article non trouvé'); scanInput.value = ''; return; }
    scanInput.value = '';
    openQuantityModal(article);
}

// ─── RECHERCHE ───
async function handleSearchByName() {
    const term = searchNameInput.value.trim();
    if (!term) return;
    const { data: articles, error } = await supabase
        .from('w_articles').select('id, nom, code_barre, prix_unitaire, stock_actuel, photo_url')
        .ilike('nom', `%${term}%`).eq('actif', true).limit(10);
    if (error) { alert('Erreur de recherche'); return; }
    displaySearchResults(articles);
}

function displaySearchResults(articles) {
    if (!articles || articles.length === 0) {
        resultsList.innerHTML = '<div style="text-align:center;padding:12px;color:var(--text3);font-size:0.8rem;">Aucun résultat</div>';
    } else {
        resultsList.innerHTML = articles.map(a => `
            <div class="result-item">
                <div class="result-info">
                    <div class="result-name">${escapeHtml(a.nom)}</div>
                    <div class="result-code">${a.code_barre || '—'}</div>
                </div>
                <div class="result-price">${formatEur(a.prix_unitaire)}</div>
                <button class="add-to-cart-btn" data-article='${JSON.stringify(a)}'>
                    <i class="fas fa-plus"></i> Ajouter
                </button>
            </div>
        `).join('');
        document.querySelectorAll('.add-to-cart-btn').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                openQuantityModal(JSON.parse(btn.dataset.article));
                searchResults.style.display = 'none';
                searchNameInput.value = '';
            });
        });
    }
    searchResults.style.display = 'block';
}

// ─── PRIX RAPIDE ───
async function handlePriceCheck() {
    const code = priceCheckInput.value.trim();
    if (!code) return;
    const { data: article, error } = await supabase
        .from('w_articles').select('nom, prix_unitaire')
        .eq('code_barre', code).eq('actif', true).single();
    if (error || !article) { alert('Article non trouvé'); priceCheckInput.value = ''; priceDisplay.style.display = 'none'; return; }
    document.querySelector('.price-article-name').textContent = article.nom;
    document.querySelector('.price-value').textContent = formatEur(article.prix_unitaire);
    document.querySelector('.price-tax').textContent = taxEnabled ? `TTC (TVA ${taxRate}% incluse)` : 'Prix TTC';
    priceDisplay.style.display = 'block';
    priceCheckInput.value = '';
    setTimeout(() => { priceDisplay.style.display = 'none'; }, 4000);
}

// ─── PANIER ───
function openQuantityModal(article) {
    pendingArticle = article;
    quantityArticleName.textContent = article.nom;
    availableStock.textContent = article.stock_actuel;
    modalQuantity.value = 1;

    const existingPhoto = document.getElementById('modalArticlePhoto');
    if (existingPhoto) existingPhoto.remove();

    if (article.photo_url) {
        const photoEl = document.createElement('img');
        photoEl.id = 'modalArticlePhoto';
        photoEl.src = article.photo_url;
        photoEl.alt = article.nom;
        photoEl.style.cssText = 'width:100%; max-height:160px; object-fit:contain; border-radius:var(--r); margin-bottom:8px; border:1px solid var(--border);';
        const modalBody = quantityModal.querySelector('.modal-body');
        modalBody.insertBefore(photoEl, modalBody.firstChild);
    }

    quantityModal.style.display = 'flex';
    setTimeout(() => modalQuantity.select(), 100);
}

function addToCartWithQuantity() {
    if (!pendingArticle) return;
    const quantity = parseInt(modalQuantity.value) || 1;
    if (quantity > pendingArticle.stock_actuel) { alert(`Stock insuffisant. Disponible : ${pendingArticle.stock_actuel}`); return; }
    const idx = cart.findIndex(i => i.id === pendingArticle.id);
    if (idx !== -1) {
        const newQty = cart[idx].quantity + quantity;
        if (newQty > pendingArticle.stock_actuel) { alert(`Quantité totale (${newQty}) dépasse le stock (${pendingArticle.stock_actuel})`); return; }
        cart[idx].quantity = newQty;
    } else {
        cart.push({ id: pendingArticle.id, nom: pendingArticle.nom, prix_unitaire: pendingArticle.prix_unitaire, quantity, photo_url: pendingArticle.photo_url || null });
    }
    quantityModal.style.display = 'none';
    pendingArticle = null;
    updateCartDisplay();
}

function getCartTotal() {
    return +cart.reduce((s, i) => {
        const discount = i.discount || 0;
        const discountedPrice = +(i.prix_unitaire * (1 - discount / 100)).toFixed(2);
        return s + discountedPrice * i.quantity;
    }, 0).toFixed(2);
}

function updateCartDisplay() {
    if (cart.length === 0) {
        cartBody.innerHTML = `<tr class="empty-row"><td colspan="5"><div class="empty-state"><i class="fas fa-basket-shopping"></i><span>Panier vide</span></div></td></tr>`;
        totalTVA.textContent = '0,00 €';
        totalTTC.textContent = '0,00 €';
        btnTotal.textContent = '0,00 €';
        validateSaleBtn.disabled = true;
        if (btnPayCard) btnPayCard.disabled = true;
        if (btnPayQr) btnPayQr.disabled = true;
        if (addSplitBtn) addSplitBtn.disabled = true;
        calculateChange();
        return;
    }

    let ttcTotal = 0;
    cartBody.innerHTML = cart.map((item, index) => {
        const discount = item.discount || 0;
        const discountedPrice = +(item.prix_unitaire * (1 - discount / 100)).toFixed(2);
        const lineTotal = +(discountedPrice * item.quantity).toFixed(2);
        ttcTotal += lineTotal;
        return `
            <tr>
                <td class="item-name">${escapeHtml(item.nom)}</td>
                <td class="item-price">${formatEur(item.prix_unitaire)}</td>
                <td>
                    <div class="quantity-control">
                        <button onclick="window.changeQty(${index},-1)"><i class="fas fa-minus"></i></button>
                        <span>${item.quantity}</span>
                        <button onclick="window.changeQty(${index},1)"><i class="fas fa-plus"></i></button>
                    </div>
                </td>
                <td>
                    <select class="discount-select" onchange="window.setDiscount(${index}, this.value)">
                        <option value="0" ${discount === 0 ? 'selected' : ''}>—</option>
                        ${[5,10,20,30,40,50,60,70,80,90].map(d => `
                        <option value="${d}" ${discount === d ? 'selected' : ''}>-${d}%</option>`).join('')}
                    </select>
                </td>
                <td class="item-total">
                    ${discount > 0 ? `<span class="item-original-price">${formatEur(item.prix_unitaire * item.quantity)}</span>` : ''}
                    ${formatEur(lineTotal)}
                </td>
                <td>
                    ${item.photo_url
                        ? `<img src="${item.photo_url}" alt="${escapeHtml(item.nom)}" style="width:40px; height:40px; object-fit:contain; border-radius:6px; border:1px solid var(--border);">`
                        : `<span style="color:var(--text3); font-size:0.75rem;">—</span>`}
                </td>
                <td><button class="remove-item" onclick="window.removeFromCart(${index})"><i class="fas fa-trash"></i></button></td>
            </tr>`;
    }).join('');

    window.setDiscount = (i, val) => { cart[i].discount = parseInt(val) || 0; updateCartDisplay(); };

    window.changeQty = (i, d) => { const q = cart[i].quantity + d; if (q < 1) cart.splice(i, 1); else cart[i].quantity = q; updateCartDisplay(); };
    window.removeFromCart = i => { cart.splice(i, 1); updateCartDisplay(); };

    ttcTotal = +ttcTotal.toFixed(2);
    const tvaAmount = taxEnabled ? +(ttcTotal - ttcTotal / (1 + taxRate / 100)).toFixed(2) : 0;

    totalTVA.textContent = formatEur(tvaAmount);
    totalTTC.textContent = formatEur(ttcTotal);
    btnTotal.textContent = formatEur(ttcTotal);
    validateSaleBtn.disabled = false;
    if (btnPayCard) btnPayCard.disabled = false;
    if (btnPayQr) btnPayQr.disabled = false;
    if (addSplitBtn) addSplitBtn.disabled = false;
    calculateChange();
}

function clearCart() {
    if (cart.length === 0) return;
    if (confirm('Vider tout le panier ?')) { cart = []; updateCartDisplay(); resetAmount(); }
}

// ─── VENTE ESPÈCES ───
async function validateSaleCash() {
    if (cart.length === 0) { alert('Panier vide'); return; }
    const total = getCartTotal();
    if (amountGiven < total) { alert(`Montant insuffisant. Total : ${formatEur(total)}`); return; }
    const totalQty = cart.reduce((s, i) => s + i.quantity, 0);
    if (!confirm(`Confirmer la vente de ${totalQty} article(s) pour ${formatEur(total)} ?`)) return;
    await enregistrerVente(total, amountGiven, 'espèces');
}

// ─── STRIPE CARTE ───
async function openStripeModal() {
    if (cart.length === 0) return;
    const total = getCartTotal();
    document.getElementById('stripeAmount').textContent = formatEur(total);
    stripeModal.style.display = 'flex';
    stripeError.textContent = '';
    stripeError.style.display = 'none';

    if (!stripeInstance) { stripeError.textContent = 'Stripe non chargé, réessayez.'; stripeError.style.display = 'block'; return; }

    stripeElements = stripeInstance.elements();
    stripeCardElement = stripeElements.create('card', {
        style: {
            base: { fontSize: '16px', color: '#1e2a3b', fontFamily: 'Plus Jakarta Sans, sans-serif', '::placeholder': { color: '#8b95ab' } }
        }
    });
    stripeCardElement.mount('#stripe-card-element');
}

async function handleStripePayment() {
    if (!stripeCardElement) return;
    const total = getCartTotal();

    stripePayBtn.disabled = true;
    stripePayBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Traitement…';
    stripeError.style.display = 'none';

    try {
        // Afficher ce qu'on envoie
        const requestBody = {
            amount: total,
            currency: 'eur',
            type: 'card'  // ⚠️ Vérifiez que c'est bien 'card' en minuscules
        };
        console.log('📤 Envoi à la fonction:', requestBody);

        const res = await fetch(SUPABASE_FUNCTION_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        console.log('📥 Statut réponse:', res.status);

        const data = await res.json();
        console.log('📥 Réponse complète reçue:', data);

        if (data.error) {
            console.error('❌ Erreur dans la réponse:', data.error);
            throw new Error(data.error);
        }

        // Vérifier que clientSecret existe (note: c'est clientSecret pas client_secret)
        if (!data.clientSecret) {
            console.error('❌ Pas de clientSecret dans la réponse. Réponse:', data);
            throw new Error('Pas de clientSecret reçu du serveur');
        }

        console.log('✅ clientSecret reçu:', data.clientSecret);

        // Confirmer le paiement
        const { paymentIntent, error } = await stripeInstance.confirmCardPayment(data.clientSecret, {
            payment_method: {
                card: stripeCardElement
            }
        });

        if (error) {
            console.error('❌ Erreur confirmation Stripe:', error);
            throw new Error(error.message);
        }

        console.log('✅ Paiement réussi:', paymentIntent.status);

        if (paymentIntent.status === 'succeeded') {
            stripeModal.style.display = 'none';
            const pendingRaw = sessionStorage.getItem('multiPayPending');
            const allPaymentsRaw = sessionStorage.getItem('multiPayAllPayments');
            sessionStorage.removeItem('multiPayPending');
            sessionStorage.removeItem('multiPayAllPayments');

            if (pendingRaw && allPaymentsRaw) {
                const pendingData = JSON.parse(pendingRaw);
                const allPayments = JSON.parse(allPaymentsRaw);
                await enregistrerVente(getCartTotal(), pendingData.amount, 'carte', allPayments);
            } else {
                await enregistrerVente(total, total, 'carte');
            }
        }

    } catch (err) {
        console.error('❌ Erreur handleStripePayment:', err);
        stripeError.textContent = err.message;
        stripeError.style.display = 'block';
    } finally {
        stripePayBtn.disabled = false;
        stripePayBtn.innerHTML = '<i class="fas fa-lock"></i> Payer par carte';
    }
}

async function openQrModal() {
    if (cart.length === 0) return;
    const total = getCartTotal();
    qrAmount.textContent = formatEur(total);
    qrContainer.innerHTML = '<div class="qr-loading"><i class="fas fa-spinner fa-spin"></i> Génération du QR code…</div>';
    qrModal.style.display = 'flex';

    try {
        // Appel à votre edge function avec type 'qr'
        const res = await fetch(SUPABASE_FUNCTION_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amount: total,
                currency: 'eur',
                type: 'qr'  // Important: type 'qr'
            })
        });

        const data = await res.json();
        console.log('Réponse QR:', data);

        if (data.error) throw new Error(data.error);

        // Vérifier que l'URL existe
        if (!data.url) {
            throw new Error('Pas d\'URL de paiement reçue');
        }

        // Générer le QR code avec l'URL Stripe Checkout
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(data.url)}`;

        qrContainer.innerHTML = `
            <div style="text-align:center;">
                <div style="background: white; padding: 15px; border-radius: 12px; display: inline-block;">
                    <img src="${qrCodeUrl}" alt="QR Code" style="width:200px;height:200px;">
                </div>
                <p style="font-size:0.85rem;color:var(--text3);margin:15px 0 10px 0;">
                    <i class="fas fa-mobile-alt"></i> Le client scanne ce code avec son téléphone
                </p>
                <p style="font-size:0.75rem;color:var(--text3);margin-bottom:15px;">
                    Le client paiera sur son téléphone
                </p>
                <div style="display:flex;gap:10px;">
                    <button id="qrRefreshBtn" class="btn-secondary" style="flex:1;">
                        <i class="fas fa-sync"></i> Nouveau QR
                    </button>
                    <button id="qrPaidBtn" class="btn-primary" style="flex:1;">
                        <i class="fas fa-check"></i> J'ai reçu le paiement
                    </button>
                </div>
            </div>`;

        // Rafraîchir le QR
        const refreshBtn = document.getElementById('qrRefreshBtn');
        if (refreshBtn) {
            refreshBtn.onclick = () => openQrModal();
        }

        // Confirmer le paiement (manuellement car Stripe redirige vers success_url)
        const paidBtn = document.getElementById('qrPaidBtn');
        if (paidBtn) {
            paidBtn.onclick = async () => {
                // Ici, idéalement il faudrait vérifier que le paiement a bien été fait
                // Mais pour simplifier, on valide manuellement
                if (confirm('Confirmez-vous que le client a bien payé ?')) {
                    qrModal.style.display = 'none';
                    await enregistrerVente(total, total, 'QR code');
                }
            };
        }

    } catch (err) {
        console.error('Erreur QR:', err);
        qrContainer.innerHTML = `
            <div style="text-align:center;color:var(--danger);">
                <i class="fas fa-exclamation-triangle" style="font-size:2rem;"></i>
                <p style="margin:10px 0;">${err.message}</p>
                <button onclick="openQrModal()" class="btn-secondary">
                    <i class="fas fa-redo"></i> Réessayer
                </button>
            </div>`;
    }
}

// ─── ENREGISTRER VENTE ───
async function enregistrerVente(total, received, modePaiement, multiPayments = null) {
    const cartSnapshot = [...cart];
    try {
        for (const item of cartSnapshot) {
            const { data: article } = await supabase.from('w_articles').select('stock_actuel').eq('id', item.id).single();
            const newStock = article.stock_actuel - item.quantity;
            await supabase.from('w_articles').update({ stock_actuel: newStock, date_maj_stock: new Date() }).eq('id', item.id);

            // Construire le commentaire avec tous les paiements
            let commentaire = `Vente caisse — Total: ${formatEur(total)}`;
            if (multiPayments) {
                const details = multiPayments.map(p => `${formatEur(p.amount)} ${p.method === 'cash' ? 'espèces' : p.method === 'card' ? 'carte' : 'QR code'}`).join(' + ');
                commentaire = `Vente caisse (${details}) — Total: ${formatEur(total)}`;
            } else {
                const discountInfo = item.discount > 0 ? ` — Rabais: ${item.discount}%` : '';
                commentaire = `Vente caisse (${modePaiement}) — Total: ${formatEur(total)} — Reçu: ${formatEur(received)}${discountInfo}`;
            }

            await supabase.from('w_mouvements').insert({
                article_id: item.id,
                type: 'sortie',
                quantite: item.quantity,
                utilisateur_id: currentUser?.id,
                motif: 'vente',
                commentaire: commentaire,
                stock_avant: article.stock_actuel,
                stock_apres: newStock,
                date_mouvement: new Date().toISOString().split('T')[0],
                heure_mouvement: new Date().toLocaleTimeString('fr-FR')
            });
        }

        let change = 0;
        let displayMode = modePaiement;
        let totalReceived = received;

        if (multiPayments) {
            totalReceived = total;
            const cashPayment = multiPayments.find(p => p.method === 'cash');
            const cardPayment = multiPayments.find(p => p.method === 'card');
            const qrPayment   = multiPayments.find(p => p.method === 'qr');
            displayMode = multiPayments
                .map(p => {
                    if (p.method === 'cash') return `Espèces (${formatEur(p.amount)})`;
                    if (p.method === 'card') return `Carte (${formatEur(p.amount)})`;
                    if (p.method === 'qr')   return `QR code (${formatEur(p.amount)})`;
                })
                .join('\n');
        }

        const changeToReturn = +(totalReceived - total).toFixed(2);

        lastSaleData = {
            cart: cartSnapshot,
            total,
            received: totalReceived,
            change: changeToReturn > 0 ? changeToReturn : 0,
            modePaiement: displayMode,
            date: new Date(),
            multiPayments: multiPayments
        };

        document.getElementById('saleTotal').textContent = formatEur(total);
        document.getElementById('saleReceived').textContent = formatEur(totalReceived);
        document.getElementById('saleChange').textContent = changeToReturn > 0 ? formatEur(changeToReturn) : '—';
        document.getElementById('salePayMode').textContent = displayMode;
        saleModal.style.display = 'flex';

        cart = [];
        updateCartDisplay();
        resetAmount();

    } catch (err) {
        console.error(err);
        alert('Erreur lors de l\'enregistrement de la vente');
    }
}

// ─── TICKET ───
function printTicket() {
    if (!lastSaleData) return;
    const { cart: items, total, received, change, modePaiement, date } = lastSaleData;
    const tvaAmount = taxEnabled ? +(total - total / (1 + taxRate / 100)).toFixed(2) : 0;
    const htAmount = taxEnabled ? +(total - tvaAmount).toFixed(2) : total;
    const dateStr = date.toLocaleDateString('fr-FR');
    const timeStr = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    const rows = items.map(i => {
        const discount = i.discount || 0;
        const discountedPrice = +(i.prix_unitaire * (1 - discount / 100)).toFixed(2);
        const lineTotal = +(discountedPrice * i.quantity).toFixed(2);
        return `
            <tr>
                <td>${escapeHtml(i.nom)}${discount > 0 ? ` (-${discount}%)` : ''}</td>
                <td class="r">${i.quantity}</td>
                <td class="r">${discount > 0 ? `<span style="text-decoration:line-through;font-size:9px;">${formatEur(i.prix_unitaire)}</span> ${formatEur(discountedPrice)}` : formatEur(i.prix_unitaire)}</td>
                <td class="r">${formatEur(lineTotal)}</td>
            </tr>
        `;
    }).join('');

    ticketPrint.innerHTML = `
        <div class="ticket">
            <div class="ticket-store">NeXeN Store</div>
            <div class="ticket-meta">${dateStr} — ${timeStr}</div>
            <div class="ticket-meta">Caissier : ${currentUser?.username || ''}</div>

            <hr class="ticket-divider">

            <table class="ticket-items">
                <thead>
                    <tr>
                        <th>Article</th>
                        <th class="r">Qté</th>
                        <th class="r">P.U.</th>
                        <th class="r">Total</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>

            <hr class="ticket-divider">

            <table class="ticket-totals">
                ${taxEnabled ? `
                    <tr>
                        <td>Montant HT</td>
                        <td class="r">${formatEur(htAmount)}</td>
                    </tr>
                    <tr>
                        <td>TVA ${taxRate}%</td>
                        <td class="r">${formatEur(tvaAmount)}</td>
                    </tr>
                ` : ''}
                <tr class="ticket-grand">
                    <td><strong>TOTAL TTC</strong></td>
                    <td class="r"><strong>${formatEur(total)}</strong></td>
                </tr>
                <tr>
                    <td>Mode de paiement</td>
                    <td class="r" style="white-space: pre-line;">${
                        lastSaleData.multiPayments
                            ? lastSaleData.multiPayments.map(p => {
                                if (p.method === 'cash') return `Espèces ${formatEur(p.amount)}`;
                                if (p.method === 'card') return `Carte ${formatEur(p.amount)}`;
                                if (p.method === 'qr')   return `QR code ${formatEur(p.amount)}`;
                              }).join('\n')
                            : modePaiement === 'carte' ? 'Carte bancaire'
                            : modePaiement === 'QR code' ? 'QR code'
                            : 'Espèces'
                    }</td>
                </tr>
                <tr>
                    <td>Montant reçu</td>
                    <td class="r">${formatEur(total)}</td>
                </tr>
                ${modePaiement === 'espèces' ? `
                    <tr>
                        <td><strong>Monnaie rendue</strong></td>
                        <td class="r"><strong>${formatEur(change)}</strong></td>
                    </tr>
                ` : ''}
            </table>

            <hr class="ticket-divider">

            <div class="ticket-footer">
                Merci de votre achat !<br>
                À bientôt chez NeXeN Store
            </div>
        </div>
    `;

    window.print();
}

// ─── UTILITAIRES ───
function formatEur(val) {
    return Number(val).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
}
async function handleLogout() {
    await supabase.auth.signOut();
    sessionStorage.removeItem('current_user');
    window.location.href = 'accueil.html';
}

// ─── CLAVIER VIRTUEL ───
// ─── CLAVIER VIRTUEL ───
function createVirtualKeyboard(type) {
    // Supprimer l'ancien clavier s'il existe
    if (virtualKeyboard) virtualKeyboard.remove();

    const keyboard = document.createElement('div');
    keyboard.className = 'virtual-keyboard';

    if (type === 'numeric') {
        keyboard.innerHTML = `
            <div class="keyboard-title">Scanner un code-barres</div>
            <div class="keyboard-display" id="keyboardDisplay"></div>
            <div class="keyboard-keys">
                ${[1,2,3,4,5,6,7,8,9,0].map(n => `<button class="key-btn" data-value="${n}">${n}</button>`).join('')}
                <button class="key-btn key-clear">⌫</button>
                <button class="key-btn key-enter">↵ Valider</button>
                <button class="key-btn key-close">✕ Fermer</button>
            </div>
        `;
    } else if (type === 'alphabet') {
        keyboard.innerHTML = `
            <div class="keyboard-title">Rechercher un article</div>
            <div class="keyboard-display" id="keyboardDisplay"></div>
            <div class="keyboard-keys keyboard-alpha">
                ${'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(l => `<button class="key-btn" data-value="${l}">${l}</button>`).join('')}
                <button class="key-btn key-space">Espace</button>
                <button class="key-btn key-clear">⌫</button>
                <button class="key-btn key-enter">↵ Rechercher</button>
                <button class="key-btn key-close">✕ Fermer</button>
            </div>
        `;
    }

    document.body.appendChild(keyboard);
    virtualKeyboard = keyboard;

    let currentInput = '';
    const display = keyboard.querySelector('#keyboardDisplay');

    const updateDisplay = () => {
        display.textContent = currentInput || '...';
    };

    // Gestion des touches
    keyboard.querySelectorAll('.key-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.classList.contains('key-close')) {
                keyboard.remove();
                virtualKeyboard = null;
                currentInputTarget = null;
                return;
            }

            if (btn.classList.contains('key-clear')) {
                currentInput = currentInput.slice(0, -1);
                updateDisplay();
                return;
            }

            if (btn.classList.contains('key-enter')) {
                if (currentInputTarget === 'scan') {
                    handleScan(currentInput);
                } else if (currentInputTarget === 'price') {
                    priceCheckInput.value = currentInput;
                    handlePriceCheck();
                } else if (currentInputTarget === 'search') {
                    searchNameInput.value = currentInput;
                    handleSearchByName();
                }
                keyboard.remove();
                virtualKeyboard = null;
                currentInputTarget = null;
                return;
            }

            if (btn.classList.contains('key-space')) {
                currentInput += ' ';
                updateDisplay();
                return;
            }

            const value = btn.dataset.value;
            if (value) {
                currentInput += value;
                updateDisplay();
            }
        });
    });

    updateDisplay();
}

// Détecter si l'appareil a un clavier physique
function hasPhysicalKeyboard() {
    // Détection basée sur l'agent utilisateur et la taille d'écran
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isTablet = /iPad|Android(?!.*Mobile)/i.test(navigator.userAgent);
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    // Sur mobile/tablette tactile -> pas de clavier physique
    if (isMobile || isTablet || hasTouch) {
        return false;
    }

    // Sur PC, on suppose qu'il y a un clavier
    return true;
}

// ─── DERNIÈRES TRANSACTIONS ───
async function loadLastTransactions() {
    try {
        const { data: mouvements, error } = await supabase
            .from('w_mouvements')
            .select(`
                *,
                w_articles (nom, prix_unitaire)
            `)
            .in('motif', ['vente', 'retour', 'echange'])
            .order('date_mouvement', { ascending: false })
            .order('heure_mouvement', { ascending: false })
            .limit(50);

        if (error) throw error;

        const transactions = new Map();
        mouvements.forEach(m => {
            const motif = m.motif;

            if (motif === 'vente') {
                const key = `${m.date_mouvement}_${m.heure_mouvement}_${m.commentaire}`;
                if (!transactions.has(key)) {
                    transactions.set(key, {
                        id: key,
                        date: m.date_mouvement,
                        time: m.heure_mouvement,
                        type: 'vente',
                        total: 0,
                        mode: m.commentaire?.match(/\((.*?)\)/)?.[1] || 'inconnu',
                        items: []
                    });
                }
                const t = transactions.get(key);
                const price = m.w_articles?.prix_unitaire || 0;
                const rabaisMatch = m.commentaire?.match(/Rabais: (\d+)%/);
                const discount = rabaisMatch ? parseInt(rabaisMatch[1]) : 0;
                const discountedPrice = +(price * (1 - discount / 100)).toFixed(2);
                t.total += discountedPrice * m.quantite;
                t.items.push({ nom: m.w_articles?.nom || 'Article', quantite: m.quantite, prix: price, discount });
                const recuMatch = m.commentaire?.match(/Reçu: ([\d\s,]+\s€)/);
                if (recuMatch) t.received = parseFloat(recuMatch[1].replace(/\s/g, '').replace(',', '.').replace('€', ''));

            } else if (motif === 'retour' || motif === 'echange') {
                // Clé basée sur date+minute+motif pour regrouper les 2 lignes d'un échange
                const heureMinute = m.heure_mouvement ? m.heure_mouvement.substring(0, 5) : '00:00';
                const key = `${m.date_mouvement}_${heureMinute}_${motif}`;
                if (!transactions.has(key)) {
                    transactions.set(key, {
                        id: key,
                        date: m.date_mouvement,
                        time: m.heure_mouvement,
                        type: motif,
                        oldArticle: null,
                        newArticle: null,
                        diff: 0
                    });
                }
                const t = transactions.get(key);
                const price = m.w_articles?.prix_unitaire || 0;
                if (m.type === 'entree') {
                    t.oldArticle = { nom: m.w_articles?.nom || 'Article', prix: price };
                } else if (m.type === 'sortie') {
                    t.newArticle = { nom: m.w_articles?.nom || 'Article', prix: price };
                }
                if (t.oldArticle && t.newArticle) {
                    t.diff = +(t.newArticle.prix - t.oldArticle.prix).toFixed(2);
                }
            }
        });

        lastTransactions = Array.from(transactions.values()).slice(0, 10);
        displayTransactionsModal();
    } catch (err) {
        console.error('Erreur chargement transactions:', err);
        alert('Erreur lors du chargement des transactions');
    }
}

function displayTransactionsModal() {
    const modal = document.createElement('div');
    modal.className = 'modal transactions-modal';
    modal.style.display = 'flex';

    modal.innerHTML = `
        <div class="modal-content transactions-content">
            <div class="modal-header">
                <h3><i class="fas fa-history"></i> Dernières transactions</h3>
                <button class="close-modal-btn">&times;</button>
            </div>
            <div class="transactions-list">
                ${lastTransactions.map((t, idx) => {
                    if (t.type === 'vente') {
                        return `
                        <div class="transaction-item" data-idx="${idx}">
                            <div class="transaction-header">
                                <div class="transaction-date"><i class="fas fa-calendar"></i> ${t.date} ${t.time}</div>
                                <div class="transaction-total">${formatEur(t.total)}</div>
                            </div>
                            <div class="transaction-details">
                                <div class="transaction-mode">
                                    <i class="fas ${t.mode === 'espèces' ? 'fa-money-bill' : t.mode === 'carte' ? 'fa-credit-card' : 'fa-qrcode'}"></i>
                                    ${t.mode}
                                </div>
                                <div class="transaction-items-count">${t.items.length} article(s)</div>
                            </div>
                            <div class="transaction-actions">
                                <button class="btn-reprint" data-idx="${idx}"><i class="fas fa-print"></i> Réimprimer</button>
                                <button class="btn-details" data-idx="${idx}"><i class="fas fa-eye"></i> Détails</button>
                            </div>
                        </div>`;
                    } else if (t.type === 'retour') {
                        return `
                        <div class="transaction-item" data-idx="${idx}">
                            <div class="transaction-header">
                                <div class="transaction-date"><i class="fas fa-calendar"></i> ${t.date} ${t.time}</div>
                                <div class="transaction-total" style="color:var(--success);">Retour</div>
                            </div>
                            <div class="transaction-details">
                                <div class="transaction-mode"><i class="fas fa-undo"></i> ${t.oldArticle?.nom || '—'}</div>
                                <div class="transaction-items-count" style="color:var(--success);">Remboursement ${formatEur(t.oldArticle?.prix || 0)}</div>
                            </div>
                            <div class="transaction-actions">
                                <button class="btn-reprint" data-idx="${idx}"><i class="fas fa-print"></i> Réimprimer</button>
                                <button class="btn-details" data-idx="${idx}"><i class="fas fa-eye"></i> Détails</button>
                            </div>
                        </div>`;
                    } else if (t.type === 'echange') {
                        const diffLabel = t.diff === 0
                            ? 'Prix identique'
                            : t.diff > 0
                                ? `Client paie ${formatEur(t.diff)}`
                                : `Remboursement ${formatEur(Math.abs(t.diff))}`;
                        return `
                        <div class="transaction-item" data-idx="${idx}">
                            <div class="transaction-header">
                                <div class="transaction-date"><i class="fas fa-calendar"></i> ${t.date} ${t.time}</div>
                                <div class="transaction-total" style="color:var(--accent);">Échange</div>
                            </div>
                            <div class="transaction-details">
                                <div class="transaction-mode"><i class="fas fa-arrows-rotate"></i> ${t.oldArticle?.nom || '—'} → ${t.newArticle?.nom || '—'}</div>
                                <div class="transaction-items-count">${diffLabel}</div>
                            </div>
                            <div class="transaction-actions">
                                <button class="btn-reprint" data-idx="${idx}"><i class="fas fa-print"></i> Réimprimer</button>
                                <button class="btn-details" data-idx="${idx}"><i class="fas fa-eye"></i> Détails</button>
                            </div>
                        </div>`;
                    }
                }).join('')}
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Fermeture
    modal.querySelector('.close-modal-btn').onclick = () => modal.remove();
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

    // Actions
    modal.querySelectorAll('.btn-reprint').forEach(btn => {
        btn.onclick = () => {
            const idx = parseInt(btn.dataset.idx);
            reprintTicket(lastTransactions[idx]);
            modal.remove();
        };
    });

    modal.querySelectorAll('.btn-details').forEach(btn => {
        btn.onclick = () => {
            const idx = parseInt(btn.dataset.idx);
            console.log('Transaction détails:', JSON.stringify(lastTransactions[idx]));
            showTransactionDetails(lastTransactions[idx]);
        };
    });
}

function showTransactionDetails(transaction) {
    const modal = document.createElement('div');
    modal.className = 'modal details-modal';
    modal.style.display = 'flex';

    let itemsHtml = '';
    if (!transaction.type || transaction.type === 'vente') {
        transaction.type = 'vente';
        itemsHtml = transaction.items.map(item => `
            <div class="detail-item">
                <span class="detail-name">${escapeHtml(item.nom)}</span>
                <span class="detail-qty">x${item.quantite}</span>
                <span class="detail-price">${formatEur(item.prix * item.quantite)}</span>
            </div>
        `).join('');
    } else if (transaction.type === 'retour') {
        itemsHtml = `
            <div class="detail-item">
                <span class="detail-name">${escapeHtml(transaction.oldArticle?.nom || '—')}</span>
                <span class="detail-qty">x1</span>
                <span class="detail-price" style="color:var(--success);">+ ${formatEur(transaction.oldArticle?.prix || 0)}</span>
            </div>`;
    } else if (transaction.type === 'echange') {
        const diff = transaction.diff;
        const diffLabel = diff === 0 ? 'Prix identique'
            : diff > 0 ? `Client paie ${formatEur(diff)}`
            : `Remboursement ${formatEur(Math.abs(diff))}`;
        itemsHtml = `
            <div class="detail-item">
                <span class="detail-name">Retourné : ${escapeHtml(transaction.oldArticle?.nom || '—')}</span>
                <span class="detail-qty">x1</span>
                <span class="detail-price">${formatEur(transaction.oldArticle?.prix || 0)}</span>
            </div>
            <div class="detail-item">
                <span class="detail-name">Échangé : ${escapeHtml(transaction.newArticle?.nom || '—')}</span>
                <span class="detail-qty">x1</span>
                <span class="detail-price">${formatEur(transaction.newArticle?.prix || 0)}</span>
            </div>
            <div class="detail-item" style="border-top: 1px solid var(--accent); margin-top:6px; padding-top:6px;">
                <span class="detail-name"><strong>Différence</strong></span>
                <span class="detail-qty"></span>
                <span class="detail-price" style="color:${diff > 0 ? 'var(--danger)' : diff < 0 ? 'var(--success)' : 'var(--text3)'};">
                    <strong>${diffLabel}</strong>
                </span>
            </div>`;
    }

    modal.innerHTML = `
        <div class="modal-content details-content">
            <div class="modal-header">
                <h3><i class="fas fa-receipt"></i> Détail de la transaction</h3>
                <button class="close-modal-btn">&times;</button>
            </div>
            <div class="details-body">
                <div class="details-info">
                    <p><strong>Date :</strong> ${transaction.date} à ${transaction.time}</p>
                    ${transaction.type === 'vente' ? `<p><strong>Mode :</strong> ${transaction.mode}</p>` : ''}
                    <p><strong>Type :</strong> ${transaction.type === 'vente' ? 'Vente' : transaction.type === 'retour' ? 'Retour client' : 'Échange client'}</p>
                </div>
                <div class="details-items">
                    <h4>Articles :</h4>
                    ${itemsHtml}
                </div>
                ${transaction.type === 'vente' ? `<div class="details-total"><strong>Total : ${formatEur(transaction.total)}</strong></div>` : ''}
                <button class="btn-reprint-detail" id="reprintDetailBtn">
                    <i class="fas fa-print"></i> Réimprimer le ticket
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('.close-modal-btn').onclick = () => modal.remove();
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    modal.querySelector('#reprintDetailBtn').onclick = () => {
        reprintTicket(transaction);
        modal.remove();
    };
}

function reprintTicket(transaction) {
    if (!transaction.type) transaction.type = 'vente';
    if (transaction.type === 'retour' || transaction.type === 'echange') {
        const originalReMode = reMode;
        const originalReOldArticle = reOldArticle;
        const originalReNewArticle = reNewArticle;
        reMode = transaction.type === 'retour' ? 'return' : 'exchange';
        reOldArticle = transaction.oldArticle ? { nom: transaction.oldArticle.nom, prix_unitaire: transaction.oldArticle.prix } : null;
        reNewArticle = transaction.newArticle ? { nom: transaction.newArticle.nom, prix_unitaire: transaction.newArticle.prix } : null;
        printReturnExchangeTicket();
        reMode = originalReMode;
        reOldArticle = originalReOldArticle;
        reNewArticle = originalReNewArticle;
        return;
    }

    const fakeSaleData = {
        cart: transaction.items.map(item => ({
            nom: item.nom,
            prix_unitaire: item.prix,
            discount: item.discount || 0,
            quantity: item.quantite
        })),
        total: transaction.total,
        received: transaction.received || transaction.total,
        change: transaction.received ? +(transaction.received - transaction.total).toFixed(2) : 0,
        modePaiement: transaction.mode,
        date: new Date(`${transaction.date} ${transaction.time}`)
    };

    const originalLastSaleData = lastSaleData;
    lastSaleData = fakeSaleData;
    printTicket();
    lastSaleData = originalLastSaleData;
}

// ─── PAIEMENT MULTIPLE ───
function updateMultiTotals() {
    const total = getCartTotal();
    let totalPaid = 0;

    document.querySelectorAll('#multiPaymentsList .multi-amount').forEach(input => {
        const val = parseFloat(input.value) || 0;
        totalPaid += val;
    });

    totalPaid = Math.round(totalPaid * 100) / 100;
    const remaining = Math.max(0, total - totalPaid);

    document.getElementById('multiTotalPaid').textContent = formatEur(totalPaid);
    document.getElementById('multiRemaining').textContent = formatEur(remaining);

    const validateBtn = document.getElementById('validateMultiPayBtn');
    validateBtn.disabled = (totalPaid < total);

    return { total, totalPaid, remaining };
}

function addMultiPaymentRow() {
    const container = document.getElementById('multiPaymentsList');
    const row = document.createElement('div');
    row.className = 'multi-payment-row';
    row.innerHTML = `
        <select class="multi-method">
            <option value="cash">Espèces</option>
            <option value="card">Carte</option>
            <option value="qr">QR code</option>
        </select>
        <input type="number" class="multi-amount" placeholder="Montant" step="0.01" min="0">
        <button class="remove-multi-row">🗑</button>
    `;
    container.appendChild(row);

    // Activer tous les boutons supprimer
    document.querySelectorAll('.remove-multi-row').forEach(btn => btn.disabled = false);

    // Ajouter les événements
    row.querySelector('.multi-amount').addEventListener('input', updateMultiTotals);
    row.querySelector('.multi-method').addEventListener('change', updateMultiTotals);
    row.querySelector('.remove-multi-row').addEventListener('click', () => {
        if (container.children.length > 1) {
            row.remove();
            updateMultiTotals();
        }
    });
}

function resetMultiPayModal() {
    const container = document.getElementById('multiPaymentsList');
    container.innerHTML = `
        <div class="multi-payment-row">
            <select class="multi-method">
                <option value="cash">Espèces</option>
                <option value="card">Carte</option>
                <option value="qr">QR code</option>
            </select>
            <input type="number" class="multi-amount" placeholder="Montant" step="0.01" min="0">
            <button class="remove-multi-row" disabled>🗑</button>
        </div>
    `;

    document.querySelectorAll('#multiPaymentsList .multi-amount').forEach(input => {
        input.addEventListener('input', updateMultiTotals);
    });
    document.querySelectorAll('#multiPaymentsList .multi-method').forEach(select => {
        select.addEventListener('change', updateMultiTotals);
    });

    updateMultiTotals();
}

async function processCardPaymentOnly(amount) {
    // Stocker temporairement
    sessionStorage.setItem('multiPayPending', JSON.stringify({
        type: 'card',
        amount: amount
    }));

    // Ouvrir modal Stripe
    document.getElementById('stripeAmount').textContent = formatEur(amount);
    stripeModal.style.display = 'flex';
    stripeError.textContent = '';
    stripeError.style.display = 'none';

    if (!stripeInstance) {
        stripeError.textContent = 'Stripe non chargé';
        stripeError.style.display = 'block';
        return;
    }

    stripeElements = stripeInstance.elements();
    stripeCardElement = stripeElements.create('card', {
        style: {
            base: { fontSize: '16px', color: '#1e2a3b', fontFamily: 'Plus Jakarta Sans, sans-serif' }
        }
    });
    stripeCardElement.mount('#stripe-card-element');
}

async function processQrPaymentOnly(amount, allPayments = null) {
    if (allPayments) {
        sessionStorage.setItem('multiPayAllPayments', JSON.stringify(allPayments));
    }
    sessionStorage.setItem('multiPayPending', JSON.stringify({
        type: 'qr',
        amount: amount
    }));

    // Ouvrir modal QR
    const total = amount;
    qrAmount.textContent = formatEur(total);
    qrContainer.innerHTML = '<div class="qr-loading">Génération du QR code…</div>';
    qrModal.style.display = 'flex';

    try {
        const res = await fetch(SUPABASE_FUNCTION_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: total, currency: 'eur', type: 'qr' })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        if (!data.url) throw new Error('Pas d\'URL');

        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(data.url)}`;
        qrContainer.innerHTML = `
            <div style="text-align:center;">
                <img src="${qrCodeUrl}" style="width:200px;">
                <p>Le client scanne ce code</p>
                <button id="qrMultiPaidBtn" class="btn-primary">J'ai reçu le paiement</button>
            </div>`;
        document.getElementById('qrMultiPaidBtn')?.addEventListener('click', async () => {
            qrModal.style.display = 'none';
            const allPaymentsStored = sessionStorage.getItem('multiPayAllPayments');
            sessionStorage.removeItem('multiPayPending');
            sessionStorage.removeItem('multiPayAllPayments');

            if (allPaymentsStored) {
                const paymentsData = JSON.parse(allPaymentsStored);
                await enregistrerVente(getCartTotal(), total, 'QR code', paymentsData);
            } else {
                await enregistrerVente(getCartTotal(), total, 'QR code');
            }
        });
    } catch (err) {
        qrContainer.innerHTML = `<div style="color:red;">${err.message}</div>`;
    }
}

// ─── RETOUR / ÉCHANGE ───
let reMode = null; // 'return' ou 'exchange'
let reOldArticle = null;
let reNewArticle = null;

document.getElementById('returnExchangeCard')?.addEventListener('click', () => {
    reMode = null; reOldArticle = null; reNewArticle = null;
    reStep(0);
    document.getElementById('returnExchangeModal').style.display = 'flex';
});
document.getElementById('closeReturnExchangeModal')?.addEventListener('click', closeReModal);
document.getElementById('reCancelBtn')?.addEventListener('click', closeReModal);
document.getElementById('returnExchangeModal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('returnExchangeModal')) closeReModal();
});

document.getElementById('chooseReturnBtn')?.addEventListener('click', () => {
    reMode = 'return';
    document.getElementById('returnExchangeTitle').innerHTML = '<i class="fas fa-undo"></i> Retour';
    reStep(1);
});
document.getElementById('chooseExchangeBtn')?.addEventListener('click', () => {
    reMode = 'exchange';
    document.getElementById('returnExchangeTitle').innerHTML = '<i class="fas fa-arrows-rotate"></i> Échange';
    reStep(1);
});

// Scan article retourné
document.getElementById('reArticleScanBtn')?.addEventListener('click', () => reSearchByBarcode());
document.getElementById('reArticleInput')?.addEventListener('keypress', e => { if (e.key === 'Enter') reSearchByBarcode(); });

// Recherche nom article retourné
document.getElementById('reArticleSearchBtn')?.addEventListener('click', () => reSearchByName());
document.getElementById('reArticleSearchInput')?.addEventListener('keypress', e => { if (e.key === 'Enter') reSearchByName(); });

// Scan nouvel article (échange)
document.getElementById('reNewArticleScanBtn')?.addEventListener('click', () => reSearchNewByBarcode());
document.getElementById('reNewArticleInput')?.addEventListener('keypress', e => { if (e.key === 'Enter') reSearchNewByBarcode(); });

// Recherche nom nouvel article (échange)
document.getElementById('reNewArticleSearchBtn')?.addEventListener('click', () => reSearchNewByName());
document.getElementById('reNewArticleSearchInput')?.addEventListener('keypress', e => { if (e.key === 'Enter') reSearchNewByName(); });

document.getElementById('reConfirmBtn')?.addEventListener('click', confirmReturnExchange);

function closeReModal() {
    document.getElementById('returnExchangeModal').style.display = 'none';
    reMode = null; reOldArticle = null; reNewArticle = null;
}

function reStep(step) {
    document.getElementById('reStep0').style.display = step === 0 ? 'block' : 'none';
    document.getElementById('reStep1').style.display = step >= 1 ? 'block' : 'none';
    document.getElementById('reStep2').style.display = step === 2 ? 'block' : 'none';
    document.getElementById('reModalFoot').style.display = step >= 1 ? 'flex' : 'none';
    document.getElementById('reConfirmBtn').disabled = true;
    if (step === 1) {
        document.getElementById('reArticleInput').value = '';
        document.getElementById('reArticleSearchInput').value = '';
        document.getElementById('reArticleFound').style.display = 'none';
        document.getElementById('reSearchResults').style.display = 'none';
    }
}

async function reSearchByBarcode() {
    const code = document.getElementById('reArticleInput').value.trim();
    if (!code) return;
    const { data, error } = await supabase.from('w_articles')
        .select('id, nom, code_barre, prix_unitaire, stock_actuel, photo_url')
        .eq('code_barre', code).eq('actif', true).single();
    if (error || !data) { alert('Article non trouvé'); return; }
    reOldArticle = data;
    displayReOldArticle();
}

async function reSearchByName() {
    const term = document.getElementById('reArticleSearchInput').value.trim();
    if (!term) return;
    const { data, error } = await supabase.from('w_articles')
        .select('id, nom, code_barre, prix_unitaire, stock_actuel, photo_url')
        .ilike('nom', `%${term}%`).eq('actif', true).limit(8);
    if (error || !data?.length) { alert('Aucun résultat'); return; }
    const container = document.getElementById('reSearchResults');
    container.style.display = 'block';
    container.innerHTML = data.map(a => `
        <div class="result-item" style="cursor:pointer;" data-article='${JSON.stringify(a)}'>
            <div class="result-info">
                <div class="result-name">${escapeHtml(a.nom)}</div>
            </div>
            <div class="result-price">${formatEur(a.prix_unitaire)}</div>
        </div>
    `).join('');
    container.querySelectorAll('.result-item').forEach(item => {
        item.addEventListener('click', () => {
            reOldArticle = JSON.parse(item.dataset.article);
            container.style.display = 'none';
            displayReOldArticle();
        });
    });
}

function displayReOldArticle() {
    const box = document.getElementById('reArticleFound');
    box.querySelector('.re-article-name').textContent = reOldArticle.nom;
    box.querySelector('.re-article-price').textContent = formatEur(reOldArticle.prix_unitaire);
    box.querySelector('.re-article-refund').textContent = reMode === 'return'
        ? `À rembourser au client : ${formatEur(reOldArticle.prix_unitaire)}`
        : `Article à échanger — ${formatEur(reOldArticle.prix_unitaire)}`;
    box.style.display = 'block';

    if (reMode === 'return') {
        document.getElementById('reConfirmBtn').disabled = false;
    } else {
        // Passer à l'étape 2
        document.getElementById('reStep2').style.display = 'block';
        document.getElementById('reSummaryOld') && (document.getElementById('reSummaryOld').textContent = '');
        document.querySelector('.re-summary-old').textContent = `Article retourné : ${reOldArticle.nom} — ${formatEur(reOldArticle.prix_unitaire)}`;
        document.getElementById('reNewArticleInput').value = '';
        document.getElementById('reNewArticleSearchInput').value = '';
        document.getElementById('reNewArticleFound').style.display = 'none';
        document.getElementById('reExchangeSummary').style.display = 'none';
    }
}

async function reSearchNewByBarcode() {
    const code = document.getElementById('reNewArticleInput').value.trim();
    if (!code) return;
    const { data, error } = await supabase.from('w_articles')
        .select('id, nom, prix_unitaire, stock_actuel')
        .eq('code_barre', code).eq('actif', true).single();
    if (error || !data) { alert('Article non trouvé'); return; }
    reNewArticle = data;
    displayReNewArticle();
}

async function reSearchNewByName() {
    const term = document.getElementById('reNewArticleSearchInput').value.trim();
    if (!term) return;
    const { data, error } = await supabase.from('w_articles')
        .select('id, nom, prix_unitaire, stock_actuel')
        .ilike('nom', `%${term}%`).eq('actif', true).limit(8);
    if (error || !data?.length) { alert('Aucun résultat'); return; }
    const container = document.getElementById('reNewSearchResults');
    container.style.display = 'block';
    container.innerHTML = data.map(a => `
        <div class="result-item" style="cursor:pointer;" data-article='${JSON.stringify(a)}'>
            <div class="result-info">
                <div class="result-name">${escapeHtml(a.nom)}</div>
            </div>
            <div class="result-price">${formatEur(a.prix_unitaire)}</div>
        </div>
    `).join('');
    container.querySelectorAll('.result-item').forEach(item => {
        item.addEventListener('click', () => {
            reNewArticle = JSON.parse(item.dataset.article);
            container.style.display = 'none';
            displayReNewArticle();
        });
    });
}

function displayReNewArticle() {
    const box = document.getElementById('reNewArticleFound');
    const diff = +(reNewArticle.prix_unitaire - reOldArticle.prix_unitaire).toFixed(2);
    let summaryHtml = '';
    let summaryClass = '';

    if (diff === 0) {
        summaryHtml = '<i class="fas fa-check-circle"></i> Prix identique — aucun montant à régler';
        summaryClass = 'equal';
    } else if (diff > 0) {
        summaryHtml = `<i class="fas fa-arrow-up"></i> Le client doit payer la différence : <strong>${formatEur(diff)}</strong>`;
        summaryClass = 'topup';
    } else {
        summaryHtml = `<i class="fas fa-arrow-down"></i> À rembourser au client : <strong>${formatEur(Math.abs(diff))}</strong>`;
        summaryClass = 'refund';
    }

    box.innerHTML = `
        <div class="re-article-name">${escapeHtml(reNewArticle.nom)}</div>
        <div class="re-article-price">${formatEur(reNewArticle.prix_unitaire)}</div>
    `;
    box.style.display = 'block';

    const summary = document.getElementById('reExchangeSummary');
    summary.innerHTML = `<div class="re-exchange-result ${summaryClass}">${summaryHtml}</div>`;
    summary.style.display = 'block';

    document.getElementById('reConfirmBtn').disabled = false;
}

async function confirmReturnExchange() {
    if (!reOldArticle) return;
    if (reMode === 'exchange' && !reNewArticle) return;

    const diff = (reMode === 'exchange' && reNewArticle && reOldArticle)
        ? +(reNewArticle.prix_unitaire - reOldArticle.prix_unitaire).toFixed(2)
        : 0;

    const confirmMsg = reMode === 'return'
        ? `Confirmer le retour de "${reOldArticle.nom}" et rembourser ${formatEur(reOldArticle.prix_unitaire)} ?`
        : diff === 0
            ? `Confirmer l'échange de "${reOldArticle.nom}" contre "${reNewArticle.nom}" (même prix) ?`
            : diff > 0
                ? `Confirmer l'échange ? Le client paie ${formatEur(diff)} en plus.`
                : `Confirmer l'échange ? Rembourser ${formatEur(Math.abs(diff))} au client.`;

    if (!confirm(confirmMsg)) return;

    try {
        // Retour : remettre en stock l'ancien article
        const { data: oldStock } = await supabase.from('w_articles').select('stock_actuel').eq('id', reOldArticle.id).single();
        await supabase.from('w_articles').update({ stock_actuel: oldStock.stock_actuel + 1 }).eq('id', reOldArticle.id);
        await supabase.from('w_mouvements').insert({
            article_id: reOldArticle.id,
            type: 'entree',
            quantite: 1,
            utilisateur_id: currentUser?.id,
            motif: reMode === 'return' ? 'retour' : 'echange',
            commentaire: reMode === 'return'
                ? `Retour client — ${reOldArticle.nom} — Remboursement : ${formatEur(reOldArticle.prix_unitaire)}`
                : `Échange client — Retour : ${reOldArticle.nom} — Nouvel article : ${reNewArticle.nom}`,
            stock_avant: oldStock.stock_actuel,
            stock_apres: oldStock.stock_actuel + 1,
            date_mouvement: new Date().toISOString().split('T')[0],
            heure_mouvement: new Date().toLocaleTimeString('fr-FR')
        });

        if (reMode === 'exchange') {
            // Sortie du nouvel article
            const { data: newStock } = await supabase.from('w_articles').select('stock_actuel').eq('id', reNewArticle.id).single();
            await supabase.from('w_articles').update({ stock_actuel: newStock.stock_actuel - 1 }).eq('id', reNewArticle.id);
            await supabase.from('w_mouvements').insert({
                article_id: reNewArticle.id,
                type: 'sortie',
                quantite: 1,
                utilisateur_id: currentUser?.id,
                motif: 'echange',
                commentaire: `Échange client — Nouvel article : ${reNewArticle.nom} — Article retourné : ${reOldArticle.nom}`,
                stock_avant: newStock.stock_actuel,
                stock_apres: newStock.stock_actuel - 1,
                date_mouvement: new Date().toISOString().split('T')[0],
                heure_mouvement: new Date().toLocaleTimeString('fr-FR')
            });
        }

        printReturnExchangeTicket();
        closeReModal();

    } catch (err) {
        console.error(err);
        alert('Erreur lors de l\'enregistrement');
    }
}

function printReturnExchangeTicket() {
    const date = new Date();
    const dateStr = date.toLocaleDateString('fr-FR');
    const timeStr = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const diff = (reMode === 'exchange' && reNewArticle && reOldArticle)
        ? +(reNewArticle.prix_unitaire - reOldArticle.prix_unitaire).toFixed(2)
        : 0;

    let bodyHtml = '';

    if (reMode === 'return') {
        bodyHtml = `
            <tr><td>Article retourné</td><td class="r">${escapeHtml(reOldArticle.nom)}</td></tr>
            <tr><td>Prix remboursé</td><td class="r">${formatEur(reOldArticle.prix_unitaire)}</td></tr>
        `;
    } else {
        bodyHtml = `
            <tr><td>Article retourné</td><td class="r">${escapeHtml(reOldArticle.nom)}</td></tr>
            <tr><td>Prix retourné</td><td class="r">${formatEur(reOldArticle.prix_unitaire)}</td></tr>
            <tr><td>Nouvel article</td><td class="r">${escapeHtml(reNewArticle.nom)}</td></tr>
            <tr><td>Prix nouvel article</td><td class="r">${formatEur(reNewArticle.prix_unitaire)}</td></tr>
            ${diff === 0
                ? `<tr><td colspan="2" style="text-align:center;">— Prix identique, aucun montant à régler —</td></tr>`
                : diff > 0
                    ? `<tr><td><strong>Supplément client</strong></td><td class="r"><strong>${formatEur(diff)}</strong></td></tr>`
                    : `<tr><td><strong>Remboursement client</strong></td><td class="r"><strong>${formatEur(Math.abs(diff))}</strong></td></tr>`
            }
        `;
    }

    ticketPrint.innerHTML = `
        <div class="ticket">
            <div class="ticket-store">NeXeN Store</div>
            <div class="ticket-meta">${dateStr} — ${timeStr}</div>
            <div class="ticket-meta">Caissier : ${currentUser?.username || ''}</div>
            <hr class="ticket-divider">
            <div class="ticket-meta" style="font-weight:bold; font-size:13px;">
                ${reMode === 'return' ? '*** RETOUR CLIENT ***' : '*** ÉCHANGE CLIENT ***'}
            </div>
            <hr class="ticket-divider">
            <table class="ticket-totals">
                ${bodyHtml}
            </table>
            <hr class="ticket-divider">
            <div class="ticket-footer">Merci de votre confiance !<br>NeXeN Store</div>
        </div>
    `;

    window.print();
}

init();