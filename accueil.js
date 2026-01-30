import { supabase } from './supabaseClient.js';

// Éléments DOM
let currentUser = null;
let currentModal = null;

// Objet pour stocker les éléments DOM
const elements = {};

const now = new Date();
const dateFr = now.toISOString().split('T')[0]; // Format YYYY-MM-DD
const timeFr = now.toTimeString().split(' ')[0]; // Format HH:MM:SS

// Éléments du modal Détails du projet
let projectDetailsModal = null;
let archiveProjectBtn = null;
let editProjectBtn = null;
let exportProjectBtn = null;
let addReservationToProjectBtn = null;

// ===== FONCTIONS UTILITAIRES POUR PROJETS =====
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

// ===== FONCTIONS UTILITAIRES GLOBALES =====

// Fonction pour agrandir l'image d'article
function enlargeArticleImage(imageUrl, title) {
    console.log('Agrandir image:', imageUrl, title);

    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.95);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        cursor: pointer;
    `;

    const enlargedImg = document.createElement('img');
    enlargedImg.src = imageUrl;
    enlargedImg.alt = title;
    enlargedImg.style.cssText = `
        max-width: 90%;
        max-height: 90%;
        border-radius: 8px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.8);
        cursor: default;
        object-fit: contain;
        background: white;
        padding: 10px;
    `;

    // Gestion des erreurs d'image
    enlargedImg.onerror = function() {
        this.src = 'https://via.placeholder.com/400x400/cccccc/666666?text=Image+non+disponible';
        this.alt = 'Image non disponible';
    };

    const titleDiv = document.createElement('div');
    titleDiv.style.cssText = `
        position: absolute;
        bottom: 20px;
        color: white;
        text-align: center;
        width: 100%;
        font-size: 18px;
        background: rgba(0,0,0,0.8);
        padding: 15px;
        font-weight: bold;
    `;
    titleDiv.textContent = title;

    // Bouton fermer
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.cssText = `
        position: absolute;
        top: 20px;
        right: 20px;
        background: rgba(0,0,0,0.7);
        color: white;
        border: none;
        border-radius: 50%;
        width: 50px;
        height: 50px;
        font-size: 30px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10001;
    `;

    closeBtn.addEventListener('click', () => {
        document.body.removeChild(overlay);
    });

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            document.body.removeChild(overlay);
        }
    });

    // Échap pour fermer
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            document.body.removeChild(overlay);
            document.removeEventListener('keydown', handleEscape);
        }
    };

    document.addEventListener('keydown', handleEscape);

    overlay.appendChild(enlargedImg);
    overlay.appendChild(titleDiv);
    overlay.appendChild(closeBtn);
    document.body.appendChild(overlay);

    // Focus sur l'overlay
    overlay.focus();
}

// ===== FONCTIONS UTILITAIRES =====
function hideLoading() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
    }
}

function showAlert(message, type = 'info') {
    // Créer une alerte temporaire
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert-message ${type}`;
    alertDiv.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;

    // Ajouter au début du main-content
    const mainContent = document.querySelector('.main-content');
    mainContent.insertBefore(alertDiv, mainContent.firstChild);

    // Supprimer après 5 secondes
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.parentNode.removeChild(alertDiv);
        }
    }, 5000);
}

// ===== GESTION DES MODALS =====
function showModal(modalElement) {
    if (state.currentModal && state.currentModal !== modalElement) {
        state.previousModal = state.currentModal;
        state.currentModal.style.display = 'none';
    }

    modalElement.style.display = 'flex';
    state.currentModal = modalElement;
}

