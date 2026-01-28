// ===== CONFIGURATION DEBUG =====
const DEBUG = {
    enabled: true,
    quadView: false,    // Mettre à false pour désactiver logs QuadView
    canvas: false,      // Mettre à false pour désactiver logs Canvas
    api: true,          // Garder true pour les erreurs API
    clics: false        // Mettre à false pour désactiver logs clics
};

// Fonction helper pour les logs
function debugLog(category, ...args) {
    if (DEBUG.enabled && DEBUG[category]) {
        console.log(`[${category}]`, ...args);
    }
}

// ===== DÉBOGAGE =====
console.log('vuestock.js chargé');

// Vérifier que tous les éléments DOM existent
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM chargé');

    const requiredElements = [
        'btnAddRack', 'canvasPlan', 'planOverlay',
        'rackModal', 'modalOverlay'
    ];

    requiredElements.forEach(id => {
        const el = document.getElementById(id);
        console.log(`${id}:`, el ? 'OK' : 'MANQUANT');
    });
});

// ===== CLASSE API MANAGER POUR NETLIFY =====
class ApiManager {
    constructor() {
        this.baseUrl = window.location.origin;
        this.endpoints = {
            getConfig: '/vuestock-api?action=get-config',
            saveRack: '/vuestock-api?action=save-rack',
            deleteRack: '/vuestock-api?action=delete-rack',
            saveLevel: '/vuestock-api?action=save-level',
            saveSlot: '/vuestock-api?action=save-slot',
            searchArticle: '/vuestock-api?action=search-article',
            updateStock: '/vuestock-api?action=update-stock'
        };
    }


    async request(endpoint, method = 'GET', data = null) {
        const url = `${this.baseUrl}${endpoint}`;
        console.log('📡 API Call:', url, method, data);

        console.log('Testez cette URL:', url);

        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
        };

        if (data && (method === 'POST' || method === 'PUT')) {
            options.body = JSON.stringify(data);
        }

        try {
            const response = await fetch(url, options);

            console.log('📡 Response status:', response.status);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            console.log('📡 Response data:', result);

            if (result.error) {
                throw new Error(result.error);
            }

            return result;

        } catch (error) {
            console.error('❌ API Request failed:', error);
            throw error;
        }
    }

    // Méthodes spécifiques
    async getFullConfig() {
        return await this.request(this.endpoints.getConfig);
    }

    async saveRack(rackData) {
        return await this.request(this.endpoints.saveRack, 'POST', rackData);
    }

    async deleteRack(rackId) {
        // ✅ L'ID doit être dans l'URL, pas dans le body
        return await this.request(`${this.endpoints.deleteRack}&rackId=${rackId}`, 'DELETE');
    }

    async saveLevel(levelData) {
        return await this.request(this.endpoints.saveLevel, 'POST', levelData);
    }

    async saveSlot(slotData) {
        return await this.request(this.endpoints.saveSlot, 'POST', slotData);
    }

    async searchArticles(searchTerm) {
        return await this.request(`${this.endpoints.searchArticle}&q=${encodeURIComponent(searchTerm)}`);
    }

    async updateStock(stockData) {
        return await this.request(this.endpoints.updateStock, 'POST', stockData);
    }
}


// ===== CLASSE CANVAS MANAGER =====
class CanvasManager {
    constructor(canvasId, overlayId) {
        // Bind explicite de TOUTES les méthodes
        this.drawGrid = this.drawGrid.bind(this);
        this.updateCoordinatesDisplay = this.updateCoordinatesDisplay.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
        this.cleanupEvents = this.cleanupEvents.bind(this);
        this.startRackDrag = this.startRackDrag.bind(this);
        this.dragRack = this.dragRack.bind(this);
        this.selectRack = this.selectRack.bind(this);
        this.startResize = this.startResize.bind(this);
        this.startRotation = this.startRotation.bind(this);
        this.handleResize = this.handleResize.bind(this);
        this.handleRotation = this.handleRotation.bind(this);
        this.saveAutoPosition = this.saveAutoPosition.bind(this);
        this._clickInProgress = false;

        // Initialiser les propriétés
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.overlay = document.getElementById(overlayId);

        // Configuration
        this.gridSize = 40;
        this.scale = 1;
        this.offsetX = 0;
        this.offsetY = 0;
        this.isDragging = false;
        this.isResizing = false;
        this.isRotating = false;
        this.selectedRack = null;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.currentTool = 'select';

        // État de la souris
        this.mouseX = 0;
        this.mouseY = 0;
        this.gridX = 0;
        this.gridY = 0;

        // Variables pour le drag/resize/rotate
        this.currentRack = null;
        this.currentElement = null;
        this.resizeHandle = null;
        this.resizeStartData = null;
        this.rotateStartData = null;

        // Sauvegarde automatique
        this.saveTimeout = null;
        this.racks = [];

        // Initialisation
        this.initCanvas();
        this.drawGrid();
        this.initEvents();
    }

    // === MÉTHODES ===
    drawGrid() {
        if (!this.ctx || !this.canvas) return;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        const width = this.canvas.width;
        const height = this.canvas.height;
        const gridSize = this.gridSize * this.scale;

        // Calculer les positions de départ avec l'offset
        const startX = -this.offsetX % gridSize;
        const startY = -this.offsetY % gridSize;

        // Dessiner la grille
        this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
        this.ctx.lineWidth = 1;

        // Lignes verticales
        for (let x = startX; x < width; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, height);
            this.ctx.stroke();
        }

        // Lignes horizontales
        for (let y = startY; y < height; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(width, y);
            this.ctx.stroke();
        }

        // Points de grille tous les 4 carreaux
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
        for (let x = startX; x < width; x += gridSize * 4) {
            for (let y = startY; y < height; y += gridSize * 4) {
                this.ctx.beginPath();
                this.ctx.arc(x, y, 2, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }

        // Mettre à jour les coordonnées affichées
        this.updateCoordinatesDisplay();
    }

    updateCoordinatesDisplay() {
        const coordsElement = document.getElementById('mouseCoords');
        const scaleElement = document.getElementById('scaleDisplay');

        if (coordsElement) {
            const gridX = Math.round(this.gridX / this.gridSize);
            const gridY = Math.round(this.gridY / this.gridSize);
            coordsElement.textContent = `X: ${gridX}, Y: ${gridY}`;
        }

        if (scaleElement) {
            scaleElement.textContent = `${Math.round(this.scale * 100)}%`;
        }
    }

    initCanvas() {
        this.canvas.width = this.canvas.offsetWidth;
        this.canvas.height = this.canvas.offsetHeight;
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';
    }

    cleanupEvents() {
        document.removeEventListener('mousemove', this.handleMouseMove);
        document.removeEventListener('mouseup', this.handleMouseUp);
        document.removeEventListener('mousemove', this.handleResize);
        document.removeEventListener('mousemove', this.handleRotation);
    }

    handleMouseMove(e) {
        if (this.isDragging && this.currentRack && this.currentElement) {
            this.dragRack(e);
        }
    }

    handleMouseUp() {
        this.cleanupEvents();

        if (this.isDragging) {
            this.isDragging = false;
            this.currentRack = null;
            this.currentElement = null;

            if (this.selectedRack) {
                this.saveAutoPosition();
            }
        }

        if (this.isResizing) {
            this.isResizing = false;
            this.resizeHandle = null;
            this.resizeStartData = null;

            if (this.selectedRack) {
                this.saveAutoPosition();
            }
        }

        if (this.isRotating) {
            this.isRotating = false;
            this.rotateStartData = null;

            if (this.selectedRack) {
                this.saveAutoPosition();
            }
        }
    }

    // === MÉTHODES POUR LES ÉTAGÈRES ===
    addRackToCanvas(rack) {
        debugLog('canvas', 'addRackToCanvas called for rack:', rack.id, rack.code);

        // Vérifier si l'étagère existe déjà
        const existingElement = this.overlay.querySelector(`[data-rack-id="${rack.id}"]`);
        if (existingElement) {
            existingElement.remove();
            this.racks = this.racks.filter(item => item.rack.id !== rack.id);
        }

        // Créer l'élément DOM
        const rackElement = document.createElement('div');
        rackElement.className = 'rack-on-plan';
        rackElement.dataset.rackId = rack.id;
        rackElement.style.position = 'absolute';
        rackElement.style.left = `${rack.position_x}px`;
        rackElement.style.top = `${rack.position_y}px`;
        rackElement.style.width = `${rack.width * this.gridSize}px`;
        rackElement.style.height = `${rack.depth * this.gridSize}px`;
        rackElement.style.backgroundColor = rack.color || '#4a90e2';
        rackElement.style.border = '2px solid #333';
        rackElement.style.borderRadius = '4px';
        rackElement.style.transform = rack.rotation ? `rotate(${rack.rotation}deg)` : '';
        rackElement.style.transformOrigin = 'center center';
        rackElement.style.cursor = 'move';
        rackElement.style.zIndex = '10';
        rackElement.textContent = rack.code;
        rackElement.style.display = 'flex';
        rackElement.style.alignItems = 'center';
        rackElement.style.justifyContent = 'center';
        rackElement.style.color = '#fff';
        rackElement.style.fontWeight = 'bold';
        rackElement.style.userSelect = 'none';

        // Ajouter les poignées
        this.addRackHandles(rackElement, rack);

        // Événements
        rackElement.addEventListener('mousedown', (e) => {
            this.startRackDrag(e, rack, rackElement);
        });

        rackElement.addEventListener('click', (e) => {
            e.stopPropagation();
            this.selectRack(rack, rackElement);
        });

        this.overlay.appendChild(rackElement);
        this.racks.push({ rack, element: rackElement });

        // Auto-sélection pour les nouvelles étagères
        if (!rack.id || rack.id.toString().includes('new')) {
            setTimeout(() => {
                this.selectRack(rack, rackElement);
            }, 100);
        }
    }

    addRackHandles(rackElement, rack) {
        // Poignées de redimensionnement
        const handles = [
            { class: 'handle-nw', cursor: 'nw-resize', top: '0', left: '0' },
            { class: 'handle-ne', cursor: 'ne-resize', top: '0', right: '0' },
            { class: 'handle-sw', cursor: 'sw-resize', bottom: '0', left: '0' },
            { class: 'handle-se', cursor: 'se-resize', bottom: '0', right: '0' }
        ];

        handles.forEach(handle => {
            const handleEl = document.createElement('div');
            handleEl.className = `rack-handle ${handle.class}`;
            handleEl.style.position = 'absolute';
            handleEl.style.width = '12px';
            handleEl.style.height = '12px';
            handleEl.style.backgroundColor = '#fff';
            handleEl.style.border = '2px solid #007bff';
            handleEl.style.borderRadius = '2px';
            handleEl.style.cursor = handle.cursor;
            handleEl.style.zIndex = '20';

            if (handle.top) handleEl.style.top = handle.top;
            if (handle.bottom) handleEl.style.bottom = handle.bottom;
            if (handle.left) handleEl.style.left = handle.left;
            if (handle.right) handleEl.style.right = handle.right;

            handleEl.style.display = 'none';

            handleEl.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                e.preventDefault();
                this.startResize(e, rack, rackElement, handleEl);
            });

            rackElement.appendChild(handleEl);
        });

        // Poignée de rotation
        const rotateHandle = document.createElement('div');
        rotateHandle.className = 'rotate-handle';
        rotateHandle.innerHTML = '⟳';
        rotateHandle.style.position = 'absolute';
        rotateHandle.style.top = '-25px';
        rotateHandle.style.left = '50%';
        rotateHandle.style.transform = 'translateX(-50%)';
        rotateHandle.style.width = '20px';
        rotateHandle.style.height = '20px';
        rotateHandle.style.backgroundColor = '#fff';
        rotateHandle.style.border = '2px solid #007bff';
        rotateHandle.style.borderRadius = '50%';
        rotateHandle.style.cursor = 'grab';
        rotateHandle.style.display = 'flex';
        rotateHandle.style.alignItems = 'center';
        rotateHandle.style.justifyContent = 'center';
        rotateHandle.style.fontSize = '12px';
        rotateHandle.style.zIndex = '20';
        rotateHandle.style.display = 'none';

        rotateHandle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            this.startRotation(e, rack, rackElement);
        });

        rackElement.appendChild(rotateHandle);

        // Dimensions
        const dimensions = document.createElement('div');
        dimensions.className = 'rack-dimensions';
        dimensions.style.position = 'absolute';
        dimensions.style.bottom = '-25px';
        dimensions.style.left = '50%';
        dimensions.style.transform = 'translateX(-50%)';
        dimensions.style.fontSize = '12px';
        dimensions.style.color = '#666';
        dimensions.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
        dimensions.style.padding = '2px 6px';
        dimensions.style.borderRadius = '3px';
        dimensions.style.zIndex = '15';
        dimensions.style.display = 'none';

        const width = rack.width;
        const depth = rack.depth;
        dimensions.textContent = `${width}×${depth}`;
        rackElement.appendChild(dimensions);
    }

    startRackDrag(e, rack, element) {
        // ✅ AJOUTEZ CECI EN PREMIER
        // Si l'outil delete est actif, supprimer directement
        if (this.currentTool === 'delete') {
            if (confirm('Supprimer cette étagère et tous ses étages/emplacements ?')) {
                this.deleteRack(rack.id);
            }
            return; // Ne pas continuer
        }

        // Vérifier si on clique sur une poignée
        const handle = e.target.closest('.rack-handle, .rotate-handle');
        if (handle) {
            if (handle.classList.contains('rotate-handle')) {
                this.startRotation(e, rack, element);
            } else {
                this.startResize(e, rack, element, handle);
            }
            return;
        }

        // Autoriser le déplacement avec les outils "move" et "select"
        if (this.currentTool !== 'move' && this.currentTool !== 'select') {
            return;
        }

        // Sinon, déplacement normal
        this.isDragging = true; // ← Première fois
        this.currentRack = rack;
        this.currentElement = element;
        this.dragStartX = e.clientX - rack.position_x;
        this.dragStartY = e.clientY - rack.position_y;

        // Sélectionner l'étagère
        this.selectRack(rack, element);
        // this.isDragging = true; ← ❌ SUPPRIMEZ CETTE LIGNE (doublon)

        // Ajouter les événements globaux
        document.addEventListener('mousemove', this.handleMouseMove);
        document.addEventListener('mouseup', this.handleMouseUp);
    }

    dragRack(e) {
        if (!this.isDragging || !this.currentRack || !this.currentElement) return;

        let newX = e.clientX - this.dragStartX;
        let newY = e.clientY - this.dragStartY;

        // ✅ CORRECTION : Utiliser la taille de grille Quad (20px) au lieu de Canvas (40px)
        const gridSize = 20; // Taille de grille dans QuadView
        newX = Math.round(newX / gridSize) * gridSize;
        newY = Math.round(newY / gridSize) * gridSize;

        // ✅ CORRECTION : Calculer les limites AVEC le scale
        const scale = this.topViewScale || 1;
        const canvasWidth = this.canvasTop.width / scale;  // Largeur réelle avec scale
        const canvasHeight = this.canvasTop.height / scale; // Hauteur réelle avec scale

        const rackWidth = this.currentRack.displayWidth;
        const rackHeight = this.currentRack.displayHeight;

        // ✅ Permettre le déplacement sur TOUTE la largeur
        newX = Math.max(0, Math.min(newX, canvasWidth - rackWidth));
        newY = Math.max(0, Math.min(newY, canvasHeight - rackHeight));

        // Mettre à jour
        this.currentRack.position_x = newX;
        this.currentRack.position_y = newY;
        this.currentElement.style.left = `${newX}px`;
        this.currentElement.style.top = `${newY}px`;

        this.updatePropertiesPanel(this.currentRack);
    }

    selectRack(rack, element) {
        // Désélectionner toutes les autres
        document.querySelectorAll('.rack-on-plan').forEach(el => {
            el.classList.remove('selected');
            el.style.zIndex = '10';
            el.querySelectorAll('.rack-handle, .rotate-handle, .rack-dimensions').forEach(h => {
                h.style.display = 'none';
            });
        });

        // Sélectionner celle-ci
        element.classList.add('selected');
        element.style.zIndex = '20';
        this.selectedRack = rack;

        // Montrer les poignées
        element.querySelectorAll('.rack-handle, .rotate-handle, .rack-dimensions').forEach(h => {
            h.style.display = 'block';
        });

        this.updatePropertiesPanel(rack);
    }

    startResize(e, rack, element, handle) {
        e.stopPropagation();
        this.isResizing = true;
        this.currentRack = rack;
        this.currentElement = element;
        this.resizeHandle = handle;

        this.resizeStartData = {
            width: rack.width,
            height: rack.depth,
            x: rack.position_x,
            y: rack.position_y,
            mouseX: e.clientX,
            mouseY: e.clientY
        };

        // Ajouter les événements globaux
        document.addEventListener('mousemove', this.handleResize);
        document.addEventListener('mouseup', this.handleMouseUp);
    }

    handleResize(e) {
        if (!this.isResizing || !this.resizeStartData || !this.currentRack || !this.currentElement) return;

        const deltaX = e.clientX - this.resizeStartData.mouseX;
        const deltaY = e.clientY - this.resizeStartData.mouseY;

        let newWidth = this.resizeStartData.width;
        let newHeight = this.resizeStartData.height;
        let newX = this.resizeStartData.x;
        let newY = this.resizeStartData.y;

        // Calcul selon la poignée utilisée
        const gridDeltaX = Math.round(deltaX / this.gridSize);
        const gridDeltaY = Math.round(deltaY / this.gridSize);

        const handleType = this.resizeHandle.className.replace('rack-handle ', '');

        switch(handleType) {
            case 'handle-se':
                newWidth = Math.max(1, this.resizeStartData.width + gridDeltaX);
                newHeight = Math.max(1, this.resizeStartData.height + gridDeltaY);
                break;
            case 'handle-sw':
                newWidth = Math.max(1, this.resizeStartData.width - gridDeltaX);
                newHeight = Math.max(1, this.resizeStartData.height + gridDeltaY);
                newX = this.resizeStartData.x + (gridDeltaX * this.gridSize);
                break;
            case 'handle-ne':
                newWidth = Math.max(1, this.resizeStartData.width + gridDeltaX);
                newHeight = Math.max(1, this.resizeStartData.height - gridDeltaY);
                newY = this.resizeStartData.y + (gridDeltaY * this.gridSize);
                break;
            case 'handle-nw':
                newWidth = Math.max(1, this.resizeStartData.width - gridDeltaX);
                newHeight = Math.max(1, this.resizeStartData.height - gridDeltaY);
                newX = this.resizeStartData.x + (gridDeltaX * this.gridSize);
                newY = this.resizeStartData.y + (gridDeltaY * this.gridSize);
                break;
        }

        // Limites
        const canvasWidth = this.canvas.width;
        const canvasHeight = this.canvas.height;
        const rackWidth = newWidth * this.gridSize;
        const rackHeight = newHeight * this.gridSize;

        if (newX < 0) newX = 0;
        if (newY < 0) newY = 0;
        if (newX + rackWidth > canvasWidth) newX = canvasWidth - rackWidth;
        if (newY + rackHeight > canvasHeight) newY = canvasHeight - rackHeight;

        // Mettre à jour
        this.currentRack.width = newWidth;
        this.currentRack.depth = newHeight;
        this.currentRack.position_x = newX;
        this.currentRack.position_y = newY;

        this.currentElement.style.width = `${newWidth * this.gridSize}px`;
        this.currentElement.style.height = `${newHeight * this.gridSize}px`;
        this.currentElement.style.left = `${newX}px`;
        this.currentElement.style.top = `${newY}px`;

        // Mettre à jour l'affichage des dimensions
        const dims = this.currentElement.querySelector('.rack-dimensions');
        if (dims) {
            dims.textContent = `${newWidth}×${newHeight}`;
        }

        this.updatePropertiesPanel(this.currentRack);
    }

    startRotation(e, rack, element) {
        e.stopPropagation();
        this.isRotating = true;
        this.currentRack = rack;
        this.currentElement = element;

        const rect = element.getBoundingClientRect();
        this.rotateStartData = {
            centerX: rect.left + rect.width / 2,
            centerY: rect.top + rect.height / 2,
            startAngle: Math.atan2(e.clientY - (rect.top + rect.height / 2), e.clientX - (rect.left + rect.width / 2)),
            startRotation: rack.rotation || 0
        };

        // Ajouter les événements globaux
        document.addEventListener('mousemove', this.handleRotation);
        document.addEventListener('mouseup', this.handleMouseUp);
    }

    handleRotation(e) {
        if (!this.isRotating || !this.rotateStartData || !this.currentRack || !this.currentElement) return;

        const currentAngle = Math.atan2(
            e.clientY - this.rotateStartData.centerY,
            e.clientX - this.rotateStartData.centerX
        );
        const deltaAngle = (currentAngle - this.rotateStartData.startAngle) * (180 / Math.PI);
        let newRotation = (this.rotateStartData.startRotation + deltaAngle) % 360;

        if (newRotation < 0) newRotation += 360;

        // Snap à 15 degrés
        newRotation = Math.round(newRotation / 15) * 15;

        this.currentRack.rotation = newRotation;
        this.currentElement.style.transform = `rotate(${newRotation}deg)`;

        this.updatePropertiesPanel(this.currentRack);
    }

    saveAutoPosition() {
        if (!this.selectedRack || !window.vueStock) return;

        clearTimeout(this.saveTimeout);
        this.saveTimeout = setTimeout(() => {
            // CORRECTION : Toujours envoyer l'ID pour une mise à jour
            const payload = {
                id: this.selectedRack.id, // <-- AJOUTER CE LÀ !
                position_x: this.selectedRack.position_x,
                position_y: this.selectedRack.position_y,
                rotation: this.selectedRack.rotation || 0,
                width: this.selectedRack.width,
                depth: this.selectedRack.depth,
                color: this.selectedRack.color
            };

            // Si l'étagère a un code/nom, les inclure aussi
            if (this.selectedRack.code) {
                payload.code = this.selectedRack.code;
            }
            if (this.selectedRack.name) {
                payload.name = this.selectedRack.name;
            }

            console.log('💾 Auto-saving rack with ID:', this.selectedRack.id);

            window.vueStock.api.saveRack(payload)
                .then((result) => {
                    console.log('✅ Auto-save successful:', result);
                })
                .catch(err => {
                    console.error('❌ Erreur auto-save:', err);
                });
        }, 1000); // 1 seconde après la dernière modification
    }

    updatePropertiesPanel(rack) {
        const panel = document.getElementById('propertiesPanel');
        if (!panel || !rack) return;

        panel.innerHTML = `
            <h4>Étagère ${rack.code}</h4>
            <div class="property-group">
                <div class="property">
                    <span class="property-label">Position:</span>
                    <span class="property-value">${Math.round(rack.position_x / this.gridSize)}, ${Math.round(rack.position_y / this.gridSize)}</span>
                </div>
                <div class="property">
                    <span class="property-label">Dimensions:</span>
                    <span class="property-value">${rack.width} × ${rack.depth} cases</span>
                </div>
                <div class="property">
                    <span class="property-label">Rotation:</span>
                    <span class="property-value">${rack.rotation || 0}°</span>
                </div>
                <div class="property">
                    <span class="property-label">Couleur:</span>
                    <input type="color" value="${rack.color || '#4a90e2'}" class="property-color" data-rack-id="${rack.id}">
                </div>
            </div>
            <button class="btn btn-sm btn-block view-rack-btn" data-rack-id="${rack.id}">
                <i class="fas fa-eye"></i> Voir les étages
            </button>
            <button class="btn btn-sm btn-danger btn-block delete-rack-btn" data-rack-id="${rack.id}">
                <i class="fas fa-trash"></i> Supprimer
            </button>
        `;

        // ✅ Événements directs (pas de délégation empilée)
        const colorInput = panel.querySelector('.property-color');
        if (colorInput) {
            colorInput.addEventListener('change', (e) => {
                rack.color = e.target.value;
                const element = this.overlay.querySelector(`[data-rack-id="${rack.id}"]`);
                if (element) {
                    element.style.backgroundColor = rack.color;
                    this.saveAutoPosition();
                }
            });
        }

        const viewBtn = panel.querySelector('.view-rack-btn');
        if (viewBtn) {
            viewBtn.addEventListener('click', () => {
                if (window.vueStock) {
                    window.vueStock.goToRackView(rack);
                }
            });
        }

        // ✅ Événement direct pour le bouton supprimer (une seule fois)
        const deleteBtn = panel.querySelector('.delete-rack-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                if (confirm('Supprimer cette étagère et tous ses étages/emplacements ?')) {
                    this.deleteRack(rack.id);
                }
            });
        }
    }


    async deleteRack(rackId) {
        try {
            // ✅ CORRECTION : Passer l'ID dans l'URL, pas dans le body
            if (window.vueStock?.api) {
                await window.vueStock.api.deleteRack(rackId);
            }

            // Supprimer du DOM
            const element = this.overlay.querySelector(`[data-rack-id="${rackId}"]`);
            if (element) {
                element.remove();
            }

            // Supprimer du tableau
            this.racks = this.racks.filter(item => item.rack.id !== rackId);

            // Supprimer aussi du tableau de VueStock
            if (window.vueStock) {
                window.vueStock.racks = window.vueStock.racks.filter(r => r.id !== rackId);
            }

            // Réinitialiser la sélection
            this.selectedRack = null;

            // Mettre à jour le panneau
            const panel = document.getElementById('propertiesPanel');
            if (panel) {
                panel.innerHTML = '<p class="no-selection">Sélectionnez un élément pour voir ses propriétés</p>';
            }

            // Mettre à jour les statistiques
            if (window.vueStock) {
                window.vueStock.updateStats();
            }

            console.log('🗑️ Étagère supprimée:', rackId);

        } catch (error) {
            console.error('Erreur lors de la suppression:', error);
            alert('Erreur: ' + error.message);
        }
    }

    getRackById(rackId) {
        const item = this.racks.find(item => item.rack.id === rackId);
        return item ? item.rack : null;
    }

    initEvents() {
        // Suivi de la souris
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouseX = e.clientX - rect.left;
            this.mouseY = e.clientY - rect.top;

            // Convertir en coordonnées grille
            this.gridX = this.mouseX + this.offsetX;
            this.gridY = this.mouseY + this.offsetY;

            this.updateCoordinatesDisplay();
        });

        // Zoom avec molette
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();

            const zoomIntensity = 0.1;
            const oldScale = this.scale;

            if (e.deltaY < 0) {
                // Zoom in
                this.scale = Math.min(3, this.scale * (1 + zoomIntensity));
            } else {
                // Zoom out
                this.scale = Math.max(0.2, this.scale * (1 - zoomIntensity));
            }

            // Ajuster l'offset pour zoomer vers la souris
            const scaleRatio = this.scale / oldScale;
            this.offsetX = this.mouseX * (1 - scaleRatio) + this.offsetX * scaleRatio;
            this.offsetY = this.mouseY * (1 - scaleRatio) + this.offsetY * scaleRatio;

            this.drawGrid();
            this.updateCoordinatesDisplay();
        });

        // Outils - ATTENTION AUX ID
        const toolButtons = document.querySelectorAll('.tool-btn');
        toolButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                toolButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentTool = btn.dataset.tool;

                // Si outil "rack", créer une nouvelle étagère au clic
                if (this.currentTool === 'rack') {
                    this.canvas.style.cursor = 'crosshair';
                } else {
                    this.canvas.style.cursor = 'default';
                }
            });
        });

        // Clic sur le canvas pour créer une étagère
        this.canvas.addEventListener('click', async (e) => {
            // ✅ Protection contre double clic
            if (this._clickInProgress) return;

            if (this.currentTool === 'rack') {
                this._clickInProgress = true;

                try {
                    const rect = this.canvas.getBoundingClientRect();
                    const x = e.clientX - rect.left - this.offsetX;
                    const y = e.clientY - rect.top - this.offsetY;

                    const gridX = Math.round(x / this.gridSize) * this.gridSize;
                    const gridY = Math.round(y / this.gridSize) * this.gridSize;

                    if (window.vueStock) {
                        // Trouver le prochain code disponible
                        const existingCodes = window.vueStock.racks.map(r => r.code);
                        let nextCode = 'A';
                        let charCode = 65;

                        while (existingCodes.includes(nextCode)) {
                            charCode++;
                            nextCode = String.fromCharCode(charCode);
                            if (charCode > 90) break; // Sécurité
                        }

                        await window.vueStock.addRack({
                            code: nextCode,
                            x: gridX,
                            y: gridY,
                            width: 3,
                            depth: 2,
                            color: this.getRandomColor()
                        });

                        const selectTool = document.querySelector('[data-tool="select"]');
                        if (selectTool) {
                            selectTool.click();
                        }
                    }
                } finally {
                    // ✅ Débloquer après 500ms (sécurité)
                    setTimeout(() => {
                        this._clickInProgress = false;
                    }, 500);
                }
            }
        }, { once: false }); // Vérifier qu'il n'y a qu'UN seul addEventListener pour 'click'

        // Boutons de zoom - VÉRIFIER LES ID
        const zoomInBtn = document.getElementById('btnZoomIn');
        const zoomOutBtn = document.getElementById('btnZoomOut');
        const zoomResetBtn = document.getElementById('btnZoomReset');
        const gridToggleBtn = document.getElementById('btnGridToggle');

        zoomInBtn?.addEventListener('click', () => {
            this.scale = Math.min(3, this.scale * 1.2);
            this.drawGrid();
        });

        zoomOutBtn?.addEventListener('click', () => {
            this.scale = Math.max(0.2, this.scale / 1.2);
            this.drawGrid();
        });

        zoomResetBtn?.addEventListener('click', () => {
            this.scale = 1;
            this.offsetX = 0;
            this.offsetY = 0;
            this.drawGrid();
        });

        // Grille magnétique toggle
        gridToggleBtn?.addEventListener('click', () => {
            const isActive = gridToggleBtn.classList.contains('active');

            if (isActive) {
                gridToggleBtn.classList.remove('active');
                gridToggleBtn.innerHTML = '<i class="fas fa-th"></i> Grille';
                // Cacher la grille
                this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            } else {
                gridToggleBtn.classList.add('active');
                gridToggleBtn.innerHTML = '<i class="fas fa-th"></i> Grille ON';
                // Afficher la grille
                this.drawGrid();
            }
        });
    }

    getRandomColor() {
        const colors = [
            '#4a90e2', '#7b68ee', '#2ecc71', '#f39c12',
            '#e74c3c', '#9b59b6', '#1abc9c', '#34495e'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }
}

