// ===== IMPORTS =====
import { supabase } from './supabaseClient.js';

// ===== ÉTATS GLOBAUX =====
let state = {
    user: null,
    reservations: [],
    projects: [],
    articles: [],
    users: [],
    currentTab: 'active',
    filters: {
        project: '',
        article: '',
        status: '',
        user: ''
    },
    selections: {
        active: new Set(),
        expired: new Set()
    },
    currentModal: null,
    currentStep: 1,
    selectedArticle: null,
    newReservationData: {
        articleId: '',
        quantity: 1,
        projectId: '',
        duration: '14',
        endDate: '',
        comment: ''
    }
};

// ===== ÉLÉMENTS DOM =====
const elements = {
    // Overlay de chargement
    loadingOverlay: document.getElementById('loadingOverlay'),

    // Header
    usernameDisplay: document.getElementById('usernameDisplay'),
    logoutBtn: document.getElementById('logoutBtn'),

    // Statistiques
    activeReservations: document.getElementById('activeReservations'),
    expiredReservations: document.getElementById('expiredReservations'),
    totalReservedItems: document.getElementById('totalReservedItems'),
    reservedValue: document.getElementById('reservedValue'),

    // Boutons header
    newReservationBtn: document.getElementById('newReservationBtn'),
    exportReservationsBtn: document.getElementById('exportReservationsBtn'),

    // Filtres
    toggleFiltersBtn: document.getElementById('toggleFiltersBtn'),
    filtersContainer: document.getElementById('filtersContainer'),
    filterProject: document.getElementById('filterProject'),
    filterArticle: document.getElementById('filterArticle'),
    filterStatus: document.getElementById('filterStatus'),
    filterUser: document.getElementById('filterUser'),
    applyFiltersBtn: document.getElementById('applyFiltersBtn'),
    resetFiltersBtn: document.getElementById('resetFiltersBtn'),
    saveFilterBtn: document.getElementById('saveFilterBtn'),

    // Onglets
    tabBtns: document.querySelectorAll('.tab-btn'),
    tabContents: document.querySelectorAll('.tab-content'),
    activeTabCount: document.getElementById('activeTabCount'),
    expiredTabCount: document.getElementById('expiredTabCount'),
    historyTabCount: document.getElementById('historyTabCount'),
    projectsTabCount: document.getElementById('projectsTabCount'),

    // Recherche
    searchReservations: document.getElementById('searchReservations'),
    searchBtn: document.getElementById('searchBtn'),

    // Onglet actif
    selectAllActive: document.getElementById('selectAllActive'),
    activeReservationsBody: document.getElementById('activeReservationsBody'),
    activeSelectionInfo: document.getElementById('activeSelectionInfo'),
    activeSelectedCount: document.getElementById('activeSelectedCount'),
    releaseSelectedBtn: document.getElementById('releaseSelectedBtn'),
    extendSelectedBtn: document.getElementById('extendSelectedBtn'),
    exportSelectedBtn: document.getElementById('exportSelectedBtn'),

    // Onglet à libérer
    selectAllExpired: document.getElementById('selectAllExpired'),
    expiredReservationsBody: document.getElementById('expiredReservationsBody'),
    expiredSelectionInfo: document.getElementById('expiredSelectionInfo'),
    expiredSelectedCount: document.getElementById('expiredSelectedCount'),
    releaseExpiredSelectedBtn: document.getElementById('releaseExpiredSelectedBtn'),
    extendExpiredSelectedBtn: document.getElementById('extendExpiredSelectedBtn'),
    notifyExpiredBtn: document.getElementById('notifyExpiredBtn'),

    // Onglet historique
    historyDateFrom: document.getElementById('historyDateFrom'),
    historyDateTo: document.getElementById('historyDateTo'),
    historyType: document.getElementById('historyType'),
    applyHistoryFiltersBtn: document.getElementById('applyHistoryFiltersBtn'),
    historyTableBody: document.getElementById('historyTableBody'),
    historyPaginationInfo: document.getElementById('historyPaginationInfo'),
    historyCurrentPage: document.getElementById('historyCurrentPage'),
    historyTotalPages: document.getElementById('historyTotalPages'),
    historyFirstPageBtn: document.getElementById('historyFirstPageBtn'),
    historyPrevPageBtn: document.getElementById('historyPrevPageBtn'),
    historyNextPageBtn: document.getElementById('historyNextPageBtn'),
    historyLastPageBtn: document.getElementById('historyLastPageBtn'),

    // Onglet projets
    newProjectBtn: document.getElementById('newProjectBtn'),
    projectsGrid: document.getElementById('projectsGrid'),

    // Modals
    newReservationModal: document.getElementById('newReservationModal'),
    newProjectModal: document.getElementById('newProjectModal'),
    releaseModal: document.getElementById('releaseModal'),
    extendModal: document.getElementById('extendModal'),
    detailsModal: document.getElementById('detailsModal'),
    closeModalBtns: document.querySelectorAll('.close-modal'),

    // Modal nouvelle réservation
    reservationSteps: document.querySelectorAll('.step'),
    stepContents: document.querySelectorAll('.step-content'),
    prevStepBtn: document.getElementById('prevStepBtn'),
    nextStepBtn: document.getElementById('nextStepBtn'),
    cancelReservationBtn: document.getElementById('cancelReservationBtn'),

    // Étape 1
    reservationBarcode: document.getElementById('reservationBarcode'),
    scanReservationBtn: document.getElementById('scanReservationBtn'),
    reservationArticleSearch: document.getElementById('reservationArticleSearch'),
    searchReservationArticleBtn: document.getElementById('searchReservationArticleBtn'),
    reservationSearchResults: document.getElementById('reservationSearchResults'),
    reservationResultsList: document.getElementById('reservationResultsList'),
    selectedArticlePreview: document.getElementById('selectedArticlePreview'),
    articlePreview: document.getElementById('articlePreview'),
    changeArticleBtn: document.getElementById('changeArticleBtn'),

    // Étape 2
    articleInfoSummary: document.getElementById('articleInfoSummary'),
    reservationQuantity: document.getElementById('reservationQuantity'),
    quantityMinusBtn: document.getElementById('quantityMinusBtn'),
    quantityPlusBtn: document.getElementById('quantityPlusBtn'),
    availableStock: document.getElementById('availableStock'),
    alreadyReserved: document.getElementById('alreadyReserved'),
    reservationProject: document.getElementById('reservationProject'),
    newProjectFromReservationBtn: document.getElementById('newProjectFromReservationBtn'),
    reservationDuration: document.getElementById('reservationDuration'),
    customDateGroup: document.getElementById('customDateGroup'),
    reservationEndDate: document.getElementById('reservationEndDate'),
    reservationComment: document.getElementById('reservationComment'),

    // Étape 3
    confirmationSummary: document.getElementById('confirmationSummary'),
    confirmReservationBtn: document.getElementById('confirmReservationBtn'),
    editReservationBtn: document.getElementById('editReservationBtn'),

    // Modal nouveau projet
    newProjectForm: document.getElementById('newProjectForm'),
    projectName: document.getElementById('projectName'),
    projectNumber: document.getElementById('projectNumber'),
    projectDescription: document.getElementById('projectDescription'),
    projectManager: document.getElementById('projectManager'),
    projectEndDate: document.getElementById('projectEndDate'),
    projectError: document.getElementById('projectError'),
    projectErrorText: document.getElementById('projectErrorText'),

    // Modal libération
    releaseDetails: document.getElementById('releaseDetails'),
    releaseComment: document.getElementById('releaseComment'),
    releaseError: document.getElementById('releaseError'),
    releaseErrorText: document.getElementById('releaseErrorText'),
    confirmReleaseBtn: document.getElementById('confirmReleaseBtn'),

    // Modal prolongation
    extendDetails: document.getElementById('extendDetails'),
    extendDuration: document.getElementById('extendDuration'),
    extendComment: document.getElementById('extendComment'),
    extendError: document.getElementById('extendError'),
    extendErrorText: document.getElementById('extendErrorText'),
    confirmExtendBtn: document.getElementById('confirmExtendBtn'),

    // Modal détails
    reservationFullDetails: document.getElementById('reservationFullDetails'),
    releaseFromDetailsBtn: document.getElementById('releaseFromDetailsBtn'),
    extendFromDetailsBtn: document.getElementById('extendFromDetailsBtn')
};

