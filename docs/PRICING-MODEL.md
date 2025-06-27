# Modelo de Pricing - AquaFlow

## 📊 Nuevo Sistema de Precios

AquaFlow ha actualizado su modelo de pricing a un sistema basado en unidades con las siguientes características:

### 💰 Estructura de Precios

- **Precio por unidad**: S/ 1.00 por mes por unidad
- **Mínimo facturado**: 6 unidades (S/ 6.00/mes)
- **Modalidad**: Prepago anual (S/ 72.00 mínimo)
- **Aprobación**: Manual por Super Admin

### 🔢 Ejemplos de Pricing

| Unidades | Facturado | Mensual | Anual |
|----------|-----------|---------|-------|
| 4        | 6         | S/ 6.00 | S/ 72.00 |
| 6        | 6         | S/ 6.00 | S/ 72.00 |
| 8        | 8         | S/ 8.00 | S/ 96.00 |
| 12       | 12        | S/ 12.00| S/ 144.00|
| 20       | 20        | S/ 20.00| S/ 240.00|

## 🏗️ Arquitectura del Sistema

### Modelos de Base de Datos

#### Plan
```typescript
model Plan {
  id                String  @id @default(cuid())
  name              String  @default("Per Unit Plan")
  pricePerUnitPEN   Float   @default(1.0)
  minimumUnits      Int     @default(6)
  isAnnualPrepaid   Boolean @default(true)
  features          Json    @default("[]")
  isActive          Boolean @default(true)
  createdAt         DateTime @default(now())
}
```

#### Subscription
```typescript
model Subscription {
  id            String @id @default(cuid())
  condominiumId String
  planId        String
  unitsCount    Int           // Número real de unidades
  billingUnits  Int           // Unidades facturadas (máx de unitsCount y minimumUnits)
  monthlyAmount Float         // Monto mensual
  annualAmount  Float         // Monto anual
  startDate     DateTime      // Inicio
  endDate       DateTime      // Fin (1 año después)
  renewalDate   DateTime      // Recordatorio renovación
  status        SubscriptionStatus @default(PENDING)
  // ... campos de pago y aprobación
}
```

#### Estados de Suscripción
```typescript
enum SubscriptionStatus {
  PENDING       // Pendiente de pago
  PAID          // Pagado, pendiente de aprobación
  ACTIVE        // Activa y aprobada
  EXPIRED       // Expirada
  CANCELLED     // Cancelada
  SUSPENDED     // Suspendida
}
```

## 🔧 API Endpoints

### Calculadora de Precios
```http
POST /api/subscriptions/pricing/calculate
Content-Type: application/json

{
  "unitsCount": 8,
  "planId": "optional-plan-id"
}
```

**Respuesta:**
```json
{
  "pricing": {
    "unitsCount": 8,
    "billingUnits": 8,
    "monthlyAmount": 8.0,
    "annualAmount": 96.0
  },
  "formatted": {
    "monthly": "S/ 8.00",
    "annual": "S/ 96.00"
  }
}
```

### Crear Suscripción
```http
POST /api/subscriptions
Content-Type: application/json
Authorization: Bearer <token>

{
  "condominiumId": "condo-id",
  "planId": "plan-id",
  "paymentMethod": "Transferencia bancaria",
  "paymentRef": "TXN-123456789",
  "paymentProof": "https://example.com/proof.jpg",
  "notes": "Pago anual completo"
}
```

### Aprobar Suscripción (Super Admin)
```http
POST /api/subscriptions/{id}/approve
Authorization: Bearer <super-admin-token>
```

### Obtener Suscripciones Pendientes (Super Admin)
```http
GET /api/subscriptions/pending
Authorization: Bearer <super-admin-token>
```

## 💳 Flujo de Pagos

### 1. Cliente
1. Calcula precio basado en número de unidades
2. Realiza transferencia bancaria anual
3. Sube comprobante de pago
4. Espera aprobación manual

