class GameManager {
    constructor(onTurnTimeout) {
        this.players = [];
        this.maxPlayers = 2;
        this.readyPlayers = new Set();
        this.cards = [];
        this.gameActive = false;
        
        this.flippedCards = [];
        this.currentPlayerIndex = 0; 
        this.turnTimer = null;       
        this.turnStartTime = 0;      
        this.TURN_LIMIT = 15000;     
        this.turnDeadline = 0;
        
        this.onTurnTimeout = onTurnTimeout; 
    }

    addPlayer(id) {
        if (this.players.length >= this.maxPlayers) {
            return { success: false, message: 'Sala cheia!' };
        }
        
        // Verifica se o Jogador 1 já existe para atribuir o número correto
        const hasPlayer1 = this.players.some(p => p.playerNumber === 1);
        const assignedNumber = hasPlayer1 ? 2 : 1;

        const newPlayer = {
            id: id,
            score: 0,
            playerNumber: assignedNumber,
            isReady: false
        };
        
        this.players.push(newPlayer);
        // Ordena para garantir que P1 seja sempre o índice 0 e P2 o índice 1
        this.players.sort((a, b) => a.playerNumber - b.playerNumber);

        return { success: true, player: newPlayer };
    }

    removePlayer(id) {
        const playerIndex = this.players.findIndex(p => p.id === id);
        const wasGameActive = this.gameActive;

        if (playerIndex !== -1) {
            this.players.splice(playerIndex, 1);
            this.readyPlayers.delete(id);
        }

        if (wasGameActive) {
            this.stopTurnTimer();
            this.gameActive = false;
            return { action: 'WO_VICTORY' }; // Vitória por abandono
        }

        return { action: 'PLAYER_REMOVED' };
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
        this.currentPlayerIndex = 0;
        this.startTurnTimer();
        
        return this.cards;
    }

    startTurnTimer() {
        this.stopTurnTimer();
        this.turnStartTime = Date.now(); 
        this.turnDeadline = Date.now() + this.TURN_LIMIT;

        this.turnTimer = setTimeout(() => {
            console.log("Tempo esgotado! Trocando turno...");
            this.nextTurn();
            if (this.onTurnTimeout) this.onTurnTimeout();
        }, this.TURN_LIMIT);
    }

    stopTurnTimer() {
        if (this.turnTimer) clearTimeout(this.turnTimer);
    }

    nextTurn() {
        this.resetFlippedCards(); // Fecha as cartas abertas
        this.currentPlayerIndex = this.currentPlayerIndex === 0 ? 1 : 0;
        this.startTurnTimer();
    }

    flipCard(cardId, playerId) {
        const currentPlayer = this.players[this.currentPlayerIndex];
        
        if (!currentPlayer || playerId !== currentPlayer.id) {
            return { action: 'IGNORE' };
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

        const card1 = this.flippedCards[0];
        const card2 = this.flippedCards[1];

        this.stopTurnTimer();

        if (card1.icon === card2.icon) {
            card1.isMatched = true;
            card2.isMatched = true;

            const timeTaken = (Date.now() - this.turnStartTime) / 1000;
            const points = Math.max(10, Math.floor(100 - (timeTaken * 5))); 
            
            this.players[this.currentPlayerIndex].score += points;
            this.flippedCards = [];

            const allMatched = this.cards.every(c => c.isMatched);
            if (allMatched) {
                this.gameActive = false;
                return { action: 'GAME_OVER' };
            }

            this.startTurnTimer();
            return { action: 'MATCH' };
        } else {
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
            currentPlayerId: this.players[this.currentPlayerIndex]?.id,
            turnDeadline: this.turnDeadline,
            winner: this.getWinner()
        };
    }

    // --- CORREÇÃO PRINCIPAL AQUI ---
    getWinner() {
        // Se o jogo está ativo ou não tem jogadores, retorna nulo
        if (this.gameActive || !this.players || this.players.length === 0) return null;

        try {
            // Se sobrou só 1, ele ganhou (W.O)
            if (this.players.length === 1) return this.players[0];

            // Compara pontuação (CORRIGIDO: removemos o .apply que causava o erro)
            return this.players.reduce((prev, current) => {
                return (prev.score > current.score) ? prev : current;
            });
        } catch (error) {
            console.error("Erro ao calcular vencedor:", error);
            return this.players[0]; // Retorno de segurança
        }
    }
}

module.exports = GameManager;