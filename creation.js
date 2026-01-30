import { supabase } from './supabaseClient.js';

// Éléments DOM et variables
let currentUser = null;
let currentPhoto = null;
let generatedBarcode = '';
let isManualBarcode = false;

// Constantes
const EAN13_PREFIX = '200'; // Préfixe pour les codes-barres générés

document.addEventListener('DOMContentLoaded', async function() {
    // Vérifier l'authentification
    await checkAuth();

    // Initialiser les événements
    setupEventListeners();

    // Initialiser les valeurs
    initializeForm();

    // Cacher le loading
    document.getElementById('loadingOverlay').style.display = 'none';
});

// ===== AUTHENTIFICATION =====
async function checkAuth() {
    try {
        const userJson = sessionStorage.getItem('current_user');

        if (!userJson) {
            window.location.href = 'connexion.html';
            return;
        }

        currentUser = JSON.parse(userJson);

        // Vérifier les permissions
        if (!currentUser.permissions?.creation) {
            alert('Vous n\'avez pas la permission de créer des articles');
            window.location.href = 'accueil.html';
            return;
        }

        // Mettre à jour l'interface
        document.getElementById('usernameDisplay').textContent = currentUser.username;

        // Vérifier l'accès au storage (en arrière-plan)
        setTimeout(async () => {
            const storageAccess = await checkStorageBucket();
            if (!storageAccess) {
                console.warn('Attention : le stockage de photos n\'est pas disponible');
                // Tu pourrais afficher un avertissement discret à l'utilisateur
            }
        }, 1000);

    } catch (error) {
        console.error('Erreur d\'authentification:', error);
        sessionStorage.removeItem('current_user');
        window.location.href = 'connexion.html';
    }
}

// ===== INITIALISATION =====
function initializeForm() {
    // Générer un numéro d'article par défaut
    generateArticleNumber();

    // Générer un code-barre par défaut
    generateBarcode();

    // Charger les données des emplacements
    loadLocationData();

    // Mettre à jour le récapitulatif
    updateSummary();

    // Calculer la valeur totale
    calculateTotalValue();
}

function generateArticleNumber() {
    // Générer un numéro du type ART-XXX
    const timestamp = Date.now().toString().slice(-4);
    const random = Math.floor(Math.random() * 90 + 10); // 10-99
    const articleNumber = `ART-${timestamp}${random}`;

    document.getElementById('articleNumber').value = articleNumber;
    updateSummaryField('summaryNumber', articleNumber);
}

function generateBarcode() {
    // Générer un code-barre EAN-13 valide
    const prefix = EAN13_PREFIX;
    const random = Math.floor(Math.random() * 1000000000).toString().padStart(9, '0');
    const barcode = prefix + random;

    // Calculer le checksum EAN-13
    const checksum = calculateEAN13Checksum(barcode);
    const fullBarcode = barcode + checksum;

    generatedBarcode = fullBarcode;
    updateBarcodePreview(fullBarcode);
    updateSummaryField('summaryBarcode', fullBarcode);
}

function calculateEAN13Checksum(code) {
    // Code doit être 12 chiffres
    let sum = 0;
    for (let i = 0; i < 12; i++) {
        const digit = parseInt(code[i]);
        sum += (i % 2 === 0) ? digit : digit * 3;
    }
    const checksum = (10 - (sum % 10)) % 10;
    return checksum.toString();
}

