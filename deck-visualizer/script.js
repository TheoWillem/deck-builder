// 1. Décoder l'URL
function getDeckFromURL() {
    const hash = window.location.hash.substring(1); // Enlève le #
    if (!hash) return [];

    return hash.split("+").map(cardStr => {
        const [quantity, name] = cardStr.split("x");
        return { quantity: parseInt(quantity), name: name.replace(/_/g, " ") };
    });
}

// 2. Afficher les cartes
function displayDeck(deck) {
    const deckContainer = document.getElementById("deck-container");
    deckContainer.innerHTML = "";

    deck.forEach(card => {
        const cardElement = document.createElement("div");
        cardElement.className = "card";
        cardElement.innerHTML = `
            <img src="images/${card.name}.jpg" alt="${card.name}">
            <span class="quantity">${card.quantity}x</span>
            <span class="name">${card.name}</span>
        `;
        deckContainer.appendChild(cardElement);
    });
}

// Au chargement de la page
window.addEventListener("load", () => {
    const deck = getDeckFromURL();
    displayDeck(deck);
});

// 3. Gestion du clic sur une carte
document.querySelectorAll(".available-card").forEach(card => {
    card.addEventListener("click", () => {
        const cardName = card.getAttribute("data-name");
        const currentDeck = getDeckFromURL();
        
        // Si la carte est déjà dans le deck, on incrémente la quantité
        const existingCard = currentDeck.find(c => c.name === cardName);
        if (existingCard) {
            existingCard.quantity++;
        } else {
            currentDeck.push({ quantity: 1, name: cardName });
        }

        // Met à jour l'URL
        updateDeckURL(currentDeck);
        displayDeck(currentDeck);
    });
});

// Met à jour l'URL sans recharger la page
function updateDeckURL(deck) {
    const deckCode = deck.map(c => `${c.quantity}x${c.name.replace(/ /g, "_")}`).join("+");
    window.location.hash = deckCode;
}
