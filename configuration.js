import { supabase } from './supabaseClient.js';

// Éléments DOM et variables
let currentUser = null;
let allUsers = [];
const SUPERADMIN_USERNAME = 'Kennouille';
const SUPERADMIN_CODE = '109801';
let isSuperAdmin = false;
let currentUserPermissions = {};
let currentActivePlan = 'basic';

document.addEventListener('DOMContentLoaded', async function() {
    // Vérifier l'authentification
    await checkAuth();

    // Charger les utilisateurs
    await loadUsers();

    // Configurer les événements
    setupEventListeners();

    // Réinitialiser le formulaire d'ajout d'utilisateur
    document.getElementById('addUserForm')?.reset();

    // Charger le plan actuel
    await loadCurrentPlan();

    // Configurer les événements des plans
    setupPlanEvents();

    // Cacher le loading
    document.getElementById('loadingOverlay').style.display = 'none';
});

// AJOUTEZ CETTE FONCTION EN HAUT DU FICHIER, juste après les imports
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// ===== AUTHENTIFICATION =====
async function checkAuth() {
    try {
        const userJson = sessionStorage.getItem('current_user');

        if (!userJson) {
            window.location.href = 'connexion.html';
            return;
        }

        currentUser = JSON.parse(userJson);

        // Charger les permissions de l'utilisateur depuis la base
        const { data, error } = await supabase
            .from('w_users')
            .select('permissions')
            .eq('id', currentUser.id)
            .single();

        if (!error && data) {
            currentUserPermissions = data.permissions || {};
            // Mettre à jour currentUser
            currentUser.permissions = currentUserPermissions;
        }

        // Vérifier les permissions
        if (!currentUser.permissions?.config) {
            alert('Vous n\'avez pas la permission d\'accéder à cette page');
            window.location.href = 'accueil.html';
            return;
        }

        // Vérifier si c'est le SuperAdmin
        isSuperAdmin = currentUser.username === SUPERADMIN_USERNAME;

        // Mettre à jour l'interface
        updateUserInterface();

        // Afficher/cacher la section SuperAdmin
        toggleSuperAdminSection();

    } catch (error) {
        console.error('Erreur d\'authentification:', error);
        sessionStorage.removeItem('current_user');
        window.location.href = 'connexion.html';
    }
}

function updateUserInterface() {
    document.getElementById('usernameDisplay').textContent = currentUser.username;
}

function toggleSuperAdminSection() {
    const superAdminSection = document.getElementById('superAdminSection');

    if (isSuperAdmin) {
        superAdminSection.style.display = 'block';
        setupSuperAdminInfo();
    } else {
        superAdminSection.style.display = 'none';
    }
}

// ===== SUPER ADMIN =====
function setupSuperAdminInfo() {
    // TOUJOURS afficher des étoiles par défaut pour le code, même pour le SuperAdmin
    document.getElementById('superadminUsername').textContent = SUPERADMIN_USERNAME;
    document.getElementById('superadminCode').textContent = '**********'; // Masqué par défaut

    // Pour les autres admins, afficher uniquement des étoiles
    if (!isSuperAdmin) {
        document.getElementById('superadminUsername').textContent = '**********';
        document.getElementById('superadminCode').textContent = '**********';
    }
}

// Révéler les informations SuperAdmin
document.getElementById('revealSuperadminBtn')?.addEventListener('click', function() {
    const usernameSpan = document.getElementById('superadminUsername');
    const codeSpan = document.getElementById('superadminCode');

    // Si le SuperAdmin est connecté
    if (isSuperAdmin) {
        if (this.innerHTML.includes('fa-eye')) {
            // Révéler le code seulement
            usernameSpan.textContent = SUPERADMIN_USERNAME;
            codeSpan.textContent = SUPERADMIN_CODE;
            this.innerHTML = '<i class="fas fa-eye-slash"></i> Cacher le code';
        } else {
            // Masquer le code avec des étoiles
            usernameSpan.textContent = SUPERADMIN_USERNAME;
            codeSpan.textContent = '**********';
            this.innerHTML = '<i class="fas fa-eye"></i> Révéler le code';
        }
    } else {
        // Pour les non-SuperAdmin, toujours masqué
        alert('Seul le SuperAdmin peut révéler ces informations');
    }
});