function hideModal() {
    if (!state.currentModal) return;

    state.currentModal.style.display = 'none';
    state.currentModal = null;
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

async function getProjectReservations(projectId) {
    try {
        // 1. Récupérer le projet
        const { data: project, error: projectError } = await supabase
            .from('w_projets')
            .select('*')
            .eq('id', projectId)
            .single();

        if (projectError) throw projectError;

        // 2. RÉCUPÉRER LES SORTIES (par projet_id)
        const { data: sorties, error: sortiesError } = await supabase
            .from('w_mouvements')
            .select(`
                *,
                article:article_id (nom, numero, code_barre, prix_unitaire),
                utilisateur:utilisateur_id (username)
            `)
            .eq('projet_id', projectId)
            .eq('type', 'sortie')
            .order('created_at', { ascending: false });

        if (sortiesError) throw sortiesError;

        // 3. RÉCUPÉRER LES RETOURS DE STOCK (type 'retour_projet')
        const { data: retours, error: retoursError } = await supabase
            .from('w_mouvements')
            .select(`
                *,
                article:article_id (nom, numero, code_barre, prix_unitaire),
                utilisateur:utilisateur_id (username)
            `)
            .eq('projet_id', projectId)
            .eq('type', 'retour_projet')
            .order('created_at', { ascending: false });

        if (retoursError) throw retoursError;

        // 4. RÉCUPÉRER LES RÉSERVATIONS
        const { data: reservations, error: reservationsError } = await supabase
            .from('w_reservations_actives')
            .select(`
                *,
                w_articles (
                    nom,
                    numero,
                    code_barre,
                    prix_unitaire
                ),
                w_users (
                    username
                )
            `)
            .eq('projet_id', projectId)
            .order('created_at', { ascending: false });

        if (reservationsError) throw reservationsError;

        return {
            project: project,
            sorties: sorties || [],
            retours: retours || [],  // ← NOUVEAU : Ajout des retours
            reservations: reservations || []
        };

    } catch (error) {
        console.error('Erreur chargement données projet:', error);
        return { project: null, sorties: [], retours: [], reservations: [] };  // ← MODIFIÉ
    }
}

function switchProjectTab(tabName) {
    // Mettre à jour les boutons d'onglets
    document.querySelectorAll('.project-tab-btn').forEach(btn => {
        if (btn.dataset.tab === tabName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Mettre à jour les contenus d'onglets
    const tabs = ['info', 'reservations', 'history'];
    tabs.forEach(tab => {
        const element = document.getElementById(`project${tab.charAt(0).toUpperCase() + tab.slice(1)}Tab`);
        if (element) {
            if (tab === tabName) {
                element.classList.add('active');
            } else {
                element.classList.remove('active');
            }
        }
    });
}

// Fonction helper pour éditer une réservation
async function editReservation(reservationId) {
    try {
        // Récupérer la réservation
        const { data: reservation, error } = await supabase
            .from('w_reservations_actives')
            .select(`
                *,
                w_articles (
                    nom,
                    code,
                    prix_unitaire,
                    quantite_disponible
                )
            `)
            .eq('id', reservationId)
            .single();

        if (error) throw error;

        if (!reservation) {
            showAlert('Réservation non trouvée', 'error');
            return;
        }

        // Créer un modal d'édition
        const modalHtml = `
            <div class="modal-overlay" id="editReservationModal" style="display: flex;">
                <div class="modal">
                    <div class="modal-header">
                        <h3><i class="fas fa-edit"></i> Modifier la réservation</h3>
                        <button class="close-modal">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label>Article :</label>
                            <input type="text"
                                   value="${reservation.w_articles?.nom || ''}"
                                   class="form-input"
                                   disabled>
                        </div>

                        <div class="form-group">
                            <label for="editQuantity">
                                <i class="fas fa-boxes"></i> Quantité *
                            </label>
                            <div class="quantity-input-group">
                                <button type="button" class="quantity-btn minus" id="editQuantityMinus">
                                    <i class="fas fa-minus"></i>
                                </button>
                                <input type="number"
                                       id="editQuantity"
                                       min="1"
                                       max="${reservation.w_articles?.quantite_disponible + reservation.quantite || 100}"
                                       value="${reservation.quantite}"
                                       class="form-input quantity">
                                <button type="button" class="quantity-btn plus" id="editQuantityPlus">
                                    <i class="fas fa-plus"></i>
                                </button>
                            </div>
                            <div class="quantity-info">
                                <span>Stock disponible : <strong>${reservation.w_articles?.quantite_disponible + reservation.quantite || 0}</strong></span>
                            </div>
                        </div>

                        <div class="form-group">
                            <label for="editDateFin">
                                <i class="fas fa-calendar"></i> Date de fin *
                            </label>
                            <input type="date"
                                   id="editDateFin"
                                   value="${reservation.date_fin.split('T')[0]}"
                                   class="form-input"
                                   required>
                        </div>

                        <div class="form-group">
                            <label for="editComment">
                                <i class="fas fa-comment"></i> Commentaire
                            </label>
                            <textarea id="editComment"
                                      rows="3"
                                      class="form-textarea">${reservation.commentaire || ''}</textarea>
                        </div>

                        <div class="error-message" id="editReservationError" style="display: none;">
                            <i class="fas fa-exclamation-circle"></i>
                            <span id="editReservationErrorText"></span>
                        </div>

                        <div class="modal-actions">
                            <button id="confirmEditReservationBtn" class="btn-primary">
                                <i class="fas fa-save"></i> Enregistrer
                            </button>
                            <button type="button" class="btn-secondary cancel-edit-btn">
                                Annuler
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Ajouter le modal au DOM
        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = modalHtml;
        document.body.appendChild(modalContainer);

        const modal = document.getElementById('editReservationModal');

        // Gérer la fermeture
        modal.querySelector('.cancel-edit-btn').addEventListener('click', () => {
            modal.remove();
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });

        // Gérer les boutons de quantité
        modal.querySelector('#editQuantityMinus').addEventListener('click', () => {
            const input = modal.querySelector('#editQuantity');
            let value = parseInt(input.value) || 1;
            if (value > 1) {
                input.value = value - 1;
            }
        });

        modal.querySelector('#editQuantityPlus').addEventListener('click', () => {
            const input = modal.querySelector('#editQuantity');
            const max = parseInt(input.max) || 100;
            let value = parseInt(input.value) || 1;
            if (value < max) {
                input.value = value + 1;
            }
        });

        // Gérer l'enregistrement
        modal.querySelector('#confirmEditReservationBtn').addEventListener('click', async () => {
            const quantity = parseInt(modal.querySelector('#editQuantity').value);
            const dateFin = modal.querySelector('#editDateFin').value;
            const comment = modal.querySelector('#editComment').value.trim();

            // Validation
            if (!quantity || quantity < 1) {
                modal.querySelector('#editReservationErrorText').textContent = 'La quantité doit être au moins de 1';
                modal.querySelector('#editReservationError').style.display = 'flex';
                return;
            }

            if (!dateFin) {
                modal.querySelector('#editReservationErrorText').textContent = 'La date de fin est obligatoire';
                modal.querySelector('#editReservationError').style.display = 'flex';
                return;
            }

            try {
                showLoading();

                // Mettre à jour la réservation
                const { error: updateError } = await supabase
                    .from('w_reservations_actives')
                    .update({
                        quantite: quantity,
                        date_fin: dateFin + 'T23:59:59',
                        commentaire: comment,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', reservationId);

                if (updateError) throw updateError;

                showAlert('Réservation modifiée avec succès', 'success');

                // Recharger les données
                await fetchReservations();

                // Recharger les détails du projet si ouvert
                if (state.currentProject) {
                    await showProjectDetails(state.currentProject.id); // ← PROBLÈME ICI
                }

                // Fermer le modal
                modal.remove();

            } catch (error) {
                console.error('Erreur modification réservation:', error);
                modal.querySelector('#editReservationErrorText').textContent = error.message || 'Erreur lors de la modification';
                modal.querySelector('#editReservationError').style.display = 'flex';
            } finally {
                hideLoading();
            }
        });

    } catch (error) {
        console.error('Erreur préparation édition réservation:', error);
        showAlert('Erreur lors de la préparation de l\'édition', 'error');
    }
}

// Fonction pour mettre à jour les statistiques supplémentaires
function updateReservationStats(itemsReserves, valeurReserves, itemsSortis, valeurSortis) {
    // Créer ou mettre à jour un élément HTML pour afficher les stats détaillées
    const statsContainer = document.getElementById('projectDetailsStats') ||
                          document.querySelector('.project-stats-container');

    if (!statsContainer) {
        // Si l'élément n'existe pas, le créer
        const detailsContent = document.querySelector('.project-details-content');
        if (detailsContent) {
            const statsHtml = `
                <div class="project-stats-container">
                    <div class="project-stats-grid">
                        <div class="stat-card sortie">
                            <div class="stat-icon">
                                <i class="fas fa-check-circle"></i>
                            </div>
                            <div class="stat-content">
                                <div class="stat-value">${itemsSortis}</div>
                                <div class="stat-label">Articles utilisés</div>
                                <div class="stat-amount">${valeurSortis.toFixed(2)} €</div>
                            </div>
                        </div>
                        <div class="stat-card reservation">
                            <div class="stat-icon">
                                <i class="fas fa-clock"></i>
                            </div>
                            <div class="stat-content">
                                <div class="stat-value">${itemsReserves}</div>
                                <div class="stat-label">Articles réservés</div>
                                <div class="stat-amount">${valeurReserves.toFixed(2)} €</div>
                            </div>
                        </div>
                        <div class="stat-card total">
                            <div class="stat-icon">
                                <i class="fas fa-calculator"></i>
                            </div>
                            <div class="stat-content">
                                <div class="stat-value">${itemsSortis + itemsReserves}</div>
                                <div class="stat-label">Total articles</div>
                                <div class="stat-amount">${(valeurSortis + valeurReserves).toFixed(2)} €</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            detailsContent.insertAdjacentHTML('afterbegin', statsHtml);
        }
    } else {
        // Mettre à jour les valeurs
        const sortieValue = statsContainer.querySelector('.stat-card.sortie .stat-value');
        const sortieAmount = statsContainer.querySelector('.stat-card.sortie .stat-amount');
        const reserveValue = statsContainer.querySelector('.stat-card.reservation .stat-value');
        const reserveAmount = statsContainer.querySelector('.stat-card.reservation .stat-amount');
        const totalValue = statsContainer.querySelector('.stat-card.total .stat-value');
        const totalAmount = statsContainer.querySelector('.stat-card.total .stat-amount');

        if (sortieValue) sortieValue.textContent = itemsSortis;
        if (sortieAmount) sortieAmount.textContent = `${valeurSortis.toFixed(2)} €`;
        if (reserveValue) reserveValue.textContent = itemsReserves;
        if (reserveAmount) reserveAmount.textContent = `${valeurReserves.toFixed(2)} €`;
        if (totalValue) totalValue.textContent = itemsSortis + itemsReserves;
        if (totalAmount) totalAmount.textContent = `${(valeurSortis + valeurReserves).toFixed(2)} €`;
    }
}


function updateProjectReservations(sorties, retours, reservations) {
    const allItems = [...sorties, ...retours, ...reservations];
    const tbody = document.getElementById('projectReservationsBody');

    if (!tbody) return;

    if (allItems.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="loading-row">
                    <i class="fas fa-info-circle"></i> Aucun article pour ce projet
                </td>
            </tr>
        `;
        return;
    }

    let html = '';

    // 1. AFFICHER LES SORTIES (déjà utilisées)
    if (sorties.length > 0) {
        html += `
            <tr>
                <td colspan="7" class="section-header">
                    <i class="fas fa-check-circle text-success"></i> Articles utilisés (sorties)
                </td>
            </tr>
        `;

        sorties.forEach(sortie => {
            const valeurTotale = sortie.article?.prix_unitaire ?
                (sortie.article.prix_unitaire * sortie.quantite).toFixed(2) : '0.00';

            // Vérifier si cette sortie a déjà été retournée
            const quantiteRetournee = retours
                .filter(retour => retour.article_id === sortie.article_id)
                .reduce((sum, retour) => sum + retour.quantite, 0);

            const quantiteRestante = sortie.quantite - quantiteRetournee;
            const showReturnButton = quantiteRestante > 0;

            html += `
                <tr data-id="${sortie.id}" class="sortie-row">
                    <td>
                        <div class="article-info">
                            <strong>${sortie.article?.nom || 'Article inconnu'}</strong>
                            <small>${sortie.article?.numero || ''}</small>
                        </div>
                    </td>
                    <td>${sortie.article?.numero || 'N/A'}</td>
                    <td>
                        <span class="quantity-badge sortie">
                            -${sortie.quantite}
                        </span>
                    </td>
                    <td>
                        <div class="date-info">
                            ${formatDate(sortie.created_at)}
                            <small>${formatDateTime(sortie.created_at).split(' ')[1] || ''}</small>
                        </div>
                    </td>
                    <td>
                        <div class="price-info">
                            ${sortie.article?.prix_unitaire ?
                                `${sortie.article.prix_unitaire.toFixed(2)} €` :
                                'Prix N/A'}
                            <small>Total: ${valeurTotale} €</small>
                        </div>
                    </td>
                    <td>
                        <div class="user-info">
                            ${sortie.utilisateur?.username || 'Utilisateur inconnu'}
                        </div>
                    </td>
                    <td>
                        <div class="action-buttons">
                            ${showReturnButton ? `
                                <button class="btn-action btn-small return-to-stock"
                                        data-id="${sortie.id}"
                                        data-article-id="${sortie.article_id}"
                                        data-quantity="${quantiteRestante}"
                                        title="Retour ${quantiteRestante} unité(s) au stock">
                                    <i class="fas fa-arrow-left"></i>
                                </button>
                            ` : ''}
                            <button class="btn-action btn-small view-details"
                                    data-id="${sortie.id}"
                                    data-type="sortie"
                                    title="Voir les détails">
                                <i class="fas fa-eye"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });
    }

    // 2. AFFICHER LES RETOURS (retournés au stock)
    if (retours.length > 0) {
        html += `
            <tr>
                <td colspan="7" class="section-header retour-header">
                    <i class="fas fa-undo-alt text-info"></i> Articles retournés au stock
                </td>
            </tr>
        `;

        retours.forEach(retour => {
            const valeurTotale = retour.article?.prix_unitaire ?
                (retour.article.prix_unitaire * retour.quantite).toFixed(2) : '0.00';

            html += `
                <tr data-id="${retour.id}" class="retour-row">
                    <td>
                        <div class="article-info">
                            <strong>${retour.article?.nom || 'Article inconnu'}</strong>
                            <small>${retour.article?.numero || ''}</small>
                        </div>
                    </td>
                    <td>${retour.article?.numero || 'N/A'}</td>
                    <td>
                        <span class="quantity-badge retour">
                            +${retour.quantite}
                        </span>
                    </td>
                    <td>
                        <div class="date-info">
                            ${formatDate(retour.created_at)}
                            <small>${formatDateTime(retour.created_at).split(' ')[1] || ''}</small>
                        </div>
                    </td>
                    <td>
                        <div class="price-info">
                            ${retour.article?.prix_unitaire ?
                                `${retour.article.prix_unitaire.toFixed(2)} €` :
                                'Prix N/A'}
                            <small>Total: ${valeurTotale} €</small>
                        </div>
                    </td>
                    <td>
                        <div class="user-info">
                            ${retour.utilisateur?.username || 'Utilisateur inconnu'}
                        </div>
                    </td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn-action btn-small view-details"
                                    data-id="${retour.id}"
                                    data-type="retour"
                                    title="Voir les détails">
                                <i class="fas fa-eye"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });
    }

    // 3. AFFICHER LES RÉSERVATIONS (pas encore utilisées)
    if (reservations.length > 0) {
        html += `
            <tr>
                <td colspan="7" class="section-header reservation-header">
                    <i class="fas fa-clock text-warning"></i> Articles réservés (non utilisés)
                </td>
            </tr>
        `;

        reservations.forEach(reservation => {
            const article = reservation.w_articles;
            const valeurTotale = article?.prix_unitaire ?
                (article.prix_unitaire * reservation.quantite).toFixed(2) : '0.00';

            html += `
                <tr data-id="${reservation.id}" class="reservation-row">
                    <td>
                        <div class="article-info">
                            <strong>${article?.nom || 'Article inconnu'}</strong>
                            <small>${article?.numero || ''}</small>
                        </div>
                    </td>
                    <td>${article?.numero || 'N/A'}</td>
                    <td>
                        <span class="quantity-badge reservation">
                            ${reservation.quantite}
                        </span>
                    </td>
                    <td>
                        <div class="date-info">
                            ${formatDate(reservation.created_at)}
                            <small>${formatDateTime(reservation.created_at).split(' ')[1]}</small>
                        </div>
                    </td>
                    <td>
                        <div class="price-info">
                            ${article?.prix_unitaire ?
                                `${article.prix_unitaire.toFixed(2)} €` :
                                'Prix N/A'}
                            <small>Total: ${valeurTotale} €</small>
                        </div>
                    </td>
                    <td>
                        <div class="user-info">
                            ${reservation.w_users?.username || 'Utilisateur inconnu'}
                        </div>
                    </td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn-action btn-small use-reservation"
                                    data-id="${reservation.id}"
                                    data-article-id="${reservation.article_id}"
                                    data-quantity="${reservation.quantite}"
                                    title="Marquer comme utilisé">
                                <i class="fas fa-check"></i>
                            </button>
                            <button class="btn-action btn-small view-details"
                                    data-id="${reservation.id}"
                                    data-type="reservation"
                                    title="Voir les détails">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="btn-action btn-small release-reservation"
                                    data-id="${reservation.id}"
                                    title="Libérer la réservation">
                                <i class="fas fa-unlock"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });
    }

    tbody.innerHTML = html;

    setupProjectTableEvents(sorties, retours, reservations);
}

function setupProjectTableEvents(sorties, retours, reservations) {
    // Bouton "Voir détails"
    document.querySelectorAll('.view-details').forEach(btn => {
        btn.addEventListener('click', function() {
            const itemId = this.dataset.id;
            const itemType = this.dataset.type;

            // Passer tous les tableaux à la fonction showItemDetails
            showItemDetails(itemId, itemType, sorties, retours, reservations);
        });
    });

    // Bouton "Retour au stock" (uniquement pour les sorties)
    document.querySelectorAll('.return-to-stock').forEach(btn => {
        btn.addEventListener('click', function() {
            const mouvementId = this.dataset.id;
            const articleId = this.dataset.articleId;
            const quantity = parseInt(this.dataset.quantity);
            openReturnToStockModal(mouvementId, articleId, quantity);
        });
    });

    // Bouton "Libérer la réservation" (uniquement pour les réservations)
    document.querySelectorAll('.release-reservation').forEach(btn => {
        btn.addEventListener('click', async function() {
            const reservationId = this.dataset.id;
            const reservation = reservations.find(r => r.id === reservationId);

            if (reservation) {
                const article = reservation.w_articles;
                const articleName = article?.nom || 'Article inconnu';

                if (confirm(`Libérer la réservation de ${reservation.quantite} ${articleName} ?`)) {
                    try {
                        await releaseReservation(reservationId);
                        showTemporarySuccess('Réservation libérée avec succès');

                        // Recharger les détails du projet
                        const projectId = document.querySelector('.project-tab-content.active')
                            ?.closest('#projectDetailsModal')
                            ?.querySelector('[data-project-id]')?.dataset.projectId;

                        if (projectId) {
                            await openProjectDetailsModal(projectId);
                        }
                    } catch (error) {
                        console.error('Erreur libération réservation:', error);
                        alert('Erreur lors de la libération de la réservation');
                    }
                }
            }
        });
    });
}

function showItemDetails(itemId, itemType, sorties, retours, reservations) {
    let item;

    if (itemType === 'sortie') {
        item = sorties.find(s => s.id === itemId);
    } else if (itemType === 'retour') {
        item = retours.find(r => r.id === itemId);
    } else {
        item = reservations.find(r => r.id === itemId);
    }

    if (!item) return;

    const isSortie = itemType === 'sortie';
    const isRetour = itemType === 'retour';
    const isReservation = itemType === 'reservation';

    const article = isSortie || isRetour ? item.article : item.w_articles;
    const user = isSortie || isRetour ? item.utilisateur : item.w_users;

    const modalHtml = `
        <div class="modal-overlay" id="itemDetailsModal">
            <div class="modal" style="max-width: 600px;">
                <div class="modal-header">
                    <h3><i class="fas fa-info-circle"></i> Détails</h3>
                    <button class="close-modal">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="detail-section">
                        <h4><i class="fas fa-box"></i> Article</h4>
                        <div class="detail-item">
                            <span class="detail-label">Nom :</span>
                            <span class="detail-value">${article?.nom || 'Non spécifié'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Numéro :</span>
                            <span class="detail-value">${article?.numero || 'Non spécifié'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Code-barre :</span>
                            <span class="detail-value">${article?.code_barre || 'Non spécifié'}</span>
                        </div>
                    </div>

                    <div class="detail-section">
                        <h4><i class="fas ${isSortie ? 'fa-arrow-up' : isRetour ? 'fa-undo' : 'fa-clock'}"></i> ${isSortie ? 'Sortie' : isRetour ? 'Retour au stock' : 'Réservation'}</h4>
                        <div class="detail-item">
                            <span class="detail-label">Type :</span>
                            <span class="detail-value badge ${isSortie ? 'sortie' : isRetour ? 'retour' : 'reservation'}">
                                ${isSortie ? 'Sortie effectuée' : isRetour ? 'Retour au stock' : 'Réservation active'}
                            </span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Quantité :</span>
                            <span class="detail-value">${isRetour ? '+' : (isSortie ? '-' : '')}${item.quantite}</span>
                        </div>
                        ${article?.prix_unitaire ? `
                        <div class="detail-item">
                            <span class="detail-label">Prix unitaire :</span>
                            <span class="detail-value">${article.prix_unitaire.toFixed(2)} €</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Valeur totale :</span>
                            <span class="detail-value" style="font-weight: bold;">
                                ${(article.prix_unitaire * item.quantite).toFixed(2)} €
                            </span>
                        </div>
                        ` : ''}
                        <div class="detail-item">
                            <span class="detail-label">Date :</span>
                            <span class="detail-value">${formatDateTime(item.created_at)}</span>
                        </div>
                        ${!isSortie && !isRetour ? `
                        <div class="detail-item">
                            <span class="detail-label">Date de fin :</span>
                            <span class="detail-value">${formatDate(item.date_fin)}</span>
                        </div>
                        ` : ''}
                    </div>

                    <div class="detail-section">
                        <h4><i class="fas fa-user"></i> Responsable</h4>
                        <div class="detail-item">
                            <span class="detail-label">Utilisateur :</span>
                            <span class="detail-value">${user?.username || 'Non spécifié'}</span>
                        </div>
                    </div>

                    ${item.commentaire ? `
                    <div class="detail-section">
                        <h4><i class="fas fa-comment"></i> Commentaire</h4>
                        <div class="detail-comment">
                            ${item.commentaire}
                        </div>
                    </div>
                    ` : ''}

                    <div class="modal-actions">
                        <!-- Bouton Fermer supprimé - Utiliser la croix ou clic extérieur -->
                    </div>
                </div>
            </div>
        </div>
    `;

    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHtml;
    document.body.appendChild(modalContainer);

    const modal = document.getElementById('itemDetailsModal');
    modal.style.display = 'flex';

    // Gérer la fermeture
    modal.querySelector('.close-modal').addEventListener('click', () => {
        modal.remove();
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

async function useReservation(reservationId, articleId, originalQuantity, quantityToUse = null, comment = '') {
    try {
        // Si quantityToUse n'est pas fourni, utiliser toute la quantité
        if (quantityToUse === null) {
            quantityToUse = originalQuantity;
        }

        // Demander confirmation
        if (!confirm(`Utiliser ${quantityToUse} article(s) sur ${originalQuantity} réservés ?`)) {
            return;
        }

        showLoading();

        // Récupérer la réservation
        const { data: reservation, error: reservationError } = await supabase
            .from('w_reservations_actives')
            .select(`
                *,
                w_articles (*),
                w_users (username)
            `)
            .eq('id', reservationId)
            .single();

        if (reservationError) throw reservationError;

        // Récupérer le stock actuel
        const { data: article, error: articleError } = await supabase
            .from('w_articles')
            .select('stock_actuel')
            .eq('id', articleId)
            .single();

        if (articleError) throw articleError;

        // Créer le mouvement de sortie avec plus d'informations
        const articleName = reservation.w_articles?.nom || 'Article inconnu';
        const projetNom = state.currentProject?.nom || 'Projet inconnu';
        const mouvementComment = comment
            ? `${comment} | Source: Réservation #${reservationId} (${articleName})`
            : `Sortie pour projet "${projetNom}" depuis réservation #${reservationId} (${articleName})`;

        const { error: movementError } = await supabase
            .from('w_mouvements')
            .insert([{
                article_id: articleId,
                type: 'sortie',
                quantite: quantityToUse,
                projet: state.currentProject.nom,
                projet_id: state.currentProject.id,
                commentaire: mouvementComment,
                utilisateur_id: state.user.id,
                utilisateur: state.user.username,
                stock_avant: article.stock_actuel,
                stock_apres: article.stock_actuel - quantityToUse,
                date_mouvement: new Date().toISOString().split('T')[0],
                heure_mouvement: new Date().toLocaleTimeString('fr-FR', { hour12: false }),
                created_at: new Date().toISOString()
            }]);

        if (movementError) throw movementError;

        // Gérer la réservation selon la quantité utilisée
        if (quantityToUse === originalQuantity) {

            // 1️⃣ Supprimer le mouvement "reservation"
            const { error: deleteMovementError } = await supabase
                .from('w_mouvements')
                .delete()
                .eq('type', 'reservation')
                .eq('article_id', articleId)
                .eq('projet_id', reservation.projet_id);

            if (deleteMovementError) throw deleteMovementError;

            // 2️⃣ Supprimer la réservation active
            const { error: deleteError } = await supabase
                .from('w_reservations_actives')
                .delete()
                .eq('id', reservationId);

            if (deleteError) throw deleteError;
        }
         else {
            // Réduire la quantité de la réservation
            const { error: updateError } = await supabase
                .from('w_reservations_actives')
                .update({
                    quantite: originalQuantity - quantityToUse,
                    updated_at: new Date().toISOString()
                })
                .eq('id', reservationId);

            if (updateError) throw updateError;
        }

        // Mettre à jour le stock
        const { error: stockError } = await supabase
            .from('w_articles')
            .update({
                stock_actuel: article.stock_actuel - quantityToUse,
                updated_at: new Date().toISOString()
            })
            .eq('id', articleId);

        if (stockError) throw stockError;

        // Mettre à jour les données locales
        await Promise.all([
            fetchReservations(),
            fetchArticles(),
            fetchMovements()
        ]);

        // Recharger les détails du projet si un modal est ouvert
        const projectDetailsModal = document.getElementById('projectDetailsModal');
        if (projectDetailsModal && projectDetailsModal.style.display === 'flex') {
            // Trouver l'ID du projet depuis le modal
            const projectId = document.querySelector('[data-project-id]')?.dataset.projectId;
            if (projectId) {
                await openProjectDetailsModal(projectId); // ← CORRIGÉ : appel à la bonne fonction
            }
        }

        showAlert(`${quantityToUse} article(s) marqué(s) comme utilisé(s)`, 'success');

    } catch (error) {
        console.error('Erreur utilisation réservation:', error);
        showAlert('Erreur lors de la mise à jour de la réservation', 'error');
    } finally {
        hideLoading();
    }
}

// Ajoutez cette fonction après useReservation
async function showUseReservationModal(reservationId, articleId, originalQuantity) {
    // Créer la modal
    const modalHtml = `
        <div class="modal-overlay use-reservation-modal">
            <div class="modal" style="max-width: 500px;">
                <div class="modal-header">
                    <h3><i class="fas fa-check-circle"></i> Marquer comme utilisé</h3>
                    <button class="close-modal">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label><i class="fas fa-boxes"></i> Quantité à utiliser *</label>
                        <div class="quantity-input-group">
                            <button type="button" class="quantity-btn minus" id="useQuantityMinus">
                                <i class="fas fa-minus"></i>
                            </button>
                            <input type="number"
                                   id="useQuantity"
                                   value="${originalQuantity}"
                                   min="1"
                                   max="${originalQuantity}"
                                   class="form-input quantity">
                            <button type="button" class="quantity-btn plus" id="useQuantityPlus">
                                <i class="fas fa-plus"></i>
                            </button>
                        </div>
                        <div class="quantity-info">
                            <span>Quantité réservée : <strong>${originalQuantity}</strong></span>
                        </div>
                    </div>

                    <div class="form-group">
                        <label><i class="fas fa-comment"></i> Commentaire (optionnel)</label>
                        <textarea id="useComment"
                                  rows="3"
                                  placeholder="Détails de l'utilisation..."
                                  class="form-textarea"></textarea>
                    </div>

                    <div class="error-message" id="useReservationError" style="display: none;">
                        <i class="fas fa-exclamation-circle"></i>
                        <span id="useReservationErrorText"></span>
                    </div>

                    <div class="modal-actions">
                        <button id="confirmUseReservationBtn" class="btn-success">
                            <i class="fas fa-check"></i> Confirmer l'utilisation
                        </button>
                        <button type="button" class="btn-secondary close-modal">
                            Annuler
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Ajouter au DOM
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHtml;
    document.body.appendChild(modalContainer);

    const modal = modalContainer.querySelector('.use-reservation-modal');
    modal.style.display = 'flex';

    // Gestion des boutons de quantité
    const quantityInput = modal.querySelector('#useQuantity');
    modal.querySelector('#useQuantityMinus').addEventListener('click', () => {
        let value = parseInt(quantityInput.value) || 1;
        if (value > 1) {
            quantityInput.value = value - 1;
        }
    });

    modal.querySelector('#useQuantityPlus').addEventListener('click', () => {
        let value = parseInt(quantityInput.value) || 1;
        if (value < originalQuantity) {
            quantityInput.value = value + 1;
        }
    });

    // Gestion de la fermeture
    modal.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            modal.remove();
        });
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });

    // Confirmation
    modal.querySelector('#confirmUseReservationBtn').addEventListener('click', async () => {
        const quantityToUse = parseInt(quantityInput.value);
        const comment = modal.querySelector('#useComment').value.trim();

        if (!quantityToUse || quantityToUse < 1 || quantityToUse > originalQuantity) {
            modal.querySelector('#useReservationErrorText').textContent = 'Quantité invalide';
            modal.querySelector('#useReservationError').style.display = 'flex';
            return;
        }

        modal.remove();
        await useReservation(reservationId, articleId, originalQuantity, quantityToUse, comment);
    });
}

async function openReturnToStockModal(mouvementId, articleId, originalQuantity) {
    try {
        // Récupérer l'article avec ses détails
        const { data: article, error: articleError } = await supabase
            .from('w_articles')
            .select(`
                nom,
                numero,
                photo_url,
                rack:w_vuestock_racks(rack_code, display_name),
                level:w_vuestock_levels(level_code),
                slot:w_vuestock_slots(slot_code)
            `)
            .eq('id', articleId)
            .single();

        if (articleError) throw articleError;

        // Récupérer le projet courant depuis l'état global
        if (!state.currentProject) {
            throw new Error('ID du projet non trouvé - Aucun projet sélectionné');
        }

        const projectId = state.currentProject.id;
        const projectName = state.currentProject.nom || '';

        // Créer le modal
        const modalHTML = `
            <div class="modal-overlay return-stock-modal">
                <div class="modal" style="max-width: 600px;">
                    <div class="modal-header">
                        <h3><i class="fas fa-arrow-left"></i> Retour au stock</h3>
                        <button class="close-modal">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="article-summary">
                            <div class="article-header">
                                ${article.photo_url ? `
                                    <div class="article-image-container" style="text-align: center; margin-bottom: 15px;">
                                        <img src="${article.photo_url}"
                                             alt="${article.nom}"
                                             class="article-image-clickable"
                                             data-image-url="${article.photo_url}"
                                             data-image-title="${article.nom}"
                                             style="max-width: 150px; max-height: 150px; cursor: pointer; border-radius: 8px; border: 2px solid #ddd; object-fit: contain;">
                                        <div><small class="image-hint" style="color: #666; font-size: 12px;">Cliquez pour agrandir</small></div>
                                    </div>
                                    ` : ''}
                                <div class="article-info">
                                    <h4>${article.nom} (${article.numero})</h4>
                                    <p>Sorti : ${originalQuantity} unité(s)</p>
                                </div>
                            </div>
                        </div>

                        <div class="form-group">
                            <label><i class="fas fa-boxes"></i> Quantité retournée *</label>
                            <input type="number"
                                   id="returnQuantity"
                                   value="${originalQuantity}"
                                   min="0"
                                   max="${originalQuantity}"
                                   class="form-input">
                            <small>Quantité initiale: ${originalQuantity}</small>
                        </div>

                        <div id="missingQuantitySection" style="display: none;">
                            <div class="form-group">
                                <label><i class="fas fa-exclamation-triangle"></i> Raison de la différence</label>
                                <select id="missingReason" class="form-select">
                                    <option value="">Sélectionner une raison...</option>
                                    <option value="perdu">Perdu(s)</option>
                                    <option value="cassé">Cassé(s)</option>
                                    <option value="vole">Volé(s)</option>
                                    <option value="fin_vie">Fin de vie utile</option>
                                </select>
                            </div>
                        </div>

                        <div class="form-group">
                            <label><i class="fas fa-map-marker-alt"></i> Emplacement de rangement</label>
                            <div class="location-display">
                                <div><strong>Rayon:</strong> ${article.rack?.display_name || article.rack?.rack_code || 'Non spécifié'}</div>
                                <div><strong>Étage:</strong> ${article.level?.level_code || 'Non spécifié'}</div>
                                <div><strong>Position:</strong> ${article.slot?.slot_code || 'Non spécifié'}</div>
                            </div>
                            <small><i class="fas fa-info-circle"></i> Rangez l'article à cet emplacement</small>
                        </div>

                        <div class="form-group">
                            <label><i class="fas fa-clipboard-check"></i> État des articles</label>
                            <select id="itemCondition" class="form-select">
                                <option value="parfait">Condition 1 Parfait état</option>
                                <option value="raye">Condition 2 Usé / Réparé</option>
                                <option value="reparation">Condition 3 A réparer</option>
                                <option value="casse">Condition 4 A remplacer</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label><i class="fas fa-comment"></i> Commentaire</label>
                            <textarea id="returnComment"
                                      rows="3"
                                      placeholder="Détails du retour..."
                                      class="form-textarea"></textarea>
                        </div>

                        <div class="error-message" id="returnError" style="display: none;">
                            <i class="fas fa-exclamation-circle"></i>
                            <span id="returnErrorText"></span>
                        </div>

                        <div class="modal-actions">
                            <button id="confirmReturnBtn" class="btn btn-success">
                                <i class="fas fa-check"></i> Confirmer le retour
                            </button>
                            <button type="button" class="btn btn-secondary close-modal">
                                Annuler
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Ajouter le modal au DOM
        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = modalHTML;
        document.body.appendChild(modalContainer);

        const modal = modalContainer.querySelector('.return-stock-modal');
        modal.style.display = 'flex';

        // Gestion du clic sur l'image
        const articleImage = modal.querySelector('.article-image-clickable');
        if (articleImage) {
            articleImage.addEventListener('click', function() {
                const imageUrl = this.dataset.imageUrl;
                const imageTitle = this.dataset.imageTitle;
                enlargeArticleImage(imageUrl, imageTitle);
            });
        }

        // Fermeture
        const closeModal = () => modal.remove();
        modal.querySelector('.close-modal').addEventListener('click', closeModal);
        modal.querySelector('.btn-secondary').addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });

        // Gérer l'affichage de la section "raison de la différence"
        const returnQuantityInput = modal.querySelector('#returnQuantity');
        const missingSection = modal.querySelector('#missingQuantitySection');

        returnQuantityInput.addEventListener('input', function() {
            const returnedQty = parseInt(this.value) || 0;
            missingSection.style.display = returnedQty < originalQuantity ? 'block' : 'none';
        });

        modal.querySelector('#confirmReturnBtn').addEventListener('click', async () => {
            const returnQuantityInput = modal.querySelector('#returnQuantity');
            const returnQuantity = parseInt(returnQuantityInput.value) || 0;

            // Vérification de sécurité
            if (returnQuantity <= 0) {
                alert('La quantité retournée doit être supérieure à 0');
                return;
            }

            if (returnQuantity > originalQuantity) {
                alert(`La quantité retournée ne peut pas dépasser ${originalQuantity} unité(s)`);
                return;
            }

            await processReturnToStock(mouvementId, articleId, originalQuantity, projectId, projectName, modalContainer);
        });

    } catch (error) {
        console.error('Erreur ouverture modal retour:', error);
        alert('Erreur lors de l\'ouverture du formulaire de retour');
    }
}

// ===== GESTION DES RÉSERVATIONS =====
async function addReservationToProject() {
    if (!state.currentProject) return;

    // Réinitialiser le modal
    elements.reservationArticle.value = '';
    elements.reservationQuantity.value = '1';
    elements.reservationComment.value = '';
    elements.reservationError.style.display = 'none';
    elements.reservationAvailableStock.textContent = '0';
    elements.reservationAlreadyReserved.textContent = '0';

    // Stocker le modal précédent avant d'ouvrir le nouveau
    console.log('addReservationToProject - Setting previousModal:', {
        before: state.previousModal?.id,
        currentModal: state.currentModal?.id
    });

    showModal(elements.addReservationModal);

    showModal(elements.addReservationModal);
}

async function updateReservationStockInfo(articleId) {
    if (!articleId || !state.currentProject) return;

    try {
        // Récupérer le stock total disponible
        const article = state.articles.find(a => a.id === articleId);
        if (article) {
            elements.reservationAvailableStock.textContent = article.stock_actuel || 0;
        }

        // Récupérer le nombre déjà réservé pour ce projet
        const projectReservations = state.reservations.filter(r =>
            r.id_projet === state.currentProject.id && r.id_article === articleId
        );
        const alreadyReserved = projectReservations.reduce((sum, r) => sum + r.quantite, 0);
        elements.reservationAlreadyReserved.textContent = alreadyReserved;

        // Mettre à jour la quantité max
        const availableStock = article?.quantite_disponible || 0;
        const currentQuantity = parseInt(elements.reservationQuantity.value) || 1;

        if (currentQuantity > availableStock) {
            elements.reservationQuantity.value = Math.max(1, availableStock);
        }

    } catch (error) {
        console.error('Erreur mise à jour info stock:', error);
    }
}

async function confirmAddReservation() {
    try {
        const articleId = elements.reservationArticle.value;
        const quantity = parseInt(elements.reservationQuantity.value);
        const comment = elements.reservationComment.value.trim();

        // Validation
        if (!articleId) {
            elements.reservationErrorText.textContent = 'Veuillez sélectionner un article';
            elements.reservationError.style.display = 'flex';
            return;
        }

        if (!quantity || quantity < 1) {
            elements.reservationErrorText.textContent = 'La quantité doit être au moins de 1';
            elements.reservationError.style.display = 'flex';
            return;
        }

        // Vérifier le stock disponible
        const article = state.articles.find(a => a.id === articleId);
        if (!article) {
            elements.reservationErrorText.textContent = 'Article non trouvé';
            elements.reservationError.style.display = 'flex';
            return;
        }

        if ((article.stock_actuel || 0) < quantity) {
            elements.reservationErrorText.textContent = `Stock insuffisant. Disponible: ${article.stock_actuel || 0}`;
            elements.reservationError.style.display = 'flex';
            return;
        }

        showLoading();

        const reservationData = {
            articleId: articleId,
            projectId: state.currentProject.id,
            quantity: quantity,
            comment: comment
        };

        const newReservation = await createReservation(reservationData);

        // Ajouter à la liste des réservations
        state.reservations.push(newReservation);

        // Recharger les détails du projet
        await showProjectDetails(state.currentProject.id);

        // Mettre à jour les statistiques
        updateStatistics();

        // Fermer le modal
        hideModal();

        showAlert('Réservation ajoutée avec succès', 'success');

    } catch (error) {
        console.error('Erreur ajout réservation:', error);
        elements.reservationErrorText.textContent = error.message || 'Erreur lors de l\'ajout de la réservation';
        elements.reservationError.style.display = 'flex';
    } finally {
        hideLoading();
    }
}

async function releaseAllProjectItems() {
    if (!state.currentProject) return;

    // Récupérer les réservations du projet
    const projectReservations = state.reservations.filter(r => r.id_projet === state.currentProject.id);

    if (projectReservations.length === 0) {
        showAlert('Aucune réservation à libérer pour ce projet', 'info');
        return;
    }

    // Mettre à jour le compteur dans le modal
    elements.releaseItemsCount.textContent = projectReservations.length;
    elements.releaseReason.value = '';
    elements.releaseComment.value = '';
    elements.releaseError.style.display = 'none';

    showModal(elements.releaseStockModal);
}

async function confirmReleaseAll() {
    try {
        const reason = elements.releaseReason.value;
        const comment = elements.releaseComment.value.trim();

        if (!reason) {
            elements.releaseErrorText.textContent = 'Veuillez sélectionner une raison';
            elements.releaseError.style.display = 'flex';
            return;
        }

        if (!confirm(`Êtes-vous sûr de vouloir libérer toutes les réservations de ce projet ? (${elements.releaseItemsCount.textContent} réservation(s))`)) {
            return;
        }

        showLoading();

        // Récupérer les réservations du projet
        const projectReservations = state.reservations.filter(r => r.id_projet === state.currentProject.id);

        // Libérer chaque réservation
        for (const reservation of projectReservations) {
            try {
                await releaseReservation(reservation.id, `Libération globale: ${reason} - ${comment}`);
            } catch (error) {
                console.error(`Erreur libération réservation ${reservation.id}:`, error);
            }
        }

        // Mettre à jour les données
        await fetchReservations();

        // Recharger les détails du projet
        await showProjectDetails(state.currentProject.id);

        // Mettre à jour les statistiques
        updateStatistics();

        // Fermer le modal
        hideModal();

        showAlert('Toutes les réservations ont été libérées', 'success');

    } catch (error) {
        console.error('Erreur libération globale:', error);
        elements.releaseErrorText.textContent = error.message || 'Erreur lors de la libération du stock';
        elements.releaseError.style.display = 'flex';
    } finally {
        hideLoading();
    }
}

// Fonction pour archiver un projet
async function archiveProject(projectId) {
    try {
        console.log('archiveProject appelée avec ID:', projectId);
        console.log('supabase disponible ?', typeof supabase !== 'undefined');

        if (typeof supabase === 'undefined') {
            console.error('ERROR: supabase est undefined');
            console.log('Tentative avec window.supabase:', typeof window.supabase);
            throw new Error('Base de données non disponible');
        }

        const { data, error } = await supabase
            .from('w_projets')
            .update({
                archived: true,
                updated_at: new Date().toISOString()
            })
            .eq('id', projectId)
            .select()
            .single();

        if (error) {
            console.error('Erreur Supabase:', error);
            throw error;
        }

        console.log('Projet archivé avec succès:', data);
        return data;
    } catch (error) {
        console.error('Erreur archivage projet:', error);
        throw error;
    }
}

// ===== ARCHIVAGE/DÉSARCHIVAGE =====
async function archiveProjectAction(projectId) {
    if (!confirm('Archiver ce projet ? Le projet n\'apparaîtra plus dans les projets actifs.')) {
        return;
    }

    try {
        showLoading();
        const archivedProject = await archiveProject(projectId);

        // Mettre à jour les listes
        const index = state.projects.findIndex(p => p.id === projectId);
        if (index !== -1) {
            state.projects.splice(index, 1);
            state.archivedProjects.unshift(archivedProject);
        }

        // Mettre à jour l'affichage
        // updateProjectsDisplay();
        // updateArchivedProjectsDisplay();
        // updateStatistics();

        // Si on est dans les détails, fermer le modal
        if (state.currentProject?.id === projectId) {
            hideModal();
        }

        showAlert('Projet archivé avec succès', 'success');

    } catch (error) {
        console.error('Erreur archivage projet:', error);
        showAlert('Erreur lors de l\'archivage du projet', 'error');
    } finally {
        hideLoading();
    }
}

async function unarchiveProjectAction(projectId) {
    if (!confirm('Désarchiver ce projet ? Le projet réapparaîtra dans les projets actifs.')) {
        return;
    }

    try {
        showLoading();
        const unarchivedProject = await unarchiveProject(projectId);

        // Mettre à jour les listes
        const index = state.archivedProjects.findIndex(p => p.id === projectId);
        if (index !== -1) {
            state.archivedProjects.splice(index, 1);
            state.projects.unshift(unarchivedProject);
        }

        // Mettre à jour l'affichage
        updateProjectsDisplay();
        updateArchivedProjectsDisplay();
        updateStatistics();

        showAlert('Projet désarchivé avec succès', 'success');

    } catch (error) {
        console.error('Erreur désarchivage projet:', error);
        showAlert('Erreur lors du désarchivage du projet', 'error');
    } finally {
        hideLoading();
    }
}

async function exportProjectDetails() {
    if (!state.currentProject) return;

    try {
        showLoading();

        // Déterminer l'onglet actif
        const activeTab = document.querySelector('.project-tab-btn.active')?.dataset.tab || 'reservations';

        // Récupérer les données selon l'onglet
        if (activeTab === 'history') {
            await exportProjectHistory();
        } else {
            await exportProjectReservations();
        }

    } catch (error) {
        console.error('Erreur export projet:', error);
        showAlert('Erreur lors de l\'export du projet', 'error');
    } finally {
        hideLoading();
    }
}

async function exportProjectReservations() {
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        const project = state.currentProject;
        const projectData = await getProjectReservations(project.id);
        const sorties = projectData.sorties || [];
        const reservations = projectData.reservations || [];

        let yPos = 20;
        const pageWidth = doc.internal.pageSize.width;
        const margin = 15;

        // ===== EN-TÊTE =====
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text('DÉTAILS DU PROJET', pageWidth / 2, yPos, { align: 'center' });
        yPos += 10;

        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.text(`Exporté le: ${new Date().toLocaleDateString('fr-FR')}`, pageWidth - margin, yPos, { align: 'right' });
        yPos += 15;

        // ===== INFORMATIONS PROJET =====
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('INFORMATIONS DU PROJET', margin, yPos);
        yPos += 8;

        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');

        const projectInfo = [
            ['Nom:', project.nom],
            ['Numéro:', project.numero || 'Non défini'],
            ['Description:', project.description || 'Aucune description'],
            ['Responsable:', project.responsable || 'Non défini'],
            ['Date création:', formatDate(project.created_at)],
            ['Date fin prévue:', project.date_fin_prevue ? formatDate(project.date_fin_prevue) : 'Non définie'],
            ['Budget:', project.budget ? `${project.budget} €` : 'Non défini'],
            ['Statut:', project.archived ? 'Archivé' : getProjectStatus(project) === 'active' ? 'Actif' :
                         getProjectStatus(project) === 'ending' ? 'Bientôt terminé' : 'En retard']
        ];

        projectInfo.forEach(([label, value]) => {
            doc.setFont('helvetica', 'bold');
            doc.text(label, margin, yPos);
            doc.setFont('helvetica', 'normal');

            // Gérer les textes longs avec retour à la ligne
            const lines = doc.splitTextToSize(value.toString(), pageWidth - margin - 60);
            lines.forEach((line, index) => {
                doc.text(line, margin + 40, yPos + (index * 5));
            });
            yPos += Math.max(lines.length * 5, 7);

            // Vérifier si besoin d'une nouvelle page
            if (yPos > doc.internal.pageSize.height - 40) {
                doc.addPage();
                yPos = 20;
            }
        });

        yPos += 5;

        // ===== STATISTIQUES =====
        if (sorties.length > 0 || reservations.length > 0) {
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text('STATISTIQUES', margin, yPos);
            yPos += 8;

            doc.setFontSize(11);
            doc.setFont('helvetica', 'normal');

            // Calculs
            const itemsSortis = sorties.reduce((sum, s) => sum + (s.quantite || 0), 0);
            const valeurSortis = sorties.reduce((sum, s) => {
                const article = s.article;
                return sum + ((article?.prix_unitaire || 0) * (s.quantite || 0));
            }, 0);

            const itemsReserves = reservations.reduce((sum, r) => sum + (r.quantite || 0), 0);
            const valeurReserves = reservations.reduce((sum, r) => {
                const article = r.w_articles;
                return sum + ((article?.prix_unitaire || 0) * (r.quantite || 0));
            }, 0);

            const stats = [
                ['Articles utilisés:', `${itemsSortis} unité(s)`, `${valeurSortis.toFixed(2)} €`],
                ['Articles réservés:', `${itemsReserves} unité(s)`, `${valeurReserves.toFixed(2)} €`],
                ['Total articles:', `${itemsSortis + itemsReserves} unité(s)`, `${(valeurSortis + valeurReserves).toFixed(2)} €`]
            ];

            stats.forEach(([label, qty, value]) => {
                doc.setFont('helvetica', 'bold');
                doc.text(label, margin, yPos);
                doc.setFont('helvetica', 'normal');
                doc.text(qty, pageWidth / 2, yPos, { align: 'center' });
                doc.text(value, pageWidth - margin, yPos, { align: 'right' });
                yPos += 6;
            });

            yPos += 5;
        }

        // ===== SORTIES (ARTICLES UTILISÉS) =====
        if (sorties.length > 0) {
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text('ARTICLES UTILISÉS', margin, yPos);
            yPos += 8;

            // En-tête du tableau
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text('Article', margin, yPos);
            doc.text('Qté', margin + 80, yPos);
            doc.text('Date', margin + 100, yPos);
            doc.text('Prix unitaire', margin + 130, yPos);
            doc.text('Total', margin + 170, yPos);

            doc.line(margin, yPos + 1, pageWidth - margin, yPos + 1);
            yPos += 6;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);

            sorties.forEach(item => {
                const article = item.article || {};
                const prixUnitaire = article.prix_unitaire || 0;
                const total = prixUnitaire * (item.quantite || 0);

                // Vérifier nouvelle page
                if (yPos > doc.internal.pageSize.height - 20) {
                    doc.addPage();
                    yPos = 20;
                }

                doc.text(article.nom?.substring(0, 30) || 'Article', margin, yPos);
                doc.text(item.quantite?.toString() || '0', margin + 80, yPos);
                doc.text(formatDate(item.created_at), margin + 100, yPos);
                doc.text(`${prixUnitaire.toFixed(2)} €`, margin + 130, yPos);
                doc.text(`${total.toFixed(2)} €`, margin + 170, yPos);

                yPos += 6;
            });

            yPos += 10;
        }

        // ===== RÉSERVATIONS =====
        if (reservations.length > 0) {
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text('ARTICLES RÉSERVÉS', margin, yPos);
            yPos += 8;

            // En-tête du tableau
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text('Article', margin, yPos);
            doc.text('Qté', margin + 80, yPos);
            doc.text('Date fin', margin + 100, yPos);
            doc.text('Utilisateur', margin + 130, yPos);
            doc.text('Prix unitaire', margin + 170, yPos);

            doc.line(margin, yPos + 1, pageWidth - margin, yPos + 1);
            yPos += 6;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);

            reservations.forEach(res => {
                const article = res.w_articles || {};
                const prixUnitaire = article.prix_unitaire || 0;

                // Vérifier nouvelle page
                if (yPos > doc.internal.pageSize.height - 20) {
                    doc.addPage();
                    yPos = 20;
                }

                doc.text(article.nom?.substring(0, 30) || 'Article', margin, yPos);
                doc.text(res.quantite?.toString() || '0', margin + 80, yPos);
                doc.text(formatDate(res.date_fin), margin + 100, yPos);
                doc.text(res.w_users?.username?.substring(0, 15) || 'Utilisateur', margin + 130, yPos);
                doc.text(`${prixUnitaire.toFixed(2)} €`, margin + 170, yPos);

                yPos += 6;
            });
        }

        // Pied de page
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.text('Document généré automatiquement - Système de gestion de stock',
                pageWidth / 2, doc.internal.pageSize.height - 10, { align: 'center' });

        // Télécharger
        doc.save(`projet_${project.numero || project.id}_${new Date().toISOString().split('T')[0]}.pdf`);
        showAlert('PDF exporté avec succès', 'success');

    } catch (error) {
        console.error('Erreur export PDF:', error);
        throw error;
    }
}

