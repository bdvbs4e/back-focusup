const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["player", "admin"], default: "player" },
    // Estadísticas del usuario para FocusUp
    totalGamesPlayed: { type: Number, default: 0 },
    bestOverallScore: { type: Number, default: 0 },
    averageAccuracy: { type: Number, default: 0 },
    lastPlayed: { type: Date }
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);