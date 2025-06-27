# Water Management System - Backend API

A comprehensive backend API for managing water consumption in condominiums, built with Node.js, Express, Prisma, and PostgreSQL.

## 🚀 Features

- **Multi-tenant Architecture**: Support for multiple condominiums with isolated data
- **Role-based Access Control**: Super Admin, Admin, Analyst, and Editor roles
- **Water Consumption Tracking**: Individual and common area consumption calculation
- **Automated Billing**: Smart calculation of bills with anomaly detection
- **OCR Support**: Ready for mobile app integration with receipt scanning
- **Real-time Validation**: Business rule enforcement and data validation
- **Audit Logging**: Complete audit trail for all operations
- **RESTful API**: Clean, documented endpoints with proper HTTP status codes

## 📋 Prerequisites

- Node.js 18+ 
- PostgreSQL 12+
- npm or yarn

## 🛠️ Installation

1. **Clone and navigate to the API directory**
   ```bash
   cd water-management-system/API
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your configuration:
   ```env
   DATABASE_URL="postgresql://username:password@localhost:5432/water_management"
   JWT_SECRET="your-super-secret-jwt-key-here"
   JWT_REFRESH_SECRET="your-super-secret-refresh-key-here"
   PORT=3000
   ```

4. **Database Setup**
   ```bash
   # Generate Prisma client
   npm run db:generate
   
   # Run migrations
   npm run db:migrate
   
   # Seed with demo data
   npm run db:seed
   ```

5. **Start the server**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm run build && npm start
   ```

## 🏗️ Project Structure

```
src/
├── controllers/           # Request handlers (future expansion)
├── middleware/           # Express middleware
│   ├── auth.ts          # Authentication & authorization
│   ├── errorHandler.ts  # Error handling
│   └── rateLimiter.ts   # Rate limiting
├── routes/              # API route definitions
│   ├── auth.ts         # Authentication endpoints
│   ├── admin.ts        # Super admin operations
│   ├── condominiums.ts # Condominium management
│   ├── periods.ts      # Reading periods
│   └── bills.ts        # Billing & calculations
├── services/            # Business logic
│   └── calculationService.ts
├── types/               # TypeScript definitions
│   └── auth.ts
├── utils/               # Utility functions
│   ├── jwt.ts          # JWT operations
│   └── password.ts     # Password hashing
└── index.ts            # Application entry point
```

## 📚 API Documentation

### Authentication

All endpoints (except `/health` and `/api/auth/login`) require authentication via Bearer token.

```bash
# Login
POST /api/auth/login
{
  "email": "admin@aquaflow.com",
  "password": "SuperAdmin123!"
}

# Get current user
GET /api/auth/me
Authorization: Bearer <token>
```

### Super Admin Operations

```bash
# Get all plans
GET /api/admin/plans

# Create new plan
POST /api/admin/plans
{
  "name": "Custom Plan",
  "maxUnits": 100,
  "monthlyPrice": 49.99,
  "features": ["Feature 1", "Feature 2"]
}

# Get condominiums with filters
GET /api/admin/condominiums?search=sunset&isActive=true&expiring=soon

# Create condominium with admin user
POST /api/admin/condominiums
{
  "name": "New Residence",
  "address": "123 Main St",
  "planId": "plan_id",
  "expiresAt": "2025-12-31T23:59:59Z",
  "adminUser": {
    "name": "Admin Name",
    "email": "admin@residence.com",
    "password": "SecurePassword123!"
  }
}
```

### Condominium Management

```bash
# Get condominium details
GET /api/condominiums/:id

# Create block
POST /api/condominiums/:id/blocks
{
  "name": "Block C",
  "maxUnits": 25
}

# Create unit (auto-creates water meter)
POST /api/condominiums/:condominiumId/units
{
  "name": "C301",
  "blockId": "block_id"
}

# Create resident
POST /api/condominiums/:id/residents
{
  "name": "John Doe",
  "email": "john@email.com",
  "phone": "+1-555-1234"
}
```

