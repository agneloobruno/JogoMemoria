class GameManager {
    constructor(onTurnTimeout) {
        this.players = [];
        this.maxPlayers = 2;
        this.readyPlayers = new Set();

        this.cards = [];
        this.gameActive = false;
        
        this.flippedCards = [];
        this.currentPlayerIndex = 0; // 0 = Jogador 1, 1 = Jogador 2
        this.turnTimer = null;       // O relógio do servidor
        this.turnStartTime = 0;      // Para calcular pontuação
        this.TURN_LIMIT = 15000;     // 15 segundos por jogada
        this.turnDeadLine = 0;    // Timestamp de quando a vez acaba
        
        // Callback para avisar o app.js que o tempo acabou
        this.onTurnTimeout = onTurnTimeout; 
    }

    addPlayer(id) {
        if (this.players.length >= this.maxPlayers) return { success: false, message: 'Sala cheia!' };
        
        const newPlayer = {
            id: id,
            score: 0, // Pontuação começa em 0
            playerNumber: this.players.length + 1
        };
        this.players.push(newPlayer);
        return { success: true, player: newPlayer };
    }

    removePlayer(id) {
        this.players = this.players.filter(p => p.id !== id);
        this.readyPlayers.delete(id);
        this.stopTurnTimer(); // Para o relógio se alguém sair
        this.gameActive = false;
    }

    playerReady(id) {
        const player = this.players.find(p => p.id === id);
        if (player) {
            player.isReady = true;
            this.readyPlayers.add(id);
        }
        return this.readyPlayers.size === this.maxPlayers;
    }

    generateBoard() {
        const icons = ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼'];
        let deck = [...icons, ...icons];
        deck.sort(() => Math.random() - 0.5);

        this.cards = deck.map((icon, index) => ({
            id: index, icon: icon, isFlipped: false, isMatched: false
        }));

        this.gameActive = true;
        this.currentPlayerIndex = 0; // Começa pelo Jogador 1
        this.startTurnTimer();       // Inicia o cronômetro do primeiro turno
        
        return this.cards;
    }

    // --- CONTROLE DE TEMPO ---
    startTurnTimer() {
        this.stopTurnTimer(); // Garante que não tem dois relógios rodando
        this.turnStartTime = Date.now(); // Marca a hora que começou
        this.turnDeadLine = Date.now() + this.TURN_LIMIT;

        // Configura o "Alarme" para daqui 15 segundos
        this.turnTimer = setTimeout(() => {
            console.log("Tempo esgotado!");
            this.nextTurn(); // Troca de jogador
            if (this.onTurnTimeout) this.onTurnTimeout(); // Avisa o app.js
        }, this.TURN_LIMIT);
    }

    stopTurnTimer() {
        if (this.turnTimer) clearTimeout(this.turnTimer);
    }

    nextTurn() {
        this.flippedCards = []; // Limpa cartas viradas (se houver)
        // Alterna entre 0 e 1 (se era 0 vira 1, se era 1 vira 0)
        this.currentPlayerIndex = this.currentPlayerIndex === 0 ? 1 : 0;
        this.startTurnTimer(); // Reinicia o relógio para o próximo
    }

    // --- LÓGICA DO CLIQUE ATUALIZADA ---
    flipCard(cardId, playerId) {
        // 1. Valida se é a vez desse jogador
        const currentPlayer = this.players[this.currentPlayerIndex];
        if (playerId !== currentPlayer.id) {
            return { action: 'IGNORE' }; // Não é sua vez!
        }

        const card = this.cards.find(c => c.id === cardId);
        if (!card || card.isFlipped || card.isMatched || this.flippedCards.length >= 2) {
            return { action: 'IGNORE' };
        }

        card.isFlipped = true;
        this.flippedCards.push(card);

        if (this.flippedCards.length === 1) {
            return { action: 'WAITING_SECOND_CARD' };
        }

        // --- VALIDAR PAR E CALCULAR PONTOS ---
        const card1 = this.flippedCards[0];
        const card2 = this.flippedCards[1];

        this.stopTurnTimer(); // Para o tempo enquanto processa o resultado

        if (card1.icon === card2.icon) {
            // ACERTOU!
            card1.isMatched = true;
            card2.isMatched = true;

            // Cálculo: Base 100 - (Segundos gastos * 5)
            // Ex: Gastou 2s -> 100 - 10 = 90 pontos
            const timeTaken = (Date.now() - this.turnStartTime) / 1000;
            const points = Math.max(10, Math.floor(100 - (timeTaken * 5))); 
            
            currentPlayer.score += points;
            
            this.flippedCards = [];
            this.startTurnTimer(); // Reinicia o tempo para ele jogar de novo (Regra: acertou, joga de novo)
            
            return { action: 'MATCH' };
        } else {
            // ERROU! (O nextTurn será chamado pelo app.js após o delay visual)
            return { action: 'MISMATCH' };
        }
    }

    resetFlippedCards() {
        this.flippedCards.forEach(card => card.isFlipped = false);
        this.flippedCards = [];
    }

    getGameState() {
        return {
            players: this.players,
            board: this.cards,
            gameActive: this.gameActive,
            currentPlayerId: this.players[this.currentPlayerIndex]?.id, // Quem joga agora?
            turnDeadline: Date.now() + this.TURN_LIMIT // Para o front mostrar barra de tempo
        };
    }
}

module.exports = GameManager;