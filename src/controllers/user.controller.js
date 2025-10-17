const userService = require("../services/user.service");

exports.getAllUsers = async (req, res) => {
  const users = await userService.getAllUsers();
  res.json(users);
};

exports.getUserById = async (req, res) => {
  const { id } = req.params;
  const user = await userService.getUserById(id);
  res.json(user);
};

// Crear jugador normal
exports.createUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const newUser = await userService.createUser(name, email, password, "player");
    res.status(201).json(newUser);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Crear administrador explícito
exports.createAdmin = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const newAdmin = await userService.createUser(name, email, password, "admin");
    res.status(201).json(newAdmin);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Login (si quieres separar login de dashboard y app, puedes usar query param o endpoint diferente)
exports.loginUser = async (req, res) => {
  try {
    const { email, password, requireAdmin } = req.body;
    const user = await userService.loginUser(email, password);

    if (requireAdmin && user.role !== "admin") {
      return res.status(403).json({ error: "Acceso denegado: no eres administrador" });
    }

    res.json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
