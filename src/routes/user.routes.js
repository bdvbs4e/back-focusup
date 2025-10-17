const express = require("express");
const router = express.Router();
const userController = require("../controllers/user.controller");

// Definición de endpoints
router.get("/", userController.getAllUsers);
router.get("/:id", userController.getUserById);
router.post("/", userController.createUser);
router.post("/admin", userController.createAdmin);
router.post("/login", userController.loginUser);

module.exports = router;
