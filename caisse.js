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
let splitPayments = []; // Pour stocker les paiements fractionnés
let splitModeActive = false; // Mode fractionné activé


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
    document.getElementById('openSplitBtn')?.addEventListener('click', openSplitPayment);
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

    // Paiement fractionné
    const validateSaleBtnOld = validateSaleBtn;
    // Remplacer le comportement du bouton validateSaleBtn pour ouvrir le fractionné
    // On va plutôt modifier le HTML pour avoir un nouveau bouton

    // Ajouter ces lignes à la fin de setupEventListeners()
    document.getElementById('addPaymentBtn')?.addEventListener('click', addPaymentRow);
    document.getElementById('validateSplitPaymentBtn')?.addEventListener('click', validateSplitPayment);
    document.getElementById('closeSplitPanel')?.addEventListener('click', closeSplitPanel);

    // Délégation pour supprimer les lignes de paiement
    document.getElementById('paymentsList')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.remove-payment-btn');
        if (btn) {
            removePaymentRow(btn);
        }
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

// ─── PAIEMENT FRACTIONNÉ ───
function openSplitPayment() {
    if (cart.length === 0) {
        alert('Panier vide');
        return;
    }

    splitModeActive = true;
    const total = getCartTotal();
    document.getElementById('splitTotalDue').textContent = formatEur(total);
    document.getElementById('splitTotalPaid').textContent = '0,00 €';
    document.getElementById('splitRemaining').innerHTML = `Reste à payer : <strong>${formatEur(total)}</strong>`;

    // Réinitialiser les paiements
    splitPayments = [];
    const paymentsList = document.getElementById('paymentsList');
    paymentsList.innerHTML = `
        <div class="payment-item" data-idx="0">
            <select class="payment-method">
                <option value="cash">Espèces</option>
                <option value="card">Carte bancaire</option>
            </select>
            <input type="number" class="payment-amount" placeholder="Montant" step="0.01" min="0">
            <button class="remove-payment-btn" disabled><i class="fas fa-trash"></i></button>
        </div>
    `;

    document.getElementById('splitPaymentPanel').style.display = 'block';
    attachPaymentEvents();
}

function attachPaymentEvents() {
    const paymentsList = document.getElementById('paymentsList');

    // Événements sur les champs existants
    paymentsList.querySelectorAll('.payment-amount').forEach(input => {
        input.removeEventListener('input', updateSplitTotals);
        input.addEventListener('input', updateSplitTotals);
    });

    paymentsList.querySelectorAll('.payment-method').forEach(select => {
        select.removeEventListener('change', updateSplitTotals);
        select.addEventListener('change', updateSplitTotals);
    });
}

function addPaymentRow() {
    const paymentsList = document.getElementById('paymentsList');
    const idx = paymentsList.children.length;
    const row = document.createElement('div');
    row.className = 'payment-item';
    row.setAttribute('data-idx', idx);
    row.innerHTML = `
        <select class="payment-method">
            <option value="cash">Espèces</option>
            <option value="card">Carte bancaire</option>
        </select>
        <input type="number" class="payment-amount" placeholder="Montant" step="0.01" min="0">
        <button class="remove-payment-btn"><i class="fas fa-trash"></i></button>
    `;
    paymentsList.appendChild(row);

    // Activer tous les boutons supprimer sauf le premier
    const removeBtns = paymentsList.querySelectorAll('.remove-payment-btn');
    removeBtns.forEach(btn => btn.disabled = false);

    attachPaymentEvents();
    updateSplitTotals();
}

function removePaymentRow(btn) {
    const row = btn.closest('.payment-item');
    const paymentsList = document.getElementById('paymentsList');
    if (paymentsList.children.length > 1) {
        row.remove();
        // Re-indexer
        paymentsList.querySelectorAll('.payment-item').forEach((item, i) => {
            item.setAttribute('data-idx', i);
        });
        updateSplitTotals();
    }
}

