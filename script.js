const suits = ['♠', '♥', '♦', '♣'];
const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

let deck = [];
let playerHand = [];
let dealerHand = [];
let gameOver = false;

const playerArea = document.getElementById('player-cards');
const dealerArea = document.getElementById('dealer-cards');
const playerScoreSpan = document.getElementById('player-score');
const dealerScoreSpan = document.getElementById('dealer-score');
const hitButton = document.getElementById('hit-button');
const standButton = document.getElementById('stand-button');
const newGameButton = document.getElementById('new-game-button');
const resultMessage = document.getElementById('result-message');

// --- Game Logic ---

function newGame() {
    createDeck();
    // Add a delay before dealing initial hands
    setTimeout(() => {
        dealInitialHands();
    }, 500); // 500ms delay
}

function createDeck() {
    deck = [];
    for (let suit of suits) {
        for (let rank of ranks) {
            deck.push({ rank, suit });
        }
    }
    shuffleDeck();
}

function shuffleDeck() {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]]; // Swap
    }
}

function getCardValue(card) {
    if (['J', 'Q', 'K'].includes(card.rank)) {
        return 10;
    }
    if (card.rank === 'A') {
        return 11; // Will be adjusted to 1 if score > 21
    }
    return parseInt(card.rank);
}

function calculateScore(hand) {
    let score = 0;
    let numAces = 0;
    for (let card of hand) {
        score += getCardValue(card);
        if (card.rank === 'A') {
            numAces++;
        }
    }

    while (score > 21 && numAces > 0) {
        score -= 10;
        numAces--;
    }
    return score;
}

function displayCards(hand, container, hideFirstCard = false) {
    container.innerHTML = '';
    hand.forEach((card, index) => {
        const cardElement = document.createElement('div');
        cardElement.classList.add('card');

        const cardInner = document.createElement('div');
        cardInner.classList.add('card-inner');

        const cardFront = document.createElement('div');
        cardFront.classList.add('card-front');
        cardFront.innerHTML = `<div class="rank">${card.rank}</div><div class="suit">${card.suit}</div>`;
        if (card.suit === '♥' || card.suit === '♦') {
            cardFront.classList.add('red');
        }

        const cardBack = document.createElement('div');
        cardBack.classList.add('card-back');

        cardInner.appendChild(cardFront);
        cardInner.appendChild(cardBack);
        cardElement.appendChild(cardInner);

        if (hideFirstCard && index === 0) {
            cardElement.classList.add('hidden');
        }

        container.appendChild(cardElement);
    });
}

function updateScores() {
    playerScoreSpan.textContent = calculateScore(playerHand);
    dealerScoreSpan.textContent = calculateScore(dealerHand);
}

function dealInitialHands() {
    playerHand = [];
    dealerHand = [];
    playerArea.innerHTML = ''; // Clear player cards from DOM
    dealerArea.innerHTML = ''; // Clear dealer cards from DOM
    resultMessage.textContent = '';
    gameOver = false;

    // Deal two cards to player
    dealCard(playerHand, playerArea, false);
    dealCard(playerHand, playerArea, false);

    // Deal two cards to dealer, one hidden
    dealCard(dealerHand, dealerArea, true); // Hidden card
    dealCard(dealerHand, dealerArea, false); // Visible card

    updateScores();
    checkBlackjack();
    updateButtons();
}

function dealCard(hand, container, isHidden = false) {
    const card = deck.pop();
    hand.push(card);

    const cardElement = document.createElement('div');
    cardElement.classList.add('card');
    if (isHidden) {
        cardElement.classList.add('hidden');
    }

    const cardInner = document.createElement('div');
    cardInner.classList.add('card-inner');

    const cardFront = document.createElement('div');
    cardFront.classList.add('card-front');
    cardFront.innerHTML = `<div class="rank">${card.rank}</div><div class="suit">${card.suit}</div>`;
    if (card.suit === '♥' || card.suit === '♦') {
        cardFront.classList.add('red');
    }

    const cardBack = document.createElement('div');
    cardBack.classList.add('card-back');

    cardInner.appendChild(cardFront);
    cardInner.appendChild(cardBack);
    cardElement.appendChild(cardInner);

    // Append the card directly to the container
    container.appendChild(cardElement);

    // Force reflow to ensure hidden state is applied before animation
    void cardElement.offsetWidth;

    // Add a class to trigger the appearance animation
    // This class will be removed after a short delay
    cardElement.classList.add('new-card-animation');

    // Remove the animation class after a short delay to trigger the transition
    setTimeout(() => {
        cardElement.classList.remove('new-card-animation');
    }, 50);
}

function checkBlackjack() {
    if (calculateScore(playerHand) === 21) {
        resultMessage.textContent = 'Blackjack! Player wins!';
        gameOver = true;
        revealDealerCard();
        updateButtons();
    } else if (calculateScore(dealerHand) === 21) {
        resultMessage.textContent = 'Dealer has Blackjack! Dealer wins!';
        gameOver = true;
        revealDealerCard();
        updateButtons();
    }
}

function playerHit() {
    if (gameOver) return;
    dealCard(playerHand, playerArea);
    updateScores();
    if (calculateScore(playerHand) > 21) {
        resultMessage.textContent = 'Player busts! Dealer wins!';
        gameOver = true;
        revealDealerCard();
    }
    updateButtons();
}

function playerStand() {
    if (gameOver) return;
    gameOver = true;
    revealDealerCard();
    dealerTurn();
    updateButtons();
}

function revealDealerCard() {
    const hiddenCardElement = dealerArea.querySelector('.card.hidden');
    if (hiddenCardElement) {
        hiddenCardElement.classList.remove('hidden');
        hiddenCardElement.classList.add('flipped'); // Trigger flip animation
        // After flip animation, remove flipped class and update content
        hiddenCardElement.addEventListener('transitionend', () => {
            hiddenCardElement.classList.remove('flipped');
            // No need to re-render, just update score
            updateScores();
        }, { once: true });
    } else {
        updateScores(); // Update score if no hidden card to reveal
    }
}


function dealerTurn() {
    while (calculateScore(dealerHand) < 17) {
        dealCard(dealerHand, dealerArea);
        updateScores();
    }
    determineWinner();
}

function determineWinner() {
    const playerScore = calculateScore(playerHand);
    const dealerScore = calculateScore(dealerHand);

    if (playerScore > 21) {
        resultMessage.textContent = 'Player busts! Dealer wins!';
    } else if (dealerScore > 21) {
        resultMessage.textContent = 'Dealer busts! Player wins!';
    } else if (playerScore > dealerScore) {
        resultMessage.textContent = 'Player wins!';
    } else if (dealerScore > playerScore) {
        resultMessage.textContent = 'Dealer wins!';
    } else {
        resultMessage.textContent = "It's a push!";
    }
}

function updateButtons() {
    hitButton.disabled = gameOver;
    standButton.disabled = gameOver;
    newGameButton.disabled = !gameOver;
}

// --- Event Listeners ---
hitButton.addEventListener('click', playerHit);
standButton.addEventListener('click', playerStand);
newGameButton.addEventListener('click', newGame);

// Initial game setup with a delay
setTimeout(() => {
    newGame();
}, 200); // 200ms delay on initial load
