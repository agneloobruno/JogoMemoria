// Conecta ao servidor rodando localmente
const socket = io('http://localhost:3000');

//Elementos do DOM
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
const turnDiv = document.getElementById('turn-indicator');

let myId = null;
let timerInterval = null;

//-- EVENTOS DO LOBBY --
socket.on('player_connected', (data) => {
    myId = data.myId; // Salva meu ID
    document.title = `Jogador ${data.playerNumber}`;
});

socket.on('update_players', (gameState) => {
    //Atualiza a lista de jogadores no lobby
    const p1 = gameState.players.find(p => p.playerNumber === 1);
    const p2 = gameState.players.find(p => p.playerNumber === 2);

    let html = '';
    if (p1) html += `<p>🐶 Jogador 1: ${p1.isReady ? '✅ PRONTO' : '⏳ Aguardando...'}</p>`;
    if (p2) html += `<p>🐱 Jogador 2: ${p2.isReady ? '✅ PRONTO' : '⏳ Aguardando...'}</p>`;

    playerListDiv.innerHTML = html;

    //Só libera o botão se tiver menos de 2 jogadores
    if (gameState.players.length === 2) {
        document.getElementById('waiting-msg').textContent = "Todos na sala! Clique em 'Pronto' quando estiver preparado.";
        btnReady.disabled = false;
    }
});

btnReady.onclick = () => {
    socket.emit('player_ready');
    btnReady.textContent = "Aguardando o outro jogador...";
    btnReady.classList.add('ready');
    btnReady.disabled = false;
};

// 1. Ao conectar, o servidor manda "player_connected" (definimos isso no app.js)
socket.on('player_connected', (data) => {
    console.log('Conectado com ID:', data.myId);
    statusDiv.textContent = `Você é o Jogador ${data.playerNumber}`;
    statusDiv.style.backgroundColor = data.playerNumber === 1 ? '#2980b9' : '#e74c3c';
});

// 2. Atualização de quantos jogadores tem na sala
socket.on('update_players', (gameState) => {
    if (!gameState.gameActive) {
        infoDiv.textContent = `Jogadores na sala: ${gameState.players.length}/2`;
    }
});

// 3. O GRANDE MOMENTO: O jogo começa!
socket.on('game_start', (data) => {
    // Troca de tela: Esconde Lobby, Mostra Jogo
    lobbyScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    
    updateUI(data.gameState);
});

// 4. Erro se a sala estiver cheia
socket.on('error_room_full', (data) => {
    alert(data.message);
    statusDiv.textContent = "Sala Cheia! Tente mais tarde.";
    statusDiv.style.backgroundColor = "red";
});

socket.on('player_connected', (data) => {
    myId = data.myId; // Salva meu ID
    statusDiv.textContent = `Você é o Jogador ${data.playerNumber}`;
    statusDiv.style.backgroundColor = data.playerNumber === 1 ? '#2980b9' : '#e74c3c';
});

// Evento unificado: Chega Placar, Vez e Tabuleiro tudo junto
socket.on('update_game_status', (gameState) => {
    updateUI(gameState);
});

socket.on('game_start', (data) => {
    statusDiv.textContent = data.message;
    updateUI(data.gameState);
});

socket.on('turn_timeout', () => {
    // Animação visual opcional de erro
    timerDiv.style.color = 'red';
});

socket.on('game_over', (gameState) => {
    // Troca de tela
    gameScreen.classList.add('hidden');
    gameOverScreen.classList.remove('hidden');

    const winner = gameState.winner;
    const myWinner = (winner && winner.id === myId);
    
    // VERIFICAÇÃO 1: Definir a mensagem de título
    const winnerTextElement = document.getElementById('winner-text');
    
    if (winner) {
        // Se temos menos de 2 jogadores, alguém saiu (W.O.)
        const isWO = gameState.players.length < 2; 

        if (myWinner) {
            winnerTextElement.textContent = isWO ? "🎉 VITÓRIA (Por W.O.)!" : "🎉 VOCÊ GANHOU!";
            winnerTextElement.style.color = "#2ecc71"; // Verde
        } else {
            winnerTextElement.textContent = "💀 VOCÊ PERDEU!";
            winnerTextElement.style.color = "#e74c3c"; // Vermelho
        }
    } else {
        winnerTextElement.textContent = "🤝 EMPATE!";
        winnerTextElement.style.color = "#f1c40f"; // Amarelo
    }

    // VERIFICAÇÃO 2: Mostrar placar com segurança (evita o erro undefined)
    const p1 = gameState.players.find(p => p.playerNumber === 1);
    const p2 = gameState.players.find(p => p.playerNumber === 2);
    
    // Usamos '?' (optional chaining) para não quebrar se o jogador não existir
    // Se o jogador saiu, mostramos "Saiu" em vez dos pontos
    const p1Score = p1 ? `${p1.score} pts` : '(Saiu da partida)';
    const p2Score = p2 ? `${p2.score} pts` : '(Saiu da partida)';

    document.getElementById('final-scores').innerHTML = `
        <p style="margin: 10px 0; font-size: 1.2em;">🐶 Jogador 1: <strong>${p1Score}</strong></p>
        <p style="margin: 10px 0; font-size: 1.2em;">🐱 Jogador 2: <strong>${p2Score}</strong></p>
    `;
});


// -- FUNÇÕES DE UI E TIMER -- 
function updateUI(gameState) {
    // 1. Renderiza Placar
    const p1 = gameState.players.find(p => p.playerNumber === 1);
    const p2 = gameState.players.find(p => p.playerNumber === 2);
    
    if(p1) p1ScoreDiv.textContent = `P1: ${p1.score}`;
    if(p2) p2ScoreDiv.textContent = `P2: ${p2.score}`;

    // 2. Controla de quem é a vez
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

    // 3. Bloqueio/Desbloqueio do Tabuleiro
    if (isMyTurn) {
        boardDiv.classList.add('active'); // Opacidade 1, cliques liberados
        turnTextDiv.style.color = "#2ecc71";
        turnTextDiv.textContent += " (VOCÊ)";
    } else {
        boardDiv.classList.remove('active'); // Opacidade 0.5, cliques bloqueados
        turnTextDiv.style.color = "#e74c3c";
    }

    // 4. Inicia Timer Visual
    startVisualTimer(gameState.turnDeadline);

    // 5. Desenha Cartas
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
    }, 100); // Atualiza a cada 100ms para ser fluido
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

        cardElement.onclick = () => socket.emit('flip_card', card.id);
        boardDiv.appendChild(cardElement);
    });
}