// vuestock.js - AJOUTEZ après la classe CanvasManager

class QuadViewManager {
    constructor() {
        if (window.quadViewInitialized) {
            console.log('⚠️ QuadViewManager déjà initialisé');
            return;
        }
        window.quadViewInitialized = true;

        this.currentView = 'quad'; // 'quad' ou 'single'
        this.selectedRack = null;
        this.selectedLevel = null;

        // Propriétés pour la vue 3D isométrique rotative
        this.rotation3D = 0; // Angle de rotation actuel (0-360°)
        this.isDragging3D = false; // Est-ce qu'on fait tourner la vue
        this.drag3DStartX = 0; // Position X de départ du drag
        this.isometric = {
            angle: 30, // Angle isométrique (30° par défaut)
            scale: 0.8, // Échelle de rendu
            offsetX: 0, // Décalage horizontal
            offsetY: 0  // Décalage vertical
        };

        // Propriétés pour Vision Rayons X
        this.hoveredRack = null; // Rack actuellement survolé
        this.xrayProgress = 0; // Progression de l'effet rayons X (0 à 1)
        this.xrayAnimFrame = null; // Frame d'animation rayons X

        // Propriétés pour Zoom sur clic
        this.focusedRack = null; // Rack actuellement en focus (zoom)
        this.zoomProgress = 0; // Progression du zoom (0 à 1)
        this.zoomAnimFrame = null; // Frame d'animation zoom
        this.camera = {
            targetRotation: 0, // Rotation cible de la caméra
            targetScale: 1, // Échelle cible (1 = normal, 2 = zoom x2)
            currentScale: 1 // Échelle actuelle
        };

        this.initStockModal();

        this.cameraFocusIndex = 0; // Index du rack centré
        this.currentOffset = 0;    // Position actuelle de la caméra (pour animation)
        this.draggedRack = null;
        this.selectedRackZOffset = 0; // Décalage en Z pour le rack sélectionné
        this.selectedRackAnimProgress = 0; // Progression de l'animation



        // Canvases
        this.canvasTop = document.getElementById('canvasTop');
        this.canvasFront = document.getElementById('canvasFront');
        this.canvas3D = document.getElementById('canvas3D');

        // Contexts
        this.ctxTop = this.canvasTop?.getContext('2d');
        this.ctxFront = this.canvasFront?.getContext('2d');
        this.ctx3D = this.canvas3D?.getContext('2d');

        // Dimensions par défaut (seront ajustées)
        this.rackHeightPerLevel = 40; // px par niveau
        this.slotSize = 60; // px par emplacement

        this.init();
    }

    init() {
        console.log('QuadViewManager initialisé');

        // DEBUG : Vérifier l'état des canvas
        console.log('Canvas Top:', this.canvasTop, 'Context:', this.ctxTop);
        console.log('Canvas Front:', this.canvasFront, 'Context:', this.ctxFront);
        console.log('Canvas 3D:', this.canvas3D, 'Context:', this.ctx3D);

        // Dessiner un état initial vide
        this.drawEmptyState();

        // Ajuster les dimensions des canvas
        this.resizeCanvases();

        // Événements de redimensionnement
        window.addEventListener('resize', () => this.resizeCanvases());

        // AJOUT IMPORTANT : Événement clic sur le canvas haut-gauche
        if (this.canvasTop) {
            // Mousedown pour démarrer le drag
            this.canvasTop.addEventListener('mousedown', (e) => {
                this.isDragging = false;
                this.isResizing = false;
                this.isRotating = false;
                this.draggedRack = null;

                const rect = this.canvasTop.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                const clickedRack = this.findRackAtPosition(x, y);

                if (!clickedRack) {
                    return;
                }

                // ✅ Si c'est un rack DIFFÉRENT, le sélectionner
                if (!this.selectedRack || clickedRack.id !== this.selectedRack.id) {
                    // Fermer le tiroir
                    const container = document.getElementById('quadLevelSlots');
                    if (container) {
                        const currentDrawer = container.querySelector('.quad-drawer-container');
                        if (currentDrawer && currentDrawer.classList.contains('open')) {
                            currentDrawer.classList.remove('open');
                            setTimeout(() => {
                                container.innerHTML = '';
                                this.selectedLevel = null;
                            }, 700);
                        } else {
                            container.innerHTML = '';
                            this.selectedLevel = null;
                        }
                    }

                    // Sélectionner le nouveau rack
                    console.log(`📌 Sélection du rack ${clickedRack.code}`);
                    this.selectedRack = clickedRack;

                    // Mettre à jour toutes les vues
                    this.drawTopView(this.currentRacks);
                    this.drawFrontView(clickedRack);
                    this.updatePropertiesPanel(clickedRack);

                    if (clickedRack.rotation && clickedRack.rotation !== 0) {
                        const targetRotation = -clickedRack.rotation;
                        this.animate3DRotation(targetRotation);
                    } else {
                        this.animate3DRotation(0);
                    }

                    // Centrer ce rack dans la vue 3D
                    if (this.currentRacks) {
                        const rackIndex = this.currentRacks.findIndex(r => r.id === clickedRack.id);
                        if (rackIndex !== -1) {
                            this.cameraFocusIndex = rackIndex;
                            this.draw3DView(this.currentRacks);
                            console.log(`🎯 Rack ${clickedRack.code} centré en 3D (index: ${rackIndex})`);
                        }
                    }

                    return;
                }

                // ✅ Si c'est le MÊME rack, gérer drag/resize/rotate
                const handle = this.getClickedHandle(x, y);
                if (handle) {
                    if (handle === 'rotate') {
                        this.isRotating = true;
                        this.rotateStartX = x;
                        this.rotateStartY = y;
                        this.rotateStartAngle = this.selectedRack.rotation || 0;
                        this.canvasTop.style.cursor = 'grab';
                        console.log('🔄 Rotation démarrée pour', this.selectedRack.code);
                    } else {
                        this.isResizing = true;
                        this.resizeHandle = handle;
                        this.resizeStartX = x;
                        this.resizeStartY = y;
                        this.resizeStartWidth = this.selectedRack.displayWidth;
                        this.resizeStartHeight = this.selectedRack.displayHeight;
                        this.resizeStartPosX = this.selectedRack.displayX;
                        this.resizeStartPosY = this.selectedRack.displayY;
                        console.log('📏 Redimensionnement démarré pour', this.selectedRack.code, 'poignée:', handle);
                    }
                    return;
                }

                // ✅ Démarrer le drag du rack
                this.isDragging = true;
                this.draggedRack = clickedRack;
                this.dragStartX = x - clickedRack.displayX;
                this.dragStartY = y - clickedRack.displayY;
                this.canvasTop.style.cursor = 'grabbing';
                console.log('🚀 Drag démarré pour', clickedRack.code);
            });

            // Mousemove pour le drag
            // Mousemove pour le drag, resize et rotation
            this.canvasTop.addEventListener('mousemove', (e) => {
                const rect = this.canvasTop.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                // === DRAG ===
                if (this.isDragging && this.draggedRack) {  // ✅ CHANGÉ : utiliser draggedRack au lieu de selectedRack
                    let newDisplayX = x - this.dragStartX;
                    let newDisplayY = y - this.dragStartY;

                    const gridSize = 20;
                    newDisplayX = Math.round(newDisplayX / gridSize) * gridSize;
                    newDisplayY = Math.round(newDisplayY / gridSize) * gridSize;

                    const viewScale = this.topViewScale || 1;
                    const canvasWidth = this.canvasTop.width / viewScale;
                    const canvasHeight = this.canvasTop.height / viewScale;

                    newDisplayX = Math.max(0, Math.min(newDisplayX, canvasWidth - this.draggedRack.displayWidth));  // ✅ CHANGÉ
                    newDisplayY = Math.max(0, Math.min(newDisplayY, canvasHeight - this.draggedRack.displayHeight)); // ✅ CHANGÉ

                    this.draggedRack.displayX = newDisplayX;  // ✅ CHANGÉ
                    this.draggedRack.displayY = newDisplayY;  // ✅ CHANGÉ

                    const scale = 1;
                    this.draggedRack.position_x = newDisplayX / scale;  // ✅ CHANGÉ
                    this.draggedRack.position_y = newDisplayY / scale;  // ✅ CHANGÉ

                    const xInput = document.getElementById('quadRackX');
                    const yInput = document.getElementById('quadRackY');
                    if (xInput) xInput.value = Math.round(this.draggedRack.position_x / 40);  // ✅ CHANGÉ
                    if (yInput) yInput.value = Math.round(this.draggedRack.position_y / 40);  // ✅ CHANGÉ

                    this.drawTopView(this.currentRacks);
                }

                // === RESIZE ===
                else if (this.isResizing && this.selectedRack) {
                    const deltaX = x - this.resizeStartX;
                    const deltaY = y - this.resizeStartY;

                    const gridSize = 20;
                    let newWidth = this.resizeStartWidth;
                    let newHeight = this.resizeStartHeight;
                    let newX = this.resizeStartPosX;
                    let newY = this.resizeStartPosY;

                    // Selon la poignée, calculer nouvelles dimensions
                    switch(this.resizeHandle) {
                        case 'se': // Coin bas-droit
                            newWidth = Math.max(20, this.resizeStartWidth + deltaX);
                            newHeight = Math.max(20, this.resizeStartHeight + deltaY);
                            break;
                        case 'sw': // Coin bas-gauche
                            newWidth = Math.max(20, this.resizeStartWidth - deltaX);
                            newHeight = Math.max(20, this.resizeStartHeight + deltaY);
                            newX = this.resizeStartPosX + (this.resizeStartWidth - newWidth);
                            break;
                        case 'ne': // Coin haut-droit
                            newWidth = Math.max(20, this.resizeStartWidth + deltaX);
                            newHeight = Math.max(20, this.resizeStartHeight - deltaY);
                            newY = this.resizeStartPosY + (this.resizeStartHeight - newHeight);
                            break;
                        case 'nw': // Coin haut-gauche
                            newWidth = Math.max(20, this.resizeStartWidth - deltaX);
                            newHeight = Math.max(20, this.resizeStartHeight - deltaY);
                            newX = this.resizeStartPosX + (this.resizeStartWidth - newWidth);
                            newY = this.resizeStartPosY + (this.resizeStartHeight - newHeight);
                            break;
                    }

                    // Snap to grid
                    newWidth = Math.round(newWidth / gridSize) * gridSize;
                    newHeight = Math.round(newHeight / gridSize) * gridSize;

                    // Appliquer
                    this.selectedRack.displayWidth = newWidth;
                    this.selectedRack.displayHeight = newHeight;
                    this.selectedRack.displayX = newX;
                    this.selectedRack.displayY = newY;

                    // Mettre à jour width/depth réels (en cases)
                    this.selectedRack.width = Math.round(newWidth / 20);
                    this.selectedRack.depth = Math.round(newHeight / 20);

                    // Mettre à jour les inputs
                    const widthInput = document.getElementById('quadRackWidth');
                    const depthInput = document.getElementById('quadRackDepth');
                    if (widthInput) widthInput.value = this.selectedRack.width;
                    if (depthInput) depthInput.value = this.selectedRack.depth;

                    this.drawTopView(this.currentRacks);
                }

                // === ROTATION ===
                else if (this.isRotating && this.selectedRack) {
                    // Calculer l'angle depuis le centre du rack
                    const centerX = this.selectedRack.displayX + this.selectedRack.displayWidth / 2;
                    const centerY = this.selectedRack.displayY + this.selectedRack.displayHeight / 2;

                    const angle = Math.atan2(y - centerY, x - centerX) * (180 / Math.PI);

                    // Snap à 15 degrés
                    let newRotation = Math.round(angle / 15) * 15;
                    if (newRotation < 0) newRotation += 360;

                    this.selectedRack.rotation = newRotation;

                    // Mettre à jour le slider
                    const rotationSlider = document.getElementById('quadRackRotation');
                    const rotationValue = document.querySelector('.rotation-value');
                    if (rotationSlider) rotationSlider.value = newRotation;
                    if (rotationValue) rotationValue.textContent = newRotation + '°';

                    this.drawTopView(this.currentRacks);
                }
            });

            // Mouseup pour terminer le drag, resize et rotation
            this.canvasTop.addEventListener('mouseup', (e) => {
                // ✅ Nettoyer TOUS les états
                if (this.isDragging) {
                    this.isDragging = false;

                    // ✅ AJOUT : Sauvegarder la position finale
                    if (this.draggedRack) {
                        const scale = 1;
                        this.draggedRack.position_x = this.draggedRack.displayX / scale;
                        this.draggedRack.position_y = this.draggedRack.displayY / scale;
                    }

                    this.draggedRack = null;
                    this.dragStartX = null;
                    this.dragStartY = null;
                    this.canvasTop.style.cursor = 'default';
                    console.log('⏹️ Drag terminé');
                }

                if (this.isResizing && this.selectedRack) {
                    this.isResizing = false;
                    this.resizeHandle = null;
                    this.canvasTop.style.cursor = 'default';

                    // Mettre à jour position_x/y depuis displayX/Y
                    const scale = 1;
                    this.selectedRack.position_x = this.selectedRack.displayX / scale;
                    this.selectedRack.position_y = this.selectedRack.displayY / scale;

                    // Redessiner une dernière fois
                    this.drawTopView(this.currentRacks);

                    console.log('⏹️ Resize terminé:', this.selectedRack.width, 'x', this.selectedRack.depth);
                }

                if (this.isRotating && this.selectedRack) {
                    this.isRotating = false;
                    this.canvasTop.style.cursor = 'default';

                    // Redessiner une dernière fois
                    this.drawTopView(this.currentRacks);

                    console.log('⏹️ Rotation terminée:', this.selectedRack.rotation, '°');
                }
            });

            // Click pour sélectionner
            this.canvasTop.addEventListener('click', (e) => {
                if (!this.isDragging) {
                    this.handleCanvasClick(e);
                }
            });

            this.canvasTop.style.cursor = 'default';

            // Événement clic sur le canvas de face
            if (this.canvasFront) {
                this.canvasFront.addEventListener('click', (e) => {
                    this.handleFrontViewClick(e);
                });
            }

            // NOUVEAU : Événements pour la rotation 3D interactive
            if (this.canvas3D) {
                // Démarrer la rotation au mousedown
                this.canvas3D.addEventListener('mousedown', (e) => {
                    this.drag3DStartX = e.clientX;
                    this.drag3DStartTime = Date.now();
                    this.drag3DTotalDistance = 0;
                    this.canvas3D.style.cursor = 'grabbing';
                });

                // Continuer la rotation pendant le mousemove
                this.canvas3D.addEventListener('mousemove', (e) => {
                    // Démarrer le drag seulement si on bouge de plus de 5px
                    if (this.drag3DStartX !== undefined) {
                        const distance = Math.abs(e.clientX - this.drag3DStartX);
                        this.drag3DTotalDistance += distance;

                        if (this.drag3DTotalDistance > 5) {
                            this.isDragging3D = true;
                        }
                    }

                    if (!this.isDragging3D) return;

                    const deltaX = e.clientX - this.drag3DStartX;
                    this.rotation3D += deltaX * 0.5; // Sensibilité de rotation
                    this.drag3DStartX = e.clientX;

                    // Garder l'angle entre 0 et 360
                    this.rotation3D = this.rotation3D % 360;
                    if (this.rotation3D < 0) this.rotation3D += 360;

                    // Redessiner la scène 3D
                    if (this.currentRacks) {
                        this.draw3DView(this.currentRacks);
                    }
                });

                // Arrêter la rotation au mouseup
                this.canvas3D.addEventListener('mouseup', () => {
                    this.isDragging3D = false;
                    this.drag3DStartX = undefined;
                    this.canvas3D.style.cursor = 'grab';
                });

                // Arrêter aussi si la souris quitte le canvas
                this.canvas3D.addEventListener('mouseleave', () => {
                    this.isDragging3D = false;
                    this.canvas3D.style.cursor = 'grab';
                });

                // Curseur initial
                this.canvas3D.style.cursor = 'grab';

                // === NAVIGATION PAR FLÈCHES (CHANGEMENT UNIQUE) ===
                document.addEventListener('keydown', (e) => {
                    // Vérifier qu'on est dans la vue quad
                    if (this.currentView !== 'quad') return;

                    // Vérifier qu'on a des racks
                    if (!this.currentRacks || this.currentRacks.length === 0) return;

                    // Trier les racks comme dans draw3DView
                    const sortedRacks = [...this.currentRacks].sort((a, b) => {
                        return (a.position_x || 0) - (b.position_x || 0);
                    });

                    let currentIndex = sortedRacks.findIndex(r =>
                        this.selectedRack && r.id === this.selectedRack.id
                    );

                    if (currentIndex === -1) currentIndex = 0;

                    if (e.key === 'ArrowLeft') {
                        e.preventDefault();
                        // Aller au rack précédent (ou dernier)
                        const newIndex = currentIndex <= 0 ? sortedRacks.length - 1 : currentIndex - 1;
                        this.selectedRack = sortedRacks[newIndex];
                        this.draw3DView(this.currentRacks);
                        console.log(`⬅️ Rack précédent: ${sortedRacks[newIndex].code}`);
                    }

                    if (e.key === 'ArrowRight') {
                        e.preventDefault();
                        // Aller au rack suivant (ou premier)
                        const newIndex = currentIndex >= sortedRacks.length - 1 ? 0 : currentIndex + 1;
                        this.selectedRack = sortedRacks[newIndex];
                        this.draw3DView(this.currentRacks);
                        console.log(`➡️ Rack suivant: ${sortedRacks[newIndex].code}`);
                    }
                });

                // NOUVEAU : Détection du survol pour Vision Rayons X
                this.canvas3D.addEventListener('mousemove', (e) => {
                    if (this.isDragging3D) return; // Ne pas détecter si on est en train de faire tourner

                    const rect = this.canvas3D.getBoundingClientRect();
                    const mouseX = e.clientX - rect.left;
                    const mouseY = e.clientY - rect.top;

                    // Trouver quel rack est sous la souris
                    const hoveredRack = this.findRackAt3DPosition(mouseX, mouseY);

                    // Si on change de rack survolé
                    if (hoveredRack !== this.hoveredRack) {
                        this.hoveredRack = hoveredRack;

                        // Démarrer/arrêter l'animation rayons X
                        if (hoveredRack) {
                            this.startXRayEffect();
                        } else {
                            this.stopXRayEffect();
                        }
                    }
                });

                // === BOUCLE D'ANIMATION POUR MOUVEMENT FLUIDE ===
                const animate = () => {
                    // Redessiner la vue 3D seulement si besoin d'animation
                    if (this.currentRacks && this.currentOffset !== undefined) {
                        // Toujours redessiner pour l'animation fluide
                        this.draw3DView(this.currentRacks);
                    }
                    requestAnimationFrame(animate);
                };
                animate();

                // Clic pour zoomer sur un rack
                this.canvas3D.addEventListener('click', (e) => {
                    // Ignorer si c'était un drag (distance > 5px ou durée > 200ms)
                    const clickDuration = Date.now() - this.drag3DStartTime;
                    if (this.drag3DTotalDistance > 5 || clickDuration > 200) {
                        return;
                    }

                    const rect = this.canvas3D.getBoundingClientRect();
                    const mouseX = e.clientX - rect.left;
                    const mouseY = e.clientY - rect.top;

                    const clickedRack = this.findRackAt3DPosition(mouseX, mouseY);

                    if (clickedRack) {
                        // Zoomer sur ce rack
                        this.zoomOnRack(clickedRack);
                    } else if (this.focusedRack) {
                        // Dézoomer si on clique en dehors
                        this.resetZoom();
                    }
                });
            }
        }

        // Réinitialisation 3D
        document.getElementById('quad3DReset')?.addEventListener('click', () => {
            this.reset3DView();
        });

        // Démarrer avec la vue quad
        this.switchView('quad');
        this.selectedRack = null;
        this.selectedLevel = null;
        this.clearFrontView();

    }

