require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const connectDB = require("./src/config/db.config");
const scoreRoutes = require("./src/routes/score.routes");
const dashboardRoutes = require("./src/routes/dashboard.routes");

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración CORS mejorada para producción
const corsOptions = {
  origin: [
    'http://localhost:3000', // Para desarrollo local
    'http://localhost:5178',  // Para desarrollo local del frontend
    /^https:\/\/.*\.cloudfront\.net$/, // Permite cualquier subdominio de CloudFront
    /^https:\/\/.*\.amazonaws\.com$/, // Permite S3 directo si es necesario
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-requested-with'],
  optionsSuccessStatus: 200
};

app.use(express.json());
app.use(cors(corsOptions));

connectDB();

const userRoutes = require("./src/routes/user.routes");
app.use("/api/users", userRoutes);
app.use("/api/scores", scoreRoutes);
app.use("/api/dashboard", dashboardRoutes);

app.get("/", (req, res) => res.send("API OK"));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { 
    origin: [
      'http://localhost:3000',
      'http://localhost:5178',
      /^https:\/\/.*\.cloudfront\.net$/,
      /^https:\/\/.*\.amazonaws\.com$/
    ], 
    methods: ["GET", "POST"],
    credentials: true
  },
});

const Score = require("./src/models/score.model");

// 🎯 Socket.io para ranking en tiempo real de FocusUp
const dashboard = io.of("/dashboard");
// 🎯 Namespace para actualizaciones específicas de usuario
const userNs = io.of("/user");

function emitRankingUpdate() {
  // Emitir actualización de ranking a todos los dashboards conectados
  dashboard.emit("ranking-update", {
    timestamp: new Date(),
    message: "Ranking actualizado"
  });
}

dashboard.on("connection", (socket) => {
  console.log("📊 Dashboard FocusUp conectado:", socket.id);
  
  socket.on("dashboard-join", () => {
    console.log("📊 Dashboard se unió al ranking en tiempo real");
    emitRankingUpdate();
  });
  
  socket.on("disconnect", () => {
    console.log("📊 Dashboard desconectado:", socket.id);
  });
});

// 🎯 Función para emitir actualizaciones cuando se registra un nuevo score
function notifyNewScore(game, updatedUser) {
  emitRankingUpdate();
  if (updatedUser && updatedUser._id) {
    // Emitir estadísticas actualizadas al usuario específico
    userNs.to(updatedUser._id.toString()).emit("stats-updated", {
      totalGamesPlayed: updatedUser.totalGamesPlayed,
      bestOverallScore: updatedUser.bestOverallScore,
      averageAccuracy: updatedUser.averageAccuracy,
      lastPlayed: updatedUser.lastPlayed,
    });
  }
  console.log(`📊 Nuevo score registrado para el juego: ${game}`);
}

// Hacer la función disponible globalmente para el controlador
global.notifyNewScore = notifyNewScore;

// 🎯 Namespace de usuario: manejo de salas por usuario
userNs.on("connection", (socket) => {
  console.log("👤 Namespace /user conectado:", socket.id);
  socket.on("join-user-room", (userId) => {
    if (userId) {
      socket.join(userId.toString());
      console.log(`👤 Usuario ${userId} se unió a su sala personal`);
    }
  });
  socket.on("disconnect", () => {
    console.log("👤 Usuario desconectado del namespace /user:", socket.id);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Servidor corriendo en http://0.0.0.0:${PORT}`);
});
