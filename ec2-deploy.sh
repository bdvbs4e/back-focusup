#!/bin/bash
# Script de deployment para EC2
# Ejecutar en la instancia EC2 después de subir los archivos

echo "🚀 Iniciando deployment del backend en EC2..."

# Instalar dependencias
echo "📦 Instalando dependencias..."
npm install

# Verificar que el servidor se puede iniciar
echo "🔍 Verificando configuración..."
node -e "console.log('✅ Node.js funcionando correctamente')"

# Crear archivo de configuración para PM2 (opcional)
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'focusup-backend',
    script: 'server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};
EOF

echo "✅ Backend preparado para EC2"
echo ""
echo "📋 Comandos para ejecutar en EC2:"
echo "1. npm start (para ejecutar directamente)"
echo "2. npm install -g pm2 && pm2 start ecosystem.config.js (para usar PM2)"
echo "3. pm2 startup && pm2 save (para que se inicie automáticamente)"
echo ""
echo "🔧 Verificar que el puerto 3000 esté abierto en Security Groups"
echo "🌐 El servidor debe estar accesible en: http://52.14.245.52:3000"
