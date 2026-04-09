import { supabase } from './supabaseClient.js';

// ─── ÉTAT GLOBAL ───
let currentUser = null;
let cart = [];
let taxRate = 20;
let taxEnabled = false;
let amountGiven = 0;
let pendingArticle = null;

// Compteurs billets/pièces
const denominations = [200, 100, 50, 20, 10, 5, 2, 1, 0.50, 0.20, 0.10, 0.05, 0.02, 0.01];
const counts = {};
denominations.forEach(d => counts[d] = 0);

// ─── DOM ───
const usernameDisplay   = document.getElementById('usernameDisplay');
const scanInput         = document.getElementById('scanInput');
const scanBtn           = document.getElementById('scanBtn');
const searchNameInput   = document.getElementById('searchNameInput');
const searchNameBtn     = document.getElementById('searchNameBtn');
const searchResults     = document.getElementById('searchResults');
const resultsList       = document.getElementById('resultsList');
const closeResultsBtn   = document.getElementById('closeResultsBtn');
const priceCheckInput   = document.getElementById('priceCheckInput');
const priceCheckBtn     = document.getElementById('priceCheckBtn');
const priceDisplay      = document.getElementById('priceDisplay');
const cartBody          = document.getElementById('cartBody');
const totalTVA          = document.getElementById('totalTVA');
const totalTTC          = document.getElementById('totalTTC');
const taxLine           = document.getElementById('taxLine');
const taxRateSpan       = document.getElementById('taxRate');
const amountGivenDisplay= document.getElementById('amountGivenDisplay');
const resetAmountBtn    = document.getElementById('resetAmountBtn');
const changeDisplay     = document.getElementById('changeDisplay');
const changeAmount      = document.getElementById('changeAmount');
const insufficientDisplay = document.getElementById('insufficientDisplay');
const missingAmount     = document.getElementById('missingAmount');
const validateSaleBtn   = document.getElementById('validateSaleBtn');
const btnTotal          = document.getElementById('btnTotal');
const clearCartBtn      = document.getElementById('clearCartBtn');
const logoutBtn         = document.getElementById('logoutBtn');
const quantityModal     = document.getElementById('quantityModal');
const quantityArticleName = document.getElementById('quantityArticleName');
const modalQuantity     = document.getElementById('modalQuantity');
const availableStock    = document.getElementById('availableStock');
const confirmQuantityBtn= document.getElementById('confirmQuantityBtn');

// ─── INIT ───
async function init() {
    loadCurrentUser();
    loadTaxConfig();
    checkCaisseAccess();
    setupEventListeners();
    updateCartDisplay();
    setupBeforeUnload();
}

function loadCurrentUser() {
    const userJson = sessionStorage.getItem('current_user');
    if (!userJson) {
        window.location.href = 'accueil.html';
        return;
    }
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
    if (!hasCaissePerm || !isModuleEnabled) {
        window.location.href = 'accueil.html';
    }
}

// ─── BEFORE UNLOAD ───
function setupBeforeUnload() {
    window.addEventListener('beforeunload', (e) => {
        if (cart.length > 0) {
            e.preventDefault();
            e.returnValue = 'Des articles sont en caisse. Voulez-vous vraiment quitter ?';
        }
    });
}

// ─── ÉVÉNEMENTS ───
function setupEventListeners() {
    // Scan
    scanInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleScan(scanInput.value); });
    scanBtn.addEventListener('click', () => handleScan(scanInput.value));

    // Recherche
    searchNameBtn.addEventListener('click', handleSearchByName);
    searchNameInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSearchByName(); });
    closeResultsBtn.addEventListener('click', () => {
        searchResults.style.display = 'none';
        searchNameInput.value = '';
    });

    // Prix rapide
    priceCheckBtn.addEventListener('click', handlePriceCheck);
    priceCheckInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handlePriceCheck(); });

    // Panier
    clearCartBtn.addEventListener('click', clearCart);
    validateSaleBtn.addEventListener('click', validateSale);
    logoutBtn.addEventListener('click', handleLogout);

    // Reset montant
    resetAmountBtn.addEventListener('click', resetAmount);

    // Boutons billets/pièces — PLUS
    document.querySelectorAll('.qty-btn.plus.money-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const val = parseFloat(btn.dataset.value);
            counts[val] = (counts[val] || 0) + 1;
            updateCountDisplay(val);
            amountGiven = +(amountGiven + val).toFixed(2);
            updateAmountDisplay();
        });
    });

    // Boutons billets/pièces — MOINS
    document.querySelectorAll('.qty-btn.minus').forEach(btn => {
        btn.addEventListener('click', () => {
            const val = parseFloat(btn.dataset.value);
            if ((counts[val] || 0) > 0) {
                counts[val]--;
                updateCountDisplay(val);
                amountGiven = Math.max(0, +(amountGiven - val).toFixed(2));
                updateAmountDisplay();
            }
        });
    });

    // Visuels billets cliquables (= +1)
    document.querySelectorAll('.bill-visual').forEach(el => {
        const val = parseFloat(el.closest('.bill-item').dataset.value);
        el.addEventListener('click', () => {
            counts[val] = (counts[val] || 0) + 1;
            updateCountDisplay(val);
            amountGiven = +(amountGiven + val).toFixed(2);
            updateAmountDisplay();
        });
    });

    // Visuels pièces cliquables (= +1)
    document.querySelectorAll('.coin-visual').forEach(el => {
        const val = parseFloat(el.closest('.coin-item').dataset.value);
        el.addEventListener('click', () => {
            counts[val] = (counts[val] || 0) + 1;
            updateCountDisplay(val);
            amountGiven = +(amountGiven + val).toFixed(2);
            updateAmountDisplay();
        });
    });

    // Modal
    confirmQuantityBtn.addEventListener('click', addToCartWithQuantity);
    document.querySelector('.minus-qty').addEventListener('click', () => {
        const val = parseInt(modalQuantity.value) || 1;
        if (val > 1) modalQuantity.value = val - 1;
    });
    document.querySelector('.plus-qty').addEventListener('click', () => {
        const val = parseInt(modalQuantity.value) || 1;
        modalQuantity.value = val + 1;
    });
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            quantityModal.style.display = 'none';
            pendingArticle = null;
        });
    });
}

