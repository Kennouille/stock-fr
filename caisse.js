import { supabase } from './supabaseClient.js';

// État global
let currentUser = null;
let cart = [];
let taxRate = 20; // Taux par défaut, sera chargé depuis config
let taxEnabled = true;
let currentSearchResults = [];

// DOM Elements
const scanInput = document.getElementById('scanInput');
const scanBtn = document.getElementById('scanBtn');
const searchNameInput = document.getElementById('searchNameInput');
const searchNameBtn = document.getElementById('searchNameBtn');
const searchResults = document.getElementById('searchResults');
const resultsList = document.getElementById('resultsList');
const closeResultsBtn = document.getElementById('closeResultsBtn');
const priceCheckInput = document.getElementById('priceCheckInput');
const priceCheckBtn = document.getElementById('priceCheckBtn');
const priceDisplay = document.getElementById('priceDisplay');
const cartBody = document.getElementById('cartBody');
const totalHT = document.getElementById('totalHT');
const totalTVA = document.getElementById('totalTVA');
const totalTTC = document.getElementById('totalTTC');
const taxLine = document.getElementById('taxLine');
const taxRateSpan = document.getElementById('taxRate');
const amountGiven = document.getElementById('amountGiven');
const calculateChangeBtn = document.getElementById('calculateChangeBtn');
const changeDisplay = document.getElementById('changeDisplay');
const changeAmount = document.getElementById('changeAmount');
const validateSaleBtn = document.getElementById('validateSaleBtn');
const clearCartBtn = document.getElementById('clearCartBtn');
const usernameDisplay = document.getElementById('usernameDisplay');
const logoutBtn = document.getElementById('logoutBtn');

// Modal elements
const quantityModal = document.getElementById('quantityModal');
const quantityArticleName = document.getElementById('quantityArticleName');
const modalQuantity = document.getElementById('modalQuantity');
const availableStock = document.getElementById('availableStock');
const confirmQuantityBtn = document.getElementById('confirmQuantityBtn');
const minusQtyBtn = document.querySelector('.minus-qty');
const plusQtyBtn = document.querySelector('.plus-qty');
const closeModalBtns = document.querySelectorAll('.close-modal');

let pendingArticle = null;

// ==================== INITIALISATION ====================
async function init() {
    await loadCurrentUser();
    await loadTaxConfig();
    await checkCaisseAccess();
    setupEventListeners();
    updateCartDisplay();
}

async function loadCurrentUser() {
    const userJson = sessionStorage.getItem('current_user');
    if (!userJson) {
        window.location.href = 'accueil.html';
        return;
    }

    currentUser = JSON.parse(userJson);
    usernameDisplay.textContent = currentUser.username;
}

async function loadTaxConfig() {
    const perms = currentUser.permissions;
    taxEnabled = perms?.caisse_tax_enabled || false;
    taxRate = perms?.caisse_tax_rate || 20;
    if (taxRateSpan) taxRateSpan.textContent = taxRate;
    if (taxLine) taxLine.style.display = taxEnabled ? 'flex' : 'none';
}

async function checkCaisseAccess() {
    const hasCaissePerm = currentUser?.permissions?.caisse === true;
    const isModuleEnabled = currentUser?.permissions?.caisse_module_enabled === true;

    if (!hasCaissePerm || !isModuleEnabled) {
        window.location.href = 'accueil.html';
    }
}

// ==================== ÉVÉNEMENTS ====================
function setupEventListeners() {
    scanInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleScan(scanInput.value);
    });
    scanBtn.addEventListener('click', () => handleScan(scanInput.value));

    searchNameBtn.addEventListener('click', () => handleSearchByName());
    searchNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearchByName();
    });

    closeResultsBtn.addEventListener('click', () => {
        searchResults.style.display = 'none';
        searchNameInput.value = '';
    });

    priceCheckBtn.addEventListener('click', () => handlePriceCheck());
    priceCheckInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handlePriceCheck();
    });

    calculateChangeBtn.addEventListener('click', calculateChange);
    validateSaleBtn.addEventListener('click', validateSale);
    clearCartBtn.addEventListener('click', clearCart);
    logoutBtn.addEventListener('click', handleLogout);

    amountGiven.addEventListener('input', () => {
        if (amountGiven.value) calculateChange();
        else changeDisplay.style.display = 'none';
    });

    document.querySelectorAll('.money-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const value = parseFloat(btn.dataset.value);
            const current = parseFloat(amountGiven.value) || 0;
            amountGiven.value = (current + value).toFixed(2);
            calculateChange();
        });
    });

    confirmQuantityBtn.addEventListener('click', addToCartWithQuantity);
    minusQtyBtn?.addEventListener('click', () => {
        const val = parseInt(modalQuantity.value) || 1;
        if (val > 1) modalQuantity.value = val - 1;
    });
    plusQtyBtn?.addEventListener('click', () => {
        const val = parseInt(modalQuantity.value) || 1;
        modalQuantity.value = val + 1;
    });

    closeModalBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            quantityModal.style.display = 'none';
            pendingArticle = null;
        });
    });
}