### Reading Periods & Billing

```bash
# Create new period
POST /api/periods
{
  "condominiumId": "condo_id",
  "startDate": "2024-01-01T00:00:00Z"
}

# Submit reading
POST /api/periods/:periodId/readings
{
  "meterId": "meter_id",
  "value": 1234.5,
  "photo1": "https://...",
  "ocrValue": 1234.0,
  "ocrConfidence": 0.95
}

# Update period with receipt data
PUT /api/periods/:id/receipt
{
  "totalVolume": 450.5,
  "totalAmount": 675.75,
  "receiptPhoto1": "https://..."
}

# Calculate bills
POST /api/bills/calculate
{
  "periodId": "period_id"
}

# Get bills for period
GET /api/bills/period/:periodId
```

## 🔐 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Role-based Authorization**: Granular permissions per condominium
- **Rate Limiting**: Protection against abuse
- **Input Validation**: Zod schemas for request validation
- **SQL Injection Prevention**: Prisma ORM with parameterized queries
- **Password Security**: bcrypt with high salt rounds

## 💡 Business Logic

### Water Consumption Calculation

```
Individual Consumption = Current Reading - Previous Reading
Common Area Consumption = Total Billed Volume - Sum(Individual Consumptions)
Common Area Cost per Unit = (Total Bill - Sum(Individual Costs)) / Number of Units
Total Unit Cost = Individual Cost + Common Area Cost + Extra Charges
```

### Anomaly Detection

- **Negative Consumption**: Meter replacement detection
- **Extreme Values**: Consumption spike detection
- **Missing Readings**: Period completion validation
- **Calculation Discrepancies**: Total vs. individual sum validation

## 📊 Demo Data

The seed script creates:

**Accounts:**
- Super Admin: `admin@aquaflow.com` / `SuperAdmin123!`
- Condominium Admin: `demo@sunsetgardens.com` / `DemoAdmin123!`
- Maintenance Staff: `janitor@sunsetgardens.com` / `Janitor123!`

**Sample Condominium:**
- Name: Sunset Gardens Residences
- Block A: 10 units (A101-A110) with residents
- Block B: 5 units (B201-B205) available

## 🧪 Testing

```bash
# Run tests (when implemented)
npm test

# Prisma Studio for database inspection
npm run db:studio
```

## 📝 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `JWT_SECRET` | JWT signing secret | Required |
| `JWT_REFRESH_SECRET` | Refresh token secret | Required |
| `JWT_EXPIRES_IN` | Access token expiration | 1h |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token expiration | 7d |
| `PORT` | Server port | 3000 |
| `NODE_ENV` | Environment mode | development |
| `CORS_ORIGIN` | Allowed origins | localhost:3000,localhost:5173 |

## 🚀 Deployment

1. **Build the application**
   ```bash
   npm run build
   ```

2. **Run migrations**
   ```bash
   npm run db:migrate
   ```

3. **Start production server**
   ```bash
   npm start
   ```

## 🔄 Database Migrations

```bash
# Create migration
npx prisma migrate dev --name migration_name

# Apply migrations in production
npx prisma migrate deploy

# Reset database (development only)
npx prisma migrate reset
```

## 📈 Monitoring

- Health check endpoint: `GET /health`
- Detailed error logging with request context
- Audit logs for all operations
- Rate limiting with detailed headers

## 🛟 Troubleshooting

**Common Issues:**

1. **Database Connection**: Verify PostgreSQL is running and credentials are correct
2. **Migration Errors**: Ensure database exists and user has proper permissions
3. **JWT Errors**: Check JWT secrets are properly set in environment
4. **CORS Issues**: Update CORS_ORIGIN in environment variables

**Logs Location:**
- Development: Console output
- Production: Configure logging service (Winston, etc.)

## 🤝 Contributing

1. Follow TypeScript best practices
2. Use Prisma for all database operations
3. Validate inputs with Zod schemas
4. Add audit logging for data modifications
5. Test business logic thoroughly

## 📄 License

This project is part of the Water Management System suite.