# Mejoras Recomendadas para el Backend API

**Fecha:** 2025-12-11
**Contexto:** Basado en problemas encontrados durante integración con la app Flutter

---

## 🔴 CRÍTICO - Arreglar Inmediatamente

### 1. **Endpoint GET /api/condominiums - Incluir datos completos de bloques y unidades**

**Problema Actual:**
```typescript
// Líneas 88-106 y 109-134 en src/routes/condominiums.ts
include: {
  plan: { ... },
  _count: {
    select: {
      blocks: true,  // ❌ Solo devuelve COUNT, no los datos
    },
  },
}
```

La app Flutter muestra "0 bloques y 0 unidades" porque el endpoint solo devuelve `_count: {blocks: 1}` en lugar de los datos completos.

**Solución:**
```typescript
// REEMPLAZAR líneas 88-106 con:
condominiums = await prisma.condominium.findMany({
  include: {
    plan: {
      select: {
        id: true,
        name: true,
        pricePerUnitPEN: true,
        minimumUnits: true,
        isAnnualPrepaid: true,
      },
    },
    blocks: {
      include: {
        units: {
          select: {
            id: true,
            name: true,
            residentId: true,
          },
        },
        _count: {
          select: { units: true },
        },
      },
      orderBy: { name: 'asc' },
    },
    _count: {
      select: {
        residents: true,
        periods: true,
      },
    },
  },
  orderBy: { createdAt: 'desc' },
});

// HACER LO MISMO para las líneas 109-134 (usuarios no super admin)
```

**Impacto:**
- ✅ La app Flutter mostrará correctamente el número de bloques y unidades
- ✅ Elimina la necesidad de hacer múltiples peticiones individuales
- ✅ Mejora el rendimiento de la app (1 petición en lugar de N+1)

---

## 🟡 IMPORTANTE - Mejorar Performance

### 2. **Agregar índices en la base de datos**

**Problema:** Las consultas pueden ser lentas con muchos datos.

**Solución en Prisma Schema:**
```prisma
model Block {
  // ... campos existentes

  @@index([condominiumId])
  @@index([name, condominiumId])
}

model Unit {
  // ... campos existentes

  @@index([blockId])
  @@index([residentId])
  @@index([name, blockId])
}

model Resident {
  // ... campos existentes

  @@index([condominiumId])
  @@index([email])
  @@index([name, condominiumId])
}

model Reading {
  // ... campos existentes

  @@index([periodId])
  @@index([unitId])
  @@index([createdAt])
  @@index([periodId, unitId])
}
```

**Comandos:**
```bash
# Después de agregar los índices al schema
npx prisma migrate dev --name add_performance_indexes
npx prisma generate
```

---

### 3. **Agregar caché para consultas frecuentes**

**Problema:** El endpoint `/api/condominiums` se llama frecuentemente.

**Solución - Agregar Redis o caché en memoria:**

```typescript
// src/utils/cache.ts (CREAR NUEVO ARCHIVO)
import NodeCache from 'node-cache';

// TTL de 5 minutos para condominios
const condominiumCache = new NodeCache({ stdTTL: 300 });

export function getCachedCondominiums(userId: string) {
  return condominiumCache.get(`condominiums:${userId}`);
}

export function setCachedCondominiums(userId: string, data: any) {
  condominiumCache.set(`condominiums:${userId}`, data);
}

export function invalidateCondominiumCache(userId: string) {
  condominiumCache.del(`condominiums:${userId}`);
}
```

**Implementación en routes/condominiums.ts:**
```typescript
import { getCachedCondominiums, setCachedCondominiums } from '../utils/cache';

router.get('/', asyncHandler(async (req, res) => {
  const user = req.user!;

  // Intentar obtener de caché
  const cached = getCachedCondominiums(user.id);
  if (cached) {
    return res.json({ condominiums: cached, cached: true });
  }

  // ... código existente para obtener condominios ...

  // Guardar en caché
  setCachedCondominiums(user.id, condominiums);

  res.json({ condominiums });
}));
```

**Instalar dependencia:**
```bash
npm install node-cache
npm install --save-dev @types/node-cache
```

---

## 🟢 OPCIONAL - Mejoras Adicionales

### 4. **Agregar paginación al endpoint de condominios**

Para cuando los usuarios tengan muchos condominios:

