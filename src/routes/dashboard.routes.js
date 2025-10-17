// src/routes/dashboard.routes.js
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Score = require("../models/score.model");
const User = require("../models/user.model");

// 📊 Estadísticas del dashboard para FocusUp (basado en Score/User)
router.get("/stats", async (req, res) => {
  try {
    const [totalPlayers, totalScores] = await Promise.all([
      User.countDocuments({}),
      Score.countDocuments({}),
    ]);

    // Top jugadores por mejor puntaje (desempate por menor tiempo)
    const topPlayers = await Score.aggregate([
      { $match: { isSuspicious: false } },
      { $sort: { score: -1, timeMs: 1 } },
      {
        $group: {
          _id: "$userId",
          bestScore: { $first: "$score" },
          bestTimeMs: { $first: "$timeMs" },
          attempts: { $sum: 1 },
        },
      },
      { $sort: { bestScore: -1, bestTimeMs: 1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      {
        $project: {
          _id: 0,
          user: { $arrayElemAt: ["$user", 0] },
          bestScore: 1,
          bestTimeMs: 1,
          attempts: 1,
        },
      },
    ]);

    // Métricas por juego
    const gameStats = await Score.aggregate([
      { $match: { isSuspicious: false } },
      {
        $group: {
          _id: "$game",
          attempts: { $sum: 1 },
          avgScore: { $avg: "$score" },
          avgTimeMs: { $avg: "$timeMs" },
          players: { $addToSet: "$userId" },
        },
      },
      {
        $project: {
          _id: 0,
          game: "$_id",
          attempts: 1,
          avgScore: { $round: ["$avgScore", 2] },
          avgTimeMs: { $round: ["$avgTimeMs", 2] },
          uniquePlayers: { $size: "$players" },
        },
      },
      { $sort: { attempts: -1 } },
    ]);

    // Últimos intentos (actividad reciente)
    const recentScores = await Score.find({ isSuspicious: false })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate("userId", "name email");

    res.json({
      totals: { totalPlayers, totalScores },
      topPlayers,
      gameStats,
      recentScores: recentScores.map((s) => ({
        user: s.userId,
        game: s.game,
        score: s.score,
        timeMs: s.timeMs,
        accuracy: s.accuracy,
        createdAt: s.createdAt,
      })),
    });
  } catch (err) {
    console.error("Error en /dashboard/stats:", err);
    res.status(500).json({ error: "Error obteniendo estadísticas" });
  }
});

// 🛡️ GET /dashboard/suspicious - Obtener intentos sospechosos
router.get("/suspicious", async (req, res) => {
  try {
    const { limit = 50, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const suspiciousScores = await Score.find({ isSuspicious: true })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("userId", "name email");

    const totalSuspicious = await Score.countDocuments({ isSuspicious: true });

    res.json({
      scores: suspiciousScores,
      pagination: {
        total: totalSuspicious,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(totalSuspicious / parseInt(limit))
      }
    });
  } catch (err) {
    console.error("Error obteniendo intentos sospechosos:", err);
    res.status(500).json({ error: "Error obteniendo intentos sospechosos" });
  }
});

// 🛡️ PUT /dashboard/scores/:id/suspicious - Marcar/desmarcar como sospechoso
router.put("/scores/:id/suspicious", async (req, res) => {
  try {
    const { id } = req.params;
    const { isSuspicious } = req.body;

    if (typeof isSuspicious !== 'boolean') {
      return res.status(400).json({ error: 'isSuspicious debe ser un booleano' });
    }

    const score = await Score.findByIdAndUpdate(
      id,
      { isSuspicious },
      { new: true }
    ).populate("userId", "name email");

    if (!score) {
      return res.status(404).json({ error: 'Score no encontrado' });
    }

    res.json({
      message: `Score ${isSuspicious ? 'marcado como sospechoso' : 'desmarcado como sospechoso'}`,
      score
    });
  } catch (err) {
    console.error("Error actualizando estado sospechoso:", err);
    res.status(500).json({ error: "Error actualizando estado sospechoso" });
  }
});

// 📈 GET /dashboard/user/:id/progress - Datos para gráficas de progreso
router.get("/user/:id/progress", async (req, res) => {
  try {
    const { id } = req.params;
    const { game, days = 30 } = req.query;
    
    console.log(`📊 Obteniendo progreso para usuario ${id}, juego: ${game || 'todos'}, días: ${days}`);

    // Calcular fecha de inicio
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Construir filtro
    const filter = { 
      userId: id,
      createdAt: { $gte: startDate },
      isSuspicious: false
    };
    if (game) filter.game = game;

    // Obtener scores del usuario
    const scores = await Score.find(filter)
      .sort({ createdAt: 1 })
      .populate("userId", "name email");

    // Agrupar por fecha para gráfica de progreso
    const progressData = scores.reduce((acc, score) => {
      const date = score.createdAt.toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = {
          date,
          totalScore: 0,
          attempts: 0,
          avgAccuracy: 0,
          games: {}
        };
      }
      
      acc[date].totalScore += score.score;
      acc[date].attempts += 1;
      acc[date].avgAccuracy += score.accuracy || 0;
      
      if (!acc[date].games[score.game]) {
        acc[date].games[score.game] = { score: 0, attempts: 0 };
      }
      acc[date].games[score.game].score += score.score;
      acc[date].games[score.game].attempts += 1;
      
      return acc;
    }, {});

    // Calcular promedios
    Object.values(progressData).forEach(day => {
      day.avgScore = Math.round(day.totalScore / day.attempts);
      day.avgAccuracy = Math.round((day.avgAccuracy / day.attempts) * 100) / 100;
    });

    // Estadísticas generales del usuario
    const userStats = await Score.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(id), isSuspicious: false } },
      {
        $group: {
          _id: null,
          totalAttempts: { $sum: 1 },
          avgScore: { $avg: "$score" },
          bestScore: { $max: "$score" },
          avgAccuracy: { $avg: "$accuracy" },
          games: { $addToSet: "$game" }
        }
      }
    ]);

    const response = {
      progressData: Object.values(progressData),
      userStats: userStats[0] || {
        totalAttempts: 0,
        avgScore: 0,
        bestScore: 0,
        avgAccuracy: 0,
        games: []
      },
      scores: scores.slice(-20) // Últimos 20 intentos para tabla
    };
    
    console.log(`✅ Progreso obtenido para usuario ${id}: ${Object.values(progressData).length} días de datos`);
    res.json(response);
  } catch (err) {
    console.error("Error obteniendo progreso del usuario:", err);
    res.status(500).json({ error: "Error obteniendo progreso del usuario" });
  }
});

module.exports = router;
