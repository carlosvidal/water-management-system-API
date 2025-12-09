# 🚀 Solución Rápida - Error de Despliegue

## Problema Actual

```
npm error The `npm ci` command can only install with an existing package-lock.json
```

## ✅ Solución Implementada

### 1. Archivo `.dockerignore` Corregido

**Cambio realizado**: Removido `package-lock.json` de `.dockerignore`

El archivo `package-lock.json` es **NECESARIO** para `npm ci` y ahora se incluirá en el build.

### 2. Configuración de NODE_ENV en Coolify

**IMPORTANTE**: En Coolify, necesitas ajustar la variable `NODE_ENV`:

#### Opción A: Desmarcar "Available at Buildtime" (Recomendado)

1. Ve a tu aplicación en Coolify
2. Ve a **Environment Variables**
3. Encuentra la variable `NODE_ENV`
4. **DESMARCA** la casilla "Available at Buildtime"
5. Déjala solo como "Runtime"

Esto permitirá que el Dockerfile use sus propios valores durante el build.

#### Opción B: Crear dos variables separadas

Si necesitas `NODE_ENV` durante el build:

1. Crea una variable:
   - **Key**: `NODE_ENV`
   - **Value**: `development`
   - **Available at Buildtime**: ✅ (marcado)
   - **Available at Runtime**: ❌ (desmarcado)

2. Crea otra variable:
   - **Key**: `NODE_ENV`
   - **Value**: `production`
   - **Available at Buildtime**: ❌ (desmarcado)
   - **Available at Runtime**: ✅ (marcado)

## 📋 Pasos para Desplegar

### 1. Hacer commit de los cambios

```bash
cd API
git add .dockerignore
git commit -m "Fix: Include package-lock.json for npm ci"
git push origin main
```

### 2. Configurar Coolify

#### En Environment Variables:

**Variables REQUERIDAS:**

```bash
# Database (CRÍTICO)
DATABASE_URL=postgresql://user:password@host:5432/water_management?schema=public

# JWT Secrets (CRÍTICO - genera valores seguros)
JWT_SECRET=tu-secreto-super-seguro-de-al-menos-32-caracteres-aqui
JWT_REFRESH_SECRET=tu-secreto-refresh-super-seguro-de-al-menos-32-caracteres-aqui

# JWT Config
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# Server
PORT=3000
NODE_ENV=production
  ⚠️ IMPORTANTE: Desmarca "Available at Buildtime" para NODE_ENV

# CORS (actualizar cuando tengas la URL del frontend)
CORS_ORIGIN=http://localhost:3000,http://localhost:5173

# File uploads
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=5242880
```

#### En Build Settings:

- **Build Type**: Dockerfile
- **Dockerfile Path**: `./Dockerfile.simple`
- **Port**: `3000`
- **Health Check Path**: `/health`

### 3. Desplegar

1. Haz clic en **Deploy** en Coolify
2. Espera a que el build complete
3. Verifica los logs

## 🔍 Verificación Post-Despliegue

### 1. Health Check

```bash
curl https://tu-api-url.coolify.app/health
```

**Respuesta esperada:**
```json
{
  "status": "OK",
  "timestamp": "2025-12-09T...",
  "uptime": 123.45,
  "environment": "production"
}
```

### 2. API Documentation

Visita: `https://tu-api-url.coolify.app/api-docs`

Deberías ver la documentación Swagger.

### 3. Test de Login

```bash
curl -X POST https://tu-api-url.coolify.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@aquaflow.com",
    "password": "Admin2024!"
  }'
```

## 🐛 Si Aún Falla

### Error: "package-lock.json not found"

Verifica que hiciste commit del cambio en `.dockerignore`:

```bash
cd API
git status
# Debe mostrar: nothing to commit, working tree clean
```

### Error: "devDependencies not installed"

Verifica que `NODE_ENV` NO esté marcado como "Available at Buildtime" en Coolify.

### Error: "Database connection failed"

1. Verifica que `DATABASE_URL` esté correctamente configurado
2. Asegúrate de que la base de datos esté accesible desde el contenedor
3. Si usas PostgreSQL de Coolify, usa la URL interna (no la pública)

### Ver Logs Detallados

1. En Coolify, ve a tu aplicación
2. **Deployments** → Último deployment
3. Haz clic en **Show Debug Logs**
4. Busca líneas con "ERROR" o "FAILED"

## 📊 Checklist Completo

- [ ] `.dockerignore` actualizado (sin `package-lock.json`)
- [ ] Cambios commiteados y pusheados
- [ ] `NODE_ENV` en Coolify NO tiene "Available at Buildtime" marcado
- [ ] `DATABASE_URL` configurado correctamente
- [ ] `JWT_SECRET` y `JWT_REFRESH_SECRET` configurados (valores seguros)
- [ ] Dockerfile Path: `./Dockerfile.simple`
- [ ] Port: `3000`
- [ ] Health Check Path: `/health`
- [ ] Deploy iniciado en Coolify

## 🎯 Resultado Esperado

Si todo está correcto, deberías ver en los logs de Coolify:

```
✅ npm ci completed
✅ npx prisma generate completed
✅ npm run build completed
✅ Docker image built successfully
✅ Container started
✅ Health check passed
🚀 Deployment successful
```

## 💡 Notas Importantes

1. **package-lock.json es crítico**: `npm ci` lo requiere para builds reproducibles
2. **NODE_ENV durante build**: Debe permitir instalar devDependencies (TypeScript, etc.)
3. **Dockerfile.simple**: Más compatible con Coolify que el multi-stage
4. **Migraciones automáticas**: Se ejecutan al iniciar el contenedor
5. **Health check**: Usa `/health` no `/api/health`

## 🔗 Recursos Adicionales

- [COOLIFY-TROUBLESHOOTING.md](./COOLIFY-TROUBLESHOOTING.md) - Soluciones detalladas
- [COOLIFY-DEPLOYMENT-GUIDE.md](../COOLIFY-DEPLOYMENT-GUIDE.md) - Guía completa

---

**¿Listo?** Haz commit, configura Coolify y despliega. 🚀