// ===== AUTHENTIFICATION (comme dans impression.js) =====
async function checkAuth() {
    try {
        const userJson = sessionStorage.getItem('current_user');

        if (!userJson) {
            window.location.href = 'connexion.html';
            return false;
        }

        state.user = JSON.parse(userJson);

        // Vérifier les permissions (si nécessaire)
        if (!state.user.permissions?.reservations) {
            alert('Vous n\'avez pas la permission d\'accéder aux réservations');
            window.location.href = 'accueil.html';
            return false;
        }

        // Mettre à jour l'interface
        elements.usernameDisplay.textContent = state.user.username || state.user.email;

        return true;

    } catch (error) {
        console.error('Erreur d\'authentification:', error);
        sessionStorage.removeItem('current_user');
        window.location.href = 'connexion.html';
        return false;
    }
}

function logout() {
    if (!confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
        return;
    }

    sessionStorage.removeItem('current_user');
    sessionStorage.removeItem('supabase_token');
    window.location.href = 'connexion.html';
}

// ===== FONCTIONS UTILITAIRES =====
function showLoading() {
    elements.loadingOverlay.style.display = 'flex';
}

function hideLoading() {
    elements.loadingOverlay.style.display = 'none';
}

function showError(message, element = null) {
    console.error(message);
    if (element) {
        element.style.display = 'flex';
        element.querySelector('span').textContent = message;
    } else {
        alert(`Erreur: ${message}`);
    }
}

function clearError(element) {
    if (element) {
        element.style.display = 'none';
    }
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    } catch (e) {
        return 'N/A';
    }
}

function formatDateTime(dateString) {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (e) {
        return 'N/A';
    }
}

function calculateDaysBetween(startDate, endDate) {
    try {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffTime = Math.abs(end - start);
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    } catch (e) {
        return 0;
    }
}

function isReservationExpired(reservation) {
    try {
        const endDate = new Date(reservation.date_fin);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return endDate < today;
    } catch (e) {
        return false;
    }
}

function getDaysSinceCreation(reservation) {
    try {
        const createdDate = new Date(reservation.created_at);
        const today = new Date();
        return calculateDaysBetween(createdDate, today);
    } catch (e) {
        return 0;
    }
}

function getDaysUntilExpiration(reservation) {
    try {
        const endDate = new Date(reservation.date_fin);
        const today = new Date();
        const diffTime = endDate - today;
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    } catch (e) {
        return 0;
    }
}

// ===== FONCTIONS SUPABASE =====
async function fetchReservations() {
    try {
        showLoading();

        const { data, error } = await supabase
            .from('w_mouvements')
            .select(`
                *,
                article:article_id (
                  id,
                  nom,
                  code_barre
                )
            `)
            .eq('type', 'reservation')
            .order('created_at', { ascending: false });

        if (error) throw error;

        state.reservations = data || [];

        updateStatistics();
        updateReservationsDisplay();

    } catch (error) {
        console.error('Erreur chargement réservations:', error);
        showError('Erreur lors du chargement des réservations');
    } finally {
        hideLoading();
    }
}


async function fetchArticles() {
    try {
        const { data, error } = await supabase
            .from('w_articles')
            .select('*')
            .order('nom');

        if (error) throw error;

        state.articles = data || [];
        populateArticleFilter();
    } catch (error) {
        console.error('Erreur chargement articles:', error);
    }
}

async function fetchProjects() {
    try {
        const { data, error } = await supabase
            .from('w_projets')
            .select('*')
            .order('nom');

        if (error) throw error;

        state.projects = data || [];
        populateProjectFilter();
        populateProjectSelect();
    } catch (error) {
        console.error('Erreur chargement projets:', error);
    }
}

async function fetchUsers() {
    try {
        const { data, error } = await supabase
            .from('w_users')
            .select('*')
            .order('username');

        if (error) throw error;

        state.users = data || [];
        populateUserFilter();
    } catch (error) {
        console.error('Erreur chargement utilisateurs:', error);
    }
}

async function createReservation(reservationData) {
    try {
        // Calculer la date de fin
        let endDate;
        if (reservationData.duration === 'custom') {
            endDate = reservationData.endDate;
        } else {
            const today = new Date();
            endDate = new Date(today);
            endDate.setDate(today.getDate() + parseInt(reservationData.duration));
        }

        const article = state.selectedArticle;
        const currentUser = state.users.find(u => u.id === state.user.id);
        const username = currentUser ? currentUser.username : null;
        const codeBarre = state.selectedArticle.code_barre || null;
        const now = new Date();

        const dateMouvement = now.toISOString().split('T')[0]; // YYYY-MM-DD
        const heureMouvement = now.toTimeString().slice(0, 8); // HH:MM:SS

        const stockReserveAvant = article.stock_reserve;
        const stockReserveApres = article.stock_reserve + reservationData.quantity;

        // récupérer le NOM du projet
        const project = state.projects.find(p => p.id === reservationData.projectId);

        const { data, error } = await supabase
            .from('w_mouvements')
            .insert([{
                type: 'reservation',
                article_id: reservationData.articleId,

                // CE QUE TU AS DEMANDÉ
                projet: project ? project.nom : null,
                notes: reservationData.comment,
                commentaire: reservationData.comment,
                utilisateur: username,

                utilisateur_id: state.user.id,
                quantite: reservationData.quantity,

                stock_reserve_avant: stockReserveAvant,
                stock_reserve_apres: stockReserveApres,

                date_mouvement: dateMouvement,
                heure_mouvement: heureMouvement,
                date_fin: endDate.toISOString().split('T')[0],
                created_at: now.toISOString()
            }])
            .select()
            .single();

        if (error) throw error;

        await supabase
            .from('w_articles')
            .update({
                stock_reserve: stockReserveApres
            })
            .eq('id', reservationData.articleId);

        return data;

    } catch (error) {
        console.error('Erreur création réservation:', error);
        throw error;
    }
}


async function releaseReservation(reservationId, comment = '') {
    try {
        // 1. Récupérer la réservation pour connaître la quantité
        const { data: reservation, error: fetchError } = await supabase
            .from('w_mouvements')
            .select('article_id, quantite, stock_reserve_apres')
            .eq('id', reservationId)
            .single();

        if (fetchError) throw fetchError;

        // 2. Récupérer le stock actuel de l'article
        const { data: article, error: articleError } = await supabase
            .from('w_articles')
            .select('stock_reserve')
            .eq('id', reservation.article_id)
            .single();

        if (articleError) throw articleError;

        // 3. Calculer le nouveau stock réservé
        const newReservedStock = Math.max(0, (article.stock_reserve || 0) - reservation.quantite);

        // 4. Mettre à jour le stock réservé dans w_articles
        const { error: updateError } = await supabase
            .from('w_articles')
            .update({ stock_reserve: newReservedStock })
            .eq('id', reservation.article_id);

        if (updateError) throw updateError;

        // 5. Supprimer la réservation
        const { error: deleteError } = await supabase
            .from('w_mouvements')
            .delete()
            .eq('id', reservationId);

        if (deleteError) throw deleteError;

        return true;
    } catch (error) {
        console.error('Erreur libération réservation:', error);
        throw error;
    }
}

async function extendReservation(reservationId, additionalDays, comment = '') {
    try {
        // Récupérer la réservation depuis w_mouvements
        const { data: reservation, error: fetchError } = await supabase
            .from('w_mouvements')
            .select('*')
            .eq('id', reservationId)
            .single();

        if (fetchError) throw fetchError;

        // Calculer la nouvelle date de fin
        const currentEndDate = new Date(reservation.date_fin);
        const newEndDate = new Date(currentEndDate);
        newEndDate.setDate(newEndDate.getDate() + parseInt(additionalDays));

        // Mettre à jour la réservation dans w_mouvements
        const { data, error } = await supabase
            .from('w_mouvements')
            .update({
                date_fin: newEndDate.toISOString().split('T')[0] // YYYY-MM-DD
            })
            .eq('id', reservationId)
            .select()
            .single();

        if (error) throw error;

        return data;
    } catch (error) {
        console.error('Erreur prolongation réservation:', error);
        throw error;
    }
}

async function createProject(projectData) {
    try {
        const { data, error } = await supabase
            .from('w_projets')
            .insert([{
                nom: projectData.nom,
                numero: projectData.numero,
                description: projectData.description,
                responsable: projectData.responsable,
                date_fin_prevue: projectData.date_fin_prevue,
                created_at: new Date().toISOString(),
                actif: true, // <-- AJOUTE CETTE LIGNE
                archived: false // <-- Optionnel mais recommandé
            }])
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Erreur création projet:', error);
        throw error;
    }
}

