import { supabase } from './supabaseClient.js';

// ─── ÉTAT ───
let currentUser = null;
let cart = [];
let taxRate = 20;
let taxEnabled = false;
let amountGiven = 0;
let pendingArticle = null;
let lastSaleData = null;

const denominations = [200, 100, 50, 20, 10, 5, 2, 1, 0.50, 0.20, 0.10, 0.05, 0.02, 0.01];
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

// ─── INIT ───
function init() {
    loadCurrentUser();
    loadTaxConfig();
    checkCaisseAccess();
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

function setupBeforeUnload() {
    window.addEventListener('beforeunload', (e) => {
        if (cart.length > 0) { e.preventDefault(); e.returnValue = ''; }
    });
}

// ─── ÉVÉNEMENTS ───
function setupEventListeners() {
    scanInput.addEventListener('keypress', e => { if (e.key === 'Enter') handleScan(scanInput.value); });
    scanBtn.addEventListener('click', () => handleScan(scanInput.value));

    searchNameBtn.addEventListener('click', handleSearchByName);
    searchNameInput.addEventListener('keypress', e => { if (e.key === 'Enter') handleSearchByName(); });
    closeResultsBtn.addEventListener('click', () => { searchResults.style.display = 'none'; searchNameInput.value = ''; });

    priceCheckBtn.addEventListener('click', handlePriceCheck);
    priceCheckInput.addEventListener('keypress', e => { if (e.key === 'Enter') handlePriceCheck(); });

    clearCartBtn.addEventListener('click', clearCart);
    validateSaleBtn.addEventListener('click', validateSale);
    logoutBtn.addEventListener('click', handleLogout);
    resetAmountBtn.addEventListener('click', resetAmount);

    closeSaleBtn.addEventListener('click', () => { saleModal.style.display = 'none'; });
    printTicketBtn.addEventListener('click', printTicket);

    // Boutons + billets/pièces
    document.querySelectorAll('.mc-btn.plus.money-btn').forEach(btn => {
        btn.addEventListener('click', () => addMoney(parseFloat(btn.dataset.value)));
    });

    // Boutons - billets/pièces
    document.querySelectorAll('.mc-btn.minus').forEach(btn => {
        btn.addEventListener('click', () => removeMoney(parseFloat(btn.dataset.value)));
    });

    // Clic sur image billet/pièce = +1
    document.querySelectorAll('.money-img').forEach(img => {
        img.addEventListener('click', () => {
            const val = parseFloat(img.closest('.money-item').dataset.value);
            addMoney(val);
        });
    });

    // Modal quantité
    confirmQuantityBtn.addEventListener('click', addToCartWithQuantity);
    document.querySelector('.minus-qty').addEventListener('click', () => {
        const v = parseInt(modalQuantity.value) || 1;
        if (v > 1) modalQuantity.value = v - 1;
    });
    document.querySelector('.plus-qty').addEventListener('click', () => {
        modalQuantity.value = (parseInt(modalQuantity.value) || 1) + 1;
    });
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => { quantityModal.style.display = 'none'; pendingArticle = null; });
    });

    // Fermer overlay en cliquant hors modal
    quantityModal.addEventListener('click', e => { if (e.target === quantityModal) { quantityModal.style.display = 'none'; pendingArticle = null; } });
    saleModal.addEventListener('click', e => { if (e.target === saleModal) saleModal.style.display = 'none'; });
}

// ─── GESTION MONNAIE ───
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
        .from('w_articles')
        .select('id, nom, code_barre, prix_unitaire, stock_actuel')
        .eq('code_barre', code.trim())
        .eq('actif', true)
        .single();
    if (error || !article) { alert('Article non trouvé'); scanInput.value = ''; return; }
    scanInput.value = '';
    openQuantityModal(article);
}

