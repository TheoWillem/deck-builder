class DeckVisualizer {
    constructor() {
        this.cards = [];
        this.currentDeck = {};
        this.deckName = '';
        this.primaryFaction = '';
        this.secondaryFaction = '';
        this.availableCardsContainer = document.getElementById('available-cards');
        this.deckContainer = document.getElementById('deck-container');
        this.deckUrlInput = document.getElementById('deck-url');
        this.deckCountSpan = document.getElementById('deck-count');
        this.factionFilter = document.getElementById('faction-filter');
        this.searchFilter = document.getElementById('search-filter');
        this.deckNameInput = document.getElementById('deck-name');
        this.primaryFactionSelect = document.getElementById('primary-faction');
        this.secondaryFactionSelect = document.getElementById('secondary-faction');
        
        this.init();
    }

    async init() {
        await this.loadCards();
        this.setupEventListeners();
        this.loadDeckFromURL();
        this.populateFactionFilter();
        this.displayAvailableCards();
        this.displayDeckCards();
        this.updateDeckURL();
        this.updateDeckCount();
    }

    async loadCards() {
        try {
            const response = await fetch('../card-database/cards.json');
            this.cards = await response.json();
        } catch (error) {
            console.error('Error loading cards:', error);
            // Fallback with some default cards
            this.cards = [
                { "id": 1, "name": "Battle Mage", "cost": 3, "faction": "DM", "image": "mage.jpg" },
                { "id": 2, "name": "Cave Ogre", "cost": 5, "faction": "PG", "image": "ogre.jpg" }
            ];
        }
    }

    setupEventListeners() {
        // Copy URL
        document.getElementById('copy-url').addEventListener('click', () => {
            this.deckUrlInput.select();
            document.execCommand('copy');
            this.showToast('URL copied!');
        });

        // Clear deck
        document.getElementById('clear-deck').addEventListener('click', () => {
            this.currentDeck = {};
            this.deckName = '';
            this.primaryFaction = '';
            this.secondaryFaction = '';
            this.updateDisplay();
            this.updateDeckInfo();
            this.updateURL();
        });

        // Filters - Met à jour SEULEMENT la collection, le deck reste inchangé
        this.factionFilter.addEventListener('change', () => {
            this.displayAvailableCards(); // Seule la collection est mise à jour
        });

        this.searchFilter.addEventListener('input', () => {
            this.displayAvailableCards(); // Seule la collection est mise à jour
        });

        // Deck info listeners
        this.deckNameInput.addEventListener('input', () => {
            this.deckName = this.deckNameInput.value;
            this.updateURL();
        });

        this.primaryFactionSelect.addEventListener('change', () => {
            this.primaryFaction = this.primaryFactionSelect.value;
            this.cleanDeckByFactions();
            this.updateURL();
        });

        this.secondaryFactionSelect.addEventListener('change', () => {
            this.secondaryFaction = this.secondaryFactionSelect.value;
            this.cleanDeckByFactions();
            this.updateURL();
        });

        // Listen for URL changes
        window.addEventListener('hashchange', () => {
            this.loadDeckFromURL();
        });
    }

    loadDeckFromURL() {
        const hash = window.location.hash.substring(1);
        if (!hash) {
            this.currentDeck = {};
            this.deckName = '';
            this.primaryFaction = '';
            this.secondaryFaction = '';
            this.updateDisplay();
            this.updateDeckInfo();
            return;
        }

        try {
            // Reset deck data
            this.currentDeck = {};
            this.deckName = '';
            this.primaryFaction = '';
            this.secondaryFaction = '';

            // Parse URL format: name=MyDeck&primary=DM&secondary=WH&cards=1xMage+2xOgre
            const params = new URLSearchParams(hash);
            
            // Load deck metadata
            this.deckName = params.get('name') || '';
            this.primaryFaction = params.get('primary') || '';
            this.secondaryFaction = params.get('secondary') || '';
            
            // Load cards
            const cardsParam = params.get('cards');
            if (cardsParam) {
                cardsParam.split('+').forEach(cardStr => {
                    const match = cardStr.match(/^(\d+)x(.+)$/);
                    if (match) {
                        const [, quantity, name] = match;
                        this.currentDeck[name.replace(/_/g, ' ')] = parseInt(quantity);
                    }
                });
            }
            
            this.updateDisplay();
            this.updateDeckInfo();
        } catch (error) {
            console.error('Error decoding URL:', error);
            this.currentDeck = {};
            this.deckName = '';
            this.primaryFaction = '';
            this.secondaryFaction = '';
            this.updateDisplay();
            this.updateDeckInfo();
        }
    }

    addCardToDeck(cardName) {
        const card = this.cards.find(c => c.name === cardName);
        if (!card) return;
        
        // Vérifier si la carte peut être ajoutée selon les factions sélectionnées
        const allowedFactions = [this.primaryFaction, this.secondaryFaction, 'N'].filter(f => f);
        if (!allowedFactions.includes(card.faction)) {
            return;
        }
        
        const currentQuantity = this.currentDeck[cardName] || 0;
        
        if (currentQuantity >= 3) {
            this.shakeCard(card.id);
            return;
        }
        
        if (this.currentDeck[cardName]) {
            this.currentDeck[cardName]++;
        } else {
            this.currentDeck[cardName] = 1;
        }
        
        this.updateDisplay();
        this.updateURL();
    }

    removeCardFromDeck(cardName) {
        if (this.currentDeck[cardName]) {
            this.currentDeck[cardName]--;
            if (this.currentDeck[cardName] <= 0) {
                delete this.currentDeck[cardName];
            }
        }
        
        this.updateDisplay();
        this.updateURL();
    }

    cleanDeckByFactions() {
        // Déterminer les factions autorisées (factions sélectionnées + Nature)
        const allowedFactions = [this.primaryFaction, this.secondaryFaction, 'N'].filter(f => f);
        
        // Parcourir toutes les cartes du deck
        const cardsToRemove = [];
        for (const cardName in this.currentDeck) {
            const card = this.cards.find(c => c.name === cardName);
            if (card && !allowedFactions.includes(card.faction)) {
                cardsToRemove.push(cardName);
            }
        }
        
        // Supprimer les cartes non autorisées
        cardsToRemove.forEach(cardName => {
            delete this.currentDeck[cardName];
        });
        
        // Mettre à jour l'affichage si des cartes ont été supprimées
        if (cardsToRemove.length > 0) {
            this.updateDisplay();
            this.updateDeckCount();
        }
    }

    updateURL() {
        // Build URL parameters
        const params = new URLSearchParams();
        
        if (this.deckName) {
            params.set('name', this.deckName);
        }
        
        if (this.primaryFaction) {
            params.set('primary', this.primaryFaction);
        }
        
        if (this.secondaryFaction) {
            params.set('secondary', this.secondaryFaction);
        }
        
        if (Object.keys(this.currentDeck).length > 0) {
            const deckCode = Object.entries(this.currentDeck)
                .map(([name, quantity]) => `${quantity}x${name.replace(/ /g, '_')}`)
                .join('+');
            params.set('cards', deckCode);
        }
        
        // Set hash
        if (params.toString()) {
            window.location.hash = params.toString();
        } else {
            window.location.hash = '';
        }
    }

    updateDisplay() {
        this.displayAvailableCards(); // Mise à jour de la collection pour afficher les bonnes quantités
        this.displayDeckCards(); // Mise à jour UNIQUEMENT du deck
        this.updateDeckURL();
        this.updateDeckCount();
    }

    updateDeckInfo() {
        this.deckNameInput.value = this.deckName;
        this.primaryFactionSelect.value = this.primaryFaction;
        this.secondaryFactionSelect.value = this.secondaryFaction;
    }

    displayAvailableCards() {
        const filteredCards = this.getFilteredCards();
        const grid = document.getElementById('available-cards');
        
        // La collection affiche TOUJOURS toutes les cartes (filtrées)
        grid.innerHTML = filteredCards.map(card => this.generateCardHTML(card)).join('');
        
        // Clic pour AJOUTER au deck (la carte RESTE dans la collection)
        grid.querySelectorAll('.card').forEach(cardElement => {
            cardElement.addEventListener('click', () => {
                const cardId = parseInt(cardElement.dataset.cardId);
                const card = this.cards.find(c => c.id === cardId);
                if (card) {
                    this.addCardToDeck(card.name); // Les messages d'erreur sont gérés dans addCardToDeck
                }
    });
});
    }

    displayDeckCards() {
        const grid = document.getElementById('deck-container');
        
        if (Object.keys(this.currentDeck).length === 0) {
            grid.innerHTML = '<div class="empty-deck">Your collection is empty<br>🖱️ Click on cards from the collection to add them!</div>';
            return;
        }

        const deckHTML = Object.entries(this.currentDeck)
            .map(([cardName, quantity]) => {
                const card = this.cards.find(c => c.name === cardName);
                if (!card) return '';
                return this.generateCardHTML(card, quantity);
            })
            .filter(html => html !== '')
            .join('');

        grid.innerHTML = deckHTML;

        grid.querySelectorAll('.deck-card').forEach(cardElement => {
            const cardId = parseInt(cardElement.dataset.cardId);
            const card = this.cards.find(c => c.id === cardId);
            
            if (card) {
                cardElement.addEventListener('click', () => {
                    this.removeCardFromDeck(card.name);
                });

                const removeBtn = cardElement.querySelector('.remove-btn');
                if (removeBtn) {
                    removeBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.removeCardFromDeck(card.name);
                    });
                }
            }
        });
    }

    generateCardHTML(card, quantity = 0) {
        const imagePath = card.image ? `../card-database/${card.image}` : null;
        
        // Pour les cartes de la collection, on affiche la quantité actuelle dans le deck
        let displayQuantity = quantity;
        if (quantity === 0 && this.currentDeck[card.name]) {
            displayQuantity = this.currentDeck[card.name];
        }
        
        // Vérifier si la carte peut être ajoutée selon les factions sélectionnées
        const allowedFactions = [this.primaryFaction, this.secondaryFaction, 'N'].filter(f => f);
        const isCardAllowed = allowedFactions.includes(card.faction);
        const disabledClass = (quantity === 0 && !isCardAllowed) ? 'card-disabled' : '';
        
        return `
            <div class="card ${quantity > 0 ? 'deck-card' : ''} ${disabledClass} faction-${card.faction.toLowerCase().replace(/\s+/g, '-')}" 
                 data-card-id="${card.id}">
                <div class="quantity-badge faction-${card.faction.toLowerCase()}-bg">${displayQuantity}</div>
                ${quantity > 0 ? '<button class="remove-btn" onclick="event.stopPropagation();">×</button>' : ''}
                ${!isCardAllowed && quantity === 0 ? '<div class="disabled-overlay"><div class="disabled-message"><div class="disabled-emoji">🚫</div><div class="disabled-text">Not in selected factions</div></div></div>' : ''}
                <img src="${imagePath}" alt="${card.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                <div class="card-placeholder" style="display: none;">📜 ${card.name}</div>
            </div>
        `;
    }

    updateDeckURL() {
        const baseUrl = window.location.origin + window.location.pathname;
        const hash = window.location.hash;
        this.deckUrlInput.value = baseUrl + hash;
    }

    updateDeckCount() {
        const totalCards = Object.values(this.currentDeck).reduce((sum, quantity) => sum + quantity, 0);
        this.deckCountSpan.textContent = `(${totalCards}/40 cards)`;
    }

    populateFactionFilter() {
        const factions = [
            { code: 'DM', emoji: '🟣', name: 'DM' },
            { code: 'PG', emoji: '🔴', name: 'PG' },
            { code: 'WH', emoji: '🟢', name: 'WH' },
            { code: 'AO', emoji: '🔵', name: 'AO' },
            { code: 'N', emoji: '⚫', name: 'N' }
        ];
        
        this.factionFilter.innerHTML = '<option value="">🌈 All Factions</option>';
        factions.forEach(faction => {
            const option = document.createElement('option');
            option.value = faction.code;
            option.textContent = `${faction.emoji} ${faction.name}`;
            this.factionFilter.appendChild(option);
        });
    }

    showToast(message) {
        // Créer ou récupérer le conteneur de toasts
        let toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            toastContainer.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 1000;
                display: flex;
                flex-direction: column;
                gap: 10px;
                pointer-events: none;
            `;
            document.body.appendChild(toastContainer);
        }

        // Créer le toast
        const toast = document.createElement('div');
        toast.style.cssText = `
            background: #8b6914;
            color: #ffd700;
            padding: 12px 20px;
            border-radius: 8px;
            font-weight: 600;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
            border: 2px solid rgba(218, 165, 32, 0.5);
            text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
            transform: translateX(100%);
            transition: transform 0.3s ease-in-out, opacity 0.3s ease-in-out;
            opacity: 0;
            font-family: 'Cinzel', serif;
            max-width: 300px;
            word-wrap: break-word;
        `;
        toast.textContent = message;
        toastContainer.appendChild(toast);

        // Animation d'entrée
        setTimeout(() => {
            toast.style.transform = 'translateX(0)';
            toast.style.opacity = '1';
        }, 10);

        // Animation de sortie et suppression
        setTimeout(() => {
            toast.style.transform = 'translateX(100%)';
            toast.style.opacity = '0';
            setTimeout(() => {
                if (toast.parentNode) {
                    toastContainer.removeChild(toast);
                }
                // Supprimer le conteneur s'il est vide
                if (toastContainer.children.length === 0) {
                    document.body.removeChild(toastContainer);
                }
            }, 300);
        }, 2500);
    }

    shakeCard(cardId) {
        const cardElement = document.querySelector(`[data-card-id="${cardId}"]`);
        if (!cardElement) return;

        // Éviter les animations multiples simultanées
        if (cardElement.classList.contains('shaking')) return;

        // Ajouter les classes d'animation
        cardElement.classList.add('shaking', 'shake-red-flash');

        // Supprimer les classes après l'animation
        setTimeout(() => {
            cardElement.classList.remove('shaking', 'shake-red-flash');
        }, 600);
    }



    getFilteredCards() {
        const factionFilter = this.factionFilter.value;
        const searchTerm = this.searchFilter.value.toLowerCase();

        const filteredCards = this.cards.filter(card => {
            const matchesFaction = !factionFilter || card.faction === factionFilter;
            const matchesSearch = !searchTerm || card.name.toLowerCase().includes(searchTerm);
            return matchesFaction && matchesSearch;
        });

        return filteredCards;
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    new DeckVisualizer();
});