async function exportProjectHistory() {
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        const project = state.currentProject;
        const history = await getProjectHistory(project.id);

        let yPos = 20;
        const pageWidth = doc.internal.pageSize.width;
        const margin = 15;

        // ===== EN-TÊTE =====
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text('HISTORIQUE DU PROJET', pageWidth / 2, yPos, { align: 'center' });
        yPos += 10;

        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.text(`Projet: ${project.nom} (${project.numero || 'Sans numéro'})`, margin, yPos);
        yPos += 5;
        doc.text(`Exporté le: ${new Date().toLocaleDateString('fr-FR')}`, pageWidth - margin, yPos, { align: 'right' });
        yPos += 10;

        if (history.length === 0) {
            doc.setFontSize(12);
            doc.text('Aucun historique disponible', pageWidth / 2, yPos, { align: 'center' });
        } else {
            // ===== LISTE HISTORIQUE =====
            doc.setFontSize(10);
            history.forEach((item, index) => {
                // Vérifier nouvelle page
                if (yPos > doc.internal.pageSize.height - 30) {
                    doc.addPage();
                    yPos = 20;
                }

                // Type d'action avec icône
                let actionType = '';
                let color = [0, 0, 0]; // Noir par défaut

                switch(item.type) {
                    case 'sortie':
                        actionType = 'Sortie de stock';
                        color = [220, 53, 69]; // Rouge
                        break;
                    case 'retour_projet':
                        actionType = 'Retour au stock';
                        color = [40, 167, 69]; // Vert
                        break;
                    case 'entree':
                        actionType = 'Entrée de stock';
                        color = [0, 123, 255]; // Bleu
                        break;
                    default:
                        actionType = item.type || 'Action';
                }

                // Date et heure
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(...color);
                doc.text(actionType, margin, yPos);

                doc.setFont('helvetica', 'normal');
                doc.setTextColor(100, 100, 100);
                doc.text(formatDateTime(item.created_at), pageWidth - margin, yPos, { align: 'right' });

                yPos += 4;

                // Détails
                doc.setFontSize(9);
                doc.setTextColor(0, 0, 0);

                const details = [];
                if (item.article?.nom) {
                    details.push(`Article: ${item.article.nom}${item.article.numero ? ` (${item.article.numero})` : ''}`);
                }
                if (item.quantite) {
                    details.push(`Quantité: ${item.quantite}`);
                }
                if (item.projet) {
                    details.push(`Projet: ${item.projet}`);
                }
                if (item.utilisateur) {
                    details.push(`Utilisateur: ${item.utilisateur}`);
                }

                details.forEach(detail => {
                    doc.text(`• ${detail}`, margin + 5, yPos);
                    yPos += 4;
                });

                // Commentaire
                if (item.commentaire) {
                    doc.setFont('helvetica', 'italic');
                    doc.setTextColor(120, 120, 120);
                    doc.text(`"${item.commentaire}"`, margin + 10, yPos);
                    yPos += 4;
                    doc.setFont('helvetica', 'normal');
                }

                // Séparateur
                if (index < history.length - 1) {
                    doc.setDrawColor(200, 200, 200);
                    doc.line(margin, yPos + 2, pageWidth - margin, yPos + 2);
                    yPos += 8;
                } else {
                    yPos += 4;
                }

                // Réinitialiser la couleur
                doc.setTextColor(0, 0, 0);
            });
        }

        // Pied de page
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.text('Document de projet - Système de gestion de stock',
                pageWidth / 2, doc.internal.pageSize.height - 10, { align: 'center' });

        // Télécharger
        doc.save(`historique_${project.numero || project.id}_${new Date().toISOString().split('T')[0]}.pdf`);
        showAlert('Historique exporté en PDF', 'success');

    } catch (error) {
        console.error('Erreur export historique:', error);
        throw error;
    }
}

// ===== ÉDITION DE PROJET =====
async function editProject() {
    if (!state.currentProject) return;

    try {
        // Pré-remplir le formulaire
        elements.projectName.value = state.currentProject.nom;
        elements.projectNumber.value = state.currentProject.numero || '';
        elements.projectDescription.value = state.currentProject.description || '';
        elements.projectManager.value = state.currentProject.responsable || '';
        elements.projectEndDate.value = state.currentProject.date_fin_prevue ?
            state.currentProject.date_fin_prevue.split('T')[0] : '';
        elements.projectBudget.value = state.currentProject.budget || '';

        // Changer le titre et le bouton
        const modal = elements.newProjectModal;
        const header = modal.querySelector('.modal-header h3');
        const submitBtn = modal.querySelector('.btn-primary');

        header.innerHTML = '<i class="fas fa-edit"></i> Modifier le projet';
        submitBtn.innerHTML = '<i class="fas fa-save"></i> Enregistrer les modifications';

        // Changer l'événement
        modal.querySelector('form').onsubmit = async function(e) {
            e.preventDefault();
            await updateProjectAction();
        };

        // ← AJOUTEZ CETTE LIGNE IMPORTANTE AVEC DEBUG
        console.log('editProject - Setting previousModal:', {
            before: state.previousModal?.id,
            currentModal: state.currentModal?.id,
            currentModalElement: state.currentModal
        });

        showModal(modal);
    } catch (error) {
        console.error('Erreur préparation édition:', error);
        showAlert('Erreur lors de la préparation de l\'édition', 'error');
    }
}

async function updateProjectAction() {
    try {
        const projectData = {
            nom: elements.projectName.value.trim(),
            numero: elements.projectNumber.value.trim(),
            description: elements.projectDescription.value.trim(),
            responsable: elements.projectManager.value.trim(),
            date_fin_prevue: elements.projectEndDate.value || null,
            budget: elements.projectBudget.value ? parseFloat(elements.projectBudget.value) : null
        };

        // Validation
        if (!projectData.nom || !projectData.numero || !projectData.responsable) {
            elements.projectErrorText.textContent = 'Veuillez remplir tous les champs obligatoires';
            elements.projectError.style.display = 'flex';
            return;
        }

        // Vérifier si le numéro existe déjà (sauf pour le projet en cours)
        const existingProject = state.projects.find(p =>
            p.numero === projectData.numero && p.id !== state.currentProject.id
        );
        if (existingProject) {
            elements.projectErrorText.textContent = 'Ce numéro de projet existe déjà';
            elements.projectError.style.display = 'flex';
            return;
        }

        showLoading();
        const updatedProject = await updateProject(state.currentProject.id, projectData);

        // Mettre à jour les listes
        const allProjects = [...state.projects, ...state.archivedProjects];
        const projectIndex = allProjects.findIndex(p => p.id === state.currentProject.id);

        if (projectIndex !== -1) {
            allProjects[projectIndex] = updatedProject;

            // Re-trier dans les bonnes listes
            if (updatedProject.archived) {
                state.archivedProjects = allProjects.filter(p => p.archived);
                state.projects = allProjects.filter(p => !p.archived);
            } else {
                state.projects = allProjects.filter(p => !p.archived);
                state.archivedProjects = allProjects.filter(p => p.archived);
            }
        }

        // Mettre à jour l'affichage
        updateProjectsDisplay();
        updateArchivedProjectsDisplay();
        populateManagerFilter();

        // Recharger les détails si ouvert
        if (elements.projectDetailsModal.style.display === 'flex') {
            await showProjectDetails(updatedProject.id);
        }

        // Fermer le modal et réinitialiser
        hideModal();
        elements.newProjectForm.reset();
        elements.projectError.style.display = 'none';

        // Restaurer le formulaire original
        const modal = elements.newProjectModal;
        const header = modal.querySelector('.modal-header h3');
        const submitBtn = modal.querySelector('.btn-primary');

        header.innerHTML = '<i class="fas fa-plus-circle"></i> Nouveau projet';
        submitBtn.innerHTML = '<i class="fas fa-save"></i> Créer le projet';

        // Restaurer l'événement original
        modal.querySelector('form').onsubmit = function(e) {
            e.preventDefault();
            createProjectAction();
        };

        showAlert('Projet modifié avec succès', 'success');

    } catch (error) {
        console.error('Erreur modification projet:', error);
        elements.projectErrorText.textContent = error.message || 'Erreur lors de la modification du projet';
        elements.projectError.style.display = 'flex';
    } finally {
        hideLoading();
    }
}

async function processReturnToStock(mouvementId, articleId, originalQuantity, projectId, projectName, modalElement) {
    try {
        const modal = modalElement;
        const returnQuantity = parseInt(modal.querySelector('#returnQuantity').value);
        const itemCondition = modal.querySelector('#itemCondition').value;
        const returnComment = modal.querySelector('#returnComment').value.trim();
        const missingReason = modal.querySelector('#missingReason')?.value || '';
        const missingQuantity = originalQuantity - returnQuantity;

        // Validation
        if (!returnQuantity || returnQuantity < 0 || returnQuantity > originalQuantity) {
            modal.querySelector('#returnErrorText').textContent = 'La quantité retournée est invalide';
            modal.querySelector('#returnError').style.display = 'flex';
            return;
        }

        if (missingQuantity > 0 && !missingReason) {
            modal.querySelector('#returnErrorText').textContent = 'Veuillez indiquer la raison de la quantité manquante';
            modal.querySelector('#returnError').style.display = 'flex';
            return;
        }

        // Demander confirmation
        if (!confirm(`Confirmer le retour de ${returnQuantity} unité(s) au stock ?`)) {
            return;
        }

        showLoading();

        // 1. Récupérer le stock actuel
        const { data: currentArticle, error: articleError } = await supabase
            .from('w_articles')
            .select('stock_actuel')
            .eq('id', articleId)
            .single();

        if (articleError) throw articleError;

        // 2. Créer le mouvement de retour
        const now = new Date();
        const mouvementData = {
            article_id: articleId,
            type: 'retour_projet',
            quantite: returnQuantity,
            projet: projectName,
            projet_id: projectId,
            commentaire: returnComment,
            utilisateur_id: currentUser.id,
            utilisateur: currentUser.username,
            stock_avant: currentArticle.stock_actuel,
            stock_apres: currentArticle.stock_actuel + returnQuantity,
            motif: `Retour projet - État: ${itemCondition}`,
            notes: `État: ${itemCondition}`,
            date_mouvement: now.toISOString().split('T')[0],
            heure_mouvement: now.toLocaleTimeString('fr-FR', { hour12: false }),
            created_at: now.toISOString()
        };

        if (missingReason && missingQuantity > 0) {
            mouvementData.raison = `${missingQuantity} ${missingReason}`;
        }

        const { error: movementError } = await supabase
            .from('w_mouvements')
            .insert([mouvementData]);

        if (movementError) throw movementError;

        // 3. Mettre à jour le stock de l'article
        const { error: updateError } = await supabase
            .from('w_articles')
            .update({
                stock_actuel: currentArticle.stock_actuel + returnQuantity,
                updated_at: now.toISOString()
            })
            .eq('id', articleId);

        if (updateError) throw updateError;

        // 4. Fermer le modal et afficher succès
        modal.remove();
        showTemporarySuccess(`${returnQuantity} unité(s) retournée(s) au stock avec succès`);

        // 5. Recharger les détails du projet
        const projectDetailsModal = document.getElementById('projectDetailsModal');
        if (projectDetailsModal && projectDetailsModal.style.display === 'flex') {
            await openProjectDetailsModal(projectId);
        }

    } catch (error) {
        console.error('Erreur retour au stock:', error);
        modalElement.querySelector('#returnErrorText').textContent = error.message || 'Erreur lors du retour au stock';
        modalElement.querySelector('#returnError').style.display = 'flex';
    } finally {
        hideLoading();
    }
}

async function releaseReservation(reservationId, comment = '') {
    try {
        showLoading();

        // 1. Récupérer la réservation
        const { data: reservation, error: fetchError } = await supabase
            .from('w_reservations_actives')
            .select('article_id, projet_id, quantite')
            .eq('id', reservationId)
            .single();

        if (fetchError) throw fetchError;

        // 2. Récupérer stock_reserve actuel
        const { data: article, error: articleError } = await supabase
            .from('w_articles')
            .select('stock_reserve')
            .eq('id', reservation.article_id)
            .single();

        if (articleError) throw articleError;

        // 3. Mettre à jour stock_reserve
        const newReservedStock = Math.max(0, (article.stock_reserve || 0) - reservation.quantite);

        const { error: updateStockError } = await supabase
            .from('w_articles')
            .update({
                stock_reserve: newReservedStock,
                updated_at: new Date().toISOString()
            })
            .eq('id', reservation.article_id);

        if (updateStockError) throw updateStockError;

        // 4. Supprimer la réservation active
        const { error: deleteError } = await supabase
            .from('w_reservations_actives')
            .delete()
            .eq('id', reservationId);

        if (deleteError) throw deleteError;

        // 5. Créer un mouvement d'annulation
        const { error: movementError } = await supabase
            .from('w_mouvements')
            .insert([{
                article_id: reservation.article_id,
                type: 'annulation_reservation',
                quantite: reservation.quantite,
                projet_id: reservation.projet_id,
                commentaire: comment || 'Réservation libérée',
                utilisateur_id: currentUser.id,
                utilisateur: currentUser.username,
                date_mouvement: new Date().toISOString().split('T')[0],
                heure_mouvement: new Date().toLocaleTimeString('fr-FR', { hour12: false }),
                created_at: new Date().toISOString()
            }]);

        if (movementError) throw movementError;

        return true;

    } catch (error) {
        console.error('Erreur libération réservation:', error);
        throw error;
    } finally {
        hideLoading();
    }
}

async function getProjectHistory(projectId) {
    try {
        const { data: project, error: projectError } = await supabase
            .from('w_projets')
            .select('nom')
            .eq('id', projectId)
            .single();

        if (projectError) throw projectError;

        const { data, error } = await supabase
            .from('w_mouvements')
            .select(`
                *,
                article:article_id (nom, numero)
            `)
            .eq('projet_id', projectId)
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) throw error;

        return data || [];

    } catch (error) {
        console.error('Erreur chargement historique projet:', error);
        return [];
    }
}

// ===== FONCTIONS DE GESTION DES BOUTONS DU MODAL =====
async function handleArchiveProject() {
    if (!state.currentProject) return;

    const confirmArchive = confirm(`Voulez-vous vraiment archiver le projet "${state.currentProject.nom}" ?`);
    if (!confirmArchive) return;

    try {
        showLoading();
        await archiveProjectAction(state.currentProject.id);
        if (projectDetailsModal) {
            projectDetailsModal.style.display = 'none';
        }
        showAlert('Projet archivé avec succès', 'success');
    } catch (error) {
        console.error('Erreur archivage:', error);
        showAlert('Erreur lors de l\'archivage du projet', 'error');
    } finally {
        hideLoading();
    }
}

async function handleEditProject() {
    if (!state.currentProject) return;
    await editProject();
}

async function handleExportProject() {
    if (!state.currentProject) return;
    await exportProjectDetails();
}

async function handleAddReservationToProject() {
    if (!state.currentProject) return;
    await addReservationToProject();
}

