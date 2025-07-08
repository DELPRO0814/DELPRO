document.addEventListener('DOMContentLoaded', () => {
const { createClient } = supabase;

const supabaseUrl = "https://fehfkyowkcwmviymhonh.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZlaGZreW93a2N3bXZpeW1ob25oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE5MDIyMDQsImV4cCI6MjA2NzQ3ODIwNH0.hrUIZfJ8Hg3zPsCG-0rxP6KSYpxSJk4QDseUBHmOsLY";
const supabaseClient = createClient(supabaseUrl, supabaseKey);




const loginButton = document.getElementById('login-button');
const loginContainer = document.getElementById('login-container');
const gameWrapper = document.getElementById('game-wrapper');
const mainMenuContainer = document.getElementById('main-menu-container');
const nicknameInput = document.getElementById('nickname');
const passwordInput = document.getElementById('password');
const signupButton = document.getElementById('signup-button');

const passwordShortModal = document.getElementById('password-short-modal');
const closePasswordShortModal = document.getElementById('close-password-short-modal');
const nicknameExistsModal = document.getElementById('nickname-exists-modal');
const closeNicknameExistsModal = document.getElementById('close-nickname-exists-modal');
const signupSuccessModal = document.getElementById('signup-success-modal');
const closeSignupSuccessModal = document.getElementById('close-signup-success-modal');

let currentPlayerStats = {
    last_login_at: null,
    highest_score: 0,
    highest_score_play_count: 0,
    highest_score_hit_count: 0,
    highest_score_stand_count: 0,
    highest_bet_amount: 0,
    wins: 0,
    losses: 0,
    busts: 0,
    pushes: 0,
    blackjack_wins: 0,
    blackjack_losses: 0,
    highest_score_date: null
};

let currentRoundStats = {
    play_count: 0,
    hit_count: 0,
    stand_count: 0,
    is_blackjack_win_round: false,
    is_blackjack_loss_round: false
};



loginButton.addEventListener('click', async () => {
    const nickname = nicknameInput.value;
    const password = passwordInput.value;

    if (!nickname || !password) {
        alert('Please enter a nickname and password.');
        return;
    }

    if (password.length < 4) {
        alert('Password must be at least 4 characters long.');
        return;
    }

    let processedPassword = password;
    if (processedPassword.length < 6) {
        processedPassword += '00'; // Append two characters to meet the 6-character requirement
    }

    const email = `${nickname}@example.com`; // Supabase requires an email for auth

    // Try to sign in
    let { data, error } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: processedPassword,
    });

    if (error) {
        alert(`Error signing in: ${error.message}`);
        return;
    } else {
        alert('Login successful!');
        loginContainer.style.display = 'none';
        mainMenuContainer.style.display = 'block';
        alwaysOnDisplay.style.display = 'block'; // Show always-on display on login

        // Load player stats for existing user
        const { data: stats, error: fetchError } = await supabaseClient
            .from('player_stats')
            .select('*')
            .eq('user_id', data.user.id)
            .maybeSingle();

        if (fetchError) {
            console.error('Error fetching player stats:', fetchError);
        } else if (stats === null) {
            console.log('No existing player stats found, creating new ones.');
            const { data: newStats, error: insertError } = await supabaseClient
                .from('player_stats')
                .insert([
                    {
                        user_id: data.user.id,
                        last_login_at: new Date().toISOString(),
                        highest_score: 0,
                        highest_score_play_count: 0,
                        highest_score_hit_count: 0,
                        highest_score_stand_count: 0,
                        highest_bet_amount: 0,
                        wins: 0,
                        losses: 0,
                        busts: 0,
                        pushes: 0,
                        blackjack_wins: 0,
                        blackjack_losses: 0,
                        highest_score_date: new Date().toISOString(),
                        nickname: nickname,
                        current_coins: 1000 // Initialize current_coins for new user
                    }
                ]);
            if (insertError) {
                console.error('Error inserting new player stats for existing user:', insertError);
            } else if (newStats && newStats.length > 0) {
                currentPlayerStats = newStats[0];
                playerCoins = currentPlayerStats.current_coins; // Set playerCoins from loaded current_coins
                updatePlayerCoins(); // Update displayed coins
            } else {
                console.warn('No data returned after inserting new player stats for existing user. This might indicate an RLS policy issue or a misconfiguration.');
                // Fallback: Initialize with default values if no stats are returned
                currentPlayerStats = {
                    last_login_at: new Date().toISOString(),
                    highest_score: 0,
                    highest_score_play_count: 0,
                    highest_score_hit_count: 0,
                    highest_score_stand_count: 0,
                    highest_bet_amount: 0,
                    wins: 0,
                    losses: 0,
                    busts: 0,
                    pushes: 0,
                    blackjack_wins: 0,
                    blackjack_losses: 0,
                    highest_score_date: new Date().toISOString(),
                    nickname: nickname,
                    current_coins: 1000
                };
                playerCoins = currentPlayerStats.current_coins;
                updatePlayerCoins(); // Update displayed coins
            }
        } else {
            currentPlayerStats = stats;
            playerCoins = currentPlayerStats.current_coins; // Set playerCoins from loaded current_coins
            updatePlayerCoins(); // Update displayed coins
            // Update last login time and nickname
            const { error: updateError } = await supabaseClient
                .from('player_stats')
                .update({ last_login_at: new Date().toISOString(), nickname: nickname, current_coins: playerCoins }) // Also update current_coins on login
                .eq('user_id', data.user.id);
            if (updateError) {
            console.error('Error updating last login time:', updateError);
            }
        }
    }
});