// Mettre à jour le SuperAdmin
document.getElementById('updateSuperadminForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();

    const newUsername = document.getElementById('newSuperadminUsername').value.trim();
    const newCode = document.getElementById('newSuperadminCode').value.trim();
    const confirmCode = document.getElementById('confirmSuperadminCode').value.trim();
    const errorDiv = document.getElementById('superadminError');
    const errorText = document.getElementById('superadminErrorText');

    // Validation
    if (newUsername.length < 3) {
        showError(errorDiv, errorText, 'Le nom d\'utilisateur doit contenir au moins 3 caractères');
        return;
    }

    if (!/^\d{6}$/.test(newCode)) {
        showError(errorDiv, errorText, 'Le code doit contenir exactement 6 chiffres');
        return;
    }

    if (newCode !== confirmCode) {
        showError(errorDiv, errorText, 'Les codes ne correspondent pas');
        return;
    }

    // Demander confirmation
    if (!confirm('⚠️ ATTENTION : Vous allez modifier les informations du SuperAdmin.\n\nCette action est irréversible. Continuer ?')) {
        return;
    }

    // Pour l'instant, juste afficher un message
    // Dans la vraie version, tu mettrais à jour la base de données
    alert(`SuperAdmin mis à jour :
Nom: ${newUsername}
Code: ${newCode}

(En réalité, tu devrais mettre à jour dans ta table w_users)`);

    // Réinitialiser le formulaire
    this.reset();
});

// ===== GESTION DES UTILISATEURS =====
async function loadUsers() {
    try {
        const { data: users, error } = await supabase
            .from('w_users')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        allUsers = users || [];
        displayUsers(allUsers);

    } catch (error) {
        console.error('Erreur lors du chargement des utilisateurs:', error);
        alert('Erreur lors du chargement des utilisateurs');
    }
}