function updateProjectHistory(historyItems) {
    const container = document.getElementById('projectHistoryList');
    if (!container) return;

    if (historyItems.length === 0) {
        container.innerHTML = `
            <div class="empty-history">
                <i class="fas fa-history"></i>
                <p>Aucun historique disponible</p>
            </div>
        `;
        return;
    }

    let html = '';
    historyItems.forEach(item => {
        let icon = 'history';
        let actionType = 'Action';
        let details = '';
        const articleName = item.article?.nom || 'Article';
        const articleNum = item.article?.numero ? ` (${item.article.numero})` : '';

        if (item.type === 'sortie') {
            icon = 'arrow-up';
            actionType = 'Sortie de stock';
            details = `${item.quantite} × ${articleName}${articleNum} | Projet: ${item.projet || 'N/A'}`;
        } else if (item.type === 'retour_projet') {
            icon = 'arrow-left';
            actionType = 'Retour au stock';
            details = `${item.quantite} × ${articleName}${articleNum} retourné(s)`;
            if (item.raison) {
                details += ` | ${item.raison}`;
            }
        } else if (item.type === 'entree') {
            icon = 'arrow-down';
            actionType = 'Entrée de stock';
            details = `${item.quantite} × ${articleName}${articleNum} | ${item.fournisseur || 'Stock initial'}`;
        } else if (item.type === 'reservation') {
            icon = 'clock';
            actionType = 'Réservation';
            details = `${item.quantite} × ${articleName}${articleNum} réservé(s)`;
        }

        html += `
            <div class="history-item">
                <div class="history-icon ${item.type}">
                    <i class="fas fa-${icon}"></i>
                </div>
                <div class="history-content">
                    <div class="history-header">
                        <span class="history-title">${actionType}</span>
                        <span class="history-date">${formatDateTime(item.created_at)}</span>
                    </div>
                    <div class="history-details">
                        ${details}
                        ${item.commentaire ? `<div class="history-comment"><i class="fas fa-comment"></i> ${item.commentaire}</div>` : ''}
                    </div>
                    <div class="history-footer">
                        <span class="history-user"><i class="fas fa-user"></i> ${item.utilisateur || 'Système'}</span>
                    </div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

function calculateDaysLeft(endDate) {
    try {
        const end = new Date(endDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (end < today) return 0; // Déjà terminé

        const diffTime = end - today;
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    } catch (e) {
        return 0;
    }
}

function getProjectStatus(project) {
    if (project.archived) return 'archived';

    const daysLeft = calculateDaysLeft(project.date_fin_prevue);

    if (daysLeft <= 0) return 'overdue';
    if (daysLeft <= 7) return 'ending';
    return 'active';
}

// État global pour le projet actuellement affiché
let state = {
    currentProject: null,
    projects: [],
    archivedProjects: []
};

async function openProjectDetailsModal(projectId) {
    try {
        // 1. Récupérer les données du projet (avec retours maintenant)
        const projectData = await getProjectReservations(projectId);
        const { project, sorties, retours, reservations } = projectData; // ← Ajout de retours

        if (!project) {
            alert('Projet non trouvé');
            return;
        }

        // Stocker le projet dans l'état global
        state.currentProject = project;

        // 2. Récupérer l'historique
        const history = await getProjectHistory(projectId);

        // 3. Calculer les statistiques (corrigé pour inclure les retours)
        const itemsSortis = sorties.reduce((sum, s) => sum + s.quantite, 0);
        const itemsRetournes = retours.reduce((sum, r) => sum + r.quantite, 0);
        const itemsReserves = reservations.reduce((sum, r) => sum + r.quantite, 0);
        const daysLeft = calculateDaysLeft(project.date_fin_prevue);
        const status = getProjectStatus(project);

        // 4. Remplir les informations de base
        document.getElementById('projectDetailsName').textContent = project.nom;
        document.getElementById('projectDetailsNumber').textContent = project.numero || 'Sans numéro';
        document.getElementById('projectDetailsStatus').textContent =
            status === 'active' ? 'Actif' :
            status === 'ending' ? 'Bientôt terminé' :
            status === 'overdue' ? 'En retard' : 'Archivé';

        // 6. Remplir les informations détaillées
        document.getElementById('projectDetailsDescription').textContent = project.description || 'Pas de description';
        document.getElementById('projectDetailsCreatedAt').textContent = formatDateTime(project.created_at);
        document.getElementById('projectDetailsEndDate').textContent = project.date_fin_prevue ? formatDate(project.date_fin_prevue) : 'Non définie';
        document.getElementById('projectDetailsUpdatedAt').textContent = project.updated_at ? formatDateTime(project.updated_at) : 'Jamais';
        document.getElementById('projectDetailsManager').textContent = project.responsable || 'Non défini';
        document.getElementById('projectDetailsBudget').textContent = project.budget ? `${project.budget} €` : 'Non défini';

        // 7. Afficher les réservations, retours et l'historique
        updateProjectReservations(sorties, retours, reservations); // ← CORRIGÉ : 3 paramètres
        updateProjectHistory(history);

        // 8. Configurer les boutons
        const archiveBtn = document.getElementById('archiveProjectBtn');
        if (archiveBtn) {
            archiveBtn.style.display = project.archived ? 'none' : 'block';
            archiveBtn.textContent = project.archived ? 'Désarchiver' : 'Archiver';
        }

        // 9. Afficher le modal
        document.getElementById('projectDetailsModal').style.display = 'flex';
        switchProjectTab('reservations');

    } catch (error) {
        console.error('Erreur ouverture détails projet:', error);
        alert('Erreur lors du chargement du projet');
    }
}

async function openProjectSelectionModal() {
    try {
        console.log('🔍 Recherche des projets actifs...');

        const { data: projects, error } = await supabase
            .from('w_projets')
            .select('id, nom, numero, responsable, date_fin_prevue')
            .eq('actif', true)  // ← IMPORTANT : filtrer sur actif=true
            .order('nom');

        if (error) {
            console.error('❌ Erreur Supabase:', error);
            throw error;
        }

        if (!projects || projects.length === 0) {
            alert('Aucun projet disponible');
            return;
        }

        // Créer le modal de sélection
        const modalHtml = `
            <div class="modal-overlay" id="projectSelectionModal">
                <div class="modal" style="max-width: 600px;">
                    <div class="modal-header">
                        <h3><i class="fas fa-project-diagram"></i> Choisir un projet</h3>
                        <button class="close-modal">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="projects-list">
                            ${projects.map(project => `
                                <div class="project-item" data-id="${project.id}">
                                    <div class="project-item-header">
                                        <h4>${project.nom}</h4>
                                        <span class="project-number">${project.numero || 'Sans numéro'}</span>
                                    </div>
                                    <div class="project-item-details">
                                        <span><i class="fas fa-user-tie"></i> ${project.responsable || 'Non défini'}</span>
                                        ${project.date_fin_prevue ?
                                            `<span><i class="fas fa-calendar"></i> Fin: ${formatDate(project.date_fin_prevue)}</span>` : ''}
                                    </div>
                                    <button class="btn-primary select-project-btn" data-id="${project.id}">
                                        <i class="fas fa-eye"></i> Voir détails
                                    </button>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Ajouter au DOM
        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = modalHtml;
        document.body.appendChild(modalContainer);

        // Afficher le modal
        const modal = document.getElementById('projectSelectionModal');
        modal.style.display = 'flex';

        // Événements
        modal.querySelector('.close-modal').addEventListener('click', () => {
            modal.remove();
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });

        // Sélection d'un projet
        modal.querySelectorAll('.select-project-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const projectId = this.dataset.id;
                modal.remove();
                openProjectDetailsModal(projectId);
            });
        });

        // Clic sur l'item projet
        modal.querySelectorAll('.project-item').forEach(item => {
            item.addEventListener('click', function(e) {
                if (!e.target.closest('.select-project-btn')) {
                    const projectId = this.dataset.id;
                    modal.remove();
                    openProjectDetailsModal(projectId);
                }
            });
        });

    } catch (error) {
        console.error('Erreur chargement projets:', error);
        alert('Erreur lors du chargement des projets');
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', async function() {
    // Vérifier l'authentification
    await checkAuth();

    // Charger les données
    await loadPageData();

    // Initialiser les éléments du modal Détails du projet
    projectDetailsModal = document.getElementById('projectDetailsModal');
    archiveProjectBtn = document.getElementById('archiveProjectBtn');
    exportProjectBtn = document.getElementById('exportProjectBtn');
    addReservationToProjectBtn = document.getElementById('addReservationToProjectBtn');

    // Initialiser les éléments utilisés dans addReservationToProject()
    elements.addReservationModal = document.getElementById('addReservationModal');
    elements.reservationArticle = document.getElementById('reservationArticle');
    elements.reservationQuantity = document.getElementById('reservationQuantity');
    elements.reservationComment = document.getElementById('reservationComment');
    elements.reservationError = document.getElementById('reservationError');
    elements.reservationErrorText = document.getElementById('reservationErrorText');
    elements.reservationAvailableStock = document.getElementById('reservationAvailableStock');
    elements.reservationAlreadyReserved = document.getElementById('reservationAlreadyReserved');

    // Configurer les événements
    setupEventListeners();
});

// ===== FONCTIONS D'AUTHENTIFICATION =====
async function checkAuth() {
    const loadingOverlay = document.getElementById('loadingOverlay');

    try {
        // Récupérer l'utilisateur depuis sessionStorage
        const userJson = sessionStorage.getItem('current_user');

        if (!userJson) {
            // Pas connecté, rediriger vers login
            window.location.href = 'connexion.html';
            return;
        }

        currentUser = JSON.parse(userJson);

        // Mettre à jour l'interface avec les infos utilisateur
        updateUserInterface();

        // Afficher/cacher la section admin
        toggleAdminSection();

        // Cacher le loading
        loadingOverlay.style.display = 'none';

    } catch (error) {
        console.error('Erreur d\'authentification:', error);
        sessionStorage.removeItem('current_user');
        window.location.href = 'connexion.html';
    }
}

function updateUserInterface() {
    // Mettre à jour le nom d'utilisateur
    document.getElementById('usernameDisplay').textContent = currentUser.username;

    // Mettre à jour le badge de rôle
    const roleBadge = document.getElementById('userRoleBadge');
    const roleText = document.getElementById('roleText');

    if (currentUser.isAdmin) {
        roleBadge.classList.add('admin');
        roleText.textContent = 'Administrateur';
    } else {
        roleBadge.classList.add('user');
        roleText.textContent = 'Utilisateur';
    }

    // AJOUTER CE CODE : Vérifier la permission vuestock pour le bouton Inventaire
    const inventoryLink = document.getElementById('inventoryLink');
    if (inventoryLink && currentUser.permissions && currentUser.permissions.vuestock) {
        inventoryLink.style.display = 'inline-block';
    }
}

function toggleAdminSection() {
    const adminSection = document.getElementById('adminSection');

    if (currentUser.isAdmin) {
        adminSection.style.display = 'block';
        loadAdminData();
        setupAdminButtons();
    } else {
        adminSection.style.display = 'none';
    }
}

// ===== CHARGEMENT DES DONNÉES =====
async function loadPageData() {
    await Promise.all([
        loadStats(),
        loadAdminData()
    ]);

    // Mettre à jour la dernière synchronisation
    updateLastSync();

    // Ajoute ces lignes où tu initialises les événements
    document.getElementById('exportStockBasBtn')?.addEventListener('click', exportStockBasPDF);
    document.getElementById('exportRuptureBtn')?.addEventListener('click', exportRupturePDF);
}

// ===== GESTION DU SCANNER/RECHERCHE POUR RETOUR D'ARTICLE =====

async function handleScanArticleForReturn() {
    if (!state.currentProject) return;

    // Ouvrir le scanner
    openScanPopup('return', 'scan');
}

async function handleSearchArticleForReturn() {
    if (!state.currentProject) return;

    const searchInput = document.getElementById('manualArticleSearchInput');
    const searchTerm = searchInput.value.trim();

    if (!searchTerm) {
        showNotification('Veuillez entrer un terme de recherche', 'warning');
        return;
    }

    try {
        showLoading();

        // 1. Récupérer les données du projet
        const projectData = await getProjectReservations(state.currentProject.id);
        const { sorties, retours } = projectData;

        // 2. Récupérer tous les articles du projet (IDs uniques)
        const articleIdsDuProjet = [...new Set(sorties.map(s => s.article_id))];

        if (articleIdsDuProjet.length === 0) {
            afficherMessageResultats('info', 'Ce projet n\'a aucun article utilisé');
            return;
        }

        // 3. Rechercher parmi les articles DU PROJET
        const { data: articles, error } = await supabase
            .from('w_articles')
            .select('*')
            .in('id', articleIdsDuProjet) // <-- IMPORTANT: seulement les articles du projet
            .or(`nom.ilike.%${searchTerm}%,numero.ilike.%${searchTerm}%,code_barre.ilike.%${searchTerm}%`)
            .limit(10);

        if (error) throw error;

        if (!articles || articles.length === 0) {
            afficherMessageResultats('warning', `Aucun article de ce projet ne correspond à "${searchTerm}"`);
            return;
        }

        // 4. Séparer les articles en deux catégories
        const articlesAvecFleche = [];
        const articlesDejaRetournes = [];

        articles.forEach(article => {
            const sortiesArticle = sorties.filter(s => s.article_id === article.id);
            const retoursArticle = retours.filter(r => r.article_id === article.id);

            const totalSorti = sortiesArticle.reduce((sum, s) => sum + s.quantite, 0);
            const totalRetourne = retoursArticle.reduce((sum, r) => sum + r.quantite, 0);
            const quantiteRestante = totalSorti - totalRetourne;

            if (quantiteRestante > 0) {
                articlesAvecFleche.push({
                    article,
                    quantiteRestante,
                    derniereSortie: sortiesArticle.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]
                });
            } else if (totalSorti > 0) {
                articlesDejaRetournes.push({
                    article,
                    totalSorti,
                    totalRetourne,
                    derniereSortie: sortiesArticle.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]
                });
            }
        });

        // 5. Afficher selon le résultat
        if (articlesAvecFleche.length > 0) {
            // Afficher les articles avec flèche
            displayArticlesAvecFleche(articlesAvecFleche);
        } else if (articlesDejaRetournes.length > 0) {
            // Afficher directement les articles déjà retournés
            displayArticlesDejaRetournes(articlesDejaRetournes);
        } else {
            // Cas improbable : article du projet mais ni flèche ni retourné
            afficherMessageResultats('info', `"${articles[0].nom}" est dans le projet mais n'a pas de sortie enregistrée`);
        }

    } catch (error) {
        console.error('Erreur recherche article:', error);
        showNotification('Erreur lors de la recherche', 'error');
    } finally {
        hideLoading();
    }
}

// Fonction pour afficher un message dans les résultats
function afficherMessageResultats(type, message) {
    const resultsContainer = document.getElementById('articleSearchResults');
    const resultsList = document.getElementById('articleResultsList');
    const resultsCount = document.getElementById('resultsCount');

    const icon = type === 'info' ? 'fa-info-circle' : 'fa-exclamation-triangle';
    const color = type === 'info' ? '#3498db' : '#e74c3c';

    resultsList.innerHTML = `
        <div class="message-result">
            <i class="fas ${icon} fa-3x"></i>
            <p>${message}</p>
        </div>
    `;
    resultsCount.textContent = '0 résultat(s)';
    resultsContainer.style.display = 'block';
}

// Fonction de notification (si elle n'existe pas)
function showNotification(message, type = 'info') {
    // Utiliser showAlert si elle existe, sinon console.log
    if (typeof showAlert === 'function') {
        showAlert(message, type);
    } else if (type === 'error') {
        console.error(message);
    } else {
        console.log(message);
    }
}

// Afficher les articles avec flèche (sortie non retournée)
function displayArticlesAvecFleche(articlesAvecFleche) {
    const resultsContainer = document.getElementById('articleSearchResults');
    const resultsList = document.getElementById('articleResultsList');
    const resultsCount = document.getElementById('resultsCount');

    let html = '';
    articlesAvecFleche.forEach(item => {
        const { article, quantiteRestante, derniereSortie } = item;

        html += `
            <div class="article-result-item has-arrow" data-id="${article.id}">
                <div class="article-result-image">
                    ${article.photo_url ? `
                        <img src="${article.photo_url}" alt="${article.nom}"
                             class="enlargeable-image"
                             data-image-url="${article.photo_url}"
                             data-image-title="${article.nom}">
                    ` : `
                        <div class="no-image">
                            <i class="fas fa-box"></i>
                        </div>
                    `}
                </div>
                <div class="article-result-info">
                    <h6>${article.nom}</h6>
                    <div class="article-result-details">
                        <span>${article.numero || 'Sans numéro'}</span>
                        <span class="status-arrow">À retourner: ${quantiteRestante}</span>
                        ${article.code_barre ? `<span>${article.code_barre}</span>` : ''}
                    </div>
                    <div class="article-date-info">
                        <small><i class="far fa-calendar"></i> Dernière sortie: ${formatDate(derniereSortie?.created_at)}</small>
                    </div>
                </div>
                <div class="article-result-actions">
                    <button class="btn-primary return-article-btn"
                            data-mouvement-id="${derniereSortie?.id}"
                            data-article-id="${article.id}"
                            data-quantity="${quantiteRestante}">
                        <i class="fas fa-arrow-left"></i> Retourner
                    </button>
                </div>
            </div>
        `;
    });

    resultsList.innerHTML = html;
    resultsCount.textContent = `${articlesAvecFleche.length} article(s) à retourner`;
    resultsContainer.style.display = 'block';

    // Ajouter les événements
    setupSearchResultEvents();
}

// Afficher les articles déjà retournés
function displayArticlesDejaRetournes(articlesDejaRetournes) {
    const resultsContainer = document.getElementById('articleSearchResults');
    const resultsList = document.getElementById('articleResultsList');
    const resultsCount = document.getElementById('resultsCount');

    let html = '';
    articlesDejaRetournes.forEach(item => {
        const { article, totalSorti, totalRetourne, derniereSortie } = item;

        html += `
            <div class="article-result-item no-arrow" data-id="${article.id}">
                <div class="article-result-image">
                    ${article.photo_url ? `
                        <img src="${article.photo_url}" alt="${article.nom}"
                             class="enlargeable-image"
                             data-image-url="${article.photo_url}"
                             data-image-title="${article.nom}">
                    ` : `
                        <div class="no-image">
                            <i class="fas fa-box"></i>
                        </div>
                    `}
                </div>
                <div class="article-result-info">
                    <h6>${article.nom}</h6>
                    <div class="article-result-details">
                        <span>${article.numero || 'Sans numéro'}</span>
                        <span class="status-none">Déjà retourné: ${totalRetourne}/${totalSorti}</span>
                        ${article.code_barre ? `<span>${article.code_barre}</span>` : ''}
                    </div>
                    <div class="article-date-info">
                        ${derniereSortie ?
                            `<small><i class="far fa-calendar"></i> Dernière sortie: ${formatDate(derniereSortie.created_at)}</small>` :
                            ''
                        }
                    </div>
                </div>
                <div class="article-result-actions">
                    <button class="btn-secondary add-article-btn"
                            data-article-id="${article.id}">
                        <i class="fas fa-plus"></i> Retour
                    </button>
                </div>
            </div>
        `;
    });

    resultsList.innerHTML = html;
    resultsCount.textContent = `${articlesDejaRetournes.length} article(s) déjà retourné(s)`;
    resultsContainer.style.display = 'block';

    // Ajouter les événements
    setupSearchResultEvents();

    // Événements spécifiques aux boutons "Ajouter"
    document.querySelectorAll('.add-article-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const articleId = this.dataset.articleId;
            const article = articlesDejaRetournes.find(a => a.article.id === articleId)?.article;

            if (article) {
                const confirmer = confirm(
                    `Toutes les pièces de "${article.nom}" ont déjà été retournées au stock \n\n` +
                    `Retourner d'autres pièces`
                );

                if (confirmer) {
                    creerSortieEtRetour(article);
                }
            }
        });
    });
}

// Fonction utilitaire pour configurer les événements des résultats
function setupSearchResultEvents() {
    // Images agrandissables
    document.querySelectorAll('.enlargeable-image').forEach(img => {
        img.addEventListener('click', function() {
            const imageUrl = this.dataset.imageUrl;
            const imageTitle = this.dataset.imageTitle;

            if (typeof enlargeArticleImage === 'function') {
                enlargeArticleImage(imageUrl, imageTitle);
            }
        });
    });

    // Boutons "Retourner"
    document.querySelectorAll('.return-article-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const mouvementId = this.dataset.mouvementId;
            const articleId = this.dataset.articleId;
            const quantity = parseInt(this.dataset.quantity);

            if (mouvementId && articleId) {
                openReturnToStockModal(mouvementId, articleId, quantity);
            }
        });
    });
}

async function creerSortieEtRetour(article) {
    // Créer un modal simple
    const modalHTML = `
        <div class="modal-overlay simple-return-modal">
            <div class="modal" style="max-width: 400px;">
                <div class="modal-header">
                    <h3><i class="fas fa-plus-circle"></i> Retourner au stock</h3>
                    <button class="close-modal">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="article-info-simple">
                        <h4>${article.nom}</h4>
                        <p>Stock actuel: ${article.stock_actuel || 0}</p>
                    </div>

                    <div class="form-group">
                        <label><i class="fas fa-boxes"></i> Quantité à retourner *</label>
                        <input type="number"
                               id="simpleQuantity"
                               value="1"
                               min="1"
                               class="form-input">
                    </div>

                    <div class="form-group">
                        <label><i class="fas fa-clipboard-list"></i> Motif *</label>
                        <select id="simpleReason" class="form-select">
                            <option value="perdu_retrouve">Perdu → Retrouvé</option>
                            <option value="casse_repare">Cassé → Réparé</option>
                            <option value="vole_remplace">Volé → Remplacé</option>
                            <option value="fin_vie_remplace">Fin de vie → Remplacé</option>
                            <option value="autre">Autre</option>
                        </select>
                    </div>

                    <div class="form-group" id="simpleCommentGroup" style="display: none;">
                        <label><i class="fas fa-comment"></i> Commentaire</label>
                        <textarea id="simpleComment"
                                  rows="2"
                                  placeholder="Précisions..."
                                  class="form-textarea"></textarea>
                    </div>

                    <div class="modal-actions">
                        <button type="button" class="btn-secondary close-modal">
                            Annuler
                        </button>
                        <button id="confirmSimpleAdd" class="btn-primary">
                            <i class="fas fa-check"></i> Confirmer
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Ajouter le modal
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHTML;
    document.body.appendChild(modalContainer);

    const modal = modalContainer.querySelector('.simple-return-modal');
    modal.style.display = 'flex';

    // Gérer "Autre" pour afficher le commentaire
    const reasonSelect = modal.querySelector('#simpleReason');
    const commentGroup = modal.querySelector('#simpleCommentGroup');

    reasonSelect.addEventListener('change', function() {
        commentGroup.style.display = this.value === 'autre' ? 'block' : 'none';
    });

    // Fermeture
    const closeModal = () => {
        document.body.removeChild(modalContainer);
    };

    modal.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', closeModal);
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // Confirmation
    modal.querySelector('#confirmSimpleAdd').addEventListener('click', async () => {
        const quantity = parseInt(modal.querySelector('#simpleQuantity').value);
        const reason = modal.querySelector('#simpleReason').value;
        const comment = modal.querySelector('#simpleComment').value;

        if (!quantity || quantity < 1) {
            alert('Quantité invalide');
            return;
        }

        await enregistrerAjoutSimple(article, quantity, reason, comment, closeModal);
    });
}

async function enregistrerAjoutSimple(article, quantity, reason, comment, closeModal) {
    try {
        showLoading();

        // 1. Mettre à jour le stock
        const nouveauStock = (article.stock_actuel || 0) + quantity;

        const { error: stockError } = await supabase
            .from('w_articles')
            .update({
                stock_actuel: nouveauStock,
                updated_at: new Date().toISOString()
            })
            .eq('id', article.id);

        if (stockError) throw stockError;

        // 2. Créer un mouvement simple
        const motifMapping = {
            'perdu_retrouve': 'Perdu → Retrouvé',
            'casse_repare': 'Cassé → Réparé',
            'vole_remplace': 'Volé → Remplacé',
            'fin_vie_remplace': 'Fin de vie → Remplacé',
            'autre': 'Autre: ' + (comment || '')
        };

        const mouvementData = {
            article_id: article.id,
            type: 'ajustement',
            quantite: quantity,
            projet: state.currentProject?.nom || 'Ajustement',
            projet_id: state.currentProject?.id || null,
            commentaire: `Ajustement stock: ${motifMapping[reason] || reason} | ${comment || ''}`.trim(),
            utilisateur_id: currentUser.id,
            utilisateur: currentUser.username,
            stock_avant: article.stock_actuel || 0,
            stock_apres: nouveauStock,
            date_mouvement: new Date().toISOString().split('T')[0],
            heure_mouvement: new Date().toLocaleTimeString('fr-FR', { hour12: false }),
            created_at: new Date().toISOString()
        };

        const { error: mouvementError } = await supabase
            .from('w_mouvements')
            .insert([mouvementData]);

        if (mouvementError) throw mouvementError;

        // 3. Succès
        closeModal();
        showAlert(`${quantity} "${article.nom}" ajouté(s) au stock`, 'success');

    } catch (error) {
        console.error('Erreur ajout stock:', error);
        alert('Erreur lors de l\'ajout au stock');
    } finally {
        hideLoading();
    }
}

function displayArticleSearchResults(articles, sorties, retours) {
    const resultsContainer = document.getElementById('articleSearchResults');
    const resultsList = document.getElementById('articleResultsList');
    const resultsCount = document.getElementById('resultsCount');

    // Filtrer : garder seulement les articles qui ont une sortie non retournée
    const articlesAvecFleche = articles.filter(article => {
        const sortiesArticle = sorties.filter(s => s.article_id === article.id);

        if (sortiesArticle.length === 0) return false; // Pas de sortie

        // Pour chaque sortie, vérifier si elle a été retournée
        const sortiesNonRetournees = sortiesArticle.filter(sortie => {
            const retoursPourCetteSortie = retours.filter(r =>
                r.article_id === sortie.article_id
            );

            const quantiteRetournee = retoursPourCetteSortie.reduce((sum, r) => sum + r.quantite, 0);
            return sortie.quantite > quantiteRetournee;
        });

        return sortiesNonRetournees.length > 0; // Garder seulement si au moins une sortie non retournée
    });

    if (articlesAvecFleche.length === 0) {
        resultsList.innerHTML = `
            <div class="no-results">
                <i class="fas fa-search"></i>
                <p>Aucun article avec flèche trouvé pour "${document.getElementById('manualArticleSearchInput').value}"</p>
                <p class="small-text">Ces articles n'ont pas de sortie non retournée dans ce projet</p>
            </div>
        `;
        resultsCount.textContent = '0 résultat(s)';
        resultsContainer.style.display = 'block';
        return;
    }

    // Compter les quantités restantes par article
    const articleQuantitesRestantes = {};

    articlesAvecFleche.forEach(article => {
        const sortiesArticle = sorties.filter(s => s.article_id === article.id);
        const retoursArticle = retours.filter(r => r.article_id === article.id);

        const totalSorti = sortiesArticle.reduce((sum, s) => sum + s.quantite, 0);
        const totalRetourne = retoursArticle.reduce((sum, r) => sum + r.quantite, 0);

        articleQuantitesRestantes[article.id] = totalSorti - totalRetourne;
    });

    // Afficher les résultats
    let html = '';
    articlesAvecFleche.forEach(article => {
        const quantiteRestante = articleQuantitesRestantes[article.id] || 0;

        // Trouver la sortie la plus récente pour cet article
        const sortieArticle = sorties
            .filter(s => s.article_id === article.id)
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];

        html += `
            <div class="article-result-item" data-id="${article.id}">
                <div class="article-result-image">
                    ${article.photo_url ? `
                        <img src="${article.photo_url}" alt="${article.nom}"
                             class="enlargeable-image"
                             data-image-url="${article.photo_url}"
                             data-image-title="${article.nom}">
                    ` : `
                        <div class="no-image">
                            <i class="fas fa-box"></i>
                        </div>
                    `}
                </div>
                <div class="article-result-info">
                    <h6>${article.nom}</h6>
                    <div class="article-result-details">
                        <span>${article.numero || 'Sans numéro'}</span>
                        <span>À retourner: ${quantiteRestante}</span>
                        ${article.code_barre ? `<span>${article.code_barre}</span>` : ''}
                    </div>
                    <div class="article-date-info">
                        <small><i class="far fa-calendar"></i> Sorti le: ${formatDate(sortieArticle?.created_at)}</small>
                    </div>
                </div>
                <div class="article-result-actions">
                    <button class="btn-primary return-article-btn"
                            data-mouvement-id="${sortieArticle?.id}"
                            data-article-id="${article.id}"
                            data-quantity="${quantiteRestante}">
                        <i class="fas fa-arrow-left"></i> Retourner
                    </button>
                </div>
            </div>
        `;
    });

    resultsList.innerHTML = html;
    resultsCount.textContent = `${articlesAvecFleche.length} résultat(s)`;
    resultsContainer.style.display = 'block';

    // Ajouter les événements aux images
    document.querySelectorAll('.enlargeable-image').forEach(img => {
        img.addEventListener('click', function() {
            const imageUrl = this.dataset.imageUrl;
            const imageTitle = this.dataset.imageTitle;

            if (typeof enlargeArticleImage === 'function') {
                enlargeArticleImage(imageUrl, imageTitle);
            }
        });
    });

    // Ajouter les événements aux boutons
    document.querySelectorAll('.return-article-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const mouvementId = this.dataset.mouvementId;
            const articleId = this.dataset.articleId;
            const quantity = parseInt(this.dataset.quantity);

            if (mouvementId && articleId) {
                openReturnToStockModal(mouvementId, articleId, quantity);
            }
        });
    });
}

// Fonction pour afficher tous les résultats (même les articles sans sortie)
function displayAllSearchResults(articles, sorties, retours) {
    const resultsContainer = document.getElementById('articleSearchResults');
    const resultsList = document.getElementById('articleResultsList');
    const resultsCount = document.getElementById('resultsCount');

    if (!articles || articles.length === 0) {
        resultsList.innerHTML = `
            <div class="no-results">
                <i class="fas fa-search"></i>
                <p>Aucun article trouvé</p>
            </div>
        `;
        resultsCount.textContent = '0 résultat(s)';
        resultsContainer.style.display = 'block';
        return;
    }

    // Calculer les quantités pour chaque article
    const articleStats = {};

    articles.forEach(article => {
        const sortiesArticle = sorties.filter(s => s.article_id === article.id);
        const retoursArticle = retours.filter(r => r.article_id === article.id);

        const totalSorti = sortiesArticle.reduce((sum, s) => sum + s.quantite, 0);
        const totalRetourne = retoursArticle.reduce((sum, r) => sum + r.quantite, 0);
        const quantiteRestante = totalSorti - totalRetourne;
        const aUneFleche = quantiteRestante > 0;

        articleStats[article.id] = {
            totalSorti,
            totalRetourne,
            quantiteRestante,
            aUneFleche,
            derniereSortie: sortiesArticle.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]
        };
    });

    // Afficher les résultats
    let html = '';
    articles.forEach(article => {
        const stats = articleStats[article.id];
        const aUneFleche = stats?.aUneFleche || false;

        html += `
            <div class="article-result-item ${aUneFleche ? 'has-arrow' : 'no-arrow'}" data-id="${article.id}">
                <div class="article-result-image">
                    ${article.photo_url ? `
                        <img src="${article.photo_url}" alt="${article.nom}"
                             class="enlargeable-image"
                             data-image-url="${article.photo_url}"
                             data-image-title="${article.nom}">
                    ` : `
                        <div class="no-image">
                            <i class="fas fa-box"></i>
                        </div>
                    `}
                </div>
                <div class="article-result-info">
                    <h6>${article.nom}</h6>
                    <div class="article-result-details">
                        <span>${article.numero || 'Sans numéro'}</span>
                        ${stats ? `
                            <span class="${aUneFleche ? 'status-arrow' : 'status-none'}">
                                ${aUneFleche ? `À retourner: ${stats.quantiteRestante}` : 'Tout retourné'}
                            </span>
                        ` : '<span class="status-none">Non utilisé</span>'}
                        ${article.code_barre ? `<span>${article.code_barre}</span>` : ''}
                    </div>
                    <div class="article-date-info">
                        ${stats?.derniereSortie ?
                            `<small><i class="far fa-calendar"></i> Dernière sortie: ${formatDate(stats.derniereSortie.created_at)}</small>` :
                            `<small><i class="fas fa-info-circle"></i> Non utilisé dans ce projet</small>`
                        }
                    </div>
                </div>
                <div class="article-result-actions">
                    ${aUneFleche ? `
                        <button class="btn-primary return-article-btn"
                                data-mouvement-id="${stats.derniereSortie?.id}"
                                data-article-id="${article.id}"
                                data-quantity="${stats.quantiteRestante}">
                            <i class="fas fa-arrow-left"></i> Retourner
                        </button>
                    ` : `
                        <button class="btn-secondary add-article-btn"
                                data-article-id="${article.id}">
                            <i class="fas fa-plus"></i> Ajouter
                        </button>
                    `}
                </div>
            </div>
        `;
    });

    resultsList.innerHTML = html;
    resultsCount.textContent = `${articles.length} résultat(s)`;
    resultsContainer.style.display = 'block';

    // Ajouter les événements aux images
    document.querySelectorAll('.enlargeable-image').forEach(img => {
        img.addEventListener('click', function() {
            const imageUrl = this.dataset.imageUrl;
            const imageTitle = this.dataset.imageTitle;

            if (typeof enlargeArticleImage === 'function') {
                enlargeArticleImage(imageUrl, imageTitle);
            }
        });
    });

    // Ajouter les événements aux boutons "Retourner"
    document.querySelectorAll('.return-article-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const mouvementId = this.dataset.mouvementId;
            const articleId = this.dataset.articleId;
            const quantity = parseInt(this.dataset.quantity);

            if (mouvementId && articleId) {
                openReturnToStockModal(mouvementId, articleId, quantity);
            }
        });
    });

    // Ajouter les événements aux boutons "Ajouter"
    document.querySelectorAll('.add-article-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const articleId = this.dataset.articleId;
            const article = articles.find(a => a.id === articleId);

            if (article) {
                const confirmer = confirm(
                    `Ajouter "${article.nom}" au projet ?\n\n` +
                    `Cela créera une sortie puis ouvrira le formulaire de retour.`
                );

                if (confirmer) {
                    creerSortieEtRetour(article);
                }
            }
        });
    });
}

// Fonction spéciale pour le scanner "return"
async function handleScanForReturn(barcode) {
    if (!state.currentProject) return;

    try {
        // Rechercher l'article par code-barre
        const { data: articles, error } = await supabase
            .from('w_articles')
            .select('*')
            .eq('code_barre', barcode)
            .limit(1);

        if (error) throw error;

        if (!articles || articles.length === 0) {
            alert(`Code-barre ${barcode} non trouvé`);
            return;
        }

        const article = articles[0];

        // Vérifier si l'article appartient au projet
        const projectData = await getProjectReservations(state.currentProject.id);
        const { sorties } = projectData;

        const articleSortie = sorties.find(s => s.article_id === article.id);

        if (!articleSortie) {
            alert(`Cet article n'a pas été utilisé dans le projet "${state.currentProject.nom}"`);
            return;
        }

        // Ouvrir directement le modal de retour
        openReturnToStockModal(articleSortie.id, article.id, articleSortie.quantite);

    } catch (error) {
        console.error('Erreur scan retour:', error);
        alert('Erreur lors du scan');
    }
}

async function loadStats() {
    try {
        // Compter le nombre total d'articles
        const { count: totalArticles, error: countError } = await supabase
            .from('w_articles')
            .select('*', { count: 'exact', head: true });

        if (!countError) {
            document.getElementById('totalArticles').textContent = totalArticles;
        }

        // Calculer les articles en stock
        const { data: articles, error: articlesError } = await supabase
            .from('w_articles')
            .select('stock_actuel, stock_reserve, prix_unitaire');

        if (!articlesError && articles) {
            let totalEnStock = 0;
            let totalReserves = 0;
            let valeurTotale = 0;

            articles.forEach(article => {
                totalEnStock += article.stock_actuel || 0;
                totalReserves += article.stock_reserve || 0;
                valeurTotale += (article.stock_actuel || 0) * (article.prix_unitaire || 0);
            });

            document.getElementById('articlesEnStock').textContent = totalEnStock;
            document.getElementById('articlesReserves').textContent = totalReserves;
            document.getElementById('valeurStock').textContent = valeurTotale.toFixed(2) + ' €';
        }

    } catch (error) {
        console.error('Erreur lors du chargement des stats:', error);
    }
}