signupButton.addEventListener('click', async () => {
    console.log('Sign Up button clicked');
    const nickname = nicknameInput.value;
    const password = passwordInput.value;

    if (!nickname || !password) {
        alert('닉네임과 비밀번호를 입력해주세요.');
        return;
    }

    if (password.length < 4) {
        passwordShortModal.classList.add('show');
        return;
    }

    // 닉네임 중복 확인
    const { data: existingUsers, error: fetchError } = await supabaseClient
        .from('player_stats')
        .select('nickname')
        .eq('nickname', nickname);

    if (fetchError) {
        console.error('닉네임 중복 확인 중 오류 발생:', fetchError);
        alert('회원가입 중 오류가 발생했습니다.');
        return;
    }

    if (existingUsers && existingUsers.length > 0) {
        nicknameExistsModal.classList.add('show');
        return;
    }

    let processedPassword = password;
    if (processedPassword.length < 6) {
        processedPassword += '00'; // Supabase 최소 길이 6자리를 맞추기 위해 00 추가
    }

    const email = `${nickname}@example.com`; // Supabase 인증을 위해 이메일 형식 필요

    const { data: signUpData, error: signUpError } = await supabaseClient.auth.signUp({
        email: email,
        password: processedPassword,
        options: {
            data: {
                nickname: nickname,
            }
        }
    });

    if (signUpError) {
        alert(`회원가입 중 오류 발생: ${signUpError.message}`);
        return;
    }

    // Initialize player stats for new user
    const { data: newStats, error: insertError } = await supabaseClient
        .from('player_stats')
        .insert([
            {
                user_id: signUpData.user.id,
                last_login_at: new Date().toISOString(),
                highest_score: 0,
                highest_score_play_count: 0,
                highest_score_hit_count: 0,
                highest_score_stand_count: 0,
                highest_bet_amount: 0,
                wins: 0,
                losses: 0,
                busts: 0,
                pushes: 0,
                blackjack_wins: 0,
                blackjack_losses: 0,
                highest_score_date: new Date().toISOString(),
                nickname: nickname,
                current_coins: 1000 // Initialize current_coins for new user
            }
        ]);
    if (insertError) {
        console.error('Error inserting new player stats:', insertError);
        alert('회원가입 중 오류가 발생했습니다. 다시 시도해주세요.');
        return;
    }

    console.log('Supabase insert data:', newStats);
    console.log('Supabase insert error:', insertError);

    if (newStats && newStats.length > 0) {
        currentPlayerStats = newStats[0];
    } else {
        console.warn('No data returned after inserting new player stats. This might indicate an RLS policy issue or a misconfiguration.');
    }

    console.log('Attempting to show signup success modal');
    signupSuccessModal.classList.add('show');
    // 회원가입 성공 후 로그인 화면으로 돌아가거나, 바로 로그인 처리
    // 여기서는 로그인 화면으로 돌아가도록 처리
    nicknameInput.value = '';
    passwordInput.value = '';
});