```typescript
router.get('/', asyncHandler(async (req, res) => {
  const user = req.user!;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;

  // ... código de búsqueda con skip/take ...

  const [condominiums, total] = await Promise.all([
    prisma.condominium.findMany({
      // ... includes existentes ...
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.condominium.count({ where }),
  ]);

  res.json({
    condominiums,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  });
}));
```

---

### 5. **Agregar endpoint de health check mejorado**

```typescript
// src/routes/health.ts (CREAR NUEVO ARCHIVO)
import express from 'express';
import { prisma } from '../index';

const router = express.Router();

router.get('/health', async (req, res) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
      version: process.env.npm_package_version || '1.0.0',
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: error.message,
    });
  }
});

export default router;
```

---

### 6. **Agregar validación de datos en respuestas**

Para asegurar que siempre se devuelven datos consistentes:

```typescript
// src/utils/sanitize.ts (CREAR NUEVO ARCHIVO)
export function sanitizeCondominium(condominium: any) {
  return {
    ...condominium,
    blocks: condominium.blocks || [],
    plan: condominium.plan || null,
    _count: {
      blocks: condominium.blocks?.length || 0,
      residents: condominium._count?.residents || 0,
      periods: condominium._count?.periods || 0,
    },
  };
}
```

---

### 7. **Agregar logging estructurado**

Para debugging y monitoreo en producción:

```typescript
// src/utils/logger.ts (CREAR NUEVO ARCHIVO)
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
  }));
}
```

**Uso:**
```typescript
import { logger } from '../utils/logger';

router.get('/', asyncHandler(async (req, res) => {
  logger.info('Fetching condominiums', { userId: req.user!.id });
  // ... código ...
}));
```

**Instalar:**
```bash
npm install winston
```

---

### 8. **Agregar rate limiting**

Para proteger contra abusos:

```typescript
// src/middleware/rateLimit.ts (CREAR NUEVO ARCHIVO)
import rateLimit from 'express-rate-limit';

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 requests por ventana
  message: 'Too many requests from this IP',
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // máximo 5 intentos de login
  message: 'Too many login attempts',
});
```

**Uso en index.ts:**
```typescript
import { apiLimiter, authLimiter } from './middleware/rateLimit';

app.use('/api/', apiLimiter);
app.use('/api/auth/login', authLimiter);
```

**Instalar:**
```bash
npm install express-rate-limit
```

---

## 📋 Plan de Implementación

### Prioridad 1 (Ahora mismo):
1. ✅ Arreglar endpoint GET /api/condominiums para incluir blocks y units completos

### Prioridad 2 (Esta semana):
2. ✅ Agregar índices en base de datos
3. ✅ Implementar caché básico

### Prioridad 3 (Próximo sprint):
4. ✅ Agregar paginación
5. ✅ Mejorar health check
6. ✅ Agregar validación de respuestas

### Prioridad 4 (Futuro):
7. ✅ Implementar logging estructurado
8. ✅ Agregar rate limiting

---

## 🧪 Testing

Después de implementar el fix crítico, prueba con:

```bash
# 1. Login
curl -X POST https://api.consumos.online/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@aquaflow.com","password":"SuperAdmin123!"}'

# 2. Get condominiums (usar el token del paso 1)
curl https://api.consumos.online/api/condominiums \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# Verificar que la respuesta incluye:
# - blocks: [{ id, name, units: [...] }]  ✅
# - NO solo _count: { blocks: 1 }  ❌
```

---

## 📈 Beneficios Esperados

| Mejora | Beneficio | Impacto |
|--------|-----------|---------|
| Fix endpoint condominiums | App funciona correctamente | 🔴 Crítico |
| Índices DB | 3-5x más rápido | 🟡 Alto |
| Caché | 10x más rápido para lecturas | 🟡 Alto |
| Paginación | Escala con +1000 condominios | 🟢 Medio |
| Health check | Mejor monitoreo | 🟢 Medio |
| Logging | Debugging más fácil | 🟢 Medio |
| Rate limiting | Protección contra abusos | 🟢 Bajo |

---

## 🚀 Deployment

Después de hacer los cambios:

```bash
# 1. Ejecutar migraciones
npx prisma migrate deploy

# 2. Rebuild
npm run build

# 3. Reiniciar servidor
pm2 restart water-api
# o
docker-compose restart api
```

---

¿Necesitas ayuda implementando alguna de estas mejoras? Avísame y te ayudo con el código específico.