// ==================== SCAN ET RECHERCHE ====================
async function handleScan(code) {
    if (!code.trim()) return;

    const { data: article, error } = await supabase
        .from('w_articles')
        .select('id, nom, code_barre, prix_unitaire, stock_actuel')
        .eq('code_barre', code.trim())
        .eq('actif', true)
        .single();

    if (error || !article) {
        alert('Article non trouvé');
        scanInput.value = '';
        return;
    }

    scanInput.value = '';
    openQuantityModal(article);
}

async function handleSearchByName() {
    const searchTerm = searchNameInput.value.trim();
    if (!searchTerm) return;

    const { data: articles, error } = await supabase
        .from('w_articles')
        .select('id, nom, code_barre, prix_unitaire, stock_actuel')
        .ilike('nom', `%${searchTerm}%`)
        .eq('actif', true)
        .limit(10);

    if (error) {
        alert('Erreur de recherche');
        return;
    }

    currentSearchResults = articles;
    displaySearchResults(articles);
}

function displaySearchResults(articles) {
    if (articles.length === 0) {
        resultsList.innerHTML = '<div class="result-item">Aucun résultat</div>';
    } else {
        resultsList.innerHTML = articles.map(article => `
            <div class="result-item" data-id="${article.id}">
                <div class="result-info">
                    <div class="result-name">${escapeHtml(article.nom)}</div>
                    <div class="result-code">${article.code_barre || 'Pas de code'}</div>
                </div>
                <div class="result-price">${article.prix_unitaire.toFixed(2)} €</div>
                <button class="add-to-cart-btn" data-article='${JSON.stringify(article)}'>
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

async function handlePriceCheck() {
    const code = priceCheckInput.value.trim();
    if (!code) return;

    const { data: article, error } = await supabase
        .from('w_articles')
        .select('nom, prix_unitaire')
        .eq('code_barre', code)
        .eq('actif', true)
        .single();

    if (error || !article) {
        alert('Article non trouvé');
        priceCheckInput.value = '';
        priceDisplay.style.display = 'none';
        return;
    }

    const priceTTC = taxEnabled ? article.prix_unitaire * (1 + taxRate / 100) : article.prix_unitaire;

    document.querySelector('.price-article-name').textContent = article.nom;
    document.querySelector('.price-value').textContent = `${priceTTC.toFixed(2)} €`;
    document.querySelector('.price-tax').innerHTML = taxEnabled ? `TTC (TVA ${taxRate}%)` : 'Prix HT';

    priceDisplay.style.display = 'block';
    priceCheckInput.value = '';

    setTimeout(() => {
        priceDisplay.style.display = 'none';
    }, 3000);
}

// ==================== PANIER ====================
function openQuantityModal(article) {
    pendingArticle = article;
    quantityArticleName.textContent = article.nom;
    availableStock.textContent = article.stock_actuel;
    modalQuantity.value = 1;
    quantityModal.style.display = 'flex';
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

function updateCartDisplay() {
    if (cart.length === 0) {
        cartBody.innerHTML = '<tr class="empty-cart-row"><td colspan="6">Aucun article dans le panier</td></tr>';
        totalHT.textContent = '0.00 €';
        totalTVA.textContent = '0.00 €';
        totalTTC.textContent = '0.00 €';
        validateSaleBtn.disabled = true;
        return;
    }

    let htTotal = 0;

    cartBody.innerHTML = cart.map((item, index) => {
        const itemHT = item.prix_unitaire * item.quantity;
        const itemTVA = taxEnabled ? itemHT * taxRate / 100 : 0;
        const itemTTC = itemHT + itemTVA;
        htTotal += itemHT;

        return `
            <tr>
                <td>${escapeHtml(item.nom)}</td>
                <td>${item.prix_unitaire.toFixed(2)} €</td>
                <td>
                    <div class="quantity-control">
                        <button onclick="window.changeQuantity(${index}, -1)">-</button>
                        <span>${item.quantity}</span>
                        <button onclick="window.changeQuantity(${index}, 1)">+</button>
                    </div>
                </td>
                <td>${taxEnabled ? taxRate + '%' : '0%'}</td>
                <td>${itemTTC.toFixed(2)} €</td>
                <td><button class="remove-item" onclick="window.removeFromCart(${index})"><i class="fas fa-trash"></i></button></td>
            </tr>
        `;
    }).join('');

    window.changeQuantity = (index, delta) => {
        const newQty = cart[index].quantity + delta;
        if (newQty < 1) {
            cart.splice(index, 1);
        } else {
            cart[index].quantity = newQty;
        }
        updateCartDisplay();
    };

    window.removeFromCart = (index) => {
        cart.splice(index, 1);
        updateCartDisplay();
    };

    const tvaTotal = taxEnabled ? htTotal * taxRate / 100 : 0;
    const ttcTotal = htTotal + tvaTotal;

    totalHT.textContent = `${htTotal.toFixed(2)} €`;
    totalTVA.textContent = `${tvaTotal.toFixed(2)} €`;
    totalTTC.textContent = `${ttcTotal.toFixed(2)} €`;

    validateSaleBtn.disabled = cart.length === 0;

    amountGiven.value = '';
    changeDisplay.style.display = 'none';
}

function clearCart() {
    if (confirm('Vider tout le panier ?')) {
        cart = [];
        updateCartDisplay();
    }
}

// ==================== PAIEMENT ====================
function calculateChange() {
    const total = parseFloat(totalTTC.textContent) || 0;
    const given = parseFloat(amountGiven.value) || 0;

    if (given < total) {
        changeDisplay.style.display = 'none';
        return;
    }

    const change = given - total;
    changeAmount.textContent = `${change.toFixed(2)} €`;
    changeDisplay.style.display = 'block';
}

async function validateSale() {
    if (cart.length === 0) {
        alert('Panier vide');
        return;
    }

    const total = parseFloat(totalTTC.textContent) || 0;
    const given = parseFloat(amountGiven.value) || 0;

    if (given < total) {
        alert(`Montant insuffisant. Total : ${total.toFixed(2)} €`);
        return;
    }

    if (!confirm(`Confirmer la vente de ${cart.length} article(s) pour ${total.toFixed(2)} € ?`)) {
        return;
    }

    try {
        for (const item of cart) {
            const { data: article } = await supabase
                .from('w_articles')
                .select('stock_actuel')
                .eq('id', item.id)
                .single();

            const newStock = article.stock_actuel - item.quantity;

            await supabase
                .from('w_articles')
                .update({ stock_actuel: newStock, date_maj_stock: new Date() })
                .eq('id', item.id);

            await supabase
                .from('w_mouvements')
                .insert({
                    article_id: item.id,
                    type: 'sortie',
                    quantite: item.quantity,
                    utilisateur_id: currentUser?.id,
                    motif: 'vente',
                    commentaire: `Vente en caisse - Total: ${total.toFixed(2)} € - Reçu: ${given.toFixed(2)} €`,
                    stock_avant: article.stock_actuel,
                    stock_apres: newStock,
                    date_mouvement: new Date().toISOString().split('T')[0],
                    heure_mouvement: new Date().toLocaleTimeString('fr-FR')
                });
        }

        alert('Vente enregistrée avec succès !');

        const change = given - total;
        if (change > 0) {
            alert(`Monnaie à rendre : ${change.toFixed(2)} €`);
        }

        cart = [];
        updateCartDisplay();
        amountGiven.value = '';
        changeDisplay.style.display = 'none';

    } catch (error) {
        console.error('Erreur:', error);
        alert('Erreur lors de l\'enregistrement de la vente');
    }
}

// ==================== UTILITAIRES ====================
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = 'accueil.html';
}

// Lancer l'application
init();