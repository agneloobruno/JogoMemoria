const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

// Importa nossa lógica de jogo
const GameManager = require('./GameManager');

const app = express();
app.use(cors());

const server = http.createServer(app);

// Configuração do Socket.io
const io = new Server(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

// Callback para quando o tempo acaba
const onTimeout = () => {
    io.emit('turn_timeout', { message: 'Tempo Esgotado! Trocando turno...' });
    // Precisamos de uma instancia global ou garantir que 'game' é acessível aqui.
    // Como 'game' é constante neste arquivo, o JS consegue acessar.
    io.emit('update_game_status', game.getGameState());
};

// Instancia o Gerenciador do Jogo
const game = new GameManager(onTimeout);

// --- AQUI COMEÇA A MÁGICA DO REAL-TIME ---

io.on('connection', (socket) => {
    console.log('Uma nova conexão tentou entrar:', socket.id);

    // Tenta adicionar o jogador
    const result = game.addPlayer(socket.id);

    if (result.success) {
        // 1. Avisa o jogador que ele entrou
        socket.emit('player_connected', { 
            myId: socket.id, 
            playerNumber: result.player.playerNumber 
        });

        // 2. Atualiza a lista de espera para todos
        io.emit('update_players', game.getGameState());

        // 3. Ouvinte: Jogador clicou em "Estou Pronto"
        socket.on('player_ready', () => {
            const allReady = game.playerReady(socket.id);
            
            // Avisa que alguém ficou pronto (muda status no lobby)
            io.emit('update_players', game.getGameState());

            // Se TODOS estiverem prontos, começa o jogo!
            if (allReady) {
                game.generateBoard(); 
                io.emit('game_start', {
                    message: 'Valendo!',
                    gameState: game.getGameState()
                });
            }
        });

        // 4. Ouvinte: Jogador clicou na carta
        socket.on('flip_card', (cardId) => {
            if (!game.gameActive) return;

            // Passamos o socket.id para garantir que só o dono da vez joga
            const actionResult = game.flipCard(cardId, socket.id);

            if (actionResult.action === 'IGNORE') return;

            // Atualiza tabuleiro E placar
            io.emit('update_game_status', game.getGameState());

            // Se errou, espera e desvira
            if (actionResult.action === 'MISMATCH') {
                setTimeout(() => {
                    game.resetFlippedCards();
                    game.nextTurn(); // Passa a vez
                    io.emit('update_game_status', game.getGameState());
                }, 1500); 
            }
            
            // Se acabou o jogo
            if (actionResult.action === 'GAME_OVER') {
                io.emit('game_over', game.getGameState());
            }
        });

    } else {
        // Se sala cheia
        socket.emit('error_room_full', { message: result.message });
        socket.disconnect();
    }

    // Se o jogador sair
    socket.on('disconnect', () => {
        const result = game.removePlayer(socket.id);

        if (result.action === 'WO_VICTORY') {
            // Se o jogo estava rolando, avisamos que acabou por abandono
            // Como removemos quem saiu, o winner é o único que sobrou no array players[0]
            const remainingPlayer = game.players[0];
            
            // Montamos um gameState falso de fim de jogo forçado
            const woState = {
                ...game.getGameState(),
                winner: remainingPlayer // Define o vencedor
            };
            
            io.emit('game_over', woState);
        } else {
            // Se estava no lobby, só atualiza a lista
            io.emit('update_players', game.getGameState());
        }
    });
});

// Liga o servidor
server.listen(3000, () => {
    console.log('SERVIDOR RODANDO NA PORTA 3000');
    console.log('Esperando jogadores...');
});