    resizeCanvases() {
        const quadViews = document.querySelectorAll('.quad-view-content');

        quadViews.forEach(container => {
            const canvas = container.querySelector('canvas');
            if (canvas) {
                const rect = container.getBoundingClientRect();
                canvas.width = rect.width;
                canvas.height = rect.height;
            }
        });
    }

    switchView(viewType) {
        this.currentView = viewType;

        // Afficher/masquer les vues
        const quadView = document.getElementById('quadView');
        const simpleView = document.getElementById('simpleView');

        if (viewType === 'quad') {
            quadView.style.display = 'grid';
            simpleView.style.display = 'none';
            document.getElementById('viewMode').textContent = 'Quad';

            // Redessiner toutes les vues
            setTimeout(() => {
                this.resizeCanvases();
                if (window.vueStock) {
                    this.updateAllViews(window.vueStock.racks);
                }
            }, 100);
        } else {
            quadView.style.display = 'none';
            simpleView.style.display = 'block';
            document.getElementById('viewMode').textContent = 'Simple';
        }
    }

    clearFrontView() {
        const ctx = this.canvasFront.getContext('2d');
        ctx.clearRect(0, 0, this.canvasFront.width, this.canvasFront.height);
    }


    // Mettre à jour toutes les vues avec les racks
    updateAllViews(racks) {
        console.log('QuadView.updateAllViews appelé avec', racks ? racks.length : 0, 'racks');

        this.currentRacks = racks;

        if (!racks || !racks.length) {
            debugLog('quadView', 'Aucune donnée, dessin état vide');
            this.drawEmptyState();
            return;
        }

        debugLog('quadView', 'Dessin de', racks.length, 'racks');

        try {
            // 1. Vue du dessus
            this.drawTopView(racks);

            // 2. Vue de face (si un rack est sélectionné)
            if (this.selectedRack) {
                this.drawFrontView(this.selectedRack);
            }


            // 3. Vue 3D isométrique
            this.draw3DView(racks);

            // 4. Vue étage (si un niveau est sélectionné)
            if (this.selectedLevel) {
                this.updateLevelView(this.selectedLevel);
            }

            // Mettre à jour les infos
            this.updateInfoPanel(racks);

            debugLog('quadView', 'Toutes les vues mises à jour');
        } catch (error) {
            console.error('Erreur dans updateAllViews:', error);
        }
    }

    drawEmptyState() {
        // Dessiner un état vide pour la vue du dessus
        if (this.ctxTop && this.canvasTop) {
            const ctx = this.ctxTop;
            const width = this.canvasTop.width;
            const height = this.canvasTop.height;

            ctx.clearRect(0, 0, width, height);
            ctx.fillStyle = '#f8f9fa';
            ctx.fillRect(0, 0, width, height);

            ctx.fillStyle = '#6c757d';
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('Chargement des étagères...', width/2, height/2);
        }

        // Vue de face
        if (this.ctxFront && this.canvasFront) {
            const ctx = this.ctxFront;
            const width = this.canvasFront.width;
            const height = this.canvasFront.height;

            ctx.clearRect(0, 0, width, height);
            ctx.fillStyle = '#f8f9fa';
            ctx.fillRect(0, 0, width, height);

            ctx.fillStyle = '#6c757d';
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('Sélectionnez en premier un rack', width/2, height/2);
        }

        // Vue 3D
        if (this.ctx3D && this.canvas3D) {
            const ctx = this.ctx3D;
            const width = this.canvas3D.width;
            const height = this.canvas3D.height;

            ctx.clearRect(0, 0, width, height);
            ctx.fillStyle = '#667eea';
            ctx.fillRect(0, 0, width, height);

            ctx.fillStyle = 'rgba(255,255,255,0.9)';
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('Vue 3D', width/2, height/2);
        }
    }

    // Méthode pour gérer les clics sur le canvas
     handleCanvasClick(e) {
        console.log('=== handleCanvasClick ===');

        e.preventDefault();
        e.stopPropagation();

        this.isDragging = false;
        this.isResizing = false;
        this.isRotating = false;

        if (!this.currentRacks || this.currentRacks.length === 0) return;

        const rect = this.canvasTop.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // ✅ LOGS DE DÉBOGAGE
        console.log('🎯 COORDONNÉES BRUTES:');
        console.log('  e.clientX:', e.clientX, 'e.clientY:', e.clientY);
        console.log('  rect.left:', rect.left.toFixed(1), 'rect.top:', rect.top.toFixed(1));
        console.log('  rect.width:', rect.width, 'rect.height:', rect.height);
        console.log('  canvas.width:', this.canvasTop.width, 'canvas.height:', this.canvasTop.height);
        console.log('  x calculé:', x.toFixed(1), 'y calculé:', y.toFixed(1));

        console.log(`🎯 Clic à: ${x}, ${y}`);
        console.log(`📌 État actuel: selectedRack = ${this.selectedRack ? this.selectedRack.code : 'null'}`);

        // 1. TOUJOURS vérifier les poignettes si un rack est sélectionné
        if (this.selectedRack) {
            console.log(`🔄 Rack ${this.selectedRack.code} sélectionné, vérification des poignettes...`);
            const handle = this.getClickedHandle(x, y);
            console.log(`🔍 Résultat getClickedHandle: ${handle ? handle : 'null'}`);
            if (handle) {
                console.log(`🔄 Poignette ${handle} cliquée`);

                switch(handle) {
                    case 'nw':
                    case 'ne':
                    case 'sw':
                    case 'se':
                        this.startResizeFromHandle(this.selectedRack, handle, x, y);
                        return; // NE PAS CONTINUER
                    case 'rotate':
                        this.startRotationFromHandle(this.selectedRack, x, y);
                        return; // NE PAS CONTINUER
                }
            } else {
                console.log(`❌ Aucune poignette détectée`);
            }
        }

        // 2. Ensuite, vérifier si on clique sur un rack normal
        const clickedRack = this.findRackAtPosition(x, y);

        if (clickedRack) {
            console.log(`✅ Rack ${clickedRack.code} trouvé!`);

            // Si c'est le même rack déjà sélectionné, ne rien faire (le mousedown gérera le drag)
            if (this.selectedRack && this.selectedRack.id === clickedRack.id) {
                console.log(`📌 Rack ${clickedRack.code} déjà sélectionné`);
                return; // Ne pas redessiner
            }

            // FERMER LE TIROIR AVANT DE CHANGER DE RACK
            const container = document.getElementById('quadLevelSlots');
            if (container) {
                const currentDrawer = container.querySelector('.quad-drawer-container');
                if (currentDrawer && currentDrawer.classList.contains('open')) {
                    currentDrawer.classList.remove('open');
                    setTimeout(() => {
                        container.innerHTML = '';
                        this.selectedLevel = null;
                    }, 700);
                } else {
                    container.innerHTML = '';
                    this.selectedLevel = null;
                }
            }

            // Sélectionner le nouveau rack
            console.log(`📌 Sélection du rack ${clickedRack.code}`);
            this.selectedRack = clickedRack;

            // 1. Mettre à jour toutes les vues
            this.drawTopView(this.currentRacks);
            this.drawFrontView(clickedRack);
            this.updatePropertiesPanel(clickedRack);

            // ✅ NOUVEAU : Faire tourner la vue 3D si le rack est tourné
            if (this.currentRacks) {
                const rackIndex = this.currentRacks.findIndex(r => r.id === clickedRack.id);
                if (rackIndex !== -1) {
                    this.cameraFocusIndex = rackIndex;

                    if (clickedRack.rotation && clickedRack.rotation !== 0) {
                        const targetRotation = -clickedRack.rotation;
                        this.animate3DRotation(targetRotation);
                    } else {
                        this.animate3DRotation(0);
                    }

                    this.draw3DView(this.currentRacks);
                    console.log(`🎯 Rack ${clickedRack.code} centré en 3D (index: ${rackIndex})`);
                }
            }

            // 2. CENTRER ce rack dans la vue 3D
            if (this.currentRacks) {
                // Calculer la position pour centrer ce rack
                const rackIndex = this.currentRacks.findIndex(r => r.id === clickedRack.id);
                if (rackIndex !== -1) {
                    // Positionner la caméra pour que ce rack soit au centre
                    const totalRacks = this.currentRacks.length;
                    const spacing = 120;
                    this.cameraFocusIndex = rackIndex; // Nouvelle propriété à ajouter

                    // Redessiner la vue 3D avec ce rack centré
                    this.draw3DView(this.currentRacks);

                    console.log(`🎯 Rack ${clickedRack.code} centré en 3D (index: ${rackIndex})`);
                }
            }

        } else {
            console.log('❌ Aucun rack à cette position');
        }
    }

    // Trouver un rack à une position donnée
    findRackAtPosition(x, y) {
        if (!this.currentRacks) {
            console.log('❌ currentRacks est null/undefined');
            return null;
        }

        // ✅ CORRECTION : Appliquer le scale inverse aux coordonnées de la souris
        const scale = this.topViewScale || 1;
        const adjustedX = x / scale;
        const adjustedY = y / scale;

        console.log(`🔍 Recherche parmi ${this.currentRacks.length} racks à: ${adjustedX},${adjustedY} (scale: ${scale})`);

        for (const rack of this.currentRacks) {
            if (!rack.displayX) {
                console.log(`  Rack ${rack.code}: PAS de displayX`);
                continue;
            }

            // Utiliser la taille réelle du rack (3x3, etc.)
            const logicalGridSize = 20;
            const w = rack.width * logicalGridSize;
            const d = rack.depth * logicalGridSize;

            const left = rack.displayX;
            const right = left + (w / scale);
            const top = rack.displayY;
            const bottom = top + (d / scale);

            console.log(`  Rack ${rack.code}: ${left}-${right}, ${top}-${bottom}`);

            if (adjustedX >= left && adjustedX <= right && adjustedY >= top && adjustedY <= bottom) {
                console.log(`✅ ${rack.code} TROUVÉ!`);
                return rack;
            }
        }

        console.log('❌ Aucun rack correspond');
        return null;
    }


    // Gestion du survol (pour changer le curseur)
    handleCanvasHover(e) {
        if (!this.currentRacks || this.currentRacks.length === 0) return;

        const rect = this.canvasTop.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const rack = this.findRackAtPosition(x, y);

        if (rack) {
            this.canvasTop.style.cursor = 'pointer';
            // Option : afficher une info-bulle
            this.showTooltip(rack, x, y);
        } else {
            this.canvasTop.style.cursor = 'default';
            this.hideTooltip();
        }
    }

    // Montrer une info-bulle
    showTooltip(rack, mouseX, mouseY) {
        // Créer ou mettre à jour l'info-bulle
        let tooltip = document.getElementById('quadTooltip');

        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.id = 'quadTooltip';
            tooltip.style.cssText = `
                position: fixed;
                background: rgba(0,0,0,0.8);
                color: white;
                padding: 5px 10px;
                border-radius: 4px;
                font-size: 12px;
                pointer-events: none;
                z-index: 1000;
                transform: translate(-50%, -100%);
            `;
            document.body.appendChild(tooltip);
        }

        tooltip.innerHTML = `
            <strong>${rack.code}</strong><br>
            ${rack.name || 'Étagère ' + rack.code}<br>
            ${rack.width} × ${rack.depth} cases
        `;