function displayUsers(users) {
    const tbody = document.getElementById('usersTableBody');
    const usersCount = document.getElementById('usersCount');
    const paginationInfo = document.getElementById('paginationInfo');

    // Mettre à jour le compteur
    usersCount.textContent = `${users.length} utilisateur${users.length > 1 ? 's' : ''}`;
    paginationInfo.textContent = `Affiche 1-${users.length} sur ${users.length}`;

    if (users.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="loading-cell">
                    <i class="fas fa-user-slash"></i> Aucun utilisateur trouvé
                </td>
            </tr>
        `;
        return;
    }

    // Construire le tableau
    tbody.innerHTML = '';

    users.forEach(user => {
        const isCurrentUser = user.username === currentUser.username;
        const isSuperAdminUser = user.username === SUPERADMIN_USERNAME;

        const row = document.createElement('tr');

        // Colonne Utilisateur
        let usernameCell = user.username;
        if (isSuperAdminUser && !isSuperAdmin) {
            usernameCell = '**********';
        }

        // Colonne Permissions
        let permissionsHTML = '';
        const permissions = user.permissions || {};

        if (isSuperAdminUser && !isSuperAdmin) {
            permissionsHTML = '<div class="permissions-tags"><span class="permission-tag admin">SUPER ADMIN</span></div>';
        } else {
            permissionsHTML = '<div class="permissions-tags">';
            Object.entries(permissions).forEach(([key, value]) => {
                if (value && key !== 'accueil') {
                    const permissionNames = {
                        'config': 'Admin',
                        'creation': 'Création',
                        'stats': 'Stats',
                        'historique': 'Historique',
                        'impression': 'Impression',
                        'gestion': 'Gestion',
                        'projets': 'Projets',
                        'reservations': 'Réservations',
                        'vuestock': 'Vue Stock'
                    };

                    permissionsHTML += `<span class="permission-tag ${key === 'config' ? 'admin' : ''}">${permissionNames[key] || key}</span>`;
                }
            });
            permissionsHTML += '</div>';
        }

        // Colonne Dates
        const createdAt = user.created_at ? new Date(user.created_at).toLocaleDateString('fr-FR') : '-';
        const lastLogin = user.last_login ? new Date(user.last_login).toLocaleDateString('fr-FR') : 'Jamais';

        // Colonne Actions
        let actionsHTML = '';

        if (isSuperAdminUser) {
            // SuperAdmin - seulement le SuperAdmin peut le modifier
            if (isSuperAdmin) {
                actionsHTML = `
                    <button class="btn-action edit" data-id="${user.id}">
                        <i class="fas fa-edit"></i>
                    </button>
                `;
            } else {
                actionsHTML = '<span class="text-secondary">Accès restreint</span>';
            }
        } else if (isCurrentUser) {
            // Utilisateur courant - peut modifier son mot de passe
            actionsHTML = `
                <button class="btn-action edit" data-id="${user.id}">
                    <i class="fas fa-key"></i> MDP
                </button>
            `;
        } else {
            // Autres utilisateurs
            actionsHTML = `
                <button class="btn-action edit" data-id="${user.id}" title="Modifier">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-action delete" data-id="${user.id}" title="Supprimer">
                    <i class="fas fa-trash"></i>
                </button>
            `;
        }

        row.innerHTML = `
            <td>
                <strong>${usernameCell}</strong>
                ${isCurrentUser ? '<br><small><i class="fas fa-user"></i> (Vous)</small>' : ''}
            </td>
            <td class="permissions-cell">${permissionsHTML}</td>
            <td>${createdAt}</td>
            <td>${lastLogin}</td>
            <td class="actions-cell">${actionsHTML}</td>
        `;

        tbody.appendChild(row);
    });

    // Ajouter les événements aux boutons d'action
    setupUserActionButtons();
}

function setupUserActionButtons() {
    // Boutons d'édition
    document.querySelectorAll('.btn-action.edit').forEach(btn => {
        btn.addEventListener('click', function() {
            const userId = this.dataset.id;
            const user = allUsers.find(u => u.id === userId);
            if (user) {
                openEditModal(user);
            }
        });
    });

    // Boutons de suppression
    document.querySelectorAll('.btn-action.delete').forEach(btn => {
        btn.addEventListener('click', function() {
            const userId = this.dataset.id;
            const user = allUsers.find(u => u.id === userId);
            if (user) {
                confirmDeleteUser(user);
            }
        });
    });
}

// Gestion des plans de souscription
let currentPlan = null;
let isSuperAdminForPlans = false;

async function loadCurrentPlan() {
    try {
        const { data, error } = await supabase
            .from('w_plan')
            .select('active_plan')
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') throw error;

        if (data) {
            currentActivePlan = data.active_plan;
            updatePlanSelection(currentActivePlan);
        }
    } catch (error) {
        console.error('Erreur chargement plan:', error);
        currentActivePlan = 'basic';
    }
}

function updatePlanSelection(plan) {
    // Réinitialiser tous les cards
    document.querySelectorAll('.plan-card').forEach(card => {
        card.classList.remove('active');
    });

    // Réinitialiser les checkboxes
    document.querySelectorAll('.plan-checkbox').forEach(checkbox => {
        checkbox.checked = false;
    });

    // Activer le plan sélectionné
    if (plan === 'basic') {
        document.getElementById('planBasic').classList.add('active');
        document.getElementById('planBasicCheckbox').checked = true;
    } else if (plan === 'premium') {
        document.getElementById('planPremium').classList.add('active');
        document.getElementById('planPremiumCheckbox').checked = true;
    } else if (plan === 'business') {
        document.getElementById('planBusiness').classList.add('active');
        document.getElementById('planBusinessCheckbox').checked = true;
    }
}

async function updatePlan(plan) {
    try {
        const { error } = await supabase
            .from('w_plan')
            .upsert({
                id: 1,
                active_plan: plan,
                updated_at: new Date().toISOString()
            });

        if (error) throw error;

        currentPlan = plan;
        updatePlanSelection(plan);
        alert(`Plan ${plan.toUpperCase()} activé avec succès !`);

    } catch (error) {
        console.error('Erreur mise à jour plan:', error);
        alert('Erreur lors de la mise à jour du plan');
        // Recharger le plan actuel en cas d'erreur
        await loadCurrentPlan();
    }
}

function setupPlanEvents() {
    const checkboxes = document.querySelectorAll('.plan-checkbox');

    checkboxes.forEach(checkbox => {
        // Si ce n'est pas le SuperAdmin, la case est désactivée (lecture seule)
        if (!isSuperAdmin) {
            checkbox.disabled = true;
            const label = checkbox.parentElement.querySelector('label');
            if (label) {
                label.style.opacity = '0.5';
                label.style.cursor = 'default';
            }
        }

        checkbox.addEventListener('change', async function(e) {
            if (!isSuperAdmin) {
                e.preventDefault();
                this.checked = false;
                return;
            }

            const plan = this.dataset.plan;

            if (this.checked) {
                checkboxes.forEach(cb => {
                    if (cb !== this) cb.checked = false;
                });
                await updatePlan(plan);
            } else {
                await loadCurrentPlan();
            }
        });
    });
}

function checkUserLimits(plan, currentUsersCount, currentAdminsCount, newUserIsAdmin) {
    // Compter les utilisateurs existants (hors SuperAdmin)
    const regularUsersCount = currentUsersCount;
    const adminsCount = currentAdminsCount;

    if (plan === 'basic') {
        // Basic: 1 Admin + 1 Utilisateur maximum
        if (newUserIsAdmin && adminsCount >= 1) {
            return { allowed: false, message: 'Plan BASIC : 1 administrateur maximum déjà atteint' };
        }
        if (!newUserIsAdmin && regularUsersCount >= 1) {
            return { allowed: false, message: 'Plan BASIC : 1 utilisateur maximum déjà atteint' };
        }
        return { allowed: true };
    }

    if (plan === 'premium') {
        // Premium: 1 Admin + 10 Utilisateurs maximum
        if (newUserIsAdmin && adminsCount >= 2) {
            return { allowed: false, message: 'Plan PREMIUM : 2 administrateur maximum déjà atteint' };
        }
        if (!newUserIsAdmin && regularUsersCount >= 10) {
            return { allowed: false, message: 'Plan PREMIUM : 10 utilisateurs maximum déjà atteint' };
        }
        return { allowed: true };
    }

    // Business: illimité
    return { allowed: true };
}

// ===== MODAL D'ÉDITION =====
function openEditModal(user) {
    const modal = document.getElementById('editUserModal');
    const form = document.getElementById('editUserForm');
    const isSuperAdminUser = user.username === SUPERADMIN_USERNAME;

    // Compter les utilisateurs actuels (hors SuperAdmin)
    const currentUsers = allUsers.filter(u => u.username !== SUPERADMIN_USERNAME);
    const currentAdminsCount = currentUsers.filter(u => u.permissions?.config === true).length;
    const currentUsersCount = currentUsers.filter(u => u.permissions?.config !== true).length;

    // Vérifier si on peut ajouter un admin selon le plan
    let canAddAdmin = true;
    let adminLimitMessage = '';

    if (currentActivePlan === 'basic') {
        canAddAdmin = currentAdminsCount < 1;
        adminLimitMessage = 'Plan BASIC : 1 administrateur maximum';
    } else if (currentActivePlan === 'premium') {
        canAddAdmin = currentAdminsCount < 2;
        adminLimitMessage = 'Plan PREMIUM : 2 administrateur maximum';
    }

    // Pour l'utilisateur courant, on ne bloque pas la modification de sa propre permission admin
    const isEditingSelf = user.id === currentUser.id;
    // Vérifier si l'utilisateur modifié est déjà admin
    const isCurrentlyAdmin = user.permissions?.config === true;

    // Remplir le formulaire
    document.getElementById('editUserId').value = user.id;
    document.getElementById('editUsername').value = user.username;

    // Gérer la visibilité du nom d'utilisateur pour SuperAdmin
    if (isSuperAdminUser && !isSuperAdmin) {
        document.getElementById('editUsername').value = '**********';
        document.getElementById('editUsername').disabled = true;
    } else {
        document.getElementById('editUsername').disabled = false;
    }

    // Créer les checkboxes de permissions
    const permissionsList = document.getElementById('editPermissionsList');
    permissionsList.innerHTML = '';

    const allPermissions = [
        { id: 'edit_perm_config', key: 'config', label: 'Configuration', icon: 'fa-cog', desc: 'Admin - Gérer les utilisateurs' },
        { id: 'edit_perm_creation', key: 'creation', label: 'Création article', icon: 'fa-plus-circle', desc: 'Créer de nouveaux articles' },
        { id: 'edit_perm_stats', key: 'stats', label: 'Statistiques', icon: 'fa-chart-bar', desc: 'Voir les rapports et stats' },
        { id: 'edit_perm_historique', key: 'historique', label: 'Historique', icon: 'fa-history', desc: 'Consulter l\'historique' },
        { id: 'edit_perm_impression', key: 'impression', label: 'Impression', icon: 'fa-print', desc: 'Imprimer étiquettes et rapports' },
        { id: 'edit_perm_gestion', key: 'gestion', label: 'Gestion articles', icon: 'fa-box-open', desc: 'Modifier/supprimer articles' },
        { id: 'edit_perm_projets', key: 'projets', label: 'Gestion projets', icon: 'fa-project-diagram', desc: 'Créer/gérer les projets' },
        { id: 'edit_perm_reservations', key: 'reservations', label: 'Réservations', icon: 'fa-clipboard-list', desc: 'Gérer les réservations' },
        { id: 'edit_perm_vuestock', key: 'vuestock', label: 'Vue Stock', icon: 'fa-eye', desc: 'Visualiser le stock complet' }
    ];

    allPermissions.forEach(perm => {
        const isChecked = user.permissions?.[perm.key] || false;
        const isSuperAdminUser = user.username === SUPERADMIN_USERNAME;

        // Déterminer si la case doit être désactivée
        let isDisabled = false;
        let disabledReason = '';

        if (isSuperAdminUser && !isSuperAdmin) {
            isDisabled = true;
            disabledReason = 'Seul le SuperAdmin peut modifier';
        } else if (user.id === currentUser.id && perm.key === 'config') {
            isDisabled = true;
            disabledReason = 'Ne peut pas désactiver sa propre permission admin';
        } else if (!isSuperAdmin && !currentUserPermissions[perm.key]) {
            // L'admin n'a pas cette permission, il ne peut pas la donner aux autres
            isDisabled = true;
            disabledReason = `Vous n'avez pas cette permission (${perm.label})`;
        } else if (perm.key === 'config' && !isEditingSelf && !isCurrentlyAdmin && !canAddAdmin) {
            // Bloquer l'ajout d'un nouvel admin si le plan ne le permet pas
            isDisabled = true;
            disabledReason = adminLimitMessage;
        }

        const div = document.createElement('div');
        div.className = 'permission-item';
        div.innerHTML = `
            <input type="checkbox"
                   id="${perm.id}"
                   ${isChecked ? 'checked' : ''}
                   ${isDisabled ? 'disabled' : ''}
                   data-key="${perm.key}">
            <label for="${perm.id}" ${isDisabled ? 'style="opacity:0.6;"' : ''}>
                <i class="fas ${perm.icon}"></i>
                <span>${perm.label}</span>
                <small>${perm.desc}</small>
                ${disabledReason ? `<br><small class="text-muted">🔒 ${disabledReason}</small>` : ''}
            </label>
        `;
        permissionsList.appendChild(div);
    });

    // Afficher le modal
    modal.style.display = 'flex';
}