// ===== FONCTIONS D'AFFICHAGE =====
function updateStatistics() {
    const activeReservations = state.reservations.filter(r => !isReservationExpired(r));
    const expiredReservations = state.reservations.filter(r => isReservationExpired(r));

    const totalItems = state.reservations.reduce((sum, r) => sum + r.quantite, 0);
    const totalValue = state.reservations.reduce((sum, r) => {
        const article = state.articles.find(a => a.id === r.id_article);
        return sum + (article?.prix || 0) * r.quantite;
    }, 0);

    elements.activeReservations.textContent = activeReservations.length;
    elements.expiredReservations.textContent = expiredReservations.length;
    elements.totalReservedItems.textContent = totalItems;
    elements.reservedValue.textContent = `${totalValue.toFixed(2)} €`;

    // Mise à jour des badges
    elements.activeTabCount.textContent = activeReservations.length;
    elements.expiredTabCount.textContent = expiredReservations.length;
}

function filterReservations(reservationsList) {
    return reservationsList.filter(reservation => {
        // Filtre projet
        if (state.filters.project && reservation.id_projet !== state.filters.project) {
            return false;
        }

        // Filtre article
        if (state.filters.article && reservation.id_article !== state.filters.article) {
            return false;
        }

        // Filtre utilisateur
        if (state.filters.user && reservation.id_user !== state.filters.user) {
            return false;
        }

        // Filtre statut
        if (state.filters.status) {
            const daysSinceCreation = getDaysSinceCreation(reservation);
            const isExpired = isReservationExpired(reservation);

            switch (state.filters.status) {
                case 'active':
                    if (isExpired) return false;
                    break;
                case 'expired':
                    if (!isExpired) return false;
                    break;
                case 'recent':
                    if (daysSinceCreation > 7) return false;
                    break;
                case 'old':
                    if (daysSinceCreation <= 30) return false;
                    break;
            }
        }

        // Recherche texte
        if (elements.searchReservations.value.trim()) {
            const searchTerm = elements.searchReservations.value.toLowerCase().trim();
            const article = state.articles.find(a => a.id === reservation.id_article);
            const project = state.projects.find(p => p.id === reservation.id_projet);
            const user = state.users.find(u => u.id === reservation.id_user);

            const searchableText = [
                reservation.id || '',
                article?.nom || '',
                article?.code || '',
                project?.nom || '',
                user?.nom || '',
                reservation.commentaire || ''
            ].join(' ').toLowerCase();

            if (!searchableText.includes(searchTerm)) {
                return false;
            }
        }

        return true;
    });
}

function updateReservationsDisplay() {
    updateActiveReservations();
    updateExpiredReservations();
}

function updateActiveReservations() {
    const activeReservations = state.reservations.filter(r => !isReservationExpired(r));
    const filteredReservations = filterReservations(activeReservations);

    if (filteredReservations.length === 0) {
        elements.activeReservationsBody.innerHTML = `
            <tr>
                <td colspan="8" class="loading-row">
                    <i class="fas fa-info-circle"></i> Aucune réservation active
                </td>
            </tr>
        `;
        return;
    }

    let html = '';
    filteredReservations.forEach(reservation => {
        const articleName = reservation.article?.nom || state.articles.find(a => a.id === reservation.article_id)?.nom || 'Article inconnu';
        const projetName = reservation.projet || 'Projet inconnu';
        const userName = reservation.utilisateur || 'Utilisateur inconnu';
        const isSelected = state.selections.active.has(reservation.id);
        const daysUntilExpiration = getDaysUntilExpiration(reservation);

        html += `
            <tr data-id="${reservation.id}">
                <td class="select-col">
                    <input type="checkbox" class="reservation-checkbox"
                           data-id="${reservation.id}"
                           ${isSelected ? 'checked' : ''}>
                </td>
                <td>
                    <div class="article-info">
                        <strong>${articleName}</strong>
                        <small>${state.articles.find(a => a.id === reservation.article_id)?.code || ''}</small>
                    </div>
                </td>
                <td>${projetName}</td>
                <td>${reservation.quantite}</td>
                <td>${formatDate(reservation.created_at)}</td>
                <td>
                    <span class="badge ${daysUntilExpiration <= 7 ? 'warning' : 'info'}">
                        ${daysUntilExpiration > 0 ? `${daysUntilExpiration} jours` : 'Expiré aujourd\'hui'}
                    </span>
                </td>
                <td>${userName}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-action btn-small view-details" data-id="${reservation.id}">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn-action btn-small release-btn" data-id="${reservation.id}">
                            <i class="fas fa-unlock"></i>
                        </button>
                        <button class="btn-action btn-small extend-btn" data-id="${reservation.id}">
                            <i class="fas fa-calendar-plus"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });

    elements.activeReservationsBody.innerHTML = html;
    updateSelectionInfo();
}

function updateExpiredReservations() {
    const expiredReservations = state.reservations.filter(r => isReservationExpired(r));
    const filteredReservations = filterReservations(expiredReservations);

    if (filteredReservations.length === 0) {
        elements.expiredReservationsBody.innerHTML = `
            <tr>
                <td colspan="8" class="loading-row">
                    <i class="fas fa-info-circle"></i> Aucune réservation à libérer
                </td>
            </tr>
        `;
        return;
    }

    let html = '';
    filteredReservations.forEach(reservation => {
        const articleName = reservation.article?.nom || state.articles.find(a => a.id === reservation.article_id)?.nom || 'Article inconnu';
        const projetName = reservation.projet || 'Projet inconnu';
        const userName = reservation.utilisateur || 'Utilisateur inconnu';
        const isSelected = state.selections.active.has(reservation.id);
        const daysUntilExpiration = getDaysUntilExpiration(reservation);

        html += `
            <tr data-id="${reservation.id}">
                <td class="select-col">
                    <input type="checkbox" class="reservation-checkbox"
                           data-id="${reservation.id}"
                           ${isSelected ? 'checked' : ''}>
                </td>
                <td>
                    <div class="article-info">
                        <strong>${articleName}</strong>
                        <small>${state.articles.find(a => a.id === reservation.article_id)?.code || ''}</small>
                    </div>
                </td>
                <td>${projetName}</td>
                <td>${reservation.quantite}</td>
                <td>${formatDate(reservation.created_at)}</td>
                <td>
                    <span class="badge ${daysUntilExpiration <= 7 ? 'warning' : 'info'}">
                        ${daysUntilExpiration > 0 ? `${daysUntilExpiration} jours` : 'Expiré aujourd\'hui'}
                    </span>
                </td>
                <td>${userName}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-action btn-small view-details" data-id="${reservation.id}">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn-action btn-small release-btn" data-id="${reservation.id}">
                            <i class="fas fa-unlock"></i>
                        </button>
                        <button class="btn-action btn-small extend-btn" data-id="${reservation.id}">
                            <i class="fas fa-calendar-plus"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });

    elements.expiredReservationsBody.innerHTML = html;
    updateSelectionInfo();
}

function updateSelectionInfo() {
    // Onglet actif
    const activeSelected = state.selections.active.size;
    if (activeSelected > 0) {
        elements.activeSelectionInfo.style.display = 'block';
        elements.activeSelectedCount.textContent = activeSelected;
        elements.releaseSelectedBtn.disabled = false;
        elements.extendSelectedBtn.disabled = false;
        elements.exportSelectedBtn.disabled = false;
    } else {
        elements.activeSelectionInfo.style.display = 'none';
        elements.releaseSelectedBtn.disabled = true;
        elements.extendSelectedBtn.disabled = true;
        elements.exportSelectedBtn.disabled = true;
    }

    // Onglet à libérer
    const expiredSelected = state.selections.expired.size;
    if (expiredSelected > 0) {
        elements.expiredSelectionInfo.style.display = 'block';
        elements.expiredSelectedCount.textContent = expiredSelected;
        elements.releaseExpiredSelectedBtn.disabled = false;
        elements.extendExpiredSelectedBtn.disabled = false;
    } else {
        elements.expiredSelectionInfo.style.display = 'none';
        elements.releaseExpiredSelectedBtn.disabled = true;
        elements.extendExpiredSelectedBtn.disabled = true;
    }

    // Mettre à jour les cases à cocher "Tout sélectionner"
    const activeReservations = state.reservations.filter(r => !isReservationExpired(r));
    const expiredReservations = state.reservations.filter(r => isReservationExpired(r));

    elements.selectAllActive.checked = activeSelected > 0 &&
        activeSelected === activeReservations.length;

    elements.selectAllExpired.checked = expiredSelected > 0 &&
        expiredSelected === expiredReservations.length;
}

function populateArticleFilter() {
    let html = '<option value="">Tous les articles</option>';
    state.articles.forEach(article => {
        html += `<option value="${article.id}">${article.nom} (${article.code})</option>`;
    });
    elements.filterArticle.innerHTML = html;
    elements.filterArticle.value = state.filters.article;
}