### 2. Super Admin
1. Recibe notificación de pago pendiente
2. Verifica comprobante
3. Aprueba o rechaza manualmente
4. La suscripción se activa por 1 año

### 3. Sistema
1. Calcula automáticamente basado en unidades activas
2. Aplica mínimo de 6 unidades
3. Genera fechas de inicio, fin y renovación
4. Envía recordatorios antes del vencimiento

## 🛠️ Utilidades y Servicios

### PricingUtils
```typescript
import { calculatePricing, formatPricePEN } from '../utils/pricing';

const pricing = calculatePricing(8, {
  pricePerUnitPEN: 1.0,
  minimumUnits: 6,
  isAnnualPrepaid: true
});

console.log(formatPricePEN(pricing.annualAmount)); // "S/ 96.00"
```

### SubscriptionService
```typescript
import { SubscriptionService } from '../services/subscription.service';

const service = new SubscriptionService();

// Crear suscripción
const subscription = await service.createSubscription({
  condominiumId: "condo-id",
  planId: "plan-id"
});

// Aprobar pago
await service.approveSubscription(subscriptionId, adminId);

// Verificar si tiene suscripción activa
const hasActive = await service.hasActiveSubscription(condominiumId);
```

## 📊 Dashboard y Métricas

### Super Admin Dashboard
```http
GET /api/admin/dashboard/metrics
```

**Respuesta incluye:**
```json
{
  "subscriptions": {
    "total": 50,
    "active": 45,
    "pending": 3,
    "expired": 2
  },
  "units": {
    "total": 456,
    "pricePerUnit": 1.0,
    "currency": "PEN"
  },
  "revenue": {
    "estimated": 456.0,
    "annual": 43200.0,
    "currency": "PEN",
    "formatted": {
      "estimated": "S/ 456.00",
      "annual": "S/ 43,200.00"
    }
  }
}
```

## 🔄 Migración y Setup

### 1. Migración de Base de Datos
```bash
# Aplicar migración SQL personalizada
psql -d water_management -f prisma/migrations/20241207_update_pricing_model.sql
```

### 2. Inicializar Modelo de Pricing
```bash
npx ts-node scripts/initialize-pricing.ts
```

### 3. Verificar Migración
```bash
# Revisar logs y verificar que todo funcionó correctamente
npm run dev
```

## 📝 Documentación API

La documentación completa de la API está disponible en:
- **Swagger UI**: http://localhost:3000/api-docs
- **Postman Collection**: `docs/AquaFlow-API.postman_collection.json`

### Nuevos Endpoints Documentados
- `/api/subscriptions/*` - Gestión de suscripciones
- `/api/admin/dashboard/metrics` - Métricas actualizadas
- Esquemas actualizados para Plan y Subscription

## 🔐 Seguridad y Permisos

### Roles y Acceso
- **SUPER_ADMIN**: Acceso completo, aprobación de pagos
- **ADMIN**: Gestión de condominio, consulta de suscripciones
- **ANALYST/EDITOR**: Solo lectura de información del condominio
- **RESIDENT**: Sin acceso a información de suscripciones

### Validaciones
- Mínimo 6 unidades siempre aplicado
- Validación de números de unidades activas
- Verificación de planes activos
- Autenticación requerida para todos los endpoints

## 🚨 Consideraciones Importantes

1. **Prepago Anual**: Solo se acepta pago anual completo
2. **Aprobación Manual**: Todos los pagos requieren aprobación del Super Admin
3. **Recálculo Automático**: Si cambia el número de unidades, se recalcula el precio
4. **Mínimo Garantizado**: Siempre se factura mínimo 6 unidades
5. **Moneda**: Todos los precios están en Soles Peruanos (PEN)

## 📞 Soporte

Para soporte técnico o consultas sobre el modelo de pricing:
- 📧 Email: support@aquaflow.com
- 📚 Documentación: http://localhost:3000/api-docs
- 🔧 GitHub Issues: Para reportar bugs o solicitar features