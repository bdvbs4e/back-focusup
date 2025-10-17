const express = require('express');
const router = express.Router();
const { createScore, getUserScores, getRanking } = require('../controllers/score.controller');

// POST /api/scores - Registrar nuevo puntaje
router.post('/', createScore);

// GET /api/scores/user/:id - Historial del usuario
router.get('/user/:id', getUserScores);

// GET /api/scores/ranking - Top 10 por juego
router.get('/ranking', getRanking);

module.exports = router;