// Charger les données des emplacements
async function loadLocationData() {
    try {
        // Charger les racks
        const { data: racks, error: racksError } = await supabase
            .from('w_vuestock_racks')
            .select('id, rack_code, display_name')
            .order('rack_code');

        if (racksError) throw racksError;

        const rackSelect = document.getElementById('rackSelect');
        racks.forEach(rack => {
            const option = document.createElement('option');
            option.value = rack.id;
            // Utiliser display_name s'il existe, sinon rack_code
            option.textContent = rack.display_name || rack.rack_code;
            rackSelect.appendChild(option);
        });

        // Écouter le changement de rack pour charger les niveaux
        rackSelect.addEventListener('change', async function() {
            const rackId = this.value;
            const levelSelect = document.getElementById('levelSelect');
            const slotSelect = document.getElementById('slotSelect');

            // Réinitialiser
            levelSelect.innerHTML = '<option value="">-- Sélectionner un niveau --</option>';
            slotSelect.innerHTML = '<option value="">-- Sélectionner un emplacement --</option>';
            levelSelect.disabled = !rackId;
            slotSelect.disabled = true;

            if (rackId) {
                // Charger les niveaux pour ce rack
                const { data: levels, error: levelsError } = await supabase
                    .from('w_vuestock_levels') // NOTE: 's' à la fin
                    .select('id, level_code')
                    .eq('rack_id', rackId)
                    .order('display_order');

                if (!levelsError && levels) {
                    levels.forEach(level => {
                        const option = document.createElement('option');
                        option.value = level.id;
                        option.textContent = level.level_code;
                        levelSelect.appendChild(option);
                    });
                    levelSelect.disabled = false;
                }
            }
        });

        // Écouter le changement de niveau pour charger les emplacements
        document.getElementById('levelSelect').addEventListener('change', async function() {
            const levelId = this.value;
            const slotSelect = document.getElementById('slotSelect');

            // Réinitialiser
            slotSelect.innerHTML = '<option value="">-- Sélectionner un emplacement --</option>';
            slotSelect.disabled = !levelId;

            if (levelId) {
                // Charger les emplacements pour ce niveau
                const { data: slots, error: slotsError } = await supabase
                    .from('w_vuestock_slots')
                    .select('id, slot_code, status')
                    .eq('level_id', levelId)
                    .order('display_order');

                if (!slotsError && slots) {
                    slots.forEach(slot => {
                        const option = document.createElement('option');
                        option.value = slot.id;
                        // Vérifier le statut : 'occupied' au lieu de 'is_occupied'
                        const isOccupied = slot.status === 'occupied';
                        option.textContent = `${slot.slot_code} ${isOccupied ? '(Occupé)' : ''}`;
                        option.disabled = isOccupied;
                        option.style.color = isOccupied ? '#999' : '';
                        slotSelect.appendChild(option);
                    });
                    slotSelect.disabled = false;
                }
            }
        });

    } catch (error) {
        console.error('Erreur chargement emplacements:', error);
    }
}

function updateBarcodePreview(barcode) {
    const canvas = document.getElementById('barcodeCanvas');
    const placeholder = document.querySelector('.barcode-placeholder');

    if (barcode && barcode.length === 13) {
        try {
            // Générer le code-barre avec JsBarcode
            JsBarcode(canvas, barcode, {
                format: "EAN13",
                width: 2,
                height: 100,
                displayValue: true,
                fontSize: 16,
                margin: 10
            });

            canvas.style.display = 'block';
            placeholder.style.display = 'none';
            document.getElementById('barcodeValue').textContent = barcode;

        } catch (error) {
            console.error('Erreur génération code-barre:', error);
            canvas.style.display = 'none';
            placeholder.style.display = 'flex';
            document.getElementById('barcodeValue').textContent = '-';
        }
    } else {
        canvas.style.display = 'none';
        placeholder.style.display = 'flex';
        document.getElementById('barcodeValue').textContent = '-';
    }
}

