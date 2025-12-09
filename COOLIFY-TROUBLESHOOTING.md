# Coolify Deployment - Troubleshooting

## Error: "container is not running"

Este es el error que estás experimentando:
```
Error response from daemon: container 0829e38877cc00286f2d2b2e24c9e55298e6f82219a7ce9c0370239caf44195d is not running
```

### Causas Comunes

1. **El contenedor helper de Coolify se detiene prematuramente**
2. **Problemas con el multi-stage build**
3. **Falta de recursos en el servidor**
4. **Timeout durante el build**

### Soluciones Implementadas

#### 1. Dockerfile Mejorado

El nuevo Dockerfile incluye:
- ✅ Instalación de dependencias de compilación necesarias (`python3`, `make`, `g++`)
- ✅ Uso de `curl` en lugar de `node` para health checks (más confiable)
- ✅ Usuario no-root (`node`) para mayor seguridad
- ✅ Script de inicio que maneja migraciones automáticamente
- ✅ Corrección del health check endpoint (`/health` en lugar de `/api/health`)

#### 2. Script de Inicio (`start.sh`)

El script de inicio:
- Ejecuta migraciones de Prisma automáticamente
- Maneja errores de forma elegante
- Inicia la aplicación de forma segura

### Pasos para Resolver el Error

#### Opción 1: Simplificar el Build (Recomendado)

Si el error persiste, intenta con un Dockerfile simplificado (single-stage):

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies
RUN apk add --no-cache python3 make g++ curl

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Create uploads directory
RUN mkdir -p ./uploads

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start application
CMD ["sh", "-c", "npx prisma migrate deploy || true && node dist/index.js"]
```

Para usar este Dockerfile simplificado:
1. Guarda el contenido anterior en un archivo llamado `Dockerfile.simple`
2. En Coolify, cambia **Dockerfile Path** a `./Dockerfile.simple`
3. Intenta desplegar nuevamente

#### Opción 2: Verificar Configuración de Coolify

1. **Verificar la Build Platform**:
   - En Coolify, ve a tu aplicación → **General**
   - Asegúrate de que **Build Platform** esté en `linux/amd64` o `linux/arm64` (según tu servidor)

2. **Incrementar Timeout de Build**:
   - En **Build Settings**
   - Aumenta **Build Timeout** a 600 segundos (10 minutos)

3. **Verificar Recursos del Servidor**:
   - Asegúrate de que tu servidor tenga al menos:
     - 2 GB de RAM disponible
     - 10 GB de espacio en disco
   - Ejecuta en el servidor:
     ```bash
     docker system df
     docker system prune -a
     ```

#### Opción 3: Build Manual

Si Coolify sigue fallando, puedes hacer build de la imagen manualmente:

```bash
# En tu máquina local o servidor
cd API

# Build de la imagen
docker build -t water-api:latest .

# Tag para tu registry
docker tag water-api:latest your-registry.com/water-api:latest

# Push al registry
docker push your-registry.com/water-api:latest
```

Luego en Coolify:
1. Cambia **Source** de Git a **Docker Image**
2. Usa la imagen que acabas de pushear

### Configuración Correcta en Coolify

#### Settings → General
- **Build Type**: Dockerfile
- **Dockerfile Path**: `./Dockerfile` (o `./Dockerfile.simple`)
- **Port**: `3000`
- **Health Check Path**: `/health` (no `/api/health`)

#### Settings → Environment Variables

```bash
# Database - CRÍTICO: Debe estar configurado
DATABASE_URL=postgresql://user:password@host:5432/water_management?schema=public

# JWT - CRÍTICO: Usar valores seguros en producción
JWT_SECRET=tu-secreto-super-seguro-de-al-menos-32-caracteres
JWT_REFRESH_SECRET=tu-secreto-refresh-super-seguro-de-al-menos-32-caracteres
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# Server
PORT=3000
NODE_ENV=production

# CORS - Actualizar con la URL real del frontend
CORS_ORIGIN=https://tu-frontend.coolify.app

# File uploads
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=5242880
```

#### Settings → Build Settings
- **Build Command**: (dejar vacío, usa Dockerfile)
- **Build Timeout**: 600 segundos
- **Post-Deployment Command**: (dejar vacío, las migraciones se ejecutan en start.sh)

### Verificación Post-Despliegue

Una vez desplegado exitosamente, verifica:

```bash
# Health check
curl https://tu-api.coolify.app/health

# Respuesta esperada:
{
  "status": "OK",
  "timestamp": "2025-12-09T...",
  "uptime": 123.45,
  "environment": "production"
}
```

### Logs Útiles

Para ver qué está pasando durante el build:

1. En Coolify, ve a tu aplicación
2. Ve a **Deployments**
3. Haz clic en el deployment fallido
4. Revisa los logs completos

Busca estos mensajes:
- ✅ `npm ci` completado
- ✅ `npx prisma generate` completado
- ✅ `npm run build` completado
- ❌ Errores de memoria (OOM)
- ❌ Timeouts
- ❌ Errores de permisos

### Si Nada Funciona

Como última opción, puedes usar **nixpacks** en lugar de Dockerfile:

1. En Coolify, cambia **Build Type** a `nixpacks`
2. Coolify detectará automáticamente que es una aplicación Node.js
3. Crea un archivo `nixpacks.toml` en la raíz del proyecto:

```toml
[phases.setup]
nixPkgs = ["nodejs-20_x"]

[phases.install]
cmds = ["npm ci"]

[phases.build]
cmds = [
  "npx prisma generate",
  "npm run build"
]

[start]
cmd = "npx prisma migrate deploy && node dist/index.js"
```

### Contacto con Coolify Support

Si el problema persiste:
1. Ve al Discord de Coolify: https://coolify.io/discord
2. Comparte:
   - Los logs completos del deployment
   - Tu Dockerfile
   - Las especificaciones de tu servidor

## Notas Adicionales

- **Migraciones**: El script `start.sh` ejecuta las migraciones automáticamente al iniciar
- **Health Check**: Asegúrate de que el path sea `/health` no `/api/health`
- **CORS**: Debe estar configurado correctamente o el frontend no podrá conectarse
- **DATABASE_URL**: Es crítico que esté configurado antes del primer despliegue