// ─── MONTANT ───
function updateCountDisplay(val) {
    const id = 'count-' + String(val).replace('.', '');
    const el = document.getElementById(id);
    if (el) el.textContent = counts[val] || 0;
}

function updateAmountDisplay() {
    amountGivenDisplay.textContent = amountGiven.toFixed(2) + ' €';
    calculateChange();
}

function resetAmount() {
    amountGiven = 0;
    denominations.forEach(d => {
        counts[d] = 0;
        updateCountDisplay(d);
    });
    amountGivenDisplay.textContent = '0.00 €';
    changeDisplay.style.display = 'none';
    insufficientDisplay.style.display = 'none';
}

function calculateChange() {
    const total = getCartTotal();
    if (amountGiven === 0) {
        changeDisplay.style.display = 'none';
        insufficientDisplay.style.display = 'none';
        return;
    }
    if (amountGiven >= total) {
        const change = +(amountGiven - total).toFixed(2);
        changeAmount.textContent = change.toFixed(2) + ' €';
        changeDisplay.style.display = 'block';
        insufficientDisplay.style.display = 'none';
    } else {
        const missing = +(total - amountGiven).toFixed(2);
        missingAmount.textContent = '−' + missing.toFixed(2) + ' €';
        insufficientDisplay.style.display = 'block';
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

// ─── RECHERCHE NOM ───
async function handleSearchByName() {
    const searchTerm = searchNameInput.value.trim();
    if (!searchTerm) return;

    const { data: articles, error } = await supabase
        .from('w_articles')
        .select('id, nom, code_barre, prix_unitaire, stock_actuel')
        .ilike('nom', `%${searchTerm}%`)
        .eq('actif', true)
        .limit(10);

    if (error) { alert('Erreur de recherche'); return; }
    displaySearchResults(articles);
}

function displaySearchResults(articles) {
    if (!articles || articles.length === 0) {
        resultsList.innerHTML = '<div class="result-item" style="justify-content:center;color:var(--text3);">Aucun résultat</div>';
    } else {
        resultsList.innerHTML = articles.map(a => `
            <div class="result-item">
                <div class="result-info">
                    <div class="result-name">${escapeHtml(a.nom)}</div>
                    <div class="result-code">${a.code_barre || '—'}</div>
                </div>
                <div class="result-price">${a.prix_unitaire.toFixed(2)} €</div>
                <button class="add-to-cart-btn" data-article='${JSON.stringify(a)}'>
                    <i class="fas fa-plus"></i> Ajouter
                </button>
            </div>
        `).join('');

        document.querySelectorAll('.add-to-cart-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const article = JSON.parse(btn.dataset.article);
                openQuantityModal(article);
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
    document.querySelector('.price-value').textContent = article.prix_unitaire.toFixed(2) + ' €';
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
    setTimeout(() => modalQuantity.focus(), 100);
}

function addToCartWithQuantity() {
    if (!pendingArticle) return;
    const quantity = parseInt(modalQuantity.value) || 1;

    if (quantity > pendingArticle.stock_actuel) {
        alert(`Stock insuffisant. Stock disponible : ${pendingArticle.stock_actuel}`);
        return;
    }

    const existingIndex = cart.findIndex(item => item.id === pendingArticle.id);
    if (existingIndex !== -1) {
        const newQty = cart[existingIndex].quantity + quantity;
        if (newQty > pendingArticle.stock_actuel) {
            alert(`Quantité totale (${newQty}) dépasse le stock (${pendingArticle.stock_actuel})`);
            return;
        }
        cart[existingIndex].quantity = newQty;
    } else {
        cart.push({
            id: pendingArticle.id,
            nom: pendingArticle.nom,
            prix_unitaire: pendingArticle.prix_unitaire,
            quantity: quantity
        });
    }

    quantityModal.style.display = 'none';
    pendingArticle = null;
    updateCartDisplay();
}

function getCartTotal() {
    return +cart.reduce((sum, item) => sum + item.prix_unitaire * item.quantity, 0).toFixed(2);
}

function updateCartDisplay() {
    if (cart.length === 0) {
        cartBody.innerHTML = `
            <tr class="empty-row">
                <td colspan="5">
                    <div class="empty-state">
                        <i class="fas fa-shopping-basket"></i>
                        <span>Panier vide</span>
                    </div>
                </td>
            </tr>`;
        totalTVA.textContent = '0.00 €';
        totalTTC.textContent = '0.00 €';
        btnTotal.textContent = '0.00 €';
        validateSaleBtn.disabled = true;
        calculateChange();
        return;
    }

    let ttcTotal = 0;
    cartBody.innerHTML = cart.map((item, index) => {
        const itemTotal = item.prix_unitaire * item.quantity;
        ttcTotal += itemTotal;
        return `
            <tr>
                <td class="item-name">${escapeHtml(item.nom)}</td>
                <td class="item-price">${item.prix_unitaire.toFixed(2)} €</td>
                <td>
                    <div class="quantity-control">
                        <button onclick="window.changeQty(${index}, -1)"><i class="fas fa-minus"></i></button>
                        <span>${item.quantity}</span>
                        <button onclick="window.changeQty(${index}, 1)"><i class="fas fa-plus"></i></button>
                    </div>
                </td>
                <td class="item-total">${itemTotal.toFixed(2)} €</td>
                <td>
                    <button class="remove-item" onclick="window.removeFromCart(${index})">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>`;
    }).join('');

    window.changeQty = (index, delta) => {
        const newQty = cart[index].quantity + delta;
        if (newQty < 1) cart.splice(index, 1);
        else cart[index].quantity = newQty;
        updateCartDisplay();
    };

    window.removeFromCart = (index) => {
        cart.splice(index, 1);
        updateCartDisplay();
    };

    ttcTotal = +ttcTotal.toFixed(2);
    const tvaAmount = taxEnabled ? +(ttcTotal - ttcTotal / (1 + taxRate / 100)).toFixed(2) : 0;

    totalTVA.textContent = tvaAmount.toFixed(2) + ' €';
    totalTTC.textContent = ttcTotal.toFixed(2) + ' €';
    btnTotal.textContent = ttcTotal.toFixed(2) + ' €';
    validateSaleBtn.disabled = false;
    calculateChange();
}

function clearCart() {
    if (cart.length === 0) return;
    if (confirm('Vider tout le panier ?')) {
        cart = [];
        updateCartDisplay();
        resetAmount();
    }
}

// ─── VENTE ───
async function validateSale() {
    if (cart.length === 0) { alert('Panier vide'); return; }

    const total = getCartTotal();
    if (amountGiven < total) { alert(`Montant insuffisant. Total : ${total.toFixed(2)} €`); return; }
    if (!confirm(`Confirmer la vente de ${cart.length} article(s) pour ${total.toFixed(2)} € ?`)) return;

    try {
        for (const item of cart) {
            const { data: article } = await supabase
                .from('w_articles')
                .select('stock_actuel')
                .eq('id', item.id)
                .single();

            const newStock = article.stock_actuel - item.quantity;
            await supabase.from('w_articles').update({ stock_actuel: newStock, date_maj_stock: new Date() }).eq('id', item.id);
            await supabase.from('w_mouvements').insert({
                article_id: item.id,
                type: 'sortie',
                quantite: item.quantity,
                utilisateur_id: currentUser?.id,
                motif: 'vente',
                commentaire: `Vente en caisse — Total: ${total.toFixed(2)} € — Reçu: ${amountGiven.toFixed(2)} €`,
                stock_avant: article.stock_actuel,
                stock_apres: newStock,
                date_mouvement: new Date().toISOString().split('T')[0],
                heure_mouvement: new Date().toLocaleTimeString('fr-FR')
            });
        }

        const change = +(amountGiven - total).toFixed(2);
        let msg = `✅ Vente enregistrée avec succès !\nTotal : ${total.toFixed(2)} €`;
        if (change > 0) msg += `\n💰 Monnaie à rendre : ${change.toFixed(2)} €`;
        alert(msg);

        cart = [];
        updateCartDisplay();
        resetAmount();

    } catch (error) {
        console.error('Erreur:', error);
        alert('Erreur lors de l\'enregistrement de la vente');
    }
}

// ─── UTILITAIRES ───
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