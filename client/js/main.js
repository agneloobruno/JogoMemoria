// Conecta ao servidor rodando localmente
const socket = io('http://localhost:3000');

const statusDiv = document.getElementById('status-message');
const boardDiv = document.getElementById('game-board');
const p1ScoreDiv = document.getElementById('p1-score');
const p2ScoreDiv = document.getElementById('p2-score');
const turnDiv = document.getElementById('turn-indicator');

let myId = null;

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
    console.log('Jogo começou! Cartas recebidas:', data.board);
    
    statusDiv.textContent = data.message;
    infoDiv.textContent = "O jogo começou! Valide se as cartas são iguais nas duas telas.";
    
    renderBoard(data.board);
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

socket.on('turn_timeout', (data) => {
    alert(data.message); // Um alerta simples quando o tempo acaba
});

function updateUI(gameState) {
    // 1. Atualiza Placar
    const p1 = gameState.players.find(p => p.playerNumber === 1);
    const p2 = gameState.players.find(p => p.playerNumber === 2);
    
    if(p1) p1ScoreDiv.textContent = `P1: ${p1.score} pts`;
    if(p2) p2ScoreDiv.textContent = `P2: ${p2.score} pts`;

    // 2. Avisa de quem é a vez
    const isMyTurn = gameState.currentPlayerId === myId;
    
    // Destaca visualmente no placar
    if (gameState.currentPlayerId === p1?.id) {
        p1ScoreDiv.classList.add('active-turn');
        p2ScoreDiv.classList.remove('active-turn');
    } else {
        p2ScoreDiv.classList.add('active-turn');
        p1ScoreDiv.classList.remove('active-turn');
    }

    if (isMyTurn) {
        turnDiv.textContent = "SUA VEZ! 🟢";
        boardDiv.style.opacity = "1";
        boardDiv.style.pointerEvents = "auto"; // Libera cliques
    } else {
        turnDiv.textContent = "Vez do Oponente 🔴";
        boardDiv.style.opacity = "0.7"; // Deixa meio transparente
        boardDiv.style.pointerEvents = "none"; // BLOQUEIA CLIQUES (Importante!)
    }

    renderBoard(gameState.board);
}

// Função Auxiliar para desenhar o HTML das cartas
function renderBoard(cards) {
    boardDiv.innerHTML = ''; 

    cards.forEach(card => {
        const cardElement = document.createElement('div');
        cardElement.classList.add('card');
        
        // Se isFlipped (virada) ou isMatched (já achada), mostramos o conteúdo
        if (card.isFlipped || card.isMatched) {
            cardElement.classList.add('flipped');
            cardElement.textContent = card.icon;
            
            if (card.isMatched) {
                cardElement.classList.add('matched');
            }
        } else {
            // Se não, ela fica "escondida" (sem classe flipped e sem texto)
            cardElement.textContent = ''; 
        }

        // Adiciona evento de clique
        cardElement.onclick = () => {
            // Envia para o servidor qual ID foi clicado
            // Nota: parseInt garante que enviamos um número, não texto
            socket.emit('flip_card', card.id);
        };

        boardDiv.appendChild(cardElement);
    });
}

// Atualizar o tabuleiro quando o servidor envia update_board
socket.on('update_board', (board) => {
    renderBoard(board);
});