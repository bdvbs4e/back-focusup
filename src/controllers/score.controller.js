const Score = require('../models/score.model');
const User = require('../models/user.model');

// POST /api/scores - Registrar nuevo puntaje
const createScore = async (req, res) => {
  try {
    const { userId, game, score, timeMs, accuracy, difficulty } = req.body;
    console.log('🎮 createScore payload:', { userId, game, score, timeMs, accuracy, difficulty });
    // Validaciones básicas
    if (!userId || !game || score === undefined || timeMs === undefined) {
      return res.status(400).json({ 
        error: 'Faltan campos requeridos: userId, game, score, timeMs' 
      });
    }

    // Verificar que el usuario existe
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Detección básica de trampas
    const isSuspicious = detectSuspiciousScore(score, timeMs, game);

    // Crear el puntaje
    const newScore = new Score({
      userId,
      game,
      score,
      timeMs,
      accuracy: accuracy || 0,
      difficulty: difficulty || 'medium',
      isSuspicious,
      metadata: {
        deviceInfo: req.headers['user-agent'] || 'unknown',
        ipAddress: req.ip || req.connection.remoteAddress
      }
    });

    await newScore.save();
    console.log('✅ Score guardado en colección scores:', newScore._id);

    // Actualizar estadísticas del usuario y obtener documento actualizado
    const updatedUser = await updateUserStats(userId, score, accuracy);
    if (!updatedUser) {
      console.warn('⚠️ No se pudo actualizar/obtener usuario para stats:', userId);
    } else {
      console.log('📊 userStats actualizadas:', {
        totalGamesPlayed: updatedUser.totalGamesPlayed,
        bestOverallScore: updatedUser.bestOverallScore,
        averageAccuracy: updatedUser.averageAccuracy,
        lastPlayed: updatedUser.lastPlayed,
      });
    }

    // Notificar al dashboard y al usuario en tiempo real (si está disponible)
    if (global.notifyNewScore) {
      global.notifyNewScore(game, updatedUser);
    }

    res.status(201).json({
      message: 'Puntaje registrado exitosamente',
      score: newScore,
      userStats: updatedUser ? {
        totalGamesPlayed: updatedUser.totalGamesPlayed,
        bestOverallScore: updatedUser.bestOverallScore,
        averageAccuracy: updatedUser.averageAccuracy,
        lastPlayed: updatedUser.lastPlayed
      } : null
    });

  } catch (error) {
    console.error('Error creando puntaje:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// GET /api/scores/user/:id - Historial del usuario
const getUserScores = async (req, res) => {
  try {
    const { id } = req.params;
    const { game, limit = 50 } = req.query;

    // Construir filtro
    const filter = { userId: id };
    if (game) filter.game = game;

    const scores = await Score.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate('userId', 'name email');

    // Obtener usuario y combinar estadísticas persistidas con agregadas
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const agg = await calculateUserStats(id, game);
    
    console.log(`📊 Estadísticas para usuario ${id}${game ? ` (juego: ${game})` : ' (general)'}:`, agg);
    
    // Si se filtra por juego específico, devolver solo estadísticas de ese juego
    // Si no hay filtro, devolver estadísticas generales del usuario
    const combinedStats = game ? {
      // Estadísticas específicas del juego
      totalAttempts: agg.totalAttempts || 0,
      bestScore: agg.bestScore || 0,
      averageAccuracy: agg.averageAccuracy || 0,
      bestTime: agg.bestTime || 0,
      averageTime: agg.averageTime || 0,
      averageScore: agg.averageScore || 0,
      lastPlayed: user.lastPlayed || null,
    } : {
      // Estadísticas generales del usuario
      totalAttempts: user.totalGamesPlayed || agg.totalAttempts || 0,
      bestScore: user.bestOverallScore || agg.bestScore || 0,
      averageAccuracy: user.averageAccuracy || agg.averageAccuracy || 0,
      bestTime: agg.bestTime || 0,
      averageTime: agg.averageTime || 0,
      averageScore: agg.averageScore || 0,
      lastPlayed: user.lastPlayed || null,
    };

    res.json({
      scores,
      stats: combinedStats,
    });

  } catch (error) {
    console.error('Error obteniendo puntajes del usuario:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// GET /api/scores/ranking - Top 10 por juego
const getRanking = async (req, res) => {
  try {
    const { game, limit = 10 } = req.query;

    if (!game) {
      return res.status(400).json({ error: 'Parámetro game es requerido' });
    }

    // Obtener mejores puntajes por usuario (evitar múltiples entradas del mismo usuario)
    const ranking = await Score.aggregate([
      { $match: { game, isSuspicious: false } },
      { $sort: { score: -1, timeMs: 1 } },
      {
        $group: {
          _id: '$userId',
          bestScore: { $first: '$$ROOT' },
          totalAttempts: { $sum: 1 }
        }
      },
      { $sort: { 'bestScore.score': -1, 'bestScore.timeMs': 1 } },
      { $limit: parseInt(limit) },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $project: {
          _id: 0,
          user: { $arrayElemAt: ['$user', 0] },
          score: '$bestScore.score',
          timeMs: '$bestScore.timeMs',
          accuracy: '$bestScore.accuracy',
          totalAttempts: 1,
          createdAt: '$bestScore.createdAt'
        }
      }
    ]);

    res.json({
      game,
      ranking,
      totalPlayers: ranking.length
    });

  } catch (error) {
    console.error('Error obteniendo ranking:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Función auxiliar: Detectar puntajes sospechosos
const detectSuspiciousScore = (score, timeMs, game) => {
  // Lógica básica de detección de trampas
  const suspiciousPatterns = {
    attention: score > 1000 && timeMs < 100, // Puntaje muy alto en tiempo muy bajo
    reaction: timeMs < 50, // Tiempo de reacción imposiblemente rápido
    memory: score > 500 && timeMs < 200, // Memoria perfecta en tiempo muy bajo
    focus: score > 800 && timeMs < 150 // Focus perfecto en tiempo muy bajo
  };

  return suspiciousPatterns[game] || false;
};

// Función auxiliar: Calcular estadísticas del usuario
const calculateUserStats = async (userId, game = null) => {
  const filter = { userId };
  if (game) filter.game = game;

  const stats = await Score.aggregate([
    { $match: filter },
    {
      $group: {
        _id: null,
        totalAttempts: { $sum: 1 },
        bestScore: { $max: '$score' },
        averageScore: { $avg: '$score' },
        bestTime: { $min: '$timeMs' },
        averageTime: { $avg: '$timeMs' },
        averageAccuracy: { $avg: '$accuracy' }
      }
    }
  ]);

  return stats[0] || {
    totalAttempts: 0,
    bestScore: 0,
    averageScore: 0,
    bestTime: 0,
    averageTime: 0,
    averageAccuracy: 0
  };
};

// Función auxiliar: Actualizar estadísticas del usuario
const updateUserStats = async (userId, score, accuracy) => {
  try {
    const user = await User.findById(userId);
    if (!user) return null;

    // Calcular acumulados eficientes
    const totals = await Score.aggregate([
      { $match: { userId: user._id } },
      {
        $group: {
          _id: null,
          totalGames: { $sum: 1 },
          bestScore: { $max: "$score" },
          avgAccuracy: { $avg: "$accuracy" }
        }
      }
    ]);

    const agg = totals[0] || { totalGames: 0, bestScore: 0, avgAccuracy: 0 };

    user.totalGamesPlayed = agg.totalGames;
    user.bestOverallScore = Math.max(agg.bestScore || 0, score || 0);
    user.averageAccuracy = Math.round((agg.avgAccuracy || 0) * 100) / 100;
    user.lastPlayed = new Date();
    await user.save();
    // devolver documento fresco (con valores actualizados) para evitar estados intermedios
    const fresh = await User.findById(user._id).lean();
    return fresh;
  } catch (error) {
    console.error('Error actualizando estadísticas del usuario:', error);
    return null;
  }
};

module.exports = {
  createScore,
  getUserScores,
  getRanking
};