// ===== AJOUT D'UTILISATEUR =====
document.getElementById('addUserForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();

    const username = document.getElementById('newUsername').value.trim();
    const password = document.getElementById('newPassword').value.trim();
    const errorDiv = document.getElementById('addUserError');
    const errorText = document.getElementById('addUserErrorText');

    // Vérifier si l'utilisateur a la permission config (admin)
    const isNewUserAdmin = document.getElementById('perm_config').checked;

    // Validation
    if (!username || !password) {
        showError(errorDiv, errorText, 'Veuillez remplir tous les champs');
        return;
    }

    if (username.length < 3) {
        showError(errorDiv, errorText, 'Le nom d\'utilisateur doit contenir au moins 3 caractères');
        return;
    }

    // Vérifier si l'utilisateur existe déjà
    const userExists = allUsers.some(user =>
        user.username.toLowerCase() === username.toLowerCase()
    );

    if (userExists) {
        showError(errorDiv, errorText, 'Cet utilisateur existe déjà');
        return;
    }

    // Compter les utilisateurs actuels (hors SuperAdmin)
    const currentUsers = allUsers.filter(u => u.username !== SUPERADMIN_USERNAME);
    const currentAdminsCount = currentUsers.filter(u => u.permissions?.config === true).length;
    const currentUsersCount = currentUsers.filter(u => u.permissions?.config !== true).length;

    // Vérifier les limites selon le plan
    const limitCheck = checkUserLimits(currentActivePlan, currentUsersCount, currentAdminsCount, isNewUserAdmin);
    if (!limitCheck.allowed) {
        showError(errorDiv, errorText, limitCheck.message);
        return;
    }

    // Récupérer les permissions
    const permissions = {
        accueil: true
    };

    const permissionKeys = ['config', 'creation', 'stats', 'historique', 'impression', 'gestion', 'projets', 'reservations', 'vuestock'];

    // Vérification : L'admin ne peut donner que ce qu'il a
    for (const key of permissionKeys) {
        const checkbox = document.getElementById(`perm_${key}`);
        const isChecked = checkbox.checked;

        if (isChecked && !isSuperAdmin && !currentUserPermissions[key]) {
            showError(errorDiv, errorText, `Vous ne pouvez pas donner la permission "${key}" car vous ne l'avez pas vous-même`);
            return;
        }

        permissions[key] = isChecked;
    }

    try {
        // Insérer le nouvel utilisateur
        const { data, error } = await supabase
            .from('w_users')
            .insert([
                {
                    id: generateUUID(),
                    username: username,
                    password: password,
                    permissions: permissions
                }
            ]);

        if (error) throw error;

        // Recharger la liste des utilisateurs
        await loadUsers();

        // Réinitialiser le formulaire
        this.reset();

        // Afficher un message de succès
        alert(`Utilisateur "${username}" créé avec succès !`);

    } catch (error) {
        console.error('Erreur lors de la création de l\'utilisateur:', error);
        showError(errorDiv, errorText, 'Erreur lors de la création de l\'utilisateur');
    }
});

