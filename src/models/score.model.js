const mongoose = require("mongoose");

const scoreSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  game: { 
    type: String, 
    required: true,
    enum: ['attention', 'reaction', 'memory', 'numeric-memory', 'verbal-memory'] // Tipos de minijuegos
  },
  score: { 
    type: Number, 
    required: true,
    min: 0 
  },
  timeMs: { 
    type: Number, 
    required: true,
    min: 0 
  },
  accuracy: { 
    type: Number, 
    min: 0, 
    max: 100,
    default: 0 
  },
  difficulty: { 
    type: String, 
    enum: ['easy', 'medium', 'hard'], 
    default: 'medium' 
  },
  isSuspicious: { 
    type: Boolean, 
    default: false 
  },
  metadata: {
    deviceInfo: String,
    userAgent: String,
    ipAddress: String
  }
}, { 
  timestamps: true 
});

// Índices para optimizar consultas
scoreSchema.index({ userId: 1, createdAt: -1 });
scoreSchema.index({ game: 1, score: -1 });
scoreSchema.index({ game: 1, timeMs: 1 });

module.exports = mongoose.model("Score", scoreSchema);
