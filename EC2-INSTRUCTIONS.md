# 🚀 Instrucciones de Deployment en EC2

## Archivos listos para subir a EC2:
- ✅ `server.js` - Servidor principal con CORS configurado
- ✅ `package.json` - Dependencias del proyecto
- ✅ `ecosystem.config.js` - Configuración para PM2
- ✅ `ec2-deploy.sh` - Script de deployment
- ✅ Carpeta `src/` - Código fuente del backend

## Pasos para deployment en EC2:

### 1. Subir archivos a EC2
```bash
# Subir toda la carpeta Back/ a tu instancia EC2
scp -r Back/ ec2-user@52.14.245.52:~/
```

### 2. Conectar a EC2
```bash
ssh ec2-user@52.14.245.52
```

### 3. En la instancia EC2, ejecutar:
```bash
cd Back
chmod +x ec2-deploy.sh
./ec2-deploy.sh
```

### 4. Iniciar el servidor (opción 1 - directo):
```bash
npm start
```

### 5. O usar PM2 (opción 2 - recomendado):
```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 startup
pm2 save
```

## Verificación:
- ✅ Servidor corriendo en puerto 3000
- ✅ Accesible desde: http://52.14.245.52:3000
- ✅ CORS configurado para CloudFront
- ✅ Socket.IO funcionando

## Troubleshooting:
- Verificar Security Groups (puerto 3000 abierto)
- Verificar que Node.js esté instalado
- Verificar logs con: `pm2 logs focusup-backend`