async function loadAdminData() {
    if (!currentUser.isAdmin) return;

    await Promise.all([
        loadStockBas(),
        loadRuptures()
    ]);
}

async function loadStockBas() {
    try {
        const { data: articles, error } = await supabase
            .from('w_articles')
            .select('nom, stock_actuel, stock_minimum, stock_reserve')
            .gt('stock_minimum', 0)
            .order('stock_actuel', { ascending: true });

        const tbody = document.getElementById('tbodyStockBas');
        const table = document.getElementById('tableStockBas');
        const loading = document.getElementById('stockBasLoading');
        const empty = document.getElementById('noStockBas');

        if (error) throw error;

        // Cacher le loading
        loading.style.display = 'none';

        if (!articles || articles.length === 0) {
            empty.style.display = 'block';
            table.style.display = 'none';
            return;
        }

        // Afficher le tableau
        table.style.display = 'table';

        // Filtrer les articles en stock bas (en tenant compte des réservations)
        // ET exclure ceux qui sont en rupture (disponible ≤ 0)
        const stockBas = articles.filter(article => {
            const disponible = article.stock_actuel - article.stock_reserve;
            return disponible > 0 && // EXCLURE les ruptures
                   disponible <= article.stock_minimum;
        });

        if (stockBas.length === 0) {
            empty.style.display = 'block';
            table.style.display = 'none';
            return;
        }

        // Remplir le tableau
        tbody.innerHTML = '';
        stockBas.forEach(article => {
            const disponible = article.stock_actuel - article.stock_reserve;
            const diff = disponible - article.stock_minimum;
            const row = document.createElement('tr');

            row.innerHTML = `
                <td>${article.nom}</td>
                <td>${disponible} (Stock: ${article.stock_actuel}, Réservé: ${article.stock_reserve})</td>
                <td>${article.stock_minimum}</td>
                <td class="${diff < 0 ? 'text-danger' : diff === 0 ? 'text-warning' : ''}">
                    ${diff}
                </td>
            `;

            tbody.appendChild(row);
        });

    } catch (error) {
        console.error('Erreur lors du chargement du stock bas:', error);
    }
}

async function loadRuptures() {
    try {
        // Chercher les articles en rupture (disponible ≤ 0)
        const { data: articles, error } = await supabase
            .from('w_articles')
            .select('nom, stock_actuel, stock_reserve')
            .order('nom');

        const tbody = document.getElementById('tbodyRupture');
        const table = document.getElementById('tableRupture');
        const loading = document.getElementById('ruptureLoading');
        const empty = document.getElementById('noRupture');

        if (error) throw error;

        // Cacher le loading
        loading.style.display = 'none';

        if (!articles || articles.length === 0) {
            empty.style.display = 'block';
            table.style.display = 'none';
            return;
        }

        // Filtrer les articles en rupture (disponible ≤ 0)
        const ruptures = articles.filter(article => {
            const disponible = article.stock_actuel - article.stock_reserve;
            return disponible <= 0; // Rupture = disponible ≤ 0
        });

        if (ruptures.length === 0) {
            empty.style.display = 'block';
            table.style.display = 'none';
            return;
        }

        // Afficher le tableau
        table.style.display = 'table';

        // Remplir le tableau
        tbody.innerHTML = '';
        ruptures.forEach(article => {
            const disponible = article.stock_actuel - article.stock_reserve;
            const row = document.createElement('tr');

            row.innerHTML = `
                <td>${article.nom}</td>
                <td>Stock: ${article.stock_actuel}, Réservé: ${article.stock_reserve}</td>
                <td class="text-danger">${disponible} unité(s) disponible(s)</td>
            `;

            tbody.appendChild(row);
        });

    } catch (error) {
        console.error('Erreur lors du chargement des ruptures:', error);
    }
}

// ===== CONFIGURATION DES BOUTONS ADMIN =====
function setupAdminButtons() {
    const adminButtons = document.getElementById('adminButtons');
    const permissions = currentUser.permissions || {};

    // Boutons avec leurs permissions correspondantes
    const buttons = [
        { id: 'statistiques', icon: 'fas fa-chart-bar', text: 'Statistiques', perm: 'stats' },
        { id: 'creation', icon: 'fas fa-plus-circle', text: 'Créer article', perm: 'creation' },
        { id: 'historique', icon: 'fas fa-history', text: 'Historique', perm: 'historique' },
        { id: 'impression', icon: 'fas fa-print', text: 'Impression', perm: 'impression' },
        { id: 'configuration', icon: 'fas fa-cog', text: 'Configuration', perm: 'config' },
        { id: 'gestion', icon: 'fas fa-box-open', text: 'Gestion articles', perm: 'gestion' },
        { id: 'projet', icon: 'fas fa-project-diagram', text: 'Gestion projets', perm: 'projets' },
        { id: 'reservations', icon: 'fas fa-clipboard-list', text: 'Réservations', perm: 'reservations' },
        { id: 'vuestock', icon: 'fas fa-boxes', text: 'Vue stock 3D', perm: 'vuestock' }
    ];

    // Filtrer les boutons selon les permissions
    const allowedButtons = buttons.filter(btn => permissions[btn.perm]);

    // Mettre à jour le compteur de permissions
    document.getElementById('permissionsCount').textContent =
        `${allowedButtons.length} permissions`;

    // Créer les boutons
    adminButtons.innerHTML = '';
    allowedButtons.forEach(btn => {
        const button = document.createElement('button');
        button.className = 'admin-btn';
        button.id = `${btn.id}Btn`;
        button.innerHTML = `
            <i class="${btn.icon}"></i>
            <span>${btn.text}</span>
        `;

        // Ajouter l'événement de clic
        button.addEventListener('click', () => {
            window.location.href = `${btn.id}.html`;
        });

        adminButtons.appendChild(button);
    });

    // Si aucun bouton, afficher un message
    if (allowedButtons.length === 0) {
        adminButtons.innerHTML = `
            <div class="alert-empty">
                <i class="fas fa-info-circle"></i>
                <p>Aucune permission d'administration</p>
            </div>
        `;
    }
}

// ===== CONFIGURATION DES ÉVÉNEMENTS =====
function setupEventListeners() {
    // Déconnexion
    document.getElementById('logoutBtn').addEventListener('click', logout);

    // Actions rapides
    document.querySelectorAll('.option-btn').forEach(btn => {
        btn.addEventListener('click', handleQuickAction);
    });

    // Recherche
    document.getElementById('searchNomBtn').addEventListener('click', searchByName);
    document.getElementById('searchCodebarreBtn').addEventListener('click', searchByCodebarre);

    // Recherche avec Entrée
    document.getElementById('searchNomInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') searchByName();
    });

    document.getElementById('searchCodebarreInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') searchByCodebarre();
    });

    // Export PDF (admin seulement)
    if (currentUser.isAdmin) {
        document.getElementById('exportStockBasBtn').addEventListener('click', exportStockBasPDF);
        document.getElementById('exportRuptureBtn').addEventListener('click', exportRupturePDF);
    }

    // Bouton "Retour projet en stock"
    document.getElementById('selectProjetBtn')?.addEventListener('click', openProjectSelectionModal);

    // Fermeture du modal Détails projet
    document.getElementById('projectDetailsModal')?.querySelector('.close-modal')?.addEventListener('click', () => {
        closeModal('projectDetailsModal');
        state.currentProject = null; // Nettoyer l'état
    });

    // Bouton Fermer dans les actions du modal Détails projet
    const projectModal = document.getElementById('projectDetailsModal');
    if (projectModal) {
        const closeBtn = projectModal.querySelector('.modal-actions .btn-secondary.close-modal');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                closeModal('projectDetailsModal');
                state.currentProject = null; // Nettoyer l'état
            });
        }
    }

    // Onglets du modal projet
    document.querySelectorAll('.project-tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const tab = this.dataset.tab;
            switchProjectTab(tab);
        });
    });

    // Boutons du modal Détails projet
    if (archiveProjectBtn) {
        archiveProjectBtn.addEventListener('click', handleArchiveProject);
    }

    if (exportProjectBtn) {
        exportProjectBtn.addEventListener('click', handleExportProject);
    }

    if (addReservationToProjectBtn) {
        addReservationToProjectBtn.addEventListener('click', handleAddReservationToProject);
    }

    // Clic en dehors des modals pour fermer
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', function(e) {
            if (e.target === this) {
                hideModal();
                // Si c'est le modal Détails projet qui se ferme
                if (overlay.id === 'projectDetailsModal') {
                    state.currentProject = null; // Nettoyer l'état
                }
            }
        });
    });

    // Boutons du scanner/recherche pour retour d'article
    const scanArticleBtn = document.getElementById('scanArticleForReturnBtn');
    const searchArticleBtn = document.getElementById('searchArticleForReturnBtn');
    const manualSearchInput = document.getElementById('manualArticleSearchInput');

    if (scanArticleBtn) {
        scanArticleBtn.addEventListener('click', handleScanArticleForReturn);
    }

    // Debug: vérifier quel bouton existe
    console.log('🔍 Recherche des boutons de projet...');
    console.log('Bouton selectProjetBtn:', document.getElementById('selectProjetBtn'));
    console.log('Bouton reservationProjetBtn:', document.getElementById('reservationProjetBtn'));
    console.log('Tous les boutons avec "projet":', document.querySelectorAll('[id*="projet"],[id*="Projet"]'));

    if (searchArticleBtn) {
        searchArticleBtn.addEventListener('click', handleSearchArticleForReturn);
    }

    if (manualSearchInput) {
        manualSearchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                handleSearchArticleForReturn();
            }
        });
    }

    // Échappement pour fermer les modals
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && state.currentModal) {
            hideModal();
        }
    });
}

// ===== POPUP DE RECHERCHE =====
function openSearchPopup(results, searchType) {
    // Créer le popup
    const popup = document.createElement('div');
    popup.className = 'search-popup-overlay';
    popup.innerHTML = `
        <div class="search-popup">
            <div class="popup-header">
                <h3>Résultats de recherche (${results.length})</h3>
                <button class="close-popup">&times;</button>
            </div>
            <div class="popup-content">
                <div class="results-list">
                    ${results.map((article, index) => `
                        <div class="result-item" data-id="${article.id}" data-index="${index}">
                            <div class="result-main">
                                <h4>${article.nom}</h4>
                                <div class="result-details">
                                    <span>${article.numero}</span>
                                    <span>${article.code_barre || 'Pas de code-barre'}</span>
                                    <span>Stock: ${article.stock_actuel || 0}</span>
                                    <span>${article.prix_unitaire ? article.prix_unitaire + '€' : ''}</span>
                                    ${article.emplacement ? `<span class="article-location">📍 ${article.emplacement}</span>` : ''}
                                </div>
                            </div>
                            <div class="result-actions">
                                <button class="btn-action view-details" data-index="${index}">
                                    <i class="fas fa-eye"></i> Détails
                                </button>
                                <button class="btn-action print-label" data-id="${article.id}">
                                    <i class="fas fa-print"></i> Étiquette
                                </button>
                                <button class="btn-action show-location" data-index="${index}">
                                    <i class="fas fa-map-marker-alt"></i> Localiser
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            <div class="popup-footer">
                <button class="btn btn-secondary close-popup-btn">Fermer</button>
            </div>
        </div>
    `;

    document.body.appendChild(popup);

    // Ajouter les événements
    popup.querySelector('.close-popup').addEventListener('click', () => {
        document.body.removeChild(popup);
    });

    popup.querySelector('.close-popup-btn').addEventListener('click', () => {
        document.body.removeChild(popup);
    });

    popup.addEventListener('click', (e) => {
        if (e.target === popup) {
            document.body.removeChild(popup);
        }
    });

    // Événements pour les boutons d'action
    popup.querySelectorAll('.view-details').forEach(btn => {
        btn.addEventListener('click', function() {
            const index = this.dataset.index;
            openArticleDetailsPopup(results[index]);
        });
    });

    popup.querySelectorAll('.quick-edit').forEach(btn => {
        btn.addEventListener('click', function() {
            const articleId = this.dataset.id;
            openEditArticlePopup(articleId);
        });
    });

    popup.querySelectorAll('.print-label').forEach(btn => {
        btn.addEventListener('click', function() {
            const articleId = this.dataset.id;
            openPrintLabelPopup(results.find(a => a.id === articleId));
        });
    });

    // Bouton "Localiser" spécifique
    popup.querySelectorAll('.show-location').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation(); // Empêcher le clic sur la ligne
            const index = this.dataset.index;
            const article = results[index];

            // Fermer le popup
            document.body.removeChild(popup);

            // Mettre à jour la vue Quad (affichage UNIQUE)
            if (window.accueilQuadManager && article) {
                window.accueilQuadManager.showSingleArticleLocation(article);
            }
        });
    });

    // Événement pour cliquer sur l'article lui-même (toute la ligne)
    popup.querySelectorAll('.result-item').forEach(item => {
        item.addEventListener('click', function(e) {
            // Éviter de déclencher quand on clique sur les boutons
            if (e.target.closest('.btn-action')) return;

            const index = this.dataset.index;
            const article = results[index];

            // Fermer le popup
            document.body.removeChild(popup);

            // Mettre à jour la vue Quad (affichage UNIQUE)
            if (window.accueilQuadManager && article) {
                window.accueilQuadManager.showSingleArticleLocation(article);
            }
        });
    });
}

// ===== POPUP DÉTAILS ARTICLE =====
function openArticleDetailsPopup(article) {
    const popup = document.createElement('div');
    popup.className = 'details-popup-overlay';
    popup.innerHTML = `
        <div class="details-popup">
            <div class="popup-header">
                <h3>${article.nom}</h3>
                <button class="close-popup">&times;</button>
            </div>
            <div class="popup-content">
                <div class="article-details-grid">
                    <div class="detail-item">
                        <label>Numéro:</label>
                        <span>${article.numero || 'Non renseigné'}</span>
                    </div>
                    <div class="detail-item">
                        <label>Code-barre:</label>
                        <span>${article.code_barre || 'Non renseigné'}</span>
                    </div>
                    <div class="detail-item">
                        <label>Stock actuel:</label>
                        <span class="${article.stock_actuel <= (article.stock_minimum || 0) ? 'text-danger' : ''}">
                            ${article.stock_actuel || 0}
                        </span>
                    </div>
                    <div class="detail-item">
                        <label>Stock minimum:</label>
                        <span>${article.stock_minimum || 0}</span>
                    </div>
                    <div class="detail-item">
                        <label>Stock réservé:</label>
                        <span>${article.stock_reserve || 0}</span>
                    </div>
                    <div class="detail-item">
                        <label>Prix unitaire:</label>
                        <span>${article.prix_unitaire ? article.prix_unitaire + '€' : 'Non renseigné'}</span>
                    </div>
                    <div class="detail-item full-width">
                        <label>Description:</label>
                        <p>${article.description || 'Aucune description'}</p>
                    </div>
                    <div class="detail-item full-width">
                        <label>Emplacement:</label>
                        <span>${article.emplacement || 'Non renseigné'}</span>
                    </div>
                </div>

                <div class="action-buttons">
                    <button class="btn btn-primary edit-article-btn" data-id="${article.id}">
                        <i class="fas fa-edit"></i> Modifier
                    </button>
                    <button class="btn btn-secondary print-single-btn" data-id="${article.id}">
                        <i class="fas fa-print"></i> Imprimer une étiquette
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(popup);

    // Événements
    popup.querySelector('.close-popup').addEventListener('click', () => {
        document.body.removeChild(popup);
    });

    popup.addEventListener('click', (e) => {
        if (e.target === popup) {
            document.body.removeChild(popup);
        }
    });

    popup.querySelector('.edit-article-btn')?.addEventListener('click', () => {
        document.body.removeChild(popup);
        openEditArticlePopup(article.id);
    });

    popup.querySelector('.print-single-btn')?.addEventListener('click', () => {
        document.body.removeChild(popup);
        openPrintLabelPopup(article);
    });
}

// ===== POPUP MODIFICATION ARTICLE =====
async function openEditArticlePopup(articleId) {
    try {
        // Charger l'article
        const { data: article, error } = await supabase
            .from('w_articles')
            .select('*')
            .eq('id', articleId)
            .single();

        if (error) throw error;

        const popup = document.createElement('div');
        popup.className = 'edit-popup-overlay';
        popup.innerHTML = `
            <div class="edit-popup">
                <div class="popup-header">
                    <h3>Modifier: ${article.nom}</h3>
                    <button class="close-popup">&times;</button>
                </div>
                <div class="popup-content">
                    <form id="editArticleForm">
                        <div class="form-grid">
                            <div class="form-group">
                                <label for="editNom">Nom *</label>
                                <input type="text" id="editNom" value="${article.nom || ''}" required>
                            </div>
                            <div class="form-group">
                                <label for="editNumero">Numéro *</label>
                                <input type="text" id="editNumero" value="${article.numero || ''}" required>
                            </div>
                            <div class="form-group">
                                <label for="editCodeBarre">Code-barre</label>
                                <input type="text" id="editCodeBarre" value="${article.code_barre || ''}">
                            </div>
                            <div class="form-group">
                                <label for="editStockActuel">Stock actuel</label>
                                <input type="number" id="editStockActuel" value="${article.stock_actuel || 0}" min="0">
                            </div>
                            <div class="form-group">
                                <label for="editStockMinimum">Stock minimum</label>
                                <input type="number" id="editStockMinimum" value="${article.stock_minimum || 0}" min="0">
                            </div>
                            <div class="form-group">
                                <label for="editPrix">Prix unitaire (€)</label>
                                <input type="number" id="editPrix" step="0.01" value="${article.prix_unitaire || ''}">
                            </div>
                            <div class="form-group full-width">
                                <label for="editDescription">Description</label>
                                <textarea id="editDescription" rows="3">${article.description || ''}</textarea>
                            </div>
                            <div class="form-group">
                                <label for="editEmplacement">Emplacement</label>
                                <input type="text" id="editEmplacement" value="${article.emplacement || ''}">
                            </div>
                            <div class="form-group">
                                <label for="editCategorie">Catégorie</label>
                                <input type="text" id="editCategorie" value="${article.categorie || ''}">
                            </div>
                        </div>

                        <div class="form-actions">
                            <button type="button" class="btn btn-secondary close-popup-btn">Annuler</button>
                            <button type="submit" class="btn btn-primary">
                                <i class="fas fa-save"></i> Enregistrer
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.appendChild(popup);

        // Événements
        popup.querySelector('.close-popup').addEventListener('click', () => {
            document.body.removeChild(popup);
        });

        popup.querySelector('.close-popup-btn').addEventListener('click', () => {
            document.body.removeChild(popup);
        });

        popup.addEventListener('click', (e) => {
            if (e.target === popup) {
                document.body.removeChild(popup);
            }
        });

        // Soumission du formulaire
        popup.querySelector('#editArticleForm').addEventListener('submit', async (e) => {
            e.preventDefault();

            try {
                const updatedData = {
                    nom: document.getElementById('editNom').value,
                    numero: document.getElementById('editNumero').value,
                    code_barre: document.getElementById('editCodeBarre').value || null,
                    stock_actuel: parseInt(document.getElementById('editStockActuel').value) || 0,
                    stock_minimum: parseInt(document.getElementById('editStockMinimum').value) || 0,
                    prix_unitaire: parseFloat(document.getElementById('editPrix').value) || null,
                    description: document.getElementById('editDescription').value || null,
                    emplacement: document.getElementById('editEmplacement').value || null,
                    categorie: document.getElementById('editCategorie').value || null,
                    updated_at: new Date().toISOString()
                };

                const { error } = await supabase
                    .from('w_articles')
                    .update(updatedData)
                    .eq('id', articleId);

                if (error) throw error;

                alert('Article modifié avec succès !');
                document.body.removeChild(popup);

                // Recharger les données
                await loadPageData();

            } catch (error) {
                console.error('Erreur modification article:', error);
                alert('Erreur lors de la modification');
            }
        });

    } catch (error) {
        console.error('Erreur chargement article:', error);
        alert('Erreur lors du chargement de l\'article');
    }
}

// ===== POPUP IMPRESSION ÉTIQUETTE =====
function openPrintLabelPopup(article) {
    const popup = document.createElement('div');
    popup.className = 'print-popup-overlay';
    popup.innerHTML = `
        <div class="print-popup">
            <div class="popup-header">
                <h3>Imprimer une étiquette</h3>
                <button class="close-popup">&times;</button>
            </div>
            <div class="popup-content">
                <div class="print-preview">
                    <div class="label-preview" id="singleLabelPreview">
                        <div class="label-title">${article.nom}</div>
                        <div class="label-details">
                            <div>${article.numero}</div>
                            <div>Stock: ${article.stock_actuel || 0}</div>
                            ${article.prix_unitaire ? `<div>${article.prix_unitaire}€</div>` : ''}
                        </div>
                        <div class="label-barcode">
                            ${article.code_barre || article.numero}
                        </div>
                    </div>
                </div>

                <div class="print-options">
                    <div class="form-group">
                        <label for="printCopies">Nombre de copies</label>
                        <input type="number" id="printCopies" value="1" min="1" max="100">
                    </div>

                    <div class="form-group">
                        <label for="printFormat">Format</label>
                        <select id="printFormat">
                            <option value="small">Petite (40x20mm)</option>
                            <option value="medium" selected>Moyenne (60x40mm)</option>
                            <option value="large">Grande (100x70mm)</option>
                        </select>
                    </div>

                    <div class="checkbox-group">
                        <label>
                            <input type="checkbox" id="showPrice" checked> Afficher le prix
                        </label>
                        <label>
                            <input type="checkbox" id="showStock" checked> Afficher le stock
                        </label>
                        <label>
                            <input type="checkbox" id="showDate"> Afficher la date
                        </label>
                    </div>
                </div>

                <div class="print-actions">
                    <button type="button" class="btn btn-secondary close-popup-btn">Annuler</button>
                    <button type="button" class="btn btn-primary" id="printLabelBtn">
                        <i class="fas fa-print"></i> Imprimer
                    </button>
                    <button type="button" class="btn btn-info" id="addToPrintQueueBtn">
                        <i class="fas fa-list"></i> Ajouter à la file
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(popup);

    // Événements
    popup.querySelector('.close-popup').addEventListener('click', () => {
        document.body.removeChild(popup);
    });

    popup.querySelector('.close-popup-btn').addEventListener('click', () => {
        document.body.removeChild(popup);
    });

    popup.addEventListener('click', (e) => {
        if (e.target === popup) {
            document.body.removeChild(popup);
        }
    });

    // Bouton imprimer
    popup.querySelector('#printLabelBtn').addEventListener('click', () => {
        const copies = parseInt(popup.querySelector('#printCopies').value) || 1;
        alert(`Impression de ${copies} étiquette(s) pour: ${article.nom}\n(À intégrer avec le module d'impression)`);
        document.body.removeChild(popup);
    });

    // Bouton ajouter à la file
    popup.querySelector('#addToPrintQueueBtn').addEventListener('click', () => {
        const copies = parseInt(popup.querySelector('#printCopies').value) || 1;
        alert(`${copies} étiquette(s) ajoutée(s) à la file d'impression pour: ${article.nom}`);
        document.body.removeChild(popup);
    });
}

// ===== POPUP HISTORIQUE =====
async function openHistoryPopup(articleId) {
    try {
        const { data: mouvements, error } = await supabase
            .from('w_mouvements')
            .select(`
                *,
                w_articles:article_id (nom, numero, code_barre),
                w_projets:projet_id (nom, numero)
            `)
            .eq('article_id', articleId)
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) throw error;

        const popup = document.createElement('div');
        popup.className = 'history-popup-overlay';

        let tableHTML = '';
        if (mouvements && mouvements.length > 0) {
            tableHTML = `
                <div class="history-table-container">
                    <table class="history-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Type</th>
                                <th>Quantité</th>
                                <th>Stock avant</th>
                                <th>Stock après</th>
                                <th>Projet</th>
                                <th>Utilisateur</th>
                                <th>Raison/Commentaire</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${mouvements.map(mvt => {
                                const article = mvt.w_articles;
                                const projet = mvt.w_projets;

                                // Déterminer le type avec icône
                                let typeIcon = '';
                                let typeText = '';
                                let typeClass = '';

                                switch(mvt.type) {
                                    case 'entree':
                                        typeIcon = 'fa-plus-circle';
                                        typeText = 'Entrée';
                                        typeClass = 'success';
                                        break;
                                    case 'sortie':
                                        typeIcon = 'fa-minus-circle';
                                        typeText = 'Sortie';
                                        typeClass = 'danger';
                                        break;
                                    case 'reservation':
                                        typeIcon = 'fa-calendar-check';
                                        typeText = 'Réservation';
                                        typeClass = 'warning';
                                        break;
                                    default:
                                        typeIcon = 'fa-exchange-alt';
                                        typeText = 'Ajustement';
                                        typeClass = 'info';
                                }

                                // Formatage date
                                const dateFormatted = mvt.date_mouvement ?
                                    mvt.date_mouvement.split('-').reverse().join('/') : // Convertir 2024-01-15 en 15/01/2024
                                    new Date(mvt.created_at).toLocaleDateString('fr-FR');

                                const timeFormatted = mvt.heure_mouvement ?
                                    mvt.heure_mouvement.substring(0, 5) : // Garder HH:MM seulement
                                    new Date(mvt.created_at).toLocaleTimeString('fr-FR', {
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    });

                                // Projet info
                                let projetInfo = '';
                                if (mvt.projet_nom || projet?.nom) {
                                    const projetNom = mvt.projet_nom || projet?.nom || '';
                                    const projetNumero = projet?.numero || '';
                                    projetInfo = `${projetNom} ${projetNumero ? `(${projetNumero})` : ''}`;
                                }

                                // Raison/Commentaire
                                let raisonComment = '';
                                if (mvt.raison) {
                                    raisonComment += `<div><strong>Raison:</strong> ${mvt.raison}</div>`;
                                }
                                if (mvt.commentaire) {
                                    raisonComment += `<div><strong>Commentaire:</strong> ${mvt.commentaire}</div>`;
                                }
                                if (mvt.motif) {
                                    raisonComment += `<div><strong>Motif:</strong> ${mvt.motif}</div>`;
                                }

                                return `
                                    <tr>
                                        <td>
                                            <div>${dateFormatted}</div>
                                            <small class="text-muted">${timeFormatted}</small>
                                        </td>
                                        <td>
                                            <span class="badge badge-${typeClass}">
                                                <i class="fas ${typeIcon}"></i> ${typeText}
                                            </span>
                                        </td>
                                        <td class="${mvt.type === 'entree' ? 'text-success' : 'text-danger'}">
                                            ${mvt.type === 'entree' ? '+' : '-'}${mvt.quantite}
                                        </td>
                                        <td>${mvt.stock_avant}</td>
                                        <td>${mvt.stock_apres}</td>
                                        <td>${projetInfo || '-'}</td>
                                        <td>
                                            <div>${mvt.utilisateur || '-'}</div>
                                            ${mvt.responsable ? `<small>Resp: ${mvt.responsable}</small>` : ''}
                                        </td>
                                        <td class="text-left">${raisonComment || '-'}</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } else {
            tableHTML = `
                <div class="empty-history">
                    <i class="fas fa-history"></i>
                    <p>Aucun mouvement enregistré pour cet article</p>
                </div>
            `;
        }

        popup.innerHTML = `
            <div class="history-popup">
                <div class="popup-header">
                    <h3><i class="fas fa-history"></i> Historique des mouvements</h3>
                    <button class="close-popup">&times;</button>
                </div>
                <div class="popup-content">
                    ${tableHTML}
                </div>
                <div class="popup-footer">
                    <button class="btn btn-secondary close-popup-btn">Fermer</button>
                </div>
            </div>
        `;

        document.body.appendChild(popup);

        // Événements
        popup.querySelector('.close-popup').addEventListener('click', () => {
            document.body.removeChild(popup);
        });

        popup.querySelector('.close-popup-btn').addEventListener('click', () => {
            document.body.removeChild(popup);
        });

        popup.addEventListener('click', (e) => {
            if (e.target === popup) {
                document.body.removeChild(popup);
            }
        });

    } catch (error) {
        console.error('Erreur chargement historique:', error);
        alert('Erreur lors du chargement de l\'historique');
    }
}