// ===== ÉVÉNEMENTS =====
function setupEventListeners() {
    // Déconnexion
    document.getElementById('logoutBtn').addEventListener('click', logout);

    // Actualiser la liste
    document.getElementById('refreshUsersBtn').addEventListener('click', loadUsers);

    // Recherche d'utilisateurs
    document.getElementById('searchUsersInput').addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        const filteredUsers = allUsers.filter(user =>
            user.username.toLowerCase().includes(searchTerm)
        );
        displayUsers(filteredUsers);
    });

    // Fermer le modal
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', function() {
            document.getElementById('editUserModal').style.display = 'none';
        });
    });

    // Annuler la modification SuperAdmin
    document.getElementById('cancelUpdateBtn')?.addEventListener('click', function() {
        document.getElementById('updateSuperadminForm').reset();
    });

    // Gestion du modal d'édition
    const editUserForm = document.getElementById('editUserForm');
    if (editUserForm) {
        editUserForm.addEventListener('submit', handleEditUser);
        document.getElementById('deleteUserBtn').addEventListener('click', handleDeleteUser);
    }
}

async function handleEditUser(e) {
    e.preventDefault();

    const userId = document.getElementById('editUserId').value;
    const newUsername = document.getElementById('editUsername').value.trim();
    const newPassword = document.getElementById('editPassword').value.trim();
    const errorDiv = document.getElementById('editUserError');
    const errorText = document.getElementById('editUserErrorText');

    const user = allUsers.find(u => u.id === userId);
    if (!user) return;

    const isSuperAdminUser = user.username === SUPERADMIN_USERNAME;

    // Récupérer les nouvelles permissions
    const newPermissions = { accueil: true };
    const checkboxes = document.querySelectorAll('#editPermissionsList input[type="checkbox"]');

    checkboxes.forEach(checkbox => {
        const key = checkbox.dataset.key;
        newPermissions[key] = checkbox.checked;
    });

    const isNewUserAdmin = newPermissions.config;
    const wasAdmin = user.permissions?.config === true;

    // Si on essaie de passer un utilisateur de non-admin à admin
    if (!wasAdmin && isNewUserAdmin && !isSuperAdminUser) {
        // Compter les admins actuels (hors SuperAdmin)
        const currentUsers = allUsers.filter(u => u.username !== SUPERADMIN_USERNAME && u.id !== userId);
        const currentAdminsCount = currentUsers.filter(u => u.permissions?.config === true).length;

        let canAddAdmin = true;
        let limitMessage = '';

        if (currentActivePlan === 'basic') {
            canAddAdmin = currentAdminsCount < 1;
            limitMessage = 'Plan BASIC : 1 administrateur maximum';
        } else if (currentActivePlan === 'premium') {
            canAddAdmin = currentAdminsCount < 1;
            limitMessage = 'Plan PREMIUM : 1 administrateur maximum';
        }

        if (!canAddAdmin) {
            showError(errorDiv, errorText, limitMessage);
            return;
        }
    }

    // Validation du nom d'utilisateur
    if (!isSuperAdminUser && newUsername.length < 3) {
        showError(errorDiv, errorText, 'Le nom d\'utilisateur doit contenir au moins 3 caractères');
        return;
    }

    // Vérifier si le nom d'utilisateur existe déjà
    if (!isSuperAdminUser && newUsername !== user.username) {
        const usernameExists = allUsers.some(u =>
            u.id !== userId && u.username.toLowerCase() === newUsername.toLowerCase()
        );

        if (usernameExists) {
            showError(errorDiv, errorText, 'Ce nom d\'utilisateur est déjà pris');
            return;
        }
    }

    // VÉRIFICATION : L'admin ne peut pas donner plus que ce qu'il a
    if (!isSuperAdmin) {
        for (const checkbox of checkboxes) {
            const key = checkbox.dataset.key;
            const isChecked = checkbox.checked;

            // Si la case est cochée mais que l'admin n'a pas cette permission
            if (isChecked && !currentUserPermissions[key]) {
                showError(errorDiv, errorText, `Vous ne pouvez pas donner la permission "${key}" car vous ne l'avez pas vous-même`);
                return;
            }
        }
    }

    checkboxes.forEach(checkbox => {
        const key = checkbox.dataset.key;
        newPermissions[key] = checkbox.checked;
    });

    // Si l'utilisateur modifié est l'utilisateur courant et qu'il se retire admin
    if (user.username === currentUser.username && !newPermissions.config && user.permissions?.config) {
        if (!confirm('⚠️ ATTENTION : Vous êtes sur le point de vous retirer les permissions admin.\n\nVous ne pourrez plus accéder à cette page.\nContinuer ?')) {
            return;
        }
    }

    try {
        // Préparer les données de mise à jour
        const updateData = {};

        if (!isSuperAdminUser) {
            updateData.username = newUsername;
        }

        if (newPassword) {
            updateData.password = newPassword;
        }

        updateData.permissions = newPermissions;

        // Mettre à jour l'utilisateur
        const { error } = await supabase
            .from('w_users')
            .update(updateData)
            .eq('id', userId);

        if (error) throw error;

        // Recharger la liste
        await loadUsers();

        // Fermer le modal
        document.getElementById('editUserModal').style.display = 'none';

        // Si l'utilisateur courant s'est modifié, mettre à jour la session
        if (user.username === currentUser.username) {
            const updatedUser = { ...currentUser, ...updateData };
            sessionStorage.setItem('current_user', JSON.stringify(updatedUser));
            currentUserPermissions = newPermissions;

            // Si il s'est retiré admin, rediriger
            if (!newPermissions.config && user.permissions?.config) {
                alert('Vous avez perdu les permissions admin. Redirection...');
                window.location.href = 'accueil.html';
            }
        }

        alert('Utilisateur modifié avec succès');

    } catch (error) {
        console.error('Erreur lors de la modification de l\'utilisateur:', error);
        showError(errorDiv, errorText, 'Erreur lors de la modification');
    }
}