function populateProjectFilter() {
    let html = '<option value="">Tous les projets</option>';

    // Filtrer uniquement les projets actifs (actif = true)
    const activeProjects = state.projects.filter(project => project.actif === true);

    activeProjects.forEach(project => {
        html += `<option value="${project.id}">${project.nom}</option>`;
    });

    elements.filterProject.innerHTML = html;
    elements.filterProject.value = state.filters.project;
}

function populateUserFilter() {
    let html = '<option value="">Tous les utilisateurs</option>';
    state.users.forEach(user => {
        html += `<option value="${user.id}">${user.nom}</option>`;
    });
    elements.filterUser.innerHTML = html;
    elements.filterUser.value = state.filters.user;
}

function populateProjectSelect() {
    let html = '<option value="">Sélectionnez un projet</option>';

    // Filtrer uniquement les projets actifs (actif = true)
    const activeProjects = state.projects.filter(project => project.actif === true);

    activeProjects.forEach(project => {
        html += `<option value="${project.id}">${project.nom}</option>`;
    });

    elements.reservationProject.innerHTML = html;
}

// ===== GESTION DES MODALS =====
function showModal(modalElement) {
    // Fermer tout modal ouvert
    hideModal();

    // Afficher le modal
    modalElement.style.display = 'flex';
    state.currentModal = modalElement;
}

function hideModal() {
    if (state.currentModal) {
        state.currentModal.style.display = 'none';
        state.currentModal = null;
    }
}

function resetNewReservationModal() {
    state.currentStep = 1;
    state.selectedArticle = null;
    state.newReservationData = {
        articleId: '',
        quantity: 1,
        projectId: '',
        duration: '14',
        endDate: '',
        comment: ''
    };

    // Réinitialiser les étapes
    elements.reservationSteps.forEach(step => step.classList.remove('active'));
    elements.stepContents.forEach(content => content.classList.remove('active'));

    document.querySelector(`.step[data-step="1"]`).classList.add('active');
    document.getElementById('step1').classList.add('active');

    // Réinitialiser les champs
    elements.reservationBarcode.value = '';
    elements.reservationArticleSearch.value = '';
    elements.reservationSearchResults.style.display = 'none';
    elements.selectedArticlePreview.style.display = 'none';
    elements.reservationQuantity.value = '1';
    elements.reservationProject.value = '';
    elements.reservationDuration.value = '14';
    elements.customDateGroup.style.display = 'none';
    elements.reservationComment.value = '';

    // Réinitialiser les boutons
    elements.prevStepBtn.disabled = true;
    elements.nextStepBtn.textContent = 'Suivant';
    elements.nextStepBtn.innerHTML = 'Suivant <i class="fas fa-arrow-right"></i>';
    elements.nextStepBtn.style.display = 'inline-flex';
}

function updateStep(stepNumber) {
    state.currentStep = stepNumber;

    // Mettre à jour les indicateurs d'étape
    elements.reservationSteps.forEach(step => {
        step.classList.remove('active');
        if (parseInt(step.dataset.step) === stepNumber) {
            step.classList.add('active');
        }
    });

    // Mettre à jour le contenu des étapes
    elements.stepContents.forEach(content => {
        content.classList.remove('active');
        if (content.id === `step${stepNumber}`) {
            content.classList.add('active');
        }
    });

    // Mettre à jour les boutons de navigation
    elements.prevStepBtn.disabled = stepNumber === 1;

    if (stepNumber === 3) {
        elements.nextStepBtn.style.display = 'none';
        updateConfirmationSummary();
    } else {
        elements.nextStepBtn.style.display = 'inline-flex';
        elements.nextStepBtn.textContent = stepNumber === 2 ? 'Confirmer' : 'Suivant';
        elements.nextStepBtn.innerHTML = stepNumber === 2 ?
            'Confirmer <i class="fas fa-check"></i>' :
            'Suivant <i class="fas fa-arrow-right"></i>';
    }
}

function updateArticleInfo() {
    if (!state.selectedArticle) return;

    const article = state.selectedArticle;

    const available = article.stock_actuel - article.stock_reserve;

    elements.availableStock.textContent = available;
    elements.alreadyReserved.textContent = article.stock_reserve;

    elements.reservationQuantity.max = available;

    if (!elements.reservationQuantity.value || elements.reservationQuantity.value > available) {
        elements.reservationQuantity.value = available > 0 ? 1 : 0;
    }

    state.newReservationData.quantity = parseInt(elements.reservationQuantity.value);
}