// ===== GESTION DES ACTIONS =====
function handleQuickAction(e) {
    const action = e.target.closest('.option-btn').dataset.action;
    const type = e.target.closest('.option-btn').dataset.type;

    // Selon le type (scan ou saisie), ouvrir le bon popup
    if (type === 'scan') {
        openScanPopup(action, 'scan');
    } else {
        // Ouvrir directement le popup de saisie
        switch(action) {
            case 'sortie':
                openStockOutPopup();
                break;
            case 'entree':
                openStockInPopup();
                break;
            case 'reservation':
                openProjectReservationPopup();
                break;
        }
    }
}

async function searchByName() {
    const searchTerm = document.getElementById('searchNomInput').value.trim();

    if (!searchTerm) {
        alert('Veuillez entrer un terme de recherche');
        return;
    }

    try {
        const { data: articles, error } = await supabase
            .from('w_articles')
            .select('*')
            .or(`nom.ilike.%${searchTerm}%,numero.ilike.%${searchTerm}%`)
            .limit(10);

        if (error) throw error;

        if (!articles || articles.length === 0) {
            alert('Aucun article trouvé');
            return;
        }

        openSearchPopup(articles, 'nom');


        // ========== FIN AJOUT ==========

    } catch (error) {
        console.error('Erreur de recherche:', error);
        alert('Erreur lors de la recherche');
    }
}

async function searchByCodebarre() {
    const codebarre = document.getElementById('searchCodebarreInput').value.trim();

    if (!codebarre) {
        alert('Veuillez entrer ou scanner un code-barre');
        return;
    }

    try {
        const { data: articles, error } = await supabase
            .from('w_articles')
            .select('*')
            .ilike('code_barre', `%${codebarre}%`)
            .limit(10);

        if (error) throw error;

        if (!articles || articles.length === 0) {
            alert('Code-barre non trouvé');
            return;
        }

        openSearchPopup(articles, 'codebarre');

    } catch (error) {
        console.error('Erreur de recherche par code-barre:', error);
        alert('Erreur lors de la recherche');
    }
}

// ===== POPUP SORTIE DE STOCK =====
async function openStockOutPopup(article = null, scanMode = false) {
    const popup = document.createElement('div');
    popup.className = 'stock-popup-overlay';

    const initialData = article ? {
        articleId: article.id,
        articleName: article.nom,
        articleNumber: article.numero,
        currentStock: article.stock_actuel || 0,
        barcode: article.code_barre,
        unitPrice: article.prix_unitaire || 0,
        locationRack: article.rack_display_name || article.rack_code || '',    // Modifié
        locationLevel: article.level_code || '',                               // Modifié
        locationSlot: article.slot_code || '',                                 // Modifié
    } : null;

    const buildLocationString = (article) => {
        const parts = [];
        if (article.rack_display_name || article.rack_code) {
            parts.push(`Emplacement: ${article.rack_display_name || article.rack_code}`);
        }
        if (article.level_code) parts.push(`Étage: ${article.level_code}`);
        if (article.slot_code) parts.push(`Position: ${article.slot_code}`);
        return parts.join(' - ') || 'Non spécifié';
    };

    const locationString = initialData ? buildLocationString(article) : '';

    popup.innerHTML = `
        <div class="stock-popup">
            <div class="popup-header">
                <h3><i class="fas fa-arrow-up"></i> Sortie de stock</h3>
                <button class="close-popup">&times;</button>
            </div>
            <div class="popup-content">
                <div class="popup-section">
                    <h4><i class="fas fa-search"></i> Sélection de l'article</h4>
                    <div class="form-group">
                        <label>Recherche rapide</label>
                        <div class="search-combo">
                            <input type="text"
                                   id="outSearchInput"
                                   placeholder="Nom, numéro ou code-barre"
                                   class="search-input">
                            <button id="outSearchBtn" class="search-btn-sm">
                                <i class="fas fa-search"></i>
                            </button>
                            <button id="outScanBtn" class="scan-btn-sm">
                                <i class="fas fa-camera"></i> Scanner
                            </button>
                        </div>
                    </div>

                    ${initialData ? `
                        <div class="selected-article">
                            <div class="article-summary">
                                <strong>${initialData.articleName}</strong>
                                <div class="article-details">
                                    <span>${initialData.articleNumber}</span>
                                    <span>Stock: ${initialData.currentStock}</span>
                                    ${initialData.barcode ? `<span>CB: ${initialData.barcode}</span>` : ''}
                                </div>
                                ${initialData.unitPrice > 0 ? `<div class="article-price">Prix: ${initialData.unitPrice} €</div>` : ''}
                                ${locationString ? `<div class="article-location"><i class="fas fa-map-marker-alt"></i> ${locationString}</div>` : ''}
                            </div>
                        </div>
                    ` : `
                        <div id="outSearchResults" class="search-results" style="display: none;">
                            <div class="results-list"></div>
                        </div>
                    `}
                </div>

                <div class="popup-section">
                    <h4><i class="fas fa-edit"></i> Détails de la sortie</h4>
                    <div class="form-grid">
                        <div class="form-group">
                            <label for="outQuantity">Quantité *</label>
                            <input type="number"
                                   id="outQuantity"
                                   value="1"
                                   min="1"
                                   ${initialData ? `max="${initialData.currentStock}"` : ''}
                                   required>
                            <small id="outStockInfo">${initialData ? `Stock disponible: ${initialData.currentStock}` : ''}</small>
                        </div>

                        <div class="form-group">
                            <label for="outProject">Projet / Destination *</label>
                            <select id="outProject" required>
                                <option value="">Sélectionner...</option>
                                <!-- Les options seront chargées dynamiquement -->
                                <option value="vente_simple">Vente simple</option>
                            </select>
                        </div>

                        <div class="form-group full-width">
                            <label for="outReason">Raison de la sortie *</label>
                            <select id="outReason" required>
                                <option value="">Sélectionner une raison</option>
                                <option value="utilisation_projet">Utilisation pour projet</option>
                                <option value="vente_simple">Vente simple</option>
                                <option value="retour_fournisseur">Retour fournisseur</option>
                                <option value="don">Don</option>
                                <option value="perte">Perte/détérioration</option>
                                <option value="autre">Autre</option>
                            </select>
                        </div>

                        <div class="form-group full-width">
                            <label for="outNotes">Notes supplémentaires</label>
                            <textarea id="outNotes"
                                      rows="3"
                                      placeholder="Détails complémentaires..."></textarea>
                        </div>
                    </div>
                </div>

                <div class="popup-section">
                    <h4><i class="fas fa-info-circle"></i> Informations de localisation</h4>
                    <div class="location-display">
                        <div class="location-header">
                            <i class="fas fa-map-marker-alt"></i>
                            <span>Emplacement de l'article</span>
                        </div>
                        <div class="location-details" id="outLocationDetails">
                            ${locationString || 'Non spécifié'}
                        </div>
                        <div class="location-note">
                            <small><i class="fas fa-lightbulb"></i> Consultez cette localisation pour retrouver l'article en stock</small>
                        </div>
                    </div>

                    <div class="form-group" style="margin-top: 15px;">
                        <label for="outUnitPrice">Prix unitaire de sortie (€)</label>
                        <input type="number"
                               id="outUnitPrice"
                               step="0.01"
                               placeholder="0.00"
                               value="${initialData ? initialData.unitPrice : ''}">
                        <small>Prix de vente ou de sortie</small>
                    </div>
                </div>

                <div class="popup-section">
                    <h4><i class="fas fa-user"></i> Responsable</h4>
                    <div class="form-group">
                        <div class="user-badge current-user">
                            <i class="fas fa-user"></i>
                            <span>${currentUser.username} (${currentUser.isAdmin ? 'Administrateur' : 'Utilisateur'})</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="popup-footer">
                <button class="btn btn-secondary close-popup-btn">Annuler</button>
                <button class="btn btn-danger" id="confirmStockOutBtn">
                    <i class="fas fa-check-circle"></i> Confirmer la sortie
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(popup);

    // Initialisation
    if (initialData) {
        document.getElementById('outQuantity').addEventListener('input', function() {
            const stock = initialData.currentStock;
            const quantity = parseInt(this.value) || 0;
            const stockInfo = document.getElementById('outStockInfo');

            if (quantity > stock) {
                stockInfo.style.color = 'var(--danger-color)';
                stockInfo.textContent = `⚠️ Dépasse le stock disponible (${stock})`;
            } else {
                stockInfo.style.color = '';
                stockInfo.textContent = `Stock disponible: ${stock}`;
            }
        });

        // Synchroniser les selects projet et raison pour "Vente simple"
        const projectSelect = document.getElementById('outProject');
        const reasonSelect = document.getElementById('outReason');

        projectSelect.addEventListener('change', function() {
            if (this.value === 'vente_simple') {
                reasonSelect.value = 'vente_simple';
            }
        });

        reasonSelect.addEventListener('change', function() {
            if (this.value === 'vente_simple') {
                projectSelect.value = 'vente_simple';
            }
        });
    }

    // Charger les projets
    loadProjectsForSelect('outProject');

    // Événements
    setupStockPopupEvents(popup, 'out', initialData);
}

// ===== POPUP ENTREE DE STOCK =====
async function openStockInPopup(article = null, scanMode = false) {
    const popup = document.createElement('div');
    popup.className = 'stock-popup-overlay';

    const initialData = article ? {
        articleId: article.id,
        articleName: article.nom,
        articleNumber: article.numero,
        barcode: article.code_barre,
        unitPrice: article.prix_unitaire || 0,
        locationRack: article.rack_display_name || article.rack_code || '',    // Modifié
        locationLevel: article.level_code || '',                               // Modifié
        locationSlot: article.slot_code || '',                                 // Modifié
        currentStock: article.stock_actuel || 0
    } : null;

    const buildLocationString = (article) => {
        const parts = [];
        if (article.rack_display_name || article.rack_code) {
            parts.push(`Emplacement: ${article.rack_display_name || article.rack_code}`);
        }
        if (article.level_code) parts.push(`Étage: ${article.level_code}`);
        if (article.slot_code) parts.push(`Position: ${article.slot_code}`);
        return parts.join(' - ') || 'Non spécifié';
    };

    const locationString = initialData ? buildLocationString(article) : '';

    popup.innerHTML = `
        <div class="stock-popup">
            <div class="popup-header">
                <h3><i class="fas fa-arrow-down"></i> Entrée de stock</h3>
                <button class="close-popup">&times;</button>
            </div>
            <div class="popup-content">
                <div class="popup-section">
                    <h4><i class="fas fa-search"></i> Sélection de l'article</h4>
                    <div class="form-group">
                        <label>Recherche rapide</label>
                        <div class="search-combo">
                            <input type="text"
                                   id="inSearchInput"
                                   placeholder="Nom, numéro ou code-barre"
                                   class="search-input">
                            <button id="inSearchBtn" class="search-btn-sm">
                                <i class="fas fa-search"></i>
                            </button>
                            <button id="inScanBtn" class="scan-btn-sm">
                                <i class="fas fa-camera"></i> Scanner
                            </button>
                        </div>
                    </div>

                    ${initialData ? `
                        <div class="selected-article">
                            <div class="article-summary">
                                <strong>${initialData.articleName}</strong>
                                <div class="article-details">
                                    <span>${initialData.articleNumber}</span>
                                    ${initialData.barcode ? `<span>CB: ${initialData.barcode}</span>` : ''}
                                    <span>Stock actuel: ${initialData.currentStock}</span>
                                </div>
                                ${initialData.unitPrice > 0 ? `<div class="article-price">Prix unitaire: ${initialData.unitPrice} €</div>` : ''}
                                ${locationString ? `<div class="article-location"><i class="fas fa-map-marker-alt"></i> ${locationString}</div>` : ''}
                            </div>
                        </div>
                    ` : `
                        <div id="inSearchResults" class="search-results" style="display: none;">
                            <div class="results-list"></div>
                        </div>
                    `}
                </div>

                <div class="popup-section">
                    <h4><i class="fas fa-plus-circle"></i> Détails de l'entrée</h4>
                    <div class="form-grid">
                        <div class="form-group">
                            <label for="inQuantity">Quantité *</label>
                            <input type="number"
                                   id="inQuantity"
                                   value="1"
                                   min="1"
                                   max="1000"
                                   required>
                        </div>

                        <div class="form-group">
                            <label for="inSupplier">Fournisseur</label>
                            <input type="text"
                                   id="inSupplier"
                                   placeholder="Nom du fournisseur">
                        </div>

                        <div class="form-group">
                            <label for="inPurchaseOrder">Bon de commande</label>
                            <input type="text"
                                   id="inPurchaseOrder"
                                   placeholder="N° commande">
                        </div>

                        <div class="form-group full-width">
                            <label for="inReason">Type d'entrée *</label>
                            <select id="inReason" required>
                                <option value="">Sélectionner un type</option>
                                <option value="achat">Achat nouveau</option>
                                <option value="reappro">Réapprovisionnement</option>
                                <option value="retour_projet">Retour de projet</option>
                                <option value="inventaire">Correction inventaire</option>
                                <option value="don">Don</option>
                                <option value="vente_simple">Retour vente simple</option>
                                <option value="autre">Autre</option>
                            </select>
                        </div>

                        <div class="form-group full-width">
                            <label for="inNotes">Notes</label>
                            <textarea id="inNotes"
                                      rows="3"
                                      placeholder="Détails complémentaires..."></textarea>
                        </div>
                    </div>
                </div>

                <div class="popup-section">
                    <h4><i class="fas fa-tags"></i> Informations de l'article</h4>
                    <div class="info-grid">
                        <div class="info-item">
                            <label>Prix unitaire actuel:</label>
                            <div class="info-value" id="inCurrentPrice">
                                ${initialData ? `${initialData.unitPrice} €` : 'Non défini'}
                            </div>
                        </div>
                        <div class="info-item">
                            <label>Emplacement habituel:</label>
                            <div class="info-value" id="inCurrentLocation">
                                ${locationString || 'Non spécifié'}
                            </div>
                        </div>
                    </div>

                    <div class="form-grid" style="margin-top: 15px;">
                        <div class="form-group">
                            <label for="inUnitPrice">Nouveau prix unitaire (€)</label>
                            <input type="number"
                                   id="inUnitPrice"
                                   step="0.01"
                                   placeholder="0.00"
                                   value="${initialData ? initialData.unitPrice : ''}">
                            <small>Laissez vide pour conserver le prix actuel</small>
                        </div>

                    </div>
                </div>
            </div>

            <div class="popup-footer">
                <button class="btn btn-secondary close-popup-btn">Annuler</button>
                <button class="btn btn-success" id="confirmStockInBtn">
                    <i class="fas fa-check-circle"></i> Confirmer l'entrée
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(popup);

    // Événements
    setupStockPopupEvents(popup, 'in', initialData);
}

// ===== POPUP RESERVATION PROJET =====
async function openProjectReservationPopup(article = null) {
    const popup = document.createElement('div');
    popup.className = 'stock-popup-overlay';

    const initialData = article ? {
        articleId: article.id,
        articleName: article.nom,
        articleNumber: article.numero,
        currentStock: article.stock_actuel || 0,
        reservedStock: article.stock_reserve || 0,
        barcode: article.code_barre,
        unitPrice: article.prix_unitaire || 0,
        locationRack: article.rack_display_name || article.rack_code || '',    // Modifié
        locationLevel: article.level_code || '',                               // Modifié
        locationSlot: article.slot_code || '',                                 // Modifié
    } : null;

    const buildLocationString = (article) => {
        const parts = [];
        if (article.rack_display_name || article.rack_code) {
            parts.push(`Rayon: ${article.rack_display_name || article.rack_code}`);
        }
        if (article.level_code) parts.push(`Étagère: ${article.level_code}`);
        if (article.slot_code) parts.push(`Position: ${article.slot_code}`);
        return parts.join(' - ') || 'Non spécifié';
    };

    const locationString = initialData ? buildLocationString(article) : '';

    popup.innerHTML = `
        <div class="stock-popup">
            <div class="popup-header">
                <h3><i class="fas fa-calendar-check"></i> Réservation pour projet</h3>
                <button class="close-popup">&times;</button>
            </div>
            <div class="popup-content">
                <div class="popup-section">
                    <h4><i class="fas fa-search"></i> Article à réserver</h4>
                    <div class="form-group">
                        <label>Recherche rapide</label>
                        <div class="search-combo">
                            <input type="text"
                                   id="resSearchInput"
                                   placeholder="Nom, numéro ou code-barre"
                                   class="search-input">
                            <button id="resSearchBtn" class="search-btn-sm">
                                <i class="fas fa-search"></i>
                            </button>
                            <button id="resScanBtn" class="scan-btn-sm">
                                <i class="fas fa-camera"></i> Scanner
                            </button>
                        </div>
                    </div>

                    ${initialData ? `
                        <div class="selected-article">
                            <div class="article-summary">
                                <strong>${initialData.articleName}</strong>
                                <div class="article-details">
                                    <span>${initialData.articleNumber}</span>
                                    <span>Stock disponible: ${initialData.currentStock - initialData.reservedStock}</span>
                                    ${initialData.barcode ? `<span>CB: ${initialData.barcode}</span>` : ''}
                                </div>
                                ${initialData.unitPrice > 0 ? `<div class="article-price">Prix: ${initialData.unitPrice} €</div>` : ''}
                                ${locationString ? `<div class="article-location"><i class="fas fa-map-marker-alt"></i> ${locationString}</div>` : ''}
                            </div>
                        </div>
                    ` : `
                        <div id="resSearchResults" class="search-results" style="display: none;">
                            <div class="results-list"></div>
                        </div>
                    `}
                </div>

                <div class="popup-section">
                    <h4><i class="fas fa-project-diagram"></i> Détails de la réservation</h4>
                    <div class="form-grid">
                        <div class="form-group">
                            <label for="resQuantity">Quantité à réserver *</label>
                            <input type="number"
                                   id="resQuantity"
                                   value="1"
                                   min="1"
                                   ${initialData ? `max="${initialData.currentStock - initialData.reservedStock}"` : ''}
                                   required>
                            <small id="resStockInfo">
                                ${initialData ?
                                    `Disponible: ${initialData.currentStock - initialData.reservedStock}
                                     (Stock: ${initialData.currentStock}, Déjà réservé: ${initialData.reservedStock})`
                                    : ''}
                            </small>
                        </div>

                        <div class="form-group">
                            <label for="resProject">Projet *</label>
                            <select id="resProject" required>
                                <option value="">Sélectionner un projet</option>
                                <!-- Les options seront chargées dynamiquement -->
                            </select>
                        </div>

                        <div class="form-group">
                            <label for="resStartDate">Date de début</label>
                            <input type="date"
                                   id="resStartDate"
                                   value="${new Date().toISOString().split('T')[0]}">
                        </div>

                        <div class="form-group">
                            <label for="resEndDate">Date de fin prévue</label>
                            <input type="date"
                                   id="resEndDate"
                                   value="${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}">
                        </div>

                        <div class="form-group full-width">
                            <label for="resPurpose">Motif de la réservation *</label>
                            <select id="resPurpose" required>
                                <option value="" disabled selected>Pourquoi réserver cet article?</option>
                                <option value="utilisation_projet">Utilisation pour projet</option>
                                <option value="mise_de_cote">Mise de côté temporaire</option>
                                <option value="demonstration">Démonstration</option>
                                <option value="exposition">Exposition</option>
                                <option value="autre">Autre</option>
                            </select>
                        </div>

                        <div class="form-group full-width">
                            <label for="resNotes">Notes</label>
                            <textarea id="resNotes"
                                      rows="2"
                                      placeholder="Détails complémentaires..."></textarea>
                        </div>
                    </div>
                </div>

                <div class="popup-section">
                    <h4><i class="fas fa-map-marker-alt"></i> Localisation de l'article</h4>
                    <div class="location-info">
                        <div class="location-display">
                            <strong>Emplacement actuel:</strong>
                            <div class="location-details">
                                ${locationString || 'Non spécifié'}
                            </div>
                        </div>
                        <div class="location-note">
                            <small><i class="fas fa-info-circle"></i> Cet article se trouve actuellement à cet emplacement dans le stock</small>
                        </div>
                    </div>

                    <div class="form-group" style="margin-top: 15px;">
                        <label for="resUnitPrice">Prix unitaire (€)</label>
                        <input type="text"
                               id="resUnitPrice"
                               value="${initialData ? initialData.unitPrice : ''}"
                               readonly
                               class="readonly-input">
                        <small>Prix unitaire de référence</small>
                    </div>
                </div>

                <div class="popup-section">
                    <h4><i class="fas fa-user-check"></i> Informations du responsable</h4>
                    <div class="form-group">
                        <div class="user-badge current-user">
                            <i class="fas fa-user"></i>
                            <span>${currentUser.username}</span>
                            <small>Effectue la réservation</small>
                        </div>
                    </div>

                    <div class="form-group">
                        <label for="resResponsible">Responsable projet *</label>
                        <select id="resResponsible" required>
                            <option value="">Sélectionner un responsable...</option>
                            <!-- Les options seront chargées dynamiquement -->
                        </select>
                    </div>
                </div>
            </div>

            <div class="popup-footer">
                <button class="btn btn-secondary close-popup-btn">Annuler</button>
                    <button class="btn btn-warning" id="confirmStockReservationBtn">
                    <i class="fas fa-calendar-plus"></i> Créer la réservation
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(popup);

    // Initialisation
    if (initialData) {
        document.getElementById('resQuantity').addEventListener('input', function() {
            const available = initialData.currentStock - initialData.reservedStock;
            const quantity = parseInt(this.value) || 0;
            const stockInfo = document.getElementById('resStockInfo');

            if (quantity > available) {
                stockInfo.style.color = 'var(--danger-color)';
                stockInfo.textContent = `⚠️ Dépasse le stock disponible (${available})`;
            } else {
                stockInfo.style.color = '';
                stockInfo.textContent = `Disponible: ${available} (Stock: ${initialData.currentStock}, Déjà réservé: ${initialData.reservedStock})`;
            }
        });
    }

    // Charger les projets
    loadProjectsForSelect('resProject');
    loadEmployeesForSelect('resResponsible', currentUser.username);

    // Événements
    setupStockPopupEvents(popup, 'res', initialData);
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


    async function startCameraScan() {
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

                // Rechercher l'article selon le type d'action
                if (currentAction === 'return') {
                    // Scanner pour retour d'article
                    handleScanForReturn(code, popup);
                } else {
                    // Scanner normal (entrée/sortie/réservation)
                    searchArticleByBarcode(code);
                }
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

    // FONCTION DE RECHERCHE D'ARTICLE
    async function searchArticleByBarcode(barcode) {
        try {
            console.log('Recherche code-barre:', barcode);

            // Recherche avec jointure
            const { data: articles, error } = await supabase
                .from('w_articles')
                .select(`
                    *,
                    rack:w_vuestock_racks!w_articles_rack_id_fkey(rack_code, display_name),
                    level:w_vuestock_levels!w_articles_level_id_fkey(level_code),
                    slot:w_vuestock_slots!w_articles_slot_id_fkey(slot_code)
                `)
                .eq('code_barre', barcode)
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

            // Transformer les données
            const article = {
                ...articles[0],
                rack_code: articles[0].rack?.rack_code || '',
                rack_display_name: articles[0].rack?.display_name || '',
                level_code: articles[0].level?.level_code || '',
                slot_code: articles[0].slot?.slot_code || ''
            };

            console.log('Article trouvé:', article.nom);

            // SUCCÈS - Fermer le popup de scan
            stopScan();
            document.body.removeChild(popup);

            // Ouvrir le bon popup selon l'action
            switch(currentAction) {
                case 'sortie':
                    openStockOutPopup(article, true);
                    break;
                case 'entree':
                    openStockInPopup(article, true);
                    break;
                case 'reservation':
                    openProjectReservationPopup(article);
                    break;
            }

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

// ===== FONCTIONS UTILITAIRES POUR LES POPUPS =====
async function setupStockPopupEvents(popup, type, initialData) {
    // Fermeture
    popup.querySelector('.close-popup').addEventListener('click', () => {
        document.body.removeChild(popup);
    });

    popup.querySelector('.close-popup-btn').addEventListener('click', () => {
        document.body.removeChild(popup);
    });

    popup.addEventListener('click', (e) => {
        if (e.target === popup) {
            document.body.removeChild(popup);
        }
    });

    // Recherche dans le popup
    const searchBtn = popup.querySelector(`#${type}SearchBtn`);
    const searchInput = popup.querySelector(`#${type}SearchInput`);
    const scanBtn = popup.querySelector(`#${type}ScanBtn`);

    if (searchBtn && searchInput) {
        searchBtn.addEventListener('click', () => {
            searchArticleInPopup(searchInput.value, type);
        });

        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                searchArticleInPopup(searchInput.value, type);
            }
        });
    }

    if (scanBtn) {
        scanBtn.addEventListener('click', () => {
            document.body.removeChild(popup);
            openScanPopup(type, 'saisie');
        });
    }

    // Confirmation
    const confirmBtn = popup.querySelector(`#confirmStock${type === 'res' ? 'Reservation' : type === 'out' ? 'Out' : 'In'}Btn`);

    if (confirmBtn) {
        confirmBtn.addEventListener('click', async () => {
            await handleStockAction(type, popup, initialData);
        });
    }
}

