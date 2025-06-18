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
            <img src="images/${card.name}.png" alt="${card.name}">
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