function updateConfirmationSummary() {
    if (!state.selectedArticle) return;

    const article = state.selectedArticle;
    const project = state.projects.find(p => p.id === state.newReservationData.projectId);

    let endDate;
    if (state.newReservationData.duration === 'custom') {
        endDate = state.newReservationData.endDate;
    } else {
        const today = new Date();
        endDate = new Date(today);
        endDate.setDate(today.getDate() + parseInt(state.newReservationData.duration));
    }

    const html = `
        <div class="summary-item">
            <h5><i class="fas fa-box"></i> Article</h5>
            <p><strong>${article.nom}</strong> (${article.code})</p>
        </div>
        <div class="summary-item">
            <h5><i class="fas fa-project-diagram"></i> Projet</h5>
            <p>${project?.nom || 'Non spécifié'}</p>
        </div>
        <div class="summary-item">
            <h5><i class="fas fa-boxes"></i> Quantité</h5>
            <p>${state.newReservationData.quantity} unités</p>
        </div>
        <div class="summary-item">
            <h5><i class="fas fa-calendar-alt"></i> Durée</h5>
            <p>${state.newReservationData.duration === 'custom' ?
                `Jusqu'au ${formatDate(endDate)}` :
                `${state.newReservationData.duration} jours`}</p>
        </div>
        ${state.newReservationData.comment ? `
        <div class="summary-item">
            <h5><i class="fas fa-comment"></i> Commentaire</h5>
            <p>${state.newReservationData.comment}</p>
        </div>
        ` : ''}
    `;

    elements.confirmationSummary.innerHTML = html;
}

// ===== ÉVÉNEMENTS =====
function setupEventListeners() {
    // Déconnexion
    elements.logoutBtn.addEventListener('click', logout);

    // Boutons header
    elements.newReservationBtn.addEventListener('click', () => {
        resetNewReservationModal();
        showModal(elements.newReservationModal);
    });

    // Filtres
    elements.toggleFiltersBtn.addEventListener('click', () => {
        const isVisible = elements.filtersContainer.style.display === 'block';
        elements.filtersContainer.style.display = isVisible ? 'none' : 'block';
        elements.toggleFiltersBtn.innerHTML = isVisible ?
            '<i class="fas fa-sliders-h"></i> Afficher les filtres' :
            '<i class="fas fa-sliders-h"></i> Masquer les filtres';
    });

    elements.applyFiltersBtn.addEventListener('click', () => {
        state.filters = {
            project: elements.filterProject.value,
            article: elements.filterArticle.value,
            status: elements.filterStatus.value,
            user: elements.filterUser.value
        };
        updateReservationsDisplay();
    });

    elements.resetFiltersBtn.addEventListener('click', () => {
        elements.filterProject.value = '';
        elements.filterArticle.value = '';
        elements.filterStatus.value = '';
        elements.filterUser.value = '';
        elements.searchReservations.value = '';

        state.filters = {
            project: '',
            article: '',
            status: '',
            user: ''
        };

        updateReservationsDisplay();
    });

    // Onglets
    elements.tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;

            // Mettre à jour les onglets actifs
            elements.tabBtns.forEach(b => b.classList.remove('active'));
            elements.tabContents.forEach(content => content.classList.remove('active'));

            btn.classList.add('active');
            document.getElementById(`${tabName}Tab`).classList.add('active');
            state.currentTab = tabName;
        });
    });

    // Recherche
    elements.searchBtn.addEventListener('click', () => {
        updateReservationsDisplay();
    });

    elements.searchReservations.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
            updateReservationsDisplay();
        }
    });

    // Sélection des réservations
    elements.selectAllActive.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        const activeReservations = state.reservations.filter(r => !isReservationExpired(r));

        if (isChecked) {
            activeReservations.forEach(r => state.selections.active.add(r.id));
        } else {
            state.selections.active.clear();
        }

        updateReservationsDisplay();
    });

    elements.selectAllExpired.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        const expiredReservations = state.reservations.filter(r => isReservationExpired(r));

        if (isChecked) {
            expiredReservations.forEach(r => state.selections.expired.add(r.id));
        } else {
            state.selections.expired.clear();
        }

        updateReservationsDisplay();
    });

    // Délégation d'événements pour les cases à cocher dynamiques
    document.addEventListener('change', (e) => {
        if (e.target.classList.contains('reservation-checkbox')) {
            const reservationId = e.target.dataset.id;
            const tab = e.target.dataset.tab || 'active';

            if (e.target.checked) {
                state.selections[tab].add(reservationId);
            } else {
                state.selections[tab].delete(reservationId);
            }

            updateSelectionInfo();
        }
    });

    // Délégation d'événements pour les boutons d'action
    document.addEventListener('click', async (e) => {
        const target = e.target.closest('button');
        if (!target) return;

        // Boutons de détails
        if (target.classList.contains('view-details')) {
            const reservationId = target.dataset.id;
            await showReservationDetails(reservationId);
        }

        // Boutons de libération
        if (target.classList.contains('release-btn')) {
            const reservationId = target.dataset.id;
            await prepareRelease(reservationId);
        }

        // Boutons de prolongation
        if (target.classList.contains('extend-btn')) {
            const reservationId = target.dataset.id;
            await prepareExtend(reservationId);
        }
    });

    // Boutons de libération sélectionnés
    elements.releaseSelectedBtn.addEventListener('click', async () => {
        if (state.selections.active.size === 0) return;

        const confirmed = confirm(`Voulez-vous libérer ${state.selections.active.size} réservation(s) ?`);
        if (!confirmed) return;

        try {
            showLoading();
            for (const reservationId of state.selections.active) {
                await releaseReservation(reservationId, 'Libération groupée');
            }

            state.selections.active.clear();
            await fetchReservations();
            showTemporarySuccess('Réservations libérées avec succès');
        } catch (error) {
            showError('Erreur lors de la libération groupée');
        } finally {
            hideLoading();
        }
    });

    // Boutons de prolongation sélectionnés
    elements.extendSelectedBtn.addEventListener('click', async () => {
        if (state.selections.active.size === 0) return;

        const confirmed = confirm(`Voulez-vous prolonger ${state.selections.active.size} réservation(s) de 7 jours ?`);
        if (!confirmed) return;

        try {
            showLoading();
            for (const reservationId of state.selections.active) {
                await extendReservation(reservationId, 7, 'Prolongation groupée');
            }

            state.selections.active.clear();
            await fetchReservations();
            showTemporarySuccess('Réservations prolongées avec succès');
        } catch (error) {
            showError('Erreur lors de la prolongation groupée');
        } finally {
            hideLoading();
        }
    });

    // Boutons de libération pour réservations expirées
    elements.releaseExpiredSelectedBtn.addEventListener('click', async () => {
        if (state.selections.expired.size === 0) return;

        const confirmed = confirm(`Voulez-vous libérer ${state.selections.expired.size} réservation(s) expirées ?`);
        if (!confirmed) return;

        try {
            showLoading();
            for (const reservationId of state.selections.expired) {
                await releaseReservation(reservationId, 'Libération réservations expirées');
            }

            state.selections.expired.clear();
            await fetchReservations();
            showTemporarySuccess('Réservations expirées libérées avec succès');
        } catch (error) {
            showError('Erreur lors de la libération des réservations expirées');
        } finally {
            hideLoading();
        }
    });

    // Boutons de prolongation pour réservations expirées
    elements.extendExpiredSelectedBtn.addEventListener('click', async () => {
        if (state.selections.expired.size === 0) return;

        const confirmed = confirm(`Voulez-vous prolonger ${state.selections.expired.size} réservation(s) expirées de 7 jours ?`);
        if (!confirmed) return;

        try {
            showLoading();
            for (const reservationId of state.selections.expired) {
                await extendReservation(reservationId, 7, 'Prolongation réservations expirées');
            }

            state.selections.expired.clear();
            await fetchReservations();
            showTemporarySuccess('Réservations expirées prolongées avec succès');
        } catch (error) {
            showError('Erreur lors de la prolongation des réservations expirées');
        } finally {
            hideLoading();
        }
    });

    // Notification des responsables
    elements.notifyExpiredBtn.addEventListener('click', () => {
        const expiredReservations = state.reservations.filter(r => isReservationExpired(r));
        if (expiredReservations.length === 0) {
            showError('Aucune réservation expirée à notifier');
            return;
        }

        const confirmed = confirm(`Voulez-vous notifier les responsables de ${expiredReservations.length} réservation(s) expirées ?`);
        if (confirmed) {
            // Simuler l'envoi de notifications
            showError(`Notifications envoyées pour ${expiredReservations.length} réservation(s) expirées`);
        }
    });

    // Modal nouvelle réservation
    elements.prevStepBtn.addEventListener('click', () => {
        if (state.currentStep > 1) {
            updateStep(state.currentStep - 1);
        }
    });

    elements.nextStepBtn.addEventListener('click', async () => {
        if (state.currentStep === 1) {
            // Vérifier qu'un article est sélectionné
            if (!state.selectedArticle) {
                showError('Veuillez sélectionner un article', elements.projectError);
                return;
            }
            updateStep(2);
        } else if (state.currentStep === 2) {
            // Valider les données de l'étape 2
            if (!validateStep2()) {
                return;
            }
            updateStep(3);
        }
    });

    elements.cancelReservationBtn.addEventListener('click', () => {
        hideModal();
        resetNewReservationModal();
    });

    // Recherche d'articles
    elements.searchReservationArticleBtn.addEventListener('click', searchArticles);
    elements.reservationArticleSearch.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
            searchArticles();
        }
    });

    elements.changeArticleBtn.addEventListener('click', () => {
        state.selectedArticle = null;
        elements.selectedArticlePreview.style.display = 'none';
        elements.reservationSearchResults.style.display = 'block';
    });

    // Gestion de la quantité
    elements.quantityMinusBtn.addEventListener('click', () => {
        const current = parseInt(elements.reservationQuantity.value);
        const min = parseInt(elements.reservationQuantity.min);
        if (current > min) {
            elements.reservationQuantity.value = current - 1;
            state.newReservationData.quantity = current - 1;
        }
    });

    elements.quantityPlusBtn.addEventListener('click', () => {
        const current = parseInt(elements.reservationQuantity.value);
        const max = parseInt(elements.reservationQuantity.max);
        if (current < max) {
            elements.reservationQuantity.value = current + 1;
            state.newReservationData.quantity = current + 1;
        }
    });

    elements.reservationQuantity.addEventListener('change', (e) => {
        const value = parseInt(e.target.value);
        const max = parseInt(e.target.max);
        const min = parseInt(e.target.min);

        if (value < min) e.target.value = min;
        if (value > max) e.target.value = max;

        state.newReservationData.quantity = parseInt(e.target.value);
    });

    elements.reservationQuantity.addEventListener('input', (e) => {
        state.newReservationData.quantity = parseInt(e.target.value) || 1;
    });

    // Durée de réservation
    elements.reservationDuration.addEventListener('change', (e) => {
        state.newReservationData.duration = e.target.value;
        if (e.target.value === 'custom') {
            elements.customDateGroup.style.display = 'block';

            // Définir la date minimum à demain
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            elements.reservationEndDate.min = tomorrow.toISOString().split('T')[0];

            // Définir la date par défaut à 14 jours
            const defaultEnd = new Date();
            defaultEnd.setDate(defaultEnd.getDate() + 14);
            elements.reservationEndDate.value = defaultEnd.toISOString().split('T')[0];
            state.newReservationData.endDate = defaultEnd.toISOString();
        } else {
            elements.customDateGroup.style.display = 'none';
            state.newReservationData.endDate = '';
        }
    });

    elements.reservationEndDate.addEventListener('change', (e) => {
        state.newReservationData.endDate = e.target.value;
    });

    // Projet
    elements.reservationProject.addEventListener('change', (e) => {
        state.newReservationData.projectId = e.target.value;
    });

    elements.reservationComment.addEventListener('input', (e) => {
        state.newReservationData.comment = e.target.value;
    });

    // Scanner
    elements.scanReservationBtn.addEventListener('click', () => {
        openScanPopup('reservation', 'scan');
    });

    // Confirmation de libération
    elements.confirmReleaseBtn.addEventListener('click', async () => {
        const reservationId = elements.confirmReleaseBtn.dataset.id;
        if (!reservationId) return;

        try {
            showLoading();
            await releaseReservation(reservationId, elements.releaseComment.value || 'Libération manuelle');

            hideModal();
            await fetchReservations();

            showTemporarySuccess('Réservation libérée avec succès');
        } catch (error) {
            showError('Erreur lors de la libération');
        } finally {
            hideLoading();
        }
    });

    // Confirmation de prolongation
    elements.confirmExtendBtn.addEventListener('click', async () => {
        const reservationId = elements.confirmExtendBtn.dataset.id;
        const additionalDays = elements.extendDuration.value;

        if (!reservationId || !additionalDays) return;

        try {
            showLoading();
            await extendReservation(reservationId, additionalDays, elements.extendComment.value || 'Prolongation manuelle');

            hideModal();
            await fetchReservations();

            showTemporarySuccess('Réservation prolongée avec succès');
        } catch (error) {
            showError('Erreur lors de la prolongation');
        } finally {
            hideLoading();
        }
    });

    // Confirmation de réservation
    elements.confirmReservationBtn.addEventListener('click', async () => {
        try {
            showLoading();

            // Calculer la date de fin
            let endDate;
            if (state.newReservationData.duration === 'custom') {
                endDate = state.newReservationData.endDate;
            } else {
                const today = new Date();
                endDate = new Date(today);
                endDate.setDate(today.getDate() + parseInt(state.newReservationData.duration));
            }

            const reservationData = {
                articleId: state.selectedArticle.id,
                quantity: state.newReservationData.quantity,
                projectId: state.newReservationData.projectId,
                duration: state.newReservationData.duration,
                endDate: endDate.toISOString(),
                comment: state.newReservationData.comment
            };

            await createReservation(reservationData);

            hideModal();
            resetNewReservationModal();
            await fetchReservations();

            showTemporarySuccess('Réservations libérées avec succès');
        } catch (error) {
            showError('Erreur lors de la création de la réservation', elements.projectError);
        } finally {
            hideLoading();
        }
    });

    elements.editReservationBtn.addEventListener('click', () => {
        updateStep(2);
    });

    // Nouveau projet depuis la réservation
    elements.newProjectFromReservationBtn.addEventListener('click', () => {
        hideModal();
        showModal(elements.newProjectModal);
    });

    // Modal nouveau projet
    elements.newProjectBtn.addEventListener('click', () => {
        elements.newProjectForm.reset();
        clearError(elements.projectError);
        showModal(elements.newProjectModal);
    });

    // Boutons du modal détails
    elements.releaseFromDetailsBtn.addEventListener('click', async () => {
        const reservationId = elements.releaseFromDetailsBtn.dataset.id;
        if (!reservationId) return;

        hideModal(); // Fermer le modal
        await prepareRelease(reservationId); // Ouvrir le modal de libération
    });

    elements.extendFromDetailsBtn.addEventListener('click', async () => {
        const reservationId = elements.extendFromDetailsBtn.dataset.id;
        if (!reservationId) return;

        hideModal(); // Fermer le modal
        await prepareExtend(reservationId); // Ouvrir le modal de prolongation
    });

    elements.newProjectForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        try {
            showLoading();

            const projectData = {
                nom: elements.projectName.value,
                numero: elements.projectNumber.value,
                description: elements.projectDescription.value,
                responsable: elements.projectManager.value,
                date_fin_prevue: elements.projectEndDate.value
            };

            await createProject(projectData);

            hideModal();
            await fetchProjects();

            // Réinitialiser le formulaire
            elements.newProjectForm.reset();
            clearError(elements.projectError);

            showTemporarySuccess('Réservations libérées avec succès');
        } catch (error) {
            showError('Erreur lors de la création du projet', elements.projectError);
        } finally {
            hideLoading();
        }
    });

    // Fermer les modals
    elements.closeModalBtns.forEach(btn => {
        btn.addEventListener('click', hideModal);
    });

    // Fermer les modals en cliquant à l'extérieur
    [elements.newReservationModal, elements.newProjectModal, elements.releaseModal,
     elements.extendModal, elements.detailsModal].forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                hideModal();
            }
        });
    });

    elements.quantityPlusBtn.addEventListener('click', () => {
        const input = elements.reservationQuantity;
        input.value = parseInt(input.value || 1) + 1;
    });

    elements.quantityMinusBtn.addEventListener('click', () => {
        const input = elements.reservationQuantity;
        const val = parseInt(input.value || 1);
        if (val > 1) input.value = val - 1;
    });

}

// ===== POPUP SCAN =====
async function openScanPopup(actionType, scanType) {
    const popup = document.createElement('div');
    popup.className = 'scan-popup-overlay';

    const actionNames = {
        'sortie': 'Sortie de stock',
        'entree': 'Entrée de stock',
        'reservation': 'Réservation projet'
    };

    popup.innerHTML = `
        <div class="scan-popup">
            <div class="popup-header">
                <h3><i class="fas fa-camera"></i> Scanner pour ${actionNames[actionType]}</h3>
                <button class="close-popup">&times;</button>
            </div>
            <div class="popup-content">
                <div class="scan-section">
                    <div class="camera-placeholder" id="cameraPlaceholder">
                        <i class="fas fa-camera"></i>
                        <p>Caméra non activée</p>
                    </div>
                    <video id="cameraPreview" autoplay playsinline style="display: none;"></video>

                    <div class="scan-controls">
                        <button id="startCameraBtn" class="btn btn-primary">
                            <i class="fas fa-video"></i> Activer la caméra
                        </button>
                        <button id="stopCameraBtn" class="btn btn-secondary" style="display: none;">
                            <i class="fas fa-stop"></i> Arrêter
                        </button>
                        <button id="toggleFlashBtn" class="btn btn-info" style="display: none;">
                            <i class="fas fa-lightbulb"></i> Flash
                        </button>
                    </div>
                </div>

                <div class="manual-section">
                    <h4><i class="fas fa-keyboard"></i> Saisie manuelle</h4>
                    <div class="form-group">
                        <input type="text"
                               id="manualBarcodeInput"
                               placeholder="Saisir le code-barre manuellement"
                               class="scan-input">
                        <button id="confirmManualBtn" class="btn">
                            <i class="fas fa-check"></i> Valider
                        </button>
                    </div>
                </div>

                <div class="scan-instructions">
                    <div class="instruction">
                        <i class="fas fa-lightbulb"></i>
                        <p>Placez le code-barre dans le cadre. Le scan est automatique.</p>
                    </div>
                    <div class="instruction">
                        <i class="fas fa-bolt"></i>
                        <p>Assurez-vous d'avoir une bonne luminosité.</p>
                    </div>
                </div>
            </div>

            <div class="popup-footer">
                <button class="btn btn-secondary close-popup-btn">Annuler</button>
                <div class="scan-stats">
                    <span id="scanStatus">En attente de scan...</span>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(popup);

    // Variables pour le scan
    let scanStream = null;
    let scanInterval = null;
    let currentAction = actionType;
    let lastScannedCode = '';

    // DÉMARRER AUTOMATIQUEMENT LA CAMÉRA
    setTimeout(() => {
        startCameraScan();
    }, 500); // Petit délai pour laisser le popup s'afficher

    // Événements généraux du popup
    popup.querySelector('.close-popup').addEventListener('click', () => {
        stopScan();
        document.body.removeChild(popup);
    });

    popup.querySelector('.close-popup-btn').addEventListener('click', () => {
        stopScan();
        document.body.removeChild(popup);
    });

    popup.addEventListener('click', (e) => {
        if (e.target === popup) {
            stopScan();
            document.body.removeChild(popup);
        }
    });

    // Événements spécifiques au scan
    popup.querySelector('#startCameraBtn').addEventListener('click', startCameraScan);
    popup.querySelector('#stopCameraBtn').addEventListener('click', stopCameraScan);
    popup.querySelector('#toggleFlashBtn').addEventListener('click', toggleFlash);
    popup.querySelector('#confirmManualBtn').addEventListener('click', processManualBarcode);

    async function processManualBarcode() {
        const barcode = popup.querySelector('#manualBarcodeInput').value.trim();
        if (!barcode) return;

        // Injecter le code-barre dans la recherche existante
        elements.reservationArticleSearch.value = barcode;

        // Fermer le popup scan
        stopScan();
        document.body.removeChild(popup);

        // Lancer la recherche standard (nom / numéro / code-barre)
        searchArticles();
    }


    function toggleFlash() {
        // Fonction vide - juste pour éviter l'erreur
        console.log('Toggle flash cliqué');
    }


    let scannerStarted = false;

    async function startCameraScan() {
        if (scannerStarted) return;
        scannerStarted = true;
        try {
            console.log('Démarrage scanner...');

            // 1. DÉMARRER LA CAMÉRA
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            });

            const video = popup.querySelector('#cameraPreview');
            const placeholder = popup.querySelector('#cameraPlaceholder');

            video.srcObject = stream;
            video.style.display = 'block';
            await video.play();

            placeholder.style.display = 'none';

            popup.querySelector('#stopCameraBtn').style.display = 'inline-block';

            scanStream = stream;

            // 2. UTILISER QUAGGA UNIQUEMENT (plus fiable)
            if (typeof Quagga === 'undefined') {
                throw new Error('Bibliothèque scanner non chargée');
            }

            Quagga.init({
                inputStream: {
                    name: "Live",
                    type: "LiveStream",
                    target: video,
                    constraints: {
                        facingMode: "environment"
                    }
                },
                decoder: {
                    readers: ["ean_reader", "code_128_reader", "upc_reader", "ean_8_reader"]
                },
                locate: true,
                frequency: 10,
                numOfWorkers: 2
            }, function(err) {
                if (err) {
                    console.error('ERREUR QUAGGA:', err);
                    popup.querySelector('#scanStatus').innerHTML = `
                        <div style="background: #f44336; color: white; padding: 10px; border-radius: 5px;">
                            <i class="fas fa-exclamation-triangle"></i>
                            Scanner incompatible<br>
                            <small>Utilisez la saisie manuelle</small>
                        </div>
                    `;
                    popup.querySelector('#manualBarcodeInput').focus();
                    return;
                }

                console.log('Quagga démarré avec succès');
                Quagga.start();

                popup.querySelector('#scanStatus').innerHTML = `
                    <div style="background: #4CAF50; color: white; padding: 10px; border-radius: 5px;">
                        <i class="fas fa-check-circle"></i>
                        Scanner prêt<br>
                        <small>Centrez le code-barre</small>
                    </div>
                `;
            });

            // 3. QUAND UN CODE EST DÉTECTÉ
            Quagga.onDetected(function(result) {
                const code = result.codeResult.code;
                const format = result.codeResult.format;

                console.log('Code détecté:', code, 'Format:', format);

                // Arrêter Quagga et la caméra
                Quagga.stop();
                stream.getTracks().forEach(track => track.stop());

                // Afficher confirmation
                popup.querySelector('#scanStatus').innerHTML = `
                    <div style="background: #2196F3; color: white; padding: 10px; border-radius: 5px;">
                        <i class="fas fa-barcode"></i>
                        Code détecté: <strong>${code}</strong><br>
                        <small>Recherche en cours...</small>
                    </div>
                `;

                // Rechercher l'article
                searchArticleByBarcode(code);
            });

        } catch (error) {
            console.error('ERREUR CAMÉRA:', error);
            popup.querySelector('#scanStatus').innerHTML = `
                <div style="background: #FF9800; color: white; padding: 10px; border-radius: 5px;">
                    <i class="fas fa-video-slash"></i>
                    Caméra inaccessible<br>
                    <small>${error.message || 'Permission refusée'}</small>
                </div>
            `;
            popup.querySelector('#manualBarcodeInput').focus();
        }
    }
    // DÉMARRER AUTOMATIQUEMENT LA CAMÉRA
    setTimeout(() => {
        startCameraScan();
    }, 500);

    // FONCTION DE RECHERCHE D'ARTICLE
    async function searchArticleByBarcode(barcode) {
        try {
            console.log('Recherche code-barre:', barcode);

            // Recherche EXACTE
            const { data: articles, error } = await supabase
                .from('w_articles')
                .select('*')
                .eq('code_barre', barcode)  // Égalité exacte
                .limit(1);

            if (error) {
                console.error('Erreur Supabase:', error);
                throw error;
            }

            console.log('Résultat recherche:', articles);

            if (!articles || articles.length === 0) {
                popup.querySelector('#scanStatus').innerHTML = `
                    <div style="background: #f44336; color: white; padding: 10px; border-radius: 5px;">
                        <i class="fas fa-times-circle"></i>
                        Code-barre non trouvé: <strong>${barcode}</strong><br>
                        <small>Vérifiez dans la base de données</small>
                    </div>
                `;

                // Réafficher le scanner après 3 secondes
                setTimeout(() => {
                    popup.querySelector('#scanStatus').innerHTML = `
                        <div style="background: #4CAF50; color: white; padding: 10px; border-radius: 5px;">
                            <i class="fas fa-redo"></i>
                            Scanner réactivé<br>
                            <small>Scannez à nouveau</small>
                        </div>
                    `;
                    if (scanStream) {
                        scanStream.getTracks().forEach(track => track.stop());
                    }
                    startCameraScan();
                }, 3000);

                return;
            }

            const article = articles[0];
            console.log('Article trouvé:', article.nom);

            // SUCCÈS - Fermer le popup de scan
            stopScan();
            document.body.removeChild(popup);

            searchArticles();

        } catch (error) {
            console.error('ERREUR RECHERCHE:', error);
            popup.querySelector('#scanStatus').innerHTML = `
                <div style="background: #9C27B0; color: white; padding: 10px; border-radius: 5px;">
                    <i class="fas fa-exclamation-circle"></i>
                    Erreur de connexion<br>
                    <small>${error.message || 'Vérifiez votre connexion'}</small>
                </div>
            `;
        }
    }

    function stopCameraScan() {
        console.log('Arrêt du scanner...');

        // Arrêter Quagga
        try {
            if (typeof Quagga !== 'undefined' && Quagga.stop) {
                Quagga.stop();
            }
        } catch (e) {
            console.warn('Erreur arrêt Quagga:', e);
        }

        // Arrêter la caméra
        if (scanStream) {
            scanStream.getTracks().forEach(track => track.stop());
            scanStream = null;
        }

        // Réinitialiser l'interface
        const video = popup.querySelector('#cameraPreview');
        if (video) {
            video.srcObject = null;
            video.style.display = 'none';
        }

        const placeholder = popup.querySelector('#cameraPlaceholder');
        if (placeholder) {
            placeholder.style.display = 'block';
        }

        const stopBtn = popup.querySelector('#stopCameraBtn');
        if (stopBtn) {
            stopBtn.style.display = 'none';
        }
    }

    function stopScan() {
        stopCameraScan();

        if (scanInterval) {
            clearInterval(scanInterval);
            scanInterval = null;
        }
    }
}

