# 🔐 API Permissions System

## Overview

The Water Management System API implements a role-based access control (RBAC) system with 4 distinct roles. Each role has specific permissions within the context of a condominium.

## Roles

### 1. SUPER_ADMIN (System Administrator)
**Scope**: Global system access
**Purpose**: Platform administration and management

**Permissions**:
- ✅ Full access to ALL condominiums
- ✅ Manage subscription plans
- ✅ View system-wide statistics
- ✅ Access admin dashboard
- ✅ Bypasses all condominium-level permission checks

**Use Case**: Platform owner/administrator

---

### 2. ADMIN (Administrador del Condominio)
**Scope**: Full condominium management
**Purpose**: Condominium owner/administrator

**Permissions**:
- ✅ Create/Edit/Delete condominium settings
- ✅ Create/Manage users (ADMIN, EDITOR, ANALYST)
- ✅ Create/Manage blocks and units
- ✅ Create/Manage residents
- ✅ Create/Manage billing periods
- ✅ Create/Edit/Delete readings
- ✅ Validate readings
- ✅ Close periods
- ✅ Calculate bills
- ✅ Update bill status
- ✅ View all data

**Use Case**: Condominium owner, property manager

---

### 3. EDITOR (Editor/Conserje)
**Scope**: Operational management
**Purpose**: Building manager, janitor, maintenance staff

**Permissions**:
- ✅ Create/Edit units
- ✅ Create/Edit residents
- ✅ Create/Edit readings
- ✅ View periods
- ✅ View bills
- ❌ Cannot create/edit/close periods
- ❌ Cannot validate readings
- ❌ Cannot calculate bills
- ❌ Cannot manage users

**Use Case**: Building janitor, maintenance staff, operational manager

---

### 4. ANALYST (Lector/Residente)
**Scope**: Read-only access
**Purpose**: Resident, view-only user

**Permissions**:
- ✅ View all data (readings, bills, periods, units, residents)
- ✅ View own condominium information
- ❌ Cannot create/edit ANY data
- ❌ Cannot manage users
- ❌ Cannot validate or modify readings
- ❌ Cannot manage periods or bills

**Use Case**: Resident, auditor, read-only access

---

## Permission Matrix

| Action | SUPER_ADMIN | ADMIN | EDITOR | ANALYST |
|--------|-------------|-------|--------|---------|
| **Condominium Management** |
| Create condominium | ✅ | ✅ | ❌ | ❌ |
| Edit condominium | ✅ | ✅ | ❌ | ❌ |
| Delete condominium | ✅ | ❌ | ❌ | ❌ |
| View condominiums | ✅ | ✅ | ✅ | ✅ |
| **User Management** |
| Create users | ✅ | ✅ | ❌ | ❌ |
| Edit users | ✅ | ✅ | ❌ | ❌ |
| Delete users | ✅ | ✅ | ❌ | ❌ |
| View users | ✅ | ✅ | ❌ | ❌ |
| **Blocks & Units** |
| Create blocks | ✅ | ✅ | ❌ | ❌ |
| Create units | ✅ | ✅ | ✅ | ❌ |
| Edit units | ✅ | ✅ | ✅ | ❌ |
| View blocks/units | ✅ | ✅ | ✅ | ✅ |
| **Residents** |
| Create residents | ✅ | ✅ | ✅ | ❌ |
| Edit residents | ✅ | ✅ | ✅ | ❌ |
| View residents | ✅ | ✅ | ✅ | ✅ |
| **Periods** |
| Create period | ✅ | ✅ | ❌ | ❌ |
| Edit period | ✅ | ✅ | ❌ | ❌ |
| Close period | ✅ | ✅ | ❌ | ❌ |
| Reset period | ✅ | ✅ | ❌ | ❌ |
| Delete period | ✅ | ✅ | ❌ | ❌ |
| View periods | ✅ | ✅ | ✅ | ✅ |
| **Readings** |
| Create reading | ✅ | ✅ | ✅ | ❌ |
| Edit reading | ✅ | ✅ | ✅ | ❌ |
| Validate reading | ✅ | ✅ | ❌ | ❌ |
| Validate all readings | ✅ | ✅ | ❌ | ❌ |
| View readings | ✅ | ✅ | ✅ | ✅ |
| **Bills** |
| Calculate bills | ✅ | ✅ | ❌ | ❌ |
| Update bill status | ✅ | ✅ | ❌ | ❌ |
| View bills | ✅ | ✅ | ✅ | ✅ |
| View calculations | ✅ | ✅ | ✅ | ✅ |
| **Plans & System** |
| Manage plans | ✅ | ❌ | ❌ | ❌ |
| System statistics | ✅ | ❌ | ❌ | ❌ |

---

## Implementation Details

### Role Assignment

Users can have **different roles in different condominiums**. This is managed through the `CondominiumUser` junction table:

```prisma
model CondominiumUser {
  id             String      @id @default(cuid())
  userId         String
  condominiumId  String
  role           UserRole    // Role-specific to this condominium
  createdAt      DateTime    @default(now())

  user           User        @relation(fields: [userId], references: [id])
  condominium    Condominium @relation(fields: [condominiumId], references: [id])

  @@unique([userId, condominiumId])
}
```

**Example**: A user can be:
- `ADMIN` in Condominium A
- `EDITOR` in Condominium B
- `ANALYST` in Condominium C

### Permission Checking

#### 1. Global Role Check
```typescript
// Middleware: requireRole
// Usage: router.get('/admin/stats', requireRole(UserRole.SUPER_ADMIN), ...)
```

Used for system-wide operations that require a specific global role.

#### 2. Condominium Access Check
```typescript
// Middleware: requireCondominiumAccess
// Usage: router.post('/:id/units', requireCondominiumAccess([UserRole.ADMIN, UserRole.EDITOR]), ...)
```