closePasswordShortModal.addEventListener('click', () => {
    passwordShortModal.classList.remove('show');
});

closeNicknameExistsModal.addEventListener('click', () => {
    nicknameExistsModal.classList.remove('show');
});

closeSignupSuccessModal.addEventListener('click', () => {
    signupSuccessModal.classList.remove('show');
    loginContainer.style.display = 'block'; // 회원가입 성공 후 로그인 화면으로 이동
    mainMenuContainer.style.display = 'none';
});


const playButton = document.getElementById('play-button');
const personalScoreButton = document.getElementById('personal-score-button');
const rankingButton = document.getElementById('ranking-button');
const logoutButton = document.getElementById('logout-button');
const mineCoinButton = document.getElementById('mine-coin-button');
const miningContainer = document.getElementById('mining-container');
const mineButton = document.getElementById('mine-button');
const backToMainButton = document.getElementById('back-to-main-button');

const alwaysOnDisplay = document.getElementById('always-on-display');
const alwaysOnCoinsSpan = document.getElementById('always-on-coins');

playButton.addEventListener('click', () => {
    mainMenuContainer.style.display = 'none';
    gameWrapper.style.display = 'block';
});

logoutButton.addEventListener('click', async () => {
    const { error } = await supabaseClient.auth.signOut();
    if (error) {
        console.error('Error logging out:', error.message);
        alert('로그아웃 중 오류가 발생했습니다.');
    } else {
        alert('로그아웃 되었습니다.');
        mainMenuContainer.style.display = 'none';
        loginContainer.style.display = 'block';
        alwaysOnDisplay.style.display = 'none'; // Hide always-on display on logout
        // Clear input fields
        nicknameInput.value = '';
        passwordInput.value = '';
        resetGame(); // Reset game state after logout
    }
});

mineCoinButton.addEventListener('click', () => {
    mainMenuContainer.style.display = 'none';
    miningContainer.style.display = 'block';
});

let isMiningCooldown = false;
mineButton.addEventListener('click', async () => {
    if (isMiningCooldown) return;

    isMiningCooldown = true;
    mineButton.disabled = true; // Disable button immediately

    playerCoins += 1;
    updatePlayerCoins();
    await updatePlayerStats(); // Save updated coins to Supabase

    setTimeout(() => {
        isMiningCooldown = false;
        mineButton.disabled = false; // Re-enable button after cooldown
    }, 100); // 0.1 second cooldown
});

backToMainButton.addEventListener('click', () => {
    miningContainer.style.display = 'none';
    mainMenuContainer.style.display = 'block';
});
const suits = ['♠', '♥', '♦', '♣'];
const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

let deck = [];
let playerHand = [];
let dealerHand = [];
let gameOver = true;

const playerArea = document.getElementById('player-cards');
const dealerArea = document.getElementById('dealer-cards');
const playerScoreSpan = document.getElementById('player-score');
const dealerScoreSpan = document.getElementById('dealer-score');
const hitButton = document.getElementById('hit-button');
const standButton = document.getElementById('stand-button');
const newGameButton = document.getElementById('new-game-button');
const resultMessage = document.getElementById('result-message');

let playerCoins = 1000;
let currentBet = 100;
let betUnit = 100;

const playerCoinsSpan = document.getElementById('player-coins');
const betAmountSpan = document.getElementById('bet-amount');
const dealButton = document.getElementById('deal-button');
const decreaseBetBtn = document.getElementById('decrease-bet-btn');
const increaseBetBtn = document.getElementById('increase-bet-btn');
const unitBtns = document.querySelectorAll('.unit-btn');

const quitGameButton = document.getElementById('quit-game-button');
const quitModal = document.getElementById('quit-modal');
const confirmQuitButton = document.getElementById('confirm-quit-button');
const cancelQuitButton = document.getElementById('cancel-quit-button');

