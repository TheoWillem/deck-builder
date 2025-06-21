class DeckVisualizer {
    constructor() {
        this.cards = [];
        this.currentDeck = {};
        this.deckName = '';
        this.primaryFaction = '';
        this.secondaryFaction = '';
        this.availableCardsContainer = document.getElementById('available-cards');
        this.deckContainer = document.getElementById('deck-container');
        this.deckCountSpan = document.getElementById('deck-count');
        this.factionFilterButton = document.getElementById('faction-filter-button');
        this.factionFilterList = document.getElementById('faction-filter-list');
        this.selectedFactions = new Set(['']); // '' = toutes les factions
        this.searchFilter = document.getElementById('search-filter');
        this.sortFilter = document.getElementById('sort-filter');
        this.orderFilter = document.getElementById('order-filter');
        this.primaryFactionSelect = document.getElementById('primary-faction');
        this.secondaryFactionSelect = document.getElementById('secondary-faction');
        
        this.init();
    }

    async init() {
        await this.loadCards();
        this.setupEventListeners();
        this.loadDeckFromURL();
        this.populateFactionFilter();
        
        // Préchargement intelligent des images les plus courantes
        this.preloadCommonImages();
        
        this.displayAvailableCards();
        this.displayDeckCards();
        this.updateDeckURL();
        this.updateDeckCount();
    }

    preloadCommonImages() {
        // Précharger quelques images communes pour améliorer l'UX
        const commonCards = [
            'Life Elixir', 'Sell-Sword', 'Decoy', 'Adventurer', 
            'Call to Arms', 'Assassin\'s Strike', 'Stolen Treasure'
        ];
        
        const seasons = ['Core', 'Season1', 'Season2'];
        const factionFolders = ['AugurOrder', 'DungeonMaster', 'Neutral', 'PlunderingGuild', 'WildHorde'];
        
        setTimeout(() => {
            commonCards.forEach(cardName => {
                factionFolders.forEach(folder => {
                    seasons.forEach(season => {
                        const imagePath = `../card-database/Cards_images/${season}/${folder}/${cardName}.png`;
                        // Précharger l'image
                        const img = new Image();
                        img.src = imagePath;
                    });
                });
            });
        }, 1000); // Attendre que la page soit chargée
    }

    async loadCards() {
        try {
            this.cards = await this.loadCardsFromCSV();
        } catch (error) {
            console.error('Error loading cards:', error);
            // Fallback with some default cards
            this.cards = [
                { "id": 1, "name": "Battle Mage", "cost": 3, "faction": "DM", "image": "mage.jpg" },
                { "id": 2, "name": "Cave Ogre", "cost": 5, "faction": "PG", "image": "ogre.jpg" }
            ];
        }
    }

    async loadCardsFromCSV() {
        // Afficher un indicateur de chargement
        const availableCardsGrid = document.getElementById('available-cards');
        const deckContainer = document.getElementById('deck-container');
        
        availableCardsGrid.innerHTML = '<div class="loading-message">🃏 Loading cards...</div>';
        deckContainer.innerHTML = '<div class="loading-message">🃏 Preparing deck...</div>';
        
        const csvFiles = [
            { file: 'C&T Cards 2 - Augur Order.csv', faction: 'AO' },
            { file: 'C&T Cards 2 - Dungeon Master.csv', faction: 'DM' },
            { file: 'C&T Cards 2 - Neutral.csv', faction: 'N' },
            { file: 'C&T Cards 2 - Plundering Guild.csv', faction: 'PG' },
            { file: 'C&T Cards 2 - Wild Horde.csv', faction: 'WH' }
        ];

        const allCards = [];
        let cardId = 1;

        for (const csvInfo of csvFiles) {
            try {
                const response = await fetch(`../card-database/Cards_csv/${csvInfo.file}`);
                const csvText = await response.text();
                const cards = this.parseCSV(csvText, csvInfo.faction, cardId);
                allCards.push(...cards);
                cardId += cards.length;
            } catch (error) {
                console.error(`Error loading ${csvInfo.file}:`, error);
            }
        }

        // Filtrer les tokens, cantrips, banes et boons avant de charger les images
        const playableCards = allCards.filter(card => this.isPlayableCard(card));

        console.log(`Filtered out ${allCards.length - playableCards.length} tokens, cantrips, banes and boons`);

        // Ne plus charger les images à l'avance, on les charge à la demande
        playableCards.forEach(card => {
            card.image = this.getImagePathSync(card.name, card.faction);
        });

        return playableCards;
    }

    getImagePathSync(cardName, faction) {
        // Génère le chemin d'image sans faire de requête HTTP
        // On essaie toujours Core en premier car c'est le plus probable
        const factionFolders = {
            'AO': 'AugurOrder',
            'DM': 'DungeonMaster', 
            'N': 'Neutral',
            'PG': 'PlunderingGuild',
            'WH': 'WildHorde'
        };

        const folderName = factionFolders[faction] || 'Neutral';
        
        // Retourne toujours le chemin Core en premier (le plus probable)
        // Utilise le nom original de la carte pour le chemin du fichier
        return `../card-database/Cards_images/Core/${folderName}/${cardName}.png`;
    }

    normalizeCardName(name) {
        // Normalisation agressive : supprime espaces et caractères spéciaux, met en minuscules
        return name
            .toLowerCase()
            .replace(/[^a-z0-9]/g, ''); // Garde seulement les lettres et chiffres
    }

    isPlayableCard(card) {
        // Vérifie si une carte peut être jouée (exclut tokens, cantrips, banes, boons)
        if (card.type) {
            const cardType = card.type.toLowerCase();
            return !(cardType.includes('token') || cardType.includes('cantrip') || cardType.includes('bane') || cardType.includes('boon'));
        }
        return true;
    }



    parseCSV(csvText, faction, startId) {
        const lines = csvText.split('\n');
        const cards = [];
        let currentId = startId;

        // Skip header line and empty lines
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line || line.startsWith(',,,')) continue; // Skip empty lines and token lines

            const columns = this.parseCSVLine(line);
            
            // Skip if not enough columns or empty name
            if (columns.length < 3 || !columns[1] || columns[1].trim() === '') continue;

            const name = columns[1].trim();
            const manaCost = columns[2].trim();
            const cardType = columns[3] ? columns[3].trim() : '';
            const rarity = columns[4] ? columns[4].trim() : '';
            const statline = columns[5] ? columns[5].trim() : '';
            const attributes = columns[6] ? columns[6].trim() : '';
            const ability = columns[7] ? columns[7].trim() : '';

            // Parse mana cost (convert to number, default to 0 if invalid)
            let cost = 0;
            if (manaCost && !isNaN(parseFloat(manaCost))) {
                cost = parseInt(parseFloat(manaCost));
            }

            const card = {
                id: currentId++,
                name: name,
                cost: cost,
                faction: faction,
                type: cardType,
                rarity: rarity,
                statline: statline,
                attributes: attributes,
                ability: ability,
                image: null // Will be set asynchronously
            };

            cards.push(card);
        }

        return cards;
    }



    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        
        result.push(current);
        return result;
    }

    setupEventListeners() {
        // Copy URL
        document.getElementById('copy-url').addEventListener('click', (e) => {
            this.animateButtonPress(e.target);
            const url = window.location.href;
            navigator.clipboard.writeText(url).then(() => {
                this.showToast('URL copied!');
            }).catch(() => {
                // Fallback pour les navigateurs plus anciens
                const textArea = document.createElement('textarea');
                textArea.value = url;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                this.showToast('URL copied!');
            });
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

        // Setup faction filter dropdown
        this.setupFactionFilterEvents();

        this.searchFilter.addEventListener('input', () => {
            this.displayAvailableCards(); // Only the collection is updated
        });

        this.sortFilter.addEventListener('change', () => {
            this.displayAvailableCards(); // Only the collection is updated
        });

        this.orderFilter.addEventListener('change', () => {
            this.displayAvailableCards(); // Only the collection is updated
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

        // Deck title input
        const deckTitle = document.getElementById('deck-title');
        
        deckTitle.addEventListener('input', () => {
            this.deckName = deckTitle.value.trim();
            this.updateURL();
        });

        deckTitle.addEventListener('blur', () => {
            if (!deckTitle.value.trim()) {
                this.deckName = '';
                this.updateURL();
            }
        });

        // Validation avec la touche Entrée
        deckTitle.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                deckTitle.blur(); // Sort du focus
            }
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
        
        // Exclure les cartes tokens, cantrips, banes et boons
        if (!this.isPlayableCard(card)) {
            this.shakeCard(card.id);
            this.showCardPopup(card.id, 'Tokens, cantrips, banes and boons cannot be added to deck');
            return;
        }
        
        // Check if the card can be added according to the selected factions
        const allowedFactions = [this.primaryFaction, this.secondaryFaction, 'N'].filter(f => f);
        if (!allowedFactions.includes(card.faction)) {
            return;
        }
        
        const currentQuantity = this.currentDeck[cardName] || 0;
        
        // Check legendary card restriction (only 1 copy allowed)
        if (card.rarity === 'Legendary' && currentQuantity >= 1) {
            console.log('Max 1 copy reached for legendary card', card.name, card.id);
            this.shakeCard(card.id);
            this.showCardPopup(card.id, 'Maximum 1 copy per legendary card');
            return;
        }
        
        // Check maximum 3 copies per card (non-legendary)
        if (card.rarity !== 'Legendary' && currentQuantity >= 3) {
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
        this.primaryFactionSelect.value = this.primaryFaction;
        this.secondaryFactionSelect.value = this.secondaryFaction;
        
        // Synchroniser le titre input
        const deckTitle = document.getElementById('deck-title');
        deckTitle.value = this.deckName || '';
    }

    displayAvailableCards() {
        const filteredCards = this.getFilteredCards();
        const grid = document.getElementById('available-cards');
        
        // The collection ALWAYS displays all cards (filtered)
        grid.innerHTML = filteredCards.map(card => this.generateCardHTML(card)).join('');
        
        // Click to ADD to deck (the card REMAINS in the collection)
        grid.querySelectorAll('.card').forEach(cardElement => {
            cardElement.addEventListener('click', (e) => {
                e.preventDefault(); // Empêche le comportement par défaut du navigateur
                e.stopPropagation(); // Empêche la propagation de l'événement
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

        // Créer un tableau de cartes avec leurs quantités et les trier par mana
        const deckCards = Object.entries(this.currentDeck)
            .map(([cardName, quantity]) => {
                const card = this.cards.find(c => c.name === cardName);
                return card ? { card, quantity } : null;
            })
            .filter(item => item !== null)
            .sort((a, b) => {
                // Tri principal par coût de mana croissant
                const manaDiff = a.card.cost - b.card.cost;
                // Tri secondaire par nom si même coût de mana
                return manaDiff !== 0 ? manaDiff : a.card.name.localeCompare(b.card.name);
            });

        const deckHTML = deckCards
            .map(({ card, quantity }) => this.generateCardHTML(card, quantity))
            .join('');

        grid.innerHTML = deckHTML;

        grid.querySelectorAll('.deck-card').forEach(cardElement => {
            const cardId = parseInt(cardElement.dataset.cardId);
            const card = this.cards.find(c => c.id === cardId);
            
            if (card) {
                cardElement.addEventListener('click', (e) => {
                    e.preventDefault(); // Empêche le comportement par défaut du navigateur
                    e.stopPropagation(); // Empêche la propagation de l'événement
                    this.removeCardFromDeck(card.name);
                });

                const removeBtn = cardElement.querySelector('.remove-btn');
                if (removeBtn) {
                    removeBtn.addEventListener('click', (e) => {
                        e.preventDefault(); // Empêche le comportement par défaut du navigateur
                        e.stopPropagation();
                        this.animateButtonPress(removeBtn);
                        this.removeCardFromDeck(card.name);
                    });
                }
            }
        });
    }

    generateCardHTML(card, quantity = 0) {
        // For collection cards, display the current quantity in the deck
        let displayQuantity = quantity;
        if (quantity === 0 && this.currentDeck[card.name]) {
            displayQuantity = this.currentDeck[card.name];
        }
        
        // Check if the card can be added according to the selected factions
        const allowedFactions = [this.primaryFaction, this.secondaryFaction, 'N'].filter(f => f);
        const isCardAllowed = allowedFactions.includes(card.faction);
        const disabledClass = (quantity === 0 && !isCardAllowed) ? 'card-disabled' : '';
        
        // Générer les chemins de fallback pour les images
        const fallbackPaths = this.getImageFallbackPaths(card.name, card.faction);
        const imageHTML = this.generateImageHTML(card.name, fallbackPaths);
        
        return `
            <div class="card ${quantity > 0 ? 'deck-card' : ''} ${disabledClass} faction-${card.faction.toLowerCase().replace(/\s+/g, '-')}" 
                 data-card-id="${card.id}">
                <div class="quantity-badge faction-${card.faction.toLowerCase()}-bg">${displayQuantity}</div>
                ${quantity > 0 ? '<button class="remove-btn" onclick="event.stopPropagation();">×</button>' : ''}
                ${!isCardAllowed && quantity === 0 ? '<div class="disabled-overlay"><div class="disabled-message"><div class="disabled-emoji">🚫</div><div class="disabled-text">Not in selected factions</div></div></div>' : ''}
                ${imageHTML}
            </div>
        `;
    }

    getImageFallbackPaths(cardName, faction) {
        const factionFolders = {
            'AO': 'AugurOrder',
            'DM': 'DungeonMaster', 
            'N': 'Neutral',
            'PG': 'PlunderingGuild',
            'WH': 'WildHorde'
        };

        const folderName = factionFolders[faction] || 'Neutral';
        
        // Créer plusieurs variantes du nom de la carte pour correspondre aux différences possibles
        const cardNameVariants = this.getCardNameVariants(cardName);
        
        const seasons = ['Core', 'Season1', 'Season2', 'Tutorial'];
        const allPaths = [];
        
        // Pour chaque saison, essayer toutes les variantes
        seasons.forEach(season => {
            cardNameVariants.forEach(variant => {
                allPaths.push(`../card-database/Cards_images/${season}/${folderName}/${variant}.png`);
            });
        });
        
        return allPaths;
    }

    getCardNameVariants(cardName) {
        // Créer des variantes pour gérer les différences de casse communes
        const variants = [
            cardName, // Nom original
            cardName.replace(' Or ', ' or '), // "Dead Or Alive" -> "Dead or Alive"
            cardName.replace(' And ', ' and '), // "Rock And Roll" -> "Rock and Roll"
            cardName.replace(' The ', ' the '), // "Into The Wild" -> "Into the Wild"
            cardName.replace(' Of ', ' of '), // "Power Of Magic" -> "Power of Magic"
            cardName.replace(' In ', ' in '), // "Lost In Time" -> "Lost in Time"
            cardName.replace(' To ', ' to '), // "Back To Start" -> "Back to Start"
            cardName.replace(' A ', ' a '), // "Once A Hero" -> "Once a Hero"
            cardName.replace(' An ', ' an '), // "Such An Event" -> "Such an Event"
        ];
        
        // Supprimer les doublons en gardant l'ordre
        return variants.filter((variant, index, arr) => arr.indexOf(variant) === index);
    }

    generateImageHTML(cardName, fallbackPaths) {
        if (fallbackPaths.length === 0) {
            return `<div class="card-placeholder">📜 ${cardName}</div>`;
        }

        let imageHTML = '';
        fallbackPaths.forEach((path, index) => {
            const isLast = index === fallbackPaths.length - 1;
            const nextFallback = isLast ? 
                'this.style.display=\'none\'; this.parentElement.querySelector(\'.card-placeholder\').style.display=\'flex\';' :
                `this.style.display='none'; this.nextElementSibling.style.display='block';`;
            
            const display = index === 0 ? 'block' : 'none';
            imageHTML += `<img src="${path}" alt="${cardName}" loading="lazy" style="display: ${display};" onerror="${nextFallback}">`;
        });
        
        imageHTML += `<div class="card-placeholder" style="display: none;">📜 ${cardName}</div>`;
        return imageHTML;
    }

    updateDeckURL() {
        // Cette méthode n'est plus nécessaire car on n'affiche plus l'URL
        // On garde juste pour éviter les erreurs de référence
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
        // Les factions sont maintenant définies directement dans le HTML
        // On garde juste le code pour les selects de primary/secondary faction
        const factions = [
            { code: 'DM', emoji: '🟣', name: 'Dungeon Master' },
            { code: 'PG', emoji: '🔴', name: 'Plundering Guild' },
            { code: 'WH', emoji: '🟢', name: 'Wild Horde' },
            { code: 'AO', emoji: '🔵', name: 'Augur Order' },
            { code: 'N', emoji: '⚫', name: 'Neutral' }
        ];

        // Populate primary and secondary faction selects
        const primaryAndSecondaryFactions = factions.filter(f => f.code !== 'N'); // Exclude Neutral as primary/secondary
        const factionOptions = '<option value="">Select Faction</option>' + 
            primaryAndSecondaryFactions.map(faction => `<option value="${faction.code}">${faction.emoji} ${faction.name}</option>`).join('');
        
        this.primaryFactionSelect.innerHTML = factionOptions;
        this.secondaryFactionSelect.innerHTML = factionOptions;
    }

    setupFactionFilterEvents() {
        // Gestion du clic sur le bouton pour ouvrir/fermer le dropdown
        this.factionFilterButton.addEventListener('click', (e) => {
            e.stopPropagation();
            const dropdown = this.factionFilterButton.parentElement;
            dropdown.classList.toggle('open');
        });

        // Fermer le dropdown quand on clique ailleurs
        document.addEventListener('click', (e) => {
            const dropdown = this.factionFilterButton.parentElement;
            if (!dropdown.contains(e.target)) {
                dropdown.classList.remove('open');
            }
        });

        // Gestion des checkboxes
        const checkboxes = this.factionFilterList.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.handleFactionSelection(checkbox);
            });
        });
    }

    handleFactionSelection(checkbox) {
        if (checkbox.id === 'faction-all') {
            // Si "All Factions" est sélectionné, décocher toutes les autres
            if (checkbox.checked) {
                this.selectedFactions.clear();
                this.selectedFactions.add('');
                const otherCheckboxes = this.factionFilterList.querySelectorAll('input[type="checkbox"]:not(#faction-all)');
                otherCheckboxes.forEach(cb => cb.checked = false);
            }
        } else {
            // Si une faction spécifique est sélectionnée, décocher "All Factions"
            if (checkbox.checked) {
                this.selectedFactions.delete('');
                this.selectedFactions.add(checkbox.value);
                document.getElementById('faction-all').checked = false;
            } else {
                this.selectedFactions.delete(checkbox.value);
                // Si aucune faction n'est sélectionnée, cocher "All Factions"
                if (this.selectedFactions.size === 0) {
                    this.selectedFactions.add('');
                    document.getElementById('faction-all').checked = true;
                }
            }
        }

        this.updateFactionFilterText();
        this.displayAvailableCards();
    }

    updateFactionFilterText() {
        const textSpan = this.factionFilterButton.querySelector('.faction-filter-text');
        
        if (this.selectedFactions.has('')) {
            textSpan.textContent = '🌈 All Factions';
        } else {
            const factionNames = {
                'DM': '🟣 DM',
                'PG': '🔴 PG', 
                'WH': '🟢 WH',
                'AO': '🔵 AO',
                'N': '⚫ N'
            };
            
            const selectedNames = Array.from(this.selectedFactions)
                .map(code => factionNames[code])
                .join(', ');
            
            if (selectedNames.length > 20) {
                textSpan.textContent = `${this.selectedFactions.size} factions`;
            } else {
                textSpan.textContent = selectedNames;
            }
        }
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
                cardsByFaction[factionName].push({ name: cardName, quantity, card });
            }
        }

        // Sort factions in preferred order
        const factionOrder = ['DM', 'PG', 'WH', 'AO', 'Neutral'];
        let decklistText = '';

        factionOrder.forEach(factionName => {
            if (cardsByFaction[factionName]) {
                decklistText += `${factionName} cards:\n`;
                
                // Sort cards by mana cost then alphabetically within each faction
                cardsByFaction[factionName]
                    .sort((a, b) => {
                        const manaDiff = a.card.cost - b.card.cost;
                        return manaDiff !== 0 ? manaDiff : a.name.localeCompare(b.name);
                    })
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
        const searchTerm = this.searchFilter.value.toLowerCase();
        const sortBy = this.sortFilter.value;
        const sortOrder = this.orderFilter.value;

        let filteredCards = this.cards.filter(card => {
            // Exclure les cartes tokens, cantrips, banes et boons
            if (!this.isPlayableCard(card)) {
                return false;
            }
            
            // Vérifier si la faction de la carte est dans les factions sélectionnées
            const matchesFaction = this.selectedFactions.has('') || this.selectedFactions.has(card.faction);
            const matchesSearch = !searchTerm || 
                card.name.toLowerCase().includes(searchTerm) ||
                (card.type && card.type.toLowerCase().includes(searchTerm)) ||
                (card.ability && card.ability.toLowerCase().includes(searchTerm));
            return matchesFaction && matchesSearch;
        });

        // Apply sorting
        filteredCards.sort((a, b) => {
            let comparison = 0;
            
            switch (sortBy) {
                case 'mana':
                    comparison = a.cost - b.cost;
                    // Secondary sort by name if mana is equal
                    if (comparison === 0) {
                        comparison = a.name.localeCompare(b.name);
                    }
                    break;
                case 'rarity':
                    comparison = this.compareRarity(a.rarity, b.rarity);
                    // Secondary sort by name if rarity is equal
                    if (comparison === 0) {
                        comparison = a.name.localeCompare(b.name);
                    }
                    break;
                case 'type':
                    comparison = (a.type || '').localeCompare(b.type || '');
                    // Secondary sort by name if type is equal
                    if (comparison === 0) {
                        comparison = a.name.localeCompare(b.name);
                    }
                    break;
                case 'name':
                default:
                    comparison = a.name.localeCompare(b.name);
                    break;
            }
            
            return sortOrder === 'desc' ? -comparison : comparison;
        });

        return filteredCards;
    }

    compareRarity(rarityA, rarityB) {
        const rarityOrder = {
            'Common': 1,
            'Uncommon': 2,
            'Rare': 3,
            'Legendary': 4
        };
        
        const valueA = rarityOrder[rarityA] || 0;
        const valueB = rarityOrder[rarityB] || 0;
        
        return valueA - valueB;
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    new DeckVisualizer();
});