async function searchArticleInPopup(searchTerm, type) {
    if (!searchTerm.trim()) {
        alert('Veuillez saisir un terme de recherche');
        return;
    }

    try {
        const { data: articles, error } = await supabase
            .from('w_articles')
            .select(`
                *,
                rack:w_vuestock_racks!w_articles_rack_id_fkey(rack_code, display_name),
                level:w_vuestock_levels!w_articles_level_id_fkey(level_code),
                slot:w_vuestock_slots!w_articles_slot_id_fkey(slot_code)
            `)
            .or(`nom.ilike.%${searchTerm}%,numero.ilike.%${searchTerm}%,code_barre.ilike.%${searchTerm}%`)
            .limit(5);

        if (error) throw error;

        // Transformer les données pour avoir les codes
        const transformedArticles = articles.map(article => ({
            ...article,
            rack_code: article.rack?.rack_code || '',
            rack_display_name: article.rack?.display_name || '',
            level_code: article.level?.level_code || '',
            slot_code: article.slot?.slot_code || ''
        }));

        const resultsDiv = document.querySelector(`#${type}SearchResults .results-list`);
        const container = document.getElementById(`${type}SearchResults`);

        if (!transformedArticles || transformedArticles.length === 0) {
            resultsDiv.innerHTML = '<div class="no-results">Aucun article trouvé</div>';
            container.style.display = 'block';
            return;
        }

        resultsDiv.innerHTML = transformedArticles.map(article => `
            <div class="result-item" data-id="${article.id}">
                <div class="result-info">
                    <h5>${article.nom}</h5>
                    <div class="result-details">
                        <span>${article.numero}</span>
                        <span>Stock: ${article.stock_actuel || 0}</span>
                        ${article.code_barre ? `<span>${article.code_barre}</span>` : ''}
                    </div>
                </div>
                <button class="btn-select-article" data-id="${article.id}">
                    <i class="fas fa-check"></i> Sélectionner
                </button>
            </div>
        `).join('');

        container.style.display = 'block';

        // Ajouter les événements de sélection
        document.querySelectorAll(`#${type}SearchResults .btn-select-article`).forEach(btn => {
            btn.addEventListener('click', function() {
                const articleId = this.dataset.id;
                const article = transformedArticles.find(a => a.id === articleId);

                // Fermer ce popup et ouvrir le popup correspondant avec l'article sélectionné
                const popup = document.querySelector('.stock-popup-overlay');
                if (popup) {
                    document.body.removeChild(popup);
                }

                switch(type) {
                    case 'out':
                        openStockOutPopup(article);
                        break;
                    case 'in':
                        openStockInPopup(article);
                        break;
                    case 'res':
                        openProjectReservationPopup(article);
                        break;
                }
            });
        });

    } catch (error) {
        console.error('Erreur recherche:', error);
        alert('Erreur lors de la recherche');
    }
}

async function loadProjectsForSelect(selectId) {
    try {
        const today = new Date().toISOString().split('T')[0];

        const { data: projets, error } = await supabase
            .from('w_projets')
            .select('id, nom, numero, date_fin_prevue, archived')
            .eq('actif', true)
            .or(`date_fin_prevue.is.null,date_fin_prevue.gte.${today}`) // Projets non terminés
            .order('nom');

        if (error) throw error;

        const select = document.getElementById(selectId);
        if (select) {
            select.innerHTML = '<option value="">Sélectionner un projet</option>';

            if (projets && projets.length > 0) {
                projets.forEach(projet => {
                    const option = document.createElement('option');
                    option.value = projet.id;

                    // Ajouter un indicateur si le projet est bientôt terminé
                    let statusInfo = '';
                    if (projet.date_fin_prevue) {
                        const daysLeft = calculateDaysLeft(projet.date_fin_prevue);
                        if (daysLeft <= 7) {
                            statusInfo = ` (${daysLeft}j restants)`;
                        }
                    }

                    option.textContent = `${projet.nom} ${projet.numero ? `(${projet.numero})` : ''}${statusInfo}`;
                    select.appendChild(option);
                });
            } else {
                const option = document.createElement('option');
                option.value = '';
                option.textContent = 'Aucun projet actif disponible';
                option.disabled = true;
                select.appendChild(option);
            }
        }

    } catch (error) {
        console.error('Erreur chargement projets:', error);
        const select = document.getElementById(selectId);
        if (select) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'Erreur lors du chargement des projets';
            option.disabled = true;
            select.innerHTML = '';
            select.appendChild(option);
        }
    }
}


// ===== CHARGEMENT DES EMPLOYÉS =====
async function loadEmployeesForSelect(selectId, defaultValue = null) {
    try {
        const select = document.getElementById(selectId);
        if (!select) return;

        // REQUÊTE SIMPLE ET DIRECTE
        const { data: users, error } = await supabase
            .from('w_users')
            .select('username')  // Juste le username
            .order('username');  // Tri alphabétique

        if (error) {
            console.error('Erreur chargement employés:', error);
            // Option de secours : met l'utilisateur courant
            select.innerHTML = `
                <option value="">Sélectionner un responsable...</option>
                <option value="${currentUser.username}" selected>${currentUser.username} (actuel)</option>
            `;
            return;
        }

        // CONSTRUIRE LE SELECT
        select.innerHTML = '<option value="">Sélectionner un responsable...</option>';

        if (users && users.length > 0) {
            users.forEach(user => {
                const option = document.createElement('option');
                option.value = user.username;
                option.textContent = user.username;

                // Sélectionner par défaut l'utilisateur courant
                if (defaultValue && user.username === defaultValue) {
                    option.selected = true;
                }

                select.appendChild(option);
            });

            // Si aucune option n'a été sélectionnée, sélectionner l'utilisateur courant
            if (defaultValue && !select.value) {
                const currentUserOption = Array.from(select.options)
                    .find(opt => opt.value === defaultValue);
                if (currentUserOption) {
                    currentUserOption.selected = true;
                }
            }
        }

    } catch (error) {
        console.error('Exception chargement employés:', error);
        // En cas d'erreur, au moins avoir une option
        const select = document.getElementById(selectId);
        if (select) {
            select.innerHTML = `
                <option value="${currentUser.username}" selected>${currentUser.username}</option>
            `;
        }
    }
}

async function handleStockAction(type, popup, initialData) {
    try {
        // Récupérer les données du formulaire
        const articleId = initialData?.articleId || null;
        const quantity = parseInt(document.getElementById(`${type}Quantity`).value) || 0;

        if (!articleId) {
            alert('Veuillez sélectionner un article');
            return;
        }

        if (quantity <= 0) {
            alert('La quantité doit être positive');
            return;
        }

        // 1. RÉCUPÉRER L'ARTICLE POUR AVOIR LES STOCKS
        const { data: article, error: articleError } = await supabase
            .from('w_articles')
            .select('stock_actuel, stock_reserve')
            .eq('id', articleId)
            .single();

        if (articleError) throw articleError;

        const stockAvant = article.stock_actuel || 0;
        const reserveAvant = article.stock_reserve || 0;
        let stockApres = stockAvant;
        let reserveApres = reserveAvant;

        // 2. CALCULER LES NOUVEAUX STOCKS
        switch(type) {
            case 'out':
                stockApres = Math.max(0, stockAvant - quantity);
                break;
            case 'in':
                stockApres = stockAvant + quantity;
                break;
            case 'res':
                reserveApres = reserveAvant + quantity;
                break;
        }

        // VARIABLES POUR RÉSERVATION (utilisées plus bas)
        let resProjectId = '';
        let resProjectName = '';
        let motif = '';
        let notes = '';
        let responsable = '';
        let dateDebut = null;
        let dateFin = null;

        // 3. PRÉPARER LES DONNÉES DU MOUVEMENT
        let mouvementData = {
            article_id: articleId,
            type: type === 'out' ? 'sortie' : type === 'in' ? 'entree' : 'reservation',
            quantite: quantity,
            stock_avant: stockAvant,
            stock_apres: stockApres,
            stock_reserve_avant: reserveAvant,
            stock_reserve_apres: reserveApres,
            utilisateur: currentUser.username || currentUser.email,
            utilisateur_id: currentUser.id,
            date_mouvement: dateFr,
            heure_mouvement: timeFr,
            created_at: new Date().toISOString()
        };

        // 4. AJOUTER LES CHAMPS SPÉCIFIQUES
        switch(type) {
            case 'out':
                const outProjectSelect = document.getElementById('outProject');
                const outProjectId = outProjectSelect?.value || '';
                const outProjectText = outProjectSelect?.options[outProjectSelect.selectedIndex]?.text || '';
                const outProjectName = outProjectText.split(' (')[0] || outProjectText;

                // CORRECTION : Convertir "" en null
                mouvementData.projet = outProjectName || null;
                mouvementData.projet_id = outProjectId || null; // ← "" devient null

                mouvementData.raison = document.getElementById('outReason').value || '';
                mouvementData.commentaire = document.getElementById('outNotes').value || '';
                mouvementData.notes = document.getElementById('outNotes').value || '';
                break;

            case 'in':
                mouvementData.raison = document.getElementById('inReason').value || '';
                mouvementData.commentaire = document.getElementById('inNotes').value || '';
                mouvementData.notes = document.getElementById('inNotes').value || '';

                // CHAMPS POUR ENTREES
                mouvementData.fournisseur = document.getElementById('inSupplier').value || null;
                mouvementData.bon_commande = document.getElementById('inPurchaseOrder').value || null;

                const prixUnitaireInput = document.getElementById('inUnitPrice');
                mouvementData.prix_unitaire = prixUnitaireInput?.value ? parseFloat(prixUnitaireInput.value) : null;

                mouvementData.emplacement = document.getElementById('inLocation').value || null;
                break;

            case 'res':
                const resProjectSelect = document.getElementById('resProject');
                resProjectId = resProjectSelect?.value || '';
                const resProjectText = resProjectSelect?.options[resProjectSelect.selectedIndex]?.text || '';
                resProjectName = resProjectText.split(' (')[0] || resProjectText;

                motif = document.getElementById('resPurpose').value || null;
                notes = document.getElementById('resNotes').value || '';
                responsable = document.getElementById('resResponsible').value || null;
                dateDebut = document.getElementById('resStartDate').value || null;
                dateFin = document.getElementById('resEndDate').value || null;

                mouvementData.projet = resProjectName;
                mouvementData.projet_id = resProjectId;
                mouvementData.commentaire = notes;
                mouvementData.notes = notes;
                mouvementData.date_debut = dateDebut;
                mouvementData.date_fin = dateFin;
                mouvementData.motif = motif;
                mouvementData.responsable = responsable;
                break;
        }

        // 5. VALIDATIONS SUPPLÉMENTAIRES
        if (type === 'out' && quantity > stockAvant) {
            alert(`Stock insuffisant ! Stock disponible: ${stockAvant}`);
            return;
        }

        // 6. ENREGISTRER LE MOUVEMENT
        const { data: mouvement, error: mouvementError } = await supabase
            .from('w_mouvements')
            .insert([mouvementData]);

        if (mouvementError) {
            console.error('Erreur insertion mouvement:', mouvementError);
            throw new Error(`Erreur enregistrement: ${mouvementError.message}`);
        }

        // 7. SI C'EST UNE RÉSERVATION, FAIRE UN UPSERT DANS w_reservations_actives
        if (type === 'res') {
            let existingReservation = null;

            // Vérifier d'abord si une réservation existe déjà pour cet article et ce projet
            try {
                const { data, error } = await supabase
                    .from('w_reservations_actives')
                    .select('id, quantite, notes, date_debut, date_fin, motif, responsable, created_at')
                    .eq('article_id', articleId)
                    .eq('projet_id', resProjectId);

                if (error) throw error;

                // Si on a des résultats, prendre le premier
                if (data && data.length > 0) {
                    existingReservation = data[0];
                }
            } catch (checkError) {
                console.error('Erreur vérification réservation existante:', checkError);
                // On continue quand même avec l'insertion
            }

            let nouvelleQuantite = quantity;
            let nouvellesNotes = notes;

            // Si une réservation existe déjà, additionner les quantités et fusionner les notes
            if (existingReservation) {
                nouvelleQuantite = existingReservation.quantite + quantity;

                // Fusionner les notes intelligemment
                const dateAjout = new Date().toLocaleDateString('fr-FR');
                const heureAjout = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

                if (existingReservation.notes && notes) {
                    nouvellesNotes = `${existingReservation.notes}\n\n--- Ajout le ${dateAjout} à ${heureAjout} ---\n${notes}`;
                } else if (existingReservation.notes) {
                    nouvellesNotes = existingReservation.notes;
                } else if (notes) {
                    nouvellesNotes = `--- Créé le ${dateAjout} à ${heureAjout} ---\n${notes}`;
                }

                // Garder les valeurs existantes si les nouvelles sont vides
                dateDebut = dateDebut || existingReservation.date_debut;
                dateFin = dateFin || existingReservation.date_fin;
                motif = motif || existingReservation.motif;
                responsable = responsable || existingReservation.responsable;

                console.log(`Réservation existante trouvée: ${existingReservation.quantite} → ${nouvelleQuantite} unités`);
            }

            const reservationData = {
                article_id: articleId,
                projet_id: resProjectId,
                quantite: nouvelleQuantite,
                date_debut: dateDebut,
                date_fin: dateFin,
                motif: motif,
                notes: nouvellesNotes,
                responsable: responsable,
                utilisateur_id: currentUser.id,
                statut: 'active',
                created_at: existingReservation ?
                    existingReservation.created_at || new Date().toISOString().split('T')[0] :
                    new Date().toISOString().split('T')[0],
                updated_at: new Date().toISOString() // Pour le tracking
            };

            let reservationError;

            if (existingReservation) {
                // MISE À JOUR de la réservation existante
                const { error } = await supabase
                    .from('w_reservations_actives')
                    .update(reservationData)
                    .eq('id', existingReservation.id);
                reservationError = error;
            } else {
                // INSERTION nouvelle réservation
                const { error } = await supabase
                    .from('w_reservations_actives')
                    .insert([reservationData]);
                reservationError = error;
            }

            if (reservationError) {
                console.error('Erreur upsert réservation:', reservationError);

                // Si c'est une erreur de contrainte d'unicité, essayer l'update
                if (reservationError.code === '23505') {
                    try {
                        // Récupérer l'ID de la réservation existante
                        const { data: reservation, error: fetchError } = await supabase
                            .from('w_reservations_actives')
                            .select('id, quantite, notes')
                            .eq('article_id', articleId)
                            .eq('projet_id', resProjectId);

                        if (!fetchError && reservation && reservation.length > 0) {
                            const existing = reservation[0];
                            const { error: updateError } = await supabase
                                .from('w_reservations_actives')
                                .update({
                                    quantite: existing.quantite + quantity,
                                    notes: nouvellesNotes,
                                    updated_at: new Date().toISOString()
                                })
                                .eq('id', existing.id);

                            if (updateError) {
                                throw new Error(`Erreur mise à jour réservation: ${updateError.message}`);
                            }
                        } else {
                            throw new Error(`Erreur récupération réservation: ${fetchError?.message || 'Inconnue'}`);
                        }
                    } catch (fallbackError) {
                        console.error('Erreur fallback:', fallbackError);
                        throw new Error(`Erreur création réservation: ${reservationError.message}`);
                    }
                } else {
                    throw new Error(`Erreur création réservation: ${reservationError.message}`);
                }
            }

            // Informer l'utilisateur si on a mis à jour une réservation existante
            if (existingReservation) {
                console.log(`Réservation mise à jour: ${existingReservation.quantite} → ${nouvelleQuantite} unités`);
            }
        }

        // 8. METTRE À JOUR LE STOCK DE L'ARTICLE
        let updates = {};

        if (type === 'out') {
            updates.stock_actuel = stockApres;
        } else if (type === 'in') {
            updates.stock_actuel = stockApres;

            // Mettre à jour le prix unitaire si fourni
            const prixUnitaireInput = document.getElementById('inUnitPrice');
            if (prixUnitaireInput?.value) {
                updates.prix_unitaire = parseFloat(prixUnitaireInput.value);
            }
        } else if (type === 'res') {
            updates.stock_reserve = reserveApres;
        }

        const { error: updateError } = await supabase
            .from('w_articles')
            .update(updates)
            .eq('id', articleId);

        if (updateError) throw updateError;

        // 9. SUCCÈS
        showTemporarySuccess(`${type === 'out' ? 'Sortie' : type === 'in' ? 'Entrée' : 'Réservation'} enregistrée avec succès !`);
        document.body.removeChild(popup);

        // 10. RE-RAFRACHIR LES DONNÉES
        await loadPageData();

    } catch (error) {
        console.error(`Erreur ${type} stock:`, error);
        alert(`Erreur lors de l'enregistrement: ${error.message || 'Erreur inconnue'}`);
    }
}

// ===== FONCTIONS UTILITAIRES =====
function showLoading() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'flex';
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

async function exportStockBasPDF() {
    try {
        console.log('Début export PDF stock bas...');

        // Vérification jsPDF - NOTE: c'est window.jspdf (minuscule)
        if (!window.jspdf || typeof window.jspdf.jsPDF === 'undefined') {
            console.error('jsPDF non trouvé:', window.jspdf);
            alert('Erreur : Bibliothèque PDF non chargée. Veuillez rafraîchir la page et vérifier la connexion.');
            return;
        }

        // Récupérer les données du stock bas
        console.log('Récupération des données depuis Supabase...');
        const { data: articles, error } = await supabase
            .from('w_articles')
            .select('nom, numero, stock_actuel, stock_minimum, stock_reserve')
            .gt('stock_minimum', 0)
            .order('nom');

        if (error) throw error;

        console.log(`${articles?.length || 0} articles récupérés`);

        // Filtrer les articles en stock bas
        const stockBas = articles.filter(article => {
            const disponible = article.stock_actuel - article.stock_reserve;
            return disponible > 0 && disponible <= article.stock_minimum;
        });

        console.log(`${stockBas.length} articles en stock bas`);

        if (stockBas.length === 0) {
            alert('Aucun article en stock bas à exporter');
            return;
        }

        // Créer le PDF - IMPORTANT: utiliser window.jspdf.jsPDF
        console.log('Création du PDF...');
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // Vérifier autoTable
        if (typeof doc.autoTable === 'undefined') {
            throw new Error('Extension autoTable non disponible');
        }

        // Le reste de ton code reste identique...
        const pageWidth = doc.internal.pageSize.width;
        const margin = 20;
        let yPosition = margin;

        // En-tête
        doc.setFontSize(20);
        doc.setTextColor(230, 126, 34);
        doc.text('Rapport Stock Bas', pageWidth / 2, yPosition, { align: 'center' });

        doc.setFontSize(11);
        doc.setTextColor(100, 100, 100);
        yPosition += 10;
        doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, pageWidth / 2, yPosition, { align: 'center' });

        doc.setTextColor(0, 0, 0);
        yPosition += 15;

        // Tableau
        const headers = [['Article', 'N°', 'Disponible', 'Minimum', 'Différence']];
        const data = stockBas.map(article => {
            const disponible = article.stock_actuel - article.stock_reserve;
            const diff = disponible - article.stock_minimum;

            return [
                article.nom,
                article.numero || '-',
                `${disponible} (Stock: ${article.stock_actuel}, Réservé: ${article.stock_reserve})`,
                article.stock_minimum,
                diff
            ];
        });

        // Enlève complètement columnStyles et laisse autoTable gérer :
        doc.autoTable({
            startY: yPosition,
            head: headers,
            body: data,
            theme: 'grid',
            headStyles: { fillColor: [231, 76, 60] },
            // Pas de columnStyles, autoTable s'adapte automatiquement
            margin: { left: 10, right: 10 }, // Marge réduite
            tableWidth: 'auto'
        });

        // Pied de page
        const finalY = doc.lastAutoTable.finalY + 10;
        doc.setFontSize(10);
        doc.setTextColor(150, 150, 150);
        doc.text(`Total: ${stockBas.length} article(s) en stock bas`, margin, finalY);

        // Sauvegarder le PDF
        console.log('Sauvegarde du PDF...');
        const filename = `stock_bas_${new Date().toISOString().split('T')[0]}.pdf`;
        doc.save(filename);

        console.log('Export PDF terminé avec succès:', filename);

    } catch (error) {
        console.error('Erreur export PDF stock bas:', error);
        alert(`Erreur lors de l'export PDF: ${error.message || 'Erreur inconnue'}`);
    }
}

async function exportRupturePDF() {
    try {
        console.log('Début export PDF ruptures...');

        // Vérification jsPDF - NOTE: c'est window.jspdf (minuscule)
        if (!window.jspdf || typeof window.jspdf.jsPDF === 'undefined') {
            console.error('jsPDF non trouvé:', window.jspdf);
            alert('Erreur : Bibliothèque PDF non chargée. Veuillez rafraîchir la page et vérifier la connexion.');
            return;
        }

        // Récupérer les articles
        console.log('Récupération des données depuis Supabase...');
        const { data: articles, error } = await supabase
            .from('w_articles')
            .select('nom, numero, stock_actuel, stock_reserve, updated_at')
            .order('nom');

        if (error) throw error;

        console.log(`${articles?.length || 0} articles récupérés`);

        // Filtrer les ruptures
        const ruptures = articles.filter(article => {
            const disponible = article.stock_actuel - article.stock_reserve;
            return disponible <= 0;
        });

        console.log(`${ruptures.length} articles en rupture`);

        if (ruptures.length === 0) {
            alert('Aucune rupture de stock à exporter');
            return;
        }

        // Créer le PDF - IMPORTANT: utiliser window.jspdf.jsPDF
        console.log('Création du PDF...');
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // Vérifier autoTable
        if (typeof doc.autoTable === 'undefined') {
            throw new Error('Extension autoTable non disponible');
        }

        const pageWidth = doc.internal.pageSize.width;
        const margin = 20;
        let yPosition = margin;

        // En-tête
        doc.setFontSize(20);
        doc.setTextColor(231, 76, 60); // Rouge
        doc.text('Rapport Ruptures de Stock', pageWidth / 2, yPosition, { align: 'center' });

        doc.setFontSize(11);
        doc.setTextColor(100, 100, 100);
        yPosition += 10;
        doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, pageWidth / 2, yPosition, { align: 'center' });

        doc.setTextColor(0, 0, 0);
        yPosition += 15;

        // Tableau
        const headers = [['Article', 'N°', 'Stock', 'Réservé', 'Disponible']];
        const data = ruptures.map(article => {
            const disponible = article.stock_actuel - article.stock_reserve;
            const lastUpdate = article.updated_at ?
                new Date(article.updated_at).toLocaleDateString('fr-FR') : '-';

            return [
                article.nom,
                article.numero || '-',
                article.stock_actuel,
                article.stock_reserve,
                `${disponible} (${disponible < 0 ? 'Déficit' : 'Rupture'})`
            ];
        });

        // Enlève complètement columnStyles et laisse autoTable gérer :
        doc.autoTable({
            startY: yPosition,
            head: headers,
            body: data,
            theme: 'grid',
            headStyles: { fillColor: [231, 76, 60] },
            // Pas de columnStyles, autoTable s'adapte automatiquement
            margin: { left: 10, right: 10 }, // Marge réduite
            tableWidth: 'auto'
        });

        // Pied de page
        const finalY = doc.lastAutoTable.finalY + 10;
        doc.setFontSize(10);
        doc.setTextColor(150, 150, 150);
        doc.text(`Total: ${ruptures.length} article(s) en rupture`, margin, finalY);

        // Message d'urgence
        doc.setFontSize(12);
        doc.setTextColor(231, 76, 60);
        doc.text('⚠️ COMMANDE URGENTE REQUISE ⚠️', pageWidth / 2, finalY + 15, { align: 'center' });

        // Sauvegarder le PDF
        console.log('Sauvegarde du PDF...');
        const filename = `ruptures_stock_${new Date().toISOString().split('T')[0]}.pdf`;
        doc.save(filename);

        console.log('Export PDF terminé avec succès:', filename);

    } catch (error) {
        console.error('Erreur export PDF ruptures:', error);

        // Messages d'erreur plus clairs
        let message = 'Erreur lors de l\'export PDF';
        if (error.message.includes('jsPDF') || error.message.includes('Bibliothèque')) {
            message = 'Erreur : Bibliothèque PDF non chargée. Veuillez rafraîchir la page.';
        } else if (error.message.includes('Supabase') || error.code) {
            message = `Erreur de connexion : ${error.message || 'Impossible de récupérer les données'}`;
        }

        alert(message);
    }
}


// ===== UTILITAIRES =====
function updateLastSync() {
    const now = new Date();
    const options = {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    };

    const formattedDate = now.toLocaleDateString('fr-FR', options);
    document.getElementById('lastSync').textContent = `Dernière synchro: ${formattedDate}`;
}

function logout() {
    // Demander confirmation
    if (!confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
        return;
    }

    // Nettoyer la session
    sessionStorage.removeItem('current_user');
    sessionStorage.removeItem('supabase_token');

    // Rediriger vers la page de connexion
    window.location.href = 'connexion.html';
}

// ===== STYLES DYNAMIQUES =====
// Ajouter le style pour le texte en rouge
const style = document.createElement('style');
style.textContent = `
    .text-danger { color: var(--danger-color); font-weight: 600; }
`;
document.head.appendChild(style);

// ============================================
// VUE QUAD POUR ACCUEIL - CODE DE PRODUCTION
// ============================================

// Utiliser exactement le même ApiManager que vuestock.js
class AccueilQuadManager {
    constructor() {
        console.log('🎯 Initialisation AccueilQuadManager');

        // Références aux éléments HTML
        this.canvasTop = document.getElementById('accueilCanvasTop');
        this.canvasFront = document.getElementById('accueilCanvasFront');
        this.drawerContainer = document.getElementById('accueilDrawer');

        if (!this.canvasTop || !this.canvasFront || !this.drawerContainer) {
            console.error('❌ Éléments QuadView non trouvés dans accueil.html');
            return;
        }

        // Contextes canvas
        this.ctxTop = this.canvasTop.getContext('2d');
        this.ctxFront = this.canvasFront.getContext('2d');

        // Données
        this.racks = [];
        this.selectedRack = null;
        this.selectedLevel = null;

        // Variables pour le dessin
        this.gridSize = 20;
        this.rackHeightPerLevel = 40;
        this.slotSize = 60;

        // Initialiser
        this.init();
    }

    async init() {
        console.log('🔧 Configuration AccueilQuadManager');

        // 1. Ajuster les dimensions des canvas
        this.resizeCanvases();
        window.addEventListener('resize', () => this.resizeCanvases());

        // 2. Charger les données RÉELLES depuis l'API
        await this.loadRealData();

        // 4. Dessiner l'état initial
        this.drawAllViews();

        console.log('✅ AccueilQuadManager prêt');
    }

    showAllSlotsForLevel(level) {
        this.selectedLevel = level;
        // Réafficher tous les slots (comme avant)
        this.updateDrawer(level);
    }