        // Positionner près du curseur de la souris
        tooltip.style.left = (mouseX + 10) + 'px'; // 10px à droite du curseur
        tooltip.style.top = (mouseY - 10) + 'px'; // 10px au-dessus du curseur
        tooltip.style.display = 'block';
    }

    // Cacher l'info-bulle
    hideTooltip() {
        const tooltip = document.getElementById('quadTooltip');
        if (tooltip) {
            tooltip.style.display = 'none';
        }
    }

    // Ouvrir le modal d'édition
    openEditModal(rack) {
        console.log('Ouverture du modal pour éditer le rack:', rack.code);

        // Utiliser votre modal existant via VueStock
        if (window.vueStock && window.vueStock.openRackModal) {
            window.vueStock.openRackModal(rack);
        } else if (window.openRackModal) {
            window.openRackModal(rack);
        } else {
            console.warn('Fonction openRackModal non disponible');
            // Option : créer un modal simple
            this.createSimpleEditModal(rack);
        }
    }

    // Modal simple si le modal principal n'est pas disponible
    createSimpleEditModal(rack) {
        const modal = document.createElement('div');
        modal.innerHTML = `
            <div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:1000;display:flex;align-items:center;justify-content:center;">
                <div style="background:white;padding:20px;border-radius:8px;min-width:300px;">
                    <h3>Éditer ${rack.code}</h3>
                    <div style="margin:10px 0;">
                        <label>Code: <input type="text" value="${rack.code}" id="editRackCode"></label>
                    </div>
                    <div style="margin:10px 0;">
                        <label>Largeur: <input type="number" value="${rack.width}" id="editRackWidth"></label>
                    </div>
                    <div style="margin:10px 0;">
                        <label>Profondeur: <input type="number" value="${rack.depth}" id="editRackDepth"></label>
                    </div>
                    <div style="margin:10px 0;">
                        <label>Couleur: <input type="color" value="${rack.color || '#4a90e2'}" id="editRackColor"></label>
                    </div>
                    <div style="display:flex;justify-content:space-between;margin-top:20px;">
                        <button id="cancelEdit">Annuler</button>
                        <button id="saveEdit" style="background:#4a90e2;color:white;">Sauvegarder</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Événements
        document.getElementById('cancelEdit').addEventListener('click', () => {
            modal.remove();
        });

        document.getElementById('saveEdit').addEventListener('click', async () => {
            const newCode = document.getElementById('editRackCode').value;
            const newWidth = parseInt(document.getElementById('editRackWidth').value);
            const newDepth = parseInt(document.getElementById('editRackDepth').value);
            const newColor = document.getElementById('editRackColor').value;

            // Mettre à jour localement
            rack.code = newCode;
            rack.width = newWidth;
            rack.depth = newDepth;
            rack.color = newColor;

            // Redessiner
            this.drawTopView(this.currentRacks);

            // Fermer le modal
            modal.remove();

            // Sauvegarder via API (si disponible)
            if (window.vueStock && window.vueStock.api) {
                try {
                    await window.vueStock.api.saveRack({
                        id: rack.id,
                        code: newCode,
                        width: newWidth,
                        depth: newDepth,
                        color: newColor
                    });
                    console.log('Rack mis à jour via API');
                } catch (error) {
                    console.error('Erreur API:', error);
                }
            }
        });
    }

    drawTopView(racks) {
        if (!this.ctxTop || !this.canvasTop) return;

        const ctx = this.ctxTop;
        const width = this.canvasTop.width;
        const height = this.canvasTop.height;

        ctx.clearRect(0, 0, width, height);
        this.drawGrid(ctx, width, height, 20);

        // ✅ NOUVEAU : Calcul du zoom automatique
        if (racks.length > 0) {
            // Calculer la largeur totale nécessaire pour tous les racks
            const totalWidth = racks.reduce((sum, rack) => sum + (rack.width * 20) + 40, 0);

            // Si ça dépasse la largeur du canvas, calculer un facteur de zoom
            if (totalWidth > width - 100) {
                const zoomFactor = (width - 100) / totalWidth;
                // Appliquer le zoom (entre 0.3 et 1)
                const scale = Math.max(0.3, Math.min(1, zoomFactor));

                // Sauvegarder le contexte et appliquer le zoom
                ctx.save();
                ctx.scale(scale, scale);

                // Stocker le scale pour l'utiliser ailleurs
                this.topViewScale = scale;
            } else {
                this.topViewScale = 1;
            }
        }

        // RÉGLAGE POUR UNE SEULE LIGNE
        const startX = 50;
        const startY = height / 2 - 40;
        const spacing = 40;
        let currentX = startX;

        racks.forEach((rack) => {
            // Taille d'un carré en pixels LOGIQUES (toujours 20)
            const logicalGridSize = 20;
            const scale = this.topViewScale || 1;

            // Dimensions en pixels logiques (toujours proportionnelles à la grille)
            const w = rack.width * logicalGridSize;
            const d = rack.depth * logicalGridSize;

            // Stocker displayWidth et displayHeight UNE SEULE FOIS si non définis
            if (rack.displayWidth === undefined) {
                rack.displayWidth = w;
            }
            if (rack.displayHeight === undefined) {
                rack.displayHeight = d;
            }

            let x, y;

            // Si ce rack est en cours de drag, utiliser displayX/Y existants
            if (this.isDragging && this.draggedRack && rack.id === this.draggedRack.id) {
                // displayX/Y sont déjà en pixels logiques, pas besoin de diviser
                x = rack.displayX;
                y = rack.displayY;
            }
            else if (rack.position_x !== undefined && rack.position_y !== undefined) {
                const positionScale = 1; // Conversion position_x → pixels logiques
                const viewScale = this.topViewScale || 1; // Zoom global

                // Position en pixels logiques (avant ctx.scale)
                x = rack.position_x * positionScale;
                y = rack.position_y * positionScale;

                // ✅ CORRECTION : Ramener à l'écran si hors limites
                const maxX = (this.canvasTop.width / viewScale) - 100;
                const maxY = (this.canvasTop.height / viewScale) - 100;

                if (x > maxX) {
                    x = maxX;
                    rack.position_x = x; // Mettre à jour pour sauvegarde
                }

                if (y > maxY) {
                    y = maxY;
                    rack.position_y = y;
                }

                // Stocker en pixels physiques (après ctx.scale)
                rack.displayX = x;
                rack.displayY = y;
            }
            // Sinon, calculer automatiquement
            else {
                if (currentX + w > width - 50) {
                    currentX = Math.max(startX, width - 50 - w);
                }

                x = currentX;
                y = startY;

                rack.displayX = x;
                rack.displayY = y;

                currentX += w + spacing;
            }

            // ✅ AJOUT DE LA ROTATION VISUELLE
            ctx.save(); // Sauvegarder le contexte

            // Si rotation, appliquer la transformation
            if (rack.rotation && rack.rotation !== 0) {
                // Translater au centre du rack
                const centerX = x + (w / scale) / 2;
                const centerY = y + (d / scale) / 2;
                ctx.translate(centerX, centerY);
                ctx.rotate((rack.rotation * Math.PI) / 180); // Convertir degrés en radians
                ctx.translate(-centerX, -centerY);
            }

            // Dessin du rack (code original)
            ctx.fillStyle = rack.color || '#4a90e2';
            ctx.fillRect(x, y, w / scale, d / scale);
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, w / scale, d / scale);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(rack.code, x + (w / scale) / 2, y + (d / scale) / 2);

            ctx.restore(); // Restaurer le contexte (annule la rotation)

            // Poignettes (APRÈS la restauration pour qu'elles ne tournent pas)
            if (this.selectedRack && rack.id === this.selectedRack.id) {
                // Surbrillance
                ctx.save();
                if (rack.rotation && rack.rotation !== 0) {
                    const centerX = x + (w / scale) / 2;
                    const centerY = y + (d / scale) / 2;
                    ctx.translate(centerX, centerY);
                    ctx.rotate((rack.rotation * Math.PI) / 180);
                    ctx.translate(-centerX, -centerY);
                }

                ctx.strokeStyle = '#ffeb3b';
                ctx.lineWidth = 3;
                ctx.strokeRect(x - 2, y - 2, (w / scale) + 4, (d / scale) + 4);
                ctx.restore();

                // Les poignettes ne tournent PAS (elles restent toujours horizontales/verticales)
                const handleSize = 8;
                const handleColor = '#007bff';
                const handleBorder = '#ffffff';
                const rackVisualWidth = w / scale;
                const rackVisualHeight = d / scale;

                // Coin supérieur gauche
                ctx.fillStyle = handleBorder;
                ctx.fillRect(x - handleSize/2, y - handleSize/2, handleSize, handleSize);
                ctx.fillStyle = handleColor;
                ctx.fillRect(x - handleSize/2 + 1, y - handleSize/2 + 1, handleSize - 2, handleSize - 2);

                // Coin supérieur droit
                ctx.fillStyle = handleBorder;
                ctx.fillRect(x + rackVisualWidth - handleSize/2, y - handleSize/2, handleSize, handleSize);
                ctx.fillStyle = handleColor;
                ctx.fillRect(x + rackVisualWidth - handleSize/2 + 1, y - handleSize/2 + 1, handleSize - 2, handleSize - 2);

                // Coin inférieur gauche
                ctx.fillStyle = handleBorder;
                ctx.fillRect(x - handleSize/2, y + rackVisualHeight - handleSize/2, handleSize, handleSize);
                ctx.fillStyle = handleColor;
                ctx.fillRect(x - handleSize/2 + 1, y + rackVisualHeight - handleSize/2 + 1, handleSize - 2, handleSize - 2);

                // Coin inférieur droit
                ctx.fillStyle = handleBorder;
                ctx.fillRect(x + rackVisualWidth - handleSize/2, y + rackVisualHeight - handleSize/2, handleSize, handleSize);
                ctx.fillStyle = handleColor;
                ctx.fillRect(x + rackVisualWidth - handleSize/2 + 1, y + rackVisualHeight - handleSize/2 + 1, handleSize - 2, handleSize - 2);

                // Poignette de rotation
                const rotateHandleSize = 30;
                const rotateHandleCenterX = x + (rackVisualWidth / 2);
                const rotateHandleY = y - 25;

                ctx.beginPath();
                ctx.arc(rotateHandleCenterX, rotateHandleY, 10, 0, Math.PI * 2);
                ctx.fillStyle = handleBorder;
                ctx.fill();
                ctx.beginPath();
                ctx.arc(rotateHandleCenterX, rotateHandleY, 8, 0, Math.PI * 2);
                ctx.fillStyle = handleColor;
                ctx.fill();

                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 10px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('⟳', rotateHandleCenterX, rotateHandleY);

                ctx.fillStyle = 'red';
                ctx.beginPath();
                ctx.arc(rotateHandleCenterX, rotateHandleY, 3, 0, Math.PI * 2);
                ctx.fill();

                console.log(`🎯 Rack ${rack.code}: rotate poignette DESSINÉE à x=${rotateHandleCenterX.toFixed(1)}, y=${rotateHandleY.toFixed(1)}`);

                rack._debugRotateHandle = {
                    centerX: rotateHandleCenterX,
                    centerY: rotateHandleY,
                    left: rotateHandleCenterX - rotateHandleSize/2,
                    right: rotateHandleCenterX + rotateHandleSize/2,
                    top: rotateHandleY - rotateHandleSize/2,
                    bottom: rotateHandleY + rotateHandleSize/2
                };
            }

            currentX += w + spacing;
        });

        if (this.topViewScale && this.topViewScale !== 1) {
            ctx.restore();
        }

        document.getElementById('quadRackCount').textContent = `${racks.length} racks`;
    }

    drawFrontView(rack) {
        if (!this.ctxFront || !this.canvasFront || !rack) return;

        const ctx = this.ctxFront;
        const width = this.canvasFront.width;
        const height = this.canvasFront.height;

        // Effacer
        ctx.clearRect(0, 0, width, height);

        // Dessiner le rack en élévation
        const rackWidth = rack.width * 30; // 30px par case en largeur
        const startX = (width - rackWidth) / 2;
        const startY = height - 20; // Bas du canvas

        // Base du rack
        ctx.fillStyle = rack.color || '#4a90e2';  // ← Couleur du rack
        ctx.fillRect(startX, startY - 10, rackWidth, 10);

        // Niveaux (du bas vers le haut)
        if (rack.levels && rack.levels.length) {
            const levels = [...rack.levels].sort((a, b) => a.display_order - b.display_order);

            let currentY = startY - 10;

            levels.forEach(level => {
                // Étage
                ctx.fillStyle = level.code % 20 === 0 ? '#6c757d' : '#adb5bd';
                const levelHeight = 40; // Hauteur fixe par niveau

                ctx.fillRect(startX, currentY - levelHeight, rackWidth, levelHeight);

                // Séparateur
                ctx.strokeStyle = '#495057';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(startX, currentY - levelHeight);
                ctx.lineTo(startX + rackWidth, currentY - levelHeight);
                ctx.stroke();

                // Code de l'étage
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 12px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(level.code, startX + rackWidth/2, currentY - levelHeight/2);

                currentY -= levelHeight;
            });

            // Hauteur totale
            const totalHeight = startY - currentY;
            ctx.fillStyle = 'rgba(0,0,0,0.1)';
            ctx.fillRect(startX - 30, currentY, 25, totalHeight);

            // Étiquette de hauteur
            ctx.fillStyle = '#333';
            ctx.font = '10px Arial';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${levels.length} étages`, startX - 35, currentY + totalHeight/2);
        }

        // Code du rack en bas
        ctx.fillStyle = '#333';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`Rack ${rack.code}`, width/2, height - 5);

        // Mettre à jour l'info
        document.getElementById('quadSelectedRack').textContent = `Rack ${rack.code} - ${rack.levels?.length || 0} étages`;
    }

    handleFrontViewClick(e) {
        if (!this.selectedRack || !this.selectedRack.levels?.length) return;

        const rect = this.canvasFront.getBoundingClientRect();
        const scaleY = this.canvasFront.height / rect.height;

        const clickX = e.clientX - rect.left;
        const clickY = (e.clientY - rect.top) * scaleY;

        const rackWidth = this.selectedRack.width * 30;
        const startX = (this.canvasFront.width - rackWidth) / 2;
        const baseHeight = 10; // hauteur de la base du rack (DOIT matcher le draw)
        const startY = this.canvasFront.height - 20 - baseHeight;

        const levelHeight = 40;
        let currentY = startY;


        // 🔑 MÊME ORDRE QUE LE DESSIN
        const levels = [...this.selectedRack.levels]
            .sort((a, b) => a.display_order - b.display_order);

        for (const level of levels) {
            const levelTop = currentY - levelHeight;
            const levelBottom = currentY;

            if (
                clickX >= startX &&
                clickX <= startX + rackWidth &&
                clickY >= levelTop &&
                clickY <= levelBottom
            ) {
                console.log('✅ Étage cliqué:', level.code);
                this.selectedLevel = level;

                document.getElementById('quadLevelInfo').textContent =
                    `Étage ${level.code} - ${level.slots?.length || 0} emplacements`;

                this.updateLevelView(level);
                return;
            }

            currentY -= levelHeight;
        }
    }


    draw3DView(racks) {
        if (!this.ctx3D || !this.canvas3D) return;

        // ✅ AJOUT : Vérification si racks est vide
        if (!racks || racks.length === 0) {
            const ctx = this.ctx3D;
            const width = this.canvas3D.width;
            const height = this.canvas3D.height;

            ctx.clearRect(0, 0, width, height);

            // Fond simple
            ctx.fillStyle = '#667eea';
            ctx.fillRect(0, 0, width, height);

            // Message
            ctx.fillStyle = 'rgba(255,255,255,0.9)';
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Aucun rack à afficher', width/2, height/2);

            return; // ← IMPORTANT : sortir de la fonction
        }

        const ctx = this.ctx3D;
        const width = this.canvas3D.width;
        const height = this.canvas3D.height;


        // Effacer
        ctx.clearRect(0, 0, width, height);

        // Fond gradient animé selon la rotation (CORRIGÉ)
        const gradientAngle = (this.rotation3D % 360) * Math.PI / 180;
        const gx = Math.max(0, Math.min(width, width * 0.5 + Math.cos(gradientAngle) * width * 0.3));
        const gy = Math.max(0, Math.min(height, height * 0.5 + Math.sin(gradientAngle) * height * 0.3));

        const gradient = ctx.createLinearGradient(0, 0, gx, gy);
        gradient.addColorStop(0, '#667eea');
        gradient.addColorStop(0.5, '#764ba2');
        gradient.addColorStop(1, '#667eea');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        // Grille de sol en perspective
        this.drawFloorGrid(ctx, width, height);

        // ✅ REMPLACER TOUT À PARTIR D'ICI
        const centerX = width / 2;
        const centerY = height / 2 + 50;

        // Trier les racks
        const sortedRacks = [...racks].sort((a, b) => {
            const aRotated = a.rotation && a.rotation !== 0 ? 1 : 0;
            const bRotated = b.rotation && b.rotation !== 0 ? 1 : 0;

            if (aRotated !== bRotated) {
                return bRotated - aRotated;
            }

            return (a.position_x || 0) - (b.position_x || 0);
        });

        const selectedIndex = sortedRacks.findIndex(r =>
            this.selectedRack && r.id === this.selectedRack.id
        );
        const focusIndex = selectedIndex !== -1 ? selectedIndex : 0;
        this.cameraFocusIndex = focusIndex;

        // ✅ NOUVEAU : Calculer les positions en tenant compte des vraies dimensions
        let currentX = 0;
        const racksWithDepth = sortedRacks.map((rack, index) => {
            // Calculer la largeur effective selon la rotation
            let effectiveWidth = rack.width * 20;

            if (rack.rotation && rack.rotation !== 0) {
                const angle = rack.rotation % 360;
                if ((angle > 45 && angle < 135) || (angle > 225 && angle < 315)) {
                    effectiveWidth = rack.depth * 20;
                }
            }

            const x = currentX;

            let z = 0;
            if (rack.rotation && rack.rotation !== 0) {
                z = 0;
            }

            // ✅ CORRECTION : Espacement de 120px au lieu de effectiveWidth + 10
            currentX += 120; // Espacement fixe comme avant

            return { rack, x, z, effectiveWidth };
        });

        // ✅ NOUVEAU : Calculer l'offset pour centrer le rack sélectionné
        let targetOffset = 0;
        if (focusIndex > 0) {
            for (let i = 0; i < focusIndex; i++) {
                targetOffset -= racksWithDepth[i].effectiveWidth + 10;
            }
            targetOffset -= racksWithDepth[focusIndex].effectiveWidth / 2;
        } else {
            targetOffset = -racksWithDepth[0].effectiveWidth / 2;
        }

        if (this.currentOffset === undefined) {
            this.currentOffset = targetOffset;
        }

        const animationSpeed = 0.1;
        this.currentOffset += (targetOffset - this.currentOffset) * animationSpeed;

        if (Math.abs(targetOffset - this.currentOffset) < 0.5) {
            this.currentOffset = targetOffset;
        }

        // Dessiner chaque rack
        racksWithDepth.forEach(({ rack, x, z, effectiveWidth }, index) => {
            const isSelected = this.selectedRack && rack.id === this.selectedRack.id;
            const isHovered = (rack === this.hoveredRack);
            const xrayAlpha = isHovered ? this.xrayProgress : 0;
            const zoomScale = this.camera.currentScale;

            // SUPPRIMER la rotation orbitale des racks
            // const angle = (this.rotation3D || 0) * Math.PI / 180; // ← À SUPPRIMER

            // Position originale SANS rotation
            const rotatedX = x + this.currentOffset; // ← Directement, pas de rotation
            const rotatedZ = z; // ← Directement, pas de rotation

            // Projection isométrique SANS rotation orbitale
            const isoX = centerX + rotatedX * this.isometric.scale * zoomScale;
            const isoY = centerY - rotatedZ * this.isometric.scale * 0.5 * zoomScale;

            const rackHeight = (rack.levels?.length || 1) * 12;
            const rackWidth = rack.width * 20;
            const rackDepth = rack.depth * 20;

            const depthScale = 1 - (index / sortedRacks.length) * 0.1;
            const scale = depthScale * zoomScale;

            let finalOpacity = 1;
            if (isSelected) {
                finalOpacity = 0.5;
            } else if (this.focusedRack && rack !== this.focusedRack) {
                finalOpacity = 0.3;
            }

            this.drawCabinetRack(
                ctx,
                isoX,
                isoY,
                rackWidth * scale * 1.5,
                rackHeight * scale * 2,
                rackDepth * scale,
                rack,
                finalOpacity
            );
        });

        // Indicateur de rotation
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(`🔄 ${Math.round(this.rotation3D)}°`, 10, 25);

        ctx.font = '12px Arial';
        ctx.fillText(`${racks.length} racks - Glissez pour tourner`, 10, 45);
    }

    // Dessiner la grille du sol en perspective
    drawFloorGrid(ctx, width, height) {
        ctx.save();

        const gridSize = 40;
        const centerX = width / 2;
        const centerY = height / 2 + 50;

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;

        // Lignes radiales
        for (let i = 0; i < 12; i++) {
            const angle = (i * 30 + this.rotation3D) * Math.PI / 180;
            const x1 = centerX + Math.cos(angle) * 50;
            const y1 = centerY + Math.sin(angle) * 25;
            const x2 = centerX + Math.cos(angle) * 250;
            const y2 = centerY + Math.sin(angle) * 125;

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }

        // Cercles concentriques
        for (let r = 50; r <= 250; r += 50) {
            ctx.beginPath();
            ctx.ellipse(centerX, centerY, r, r * 0.5, 0, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.restore();
    }

    // Dessiner un rack comme une armoire (perspective frontale)
    drawCabinetRack(ctx, x, y, width, height, depth, rack, opacity = 1) {
        ctx.save();
        ctx.globalAlpha = opacity;

        // ✅ CORRECTION : Inverser width et depth si rotation proche de 90° ou 270°
        let effectiveWidth = width;
        let effectiveDepth = depth;
        let showSide = false; // true = on voit le côté au lieu de la face

        if (rack.rotation && rack.rotation !== 0) {
            const angle = rack.rotation % 360;

            // Si rotation proche de 90° ou 270°, inverser les dimensions
            if ((angle > 45 && angle < 135) || (angle > 225 && angle < 315)) {
                effectiveWidth = depth;
                effectiveDepth = width;
                showSide = true;
            }
        }

        const cabinetWidth = effectiveWidth;
        const cabinetHeight = height;
        const cabinetDepth = effectiveDepth * 0.3;

        // Face avant
        ctx.fillStyle = rack.color;
        ctx.fillRect(x - cabinetWidth/2, y - cabinetHeight, cabinetWidth, cabinetHeight);

        // Bordure
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.strokeRect(x - cabinetWidth/2, y - cabinetHeight, cabinetWidth, cabinetHeight);

        // Code du rack - TOUJOURS sur la face avant, même pour les racks tournés
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // SUPPRIMER le if/else pour showSide
        // TOUJOURS dessiner sur la face avant
        ctx.fillText(rack.code, x, y - cabinetHeight/2);

        // Effet de profondeur (côté droit)
        ctx.fillStyle = this.adjustColor(rack.color, -20);
        ctx.beginPath();
        ctx.moveTo(x + cabinetWidth/2, y - cabinetHeight);
        ctx.lineTo(x + cabinetWidth/2 + cabinetDepth, y - cabinetHeight - cabinetDepth*0.5);
        ctx.lineTo(x + cabinetWidth/2 + cabinetDepth, y - cabinetDepth*0.5);
        ctx.lineTo(x + cabinetWidth/2, y);
        ctx.closePath();
        ctx.fill();

        // ✅ NOUVEAU : Si showSide, dessiner les tiroirs sur la face latérale droite
        if (showSide && rack.levels && rack.levels.length > 0) {
            const lateralWidth = cabinetDepth;
            const lateralHeight = cabinetHeight;

            // Face latérale avec tiroirs
            ctx.fillStyle = rack.color;
            ctx.beginPath();
            ctx.moveTo(x + cabinetWidth/2, y - cabinetHeight);
            ctx.lineTo(x + cabinetWidth/2 + lateralWidth, y - cabinetHeight - lateralWidth*0.5);
            ctx.lineTo(x + cabinetWidth/2 + lateralWidth, y - lateralWidth*0.5);
            ctx.lineTo(x + cabinetWidth/2, y);
            ctx.closePath();
            ctx.fill();

            // Dessiner les étages sur cette face latérale
            const levelHeight = lateralHeight / rack.levels.length;
            const sortedLevels = [...rack.levels].sort((a, b) => parseInt(a.code) - parseInt(b.code));

            sortedLevels.forEach((level, index) => {
                const levelYTop = y - cabinetHeight + (index * levelHeight);
                const levelYBottom = levelYTop + levelHeight;

                // Ligne de séparation en perspective
                ctx.strokeStyle = 'rgba(255,255,255,0.5)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(x + cabinetWidth/2, levelYBottom);
                ctx.lineTo(x + cabinetWidth/2 + lateralWidth, levelYBottom - lateralWidth*0.5);
                ctx.stroke();

                // Code de l'étage
                if (levelHeight > 15) {
                    ctx.fillStyle = 'rgba(255,255,255,0.8)';
                    ctx.font = '9px Arial';
                    const textX = x + cabinetWidth/2 + lateralWidth*0.3;
                    const textY = levelYTop + levelHeight/2 - lateralWidth*0.15;
                    ctx.fillText(level.code, textX, textY);
                }
            });


        }

        // Effet de profondeur (dessus) - RESTE IDENTIQUE
        ctx.fillStyle = this.adjustColor(rack.color, 10);
        ctx.beginPath();
        ctx.moveTo(x - cabinetWidth/2, y - cabinetHeight);
        ctx.lineTo(x + cabinetWidth/2, y - cabinetHeight);
        ctx.lineTo(x + cabinetWidth/2 + cabinetDepth, y - cabinetHeight - cabinetDepth*0.5);
        ctx.lineTo(x - cabinetWidth/2 + cabinetDepth, y - cabinetHeight - cabinetDepth*0.5);
        ctx.closePath();
        ctx.fill();

        // Surbrillance si sélectionné
        if (opacity < 1) {
            ctx.strokeStyle = '#ffeb3b';
            ctx.lineWidth = 3;
            ctx.strokeRect(x - cabinetWidth/2 - 2, y - cabinetHeight - 2, cabinetWidth + 4, cabinetHeight + 4);
        }

        ctx.restore();
    }

    // Dessiner un rack en vue isométrique avec effets Rayons X et Opacité
    drawIsoRack(ctx, x, y, width, depth, height, rack, angle, opacity = 1, xrayAlpha = 0) {
        ctx.save();
        // Appliquer l'opacité globale
        ctx.globalAlpha = opacity;

        // Angle isométrique standard (30°)
        const iso = Math.PI / 6; // 30 degrés

        // Points de base du rack (au sol)
        const basePoints = [
            { x: -width/2, z: -depth/2 },
            { x: width/2, z: -depth/2 },
            { x: width/2, z: depth/2 },
            { x: -width/2, z: depth/2 }
        ];

        // Convertir en coordonnées isométriques
        const isoPoints = basePoints.map(p => ({
            x: x + (p.x * Math.cos(iso) - p.z * Math.cos(iso)),
            y: y + (p.x * Math.sin(iso) + p.z * Math.sin(iso))
        }));

        // Calculer les couleurs avec effet Rayons X (plus transparent = plus clair)
        const faceOpacity = 1 - (xrayAlpha * 0.7); // Max 70% de transparence

        // Face avant (plus sombre)
        ctx.fillStyle = this.adjustColor(rack.color, -30);
        ctx.globalAlpha = opacity * faceOpacity;
        ctx.beginPath();
        ctx.moveTo(isoPoints[0].x, isoPoints[0].y);
        ctx.lineTo(isoPoints[1].x, isoPoints[1].y);
        ctx.lineTo(isoPoints[1].x, isoPoints[1].y - height);
        ctx.lineTo(isoPoints[0].x, isoPoints[0].y - height);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.globalAlpha = opacity;
        ctx.stroke();

        // Face droite (encore plus sombre)
        ctx.fillStyle = this.adjustColor(rack.color, -50);
        ctx.globalAlpha = opacity * faceOpacity;
        ctx.beginPath();
        ctx.moveTo(isoPoints[1].x, isoPoints[1].y);
        ctx.lineTo(isoPoints[2].x, isoPoints[2].y);
        ctx.lineTo(isoPoints[2].x, isoPoints[2].y - height);
        ctx.lineTo(isoPoints[1].x, isoPoints[1].y - height);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = opacity;
        ctx.stroke();

        // Face du dessus (plus claire)
        ctx.fillStyle = this.adjustColor(rack.color, 20);
        ctx.globalAlpha = opacity * faceOpacity;
        ctx.beginPath();
        ctx.moveTo(isoPoints[0].x, isoPoints[0].y - height);
        ctx.lineTo(isoPoints[1].x, isoPoints[1].y - height);
        ctx.lineTo(isoPoints[2].x, isoPoints[2].y - height);
        ctx.lineTo(isoPoints[3].x, isoPoints[3].y - height);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = opacity;
        ctx.stroke();

        // Dessiner les étages (VISIBLES avec Rayons X)
        if (rack.levels && rack.levels.length > 0) {
            const levelHeight = height / rack.levels.length;

            rack.levels.forEach((level, index) => {
                const levelY = y - (index + 1) * levelHeight;

                // Ligne de séparation (plus visible avec rayons X)
                const lineAlpha = 0.5 + (xrayAlpha * 0.5); // Plus visible avec rayons X
                ctx.strokeStyle = `rgba(0,0,0,${lineAlpha})`;
                ctx.lineWidth = 2;
                ctx.globalAlpha = opacity;
                ctx.beginPath();
                ctx.moveTo(isoPoints[0].x, levelY);
                ctx.lineTo(isoPoints[1].x, levelY);
                ctx.lineTo(isoPoints[2].x, levelY);
                ctx.stroke();

                // EFFET RAYONS X : Montrer le contenu de l'étage
                if (xrayAlpha > 0.3) {
                    this.drawLevelContents(ctx, isoPoints, levelY, levelHeight, level, xrayAlpha, opacity);
                }
            });
        }

        // Code du rack
        ctx.globalAlpha = opacity;
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 4;
        ctx.fillText(rack.code, x, y - height/2);
        ctx.shadowBlur = 0;

        // Indicateur du nombre d'étages
        if (rack.levels && rack.levels.length > 0) {
            ctx.font = '10px Arial';
            ctx.fillStyle = 'rgba(255,255,255,0.8)';
            ctx.fillText(`${rack.levels.length} étages`, x, y - height - 10);
        }

        // Effet de glow si rayons X actif
        if (xrayAlpha > 0) {
            ctx.globalAlpha = xrayAlpha * 0.5;
            ctx.strokeStyle = '#00ffff';
            ctx.lineWidth = 3;
            ctx.shadowColor = '#00ffff';
            ctx.shadowBlur = 10;

            // Contour brillant
            ctx.beginPath();
            ctx.moveTo(isoPoints[0].x, isoPoints[0].y);
            ctx.lineTo(isoPoints[1].x, isoPoints[1].y);
            ctx.lineTo(isoPoints[1].x, isoPoints[1].y - height);
            ctx.lineTo(isoPoints[0].x, isoPoints[0].y - height);
            ctx.closePath();
            ctx.stroke();

            ctx.shadowBlur = 0;
        }

        ctx.restore();
    }

    // Dessiner le contenu d'un étage (visible en mode Rayons X)
    drawLevelContents(ctx, isoPoints, levelY, levelHeight, level, xrayAlpha, opacity) {
        if (!level.slots || level.slots.length === 0) return;

        ctx.save();

        // Calculer la largeur de l'étage
        const levelWidth = Math.abs(isoPoints[1].x - isoPoints[0].x);
        const slotWidth = levelWidth / Math.max(level.slots.length, 1);

        // Parcourir les emplacements
        level.slots.forEach((slot, index) => {
            const slotX = isoPoints[0].x + (index + 0.5) * slotWidth;
            const slotY = levelY - levelHeight / 2;

            // Vérifier si l'emplacement contient des articles
            const hasArticles = slot.articles && slot.articles.length > 0;

            if (hasArticles) {
                const article = slot.articles[0];
                const quantity = article.quantity || article.stock_actuel || 0;

                // Couleur selon le stock
                let stockColor = '#2ecc71'; // Vert par défaut
                if (quantity === 0) {
                    stockColor = '#e74c3c'; // Rouge
                } else if (quantity <= (article.stock_minimum || 3)) {
                    stockColor = '#f39c12'; // Orange
                }

                // Dessiner une petite boîte pour l'article
                const boxSize = Math.min(slotWidth * 0.6, 8);

                ctx.globalAlpha = opacity * xrayAlpha;
                ctx.fillStyle = stockColor;
                ctx.beginPath();
                ctx.arc(slotX, slotY, boxSize / 2, 0, Math.PI * 2);
                ctx.fill();

                // Bordure brillante
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 1;
                ctx.stroke();

                // Afficher la quantité si assez de place
                if (boxSize > 5 && xrayAlpha > 0.7) {
                    ctx.globalAlpha = opacity * xrayAlpha;
                    ctx.fillStyle = '#fff';
                    ctx.font = 'bold 7px Arial';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(quantity.toString(), slotX, slotY);
                }
            } else {
                // Emplacement vide - petit point gris
                ctx.globalAlpha = opacity * xrayAlpha * 0.3;
                ctx.fillStyle = '#95a5a6';
                const emptySize = Math.min(slotWidth * 0.3, 4);
                ctx.beginPath();
                ctx.arc(slotX, slotY, emptySize / 2, 0, Math.PI * 2);
                ctx.fill();
            }
        });

        ctx.restore();
    }

    // Ajuster la luminosité d'une couleur
    adjustColor(color, amount) {
        // Convertir hex en RGB
        const hex = color.replace('#', '');
        let r = parseInt(hex.substr(0, 2), 16);
        let g = parseInt(hex.substr(2, 2), 16);
        let b = parseInt(hex.substr(4, 2), 16);

        // Ajuster
        r = Math.max(0, Math.min(255, r + amount));
        g = Math.max(0, Math.min(255, g + amount));
        b = Math.max(0, Math.min(255, b + amount));

        // Reconvertir en hex
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }

    // Dans QuadViewManager

    updateLevelView(level) {
        const container = document.getElementById('quadLevelSlots');
        if (!container || !level) return;

        // Vérifier s'il y a déjà un tiroir ouvert
        const currentDrawer = container.querySelector('.quad-drawer-container');

        if (currentDrawer && currentDrawer.classList.contains('open')) {
            // Fermer le tiroir actuel avec animation
            currentDrawer.classList.remove('open');

            // Attendre LA FIN de l'animation de fermeture (700ms)
            setTimeout(() => {
                container.innerHTML = '';
                this.createDrawer(container, level);
            }, 700);
        } else {
            // Pas de tiroir ouvert, créer directement
            container.innerHTML = '';
            this.createDrawer(container, level);
        }
    }

    createDrawer(container, level) {
        // Créer la structure du tiroir
        const drawerContainer = document.createElement('div');
        drawerContainer.className = 'quad-drawer-container';

        // Titre sur une ligne
        drawerContainer.innerHTML = `
            <div class="drawer-front">
                <div>Étage ${level.code}</div>
                <div class="level-label">${level.slots?.length || 0} emplacements</div>
                <div class="drawer-handle" title="Cliquez pour ouvrir/fermer"></div>
            </div>
            <div class="drawer-body">
                <div class="drawer-interior">
                    ${this.generateSlotElements(level.slots)}
                </div>
            </div>
        `;

        container.appendChild(drawerContainer);

        // Ouvrir le tiroir après un court délai
        setTimeout(() => {
            drawerContainer.classList.add('open');
        }, 100);

        // Événement sur la poignée
        const handle = drawerContainer.querySelector('.drawer-handle');
        handle.addEventListener('click', (e) => {
            e.stopPropagation();
            drawerContainer.classList.toggle('open');
        });

        document.getElementById('quadLevelInfo').textContent =
            `Étage ${level.code} - ${level.slots?.length || 0} emplacements`;
    }

    // Dans QuadViewManager - Modifiez generateSlotElements() :

    generateSlotElements(slots) {
        if (!slots || slots.length === 0) {
            return `
                <div class="empty-drawer-message">
                    <i class="fas fa-box-open"></i>
                    <p>Tiroir vide</p>
                </div>
            `;
        }

        const sortedSlots = [...slots].sort((a, b) => {
            return parseInt(a.code) - parseInt(b.code);
        });

        let html = '';

        const slotCount = sortedSlots.length;
        let zoomClass = 'zoom-large';
        if (slotCount > 14) zoomClass = 'zoom-small';
        else if (slotCount > 9) zoomClass = 'zoom-medium';

        sortedSlots.forEach(slot => {
            const article = slot.articles && slot.articles.length > 0 ? slot.articles[0] : null;
            const stockLevel = article ? this.getStockLevel(article) : '';

            html += `
                <div class="quad-slot ${zoomClass} ${article ? 'occupied ' + stockLevel : ''}"
                     data-slot-id="${slot.id}"
                     data-slot-code="${slot.code}"
                     data-full-code="${slot.full_code}"
                     data-article-id="${article ? article.id : ''}"
                     title="${this.generateSlotTooltip(slot, article)}">
                    ${this.generateSlotContent(slot, article, zoomClass)}
                </div>
            `;
        });

        // APRÈS avoir créé le HTML, ajouter les événements avec setTimeout
        setTimeout(() => {
            this.bindSlotEvents();
        }, 300);

        return html; // <-- AJOUTEZ CETTE LIGNE
    } // <-- FERMETURE DE LA FONCTION ICI

    // NOUVELLE MÉTHODE - Événements sur les slots
    bindSlotEvents() {
        const slots = document.querySelectorAll('.quad-slot.occupied');

        slots.forEach(slot => {
            slot.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openStockModal(slot);
            });
        });
    }

    // NOUVELLE MÉTHODE - Ouvrir le modal
    openStockModal(slotElement) {
        const slotId = slotElement.dataset.slotId;
        const slotCode = slotElement.dataset.slotCode;
        const fullCode = slotElement.dataset.fullCode;
        const articleId = slotElement.dataset.articleId;

        if (!articleId) return;

        // Trouver l'article dans les données
        const article = this.findArticleById(articleId);
        if (!article) return;

        // Remplir le modal
        document.getElementById('modalArticlePhoto').src =
            article.photo || article.photo_url || 'https://via.placeholder.com/150x150/cccccc/666666?text=📦';

        document.getElementById('modalArticleName').textContent =
            article.name || article.nom || 'Article';

        document.getElementById('modalSlotCode').textContent = fullCode;
        document.getElementById('modalBarcode').textContent =
            article.barcode || article.code_barre || 'N/A';

        const currentStock = article.quantity || article.stock_actuel || 0;
        document.getElementById('modalCurrentStock').textContent = currentStock;
        document.getElementById('modalCurrentStock').className =
            'detail-value ' + this.getStockLevel(article);

        const minStock = article.stock_minimum || 0;
        document.getElementById('modalMinStock').textContent = minStock;

        // Définir la valeur de l'input
        const stockInput = document.getElementById('modalStockInput');
        stockInput.value = currentStock;
        stockInput.dataset.articleId = articleId;
        stockInput.dataset.currentStock = currentStock;

        // Ouvrir le modal
        document.getElementById('stockModalOverlay').classList.add('active');
    }

    // NOUVELLE MÉTHODE - Trouver un article par ID
    findArticleById(articleId) {
        // Parcourir tous les racks, niveaux et slots
        if (!window.vueStock || !window.vueStock.racks) return null;

        for (const rack of window.vueStock.racks) {
            if (!rack.levels) continue;

            for (const level of rack.levels) {
                if (!level.slots) continue;

                for (const slot of level.slots) {
                    if (!slot.articles || slot.articles.length === 0) continue;

                    const article = slot.articles[0];
                    if (article.id === articleId) {
                        return article;
                    }
                }
            }
        }

        return null;
    }

    // Initialiser les événements du modal (à appeler une fois au chargement)
    initStockModal() {
        const overlay = document.getElementById('stockModalOverlay');
        const modal = document.getElementById('stockModal');

        // Fermer le modal
        document.getElementById('closeStockModal').addEventListener('click', () => {
            overlay.classList.remove('active');
        });

        document.getElementById('cancelStockModal').addEventListener('click', () => {
            overlay.classList.remove('active');
        });

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.classList.remove('active');
            }
        });

        // Boutons +/-
        document.getElementById('btnIncrease').addEventListener('click', () => {
            const input = document.getElementById('modalStockInput');
            input.value = parseInt(input.value || 0) + 1;
        });

        document.getElementById('btnDecrease').addEventListener('click', () => {
            const input = document.getElementById('modalStockInput');
            const current = parseInt(input.value || 0);
            if (current > 0) {
                input.value = current - 1;
            }
        });

        // Sauvegarder
        document.getElementById('saveStockModal').addEventListener('click', async () => {
            await this.saveStockChanges();
        });
    }

    // NOUVELLE MÉTHODE - Sauvegarder les changements
    async saveStockChanges() {
        const input = document.getElementById('modalStockInput');
        const articleId = input.dataset.articleId;
        const newQuantity = parseInt(input.value || 0);
        const oldQuantity = parseInt(input.dataset.currentStock || 0);

        if (newQuantity === oldQuantity) {
            alert('Aucun changement détecté');
            return;
        }

        if (newQuantity < 0) {
            alert('La quantité ne peut pas être négative');
            return;
        }

        // SAUVEGARDER originalText AVANT try
        const saveBtn = document.getElementById('saveStockModal');
        const originalText = saveBtn.innerHTML; // <-- DÉPLACÉ ICI

        try {
            // Désactiver le bouton pendant la sauvegarde
            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enregistrement...';
            saveBtn.disabled = true;

            // Appeler l'API pour mettre à jour
            if (window.vueStock && window.vueStock.api) {
                const result = await window.vueStock.api.updateStock({
                    article_id: articleId,
                    new_quantity: newQuantity
                });

                if (result.success) {
                    // Mettre à jour localement
                    this.updateLocalStock(articleId, newQuantity);

                    // Mettre à jour l'affichage
                    this.refreshSlotDisplay(articleId, newQuantity);

                    // AJOUT IMPORTANT : Mettre à jour les statistiques
                    if (window.vueStock.updateStats) {
                        window.vueStock.updateStats();
                    }

                    // Fermer le modal
                    document.getElementById('stockModalOverlay').classList.remove('active');

                    // Notification
                    if (window.vueStock.showNotification) {
                        window.vueStock.showNotification(`Stock mis à jour: ${oldQuantity} → ${newQuantity}`);
                    }
                }
            }
        } catch (error) {
            console.error('Erreur mise à jour stock:', error);
            alert('Erreur: ' + error.message);
        } finally {
            // Réactiver le bouton - originalText est maintenant accessible
            saveBtn.innerHTML = originalText; // <-- CORRECT
            saveBtn.disabled = false;
        }
    }

    // NOUVELLE MÉTHODE - Mettre à jour localement
    updateLocalStock(articleId, newQuantity) {
        if (!window.vueStock || !window.vueStock.racks) return;

        for (const rack of window.vueStock.racks) {
            if (!rack.levels) continue;

            for (const level of rack.levels) {
                if (!level.slots) continue;

                for (const slot of level.slots) {
                    if (!slot.articles || slot.articles.length === 0) continue;

                    const article = slot.articles[0];
                    if (article.id === articleId) {
                        article.quantity = newQuantity;
                        article.stock_actuel = newQuantity;
                        break;
                    }
                }
            }
        }
    }

    // NOUVELLE MÉTHODE - Rafraîchir l'affichage
    refreshSlotDisplay(articleId, newQuantity) {
        // Trouver le slot correspondant
        const slotElement = document.querySelector(`[data-article-id="${articleId}"]`);
        if (!slotElement) return;

        // Mettre à jour la quantité affichée
        const quantityElement = slotElement.querySelector('.article-quantity');
        if (quantityElement) {
            quantityElement.textContent = newQuantity;
        }

        // Mettre à jour la couleur selon le nouveau stock
        const article = this.findArticleById(articleId);
        if (article) {
            const newStockLevel = this.getStockLevel(article);

            // Retirer les anciennes classes
            slotElement.classList.remove('stock-good', 'stock-low', 'stock-zero');

            // Ajouter la nouvelle classe
            if (newStockLevel) {
                slotElement.classList.add(newStockLevel);
            }

            // Mettre à jour le tooltip
            const slotData = {
                code: slotElement.dataset.slotCode,
                full_code: slotElement.dataset.fullCode,
                articles: [article]
            };
            slotElement.title = this.generateSlotTooltip(slotData, article);
        }
    }

    getStockLevel(article) {
        if (!article) return '';

        const stockActuel = article.stock_actuel || 0;
        const stockMinimum = article.stock_minimum || 0;

        if (stockActuel === 0) {
            return 'stock-zero';
        } else if (stockActuel <= stockMinimum) {
            return 'stock-low';
        } else {
            return 'stock-good';
        }
    }

    generateSlotTooltip(slot, article) {
        const baseText = `Emplacement ${slot.code}`;

        if (!article) {
            return `${baseText} - Libre`;
        }

        const stockActuel = article.stock_actuel || 0;
        const stockMinimum = article.stock_minimum || 0;
        const articleName = article.nom || 'Article';

        let status = '';
        if (stockActuel === 0) {
            status = 'Stock épuisé';
        } else if (stockActuel <= stockMinimum) {
            status = `Stock faible (min: ${stockMinimum})`;
        } else {
            status = `Stock OK (min: ${stockMinimum})`;
        }

        return `${baseText} - ${articleName}\n${stockActuel} unités - ${status}`;
    }


    generateSlotContent(slot, article, zoomClass) {
        if (!article) {
            // Slot vide
            return `
                <div class="quad-slot-code">${slot.code}</div>
                <div class="quad-slot-status">Libre</div>
            `;
        }

        // CORRECTION DES NOMS DE COLONNES :
        const imageUrl = article.photo || article.photo_url || 'https://via.placeholder.com/40x40/cccccc/666666?text=📦';
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

    // Modifiez getStockLevel() :
    getStockLevel(article) {
        if (!article) return '';

        // CORRECTION : vos colonnes sont 'quantity' et pas 'stock_actuel'
        // Mais je ne vois pas 'stock_minimum' dans vos données...
        const stockActuel = article.quantity || article.stock_actuel || 0;

        // Vous devez avoir 'stock_minimum' dans vos données Supabase
        // Si non, utilisez une valeur par défaut ou ajoutez la colonne
        const stockMinimum = article.stock_minimum || 3; // 3 par défaut selon votre INSERT

        if (stockActuel === 0) {
            return 'stock-zero';
        } else if (stockActuel <= stockMinimum) {
            return 'stock-low';
        } else {
            return 'stock-good';
        }
    }

    // Modifiez generateSlotTooltip() :
    generateSlotTooltip(slot, article) {
        const baseText = `Emplacement ${slot.code}`;

        if (!article) {
            return `${baseText} - Libre`;
        }

        const stockActuel = article.quantity || article.stock_actuel || 0;
        const stockMinimum = article.stock_minimum || 3; // Valeur par défaut
        const articleName = article.name || article.nom || 'Article';

        let status = '';
        if (stockActuel === 0) {
            status = 'Stock épuisé';
        } else if (stockActuel <= stockMinimum) {
            status = `Stock faible (min: ${stockMinimum})`;
        } else {
            status = `Stock OK (min: ${stockMinimum})`;
        }

        return `${baseText} - ${articleName}\n${stockActuel} unités - ${status}`;
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

    reset3DView() {
        console.log('Vue 3D réinitialisée');

        // Annuler toute animation en cours
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }

        // Animation de retour à la position initiale
        const targetRotation = 0;
        const currentRotation = this.rotation3D || 0;
        const diff = targetRotation - currentRotation;

        let step = 0;
        const steps = 40; // Animation plus longue pour le reset
        const animate = () => {
            step++;
            const newRotation = currentRotation + (diff * step / steps);

            // Vérifier que la valeur est valide
            if (!isNaN(newRotation) && isFinite(newRotation)) {
                this.rotation3D = newRotation;
            }

            // Réinitialiser aussi l'angle isométrique
            this.isometric.angle = 30;

            if (this.currentRacks) {
                this.draw3DView(this.currentRacks);
            }

            if (step < steps) {
                this.animationFrame = requestAnimationFrame(animate);
            } else {
                // Forcer exactement 0 à la fin
                this.rotation3D = 0;
                if (this.currentRacks) {
                    this.draw3DView(this.currentRacks);
                }
                this.animationFrame = null;
            }
        };

        animate();
    }

    animate3DRotation(targetRotation) {
        if (this.rotation3DAnimFrame) {
            cancelAnimationFrame(this.rotation3DAnimFrame);
        }

        const startRotation = this.rotation3D || 0;

        // SUPPRIMER cette inversion
        // const invertedTarget = -targetRotation; // ← À SUPPRIMER
        const finalTarget = targetRotation; // ← UTILISER directement targetRotation

        let diff = finalTarget - startRotation; // ← CHANGÉ : finalTarget au lieu de invertedTarget
        while (diff > 180) diff -= 360;
        while (diff < -180) diff += 360;

        const finalRotation = startRotation + diff;

        let step = 0;
        const steps = 40;

        const animate = () => {
            step++;
            const progress = step / steps;
            const easeProgress = 1 - Math.pow(1 - progress, 3);

            this.rotation3D = startRotation + (finalRotation - startRotation) * easeProgress;

            if (this.currentRacks) {
                this.draw3DView(this.currentRacks);
            }

            if (step < steps) {
                this.rotation3DAnimFrame = requestAnimationFrame(animate);
            } else {
                this.rotation3D = finalTarget; // ← CHANGÉ : finalTarget au lieu de invertedTarget
                if (this.currentRacks) {
                    this.draw3DView(this.currentRacks);
                }
            }
        };

        animate();
    }

    // Trouver quel rack est sous une position de souris
    findRackAt3DPosition(mouseX, mouseY) {
        if (!this.currentRacks || this.currentRacks.length === 0) return null;

        const width = this.canvas3D.width;
        const height = this.canvas3D.height;
        const centerX = width / 2;
        const centerY = height / 2 + 50;

        // Disposition linéaire (DOIT MATCHER draw3DView)
        const startX = -200;
        const spacingX = 120;

        // Trier comme dans draw3DView
        const sortedRacks = [...this.currentRacks].sort((a, b) => {
            return (a.position_x || 0) - (b.position_x || 0);
        });

        // Parcourir tous les racks
        for (let i = 0; i < sortedRacks.length; i++) {
            const rack = sortedRacks[i];

            // Position linéaire (identique à draw3DView)
            const x = startX + (i * spacingX);
            const z = 0; // Tous à la même profondeur

            // Projection isométrique
            const isoX = centerX + x * this.isometric.scale;
            const isoY = centerY - z * this.isometric.scale * 0.5;

            // Échelle
            const depthScale = 1 - (i / sortedRacks.length) * 0.1;
            const scale = depthScale;
            const rackWidth = rack.width * 20 * scale;
            const rackHeight = (rack.levels?.length || 1) * 12 * scale;

            // Zone de détection (rectangle)
            const left = isoX - rackWidth / 2;
            const right = isoX + rackWidth / 2;
            const top = isoY - rackHeight;
            const bottom = isoY;

            // Vérifier si la souris est dans cette zone
            if (mouseX >= left && mouseX <= right && mouseY >= top && mouseY <= bottom) {
                return rack;
            }
        }

        return null;
    }

    // Démarrer l'effet Rayons X
    startXRayEffect() {
        // Annuler l'animation précédente si existe
        if (this.xrayAnimFrame) {
            cancelAnimationFrame(this.xrayAnimFrame);
        }

        // Animation progressive
        const animate = () => {
            this.xrayProgress += 0.08; // Vitesse d'apparition
            if (this.xrayProgress > 1) this.xrayProgress = 1;

            if (this.currentRacks) {
                this.draw3DView(this.currentRacks);
            }

            if (this.xrayProgress < 1) {
                this.xrayAnimFrame = requestAnimationFrame(animate);
            }
        };

        animate();
    }

    // Arrêter l'effet Rayons X
    stopXRayEffect() {
        // Annuler l'animation
        if (this.xrayAnimFrame) {
            cancelAnimationFrame(this.xrayAnimFrame);
        }

        // Animation de disparition
        const animate = () => {
            this.xrayProgress -= 0.1; // Vitesse de disparition
            if (this.xrayProgress < 0) this.xrayProgress = 0;

            if (this.currentRacks) {
                this.draw3DView(this.currentRacks);
            }

            if (this.xrayProgress > 0) {
                this.xrayAnimFrame = requestAnimationFrame(animate);
            }
        };

        animate();
    }

    // Zoomer sur un rack
    zoomOnRack(rack) {
        // Si c'est déjà le rack en focus, dézoomer
        if (this.focusedRack === rack) {
            this.resetZoom();
            return;
        }

        this.focusedRack = rack;

        // Annuler animation précédente
        if (this.zoomAnimFrame) {
            cancelAnimationFrame(this.zoomAnimFrame);
        }

        // Trouver l'angle du rack pour le centrer
        const rackIndex = this.currentRacks.indexOf(rack);
        const baseAngle = (rackIndex / this.currentRacks.length) * 360;

        // Calculer la rotation nécessaire pour centrer le rack
        // On veut que le rack soit à 0° (face à nous)
        let targetRotation = -baseAngle;

        // Normaliser l'angle pour trouver le chemin le plus court
        const currentRotation = this.rotation3D;
        let diff = targetRotation - currentRotation;

        // Prendre le chemin le plus court (éviter de tourner 350° au lieu de 10°)
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;

        targetRotation = currentRotation + diff;

        this.camera.targetRotation = targetRotation;
        this.camera.targetScale = 1.4; // Zoom plus modéré (au lieu de 1.8)

        // Animation
        const startRotation = this.rotation3D;
        const startScale = this.camera.currentScale;
        let step = 0;
        const steps = 40;

        const animate = () => {
            step++;
            const progress = step / steps;
            const easeProgress = 1 - Math.pow(1 - progress, 3); // Easing

            // Rotation fluide
            this.rotation3D = startRotation + (targetRotation - startRotation) * easeProgress;

            // Zoom fluide
            this.camera.currentScale = startScale + (this.camera.targetScale - startScale) * easeProgress;
            this.zoomProgress = easeProgress;

            if (this.currentRacks) {
                this.draw3DView(this.currentRacks);
            }

            if (step < steps) {
                this.zoomAnimFrame = requestAnimationFrame(animate);
            }
        };

        animate();

        console.log(`🔍 Zoom sur rack ${rack.code} - Rotation: ${Math.round(targetRotation)}°, Scale: 1.4x`);
    }

    // Réinitialiser le zoom
    resetZoom() {
        this.focusedRack = null;

        // Annuler animation précédente
        if (this.zoomAnimFrame) {
            cancelAnimationFrame(this.zoomAnimFrame);
        }

        this.camera.targetScale = 1;
        const startScale = this.camera.currentScale;
        let step = 0;
        const steps = 30;

        const animate = () => {
            step++;
            const progress = step / steps;
            const easeProgress = 1 - Math.pow(1 - progress, 3);

            this.camera.currentScale = startScale + (1 - startScale) * easeProgress;
            this.zoomProgress = 1 - easeProgress;

            if (this.currentRacks) {
                this.draw3DView(this.currentRacks);
            }

            if (step < steps) {
                this.zoomAnimFrame = requestAnimationFrame(animate);
            }
        };

        animate();
    }

    updateInfoPanel(racks) {
        document.getElementById('racksCount').textContent = racks.length;

        if (this.selectedRack) {
            document.getElementById('selectedElement').textContent =
                `Rack ${this.selectedRack.code}`;
        } else if (this.selectedLevel) {
            document.getElementById('selectedElement').textContent =
                `Étage ${this.selectedLevel.code}`;
        }
    }

    // Mettre à jour le panneau Propriétés à gauche
    updatePropertiesPanel(rack) {
        const panel = document.getElementById('propertiesPanel');
        if (!panel) {
            console.warn('Panneau Propriétés non trouvé');
            return;
        }

        // Vérifier si le rack a des niveaux
        const levelCount = rack.levels ? rack.levels.length : 0;
        const slotCount = rack.levels ? rack.levels.reduce((sum, level) =>
            sum + (level.slots ? level.slots.length : 0), 0) : 0;

        panel.innerHTML = `
            <h4><i class="fas fa-warehouse"></i> Étagère ${rack.code}</h4>
            <div class="property-group">
                <div class="property">
                    <span class="property-label">Nom:</span>
                    <input type="text" class="property-input" id="quadRackName"
                           value="${rack.name || 'Étagère ' + rack.code}"
                           placeholder="Nom de l'étagère">
                </div>
                <div class="property">
                    <span class="property-label">Position:</span>
                    <div class="property-coords">
                        <input type="number" class="coord-input" id="quadRackX"
                               value="${Math.round(rack.position_x / 40)}" min="0" title="Position X">
                        <span>×</span>
                        <input type="number" class="coord-input" id="quadRackY"
                               value="${Math.round(rack.position_y / 40)}" min="0" title="Position Y">
                    </div>
                </div>
                <div class="property">
                    <span class="property-label">Dimensions:</span>
                    <div class="property-dimensions">
                        <input type="number" class="dim-input" id="quadRackWidth"
                               value="${rack.width}" min="1" max="10" title="Largeur en cases">
                        <span>×</span>
                        <input type="number" class="dim-input" id="quadRackDepth"
                               value="${rack.depth}" min="1" max="10" title="Profondeur en cases">
                    </div>
                </div>
                <div class="property">
                    <span class="property-label">Rotation:</span>
                    <div class="property-rotation">
                        <input type="range" class="rotation-slider" id="quadRackRotation"
                               value="${rack.rotation || 0}" min="0" max="360" step="15">
                        <span class="rotation-value">${rack.rotation || 0}°</span>
                    </div>
                </div>
                <div class="property">
                    <span class="property-label">Couleur:</span>
                    <input type="color" class="property-color" id="quadRackColor"
                           value="${rack.color || '#4a90e2'}">
                </div>
                <div class="property">
                    <span class="property-label">Contenu:</span>
                    <span class="property-value">
                        ${levelCount} étage(s), ${slotCount} emplacement(s)
                    </span>
                </div>
            </div>

            <div class="property-actions">
                <button class="btn btn-sm btn-primary btn-block" id="quadSaveRack">
                    <i class="fas fa-save"></i> Sauvegarder
                </button>
                <button class="btn btn-sm btn-danger btn-block" id="quadDeleteRack">
                    <i class="fas fa-trash"></i> Supprimer
                </button>
                <button class="btn btn-sm btn-secondary btn-block" id="quadViewRackDetails">
                    <i class="fas fa-eye"></i> Voir les étages
                </button>
            </div>
        `;

        // Ajouter les événements
        this.bindPropertiesEvents(rack);
    }

    // Vider le panneau Propriétés
    clearPropertiesPanel() {
        const panel = document.getElementById('propertiesPanel');
        if (panel) {
            panel.innerHTML = '<p class="no-selection">Sélectionnez un élément pour voir ses propriétés</p>';
        }
    }

    // Lier les événements du panneau Propriétés
    bindPropertiesEvents(rack) {
        // Mise à jour en temps réel de la rotation
        const rotationSlider = document.getElementById('quadRackRotation');
        const rotationValue = document.querySelector('.rotation-value');

        if (rotationSlider && rotationValue) {
            rotationSlider.addEventListener('input', (e) => {
                rotationValue.textContent = e.target.value + '°';
                rack.rotation = parseInt(e.target.value);
                this.drawTopView(this.currentRacks);
            });
        }

        // Mise à jour de la couleur en temps réel
        const colorInput = document.getElementById('quadRackColor');
        if (colorInput) {
            colorInput.addEventListener('input', (e) => {
                rack.color = e.target.value;
                this.drawTopView(this.currentRacks);
            });
        }

        // Bouton Sauvegarder
        const saveBtn = document.getElementById('quadSaveRack');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.saveRackChanges(rack);
            });
        }

        // Bouton Supprimer
        const deleteBtn = document.getElementById('quadDeleteRack');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                this.deleteRack(rack);
            });
        }

        // Bouton Voir les étages
        const viewBtn = document.getElementById('quadViewRackDetails');
        if (viewBtn) {
            viewBtn.addEventListener('click', () => {
                this.viewRackDetails(rack);
            });
        }
    }

    async saveRackChanges(rack) {
        if (!rack) return;

        // Récupérer les valeurs modifiées
        const nameInput = document.getElementById('quadRackName');
        const xInput = document.getElementById('quadRackX');
        const yInput = document.getElementById('quadRackY');
        const widthInput = document.getElementById('quadRackWidth');
        const depthInput = document.getElementById('quadRackDepth');
        const rotationInput = document.getElementById('quadRackRotation');
        const colorInput = document.getElementById('quadRackColor');

        if (nameInput) rack.name = nameInput.value;
        if (xInput) rack.position_x = parseInt(xInput.value) * 40; // Convertir en pixels
        if (yInput) rack.position_y = parseInt(yInput.value) * 40;
        if (widthInput) rack.width = parseInt(widthInput.value);
        if (depthInput) rack.depth = parseInt(depthInput.value);
        if (rotationInput) rack.rotation = parseInt(rotationInput.value);
        if (colorInput) rack.color = colorInput.value;

        // 🔴 AJOUTEZ CETTE LIGNE ICI (juste avant console.log) :
        // Synchroniser position_x/y avec displayX/Y avant tout
        if (typeof rack.displayX !== 'undefined' && typeof rack.displayY !== 'undefined') {
            const scale = 1;
            rack.position_x = rack.displayX / scale;
            rack.position_y = rack.displayY / scale;
        }

        console.log('Sauvegarde du rack:', rack);

        // Redessiner
        this.drawFrontView(rack);

        // Mettre à jour uniquement le panneau sans redessiner
        this.updatePropertiesPanel(rack);

        // Sauvegarder via API
        if (window.vueStock && window.vueStock.api) {
            try {
                const result = await window.vueStock.api.saveRack({
                    id: rack.id,
                    code: rack.code,
                    name: rack.name,
                    position_x: rack.position_x, // ✅ Maintenant synchronisé
                    position_y: rack.position_y,
                    rotation: rack.rotation || 0,
                    width: rack.width,
                    depth: rack.depth,
                    color: rack.color
                });

                console.log('Rack sauvegardé:', result);

                // 🟢 RETIREZ ou COMMETEZ ces lignes (elles sont maintenant inutiles) :
                // const scale = 1;
                // rack.position_x = rack.displayX / scale;
                // rack.position_y = rack.displayY / scale;

                this.showQuadNotification('Étagère sauvegardée', 'success');

            } catch (error) {
                console.error('Erreur sauvegarde:', error);
                this.showQuadNotification('Erreur sauvegarde: ' + error.message, 'error');
            }
        } else {
            this.showQuadNotification('Modifications locales sauvegardées', 'info');
        }
    }

    // Supprimer un rack
    async deleteRack(rack) {
        if (!rack || !confirm(`Supprimer l'étagère ${rack.code} et tous ses étages/emplacements ?`)) {
            return;
        }

        console.log('Suppression du rack:', rack.code);

        try {
            // Supprimer via API
            if (window.vueStock && window.vueStock.api) {
                await window.vueStock.api.deleteRack(rack.id);
            }

            // Supprimer du tableau local
            if (this.currentRacks) {
                const index = this.currentRacks.findIndex(r => r.id === rack.id);
                if (index !== -1) {
                    this.currentRacks.splice(index, 1);
                }
            }

            // Supprimer de VueStock aussi
            if (window.vueStock && window.vueStock.racks) {
                window.vueStock.racks = window.vueStock.racks.filter(r => r.id !== rack.id);
            }

            // Mettre à jour l'affichage
            this.selectedRack = null;
            this.clearPropertiesPanel();
            this.drawTopView(this.currentRacks);
            this.updateInfoPanel(this.currentRacks);

            this.showQuadNotification(`Étagère ${rack.code} supprimée`, 'success');

        } catch (error) {
            console.error('Erreur suppression:', error);
            this.showQuadNotification('Erreur suppression: ' + error.message, 'error');
        }
    }

    // Voir les détails du rack (aller à la vue étagère)
    viewRackDetails(rack) {
        console.log('Voir les détails du rack:', rack.code);

        // Utiliser la navigation existante de VueStock
        if (window.vueStock && window.vueStock.goToRackView) {
            window.vueStock.goToRackView(rack);
        } else {
            this.showQuadNotification('Navigation non disponible', 'warning');
        }
    }

    // Afficher une notification dans le contexte Quad
    showQuadNotification(message, type = 'info') {
        console.log(`Quad Notification [${type}]:`, message);

        // Utiliser le système de notification existant ou créer un simple alert
        if (window.vueStock && window.vueStock.showNotification) {
            window.vueStock.showNotification(message, type);
        } else {
            // Notification simple
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: ${type === 'error' ? '#e74c3c' : type === 'success' ? '#2ecc71' : '#3498db'};
                color: white;
                padding: 10px 20px;
                border-radius: 5px;
                z-index: 10000;
                animation: fadeInOut 3s;
            `;
            notification.textContent = message;
            document.body.appendChild(notification);

            setTimeout(() => {
                notification.remove();
            }, 3000);
        }
    }

    getClickedHandle(clickX, clickY) {
        if (!this.selectedRack) return null;

        const rack = this.selectedRack;

        // ✅ Appliquer le scale inverse
        const scale = this.topViewScale || 1;
        const adjustedClickX = clickX / scale;
        const adjustedClickY = clickY / scale;

        const rackX = rack.displayX;
        const rackY = rack.displayY;
        const rackWidth = rack.displayWidth;
        const rackHeight = rack.displayHeight;

        const handleSize = 8;
        const rotateHandleSize = 30;

        // ✅ UTILISER EXACTEMENT LES MÊMES CALCULS QUE DANS drawTopView
        const rackVisualWidth = rackWidth;  // Déjà en pixels logiques
        const rackVisualHeight = rackHeight;

        const rotateHandleCenterX = rackX + (rackVisualWidth / 2);
        const rotateHandleCenterY = rackY - 25;

        const handles = {
            nw: {
                x: rackX - handleSize/2,
                y: rackY - handleSize/2,
                width: handleSize,
                height: handleSize
            },
            ne: {
                x: rackX + rackVisualWidth - handleSize/2,
                y: rackY - handleSize/2,
                width: handleSize,
                height: handleSize
            },
            sw: {
                x: rackX - handleSize/2,
                y: rackY + rackVisualHeight - handleSize/2,
                width: handleSize,
                height: handleSize
            },
            se: {
                x: rackX + rackVisualWidth - handleSize/2,
                y: rackY + rackVisualHeight - handleSize/2,
                width: handleSize,
                height: handleSize
            },
            rotate: {
                x: rotateHandleCenterX - rotateHandleSize/2,
                y: rotateHandleCenterY - rotateHandleSize/2,
                width: rotateHandleSize,
                height: rotateHandleSize
            }
        };

        console.log('🔍 Clic ajusté:', adjustedClickX.toFixed(1), adjustedClickY.toFixed(1), '(scale:', scale.toFixed(3) + ')');
        console.log('🎯 Rotate calculée:',
                    (rotateHandleCenterX - rotateHandleSize/2).toFixed(1), '-',
                    (rotateHandleCenterX + rotateHandleSize/2).toFixed(1), ',',
                    (rotateHandleCenterY - rotateHandleSize/2).toFixed(1), '-',
                    (rotateHandleCenterY + rotateHandleSize/2).toFixed(1));

        // ✅ VÉRIFICATION avec les valeurs stockées
        if (rack._debugRotateHandle) {
            console.log('🎯 Rotate DESSINÉE:',
                        rack._debugRotateHandle.left.toFixed(1), '-',
                        rack._debugRotateHandle.right.toFixed(1), ',',
                        rack._debugRotateHandle.top.toFixed(1), '-',
                        rack._debugRotateHandle.bottom.toFixed(1));
        }

        for (const [handleName, handleRect] of Object.entries(handles)) {
            const inX = adjustedClickX >= handleRect.x && adjustedClickX <= handleRect.x + handleRect.width;
            const inY = adjustedClickY >= handleRect.y && adjustedClickY <= handleRect.y + handleRect.height;

            console.log(`  ${handleName}: ${handleRect.x.toFixed(1)}-${(handleRect.x + handleRect.width).toFixed(1)}, ${handleRect.y.toFixed(1)}-${(handleRect.y + handleRect.height).toFixed(1)} -> ${inX && inY ? '✅ HIT!' : 'miss'}`);

            if (inX && inY) {
                console.log('✅✅✅ Poignette détectée:', handleName);
                return handleName;
            }
        }

        console.log('❌ Aucune poignette détectée');
        return null;
    }

    // Démarrer le redimensionnement depuis une poignette
    startResizeFromHandle(rack, handle, startX, startY) {
        console.log('Redimensionnement depuis', handle, 'pour le rack', rack.code);

        this.currentMode = 'resize';
        this.currentRack = rack;
        this.resizeHandle = handle;
        this.resizeStart = {
            x: startX,
            y: startY,
            width: rack.width,
            depth: rack.depth,
            position_x: rack.position_x,
            position_y: rack.position_y
        };

        // Changer le curseur selon la poignette
        const cursorMap = {
            'nw': 'nw-resize',
            'ne': 'ne-resize',
            'sw': 'sw-resize',
            'se': 'se-resize'
        };

        if (this.canvasTop && cursorMap[handle]) {
            this.canvasTop.style.cursor = cursorMap[handle];
        }

        // Ajouter les événements
        this.canvasTop.addEventListener('mousemove', this.handleResize.bind(this));
        this.canvasTop.addEventListener('mouseup', this.stopResize.bind(this));

        this.showQuadNotification('Redimensionnement activé. Glissez pour modifier la taille.', 'info');
    }

    // Gérer le redimensionnement
    handleResize(e) {
        if (this.currentMode !== 'resize' || !this.currentRack || !this.resizeHandle) return;

        const rect = this.canvasTop.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const deltaX = mouseX - this.resizeStart.x;
        const deltaY = mouseY - this.resizeStart.y;

        // Calculer la différence en cases (chaque case = 20px dans cette vue)
        const gridSize = 20;
        const scale = 1;
        const deltaGridX = Math.round(deltaX / gridSize);
        const deltaGridY = Math.round(deltaY / gridSize);

        let newWidth = this.resizeStart.width;
        let newDepth = this.resizeStart.depth;
        let newPosX = this.resizeStart.position_x;
        let newPosY = this.resizeStart.position_y;

        // Appliquer les changements selon la poignette
        switch(this.resizeHandle) {
            case 'se': // Coin inférieur droit
                newWidth = Math.max(1, this.resizeStart.width + deltaGridX);
                newDepth = Math.max(1, this.resizeStart.depth + deltaGridY);
                break;

            case 'sw': // Coin inférieur gauche
                newWidth = Math.max(1, this.resizeStart.width - deltaGridX);
                newDepth = Math.max(1, this.resizeStart.depth + deltaGridY);
                newPosX = this.resizeStart.position_x + (deltaGridX * 40); // 40 = gridSize * 2 (scale inverse)
                break;

            case 'ne': // Coin supérieur droit
                newWidth = Math.max(1, this.resizeStart.width + deltaGridX);
                newDepth = Math.max(1, this.resizeStart.depth - deltaGridY);
                newPosY = this.resizeStart.position_y + (deltaGridY * 40);
                break;

            case 'nw': // Coin supérieur gauche
                newWidth = Math.max(1, this.resizeStart.width - deltaGridX);
                newDepth = Math.max(1, this.resizeStart.depth - deltaGridY);
                newPosX = this.resizeStart.position_x + (deltaGridX * 40);
                newPosY = this.resizeStart.position_y + (deltaGridY * 40);
                break;
        }

        // Appliquer les changements
        this.currentRack.width = newWidth;
        this.currentRack.depth = newDepth;
        this.currentRack.position_x = newPosX;
        this.currentRack.position_y = newPosY;

        // Mettre à jour les champs dans le panneau
        const widthInput = document.getElementById('quadRackWidth');
        const depthInput = document.getElementById('quadRackDepth');
        const xInput = document.getElementById('quadRackX');
        const yInput = document.getElementById('quadRackY');

        if (widthInput) widthInput.value = newWidth;
        if (depthInput) depthInput.value = newDepth;
        if (xInput) xInput.value = Math.round(newPosX / 40);
        if (yInput) yInput.value = Math.round(newPosY / 40);

        // Redessiner
        this.drawTopView(this.currentRacks);
    }

    // Arrêter le redimensionnement
    stopResize() {
        if (this.currentMode === 'resize') {
            this.currentMode = null;
            this.currentRack = null;
            this.resizeHandle = null;
            this.resizeStart = null;

            if (this.canvasTop) {
                this.canvasTop.style.cursor = 'pointer';
                this.canvasTop.removeEventListener('mousemove', this.handleResize);
                this.canvasTop.removeEventListener('mouseup', this.stopResize);
            }

            this.showQuadNotification('Redimensionnement terminé', 'info');
        }
    }

    // Démarrer la rotation depuis la poignette
    startRotationFromHandle(rack, startX, startY) {
        console.log('Rotation depuis poignette pour le rack', rack.code);

        this.currentMode = 'rotate';
        this.currentRack = rack;
        this.rotateStart = {
            x: startX,
            y: startY,
            centerX: (rack.position_x * 1) % this.canvasTop.width + (rack.width * 20 / 2),
            centerY: (rack.position_y * 1) % this.canvasTop.height + (rack.depth * 20 / 2),
            startRotation: rack.rotation || 0
        };

        if (this.canvasTop) {
            this.canvasTop.style.cursor = 'grab';
        }

        // Ajouter les événements
        this.canvasTop.addEventListener('mousemove', this.handleRotationDrag.bind(this));
        this.canvasTop.addEventListener('mouseup', this.stopRotationDrag.bind(this));

        this.showQuadNotification('Rotation activée. Glissez pour tourner le rack.', 'info');
    }

    // Gérer la rotation par glisser
    handleRotationDrag(e) {
        if (this.currentMode !== 'rotate' || !this.currentRack || !this.rotateStart) return;

        const rect = this.canvasTop.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Calculer l'angle
        const deltaX = mouseX - this.rotateStart.centerX;
        const deltaY = mouseY - this.rotateStart.centerY;
        const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);

        // Snap à 15 degrés
        let newRotation = Math.round(angle / 15) * 15;
        if (newRotation < 0) newRotation += 360;

        // Appliquer
        this.currentRack.rotation = newRotation;

        // Mettre à jour le slider
        const rotationSlider = document.getElementById('quadRackRotation');
        const rotationValue = document.querySelector('.rotation-value');
        if (rotationSlider) rotationSlider.value = newRotation;
        if (rotationValue) rotationValue.textContent = newRotation + '°';

        // Redessiner
        this.drawTopView(this.currentRacks);
    }

    // Arrêter la rotation
    stopRotationDrag() {
        if (this.currentMode === 'rotate') {
            this.currentMode = null;
            this.currentRack = null;
            this.rotateStart = null;

            if (this.canvasTop) {
                this.canvasTop.style.cursor = 'pointer';
                this.canvasTop.removeEventListener('mousemove', this.handleRotationDrag);
                this.canvasTop.removeEventListener('mouseup', this.stopRotationDrag);
            }

            this.showQuadNotification('Rotation terminée', 'info');
        }
    }

    // Méthodes pour la sélection
    selectRack(rack) {
        this.selectedRack = rack;
        this.selectedLevel = null;

        // Mettre à jour les vues
        if (window.vueStock) {
            this.drawFrontView(rack);
            this.updateAllViews(window.vueStock.racks);
        }

        // Si le rack a des niveaux, sélectionner le premier
        if (rack.levels && rack.levels.length > 0) {
            this.selectLevel(rack.levels[0]);
        }
    }

    selectLevel(level) {
        this.selectedLevel = level;
        this.updateLevelView(level);
    }
}


// vuestock.js - Version 1.0 - Structure de base
class VueStock {
    constructor() {
        // EMPÊCHER L'INITIALISATION MULTIPLE
        if (window.vueStockInstance) {
            console.warn('⚠️ VueStock déjà initialisé, retour de l\'instance existante');
            return window.vueStockInstance;
        }
        window.vueStockInstance = this;

        this.currentView = 'plan'; // plan, rack, level
        this.selectedRack = null;
        this.selectedLevel = null;
        this.racks = []; // Stockage temporaire des étagères
        this.levels = []; // Stockage temporaire des étages
        this.slots = []; // Stockage temporaire des emplacements
        this.canvasManager = null;
        this.api = new ApiManager();

        // AJOUT pour QuadView
        this.quadViewManager = null;

        this.init();
    }

    init() {
        console.log('VueStock initialisé');

        // Initialisation des événements
        this.initEvents();

        // Chargement initial des données
        this.loadData();

        // Afficher la vue par défaut
        this.showView('plan');

        // Mettre à jour les statistiques
        this.updateStats();
    }

    // AJOUTER CETTE MÉTHODE APRÈS init()
    initQuadView() {
        // Vérifier si QuadViewManager est déjà initialisé
        if (this.quadViewManager) {
            console.log('QuadViewManager déjà initialisé');
            return;
        }

        // Initialiser le QuadViewManager seulement si on est en vue plan
        if (this.currentView === 'plan') {
            setTimeout(() => {
                console.log('Initialisation de QuadViewManager...');
                this.quadViewManager = new QuadViewManager();

                // Passer les racks chargés
                if (this.racks && this.racks.length > 0) {
                    debugLog('quadView', 'Passage de', this.racks.length, 'racks');
                    this.quadViewManager.updateAllViews(this.racks);
                }

            }, 1500);
        }
    }

    // ===== GESTION DES VUES =====
    showView(viewName) {
        // Mettre à jour la vue courante
        this.currentView = viewName;

        // Masquer toutes les vues
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });

        // Afficher la vue demandée
        const viewElement = document.getElementById(`view${viewName.charAt(0).toUpperCase() + viewName.slice(1)}`);
        if (viewElement) {
            viewElement.classList.add('active');
        }

        // Mettre à jour le breadcrumb
        this.updateBreadcrumb();

        if (viewName === 'plan' && !this.canvasManager) {
            setTimeout(() => {
                this.initCanvas();
            }, 100);
        }

        // AJOUT : Initialiser la vue quad si on est en vue plan
        if (viewName === 'plan') {
            setTimeout(() => {
                this.initQuadView();
            }, 100);
        }
    }

    initCanvas() {
        // Initialiser le canvas manager
        window.canvasManager = new CanvasManager('canvasPlan', 'planOverlay');
        this.canvasManager = window.canvasManager;

        // Redessiner la grille
        setTimeout(() => {
            this.canvasManager.drawGrid();

            // Ajouter les racks déjà chargés
            this.racks.forEach(rack => {
                this.canvasManager.addRackToCanvas(rack);
            });
        }, 50);
    }

    // ===== GESTION DES VUES =====
    showView(viewName) {
        // Mettre à jour la vue courante
        this.currentView = viewName;

        // Masquer toutes les vues
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });

        // Afficher la vue demandée
        const viewElement = document.getElementById(`view${viewName.charAt(0).toUpperCase() + viewName.slice(1)}`);
        if (viewElement) {
            viewElement.classList.add('active');
        }

        // Mettre à jour le breadcrumb
        this.updateBreadcrumb();

        if (viewName === 'plan' && !this.canvasManager) {
            setTimeout(() => {
                this.initCanvas();
            }, 100);
        }

        // AJOUT : Initialiser la vue quad si on est en vue plan
        if (viewName === 'plan') {
            setTimeout(() => {
                this.initQuadView();
            }, 200);
        }
    }

    updateBreadcrumb() {
        const breadcrumb = document.getElementById('breadcrumb');
        breadcrumb.innerHTML = '';

        // Toujours le plan en premier
        const planItem = this.createBreadcrumbItem('Plan du stock', 'plan');
        breadcrumb.appendChild(planItem);

        // Si on est sur une étagère
        if (this.currentView === 'rack' && this.selectedRack) {
            breadcrumb.appendChild(this.createBreadcrumbSeparator());
            const rackItem = this.createBreadcrumbItem(
                `Étagère ${this.selectedRack.code}`,
                'rack',
                false // pas cliquable car on y est déjà
            );
            breadcrumb.appendChild(rackItem);
        }

        // Si on est sur un étage
        if (this.currentView === 'level' && this.selectedRack && this.selectedLevel) {
            breadcrumb.appendChild(this.createBreadcrumbSeparator());
            const rackItem = this.createBreadcrumbItem(
                `Étagère ${this.selectedRack.code}`,
                'rack',
                true // cliquable pour revenir
            );
            breadcrumb.appendChild(rackItem);

            breadcrumb.appendChild(this.createBreadcrumbSeparator());
            const levelItem = this.createBreadcrumbItem(
                `Étage ${this.selectedLevel.code}`,
                'level',
                false
            );
            breadcrumb.appendChild(levelItem);
        }
    }

    createBreadcrumbItem(text, view, clickable = true) {
        const span = document.createElement('span');
        span.className = `breadcrumb-item ${!clickable ? 'active' : ''}`;
        span.textContent = text;
        span.dataset.view = view;

        if (clickable) {
            span.style.cursor = 'pointer';
            span.addEventListener('click', () => {
                if (view === 'rack') {
                    this.showView('rack');
                } else if (view === 'plan') {
                    this.showView('plan');
                }
            });
        }

        return span;
    }

    createBreadcrumbSeparator() {
        const span = document.createElement('span');
        span.className = 'breadcrumb-separator';
        span.textContent = '›';
        return span;
    }

    // ===== NAVIGATION ENTRE VUES =====
    goToRackView(rack) {
        this.selectedRack = rack;
        this.selectedLevel = null;

        // Mettre à jour le titre
        document.getElementById('rackTitle').textContent = rack.code;
        document.getElementById('rackCodeInput').value = rack.code;

        // Charger les étages de cette étagère
        this.loadLevelsForRack(rack.id);

        // Afficher la vue
        this.showView('rack');
    }

    goToLevelView(level) {
        this.selectedLevel = level;

        // Mettre à jour les titres
        document.getElementById('levelTitle').textContent = level.code;
        document.getElementById('levelRackTitle').textContent = this.selectedRack.code;
        document.getElementById('levelCodeInput').value = level.code;

        // Charger les emplacements de cet étage
        this.loadSlotsForLevel(level.id);

        // Afficher la vue
        this.showView('level');
    }

    // ===== GESTION DES ÉTAGÈRES =====
    async addRack(rackData) {
        // PROTECTION CONTRE LES DOUBLES CLICS
        if (this._addingRackInProgress) {
            console.log('⏳ Ajout d\'étagère déjà en cours, veuillez patienter...');
            this.showNotification('Ajout en cours, veuillez patienter...', 'warning');
            return null;
        }

        console.log('🟢 [VueStock.addRack] Called with:', rackData);

        // Bloquer les nouveaux clics
        this._addingRackInProgress = true;

        // Désactiver le bouton visuellement
        const addButton = document.getElementById('btnAddRack');
        if (addButton) {
            const originalText = addButton.innerHTML;
            addButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Création...';
            addButton.disabled = true;
        }

        try {
            const payload = {
                code: rackData.code,
                name: rackData.name || `Étagère ${rackData.code}`,
                position_x: rackData.x || rackData.position_x,
                position_y: rackData.y || rackData.position_y,
                rotation: rackData.rotation || 0,
                width: rackData.width,
                depth: rackData.depth,
                color: rackData.color
            };

            console.log('🟢 Payload pour API:', payload);

            const result = await this.api.saveRack(payload);

            if (result.success && result.data) {
                const newRack = {
                    id: result.data.id,
                    code: result.data.rack_code || result.data.code,
                    name: result.data.display_name || result.data.name,
                    position_x: result.data.position_x,
                    position_y: result.data.position_y,
                    rotation: result.data.rotation,
                    width: result.data.width,
                    depth: result.data.depth,
                    color: result.data.color,
                    levels: []
                };

                // CORRECTION : Vérifier si l'étagère existe déjà
                const existingIndex = this.racks.findIndex(r => r.id === newRack.id);
                if (existingIndex === -1) {
                    // Nouvelle étagère
                    this.racks.push(newRack);
                } else {
                    // Mise à jour
                    this.racks[existingIndex] = newRack;
                }

                // Dessiner sur le canvas UNE SEULE FOIS
                if (this.currentView === 'plan' && this.canvasManager) {
                    // Supprimer l'ancien élément si existe
                    const oldElement = document.querySelector(`[data-rack-id="${newRack.id}"]`);
                    if (oldElement) {
                        oldElement.remove();
                    }

                    // Ajouter le nouvel élément UNE FOIS
                    this.canvasManager.addRackToCanvas(newRack);
                }

                // AJOUT IMPORTANT : Mettre à jour QuadView si actif
                if (this.quadViewManager && this.currentView === 'plan') {
                    console.log('Mise à jour QuadView après ajout de rack');
                    this.quadViewManager.updateAllViews(this.racks);
                }

                this.updateStats();
                this.showNotification(`Étagère ${newRack.code} créée`);

                return newRack;
            }

        } catch (error) {
            console.error('❌ Erreur lors de la sauvegarde:', error);

            // Message d'erreur plus informatif
            let errorMessage = 'Erreur lors de la création';
            if (error.message.includes('500')) {
                errorMessage = 'Erreur serveur (500). L\'étagère a peut-être été créée malgré tout.';
            } else if (error.message.includes('409') || error.message.includes('duplicate')) {
                errorMessage = 'Une étagère avec ce code existe déjà.';
            }

            this.showNotification(errorMessage, 'error');

        } finally {
            // TOUJOURS débloquer à la fin
            this._addingRackInProgress = false;

            // Réactiver le bouton
            if (addButton) {
                addButton.innerHTML = '<i class="fas fa-plus"></i> Ajouter étagère';
                addButton.disabled = false;
            }
        }
    }

    drawRackOnCanvas(rack) {
        // Au lieu de créer manuellement l'élément, utiliser CanvasManager
        if (this.canvasManager) {
            this.canvasManager.addRackToCanvas(rack);
        } else {
            // Fallback si canvasManager pas encore initialisé
            console.log('CanvasManager non initialisé, étagère mise en attente:', rack);
        }
    }

    // ===== GESTION DES ÉTAGES (incréments de 10) =====
    async addLevelToRack(rackId, levelCode = null) {
        // Vérifier si une opération est déjà en cours
        if (this._addingLevel) {
            console.log('⚠️ Opération d\'ajout d\'étage déjà en cours');
            return;
        }

        this._addingLevel = true;

        try {
            const rack = this.racks.find(r => r.id === rackId);
            if (!rack) return;

            // Si pas de code spécifié, trouver le prochain multiple de 10
            if (!levelCode) {
                const existingCodes = rack.levels.map(l => parseInt(l.code)).filter(n => !isNaN(n));
                const maxCode = existingCodes.length > 0 ? Math.max(...existingCodes) : 0;
                levelCode = (Math.floor(maxCode / 10) * 10) + 10;
            }

            // Vérifier si ce niveau existe déjà (avant l'appel API)
            const levelExists = rack.levels.some(l => l.code === levelCode.toString());
            if (levelExists) {
                this.showNotification(`L'étage ${levelCode} existe déjà`, 'warning');
                return;
            }

            // Appeler l'API UNE SEULE FOIS
            console.log('📤 Appel API save-level avec:', { rack_id: rackId, level_code: levelCode });

            const result = await this.api.saveLevel({
                rack_id: rackId,
                level_code: levelCode.toString(),
                display_order: rack.levels.length + 1
            });

            if (result.success && result.data) {
                const newLevel = {
                    id: result.data.id,
                    code: result.data.level_code,
                    rack_id: rackId,
                    display_order: result.data.display_order,
                    slots: []
                };

                rack.levels.push(newLevel);

                // Afficher dans la vue étagère
                this.displayLevelInRackView(newLevel);

                this.updateStats();
                this.showNotification(`Étage ${levelCode} ajouté à l'étagère ${rack.code}`);

                return newLevel;
            }
        } catch (error) {
            console.error('Erreur lors de l\'ajout de l\'étage:', error);
            this.showNotification('Erreur: ' + error.message, 'error');

            // Afficher l'erreur spécifique dupliquée
            if (error.message.includes('duplicate') || error.message.includes('409')) {
                this.showNotification(`L'étage ${levelCode} existe déjà dans cette étagère`, 'error');
            }
        } finally {
            // Toujours débloquer à la fin
            this._addingLevel = false;
        }
    }

    displayLevelInRackView(level) {
        const rackContainer = document.getElementById('rackContainer');

        // Retirer l'état vide s'il existe
        const emptyState = rackContainer.querySelector('.empty-state');
        if (emptyState) {
            emptyState.remove();
        }

        // Créer l'élément d'étage
        const levelElement = document.createElement('div');
        levelElement.className = 'rack-level';
        levelElement.dataset.levelId = level.id;

        levelElement.innerHTML = `
            <div class="rack-level-header">
                <div class="level-number">${level.code}</div>
                <div class="level-info">
                    <h4>Étage ${level.code}</h4>
                    <div class="level-slots">
                        ${level.slots.length} emplacement(s)
                    </div>
                </div>
            </div>
            <div class="level-actions">
                <button class="btn btn-sm" title="Configurer">
                    <i class="fas fa-cog"></i>
                </button>
                <button class="btn btn-sm btn-primary" title="Voir les emplacements">
                    <i class="fas fa-eye"></i>
                </button>
            </div>
        `;

        // Ajouter l'événement pour aller à la vue étage
        const viewBtn = levelElement.querySelector('.btn-primary');
        viewBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.goToLevelView(level);
        });

        rackContainer.appendChild(levelElement);
    }

    async addSlotToLevel(levelId, slotCode = null, count = 1) {
        // Protection contre les clics multiples
        if (this._addingSlot) {
            console.log('⚠️ Opération d\'ajout d\'emplacement déjà en cours');
            return;
        }

        this._addingSlot = true;

        try {
            const rack = this.racks.find(r => r.levels.some(l => l.id === levelId));
            const level = rack?.levels.find(l => l.id === levelId);
            if (!level) return;

            const slots = [];

            for (let i = 0; i < count; i++) {
                // Si pas de code spécifié, trouver le prochain multiple de 10
                let currentSlotCode;
                if (!slotCode) {
                    const existingCodes = level.slots.map(s => parseInt(s.code)).filter(n => !isNaN(n));
                    const maxCode = existingCodes.length > 0 ? Math.max(...existingCodes) : 0;
                    currentSlotCode = (Math.floor(maxCode / 10) * 10) + 10 + (i * 10);
                } else {
                    currentSlotCode = parseInt(slotCode) + (i * 10);
                }

                // Vérifier si cet emplacement existe déjà
                const slotExists = level.slots.some(s => s.code === currentSlotCode.toString());
                if (slotExists) {
                    console.log(`⚠️ Emplacement ${currentSlotCode} existe déjà`);
                    continue; // Passer au suivant
                }

                try {
                    // Appeler l'API pour sauvegarder l'emplacement
                    console.log(`📤 Appel save-slot pour: ${currentSlotCode}`);

                    const result = await this.api.saveSlot({
                        level_id: levelId,
                        slot_code: currentSlotCode.toString(),
                        display_order: level.slots.length + i + 1,
                        status: 'free'
                    });

                    if (result.success && result.data) {
                        const newSlot = {
                            id: result.data.id,
                            code: currentSlotCode.toString(),
                            level_id: levelId,
                            display_order: result.data.display_order,
                            full_code: `${rack.code}-${level.code}-${currentSlotCode}`,
                            status: 'free',
                            articles: []
                        };

                        level.slots.push(newSlot);
                        slots.push(newSlot);
                    }
                } catch (error) {
                    console.error(`Erreur pour l'emplacement ${currentSlotCode}:`, error);
                    // Continuer avec les autres emplacements
                    if (error.message.includes('duplicate') || error.message.includes('409')) {
                        console.log(`L'emplacement ${currentSlotCode} existe déjà`);
                    }
                }
            }

            // Afficher dans la vue étage
            if (slots.length > 0) {
                this.displaySlotsInLevelView(slots);
                this.updateStats();
                this.showNotification(`${slots.length} emplacement(s) ajouté(s) à l'étage ${level.code}`);
            }

            return slots;
        } finally {
            this._addingSlot = false;
        }
    }

    displaySlotsInLevelView(slots) {
        const levelContainer = document.getElementById('levelContainer');

        // Retirer l'état vide s'il existe
        const emptyState = levelContainer.querySelector('.empty-state');
        if (emptyState) {
            emptyState.remove();
        }

        // Ajouter chaque emplacement
        slots.forEach(slot => {
            const slotElement = document.createElement('div');
            slotElement.className = 'slot-item';
            slotElement.dataset.slotId = slot.id;

            // Déterminer la classe en fonction du statut
            if (slot.articles && slot.articles.length > 0) {
                const totalQty = slot.articles.reduce((sum, art) => sum + art.quantity, 0);
                slotElement.classList.add(totalQty >= 10 ? 'full' : 'occupied');
            }

            slotElement.innerHTML = `
                <div class="slot-code">${slot.code}</div>
                <div class="slot-status">
                    ${slot.articles && slot.articles.length > 0 ? 'Occupé' : 'Libre'}
                </div>
            `;

            // Au clic, afficher les articles dans la sidebar
            slotElement.addEventListener('click', () => {
                this.displaySlotContents(slot);

                // Animation de sélection
                document.querySelectorAll('.slot-item').forEach(s => {
                    s.classList.remove('selected');
                });
                slotElement.classList.add('selected');
            });

            levelContainer.appendChild(slotElement);
        });
    }

    // ===== AFFICHAGE DU CONTENU D'UN EMPLACEMENT =====
    displaySlotContents(slot) {
        const contentsDiv = document.getElementById('slotContents');

        if (!slot.articles || slot.articles.length === 0) {
            contentsDiv.innerHTML = `
                <div class="empty-slot">
                    <i class="fas fa-box-open fa-2x"></i>
                    <p>Emplacement vide</p>
                    <button class="btn btn-sm btn-success">
                        <i class="fas fa-plus"></i> Ajouter un article
                    </button>
                </div>
            `;
            return;
        }

        let html = `<h4>Emplacement ${slot.full_code}</h4>`;

        slot.articles.forEach(article => {
            html += `
                <div class="article-item">
                    <div class="article-header">
                        <span class="article-name">${article.name}</span>
                        <span class="article-qty">${article.quantity} unités</span>
                    </div>
                    <div class="article-actions">
                        <button class="btn btn-xs" title="Augmenter">
                            <i class="fas fa-plus"></i>
                        </button>
                        <button class="btn btn-xs" title="Diminuer">
                            <i class="fas fa-minus"></i>
                        </button>
                        <button class="btn btn-xs btn-danger" title="Supprimer">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        });

        contentsDiv.innerHTML = html;
    }

    // ===== STATISTIQUES =====
    updateStats() {
        // Compter les étagères
        const rackCount = this.racks.length;

        // Compter les étages totaux
        const levelCount = this.racks.reduce((sum, rack) => sum + rack.levels.length, 0);

        // Compter les emplacements totaux
        const slotCount = this.racks.reduce((sum, rack) =>
            sum + rack.levels.reduce((levelSum, level) => levelSum + level.slots.length, 0), 0);

        // CORRECTION : Compter les emplacements OCCUPÉS
        const occupiedSlotCount = this.racks.reduce((sum, rack) =>
            sum + rack.levels.reduce((levelSum, level) =>
                levelSum + level.slots.reduce((slotSum, slot) =>
                    slotSum + (slot.articles && slot.articles.length > 0 ? 1 : 0), 0), 0), 0);

        // Calculer le pourcentage d'occupation
        let occupationPercentage = '0%';
        if (slotCount > 0) {
            const percentage = Math.round((occupiedSlotCount / slotCount) * 100);
            occupationPercentage = `${percentage}%`;

            // Mettre à jour le style selon le taux
            const occupationElement = document.getElementById('statOccupation');
            occupationElement.classList.remove('occupation-low', 'occupation-medium', 'occupation-high');

            if (percentage >= 90) {
                occupationElement.classList.add('occupation-high');
            } else if (percentage >= 50) {
                occupationElement.classList.add('occupation-medium');
            } else if (percentage > 0) {
                occupationElement.classList.add('occupation-low');
            }
        }

        // Mettre à jour l'interface
        document.getElementById('statRacks').textContent = rackCount;
        document.getElementById('statLevels').textContent = levelCount;
        document.getElementById('statSlots').textContent = slotCount;
        document.getElementById('statOccupation').textContent = occupationPercentage;

        // Ajouter un tooltip avec le détail
        const occupationElement = document.getElementById('statOccupation');
        if (occupationElement) {
            occupationElement.title = `${occupiedSlotCount} emplacements occupés sur ${slotCount}`;
        }
    }

    // ===== NOTIFICATIONS =====
    showNotification(message, type = 'success') {
        const notification = document.getElementById('notification');
        const text = document.getElementById('notificationText');

        // Changer la couleur selon le type
        if (type === 'error') {
            notification.style.background = 'var(--danger-color)';
        } else if (type === 'warning') {
            notification.style.background = 'var(--warning-color)';
        } else {
            notification.style.background = 'var(--success-color)';
        }

        text.textContent = message;
        notification.classList.add('show');

        // Masquer après 3 secondes
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }

    // ===== CHARGEMENT DES DONNÉES =====
    async loadData() {
        this.showLoader(true);

        try {
            // Attendre 2 secondes pour laisser Netlify répondre
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Essayer l'API
            const result = await this.api.getFullConfig();

            if (result.success && result.data) {
                // Charger les étagères avec leurs niveaux et emplacements
                this.racks = result.data.racks || result.data;

                // Si l'API retourne directement les étagères avec leurs niveaux
                if (result.data.levels) {
                    // Associer les niveaux aux étagères
                    this.racks.forEach(rack => {
                        rack.levels = result.data.levels
                            .filter(level => level.rack_id === rack.id)
                            .map(level => ({
                                ...level,
                                code: level.level_code,
                                slots: result.data.slots
                                    ?.filter(slot => slot.level_id === level.id)
                                    .map(slot => ({
                                        ...slot,
                                        code: slot.slot_code
                                    })) || []
                            }));
                    });
                }

                this.displayRacksFromAPI();
                this.showNotification('Données chargées depuis Netlify Function');
            }

        } catch (error) {
            console.log('API non disponible (déploiement en cours)');
            // Ne pas afficher d'erreur, juste continuer
            this.updateStats();
        } finally {
            this.showLoader(false);
        }
    }

    displayRacksFromAPI() {
        // Nettoyer le canvas
        const overlay = document.getElementById('planOverlay');
        if (overlay) overlay.innerHTML = '';

        // Tableau temporaire pour éviter doublons
        const racksMap = {};

        this.racks.forEach(rack => {
            // Normaliser les données API
            const rackData = {
                id: rack.id,
                code: rack.rack_code || rack.code,
                name: rack.display_name || rack.name,
                position_x: rack.position_x || 100,
                position_y: rack.position_y || 100,
                rotation: rack.rotation || 0,
                width: rack.width || 3,
                depth: rack.depth || 2,
                color: rack.color || '#4a90e2',
                levels: rack.levels || []
            };

            // Éviter les doublons via id
            if (!racksMap[rackData.id]) {
                racksMap[rackData.id] = rackData;

                // Ajouter au canvas
                if (this.canvasManager) {
                    this.canvasManager.addRackToCanvas(rackData);
                }
            }
        });

        // Remplacer le tableau interne par la version unique
        this.racks = Object.values(racksMap);

        // Mettre à jour les stats
        this.updateStats();

        // AJOUT IMPORTANT : Mettre à jour QuadView si actif
        if (this.quadViewManager && this.currentView === 'plan') {
            console.log('Mise à jour QuadView depuis displayRacksFromAPI()');
            this.quadViewManager.updateAllViews(this.racks);
        }
    }

    showLoader(show) {
        const loader = document.getElementById('loaderOverlay');
        if (show) {
            loader.classList.add('active');
        } else {
            loader.classList.remove('active');
        }
    }

    // ===== GESTION DES ÉVÉNEMENTS =====
    initEvents() {
        // Navigation entre vues
        document.getElementById('backToPlan')?.addEventListener('click', () => {
            this.showView('plan');
        });

        document.getElementById('backToRack')?.addEventListener('click', () => {
            this.showView('rack');
        });

        // Bouton Ajouter étagère - CORRIGÉ
        document.getElementById('btnAddRack').addEventListener('click', () => {
            this.openRackModal(); // Appel direct, pas via window
        });

        // Bouton Ajouter étage
        document.getElementById('btnAddLevel')?.addEventListener('click', () => {
            if (this.selectedRack) {
                this.addLevelToRack(this.selectedRack.id);
            }
        });

        document.getElementById('btnAddFirstLevel')?.addEventListener('click', () => {
            if (this.selectedRack) {
                this.addLevelToRack(this.selectedRack.id);
            }
        });

        // Bouton Ajouter emplacement
        document.getElementById('btnAddSlot')?.addEventListener('click', () => {
            if (this.selectedLevel) {
                this.addSlotToLevel(this.selectedLevel.id);
            }
        });

        document.getElementById('btnAddFirstSlot')?.addEventListener('click', () => {
            if (this.selectedLevel) {
                this.addSlotToLevel(this.selectedLevel.id);
            }
        });

        // Génération automatique d'étages
        document.getElementById('btnAutoLevels')?.addEventListener('click', () => {
            if (this.selectedRack) {
                // Générer les étages 10, 20, 30, 40, 50
                for (let i = 1; i <= 5; i++) {
                    this.addLevelToRack(this.selectedRack.id, (i * 10).toString());
                }
            }
        });

        // Génération automatique d'emplacements
        document.getElementById('btnAutoSlots')?.addEventListener('click', () => {
            if (this.selectedLevel) {
                // Générer les emplacements 10 à 100 par pas de 10
                for (let i = 1; i <= 10; i++) {
                    this.addSlotToLevel(this.selectedLevel.id, (i * 10).toString());
                }
            }
        });

        // Recherche d'article
        document.getElementById('btnSearch')?.addEventListener('click', () => {
            this.searchArticle();
        });

        document.getElementById('searchArticle')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.searchArticle();
            }
        });

        // Sauvegarde
        document.getElementById('btnSave')?.addEventListener('click', () => {
            this.saveData();
        });

        // Modal étagère
        this.initModalEvents();
    }

    initModalEvents() {
        const modal = document.getElementById('rackModal');
        const overlay = document.getElementById('modalOverlay');

        // CORRECTION : Définir openRackModal comme méthode de VueStock
        this.openRackModal = (rack = null) => {
            if (rack) {
                // Mode édition
                document.getElementById('modalRackCode').value = rack.code;
                document.getElementById('modalRackName').value = rack.name;
                document.getElementById('modalRackWidth').value = rack.width;
                document.getElementById('modalRackDepth').value = rack.depth;
                document.getElementById('modalRackColor').value = rack.color;
            } else {
                // Mode création
                document.getElementById('rackForm').reset();
                // Suggérer un code d'étagère
                const nextCode = String.fromCharCode(65 + this.racks.length); // A, B, C...
                document.getElementById('modalRackCode').value = nextCode;
            }

            overlay.classList.add('active');
        };

        // Exposer aussi sur window pour les boutons dans CanvasManager
        window.openRackModal = (rack = null) => {
            this.openRackModal(rack);
        };

        // Fermer modal
        document.getElementById('closeRackModal')?.addEventListener('click', () => {
            overlay.classList.remove('active');
        });

        document.getElementById('cancelRackModal')?.addEventListener('click', () => {
            overlay.classList.remove('active');
        });

        overlay?.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.classList.remove('active');
            }
        });

        // Sauvegarder
        document.getElementById('saveRackModal')?.addEventListener('click', async () => {
            // Désactiver le bouton pendant le traitement
            const saveButton = document.getElementById('saveRackModal');
            if (saveButton) {
                const originalText = saveButton.innerHTML;
                saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Création...';
                saveButton.disabled = true;
            }

            try {
                const code = document.getElementById('modalRackCode').value.trim();
                const name = document.getElementById('modalRackName').value.trim();
                const width = parseInt(document.getElementById('modalRackWidth').value);
                const depth = parseInt(document.getElementById('modalRackDepth').value);
                const color = document.getElementById('modalRackColor').value;

                if (!code) {
                    this.showNotification('Le code étagère est requis', 'error');
                    return;
                }

                const codeExists = this.racks.some(r => r.code === code);
                if (codeExists) {
                    this.showNotification(`Le code ${code} existe déjà`, 'error');
                    return;
                }

                // Création de l'étagère
                const newRack = await this.addRack({
                    code,
                    name: name || `Étagère ${code}`,
                    x: 100 + (this.racks.length * 150),
                    y: 100,
                    width: width || 3,
                    depth: depth || 2,
                    color: color || '#4a90e2'
                });

                // Fermer le modal seulement si succès
                if (newRack) {
                    document.getElementById('modalOverlay').classList.remove('active');

                    // Mettre à jour QuadView
                    if (this.quadViewManager && this.currentView === 'plan') {
                        this.quadViewManager.updateAllViews(this.racks);
                    }
                }

            } catch (error) {
                console.error('Erreur dans saveRackModal:', error);

            } finally {
                // TOUJOURS réactiver le bouton
                if (saveButton) {
                    saveButton.innerHTML = 'Enregistrer';
                    saveButton.disabled = false;
                }
            }
        });
    }

    // ===== VUE 3D =====
    open3DView = async () => {
        console.log('Ouverture de la vue 3D');
        const modal3D = document.getElementById('modal3D');

        modal3D.classList.add('active');
        await new Promise(resolve => setTimeout(resolve, 100));

        if (!window.vueStock3D) {
            window.vueStock3D = new VueStock3D();
            await window.vueStock3D.init();
        }
    }

    // ===== RECHERCHE D'ARTICLE =====
    async searchArticle() {
        const searchTerm = document.getElementById('searchArticle').value.trim();
        if (!searchTerm) return;

        this.showLoader(true);

        try {
            // Rechercher via l'API
            const results = await this.api.searchArticles(searchTerm);

            if (results.length > 0) {
                // Prendre le premier résultat pour la démonstration
                const article = results[0];

                if (article.full_code) {
                    // ✅ NOUVEAU : Proposer d'ouvrir la vue 3D
                    const open3D = confirm(`Article trouvé dans ${article.full_code}\n\nOuvrir la vue 3D pour localiser l'article ?`);

                    if (open3D) {
                        // Ouvrir la vue 3D (fonction globale)
                        await open3DView();

                        // Si vous voulez localiser l'article, ajoutez ceci :
                        // if (window.vueStock3D?.locateArticle) {
                        //     window.vueStock3D.locateArticle(article.full_code);
                        // }
                    } else {
                        // Comportement classique (2D)
                        this.highlightSlotByFullCode(article.full_code);
                    }

                    this.showNotification(`Article trouvé dans ${article.full_code}`);
                } else {
                    this.showNotification('Article trouvé mais non stocké', 'warning');
                }
            } else {
                this.showNotification('Aucun article trouvé', 'warning');
            }

        } catch (error) {
            console.error('Erreur de recherche:', error);
            this.showNotification('Erreur de recherche: ' + error.message, 'error');
        } finally {
            this.showLoader(false);
        }
    }

    // ✅ NOUVELLE MÉTHODE : Ouvrir la 3D et localiser
    open3DAndLocate(fullCode) {
        console.log('🎯 Localisation 3D pour:', fullCode);

        // Extraire rack, level, slot du code (ex: "A-10-20")
        const parts = fullCode.split('-');
        if (parts.length !== 3) {
            console.error('Format de code invalide:', fullCode);
            return;
        }

        const [rackCode, levelCode, slotCode] = parts;

        // Trouver l'étagère
        const rack = this.racks.find(r => r.code === rackCode);
        if (!rack) {
            console.error('Étagère non trouvée:', rackCode);
            return;
        }

        // Trouver l'étage
        const level = rack.levels?.find(l => l.code === levelCode);
        if (!level) {
            console.error('Étage non trouvé:', levelCode);
            return;
        }

        // Trouver l'emplacement
        const slot = level.slots?.find(s => s.code === slotCode);
        if (!slot) {
            console.error('Emplacement non trouvé:', slotCode);
            return;
        }

        // Ouvrir le modal 3D
        const modal3D = document.getElementById('modal3D');
        modal3D.classList.add('active');

        // Initialiser la vue 3D si nécessaire
        if (!window.view3DManager) {
            window.view3DManager = new View3DManager();
            window.view3DManager.init();

            // Attendre que la 3D soit chargée
            setTimeout(() => {
                window.view3DManager.locateAndHighlight(rack, level, slot);
            }, 500);
        } else {
            window.view3DManager.locateAndHighlight(rack, level, slot);
        }
    }

    highlightSlotByFullCode(fullCode) {
        // Extraire les parties du code: A-10-20
        const parts = fullCode.split('-');
        if (parts.length !== 3) return;

        const [rackCode, levelCode, slotCode] = parts;

        // Trouver l'étagère
        const rack = this.racks.find(r => r.code === rackCode);
        if (!rack) return;

        // Aller à la vue étagère
        this.goToRackView(rack);

        // Trouver l'étage
        const level = rack.levels?.find(l => l.level_code === levelCode);
        if (!level) return;

        // Aller à la vue étage
        setTimeout(() => {
            this.goToLevelView(level);

            // Mettre en surbrillance l'emplacement
            setTimeout(() => {
                const slotElement = document.querySelector(`[data-slot-code="${slotCode}"]`);
                if (slotElement) {
                    slotElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    slotElement.classList.add('highlight', 'pulse');

                    setTimeout(() => {
                        slotElement.classList.remove('highlight', 'pulse');
                    }, 2000);
                }
            }, 500);
        }, 500);
    }

    // ===== SAUVEGARDE DES DONNÉES =====
    async saveData() {
        this.showLoader(true);

        try {
            // Sauvegarder uniquement si nécessaire
            // Ici, vous pouvez décider de sauvegarder les modifications
            // ou simplement ne rien faire car chaque étagère est sauvegardée individuellement

            // Option : Sauvegarder toutes les étagères modifiées
            let savedCount = 0;

            for (const rack of this.racks) {
                // Vérifier si l'étagère a été modifiée
                // Pour simplifier, on sauvegarde tout
                try {
                    await this.api.saveRack({
                        id: rack.id, // Inclure l'ID pour mise à jour
                        code: rack.code,
                        name: rack.name,
                        position_x: rack.position_x,
                        position_y: rack.position_y,
                        rotation: rack.rotation || 0,
                        width: rack.width,
                        depth: rack.depth,
                        color: rack.color
                    });
                    savedCount++;
                } catch (error) {
                    console.error(`Erreur pour étagère ${rack.code}:`, error);
                }
            }

            this.showNotification(`${savedCount} étagère(s) sauvegardée(s)`);

        } catch (error) {
            console.error('Erreur de sauvegarde:', error);
            this.showNotification('Erreur lors de la sauvegarde: ' + error.message, 'error');
        } finally {
            this.showLoader(false);
        }
    }

    // ===== CHARGEMENT DES NIVEAUX POUR UNE ÉTAGÈRE =====
    loadLevelsForRack(rackId) {
        const rack = this.racks.find(r => r.id === rackId);
        if (!rack) return;

        const rackContainer = document.getElementById('rackContainer');
        rackContainer.innerHTML = '';

        if (rack.levels.length === 0) {
            rackContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-th-large fa-3x"></i>
                    <p>Aucun étage configuré</p>
                    <button class="btn btn-primary" id="btnAddFirstLevel">
                        Ajouter le premier étage
                    </button>
                </div>
            `;

            // Re-binder l'événement
            document.getElementById('btnAddFirstLevel').addEventListener('click', () => {
                this.addLevelToRack(rackId);
            });
        } else {
            rack.levels.forEach(level => {
                this.displayLevelInRackView(level);
            });
        }
    }

    // ===== CHARGEMENT DES EMPLACEMENTS POUR UN ÉTAGE =====
    loadSlotsForLevel(levelId) {
        const rack = this.racks.find(r => r.levels.some(l => l.id === levelId));
        const level = rack?.levels.find(l => l.id === levelId);
        if (!level) return;

        const levelContainer = document.getElementById('levelContainer');
        levelContainer.innerHTML = '';

        if (level.slots.length === 0) {
            levelContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-box-open fa-3x"></i>
                    <p>Aucun emplacement configuré</p>
                    <button class="btn btn-primary" id="btnAddFirstSlot">
                        Ajouter le premier emplacement
                    </button>
                </div>
            `;

            // Re-binder l'événement
            document.getElementById('btnAddFirstSlot').addEventListener('click', () => {
                this.addSlotToLevel(levelId);
            });
        } else {
            this.displaySlotsInLevelView(level.slots);
        }
    }

    refreshEventListeners() {
        // Cette méthode peut être appelée si les événements ne fonctionnent pas
        console.log('Rafraîchissement des événements...');

        // Réinitialiser les événements du canvas
        if (this.canvasManager) {
            // Recréer le canvas manager
            this.canvasManager = new CanvasManager('canvasPlan', 'planOverlay');
            window.canvasManager = this.canvasManager;

            // Redessiner tout
            setTimeout(() => {
                this.canvasManager.drawGrid();
                this.racks.forEach(rack => {
                    this.canvasManager.addRackToCanvas(rack);
                });
            }, 100);
        }
    }

    loadTestData() {
        console.log('Chargement des données de test');

        // Données de test
        const testRack = {
            id: 1,
            code: 'A',
            name: 'Étagère principale A',
            position_x: 200,
            position_y: 200,
            width: 3,
            depth: 2,
            color: '#4a90e2',
            levels: [
                {
                    id: 1,
                    level_code: '10',
                    display_order: 1,
                    slots: [
                        {
                            id: 1,
                            slot_code: '10',
                            full_code: 'A-10-10',
                            status: 'occupied',
                            capacity: 100
                        },
                        {
                            id: 2,
                            slot_code: '20',
                            full_code: 'A-10-20',
                            status: 'free',
                            capacity: 100
                        }
                    ]
                }
            ]
        };

        this.racks = [testRack];

        // Afficher sur le canvas
        if (this.canvasManager) {
            this.canvasManager.addRackToCanvas(testRack);
        }

        this.updateStats();
        this.showNotification('Données de test chargées', 'warning');
    }
}

