const socket = io('http://localhost:3000');

// Elementos DOM
const lobbyScreen = document.getElementById('lobby-screen');
const gameScreen = document.getElementById('game-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const btnReady = document.getElementById('btn-ready');
const playerListDiv = document.getElementById('player-list');

const p1ScoreDiv = document.getElementById('p1-score');
const p2ScoreDiv = document.getElementById('p2-score');
const timerDiv = document.getElementById('timer');
const turnTextDiv = document.getElementById('turn-text');
const boardDiv = document.getElementById('game-board');
const statusDiv = document.getElementById('status-message');

let myId = null;
let timerInterval = null;

// --- EVENTOS DO LOBBY ---

socket.on('player_connected', (data) => {
    myId = data.myId;
    statusDiv.textContent = `Você é o Jogador ${data.playerNumber}`;
    statusDiv.style.backgroundColor = data.playerNumber === 1 ? '#2980b9' : '#e74c3c';
    document.title = `Jogador ${data.playerNumber}`;
});

socket.on('update_players', (gameState) => {
    const p1 = gameState.players.find(p => p.playerNumber === 1);
    const p2 = gameState.players.find(p => p.playerNumber === 2);

    let html = '';
    if (p1) html += `<p>🐶 Jogador 1: ${p1.isReady ? '✅ PRONTO' : '⏳ Aguardando...'}</p>`;
    if (p2) html += `<p>🐱 Jogador 2: ${p2.isReady ? '✅ PRONTO' : '⏳ Aguardando...'}</p>`;
    
    playerListDiv.innerHTML = html;

    // Só libera botão de pronto se tiver 2 jogadores
    if (gameState.players.length === 2) {
        document.getElementById('waiting-msg').textContent = "Todos na sala! Clique em Pronto.";
        btnReady.disabled = false;
    }
});

btnReady.onclick = () => {
    socket.emit('player_ready');
    btnReady.textContent = "Aguardando oponente...";
    btnReady.classList.add('ready');
    btnReady.disabled = true;
};

socket.on('error_room_full', (data) => {
    alert(data.message);
    statusDiv.textContent = "Sala Cheia!";
    statusDiv.style.backgroundColor = "red";
});

// --- EVENTOS DO JOGO ---

socket.on('game_start', (data) => {
    lobbyScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    statusDiv.textContent = data.message;
    updateUI(data.gameState);
});

socket.on('update_game_status', (gameState) => {
    updateUI(gameState);
});

socket.on('turn_timeout', () => {
    timerDiv.style.color = 'red';
});

// --- FIM DE JOGO ---
socket.on('game_over', (gameState) => {
    gameScreen.classList.add('hidden');
    gameOverScreen.classList.remove('hidden');

    const winner = gameState.winner;
    const myWinner = (winner && winner.id === myId);
    const winnerTextElement = document.getElementById('winner-text');
    
    // Define título
    if (winner) {
        if (myWinner) {
            winnerTextElement.textContent = "🎉 VOCÊ GANHOU!";
            winnerTextElement.style.color = "#2ecc71";
        } else {
            winnerTextElement.textContent = "💀 VOCÊ PERDEU!";
            winnerTextElement.style.color = "#e74c3c";
        }
    } else {
        winnerTextElement.textContent = "🤝 EMPATE!";
    }

    // Define placar com segurança
    const p1 = gameState.players.find(p => p.playerNumber === 1);
    const p2 = gameState.players.find(p => p.playerNumber === 2);
    
    // Evita erro se um jogador tiver saído (undefined)
    const score1 = p1 ? p1.score : '-';
    const score2 = p2 ? p2.score : '-';

    document.getElementById('final-scores').innerHTML = `
        <p>🐶 Jogador 1: ${score1} pts</p>
        <p>🐱 Jogador 2: ${score2} pts</p>
    `;
});

// --- FUNÇÕES AUXILIARES ---

function updateUI(gameState) {
    const p1 = gameState.players.find(p => p.playerNumber === 1);
    const p2 = gameState.players.find(p => p.playerNumber === 2);
    
    if(p1) p1ScoreDiv.textContent = `P1: ${p1.score}`;
    if(p2) p2ScoreDiv.textContent = `P2: ${p2.score}`;

    const isMyTurn = gameState.currentPlayerId === myId;
    const isP1Turn = gameState.currentPlayerId === p1?.id;

    if (isP1Turn) {
        p1ScoreDiv.classList.add('active-turn');
        p2ScoreDiv.classList.remove('active-turn');
        turnTextDiv.textContent = "VEZ DO JOGADOR 1";
    } else {
        p2ScoreDiv.classList.add('active-turn');
        p1ScoreDiv.classList.remove('active-turn');
        turnTextDiv.textContent = "VEZ DO JOGADOR 2";
    }

    if (isMyTurn) {
        boardDiv.classList.add('active');
        turnTextDiv.style.color = "#2ecc71";
        turnTextDiv.textContent += " (VOCÊ)";
    } else {
        boardDiv.classList.remove('active');
        turnTextDiv.style.color = "#e74c3c";
    }

    startVisualTimer(gameState.turnDeadline);
    renderBoard(gameState.board);
}

function startVisualTimer(deadline) {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        const now = Date.now();
        const timeLeft = Math.max(0, Math.ceil((deadline - now) / 1000));
        timerDiv.textContent = timeLeft + "s";
        if (timeLeft <= 5) timerDiv.style.color = "red";
        else timerDiv.style.color = "white";
        if (timeLeft === 0) clearInterval(timerInterval);
    }, 100);
}

function renderBoard(cards) {
    boardDiv.innerHTML = ''; 
    cards.forEach(card => {
        const cardElement = document.createElement('div');
        cardElement.classList.add('card');
        
        if (card.isFlipped || card.isMatched) {
            cardElement.classList.add('flipped');
            cardElement.textContent = card.icon;
            if (card.isMatched) cardElement.classList.add('matched');
        }

        // Importante: Só envia clique se a carta não estiver virada
        cardElement.onclick = () => {
            if (!card.isFlipped && !card.isMatched) {
                socket.emit('flip_card', card.id);
            }
        };
        boardDiv.appendChild(cardElement);
    });
}