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
        document.getElementById('copy-url').addEventListener('click', (e) => {
            this.animateButtonPress(e.target);
            this.deckUrlInput.select();
            document.execCommand('copy');
            this.showToast('URL copied!');
        });

        // Copy Decklist
        document.getElementById('copy-decklist').addEventListener('click', (e) => {
            this.animateButtonPress(e.target);
            this.copyDecklist();
        });

        // Clear deck
        document.getElementById('clear-deck').addEventListener('click', (e) => {
            this.animateButtonPress(e.target);
            this.currentDeck = {};
            this.deckName = '';
            this.primaryFaction = '';
            this.secondaryFaction = '';
            this.updateDisplay();
            this.updateDeckInfo();
            this.updateURL();
        });

        // Filters - Updates ONLY the collection, the deck remains unchanged
        this.factionFilter.addEventListener('change', () => {
            this.displayAvailableCards(); // Only the collection is updated
        });

        this.searchFilter.addEventListener('input', () => {
            this.displayAvailableCards(); // Only the collection is updated
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
        
        // Check if the card can be added according to the selected factions
        const allowedFactions = [this.primaryFaction, this.secondaryFaction, 'N'].filter(f => f);
        if (!allowedFactions.includes(card.faction)) {
            return;
        }
        
        const currentQuantity = this.currentDeck[cardName] || 0;
        
        // Check maximum 3 copies per card
        if (currentQuantity >= 3) {
            console.log('Max 3 copies reached for', card.name, card.id);
            this.shakeCard(card.id);
            this.showCardPopup(card.id, 'Maximum 3 copies per card');
            return;
        }
        
        // Check total deck limit (40 cards)
        const totalCards = Object.values(this.currentDeck).reduce((sum, quantity) => sum + quantity, 0);
        if (totalCards >= 40) {
            this.shakeCard(card.id);
            this.showCardPopup(card.id, 'Deck is full! Maximum 40 cards allowed.');
            return;
        }
        
        // Check secondary faction limit (10 cards)
        if (card.faction === this.secondaryFaction) {
            const secondaryFactionCards = Object.entries(this.currentDeck)
                .reduce((sum, [cardName, quantity]) => {
                    const deckCard = this.cards.find(c => c.name === cardName);
                    return deckCard && deckCard.faction === this.secondaryFaction ? sum + quantity : sum;
                }, 0);
            
            if (secondaryFactionCards >= 10) {
                this.shakeCard(card.id);
                this.showCardPopup(card.id, `Max 10 ${this.secondaryFaction} cards allowed`);
                return;
            }
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
        // Determine allowed factions (selected factions + Neutral)
        const allowedFactions = [this.primaryFaction, this.secondaryFaction, 'N'].filter(f => f);
        
        // Go through all cards in the deck
        const cardsToRemove = [];
        const cardsToReduce = [];
        
        for (const cardName in this.currentDeck) {
            const card = this.cards.find(c => c.name === cardName);
            if (card && !allowedFactions.includes(card.faction)) {
                cardsToRemove.push(cardName);
            }
        }
        
        // Remove unauthorized cards
        cardsToRemove.forEach(cardName => {
            delete this.currentDeck[cardName];
        });
        
        // Check secondary faction limit and reduce if necessary
        if (this.secondaryFaction) {
            let secondaryCount = 0;
            const secondaryCards = [];
            
            for (const [cardName, quantity] of Object.entries(this.currentDeck)) {
                const card = this.cards.find(c => c.name === cardName);
                if (card && card.faction === this.secondaryFaction) {
                    secondaryCount += quantity;
                    secondaryCards.push({ cardName, quantity });
                }
            }
            
            // If we have more than 10 secondary faction cards, remove excess
            if (secondaryCount > 10) {
                let toRemove = secondaryCount - 10;
                
                // Remove cards starting from the end (LIFO approach)
                for (let i = secondaryCards.length - 1; i >= 0 && toRemove > 0; i--) {
                    const { cardName, quantity } = secondaryCards[i];
                    const reduction = Math.min(quantity, toRemove);
                    
                    this.currentDeck[cardName] -= reduction;
                    if (this.currentDeck[cardName] <= 0) {
                        delete this.currentDeck[cardName];
                    }
                    
                    toRemove -= reduction;
                    cardsToReduce.push(cardName);
                }
            }
        }
        
        // Update display if cards have been removed or reduced
        if (cardsToRemove.length > 0 || cardsToReduce.length > 0) {
            this.updateDisplay();
            this.updateDeckCount();
            
            if (cardsToReduce.length > 0) {
                this.showToast(`Some secondary faction cards were removed to respect the 10-card limit.`);
            }
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
        this.displayAvailableCards(); // Update collection to display correct quantities
        this.displayDeckCards(); // Update ONLY the deck
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
        
        // The collection ALWAYS displays all cards (filtered)
        grid.innerHTML = filteredCards.map(card => this.generateCardHTML(card)).join('');
        
        // Click to ADD to deck (the card REMAINS in the collection)
        grid.querySelectorAll('.card').forEach(cardElement => {
            cardElement.addEventListener('click', () => {
                const cardId = parseInt(cardElement.dataset.cardId);
                const card = this.cards.find(c => c.id === cardId);
                if (card) {
                    this.addCardToDeck(card.name); // Error messages are handled in addCardToDeck
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
                        this.animateButtonPress(removeBtn);
                        this.removeCardFromDeck(card.name);
                    });
                }
            }
        });
    }

    generateCardHTML(card, quantity = 0) {
        const imagePath = card.image ? `../card-database/${card.image}` : null;
        
        // For collection cards, display the current quantity in the deck
        let displayQuantity = quantity;
        if (quantity === 0 && this.currentDeck[card.name]) {
            displayQuantity = this.currentDeck[card.name];
        }
        
        // Check if the card can be added according to the selected factions
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
        
        // Calculate secondary faction cards count
        let secondaryCount = 0;
        if (this.secondaryFaction) {
            secondaryCount = Object.entries(this.currentDeck)
                .reduce((sum, [cardName, quantity]) => {
                    const card = this.cards.find(c => c.name === cardName);
                    return card && card.faction === this.secondaryFaction ? sum + quantity : sum;
                }, 0);
        }
        
        // Update deck count display with HTML for different font sizes
        let countHTML = `(<span style="opacity: 0.7;">${totalCards}/40</span> cards`;
        if (this.secondaryFaction && secondaryCount > 0) {
            countHTML += `, <span style="opacity: 0.7;">${secondaryCount}/10</span> secondary`;
        }
        countHTML += ')';
        
        this.deckCountSpan.innerHTML = countHTML;
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
        // Create or retrieve the toast container
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
            font-family: 'Crimson Text', serif;
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
                // Remove the container if it's empty
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

        // Remove classes after animation
        setTimeout(() => {
            cardElement.classList.remove('shaking', 'shake-red-flash');
        }, 600);
    }

    showCardPopup(cardId, message) {
        console.log('Showing popup for card', cardId, 'with message:', message);
        const cardElement = document.querySelector(`[data-card-id="${cardId}"]`);
        if (!cardElement) {
            console.log('Card element not found for ID:', cardId);
            return;
        }

        // Remove any existing popups (not just on this card but all old ones)
        document.querySelectorAll('.card-popup').forEach(popup => popup.remove());

        // Create popup element
        const popup = document.createElement('div');
        popup.className = 'card-popup';
        popup.textContent = message;
        
        // Use fixed positioning relative to the viewport instead of absolute
        const cardRect = cardElement.getBoundingClientRect();
        popup.style.cssText = `
            position: fixed;
            top: ${cardRect.top - 50}px;
            left: ${cardRect.left + cardRect.width / 2}px;
            transform: translateX(-50%);
            background: #8b1538;
            color: #ffcccb;
            padding: 8px 12px;
            border-radius: 6px;
            font-weight: 600;
            font-size: 0.85rem;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.6);
            border: 2px solid #a0184a;
            text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.9);
            font-family: 'Crimson Text', serif;
            white-space: nowrap;
            z-index: 1000;
            opacity: 0;
            transform: translateX(-50%) translateY(-10px);
            transition: all 0.3s ease-in-out;
            pointer-events: none;
        `;

        // Add triangle pointer
        const triangle = document.createElement('div');
        triangle.style.cssText = `
            position: absolute;
            top: 100%;
            left: 50%;
            transform: translateX(-50%);
            width: 0;
            height: 0;
            border-left: 6px solid transparent;
            border-right: 6px solid transparent;
            border-top: 6px solid #8b1538;
        `;
        popup.appendChild(triangle);

        // Append to body instead of card to avoid overflow issues
        document.body.appendChild(popup);

        // Animate in
        setTimeout(() => {
            popup.style.opacity = '1';
            popup.style.transform = 'translateX(-50%) translateY(0)';
        }, 10);

        // Animate out and remove
        setTimeout(() => {
            popup.style.opacity = '0';
            popup.style.transform = 'translateX(-50%) translateY(-10px)';
            setTimeout(() => {
                if (popup.parentNode) {
                    popup.remove();
                }
            }, 300);
        }, 2500);
    }

    copyDecklist() {
        if (Object.keys(this.currentDeck).length === 0) {
            this.showToast('No cards in deck!');
            return;
        }

        // Map faction codes to full names
        const factionNames = {
            'DM': 'DM',
            'PG': 'PG', 
            'WH': 'WH',
            'AO': 'AO',
            'N': 'Neutral'
        };

        // Group cards by faction
        const cardsByFaction = {};
        
        for (const [cardName, quantity] of Object.entries(this.currentDeck)) {
            const card = this.cards.find(c => c.name === cardName);
            if (card) {
                const factionName = factionNames[card.faction] || card.faction;
                if (!cardsByFaction[factionName]) {
                    cardsByFaction[factionName] = [];
                }
                cardsByFaction[factionName].push({ name: cardName, quantity });
            }
        }

        // Sort factions in preferred order
        const factionOrder = ['DM', 'PG', 'WH', 'AO', 'Neutral'];
        let decklistText = '';

        factionOrder.forEach(factionName => {
            if (cardsByFaction[factionName]) {
                decklistText += `${factionName} cards:\n`;
                
                // Sort cards alphabetically within each faction
                cardsByFaction[factionName]
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .forEach(card => {
                        decklistText += `${card.quantity}x ${card.name}\n`;
                    });
                
                decklistText += '\n'; // Empty line between factions
            }
        });

        // Remove trailing newlines
        decklistText = decklistText.trim();

        // Copy to clipboard
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(decklistText).then(() => {
                this.showToast('Decklist copied!');
            }).catch(err => {
                console.error('Failed to copy decklist:', err);
                this.fallbackCopyDecklist(decklistText);
            });
        } else {
            this.fallbackCopyDecklist(decklistText);
        }
    }

    fallbackCopyDecklist(text) {
        // Fallback method for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            document.execCommand('copy');
            this.showToast('Decklist copied!');
        } catch (err) {
            console.error('Fallback copy failed:', err);
            this.showToast('Failed to copy decklist');
        }
        
        document.body.removeChild(textArea);
    }

    animateButtonPress(button) {
        // Éviter les animations multiples simultanées
        if (button.classList.contains('button-pressed')) return;
        
        button.classList.add('button-pressed');
        
        // Retirer la classe après l'animation
        setTimeout(() => {
            button.classList.remove('button-pressed');
        }, 150); // Durée de l'animation
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