// ===== FONCTIONS D'ASSISTANCE =====
async function searchArticles() {
    const searchTerm = elements.reservationArticleSearch.value.trim().toLowerCase();

    if (!searchTerm) {
        elements.reservationSearchResults.style.display = 'none';
        return;
    }

    try {
        const { data, error } = await supabase
            .from('w_articles')
            .select('*')
            .or(`nom.ilike.%${searchTerm}%,numero.ilike.%${searchTerm}%,code_barre.ilike.%${searchTerm}%`)
            .limit(10);

        if (error) throw error;

        if (!data || data.length === 0) {
            elements.reservationResultsList.innerHTML = `
                <div class="no-results">
                    <i class="fas fa-search"></i>
                    <p>Aucun article trouvé</p>
                </div>
            `;
            elements.reservationSearchResults.style.display = 'block';
            return;
        }

        let html = '';
        data.forEach(article => {
            const reservedQuantity = state.reservations
                .filter(r => r.id_article === article.id)
                .reduce((sum, r) => sum + r.quantite, 0);
            const available = article.stock - reservedQuantity;

            html += `
                <div class="result-item" data-id="${article.id}">
                    <div class="result-info">
                        <h6>${article.nom}</h6>
                        <p>Numéro: ${article.numero} | Stock: ${available} disponible(s)</p>
                        ${article.code_barre ? `<p>Code-barre: ${article.code_barre}</p>` : ''}
                    </div>
                </div>
            `;
        });

        elements.reservationResultsList.innerHTML = html;
        elements.reservationSearchResults.style.display = 'block';

        // Ajouter les événements de clic
        document.querySelectorAll('.result-item').forEach(item => {
            item.addEventListener('click', () => {
                const articleId = item.dataset.id;
                selectArticle(articleId);
            });
        });

    } catch (error) {
        console.error('Erreur recherche articles:', error);
        showError('Erreur lors de la recherche d\'articles');
    }
}