// ===== GESTION DES ÉVÉNEMENTS =====
function setupEventListeners() {
    // Déconnexion
    document.getElementById('logoutBtn').addEventListener('click', logout);

    // Génération numéro d'article
    document.getElementById('generateNumberBtn').addEventListener('click', generateArticleNumber);

    // Gestion de la photo
    document.getElementById('selectPhotoBtn').addEventListener('click', () => {
        document.getElementById('photoUpload').click();
    });

    document.getElementById('takePhotoBtn').addEventListener('click', takePhoto);
    document.getElementById('removePhotoBtn').addEventListener('click', removePhoto);
    document.getElementById('photoUpload').addEventListener('change', handlePhotoUpload);
    document.getElementById('photoPreview').addEventListener('click', () => {
        document.getElementById('photoUpload').click();
    });

    // Code-barre
    document.getElementById('generateBarcodeBtn').addEventListener('click', generateBarcode);
    document.getElementById('scanBarcodeBtn').addEventListener('click', simulateBarcodeScan);

    // Options code-barre
    document.querySelectorAll('input[name="barcodeOption"]').forEach(radio => {
        radio.addEventListener('change', handleBarcodeOptionChange);
    });

    document.getElementById('manualBarcodeInput').addEventListener('input', handleManualBarcodeInput);

    // Calcul automatique de la valeur
    document.getElementById('initialQuantity').addEventListener('input', calculateTotalValue);
    document.getElementById('unitPrice').addEventListener('input', calculateTotalValue);

    // Mise à jour du récapitulatif en temps réel
    document.getElementById('articleName').addEventListener('input', updateSummary);
    document.getElementById('articleNumber').addEventListener('input', updateSummary);
    document.getElementById('initialQuantity').addEventListener('input', updateSummary);
    document.getElementById('unitPrice').addEventListener('input', updateSummary);

    // Soumission du formulaire
    document.getElementById('creationForm').addEventListener('submit', handleFormSubmit);
    document.getElementById('creationForm').addEventListener('reset', handleFormReset);
}

// ===== GESTION DES PHOTOS =====
async function handlePhotoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Vérifier le type de fichier
    if (!file.type.match('image.*')) {
        alert('Veuillez sélectionner une image (JPG, PNG, WebP)');
        return;
    }

    // Vérifier la taille (5MB max)
    if (file.size > 5 * 1024 * 1024) {
        // Essayer d'optimiser l'image si elle est trop grande
        if (!confirm('L\'image est trop lourde (max 5MB). Voulez-vous l\'optimiser automatiquement ?')) {
            return;
        }
    }

    // Afficher un message de chargement
    const previewImg = document.getElementById('photoPreviewImg');
    const placeholder = document.querySelector('.photo-placeholder');

    placeholder.innerHTML = '<i class="fas fa-spinner fa-spin"></i><p>Optimisation de l\'image...</p>';

    try {
        // Optimiser l'image
        const optimized = await optimizeImage(file);

        currentPhoto = {
            file: optimized.file,
            dataUrl: optimized.dataUrl,
            originalFile: optimized.originalFile
        };

        // Afficher la prévisualisation
        previewImg.src = optimized.dataUrl;
        previewImg.style.display = 'block';
        placeholder.style.display = 'none';

        // Afficher le bouton de suppression
        document.getElementById('removePhotoBtn').style.display = 'flex';

        // Afficher les infos de l'image optimisée
        const sizeMB = (optimized.file.size / 1024 / 1024).toFixed(2);
        console.log(`Image optimisée : ${sizeMB}MB (original: ${(file.size / 1024 / 1024).toFixed(2)}MB)`);

    } catch (error) {
        console.error('Erreur optimisation image:', error);
        alert('Erreur lors du traitement de l\'image');
        placeholder.innerHTML = '<i class="fas fa-image"></i><p>Aucune photo sélectionnée</p><small>Cliquez pour ajouter une photo</small>';
    }
}

function takePhoto() {
    // Pour l'instant, simulation
    // Dans la vraie version, tu utiliserais l'API MediaDevices
    alert('Fonctionnalité de prise de photo à implémenter\n(Pour l\'instant, utilisez "Choisir une photo")');
}

function removePhoto() {
    currentPhoto = null;

    const previewImg = document.getElementById('photoPreviewImg');
    const placeholder = document.querySelector('.photo-placeholder');

    previewImg.style.display = 'none';
    placeholder.style.display = 'flex';
    document.getElementById('removePhotoBtn').style.display = 'none';
    document.getElementById('photoUpload').value = '';
}

// ===== GESTION DU CODE-BARRE =====
function handleBarcodeOptionChange(event) {
    const option = event.target.value;
    const manualInput = document.getElementById('manualBarcodeInput');
    const generateBtn = document.getElementById('generateBarcodeBtn');

    isManualBarcode = option === 'manual';

    if (isManualBarcode) {
        manualInput.disabled = false;
        manualInput.focus();
        generateBtn.disabled = true;

        // Utiliser la valeur manuelle si elle existe
        if (manualInput.value) {
            updateBarcodePreview(manualInput.value);
            updateSummaryField('summaryBarcode', manualInput.value);
        }
    } else {
        manualInput.disabled = true;
        generateBtn.disabled = false;

        // Revenir au code-barre généré
        updateBarcodePreview(generatedBarcode);
        updateSummaryField('summaryBarcode', generatedBarcode);
    }
}

