# AquaFlow API Documentation

## 📚 Documentación Completa del API

El API de AquaFlow está completamente documentado usando **OpenAPI/Swagger** y incluye colecciones de **Postman** para facilitar las pruebas y desarrollo.

## 🚀 Acceso Rápido

### Swagger UI (Documentación Interactiva)
```
http://localhost:3000/api-docs
```

### Health Check
```
http://localhost:3000/health
```

## 📋 Recursos Disponibles

### 1. Documentación Swagger
- **Ubicación**: `http://localhost:3000/api-docs` cuando el servidor está ejecutándose
- **Características**:
  - Documentación interactiva de todos los endpoints
  - Esquemas de datos completos
  - Ejemplos de solicitudes y respuestas
  - Pruebas directas desde la interfaz
  - Soporte para autenticación JWT

### 2. Colección de Postman
- **Archivo**: `AquaFlow-API.postman_collection.json`
- **Ambiente**: `AquaFlow-Environment.postman_environment.json`

#### Instalación en Postman:
1. Abre Postman
2. Importa `AquaFlow-API.postman_collection.json`
3. Importa `AquaFlow-Environment.postman_environment.json`
4. Selecciona el ambiente "AquaFlow Environment"
5. Actualiza las variables de ambiente con IDs reales de tu base de datos

## 🔐 Autenticación

### Flujo de Autenticación
1. **Login**: `POST /api/auth/login`
   - Recibe email y password
   - Devuelve `accessToken` y `refreshToken`
   
2. **Uso del Token**: Incluir en headers:
   ```
   Authorization: Bearer <accessToken>
   ```

3. **Renovación**: `POST /api/auth/refresh`
   - Usa `refreshToken` para obtener nuevo `accessToken`

### Credenciales Demo
```json
{
  "super_admin": {
    "email": "admin@aquaflow.com",
    "password": "SuperAdmin123!"
  },
  "admin": {
    "email": "demo@sunsetgardens.com", 
    "password": "DemoAdmin123!"
  },
  "editor": {
    "email": "janitor@sunsetgardens.com",
    "password": "Janitor123!"
  }
}
```

## 📊 Endpoints Principales

### Autenticación
- `POST /api/auth/login` - Iniciar sesión
- `POST /api/auth/refresh` - Renovar token
- `GET /api/auth/me` - Obtener perfil usuario
- `POST /api/auth/logout` - Cerrar sesión

### Admin (Super Admin)
- `GET /api/admin/condominiums` - Listar todos los condominios
- `POST /api/admin/condominiums` - Crear condominio
- `GET /api/admin/plans` - Obtener planes de suscripción
- `GET /api/admin/dashboard/metrics` - Métricas del sistema

### Condominios
- `GET /api/condominiums/{id}` - Detalles del condominio
- `GET /api/condominiums/{id}/blocks` - Bloques del condominio
- `POST /api/condominiums/{id}/blocks` - Crear bloque
- `GET /api/condominiums/{id}/units` - Unidades del condominio
- `POST /api/condominiums/{id}/units` - Crear unidad
- `GET /api/condominiums/{id}/residents` - Residentes del condominio
- `POST /api/condominiums/{id}/residents` - Crear residente

### Períodos
- `GET /api/periods/condominium/{id}` - Períodos del condominio
- `POST /api/periods` - Crear período
- `GET /api/periods/{id}` - Detalles del período
- `POST /api/periods/{id}/readings` - Crear lectura
- `GET /api/periods/{id}/readings` - Lecturas del período

### Facturación
- `POST /api/bills/calculate` - Calcular facturas del período
- `POST /api/bills/preview` - Vista previa de facturación
- `GET /api/bills/summary/{periodId}` - Resumen de facturación
- `GET /api/bills/period/{periodId}` - Facturas del período

## 🛠️ Regenerar Documentación

### Postman Collection
```bash
npm run docs:postman
```

### Actualizar Swagger
Los comentarios Swagger están en los archivos de rutas (`src/routes/*.ts`). Después de hacer cambios:

1. Reinicia el servidor de desarrollo
2. Visita `http://localhost:3000/api-docs`
3. La documentación se actualiza automáticamente

## 📝 Esquemas de Datos

Todos los esquemas están documentados en Swagger UI:
- **User**: Información de usuarios
- **Condominium**: Datos de condominios  
- **Block**: Información de bloques
- **Unit**: Datos de unidades
- **Resident**: Información de residentes
- **Period**: Períodos de facturación
- **Reading**: Lecturas de medidores
- **Bill**: Facturas generadas

## 🔍 Ejemplos de Uso

### 1. Autenticación y Setup Inicial
```bash
# 1. Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@aquaflow.com","password":"SuperAdmin123!"}'

# 2. Usar el token devuelto
export TOKEN="<access_token_from_login>"

# 3. Obtener perfil
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

### 2. Gestión de Condominios
```bash
# Listar condominios (Super Admin)
curl -X GET http://localhost:3000/api/admin/condominiums \
  -H "Authorization: Bearer $TOKEN"

# Obtener detalles de condominio específico
curl -X GET http://localhost:3000/api/condominiums/{condominium_id} \
  -H "Authorization: Bearer $TOKEN"
```

### 3. Lecturas y Facturación
```bash
# Crear lectura
curl -X POST http://localhost:3000/api/periods/{period_id}/readings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"unitId":"unit_id","meterId":"meter_id","value":1234.5}'

# Calcular facturas
curl -X POST http://localhost:3000/api/bills/calculate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"periodId":"period_id","condominiumId":"condominium_id"}'
```

## 🚨 Códigos de Estado

- **200**: Operación exitosa
- **201**: Recurso creado exitosamente
- **400**: Error en los datos enviados
- **401**: No autenticado o token inválido
- **403**: Sin permisos para la operación
- **404**: Recurso no encontrado
- **422**: Error de validación
- **429**: Límite de intentos excedido
- **500**: Error interno del servidor

## 📧 Soporte

Para más información o reportar problemas:
- **GitHub**: [Repositorio del proyecto]
- **Email**: support@aquaflow.com

---

**Nota**: Esta documentación está actualizada para la versión 1.0.0 del API de AquaFlow.