function selectArticle(articleId) {
    const article = state.articles.find(a => a.id === articleId);
    if (!article) return;

    state.selectedArticle = article;
    state.newReservationData.articleId = articleId;

    const available = article.stock_actuel - article.stock_reserve;

    elements.articlePreview.innerHTML = `
        <img src="${article.photo_url}" alt="${article.nom}">
        <div class="article-info">
            <h5>${article.nom}</h5>
            <p><strong>Numéro:</strong> ${article.numero}</p>
            ${article.code_barre ? `<p><strong>Code-barre:</strong> ${article.code_barre}</p>` : ''}
            <p><strong>Description:</strong> ${article.description || 'Non disponible'}</p>
            <p><strong>Stock total:</strong> ${article.stock_actuel}</p>
            <p><strong>Déjà réservé:</strong> ${article.stock_reserve}</p>
            <p><strong>Disponible:</strong> <span class="available">${available}</span></p>
        </div>
    `;

    elements.selectedArticlePreview.style.display = 'block';
    elements.reservationSearchResults.style.display = 'none';

    updateArticleInfo();
}

function validateStep2() {
    // Vérifier la quantité
    if (state.newReservationData.quantity < 1) {
        showError('La quantité doit être au moins de 1', elements.projectError);
        return false;
    }

    // Vérifier le projet
    if (!state.newReservationData.projectId) {
        showError('Veuillez sélectionner un projet', elements.projectError);
        return false;
    }

    // Vérifier la durée
    if (state.newReservationData.duration === 'custom' && !state.newReservationData.endDate) {
        showError('Veuillez sélectionner une date de fin', elements.projectError);
        return false;
    }

    clearError(elements.projectError);
    return true;
}