async function handleDeleteUser() {
    const userId = document.getElementById('editUserId').value;
    const user = allUsers.find(u => u.id === userId);

    if (!user) return;

    // Empêcher la suppression du SuperAdmin
    if (user.username === SUPERADMIN_USERNAME) {
        alert('Impossible de supprimer le SuperAdmin');
        return;
    }

    // Empêcher l'utilisateur de se supprimer lui-même
    if (user.username === currentUser.username) {
        alert('Vous ne pouvez pas supprimer votre propre compte');
        return;
    }

    // Demander confirmation
    if (!confirm(`Êtes-vous sûr de vouloir supprimer l'utilisateur "${user.username}" ?\n\nCette action est irréversible.`)) {
        return;
    }

    try {
        const { error } = await supabase
            .from('w_users')
            .delete()
            .eq('id', userId);

        if (error) throw error;

        // Recharger la liste
        await loadUsers();

        // Fermer le modal
        document.getElementById('editUserModal').style.display = 'none';

    } catch (error) {
        console.error('Erreur lors de la suppression:', error);
        alert('Erreur lors de la suppression de l\'utilisateur');
    }
}

async function confirmDeleteUser(user) {
    // Empêcher la suppression du SuperAdmin
    if (user.username === SUPERADMIN_USERNAME) {
        alert('Impossible de supprimer le SuperAdmin');
        return;
    }

    // Empêcher l'utilisateur de se supprimer lui-même
    if (user.username === currentUser.username) {
        alert('Vous ne pouvez pas supprimer votre propre compte');
        return;
    }

    if (!confirm(`Supprimer l'utilisateur "${user.username}" ?`)) {
        return;
    }

    try {
        const { error } = await supabase
            .from('w_users')
            .delete()
            .eq('id', user.id);

        if (error) throw error;

        // Recharger la liste
        await loadUsers();

    } catch (error) {
        console.error('Erreur lors de la suppression:', error);
        alert('Erreur lors de la suppression');
    }
}