// ─── RECHERCHE ───
async function handleSearchByName() {
    const term = searchNameInput.value.trim();
    if (!term) return;
    const { data: articles, error } = await supabase
        .from('w_articles')
        .select('id, nom, code_barre, prix_unitaire, stock_actuel')
        .ilike('nom', `%${term}%`)
        .eq('actif', true)
        .limit(10);
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
        .from('w_articles')
        .select('nom, prix_unitaire')
        .eq('code_barre', code)
        .eq('actif', true)
        .single();
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
        cartBody.innerHTML = `<tr class="empty-row"><td colspan="5"><div class="empty-state"><i class="fas fa-basket-shopping"></i><span>Panier vide — scannez ou recherchez un article</span></div></td></tr>`;
        totalTVA.textContent = '0,00 €';
        totalTTC.textContent = '0,00 €';
        btnTotal.textContent = '0,00 €';
        validateSaleBtn.disabled = true;
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
    validateSaleBtn.disabled = false;
    calculateChange();
}

function clearCart() {
    if (cart.length === 0) return;
    if (confirm('Vider tout le panier ?')) { cart = []; updateCartDisplay(); resetAmount(); }
}

// ─── VENTE ───
async function validateSale() {
    if (cart.length === 0) { alert('Panier vide'); return; }
    const total = getCartTotal();
    if (amountGiven < total) { alert(`Montant insuffisant. Total : ${formatEur(total)}`); return; }
    if (!confirm(`Confirmer la vente de ${cart.length} article(s) pour ${formatEur(total)} ?`)) return;

    try {
        const cartSnapshot = [...cart];
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
                commentaire: `Vente caisse — Total: ${formatEur(total)} — Reçu: ${formatEur(amountGiven)}`,
                stock_avant: article.stock_actuel,
                stock_apres: newStock,
                date_mouvement: new Date().toISOString().split('T')[0],
                heure_mouvement: new Date().toLocaleTimeString('fr-FR')
            });
        }

        const change = +(amountGiven - total).toFixed(2);
        lastSaleData = { cart: cartSnapshot, total, received: amountGiven, change, date: new Date() };

        // Afficher modal de confirmation
        document.getElementById('saleTotal').textContent = formatEur(total);
        document.getElementById('saleReceived').textContent = formatEur(amountGiven);
        document.getElementById('saleChange').textContent = formatEur(change);
        saleModal.style.display = 'flex';

        // Reset
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
    const { cart: items, total, received, change, date } = lastSaleData;

    const tvaAmount = taxEnabled ? +(total - total / (1 + taxRate / 100)).toFixed(2) : 0;
    const htAmount = taxEnabled ? +(total - tvaAmount).toFixed(2) : total;

    const dateStr = date.toLocaleDateString('fr-FR');
    const timeStr = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    const rows = items.map(i => {
        const lineTotal = +(i.prix_unitaire * i.quantity).toFixed(2);
        return `<tr>
            <td>${escapeHtml(i.nom)}</td>
            <td class="right">${i.quantity}</td>
            <td class="right">${formatEur(i.prix_unitaire)}</td>
            <td class="right">${formatEur(lineTotal)}</td>
        </tr>`;
    }).join('');

    ticketPrint.innerHTML = `
        <div class="ticket">
            <div class="ticket-header">
                <h1>NeXeN Store</h1>
                <p>${dateStr} — ${timeStr}</p>
                <p>Caissier : ${currentUser?.username || '—'}</p>
            </div>
            <hr class="ticket-divider">
            <table class="ticket-items">
                <thead><tr><th>Article</th><th class="right">Qté</th><th class="right">P.U.</th><th class="right">Total</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
            <hr class="ticket-divider">
            <table class="ticket-totals">
                ${taxEnabled ? `
                <tr><td>Montant HT</td><td class="right">${formatEur(htAmount)}</td></tr>
                <tr><td>TVA ${taxRate}%</td><td class="right">${formatEur(tvaAmount)}</td></tr>
                ` : ''}
                <tr class="grand"><td><strong>TOTAL TTC</strong></td><td class="right"><strong>${formatEur(total)}</strong></td></tr>
                <tr><td>Montant reçu</td><td class="right">${formatEur(received)}</td></tr>
                <tr><td><strong>Monnaie rendue</strong></td><td class="right"><strong>${formatEur(change)}</strong></td></tr>
            </table>
            <hr class="ticket-divider">
            <div class="ticket-footer">
                <p>Merci de votre achat !</p>
                <p>À bientôt chez NeXeN Store</p>
            </div>
        </div>`;

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

init();