// --- Game Logic ---
function newGame() {
    createDeck();
    currentRoundStats = {
        play_count: 1,
        hit_count: 0,
        stand_count: 0,
        is_blackjack_win_round: false,
        is_blackjack_loss_round: false
    };
    // Add a delay before dealing initial hands
    setTimeout(() => {
        dealInitialHands();
    }, 500); // 500ms delay
}

function placeBet() {
    if (currentBet > playerCoins) {
        resultMessage.textContent = 'Not enough coins!';
        return;
    }
    if (currentBet <= 0) {
        resultMessage.textContent = 'Please enter a valid bet amount.';
        return;
    }

    playerCoins -= currentBet;
    updatePlayerCoins();

    dealButton.disabled = true;
    decreaseBetBtn.disabled = true;
    increaseBetBtn.disabled = true;
    unitBtns.forEach(btn => btn.disabled = true);

    newGame();

    // Update highest bet amount
    if (currentBet > currentPlayerStats.highest_bet_amount) {
        currentPlayerStats.highest_bet_amount = currentBet;
    }
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
    const playerScore = calculateScore(playerHand);
    const dealerScore = calculateScore(dealerHand);

    if (playerScore === 21 && playerHand.length === 2) {
        if (dealerScore === 21 && dealerHand.length === 2) {
            resultMessage.textContent = "It's a push! Both have Blackjack!";
            gameOver = true;
            revealDealerCard();
            playerPush();
            currentRoundStats.is_blackjack_win_round = false; // Not a win, it's a push
            currentRoundStats.is_blackjack_loss_round = false; // Not a loss
        } else {
            resultMessage.textContent = 'Blackjack! Player wins!';
            gameOver = true;
            revealDealerCard();
            playerWins(true);
            currentRoundStats.is_blackjack_win_round = true;
            currentRoundStats.is_blackjack_loss_round = false;
        }
    } else if (dealerScore === 21 && dealerHand.length === 2) {
        resultMessage.textContent = 'Dealer has Blackjack! Dealer wins!';
        gameOver = true;
        revealDealerCard();
        currentRoundStats.is_blackjack_win_round = false;
        currentRoundStats.is_blackjack_loss_round = true;
    }
    updateButtons();
}

function playerHit() {
    if (gameOver) return;
    currentRoundStats.hit_count++;
    dealCard(playerHand, playerArea);
    updateScores();
    if (calculateScore(playerHand) > 21) {
        resultMessage.textContent = 'Player busts! Dealer wins!';
        gameOver = true;
        revealDealerCard();
        currentPlayerStats.busts++;
        updatePlayerStats();
    }
    updateButtons();
}

function playerStand() {
    if (gameOver) return;
    currentRoundStats.stand_count++;
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
        currentPlayerStats.losses++;
    } else if (dealerScore > 21) {
        resultMessage.textContent = 'Dealer busts! Player wins!';
        playerWins(false);
    } else if (playerScore > dealerScore) {
        resultMessage.textContent = 'Player wins!';
        playerWins(false);
    } else if (dealerScore > playerScore) {
        resultMessage.textContent = 'Dealer wins!';
        currentPlayerStats.losses++;
    } else {
        resultMessage.textContent = "It's a push!";
        playerPush();
    }

    // Update highest score (now tracking coins) and related stats
    if (playerCoins > currentPlayerStats.highest_score) {
        currentPlayerStats.highest_score = playerCoins;
        currentPlayerStats.highest_score_play_count = currentRoundStats.play_count;
        currentPlayerStats.highest_score_hit_count = currentRoundStats.hit_count;
        currentPlayerStats.highest_score_stand_count = currentRoundStats.stand_count;
        currentPlayerStats.highest_score_date = new Date().toISOString();
    }

    // Update blackjack wins/losses
    if (currentRoundStats.is_blackjack_win_round) {
        currentPlayerStats.blackjack_wins++;
    }
    if (currentRoundStats.is_blackjack_loss_round) {
        currentPlayerStats.blackjack_losses++;
    }

    updatePlayerStats(); // Save stats to Supabase

    if (playerCoins === 0) {
        resultMessage.textContent = "Game Over! You are out of coins.";
        dealButton.disabled = true;
        showGameOverModal();
    }
}