function updateSplitTotals() {
    const total = getCartTotal();
    let totalPaid = 0;
    const payments = [];

    document.querySelectorAll('#paymentsList .payment-item').forEach(item => {
        const amount = parseFloat(item.querySelector('.payment-amount').value) || 0;
        const method = item.querySelector('.payment-method').value;
        totalPaid += amount;
        payments.push({ amount, method });
    });

    totalPaid = Math.round(totalPaid * 100) / 100;
    document.getElementById('splitTotalPaid').textContent = formatEur(totalPaid);

    const remaining = Math.max(0, total - totalPaid);
    document.getElementById('splitRemaining').innerHTML = `Reste à payer : <strong>${formatEur(remaining)}</strong>`;

    if (remaining > 0) {
        document.getElementById('splitRemaining').className = 'split-remaining split-warning';
    } else {
        document.getElementById('splitRemaining').className = 'split-remaining split-success';
    }

    const validateBtn = document.getElementById('validateSplitPaymentBtn');
    validateBtn.disabled = (totalPaid < total);

    // Stocker les paiements pour validation
    splitPayments = payments;
}

async function validateSplitPayment() {
    const total = getCartTotal();
    let totalPaid = splitPayments.reduce((sum, p) => sum + p.amount, 0);
    totalPaid = Math.round(totalPaid * 100) / 100;

    if (totalPaid < total) {
        alert(`Montant total insuffisant. Total dû : ${formatEur(total)}`);
        return;
    }

    // Traiter chaque paiement
    let cashReceived = 0;
    let cardPayments = [];

    for (const payment of splitPayments) {
        if (payment.method === 'cash') {
            cashReceived += payment.amount;
        } else if (payment.method === 'card') {
            cardPayments.push(payment.amount);
        }
    }

    // Si pas de paiement par carte, valider directement
    if (cardPayments.length === 0) {
        await enregistrerVenteFractionnee(total, cashReceived, 'espèces');
    } else {
        // Pour le premier paiement par carte, ouvrir Stripe
        await processCardPayments(total, cashReceived, cardPayments);
    }
}

async function enregistrerVenteFractionnee(total, cashReceived, modePaiement) {
    // Construction du commentaire avec détails des paiements
    let paymentDetails = '';
    if (splitPayments.length > 0) {
        paymentDetails = splitPayments.map(p => {
            if (p.method === 'cash') return `${formatEur(p.amount)} espèces`;
            return `${formatEur(p.amount)} carte`;
        }).join(' + ');
    }

    const commentaire = `Vente caisse (${paymentDetails}) — Total: ${formatEur(total)}`;

    try {
        for (const item of cart) {
            const { data: article } = await supabase.from('w_articles').select('stock_actuel').eq('id', item.id).single();
            const newStock = article.stock_actuel - item.quantity;
            await supabase.from('w_articles').update({ stock_actuel: newStock, date_maj_stock: new Date() }).eq('id', item.id);
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

        lastSaleData = {
            cart: [...cart],
            total,
            received: total,
            change: 0,
            modePaiement: paymentDetails,
            date: new Date(),
            splitDetails: splitPayments
        };

        document.getElementById('saleTotal').textContent = formatEur(total);
        document.getElementById('saleReceived').textContent = formatEur(total);
        document.getElementById('saleChange').textContent = '—';
        document.getElementById('salePayMode').textContent = paymentDetails;
        saleModal.style.display = 'flex';

        cart = [];
        updateCartDisplay();
        resetAmount();
        closeSplitPanel();

    } catch (err) {
        console.error(err);
        alert('Erreur lors de l\'enregistrement de la vente');
    }
}

async function processCardPayments(total, cashReceived, cardPayments) {
    // Si plusieurs cartes, les traiter séquentiellement
    let totalCardPaid = cardPayments.reduce((a, b) => a + b, 0);
    let remainingCard = totalCardPaid;

    // Fermer le panel fractionné
    closeSplitPanel();

    // Pour l'instant, on traite la première carte
    // Dans une version future, on pourra faire plusieurs appels Stripe
    await enregistrerVenteFractionnee(total, cashReceived, `carte (${formatEur(cardPayments[0])}) + espèces (${formatEur(cashReceived)})`);
}

function closeSplitPanel() {
    splitModeActive = false;
    document.getElementById('splitPaymentPanel').style.display = 'none';
    splitPayments = [];
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
        .from('w_articles').select('id, nom, code_barre, prix_unitaire, stock_actuel')
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
        .from('w_articles').select('id, nom, code_barre, prix_unitaire, stock_actuel')
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
        cart.push({ id: pendingArticle.id, nom: pendingArticle.nom, prix_unitaire: pendingArticle.prix_unitaire, quantity });
    }
    quantityModal.style.display = 'none';
    pendingArticle = null;
    updateCartDisplay();
}