async function showReservationDetails(reservationId) {
    try {
        const reservation = state.reservations.find(r => r.id === reservationId);
        if (!reservation) {
            showError('Réservation non trouvée');
            return;
        }

        const articleName = reservation.article_nom || (state.articles.find(a => a.id === reservation.article_id)?.nom || 'Inconnu');
        const articleCode = reservation.article?.code || state.articles.find(a => a.id === reservation.article_id)?.code || reservation.article?.code_barre || 'N/A';
        const projetName = reservation.projet || 'Projet inconnu';
        const userName = reservation.utilisateur || 'Utilisateur inconnu';
        const userEmail = state.users.find(u => u.id === reservation.utilisateur_id)?.email || 'N/A';
        const projetResponsable = state.projects.find(p => p.id === reservation.projet_id)?.responsable || 'N/A';

        const daysLeft = getDaysUntilExpiration(reservation);
        const isExpired = isReservationExpired(reservation);

        elements.reservationFullDetails.innerHTML = `
            <div class="details-section">
                <h4><i class="fas fa-box"></i> Article</h4>
                <div class="detail-item">
                    <span class="label">Nom:</span>
                    <span class="value">${articleName}</span>
                </div>
                <div class="detail-item">
                    <span class="label">Code:</span>
                    <span class="value">${articleCode}</span>
                </div>
                <div class="detail-item">
                    <span class="label">Quantité réservée:</span>
                    <span class="value">${reservation.quantite}</span>
                </div>
            </div>

            <div class="details-section">
                <h4><i class="fas fa-project-diagram"></i> Projet</h4>
                <div class="detail-item">
                    <span class="label">Nom:</span>
                    <span class="value">${projetName}</span>
                </div>
                <div class="detail-item">
                    <span class="label">Responsable:</span>
                    <span class="value">${projetResponsable}</span>
                </div>
            </div>

            <div class="details-section">
                <h4><i class="fas fa-calendar"></i> Dates</h4>
                <div class="detail-item">
                    <span class="label">Réservé le:</span>
                    <span class="value">${reservation.date_mouvement ? reservation.date_mouvement.split('-').reverse().join('/') : formatDate(reservation.created_at)} ${reservation.heure_mouvement || ''}</span>
                </div>
                <div class="detail-item">
                    <span class="label">Date de fin:</span>
                    <span class="value">${formatDate(reservation.date_fin)}</span>
                </div>
                <div class="detail-item">
                    <span class="label">Statut:</span>
                    <span class="value badge ${isExpired ? 'danger' : daysLeft <= 7 ? 'warning' : 'info'}">
                        ${isExpired ? 'À libérer' : `${daysLeft} jours restants`}
                    </span>
                </div>
            </div>

            <div class="details-section">
                <h4><i class="fas fa-user"></i> Utilisateur</h4>
                <div class="detail-item">
                    <span class="label">Nom:</span>
                    <span class="value">${userName}</span>
                </div>
                <div class="detail-item">
                    <span class="label">Email:</span>
                    <span class="value">${userEmail}</span>
                </div>
            </div>

            ${reservation.commentaire ? `
            <div class="details-section">
                <h4><i class="fas fa-comment"></i> Notes</h4>
                <p>${reservation.notes}</p>
            </div>
            ` : ''}

            ${reservation.notes ? `
            <div class="details-section">
                <h4><i class="fas fa-comment"></i> Commentaire</h4>
                <p>${reservation.commentaire}</p>
            </div>
            ` : ''}
        `;

        // Stocker l'ID de réservation pour les actions
        elements.releaseFromDetailsBtn.dataset.id = reservationId;
        elements.extendFromDetailsBtn.dataset.id = reservationId;

        showModal(elements.detailsModal);
    } catch (error) {
        console.error('Erreur affichage détails:', error);
        showError('Erreur lors du chargement des détails');
    }
}

async function prepareRelease(reservationId) {
    const reservation = state.reservations.find(r => r.id === reservationId);
    if (!reservation) {
        showError('Réservation non trouvée');
        return;
    }

    const articleName = reservation.article_nom || state.articles.find(a => a.id === reservation.article_id)?.nom || 'Inconnu';
    const projetName = reservation.projet || 'Projet inconnu';

    elements.releaseDetails.innerHTML = `
        <p>Êtes-vous sûr de vouloir libérer cette réservation ?</p>
        <div class="release-info">
            <p><strong>Article:</strong> ${articleName} (${reservation.quantite} unités)</p>
            <p><strong>Projet:</strong> ${projetName}</p>
            <p><strong>Réservé le:</strong> ${formatDate(reservation.created_at)}</p>
        </div>
    `;

    elements.releaseComment.value = '';
    elements.confirmReleaseBtn.dataset.id = reservationId;

    clearError(elements.releaseError);
    showModal(elements.releaseModal);
}

async function prepareExtend(reservationId) {
    const reservation = state.reservations.find(r => r.id === reservationId);
    if (!reservation) {
        showError('Réservation non trouvée');
        return;
    }

    const articleName = reservation.article_nom || state.articles.find(a => a.id === reservation.article_id)?.nom || 'Inconnu';
    const projetName = reservation.projet || 'Projet inconnu';

    // CORRECTION: Utilisez extendDetails, pas releaseDetails
    elements.extendDetails.innerHTML = `
        <p>Prolonger la réservation :</p>
        <div class="extend-info">
            <p><strong>Article:</strong> ${articleName} (${reservation.quantite} unités)</p>
            <p><strong>Projet:</strong> ${projetName}</p>
            <p><strong>Date de fin actuelle:</strong> ${formatDate(reservation.date_fin)}</p>
        </div>
    `;

    elements.extendComment.value = '';
    elements.extendDuration.value = '14';
    elements.confirmExtendBtn.dataset.id = reservationId;

    clearError(elements.extendError);
    showModal(elements.extendModal);
}

async function bulkReleaseExpired() {
    const expiredReservations = state.reservations.filter(r => isReservationExpired(r));

    if (expiredReservations.length === 0) {
        showError('Aucune réservation expirée à libérer');
        return;
    }

    try {
        showLoading();

        for (const reservation of expiredReservations) {
            await releaseReservation(reservation.id, 'Libération automatique - réservation expirée');
        }

        await fetchReservations();
        showTemporarySuccess(`${expiredReservations.length} réservation(s) expirée(s) libérée(s) avec succès`);
    } catch (error) {
        console.error('Erreur libération en masse:', error);
        showError('Erreur lors de la libération en masse');
    } finally {
        hideLoading();
    }
}

// ===== INITIALISATION =====
async function init() {
    try {
        showLoading();

        // Vérifier l'authentification (comme dans impression.js)
        const isLoggedIn = await checkAuth();
        if (!isLoggedIn) {
            return;
        }

        // Charger les données
        await Promise.all([
            fetchArticles(),
            fetchProjects(),
            fetchUsers()
        ]);
        await fetchReservations();

        // Configurer les événements
        setupEventListeners();

        // Configurer la date de fin par défaut
        const defaultEnd = new Date();
        defaultEnd.setDate(defaultEnd.getDate() + 14);
        elements.reservationEndDate.value = defaultEnd.toISOString().split('T')[0];

        // Mettre à jour les sélections
        updateSelectionInfo();

        hideLoading();

    } catch (error) {
        console.error('Erreur initialisation:', error);
        showError('Erreur lors de l\'initialisation de l\'application');
        hideLoading();
    }
}

function showTemporarySuccess(message, duration = 2000) {
    const successDiv = document.createElement('div');
    successDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        display: flex;
        align-items: center;
        gap: 10px;
        animation: slideIn 0.3s ease;
    `;
    successDiv.innerHTML = `
        <i class="fas fa-check-circle"></i>
        <span>${message}</span>
    `;

    document.body.appendChild(successDiv);

    // Animation CSS
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
        }
    `;
    document.head.appendChild(style);

    // Supprimer après la durée
    setTimeout(() => {
        successDiv.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => {
            if (successDiv.parentNode) {
                document.body.removeChild(successDiv);
            }
            if (style.parentNode) {
                document.head.removeChild(style);
            }
        }, 300);
    }, duration);
}

// Démarrer l'application
document.addEventListener('DOMContentLoaded', init);