function showGameOverModal() {
    const gameOverModal = document.getElementById('game-over-modal');
    gameOverModal.classList.add('show');
}

function resetGame() {
    deck = [];
    playerHand = [];
    dealerHand = [];
    gameOver = true; // Reset gameOver to true to allow new game to start
    playerArea.innerHTML = '';
    dealerArea.innerHTML = '';
    resultMessage.textContent = '';
    playerCoins = currentPlayerStats.current_coins; // Reset coins for new game from current_coins
    currentBet = 100;
    betUnit = 100;
    updatePlayerCoins();
    updateButtons();
}

async function updatePlayerStats() {
    const { data: user } = await supabaseClient.auth.getUser();
    if (user) {
        const { error } = await supabaseClient
            .from('player_stats')
            .update(currentPlayerStats)
            .eq('user_id', user.user.id);
        if (error) {
            console.error('Error updating player stats:', error);
        }
    }
}

function playerWins(isBlackjack) {
    if (isBlackjack) {
        playerCoins += currentBet * 2.5;
        currentPlayerStats.wins++;
    } else {
        playerCoins += currentBet * 2;
        currentPlayerStats.wins++;
    }
    updatePlayerCoins();
}

function playerPush() {
    playerCoins += currentBet;
    currentPlayerStats.pushes++;
    updatePlayerCoins();
}

function updatePlayerCoins() {
    playerCoinsSpan.textContent = playerCoins;
    betAmountSpan.textContent = currentBet;
    alwaysOnCoinsSpan.textContent = playerCoins; // Update always-on display

    // Update currentPlayerStats.current_coins to reflect the latest playerCoins
    currentPlayerStats.current_coins = playerCoins;
}

function updateButtons() {
    const gameIsOver = gameOver;
    hitButton.disabled = gameIsOver;
    standButton.disabled = gameIsOver;

    // Betting controls should be enabled when the game is over (gameIsOver is true)
    // And disabled when the game is in progress (gameIsOver is false)
    dealButton.disabled = !gameIsOver || currentBet > playerCoins || currentBet === 0 || (playerCoins === 0);
    decreaseBetBtn.disabled = !gameIsOver;
    increaseBetBtn.disabled = !gameIsOver;
    unitBtns.forEach(btn => btn.disabled = !gameIsOver);

    if (playerCoins === 0 && gameIsOver) {
        resultMessage.textContent = "Game Over! You are out of coins.";
        dealButton.disabled = true;
    }
}


function changeBet(amount) {
    let newBet = currentBet + amount;
    if (newBet < 0) newBet = 0;
    if (newBet > playerCoins) newBet = playerCoins;
    currentBet = newBet;
    updatePlayerCoins();
    updateButtons();
}

// --- Event Listeners ---
quitGameButton.addEventListener('click', () => {
    quitModal.classList.add('show');
});

confirmQuitButton.addEventListener('click', async () => {
    quitModal.classList.remove('show');
    gameWrapper.style.display = 'none';
    mainMenuContainer.style.display = 'block';

    // Save stats if user is logged in
    const { data: user } = await supabaseClient.auth.getUser();
    if (user.user) {
        await updatePlayerStats();
    }

    resetGame();
});

cancelQuitButton.addEventListener('click', () => {
    quitModal.classList.remove('show');
});

hitButton.addEventListener('click', playerHit);
standButton.addEventListener('click', playerStand);
dealButton.addEventListener('click', placeBet);

decreaseBetBtn.addEventListener('click', () => changeBet(-betUnit));
increaseBetBtn.addEventListener('click', () => changeBet(betUnit));

unitBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        if (unitBtns) {
            unitBtns.forEach(b => b.classList.remove('active'));
        }
        btn.classList.add('active');
        betUnit = parseInt(btn.dataset.unit);
    });
});

const gameOverModal = document.getElementById('game-over-modal');
const goToMainButton = document.getElementById('go-to-main-button');
const restartGameButton = document.getElementById('restart-game-button');

