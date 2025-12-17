const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

// Importa nossa lógica de jogo
const GameManager = require('./GameManager');

const app = express();
app.use(cors());

const server = http.createServer(app);

// Configuração do Socket.io (permite conexão de qualquer lugar por enquanto)
const io = new Server(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

const onTimeout = () => {
    io.emit('turn_timeout', { message: 'Tempo Esgotado! Trocando turno...' });
    io.emit('update_game_status', game.getGameState());
}

// Instancia o Gerenciador do Jogo
const game = new GameManager(onTimeout);
// --- AQUI COMEÇA A MÁGICA DO REAL-TIME ---

io.on('connection', (socket) => {
    // 'socket.id' é um identificador único que o socket.io dá para cada navegador conectado
    console.log('Uma nova conexão tentou entrar:', socket.id);

    // Tenta adicionar o jogador no nosso gerenciador
    const result = game.addPlayer(socket.id);

        if (result.success) {
            // Se entrou, avisa APENAS esse usuário que ele conseguiu
            socket.emit('player_connected', { 
                myId: socket.id, 
                playerNumber: result.player.playerNumber 
            });

            // Avisa TODO MUNDO (broadcast) quantos jogadores tem agora
            io.emit('update_players', game.getGameState());

            // Marca esse jogador como "Pronto"
            socket.on('player_ready', () => {
                const allReady = game.playerReady(socket.id);
                // Avisa TODO MUNDO quantos jogadores estão prontos
                io.emit('update_players', game.getGameState());

                if (allReady) {
                    game.generateBoard(); // Isso já dispara o timer interno
                    io.emit('game_start', {
                        message: 'Valendo!',
                        gameState: game.getGameState()
                    });
                }
            });
                

            socket.on('flip_card', (cardId) => {
            if (!game.gameActive) return;

            // Passamos o socket.id para garantir que só o dono da vez joga
            const result = game.flipCard(cardId, socket.id);

            if (result.action === 'IGNORE') return;

            // Atualiza tabuleiro E placar (update_game_status é mais completo que update_board)
            io.emit('update_game_status', game.getGameState());

            if (result.action === 'MISMATCH') {
                setTimeout(() => {
                    game.resetFlippedCards();
                    game.nextTurn(); // Passa a vez porque errou
                    io.emit('update_game_status', game.getGameState());
                }, 1500); // 1.5s para ver o erro
            }
            
            if (result.action === 'GAME_OVER') {
                io.emit('game_over', game.getGameState());
            }
        });

        // Se encheu a sala (2 jogadores), avisa que vai começar
        if (game.isReady()) {
                const board = game.generateBoard(); // Isso já dispara o timer interno
                io.emit('game_start', { 
                    message: 'Jogo Iniciando!',
                    gameState: game.getGameState() 
                });
            }

    } else {
        // Se sala cheia, avisa o usuário e desconecta ele
        socket.emit('error_room_full', { message: result.message });
        socket.disconnect();
    }

    // Se o jogador fechar a aba
    socket.on('disconnect', () => {
        game.removePlayer(socket.id);
        io.emit('update_players', game.getGameState()); // Avisa quem sobrou
    });

    socket.on('flip_card', (cardId) => {
        if(!game.gameActive) return;
        const result = game.flipCard(cardId);

        if (result.action === 'IGNORE') return;

        // Avisa TODOS os jogadores sobre a carta virada
        io.emit('update_board', game.getGameState().board);
    
        // Se errou (MISMATCH), precisamos esperar um pouco e desvirar
        if (result.action === 'MISMATCH') {
            setTimeout(() => {
                game.resetFlippedCards();
                io.emit('update_board', game.getGameState().board);
            }, 1000); // Espera 1 segundo antes de desvirar
        }
    });
});

// Liga o servidor na porta 3000
server.listen(3000, () => {
    console.log('SERVIDOR RODANDO NA PORTA 3000');
    console.log('Esperando jogadores...');
});