    async loadRealData() {
        try {
            console.log('📡 Chargement des racks depuis Supabase...');

            // Charger seulement les données (sans afficher)
            const { data: racks, error: racksError } = await supabase
                .from('w_vuestock_racks')
                .select(`
                    *,
                    w_vuestock_levels (
                        id,
                        level_code,
                        display_order,
                        rack_id,
                        w_vuestock_slots (
                            id,
                            slot_code,
                            level_id,
                            display_order,
                            status,
                            full_code
                        )
                    )
                `)
                .order('rack_code');

            if (racksError) throw racksError;

            const { data: allArticles, error: articlesError } = await supabase
                .from('w_articles')
                .select('*')
                .not('slot_id', 'is', null);

            if (articlesError) throw articlesError;

            // Stocker les données SANS les afficher
            if (racks && allArticles) {
                this.racks = racks.map(rack => {
                    const levelsWithSlots = rack.w_vuestock_levels?.map(level => {
                        const slotsWithArticles = level.w_vuestock_slots?.map(slot => {
                            const articleInSlot = allArticles.find(article =>
                                article.slot_id === slot.id &&
                                article.level_id === level.id &&
                                article.rack_id === rack.id
                            );

                            return {
                                ...slot,
                                code: slot.slot_code,
                                articles: articleInSlot ? [articleInSlot] : []
                            };
                        }) || [];

                        return {
                            ...level,
                            code: level.level_code,
                            slots: slotsWithArticles
                        };
                    }) || [];

                    return {
                        ...rack,
                        code: rack.rack_code,
                        name: rack.display_name,
                        color: rack.color || '#4a90e2', // <-- GARDEZ LA COULEUR
                        levels: levelsWithSlots
                    };
                });

                console.log(`✅ ${this.racks.length} racks chargés (non affichés)`);

                // NE PAS DESSINER - laisser les canvas vides
                this.clearAllViews();
            }

        } catch (error) {
            console.error('❌ Erreur chargement:', error);
        }
    }

    clearAllViews() {
        // 1. Vue du dessus - canvas blanc
        if (this.ctxTop && this.canvasTop) {
            this.ctxTop.clearRect(0, 0, this.canvasTop.width, this.canvasTop.height);
            this.ctxTop.fillStyle = '#f8f9fa';
            this.ctxTop.fillRect(0, 0, this.canvasTop.width, this.canvasTop.height);
            this.ctxTop.fillStyle = '#6c757d';
            this.ctxTop.font = '14px Arial';
            this.ctxTop.textAlign = 'center';
            this.ctxTop.fillText('Effectuez une recherche pour localiser un article',
                               this.canvasTop.width/2, this.canvasTop.height/2);
        }

        // 2. Vue de face - canvas blanc
        if (this.ctxFront && this.canvasFront) {
            this.ctxFront.clearRect(0, 0, this.canvasFront.width, this.canvasFront.height);
            this.ctxFront.fillStyle = '#f8f9fa';
            this.ctxFront.fillRect(0, 0, this.canvasFront.width, this.canvasFront.height);
            this.ctxFront.fillStyle = '#6c757d';
            this.ctxFront.font = '14px Arial';
            this.ctxFront.textAlign = 'center';
            this.ctxFront.fillText('Sélectionnez un article dans les résultats',
                                 this.canvasFront.width/2, this.canvasFront.height/2);
        }

        // 3. Détail étage - vide
        if (this.drawerContainer) {
            this.drawerContainer.innerHTML = `
                <div class="empty-drawer-state">
                    <div class="drawer-front-placeholder">
                        <i class="fas fa-search fa-3x"></i>
                        <p>Recherchez un article pour voir son emplacement</p>
                    </div>
                </div>
            `;
        }

        // 4. Réinitialiser les sélections
        this.selectedRack = null;
        this.selectedLevel = null;
        document.getElementById('accueilSelectedRack').textContent = 'Aucun rack sélectionné';
        document.getElementById('accueilLevelInfo').textContent = 'Aucun étage';
    }

    normalizeRackData() {
        // Normaliser les données comme dans QuadViewManager
        this.racks.forEach(rack => {
            // S'assurer que les propriétés existent
            rack.displayX = rack.position_x || 0;
            rack.displayY = rack.position_y || 0;
            rack.displayWidth = (rack.width || 3) * this.gridSize;
            rack.displayHeight = (rack.depth || 2) * this.gridSize;
            rack.rotation = rack.rotation || 0;

            // Normaliser les niveaux
            if (rack.levels) {
                rack.levels.forEach(level => {
                    level.code = level.level_code || level.code;

                    // Normaliser les emplacements
                    if (level.slots) {
                        level.slots.forEach(slot => {
                            slot.code = slot.slot_code || slot.code;
                        });
                    }
                });
            }
        });
    }

    connectToRealSearchSystem() {
        console.log('🔗 Connexion au système de recherche...');

        // 1. Recherche par nom (votre système existant)
        const searchNomBtn = document.getElementById('searchNomBtn');
        const searchNomInput = document.getElementById('searchNomInput');

        if (searchNomBtn && searchNomInput) {
            searchNomBtn.addEventListener('click', async () => {
                await this.handleRealSearch(searchNomInput.value, 'nom');
            });

            searchNomInput.addEventListener('keypress', async (e) => {
                if (e.key === 'Enter') {
                    await this.handleRealSearch(searchNomInput.value, 'nom');
                }
            });
        }

        // 2. Recherche par code-barre (votre système existant)
        const searchCodebarreBtn = document.getElementById('searchCodebarreBtn');
        const searchCodebarreInput = document.getElementById('searchCodebarreInput');

        if (searchCodebarreBtn && searchCodebarreInput) {
            searchCodebarreBtn.addEventListener('click', async () => {
                await this.handleRealSearch(searchCodebarreInput.value, 'codebarre');
            });

            searchCodebarreInput.addEventListener('keypress', async (e) => {
                if (e.key === 'Enter') {
                    await this.handleRealSearch(searchCodebarreInput.value, 'codebarre');
                }
            });
        }
    }

    highlightArticleLocation(fullCode) {
        // Parser le code complet: A-10-20
        const parts = fullCode.split('-');
        if (parts.length !== 3) {
            console.error('Format de code invalide:', fullCode);
            return;
        }

        const [rackCode, levelCode, slotCode] = parts;

        // 1. Trouver le rack
        const rack = this.racks.find(r => r.code === rackCode);
        if (!rack) {
            console.error(`Rack ${rackCode} non trouvé`);
            this.showNotification(`Rack ${rackCode} non trouvé`, 'error');
            return;
        }

        // 2. Sélectionner le rack
        this.selectRack(rack);

        // 3. Trouver le niveau
        const level = rack.levels?.find(l => l.code === levelCode);
        if (!level) {
            console.error(`Étage ${levelCode} non trouvé dans rack ${rackCode}`);
            this.showNotification(`Étage ${levelCode} non trouvé`, 'error');
            return;
        }

        // 4. Sélectionner le niveau
        this.selectLevel(level);

        // 5. Mettre à jour le tiroir avec mise en évidence
        this.updateDrawerWithHighlight(level, slotCode);

        // 6. Ajouter effet visuel
        this.addHighlightEffect(rack, level, slotCode);
    }

    selectRack(rack) {
        this.selectedRack = rack;
        this.selectedLevel = null;

        document.getElementById('accueilSelectedRack').textContent =
            `Rack ${rack.code}`;

        // Dessiner avec surbrillance
        this.drawTopView();
        this.drawFrontView();
    }

    selectLevel(level) {
        this.selectedLevel = level;

        document.getElementById('accueilLevelInfo').textContent =
            `Étage ${level.code} - ${level.slots?.length || 0} emplacements`;

        // Mettre à jour le tiroir
        this.updateDrawer(level); // <-- IMPORTANT
    }

    drawAllViews() {
        this.drawTopView();

        if (this.selectedRack) {
            this.drawFrontView();
        }

        if (this.selectedLevel) {
            this.updateDrawer(this.selectedLevel);
        }
    }

    showSingleArticleLocation(article) {
        console.log('🎯 Affichage UNIQUE de l\'article:', article.nom);

        // 1. Trouver l'emplacement (sans changer les sélections)
        if (!article.rack_id || !article.level_id || !article.slot_id) {
            console.warn('Article sans localisation');
            return false;
        }

        const rack = this.racks.find(r => r.id === article.rack_id);
        if (!rack) return false;

        const level = rack.levels?.find(l => l.id === article.level_id);
        if (!level) return false;

        const slot = level.slots?.find(s => s.id === article.slot_id);
        if (!slot) return false;

        // 2. Afficher UNIQUEMENT les vues (sans modifier l'état interne)
        this.drawSingleRack(rack);
        this.drawSingleLevel(rack, level);
        this.updateSingleSlotView(level, slot, article, rack);

        // 3. MAIS NE PAS changer les sélections globales
        // this.selectedRack = rack;     // <-- NE PAS FAIRE
        // this.selectedLevel = level;   // <-- NE PAS FAIRE

        console.log(`✅ Affichage unique: ${rack.code}-${level.code}-${slot.code}`);
        return true;
    }

    drawTopView() {
        if (!this.ctxTop) return;

        const ctx = this.ctxTop;
        const width = this.canvasTop.width;
        const height = this.canvasTop.height;

        // Effacer
        ctx.clearRect(0, 0, width, height);

        // Dessiner la grille
        this.drawGrid(ctx, width, height, this.gridSize);

        // Calculer la position de départ (centré)
        const totalRackWidth = this.racks.reduce((sum, rack) =>
            sum + rack.displayWidth + 40, 0);
        let currentX = Math.max(20, (width - totalRackWidth) / 2);
        const startY = height / 2 - 40;

        // Dessiner chaque rack
        this.racks.forEach(rack => {
            const x = currentX;
            const y = startY;
            const w = rack.displayWidth;
            const h = rack.displayHeight;

            // Mettre à jour les coordonnées d'affichage
            rack.displayX = x;
            rack.displayY = y;

            // Couleur
            ctx.fillStyle = rack === this.selectedRack ? '#ffc107' : (rack.color || '#4a90e2');
            ctx.fillRect(x, y, w, h);

            // Bordure
            ctx.strokeStyle = rack === this.selectedRack ? '#fd7e14' : '#333';
            ctx.lineWidth = rack === this.selectedRack ? 3 : 2;
            ctx.strokeRect(x, y, w, h);

            // Code du rack
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(rack.code, x + w/2, y + h/2);

            // Avancer pour le prochain rack
            currentX += w + 40;
        });
    }

    drawFrontView() {
        if (!this.ctxFront || !this.selectedRack) return;

        const ctx = this.ctxFront;
        const width = this.canvasFront.width;
        const height = this.canvasFront.height;

        // Effacer
        ctx.clearRect(0, 0, width, height);

        const rack = this.selectedRack;
        const rackWidth = (rack.width || 3) * 30;
        const startX = (width - rackWidth) / 2;
        const startY = height - 20;

        // Base du rack
        ctx.fillStyle = rack.color || '#4a90e2';
        ctx.fillRect(startX, startY - 10, rackWidth, 10);

        // Niveaux (du bas vers le haut)
        if (rack.levels && rack.levels.length) {
            const levels = [...rack.levels].sort((a, b) => a.display_order - b.display_order);
            let currentY = startY - 10;

            levels.forEach(level => {
                const levelHeight = this.rackHeightPerLevel;
                const isSelected = level === this.selectedLevel;

                // Étage
                ctx.fillStyle = isSelected ? '#ffc107' : '#adb5bd';
                ctx.fillRect(startX, currentY - levelHeight, rackWidth, levelHeight);

                // Séparateur
                ctx.strokeStyle = '#495057';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(startX, currentY - levelHeight);
                ctx.lineTo(startX + rackWidth, currentY - levelHeight);
                ctx.stroke();

                // Code de l'étage
                ctx.fillStyle = isSelected ? '#000' : '#fff';
                ctx.font = 'bold 12px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(level.code, startX + rackWidth/2, currentY - levelHeight/2);

                currentY -= levelHeight;
            });
        }
    }

    updateDrawer(level) {
        if (!this.drawerContainer) return;

        let html = '';

        if (!level.slots || level.slots.length === 0) {
            html = `
                <div class="empty-drawer-message">
                    <i class="fas fa-box-open"></i>
                    <p>Aucun emplacement dans cet étage</p>
                </div>
            `;
        } else {
            // Trier les emplacements par code
            const sortedSlots = [...level.slots].sort((a, b) =>
                parseInt(a.code) - parseInt(b.code));

            // Calculer la classe de zoom
            const slotCount = sortedSlots.length;
            let zoomClass = 'zoom-large';
            if (slotCount > 14) zoomClass = 'zoom-small';
            else if (slotCount > 9) zoomClass = 'zoom-medium';

            html = '<div class="quad-slot-grid">';

            sortedSlots.forEach(slot => {
                const article = slot.articles && slot.articles.length > 0 ? slot.articles[0] : null;
                const hasArticle = !!article;
                const stockLevel = this.getStockLevel(article);

                html += `
                    <div class="quad-slot ${zoomClass} ${hasArticle ? 'occupied ' + stockLevel : ''}"
                         data-slot-code="${slot.code}"
                         title="${this.generateSlotTooltip(slot, article)}">
                        ${this.generateSlotContent(slot, article, zoomClass)}
                    </div>
                `;
            });

            html += '</div>';
        }

        this.drawerContainer.innerHTML = html;
    }

    updateDrawerWithHighlight(level, highlightedSlotCode, article) {
        if (!this.drawerContainer) return;

        // 1. Trouver le slot spécifique
        const slot = level.slots?.find(s => s.code === highlightedSlotCode);
        if (!slot) return;

        // 2. N'afficher que CE slot (pas tous)
        let html = `
            <div class="single-slot-view">
                <div class="slot-header">
                    <h4>Emplacement ${slot.full_code || `${level.code}-${slot.code}`}</h4>
                    <div class="slot-location">
                        <span class="rack-badge">Rack ${this.selectedRack.code}</span>
                        <span class="level-badge">Étage ${level.code}</span>
                        <span class="slot-badge">Slot ${slot.code}</span>
                    </div>
                </div>

                <div class="slot-content-large">
        `;

        // 3. Afficher l'article s'il y en a un
        const articleInSlot = slot.articles?.[0] || article;

        if (articleInSlot) {
            const imageUrl = articleInSlot.photo_url || articleInSlot.photo ||
                'https://via.placeholder.com/150x150/cccccc/666666?text=📦';
            const articleName = articleInSlot.nom || articleInSlot.name || 'Article';
            const stock = articleInSlot.stock_actuel || articleInSlot.quantity || 0;

            html += `
                <div class="article-display">
                    <div class="article-image-large">
                        <img src="${imageUrl}" alt="${articleName}"
                             onerror="this.src='https://via.placeholder.com/150x150/cccccc/666666?text=📦'">
                    </div>
                    <div class="article-info-large">
                        <h5>${articleName}</h5>
                        <div class="article-details">
                            <div class="detail-item">
                                <span class="detail-label">Numéro:</span>
                                <span class="detail-value">${articleInSlot.numero || 'N/A'}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Stock:</span>
                                <span class="detail-value ${stock === 0 ? 'stock-zero' : (stock <= (articleInSlot.stock_minimum || 3) ? 'stock-low' : 'stock-good')}">
                                    ${stock} unités
                                </span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Code-barres:</span>
                                <span class="detail-value">${articleInSlot.code_barre || 'N/A'}</span>
                            </div>
                            ${articleInSlot.prix_unitaire ? `
                            <div class="detail-item">
                                <span class="detail-label">Prix:</span>
                                <span class="detail-value">${articleInSlot.prix_unitaire}€</span>
                            </div>` : ''}
                        </div>
                    </div>
                </div>
            `;
        } else {
            html += `
                <div class="empty-slot-large">
                    <i class="fas fa-box-open fa-4x"></i>
                    <p>Emplacement vide</p>
                </div>
            `;
        }

        html += `
                </div>
                <div class="slot-footer">
                    <button class="btn btn-sm btn-secondary" onclick="window.accueilQuadManager.showAllSlotsForLevel(${JSON.stringify(level)})">
                        <i class="fas fa-th-large"></i> Voir tous les emplacements
                    </button>
                </div>
            </div>
        `;

        this.drawerContainer.innerHTML = html;
    }

    getStockLevel(article) {
        if (!article) return '';

        const stockActuel = article.stock_actuel || article.quantity || 0;
        const stockMinimum = article.stock_minimum || 3;

        if (stockActuel === 0) return 'stock-zero';
        if (stockActuel <= stockMinimum) return 'stock-low';
        return 'stock-good';
    }

    generateSlotTooltip(slot, article) {
        const baseText = `Emplacement ${slot.code}`;

        if (!article) return `${baseText} - Libre`;

        const stockActuel = article.stock_actuel || article.quantity || 0;
        const stockMinimum = article.stock_minimum || 3;
        const articleName = article.nom || article.name || 'Article';

        let status = '';
        if (stockActuel === 0) status = 'Stock épuisé';
        else if (stockActuel <= stockMinimum) status = `Stock faible (min: ${stockMinimum})`;
        else status = `Stock OK (min: ${stockMinimum})`;

        return `${baseText} - ${articleName}\n${stockActuel} unités - ${status}`;
    }

    generateSlotContent(slot, article, zoomClass) {
        if (!article) {
            return `
                <div class="quad-slot-code">${slot.code}</div>
                <div class="quad-slot-status">Libre</div>
            `;
        }

        const imageUrl = article.photo || article.photo_url ||
            'https://via.placeholder.com/40x40/cccccc/666666?text=📦';
        const stock = article.quantity || article.stock_actuel || 0;
        const articleName = article.name || article.nom || 'Article';

        return `
            <div class="slot-content">
                <div class="slot-article-image">
                    <img src="${imageUrl}" alt="${articleName}"
                         onerror="this.src='https://via.placeholder.com/40x40/cccccc/666666?text=📦'">
                </div>
                <div class="slot-article-info">
                    <div class="slot-code-small">${slot.code}</div>
                    <div class="article-quantity">${stock}</div>
                </div>
            </div>
        `;
    }

    addHighlightEffect(rack, level, slotCode) {
        // Animation sur le rack dans la vue du dessus
        const rackIndex = this.racks.indexOf(rack);
        if (rackIndex !== -1) {
            this.drawTopView(); // Redessiner avec mise en évidence
        }

        // Animation sur le niveau dans la vue de face
        if (level && this.selectedLevel === level) {
            this.drawFrontView(); // Redessiner avec mise en évidence
        }

        console.log(`🎯 Emplacement ${slotCode} mis en évidence`);
    }

    drawGrid(ctx, width, height, size) {
        ctx.strokeStyle = 'rgba(0,0,0,0.1)';
        ctx.lineWidth = 1;

        // Lignes verticales
        for (let x = 0; x < width; x += size) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }

        // Lignes horizontales
        for (let y = 0; y < height; y += size) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
    }

    resizeCanvases() {
        const containers = [
            { canvas: this.canvasTop, container: this.canvasTop?.parentElement },
            { canvas: this.canvasFront, container: this.canvasFront?.parentElement }
        ];

        containers.forEach(item => {
            if (item.canvas && item.container) {
                const rect = item.container.getBoundingClientRect();
                item.canvas.width = rect.width - 30; // Padding
                item.canvas.height = rect.height - 30;
            }
        });

        // Redessiner après redimensionnement
        this.drawAllViews();
    }

    updateRackCount() {
        const countElement = document.getElementById('accueilRackCount');
        if (countElement) {
            countElement.textContent = `${this.racks.length} racks`;
        }
    }

    showNotification(message, type = 'info') {
        console.log(`[${type.toUpperCase()}] ${message}`);

        // Vous pouvez intégrer votre système de notification existant
        // ou utiliser alert() temporairement
        if (type === 'error') {
            console.error(message);
        }
    }

    showError(message) {
        console.error(`❌ ${message}`);
        // Afficher dans l'interface si nécessaire
    }

    // Affiche UN SEUL rack (pas tous)
    drawSingleRack(rack) {
        if (!this.ctxTop) return;

        const ctx = this.ctxTop;
        const width = this.canvasTop.width;
        const height = this.canvasTop.height;

        // Effacer tout
        ctx.clearRect(0, 0, width, height);

        // Dessiner UN SEUL rack au centre
        const w = (rack.width || 3) * 20;
        const h = (rack.depth || 2) * 20;
        const x = (width - w) / 2;
        const y = (height - h) / 2;

        // Couleur ORIGINALE du rack
        ctx.fillStyle = rack.color || '#4a90e2';
        ctx.fillRect(x, y, w, h);

        // Bordure de mise en évidence
        ctx.strokeStyle = '#fd7e14';
        ctx.lineWidth = 4;
        ctx.strokeRect(x, y, w, h);

        // Code du rack
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`RACK ${rack.code}`, x + w/2, y + h/2);

        // Légende
        ctx.fillStyle = '#333';
        ctx.font = '12px Arial';
        ctx.fillText(`Article localisé ici`, width/2, y + h + 20);
    }

    enlargePhoto(imageUrl, title) {
        // Créer l'overlay
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            cursor: pointer;
        `;

        // Créer l'image agrandie
        const enlargedImg = document.createElement('img');
        enlargedImg.src = imageUrl;
        enlargedImg.alt = title;
        enlargedImg.style.cssText = `
            max-width: 90%;
            max-height: 90%;
            border-radius: 8px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            cursor: default;
        `;

        // Titre
        const titleDiv = document.createElement('div');
        titleDiv.style.cssText = `
            position: absolute;
            bottom: 20px;
            color: white;
            text-align: center;
            width: 100%;
            font-size: 16px;
            background: rgba(0,0,0,0.5);
            padding: 10px;
        `;
        titleDiv.textContent = title;

        // Fermer au clic
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                document.body.removeChild(overlay);
            }
        });

        // Ajouter à la page
        overlay.appendChild(enlargedImg);
        overlay.appendChild(titleDiv);
        document.body.appendChild(overlay);
    }

    // Affiche UN SEUL étage
    drawSingleLevel(rack, level) {
        if (!this.ctxFront) return;

        const ctx = this.ctxFront;
        const width = this.canvasFront.width;
        const height = this.canvasFront.height;

        ctx.clearRect(0, 0, width, height);

        // Afficher uniquement l'étage concerné au centre
        const levelHeight = 100; // Hauteur fixe
        const levelWidth = 200;  // Largeur fixe
        const x = (width - levelWidth) / 2;
        const y = (height - levelHeight) / 2;

        // Étage
        ctx.fillStyle = rack.color || '#4a90e2';
        ctx.fillRect(x, y, levelWidth, levelHeight);

        // Bordure
        ctx.strokeStyle = '#fd7e14';
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, levelWidth, levelHeight);

        // Texte
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`ÉTAGE ${level.code}`, x + levelWidth/2, y + levelHeight/2);

        // Info rack
        ctx.fillStyle = '#666';
        ctx.font = '11px Arial';
        ctx.fillText(`Rack: ${rack.code}`, width/2, y + levelHeight + 15);
    }

    // Affiche UN SEUL slot avec la photo
    updateSingleSlotView(level, slot, article, rack) {
        if (!this.drawerContainer) return;

        const articleInSlot = article || slot.articles?.[0];
        const imageUrl = articleInSlot?.photo_url ||
                        articleInSlot?.photo ||
                        'https://via.placeholder.com/120x120/cccccc/666666?text=📦';

        this.drawerContainer.innerHTML = `
            <div class="single-slot-view">
                <div class="slot-header">
                    <h3>📍 Emplacement ${slot.full_code || `${level.code}-${slot.code}`}</h3>
                    <div class="location-badges">
                        <span class="badge">Rack ${rack.code}</span>
                        <span class="badge">Étage ${level.code}</span>
                        <span class="badge">Slot ${slot.code}</span>
                    </div>
                </div>

                <div class="slot-main">
                    <div class="article-photo-container">
                        <img src="${imageUrl}"
                         alt="${articleInSlot?.nom || 'Article'}"
                         class="article-photo"
                         style="width: 120px; height: 120px; object-fit: contain;"
                         onclick="window.accueilQuadManager.enlargePhoto('${imageUrl}', '${articleInSlot?.nom || 'Article'}')"
                         onerror="this.src='https://via.placeholder.com/120x120/cccccc/666666?text=📦'">
                    </div>

                    ${articleInSlot ? `
                    <div class="article-info">
                        <h4>${articleInSlot.nom}</h4>
                        <div class="article-details">
                            <div><strong>Numéro:</strong> ${articleInSlot.numero || 'N/A'}</div>
                            <div><strong>Stock:</strong> ${articleInSlot.stock_actuel || 0} unités</div>
                            ${articleInSlot.code_barre ? `<div><strong>Code-barres:</strong> ${articleInSlot.code_barre}</div>` : ''}
                        </div>
                    </div>
                    ` : `
                    <div class="empty-slot-info">
                        <i class="fas fa-box-open fa-2x"></i>
                        <p>Emplacement vide</p>
                    </div>
                    `}
                </div>
            </div>
        `;
    }

    // Ajouter cette méthode dans AccueilQuadManager
    highlightArticleLocationFromArticle(article) {
        console.log('QUAD DEBUG - Article avec IDs:', {
            id: article.id,
            nom: article.nom,
            rack_id: article.rack_id,
            level_id: article.level_id,
            slot_id: article.slot_id
        });

        // Si pas d'IDs, on ne peut pas localiser
        if (!article.rack_id || !article.level_id || !article.slot_id) {
            console.warn('Article sans IDs de localisation');
            this.showNotification('Article non localisé dans le stock', 'warning');
            return false;
        }

        // 1. Trouver le rack
        const rack = this.racks.find(r => r.id === article.rack_id);
        if (!rack) {
            console.error(`Rack ID ${article.rack_id} non trouvé`);
            return false;
        }

        // 2. Trouver le niveau
        const level = rack.levels?.find(l => l.id === article.level_id);
        if (!level) {
            console.error(`Level ID ${article.level_id} non trouvé dans rack ${rack.code}`);
            return false;
        }

        // 3. Trouver l'emplacement
        const slot = level.slots?.find(s => s.id === article.slot_id);
        if (!slot) {
            console.error(`Slot ID ${article.slot_id} non trouvé dans level ${level.code}`);
            return false;
        }

        // 4. D'ABORD définir les sélections
        this.selectedRack = rack;     // <-- AJOUTER
        this.selectedLevel = level;   // <-- AJOUTER

        // 5. Ensuite afficher les vues
        this.drawSingleRack(rack);
        this.drawSingleLevel(rack, level);
        this.updateSingleSlotView(level, slot, article, rack);

        console.log(`✅ Article localisé: ${rack.code}-${level.code}-${slot.code}`);
        return true;
    }
}

// Initialiser quand la page est chargée
document.addEventListener('DOMContentLoaded', () => {
    // Vérifier si la section Quad existe
    const quadSection = document.querySelector('.quad-section');
    if (quadSection) {
        // Délai pour s'assurer que tout est chargé
        setTimeout(() => {
            window.accueilQuadManager = new AccueilQuadManager();
        }, 500);
    }
});