const personalScoreModal = document.getElementById('personal-score-modal');
const closePersonalScoreButton = document.getElementById('close-personal-score-button');

const rankingModal = document.getElementById('ranking-modal');
const closeRankingButton = document.getElementById('close-ranking-button');
const rankingList = document.getElementById('ranking-list');

goToMainButton.addEventListener('click', async () => {
    gameOverModal.classList.remove('show');
    gameWrapper.style.display = 'none';
    mainMenuContainer.style.display = 'block';

    // Save stats if user is logged in
    const { data: user } = await supabaseClient.auth.getUser();
    if (user.user) {
        await updatePlayerStats();
    }

    resetGame();
});

restartGameButton.addEventListener('click', async () => {
    gameOverModal.classList.remove('show');
    // Save stats if user is logged in
    const { data: user } = await supabaseClient.auth.getUser();
    if (user.user) {
        await updatePlayerStats();
    }

    resetGame();
    newGame(); // Start a new game after resetting
});

personalScoreButton.addEventListener('click', () => {
    // Populate and show personal score modal
    document.getElementById('stat-highest-score').textContent = currentPlayerStats.highest_score;
    document.getElementById('stat-highest-score-play-count').textContent = currentPlayerStats.highest_score_play_count;
    document.getElementById('stat-highest-score-hit-count').textContent = currentPlayerStats.highest_score_hit_count;
    document.getElementById('stat-highest-score-stand-count').textContent = currentPlayerStats.highest_score_stand_count;
    document.getElementById('stat-highest-score-date').textContent = currentPlayerStats.highest_score_date ? new Date(currentPlayerStats.highest_score_date).toLocaleString() : 'N/A';
    document.getElementById('stat-highest-bet-amount').textContent = currentPlayerStats.highest_bet_amount;
    document.getElementById('stat-wins').textContent = currentPlayerStats.wins;
    document.getElementById('stat-losses').textContent = currentPlayerStats.losses;
    document.getElementById('stat-busts').textContent = currentPlayerStats.busts;
    document.getElementById('stat-pushes').textContent = currentPlayerStats.pushes;
    document.getElementById('stat-blackjack-wins').textContent = currentPlayerStats.blackjack_wins;
    document.getElementById('stat-blackjack-losses').textContent = currentPlayerStats.blackjack_losses;
    document.getElementById('stat-last-login-at').textContent = currentPlayerStats.last_login_at ? new Date(currentPlayerStats.last_login_at).toLocaleString() : 'N/A';
    document.getElementById('stat-current-coins').textContent = currentPlayerStats.current_coins;
    document.getElementById('player-coins').textContent = currentPlayerStats.current_coins; // Display current coins in personal stats

    personalScoreModal.classList.add('show');
});

closePersonalScoreButton.addEventListener('click', () => {
    personalScoreModal.classList.remove('show');
});

rankingButton.addEventListener('click', async () => {
    // Fetch all user stats and display in ranking modal
    const { data: allStats, error } = await supabaseClient
        .from('player_stats')
        .select('nickname, highest_score, wins, losses, busts, current_coins')
        .order('current_coins', { ascending: false }); // Order by current coins descending

    if (error) {
        console.error('Error fetching all player stats:', error);
        rankingList.innerHTML = '<p>랭킹을 불러오는 데 실패했습니다.</p>';
        return;
    }

    rankingList.innerHTML = ''; // Clear previous ranking
    if (allStats.length === 0) {
        rankingList.innerHTML = '<p>아직 랭킹 데이터가 없습니다.</p>';
    } else {
        const ul = document.createElement('ul');
        allStats.forEach((stat, index) => {
            const li = document.createElement('li');
            li.textContent = `${index + 1}. ${stat.nickname} - 현재 코인: ${stat.current_coins} (승: ${stat.wins}, 패: ${stat.losses}, 버스트: ${stat.busts})`;
            ul.appendChild(li);
        });
        rankingList.appendChild(ul);
    }

    rankingModal.classList.add('show');
});

closeRankingButton.addEventListener('click', () => {
    rankingModal.classList.remove('show');
});

// Initial game setup
updatePlayerCoins();
updateButtons();
});