// ===== UTILITAIRES =====
function showError(div, textElement, message) {
    textElement.textContent = message;
    div.style.display = 'flex';

    setTimeout(() => {
        div.style.display = 'none';
    }, 5000);
}

function logout() {
    if (!confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
        return;
    }

    sessionStorage.removeItem('current_user');
    sessionStorage.removeItem('supabase_token');
    window.location.href = 'connexion.html';
}

// Script pour le toggle mensuel/annuel
document.addEventListener('DOMContentLoaded', function() {
    const toggleCheckbox = document.getElementById('billingToggle');
    const monthlyPrices = document.querySelectorAll('.monthly-price');
    const yearlyPrices = document.querySelectorAll('.yearly-price');
    const monthlyPeriods = document.querySelectorAll('.monthly-period');
    const yearlyPeriods = document.querySelectorAll('.yearly-period');
    const billingOptions = document.querySelectorAll('.billing-option');

    function updatePrices(isYearly) {
        // Afficher/masquer les prix mensuels et annuels
        monthlyPrices.forEach(price => {
            price.style.display = isYearly ? 'none' : 'inline';
        });

        yearlyPrices.forEach(price => {
            price.style.display = isYearly ? 'inline' : 'none';
        });

        monthlyPeriods.forEach(period => {
            period.style.display = isYearly ? 'none' : 'inline';
        });

        yearlyPeriods.forEach(period => {
            period.style.display = isYearly ? 'inline' : 'none';
        });

        // Mettre à jour les classes actives des options
        billingOptions.forEach(option => {
            const isMonthlyOption = option.getAttribute('data-billing') === 'monthly';
            if ((isYearly && !isMonthlyOption) || (!isYearly && isMonthlyOption)) {
                option.classList.add('active');
            } else {
                option.classList.remove('active');
            }
        });
    }

    // Événement de changement du toggle
    toggleCheckbox.addEventListener('change', function() {
        updatePrices(this.checked);
    });

    // Événements de clic sur les options
    billingOptions.forEach(option => {
        option.addEventListener('click', function() {
            const isMonthly = this.getAttribute('data-billing') === 'monthly';
            toggleCheckbox.checked = !isMonthly;
            updatePrices(!isMonthly);
        });
    });

    // Initialisation
    updatePrices(false);
});

// Fermer le modal en cliquant à l'extérieur
document.getElementById('editUserModal')?.addEventListener('click', function(e) {
    if (e.target === this) {
        this.style.display = 'none';
    }
});