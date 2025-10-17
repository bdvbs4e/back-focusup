const User = require("../models/user.model");

// Obtener todos los usuarios
exports.getAllUsers = async () => {
  return await User.find().select("-password"); // 🔒 excluye el password
};

// Obtener usuario por ID
exports.getUserById = async (id) => {
  const user = await User.findById(id).select("-password");
  return user || { message: "Usuario no encontrado" };
};

// Crear usuario (puede ser player o admin)
exports.createUser = async (name, email, password, role = "player") => {
  try {
    const newUser = new User({ name, email, password, role });
    return await newUser.save();
  } catch (error) {
    throw new Error(error.message);
  }
};


// Crear administrador (usa la misma lógica pero forzando role)
exports.createAdmin = async (name, email, password) => {
  try {
    const newUser = new User({ name, email, password, role: "admin" });
    return await newUser.save();
  } catch (error) {
    throw new Error(error.message);
  }
};

// Login
exports.loginUser = async (email, password) => {
  try {
    const user = await User.findOne({ email, password });
    if (!user) {
      throw new Error("Credenciales inválidas");
    }

    // No devolvemos el password por seguridad
    const { password: _, ...userWithoutPassword } = user.toObject();
    return userWithoutPassword;
  } catch (error) {
    throw new Error(error.message);
  }
};