function handleManualBarcodeInput(event) {
    let value = event.target.value.replace(/\D/g, ''); // Garder que les chiffres
    value = value.substring(0, 13); // Max 13 chiffres
    event.target.value = value;

    if (value.length === 13) {
        // Vérifier le checksum EAN-13
        const checksum = calculateEAN13Checksum(value.substring(0, 12));
        if (checksum !== value[12]) {
            alert('Code-barre EAN-13 invalide. Le dernier chiffre devrait être ' + checksum);
        }
    }

    updateBarcodePreview(value);
    updateSummaryField('summaryBarcode', value || '-');
}

// ===== FONCTION DE SCAN RÉELLE =====
function simulateBarcodeScan() {
    // Ouvrir le popup de scan
    openBarcodeScannerPopup();
}

function openBarcodeScannerPopup() {
    const popup = document.createElement('div');
    popup.className = 'scan-popup-overlay';

    popup.innerHTML = `
        <div class="scan-popup">
            <div class="popup-header">
                <h3><i class="fas fa-camera"></i> Scanner un code-barre</h3>
                <button class="close-popup">&times;</button>
            </div>
            <div class="popup-content">
                <div class="scan-section">
                    <div class="camera-placeholder" id="cameraPlaceholder">
                        <i class="fas fa-camera"></i>
                        <p>Prêt à scanner</p>
                    </div>
                    <video id="cameraPreview" autoplay playsinline style="display: none;"></video>
                    <canvas id="scanCanvas" style="display: none;"></canvas>

                    <div class="scan-controls">
                        <button id="startCameraBtn" class="btn btn-primary">
                            <i class="fas fa-video"></i> Activer le scanner
                        </button>
                        <button id="stopCameraBtn" class="btn btn-secondary" style="display: none;">
                            <i class="fas fa-stop"></i> Arrêter
                        </button>
                    </div>
                </div>

                <div class="manual-section">
                    <h4><i class="fas fa-keyboard"></i> Saisie manuelle</h4>
                    <div class="form-group">
                        <input type="text"
                               id="manualBarcodeInput"
                               placeholder="Entrez le code-barre manuellement"
                               class="scan-input">
                        <button id="confirmManualBtn" class="btn btn-success">
                            <i class="fas fa-check"></i> Valider
                        </button>
                    </div>
                </div>

                <div class="scan-instructions">
                    <p><i class="fas fa-lightbulb"></i> Placez le code-barre dans le cadre. Le scan est automatique.</p>
                    <p><i class="fas fa-bolt"></i> Assurez-vous d'avoir une bonne luminosité.</p>
                </div>

                <div id="scanStatus" class="scan-status">
                    <p><i class="fas fa-info-circle"></i> En attente de scan...</p>
                </div>
            </div>

            <div class="popup-footer">
                <button class="btn btn-secondary close-popup-btn">Annuler</button>
            </div>
        </div>
    `;

    document.body.appendChild(popup);

    // Variables
    let stream = null;
    let barcodeDetector = null;
    let animationFrameId = null;

    // Démarrer automatiquement le scanner
    setTimeout(startScanner, 500);

    // Événements de fermeture
    popup.querySelector('.close-popup').addEventListener('click', cleanupAndClose);
    popup.querySelector('.close-popup-btn').addEventListener('click', cleanupAndClose);
    popup.addEventListener('click', function(e) {
        if (e.target === popup) cleanupAndClose();
    });

    // Événements scanner
    popup.querySelector('#startCameraBtn').addEventListener('click', startScanner);
    popup.querySelector('#stopCameraBtn').addEventListener('click', stopScanner);
    popup.querySelector('#confirmManualBtn').addEventListener('click', handleManualInput);
    popup.querySelector('#manualBarcodeInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') handleManualInput();
    });

    // Fonction de nettoyage et fermeture
    function cleanupAndClose() {
        stopScanner();
        if (popup.parentNode) {
            document.body.removeChild(popup);
        }
    }

    // Démarrer le scanner
    async function startScanner() {
        try {
            updateStatus('Initialisation du scanner...', 'info');

            // Vérifier si l'API BarcodeDetector est disponible
            if (!('BarcodeDetector' in window)) {
                throw new Error('Scanner non supporté par votre navigateur');
            }

            // Créer le détecteur
            const supportedFormats = await BarcodeDetector.getSupportedFormats();
            if (supportedFormats.length === 0) {
                throw new Error('Aucun format de code-barre supporté');
            }

            barcodeDetector = new BarcodeDetector({
                formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128']
            });

            // Démarrer la caméra
            stream = await navigator.mediaDevices.getUserMedia({
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

            // Mettre à jour les boutons
            popup.querySelector('#startCameraBtn').style.display = 'none';
            popup.querySelector('#stopCameraBtn').style.display = 'inline-block';

            // Démarrer la détection
            detectBarcodes();

            updateStatus('Scanner actif. Centrez le code-barre...', 'success');

        } catch (error) {
            console.error('Erreur scanner:', error);
            updateStatus(`Erreur: ${error.message}. Utilisez la saisie manuelle.`, 'error');
            popup.querySelector('#manualBarcodeInput').focus();
        }
    }

    // Arrêter le scanner
    function stopScanner() {
        // Arrêter l'animation
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }

        // Arrêter la caméra
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
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

        popup.querySelector('#startCameraBtn').style.display = 'inline-block';
        popup.querySelector('#stopCameraBtn').style.display = 'none';

        updateStatus('Scanner arrêté', 'warning');
    }

    // Détecter les codes-barres
    function detectBarcodes() {
        if (!stream || !barcodeDetector) return;

        const video = popup.querySelector('#cameraPreview');
        const canvas = popup.querySelector('#scanCanvas');
        const context = canvas.getContext('2d');

        if (video.readyState === video.HAVE_ENOUGH_DATA) {
            // Mettre à jour la taille du canvas
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            // Dessiner l'image vidéo sur le canvas
            context.drawImage(video, 0, 0, canvas.width, canvas.height);

            // Détecter les codes-barres
            barcodeDetector.detect(canvas)
                .then(barcodes => {
                    if (barcodes.length > 0) {
                        const barcode = barcodes[0];
                        console.log('Code détecté:', barcode.rawValue);
                        processBarcode(barcode.rawValue);
                    } else {
                        // Continuer la détection
                        animationFrameId = requestAnimationFrame(detectBarcodes);
                    }
                })
                .catch(error => {
                    console.error('Erreur détection:', error);
                    animationFrameId = requestAnimationFrame(detectBarcodes);
                });
        } else {
            animationFrameId = requestAnimationFrame(detectBarcodes);
        }
    }

    // Traiter le code-barre détecté
    function processBarcode(barcode) {
        console.log('Code-barre scanné:', barcode);

        updateStatus(`Code détecté: ${barcode}. Traitement...`, 'success');

        // Fermer le popup
        cleanupAndClose();

        // Mettre à jour le champ manuel dans le formulaire principal
        const manualInput = document.getElementById('manualBarcodeInput');
        if (manualInput) {
            manualInput.value = barcode;
            handleManualBarcodeInput({ target: manualInput });
        }

        // Afficher une notification
        showScanSuccess(barcode);
    }

    // Gérer la saisie manuelle
    function handleManualInput() {
        const manualInput = popup.querySelector('#manualBarcodeInput');
        const barcode = manualInput.value.trim();

        if (!barcode) {
            updateStatus('Veuillez entrer un code-barre', 'error');
            return;
        }

        if (barcode.length < 8) {
            updateStatus('Code-barre trop court', 'error');
            return;
        }

        processBarcode(barcode);
    }

    // Mettre à jour le statut
    function updateStatus(message, type = 'info') {
        const statusDiv = popup.querySelector('#scanStatus');
        const icons = {
            info: 'info-circle',
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle'
        };
        const colors = {
            info: '#2196F3',
            success: '#4CAF50',
            error: '#f44336',
            warning: '#FF9800'
        };

        statusDiv.innerHTML = `
            <p style="color: ${colors[type]}; margin: 0;">
                <i class="fas fa-${icons[type]}"></i> ${message}
            </p>
        `;
    }

    // Afficher un message de succès
    function showScanSuccess(barcode) {
        const successDiv = document.createElement('div');
        successDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 15px;
            border-radius: 8px;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            display: flex;
            align-items: center;
            gap: 10px;
            animation: slideIn 0.3s ease;
            max-width: 300px;
        `;

        successDiv.innerHTML = `
            <i class="fas fa-check-circle" style="font-size: 1.2rem;"></i>
            <div>
                <div style="font-weight: bold; margin-bottom: 4px;">Scan réussi</div>
                <div style="font-size: 0.9rem; opacity: 0.9;">Code: ${barcode}</div>
            </div>
        `;

        document.body.appendChild(successDiv);

        // Animation CSS
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);

        // Supprimer après 3 secondes
        setTimeout(() => {
            if (successDiv.parentNode) {
                document.body.removeChild(successDiv);
            }
            if (style.parentNode) {
                document.head.removeChild(style);
            }
        }, 3000);
    }
}

// ===== CALCULS =====
function calculateTotalValue() {
    const quantity = parseFloat(document.getElementById('initialQuantity').value) || 0;
    const price = parseFloat(document.getElementById('unitPrice').value) || 0;
    const total = quantity * price;

    document.getElementById('totalValueDisplay').textContent = total.toFixed(2) + ' €';
    updateSummaryField('summaryValue', total.toFixed(2) + ' €');
    updateSummaryField('summaryQuantity', quantity);
}

// ===== MISE À JOUR DU RÉCAPITULATIF =====
function updateSummary() {
    updateSummaryField('summaryName', document.getElementById('articleName').value || '-');
    updateSummaryField('summaryNumber', document.getElementById('articleNumber').value || '-');
    updateSummaryField('summaryQuantity', document.getElementById('initialQuantity').value || '0');

    const quantity = parseFloat(document.getElementById('initialQuantity').value) || 0;
    const price = parseFloat(document.getElementById('unitPrice').value) || 0;
    const total = quantity * price;
    updateSummaryField('summaryValue', total.toFixed(2) + ' €');
}

function updateSummaryField(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = value;
    }
}

// ===== SOUMISSION DU FORMULAIRE =====
async function handleFormSubmit(event) {
    event.preventDefault();

    // Récupérer les valeurs du formulaire
    const formData = getFormData();

    // Valider les données
    const validation = validateFormData(formData);
    if (!validation.isValid) {
        showFormError(validation.message);
        return;
    }

    // Désactiver le bouton de soumission
    const submitBtn = document.querySelector('.btn-primary[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Création en cours...';
    submitBtn.disabled = true;

    try {
        // Vérifier si le numéro d'article existe déjà
        const { data: existingArticle, error: checkError } = await supabase
            .from('w_articles')
            .select('id')
            .eq('numero', formData.numero)
            .maybeSingle();

        if (existingArticle && !checkError) {
            showFormError('Ce numéro d\'article existe déjà. Veuillez en choisir un autre.');
            return;
        }

        // Vérifier si le code-barre existe déjà (si fourni)
        if (formData.code_barre) {
            const { data: existingBarcode, error: barcodeError } = await supabase
                .from('w_articles')
                .select('id')
                .eq('code_barre', formData.code_barre)
                .maybeSingle();

            if (existingBarcode && !barcodeError) {
                showFormError('Ce code-barre est déjà utilisé par un autre article.');
                return;
            }
        }

        // Télécharger la photo si elle existe
        let photoUrl = null;
        if (currentPhoto) {
            photoUrl = await uploadPhoto(currentPhoto);
        }

        // Préparer les données pour Supabase
        const articleData = {
            nom: formData.nom,
            numero: formData.numero,
            code_barre: formData.code_barre,
            photo_url: photoUrl,
            caracteristiques: formData.caracteristiques,
            prix_unitaire: formData.prix_unitaire,
            stock_actuel: formData.stock_actuel,
            stock_reserve: 0, // AJOUTÉ ICI
            stock_minimum: formData.stock_minimum,
            reference_interne: formData.reference_interne,

            rack_id: formData.rack_id,
            level_id: formData.level_id,
            slot_id: formData.slot_id,

            actif: true
        };

        // Insérer l'article dans la base de données
        const { data: newArticle, error: insertError } = await supabase
            .from('w_articles')
            .insert([articleData])
            .select()
            .single();

        if (insertError) throw insertError;

        // MISE À JOUR DU SLOT - AJOUTÉ ICI
        if (formData.slot_id) {
            const { error: slotError } = await supabase
                .from('w_vuestock_slots')
                .update({
                    status: 'occupied',
                    updated_at: new Date().toISOString()  // Optionnel mais recommandé
                })
                .eq('id', formData.slot_id);

            if (slotError) {
                console.error('Erreur mise à jour statut slot:', slotError);
                // Vous pouvez décider de gérer cette erreur différemment
                // Par exemple: rollback de la création de l'article
                // ou simplement logger l'erreur
            }
        }

        // Enregistrer le mouvement d'entrée initial
        if (formData.stock_actuel > 0) {
            await supabase
                .from('w_mouvements')
                .insert([
                    {
                        article_id: newArticle.id,
                        type: 'entree',
                        quantite: formData.stock_actuel,
                        projet: 'Stock initial',
                        commentaire: 'Création de l\'article',
                        utilisateur_id: currentUser.id
                    }
                ]);
        }

        // Afficher le message de succès
        showFormSuccess(`Article "${formData.nom}" créé avec succès !`);

        // Réinitialiser le formulaire après un délai
        setTimeout(() => {
            handleFormReset();
            generateArticleNumber();
            generateBarcode();
            removePhoto();
        }, 3000);

    } catch (error) {
        console.error('Erreur lors de la création de l\'article:', error);
        showFormError('Erreur lors de la création de l\'article : ' + error.message);

    } finally {
        // Réactiver le bouton
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

function getFormData() {
    // Récupérer le code-barre selon l'option sélectionnée
    let barcode = '';
    if (isManualBarcode) {
        barcode = document.getElementById('manualBarcodeInput').value.trim();
    } else {
        barcode = generatedBarcode;
    }

    return {
        nom: document.getElementById('articleName').value.trim(),
        numero: document.getElementById('articleNumber').value.trim(),
        code_barre: barcode,
        caracteristiques: document.getElementById('articleDescription').value.trim(),
        reference_interne: document.getElementById('internalReference').value.trim(),
        stock_actuel: parseInt(document.getElementById('initialQuantity').value) || 0,
        stock_minimum: parseInt(document.getElementById('minimumStock').value) || 1,
        prix_unitaire: parseFloat(document.getElementById('unitPrice').value) || 0,

        rack_id: document.getElementById('rackSelect').value ? parseInt(document.getElementById('rackSelect').value) : null,
        level_id: document.getElementById('levelSelect').value ? parseInt(document.getElementById('levelSelect').value) : null,
        slot_id: document.getElementById('slotSelect').value ? parseInt(document.getElementById('slotSelect').value) : null
    };
}

function validateFormData(data) {
    // Vérifier les champs obligatoires
    if (!data.nom) {
        return { isValid: false, message: 'Le nom de l\'article est obligatoire' };
    }

    if (!data.numero) {
        return { isValid: false, message: 'Le numéro d\'article est obligatoire' };
    }

    if (!data.code_barre) {
        return { isValid: false, message: 'Le code-barre est obligatoire' };
    }

    if (data.code_barre.length !== 13) {
        return { isValid: false, message: 'Le code-barre doit contenir 13 chiffres' };
    }

    if (data.stock_actuel < 0) { // CHANGÉ ICI
        return { isValid: false, message: 'La quantité initiale ne peut pas être négative' };
    }

    if (data.stock_minimum < 1) {
        return { isValid: false, message: 'Le stock minimum doit être d\'au moins 1' };
    }

    if (data.prix_unitaire < 0) {
        return { isValid: false, message: 'Le prix unitaire ne peut pas être négatif' };
    }

    return { isValid: true, message: '' };
}

async function uploadPhoto(photo) {
    try {
        // Générer un nom de fichier unique
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 15);
        const fileName = `${timestamp}_${random}.${photo.file.type.split('/')[1] || 'jpg'}`;
        const filePath = `articles/${fileName}`;

        // Convertir DataURL en Blob
        const response = await fetch(photo.dataUrl);
        const blob = await response.blob();

        // Upload vers Supabase Storage
        const { data, error } = await supabase.storage
            .from('Stockfr')
            .upload(filePath, blob, {
                cacheControl: '3600',
                upsert: false
            });

        if (error) throw error;

        // Récupérer l'URL publique
        const { data: { publicUrl } } = supabase.storage
            .from('Stockfr')
            .getPublicUrl(filePath);

        console.log('Photo uploadée:', publicUrl);
        return publicUrl;

    } catch (error) {
        console.error('Erreur lors du téléchargement de la photo:', error);

        // En cas d'erreur, utiliser l'URL de données comme fallback
        // (mais ce n'est pas idéal pour le long terme)
        return photo.dataUrl;
    }
}

// Vérifier si le bucket existe et est accessible
async function checkStorageBucket() {
    try {
        const { data, error } = await supabase.storage
            .from('Stockfr')
            .list('articles', { limit: 1 });

        if (error && error.message.includes('bucket')) {
            console.warn('Bucket non trouvé, tentative de création...');
            return false;
        }

        return true;
    } catch (error) {
        console.error('Erreur vérification bucket:', error);
        return false;
    }
}

// Optimiser l'image avant upload
function optimizeImage(file, maxWidth = 800, maxHeight = 800, quality = 0.8) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Redimensionner si nécessaire
                if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width *= ratio;
                    height *= ratio;
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Convertir en format WebP pour meilleure compression
                canvas.toBlob(function(blob) {
                    const optimizedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + '.webp', {
                        type: 'image/webp',
                        lastModified: Date.now()
                    });

                    const optimizedDataUrl = canvas.toDataURL('image/webp', quality);

                    resolve({
                        file: optimizedFile,
                        dataUrl: optimizedDataUrl,
                        originalFile: file
                    });
                }, 'image/webp', quality);
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function handleFormReset() {
    // Garder le numéro et code-barre générés
    const currentNumber = document.getElementById('articleNumber').value;
    const currentBarcode = isManualBarcode ?
        document.getElementById('manualBarcodeInput').value :
        generatedBarcode;

    // Réinitialiser le formulaire (sauf certains champs)
    document.getElementById('creationForm').reset();

    // Remettre les valeurs générées
    if (!currentNumber.includes('ART-')) {
        generateArticleNumber();
    } else {
        document.getElementById('articleNumber').value = currentNumber;
    }

    if (isManualBarcode) {
        document.getElementById('manualBarcodeInput').value = currentBarcode;
        updateBarcodePreview(currentBarcode);
    } else {
        generateBarcode();
    }

    // Réinitialiser la photo
    removePhoto();

    // Réinitialiser les messages
    hideFormMessages();

    // Mettre à jour le récapitulatif
    updateSummary();
    calculateTotalValue();
}

// ===== GESTION DES MESSAGES =====
function showFormError(message) {
    const errorDiv = document.getElementById('formError');
    const errorText = document.getElementById('formErrorText');
    const successDiv = document.getElementById('formSuccess');

    errorText.textContent = message;
    errorDiv.style.display = 'flex';
    successDiv.style.display = 'none';

    // Scroll vers l'erreur
    errorDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function showFormSuccess(message) {
    const successDiv = document.getElementById('formSuccess');
    const successText = document.getElementById('formSuccessText');
    const errorDiv = document.getElementById('formError');

    successText.textContent = message;
    successDiv.style.display = 'flex';
    errorDiv.style.display = 'none';

    // Scroll vers le succès
    successDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function hideFormMessages() {
    document.getElementById('formError').style.display = 'none';
    document.getElementById('formSuccess').style.display = 'none';
}

// ===== UTILITAIRES =====
function logout() {
    if (!confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
        return;
    }

    sessionStorage.removeItem('current_user');
    sessionStorage.removeItem('supabase_token');
    window.location.href = 'connexion.html';
}