function getCartTotal() {
    return +cart.reduce((s, i) => s + i.prix_unitaire * i.quantity, 0).toFixed(2);
}

function updateCartDisplay() {
    if (cart.length === 0) {
        cartBody.innerHTML = `<tr class="empty-row"><td colspan="5"><div class="empty-state"><i class="fas fa-basket-shopping"></i><span>Panier vide</span></div></td></tr>`;
        totalTVA.textContent = '0,00 €';
        totalTTC.textContent = '0,00 €';
        btnTotal.textContent = '0,00 €';
        const openSplitBtn = document.getElementById('openSplitBtn');
        if (openSplitBtn) openSplitBtn.disabled = true;
        if (btnPayCard) btnPayCard.disabled = true;
        if (btnPayQr) btnPayQr.disabled = true;
        calculateChange();
        return;
    }

    let ttcTotal = 0;
    cartBody.innerHTML = cart.map((item, index) => {
        const lineTotal = +(item.prix_unitaire * item.quantity).toFixed(2);
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
                <td class="item-total">${formatEur(lineTotal)}</td>
                <td><button class="remove-item" onclick="window.removeFromCart(${index})"><i class="fas fa-trash"></i></button></td>
            </tr>`;
    }).join('');

    window.changeQty = (i, d) => { const q = cart[i].quantity + d; if (q < 1) cart.splice(i, 1); else cart[i].quantity = q; updateCartDisplay(); };
    window.removeFromCart = i => { cart.splice(i, 1); updateCartDisplay(); };

    ttcTotal = +ttcTotal.toFixed(2);
    const tvaAmount = taxEnabled ? +(ttcTotal - ttcTotal / (1 + taxRate / 100)).toFixed(2) : 0;

    totalTVA.textContent = formatEur(tvaAmount);
    totalTTC.textContent = formatEur(ttcTotal);
    btnTotal.textContent = formatEur(ttcTotal);
    const openSplitBtn = document.getElementById('openSplitBtn');
    if (openSplitBtn) openSplitBtn.disabled = false;
    if (btnPayQr) btnPayQr.disabled = false;
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
            await enregistrerVente(total, total, 'carte');
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
async function enregistrerVente(total, received, modePaiement) {
    const cartSnapshot = [...cart];
    try {
        for (const item of cartSnapshot) {
            const { data: article } = await supabase.from('w_articles').select('stock_actuel').eq('id', item.id).single();
            const newStock = article.stock_actuel - item.quantity;
            await supabase.from('w_articles').update({ stock_actuel: newStock, date_maj_stock: new Date() }).eq('id', item.id);
            await supabase.from('w_mouvements').insert({
                article_id: item.id,
                type: 'sortie',
                quantite: item.quantity,
                utilisateur_id: currentUser?.id,
                motif: 'vente',
                commentaire: `Vente caisse (${modePaiement}) — Total: ${formatEur(total)} — Reçu: ${formatEur(received)}`,
                stock_avant: article.stock_actuel,
                stock_apres: newStock,
                date_mouvement: new Date().toISOString().split('T')[0],
                heure_mouvement: new Date().toLocaleTimeString('fr-FR')
            });
        }

        const change = modePaiement === 'espèces' ? +(received - total).toFixed(2) : 0;
        lastSaleData = { cart: cartSnapshot, total, received, change, modePaiement, date: new Date() };

        document.getElementById('saleTotal').textContent = formatEur(total);
        document.getElementById('saleReceived').textContent = formatEur(received);
        document.getElementById('saleChange').textContent = modePaiement === 'espèces' ? formatEur(change) : '—';
        document.getElementById('salePayMode').textContent = modePaiement;
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
        const lineTotal = +(i.prix_unitaire * i.quantity).toFixed(2);
        return `
            <tr>
                <td>${escapeHtml(i.nom)}</td>
                <td class="r">${i.quantity}</td>
                <td class="r">${formatEur(i.prix_unitaire)}</td>
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
                    <td class="r">${modePaiement === 'carte' ? 'Carte bancaire' : modePaiement === 'QR code' ? 'QR code' : 'Espèces'}</td>
                </tr>
                <tr>
                    <td>Montant reçu</td>
                    <td class="r">${formatEur(received)}</td>
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
            .eq('type', 'sortie')
            .eq('motif', 'vente')
            .order('date_mouvement', { ascending: false })
            .order('heure_mouvement', { ascending: false })
            .limit(50);

        if (error) throw error;

        // Grouper par transaction (même date/heure et même commentaire)
        const transactions = new Map();
        mouvements.forEach(m => {
            const key = `${m.date_mouvement}_${m.heure_mouvement}_${m.commentaire}`;
            if (!transactions.has(key)) {
                transactions.set(key, {
                    id: key,
                    date: m.date_mouvement,
                    time: m.heure_mouvement,
                    total: 0,
                    mode: m.commentaire?.match(/\((.*?)\)/)?.[1] || 'inconnu',
                    items: []
                });
            }
            const transaction = transactions.get(key);
            const price = m.w_articles?.prix_unitaire || 0;
            transaction.total += price * m.quantite;
            transaction.items.push({
                nom: m.w_articles?.nom || 'Article',
                quantite: m.quantite,
                prix: price
            });
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
                ${lastTransactions.map((t, idx) => `
                    <div class="transaction-item" data-idx="${idx}">
                        <div class="transaction-header">
                            <div class="transaction-date">
                                <i class="fas fa-calendar"></i> ${t.date} ${t.time}
                            </div>
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
                            <button class="btn-reprint" data-idx="${idx}">
                                <i class="fas fa-print"></i> Réimprimer
                            </button>
                            <button class="btn-details" data-idx="${idx}">
                                <i class="fas fa-eye"></i> Détails
                            </button>
                        </div>
                    </div>
                `).join('')}
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
            showTransactionDetails(lastTransactions[idx]);
        };
    });
}

function showTransactionDetails(transaction) {
    const modal = document.createElement('div');
    modal.className = 'modal details-modal';
    modal.style.display = 'flex';

    const itemsHtml = transaction.items.map(item => `
        <div class="detail-item">
            <span class="detail-name">${escapeHtml(item.nom)}</span>
            <span class="detail-qty">x${item.quantite}</span>
            <span class="detail-price">${formatEur(item.prix * item.quantite)}</span>
        </div>
    `).join('');

    modal.innerHTML = `
        <div class="modal-content details-content">
            <div class="modal-header">
                <h3><i class="fas fa-receipt"></i> Détail de la transaction</h3>
                <button class="close-modal-btn">&times;</button>
            </div>
            <div class="details-body">
                <div class="details-info">
                    <p><strong>Date :</strong> ${transaction.date} à ${transaction.time}</p>
                    <p><strong>Mode :</strong> ${transaction.mode}</p>
                </div>
                <div class="details-items">
                    <h4>Articles :</h4>
                    ${itemsHtml}
                </div>
                <div class="details-total">
                    <strong>Total : ${formatEur(transaction.total)}</strong>
                </div>
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
    // Créer un objet lastSaleData factice pour réimpression
    const fakeSaleData = {
        cart: transaction.items.map(item => ({
            nom: item.nom,
            prix_unitaire: item.prix,
            quantity: item.quantite
        })),
        total: transaction.total,
        received: transaction.total,
        change: 0,
        modePaiement: transaction.mode,
        date: new Date(`${transaction.date} ${transaction.time}`)
    };

    const originalLastSaleData = lastSaleData;
    lastSaleData = fakeSaleData;
    printTicket();
    lastSaleData = originalLastSaleData;
}

init();