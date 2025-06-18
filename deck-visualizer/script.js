class DeckVisualizer {
    constructor() {
        this.cards = [];
        this.currentDeck = [];
        this.availableCardsContainer = document.getElementById('available-cards');
        this.deckContainer = document.getElementById('deck-container');
        this.deckUrlInput = document.getElementById('deck-url');
        this.deckCountSpan = document.getElementById('deck-count');
        this.factionFilter = document.getElementById('faction-filter');
        this.searchFilter = document.getElementById('search-filter');
        
        this.init();
    }

    async init() {
        await this.loadCards();
        this.setupEventListeners();
        this.loadDeckFromURL();
        this.populateFactionFilter();
        this.displayAvailableCards();
        this.updateDisplay();
    }

    async loadCards() {
        try {
            const response = await fetch('../card-database/cards.json');
            this.cards = await response.json();
        } catch (error) {
            console.error('Erreur lors du chargement des cartes:', error);
            // Fallback avec quelques cartes par défaut
            this.cards = [
                { "name": "Mage", "cost": 3, "faction": "Magicien", "image": "mage.jpg" },
                { "name": "Orgre", "cost": 5, "faction": "Monstre", "image": "orgre.jpg" }
            ];
        }
    }

    setupEventListeners() {
        // Copier l'URL
        document.getElementById('copy-url').addEventListener('click', () => {
            this.deckUrlInput.select();
            document.execCommand('copy');
            this.showToast('URL copiée !');
        });

        // Vider le deck
        document.getElementById('clear-deck').addEventListener('click', () => {
            this.currentDeck = [];
            this.updateDisplay();
            this.updateURL();
        });

        // Charger un exemple
        document.getElementById('load-example').addEventListener('click', () => {
            this.loadExampleDeck();
        });

        // Filtres
        this.factionFilter.addEventListener('change', () => {
            this.displayAvailableCards();
        });

        this.searchFilter.addEventListener('input', () => {
            this.displayAvailableCards();
        });

        // Écouter les changements d'URL
        window.addEventListener('hashchange', () => {
            this.loadDeckFromURL();
        });
    }

    loadDeckFromURL() {
        const hash = window.location.hash.substring(1);
        if (!hash) {
            this.currentDeck = [];
            this.updateDisplay();
            return;
        }

        try {
            this.currentDeck = hash.split('+').map(cardStr => {
                const match = cardStr.match(/^(\d+)x(.+)$/);
                if (!match) throw new Error('Format invalide');
                
                const [, quantity, name] = match;
                return {
                    name: name.replace(/_/g, ' '),
                    quantity: parseInt(quantity)
                };
            });
            
            this.updateDisplay();
        } catch (error) {
            console.error('Erreur lors du décodage de l\'URL:', error);
            this.currentDeck = [];
            this.updateDisplay();
        }
    }

    addCardToDeck(cardName) {
        const existingCard = this.currentDeck.find(c => c.name === cardName);
        if (existingCard) {
            existingCard.quantity++;
        } else {
            this.currentDeck.push({ name: cardName, quantity: 1 });
        }
        
        this.updateDisplay();
        this.updateURL();
    }

    removeCardFromDeck(cardName) {
        const cardIndex = this.currentDeck.findIndex(c => c.name === cardName);
        if (cardIndex !== -1) {
            const card = this.currentDeck[cardIndex];
            if (card.quantity > 1) {
                card.quantity--;
            } else {
                this.currentDeck.splice(cardIndex, 1);
            }
        }
        
        this.updateDisplay();
        this.updateURL();
    }

    updateURL() {
        if (this.currentDeck.length === 0) {
            window.location.hash = '';
            return;
        }

        const deckCode = this.currentDeck
            .map(c => `${c.quantity}x${c.name.replace(/ /g, '_')}`)
            .join('+');
        
        window.location.hash = deckCode;
    }

    updateDisplay() {
        this.displayDeck();
        this.updateDeckURL();
        this.updateDeckCount();
    }

    displayAvailableCards() {
        const factionFilter = this.factionFilter.value;
        const searchTerm = this.searchFilter.value.toLowerCase();

        const filteredCards = this.cards.filter(card => {
            const matchesFaction = !factionFilter || card.faction === factionFilter;
            const matchesSearch = !searchTerm || card.name.toLowerCase().includes(searchTerm);
            return matchesFaction && matchesSearch;
        });

        this.availableCardsContainer.innerHTML = '';
        
        filteredCards.forEach(card => {
            const cardElement = this.createCardElement(card, false);
            cardElement.addEventListener('click', () => {
                this.addCardToDeck(card.name);
            });
            this.availableCardsContainer.appendChild(cardElement);
        });
    }

    displayDeck() {
        this.deckContainer.innerHTML = '';
        
        this.currentDeck.forEach(deckCard => {
            const cardData = this.cards.find(c => c.name === deckCard.name);
            if (!cardData) return;

            const cardElement = this.createCardElement(cardData, true, deckCard.quantity);
            cardElement.classList.add('deck-card');
            
            // Bouton de suppression
            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-btn';
            removeBtn.innerHTML = '×';
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeCardFromDeck(cardData.name);
            });
            cardElement.appendChild(removeBtn);

            // Click pour ajouter une carte supplémentaire
            cardElement.addEventListener('click', () => {
                this.addCardToDeck(cardData.name);
            });

            this.deckContainer.appendChild(cardElement);
        });
    }

    createCardElement(card, isInDeck = false, quantity = 0) {
        const cardElement = document.createElement('div');
        cardElement.className = `card faction-${card.faction.toLowerCase().replace(/\s+/g, '-')}`;
        
        cardElement.innerHTML = `
            <img src="../card-database/${card.image}" alt="${card.name}" 
                 onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
            <div style="display:none; height:120px; background: linear-gradient(45deg, #f0f0f0, #e0e0e0); 
                        border-radius: 8px; align-items: center; justify-content: center; 
                        color: #999; font-size: 12px; margin-bottom: 10px;">
                Image indisponible
            </div>
            <div class="card-name">${card.name}</div>
            <div class="card-cost">💎 ${card.cost}</div>
            <div class="card-faction">${card.faction}</div>
        `;

        if (isInDeck && quantity > 0) {
            const quantityBadge = document.createElement('div');
            quantityBadge.className = 'quantity-badge';
            quantityBadge.textContent = quantity;
            cardElement.appendChild(quantityBadge);
        }

        return cardElement;
    }

    updateDeckURL() {
        const baseUrl = window.location.origin + window.location.pathname;
        const hash = window.location.hash;
        this.deckUrlInput.value = baseUrl + hash;
    }

    updateDeckCount() {
        const totalCards = this.currentDeck.reduce((sum, card) => sum + card.quantity, 0);
        this.deckCountSpan.textContent = `(${totalCards} cartes)`;
    }

    populateFactionFilter() {
        const factions = [...new Set(this.cards.map(card => card.faction))];
        
        factions.forEach(faction => {
            const option = document.createElement('option');
            option.value = faction;
            option.textContent = faction;
            this.factionFilter.appendChild(option);
        });
    }

    loadExampleDeck() {
        this.currentDeck = [
            { name: "Mage", quantity: 2 },
            { name: "Orgre", quantity: 3 },
            { name: "Papillon Vert", quantity: 6 },
            { name: "Legendaire", quantity: 1 }
        ];
        
        this.updateDisplay();
        this.updateURL();
    }

    showToast(message) {
        // Simple toast notification
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #38a169;
            color: white;
            padding: 10px 20px;
            border-radius: 8px;
            z-index: 1000;
            font-weight: 600;
        `;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 2000);
    }
}

// Initialiser l'application
document.addEventListener('DOMContentLoaded', () => {
    new DeckVisualizer();
});