Used for condominium-specific operations. Checks:
1. User has access to the specified condominium
2. User has one of the required roles in that condominium
3. SUPER_ADMIN bypasses both checks

#### 3. Manual Permission Check
```typescript
if (req.user!.role !== UserRole.SUPER_ADMIN) {
  const hasAccess = req.condominiumAccess?.some(
    access => access.condominiumId === condominiumId &&
    [UserRole.ADMIN, UserRole.EDITOR].includes(access.role)
  );

  if (!hasAccess) {
    throw createError('Access denied', 403);
  }
}
```

Used in route handlers for custom permission logic.

---

## Routes by Permission Level

### SUPER_ADMIN Only
- `POST /admin/plans` - Create subscription plan
- `PUT /admin/plans/:id` - Update subscription plan
- `GET /admin/stats` - System-wide statistics
- `GET /admin/condominiums` - List all condominiums

### ADMIN Only (per condominium)
- `POST /condominiums` - Create condominium
- `PUT /condominiums/:id` - Update condominium
- `POST /condominiums/:id/users` - Create condominium user
- `POST /condominiums/:id/blocks` - Create block
- `POST /periods` - Create period
- `PUT /periods/:id` - Update period
- `PUT /periods/:id/close` - Close period
- `PUT /periods/:id/reset` - Reset period status
- `POST /bills/calculate` - Calculate bills for period
- `PUT /bills/:id/status` - Update bill status
- `PUT /periods/:periodId/readings/:readingId/validate` - Validate reading
- `PUT /periods/:periodId/readings/validate-all` - Validate all readings

### ADMIN or EDITOR (per condominium)
- `POST /condominiums/:id/units` - Create unit
- `POST /condominiums/:id/residents` - Create resident
- `PUT /condominiums/:condominiumId/residents/:residentId` - Update resident
- `POST /periods/:periodId/readings` - Create reading
- `PUT /periods/:periodId/readings/:readingId` - Update reading

### All Authenticated Users (with condominium access)
- `GET /condominiums/:id` - View condominium details
- `GET /condominiums/:id/blocks` - View blocks
- `GET /condominiums/:id/units` - View units
- `GET /condominiums/:id/residents` - View residents
- `GET /periods/condominium/:condominiumId` - View periods
- `GET /periods/:periodId/readings` - View readings
- `GET /bills/period/:periodId` - View bills
- `GET /bills/:billId` - View bill details

---

## Security Notes

### 1. SUPER_ADMIN Bypass
The SUPER_ADMIN role always bypasses condominium-level permission checks. This is intentional for system administration but should be used carefully.

### 2. Role Hierarchy
There is NO implicit role hierarchy. A user with `EDITOR` role cannot perform `ADMIN` actions, and `ANALYST` cannot perform any write operations.

### 3. Cross-Condominium Access
Users can only access condominiums they are explicitly assigned to (via `CondominiumUser` table), except for `SUPER_ADMIN` which has access to all.

### 4. Token Permissions
The JWT token contains:
```json
{
  "userId": "...",
  "email": "...",
  "role": "ADMIN"  // Global role
}
```

Condominium-specific roles are loaded from the database during authentication middleware and attached to `req.condominiumAccess`.

---

## Error Responses

### 401 Unauthorized
```json
{
  "error": "Authentication required"
}
```
User is not authenticated.

### 403 Forbidden
```json
{
  "error": "Access denied. Only administrators can create readings."
}
```
User is authenticated but lacks required permissions.

### 404 Not Found
```json
{
  "error": "Condominium not found"
}
```
Resource doesn't exist or user doesn't have access to it.

---

## Testing Permissions

### Example Scenarios

#### Scenario 1: EDITOR Creating a Reading
```bash
# Login as EDITOR
POST /api/auth/login
{
  "email": "janitor@sunsetgardens.com",
  "password": "Janitor123!"
}

# Create reading (should succeed)
POST /api/periods/period_123/readings
Authorization: Bearer <token>
{
  "meterId": "meter_456",
  "currentReading": 125.5
}
# Response: 201 Created
```

#### Scenario 2: ANALYST Attempting to Create Reading
```bash
# Login as ANALYST
POST /api/auth/login
{
  "email": "resident@sunsetgardens.com",
  "password": "Resident123!"
}

# Attempt to create reading (should fail)
POST /api/periods/period_123/readings
Authorization: Bearer <token>
{
  "meterId": "meter_456",
  "currentReading": 125.5
}
# Response: 403 Forbidden
# { "error": "Access denied. Only administrators and editors can create readings." }
```

#### Scenario 3: EDITOR Attempting to Close Period
```bash
# Login as EDITOR
POST /api/auth/login
{
  "email": "janitor@sunsetgardens.com",
  "password": "Janitor123!"
}

# Attempt to close period (should fail)
PUT /api/periods/period_123/close
Authorization: Bearer <token>
# Response: 403 Forbidden
# { "error": "Access denied. Only administrators can close periods." }
```

---

## Future Enhancements

### Planned Features
- [ ] Fine-grained permissions (e.g., "can_view_bills", "can_edit_readings")
- [ ] Custom role creation with permission sets
- [ ] Audit log for permission checks
- [ ] Rate limiting per role
- [ ] Time-based access (temporary permissions)

### Not Planned
- Role hierarchy (deliberately avoided for clarity)
- Permission inheritance
- Dynamic permission modification

---

## References

- **Prisma Schema**: `prisma/schema.prisma` - Role definitions
- **Auth Middleware**: `src/middleware/auth.ts` - Permission checking logic
- **Route Handlers**: `src/routes/*.ts` - Individual endpoint permissions