// ===== INITIALISATION AU CHARGEMENT =====
document.addEventListener('DOMContentLoaded', () => {
    window.vueStock = new VueStock();
});

document.addEventListener('DOMContentLoaded', () => {
    window.vueStock = new VueStock();

    // Initialiser la vue quad après un délai
    setTimeout(() => {
        if (window.vueStock.quadViewManager) {
            window.vueStock.quadViewManager.updateAllViews(window.vueStock.racks);
        }
    }, 1000);
});

// Debug button pour tester QuadView
document.addEventListener('DOMContentLoaded', () => {
    // Ajouter un bouton de debug temporaire
    const debugBtn = document.createElement('button');
    debugBtn.id = 'debugQuadBtn';
    debugBtn.innerHTML = '🔍 Debug Quad';
    debugBtn.style.cssText = 'position:fixed;top:10px;right:10px;z-index:10000;padding:10px;background:#4a90e2;color:white;border:none;border-radius:5px;cursor:pointer;';

    debugBtn.addEventListener('click', () => {
        console.log('=== DEBUG QUAD ===');
        console.log('VueStock:', window.vueStock);
        console.log('Racks:', window.vueStock?.racks?.length, 'racks');
        console.log('QuadViewManager:', window.vueStock?.quadViewManager);

        if (window.vueStock?.quadViewManager) {
            console.log('Mise à jour forcée de QuadView...');
            window.vueStock.quadViewManager.updateAllViews(window.vueStock.racks);
            alert('QuadView mis à jour avec ' + window.vueStock.racks.length + ' racks');
        } else {
            alert('QuadViewManager non initialisé. Attendez le chargement ou basculez en vue Plan.');
        }
    });

    document.body.appendChild(debugBtn);

    // Initialiser VueStock
    window.vueStock = new VueStock();
});

