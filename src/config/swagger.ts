import swaggerJsdoc from 'swagger-jsdoc';
import { version } from '../../package.json';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'AquaFlow API',
      version,
      description: 'Water Management System API - Comprehensive solution for condominium water consumption tracking, billing, and management.',
      contact: {
        name: 'AquaFlow Support',
        email: 'support@aquaflow.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000/api',
        description: 'Development server',
      },
      {
        url: 'https://api.aquaflow.com/api',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token for authentication. Use format: Bearer <token>',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'Error message',
            },
            error: {
              type: 'string',
              description: 'Error code or type',
            },
            details: {
              type: 'object',
              description: 'Additional error details',
            },
          },
          required: ['message'],
        },
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'User unique identifier',
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address',
            },
            name: {
              type: 'string',
              description: 'User full name',
            },
            phone: {
              type: 'string',
              nullable: true,
              description: 'User phone number',
            },
            role: {
              type: 'string',
              enum: ['SUPER_ADMIN', 'ADMIN', 'ANALYST', 'EDITOR', 'RESIDENT'],
              description: 'User role in the system',
            },
            isActive: {
              type: 'boolean',
              description: 'Whether the user is active',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'User creation timestamp',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'User last update timestamp',
            },
          },
          required: ['id', 'email', 'name', 'role', 'isActive'],
        },
        Condominium: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Condominium unique identifier',
            },
            name: {
              type: 'string',
              description: 'Condominium name',
            },
            address: {
              type: 'string',
              description: 'Condominium physical address',
            },
            city: {
              type: 'string',
              nullable: true,
              description: 'City where the condominium is located',
            },
            country: {
              type: 'string',
              nullable: true,
              description: 'Country where the condominium is located',
            },
            readingDay: {
              type: 'integer',
              minimum: 1,
              maximum: 31,
              nullable: true,
              description: 'Day of the month for meter readings',
            },
            bankAccount: {
              type: 'string',
              nullable: true,
              description: 'Bank account for payments',
            },
            bankAccountHolder: {
              type: 'string',
              nullable: true,
              description: 'Name of the bank account holder',
            },
            isActive: {
              type: 'boolean',
              description: 'Whether the condominium is active',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Creation timestamp',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp',
            },
          },
          required: ['id', 'name', 'address', 'isActive'],
        },
        Block: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Block unique identifier',
            },
            name: {
              type: 'string',
              description: 'Block name or identifier',
            },
            description: {
              type: 'string',
              nullable: true,
              description: 'Block description',
            },
            condominiumId: {
              type: 'string',
              format: 'uuid',
              description: 'ID of the condominium this block belongs to',
            },
            maxUnits: {
              type: 'integer',
              minimum: 1,
              nullable: true,
              description: 'Maximum number of units in this block',
            },
          },
          required: ['id', 'name', 'condominiumId'],
        },
        Unit: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Unit unique identifier',
            },
            name: {
              type: 'string',
              description: 'Unit name or number',
            },
            blockId: {
              type: 'string',
              format: 'uuid',
              description: 'ID of the block this unit belongs to',
            },
            residentId: {
              type: 'string',
              format: 'uuid',
              nullable: true,
              description: 'ID of the resident assigned to this unit',
            },
            area: {
              type: 'number',
              format: 'float',
              minimum: 0,
              nullable: true,
              description: 'Unit area in square meters',
            },
            isActive: {
              type: 'boolean',
              description: 'Whether the unit is active',
            },
          },
          required: ['id', 'name', 'blockId', 'isActive'],
        },
        Resident: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Resident unique identifier',
            },
            name: {
              type: 'string',
              description: 'Resident full name',
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'Resident email address',
            },
            phone: {
              type: 'string',
              nullable: true,
              description: 'Resident phone number',
            },
            document: {
              type: 'string',
              nullable: true,
              description: 'Resident identification document',
            },
            condominiumId: {
              type: 'string',
              format: 'uuid',
              description: 'ID of the condominium',
            },
            isActive: {
              type: 'boolean',
              description: 'Whether the resident is active',
            },
          },
          required: ['id', 'name', 'email', 'condominiumId', 'isActive'],
        },
        Period: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Period unique identifier',
            },
            name: {
              type: 'string',
              description: 'Period name (e.g., "March 2024")',
            },
            condominiumId: {
              type: 'string',
              format: 'uuid',
              description: 'ID of the condominium',
            },
            startDate: {
              type: 'string',
              format: 'date',
              description: 'Period start date',
            },
            endDate: {
              type: 'string',
              format: 'date',
              description: 'Period end date',
            },
            status: {
              type: 'string',
              enum: ['ACTIVE', 'CLOSED', 'PROCESSING'],
              description: 'Current status of the period',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Creation timestamp',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp',
            },
          },
          required: ['id', 'name', 'condominiumId', 'startDate', 'endDate', 'status'],
        },
        Reading: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Reading unique identifier',
            },
            unitId: {
              type: 'string',
              format: 'uuid',
              description: 'ID of the unit',
            },
            periodId: {
              type: 'string',
              format: 'uuid',
              description: 'ID of the billing period',
            },
            meterId: {
              type: 'string',
              format: 'uuid',
              description: 'ID of the water meter',
            },
            value: {
              type: 'number',
              format: 'float',
              minimum: 0,
              description: 'Meter reading value in cubic meters',
            },
            previousValue: {
              type: 'number',
              format: 'float',
              minimum: 0,
              nullable: true,
              description: 'Previous meter reading value',
            },
            consumption: {
              type: 'number',
              format: 'float',
              minimum: 0,
              nullable: true,
              description: 'Calculated consumption (current - previous)',
            },
            photo1: {
              type: 'string',
              nullable: true,
              description: 'URL of first photo taken',
            },
            photo2: {
              type: 'string',
              nullable: true,
              description: 'URL of second photo taken',
            },
            notes: {
              type: 'string',
              nullable: true,
              description: 'Additional notes about the reading',
            },
            isAnomalous: {
              type: 'boolean',
              description: 'Whether this reading is flagged as anomalous',
            },
            isValidated: {
              type: 'boolean',
              description: 'Whether this reading has been validated',
            },
            readingDate: {
              type: 'string',
              format: 'date-time',
              description: 'Date and time when reading was taken',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Creation timestamp',
            },
            validatedAt: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              description: 'Validation timestamp',
            },
            validatedBy: {
              type: 'string',
              format: 'uuid',
              nullable: true,
              description: 'ID of user who validated this reading',
            },
          },
          required: ['id', 'unitId', 'periodId', 'meterId', 'value', 'isAnomalous', 'isValidated', 'readingDate'],
        },
        Bill: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Bill unique identifier',
            },
            unitId: {
              type: 'string',
              format: 'uuid',
              description: 'ID of the unit',
            },
            periodId: {
              type: 'string',
              format: 'uuid',
              description: 'ID of the billing period',
            },
            consumption: {
              type: 'number',
              format: 'float',
              minimum: 0,
              description: 'Water consumption in cubic meters',
            },
            baseCost: {
              type: 'number',
              format: 'float',
              minimum: 0,
              description: 'Base cost calculation',
            },
            taxes: {
              type: 'number',
              format: 'float',
              minimum: 0,
              description: 'Applicable taxes',
            },
            totalAmount: {
              type: 'number',
              format: 'float',
              minimum: 0,
              description: 'Total amount to pay',
            },
            status: {
              type: 'string',
              enum: ['PENDING', 'PAID', 'OVERDUE', 'CANCELLED'],
              description: 'Payment status',
            },
            dueDate: {
              type: 'string',
              format: 'date',
              description: 'Payment due date',
            },
            paidAt: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              description: 'Payment timestamp',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Creation timestamp',
            },
          },
          required: ['id', 'unitId', 'periodId', 'consumption', 'baseCost', 'taxes', 'totalAmount', 'status', 'dueDate'],
        },
        Plan: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Plan unique identifier',
            },
            name: {
              type: 'string',
              description: 'Plan name',
              example: 'Per Unit Plan',
            },
            pricePerUnitPEN: {
              type: 'number',
              format: 'float',
              minimum: 0,
              description: 'Price per unit in Peruvian Soles',
              example: 1.0,
            },
            minimumUnits: {
              type: 'integer',
              minimum: 1,
              description: 'Minimum number of units to bill',
              example: 6,
            },
            isAnnualPrepaid: {
              type: 'boolean',
              description: 'Whether the plan is annual prepaid',
              example: true,
            },
            features: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'Plan features',
            },
            isActive: {
              type: 'boolean',
              description: 'Whether the plan is active',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Creation timestamp',
            },
          },
          required: ['id', 'name', 'pricePerUnitPEN', 'minimumUnits', 'isAnnualPrepaid', 'isActive'],
        },
        Subscription: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Subscription unique identifier',
            },
            condominiumId: {
              type: 'string',
              format: 'uuid',
              description: 'ID of the condominium',
            },
            planId: {
              type: 'string',
              format: 'uuid',
              description: 'ID of the plan',
            },
            unitsCount: {
              type: 'integer',
              minimum: 0,
              description: 'Actual number of units in the condominium',
              example: 8,
            },
            billingUnits: {
              type: 'integer',
              minimum: 0,
              description: 'Units to bill (max of unitsCount and minimumUnits)',
              example: 8,
            },
            monthlyAmount: {
              type: 'number',
              format: 'float',
              minimum: 0,
              description: 'Monthly amount in PEN',
              example: 8.0,
            },
            annualAmount: {
              type: 'number',
              format: 'float',
              minimum: 0,
              description: 'Annual amount in PEN',
              example: 96.0,
            },
            startDate: {
              type: 'string',
              format: 'date-time',
              description: 'Subscription start date',
            },
            endDate: {
              type: 'string',
              format: 'date-time',
              description: 'Subscription end date',
            },
            renewalDate: {
              type: 'string',
              format: 'date-time',
              description: 'Renewal reminder date',
            },
            status: {
              type: 'string',
              enum: ['PENDING', 'PAID', 'ACTIVE', 'EXPIRED', 'CANCELLED', 'SUSPENDED'],
              description: 'Subscription status',
            },
            paidAt: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              description: 'Payment date',
            },
            approvedAt: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              description: 'Approval date',
            },
            approvedBy: {
              type: 'string',
              format: 'uuid',
              nullable: true,
              description: 'ID of super admin who approved',
            },
            paymentMethod: {
              type: 'string',
              nullable: true,
              description: 'Payment method used',
              example: 'Transferencia bancaria',
            },
            paymentRef: {
              type: 'string',
              nullable: true,
              description: 'Payment reference',
              example: 'TXN-123456789',
            },
            paymentProof: {
              type: 'string',
              nullable: true,
              description: 'URL of payment proof',
            },
            notes: {
              type: 'string',
              nullable: true,
              description: 'Additional notes',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Creation timestamp',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp',
            },
          },
          required: ['id', 'condominiumId', 'planId', 'unitsCount', 'billingUnits', 'monthlyAmount', 'annualAmount', 'startDate', 'endDate', 'status'],
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and authorization endpoints',
      },
      {
        name: 'Users',
        description: 'User management endpoints',
      },
      {
        name: 'Condominiums',
        description: 'Condominium management endpoints',
      },
      {
        name: 'Blocks',
        description: 'Block management within condominiums',
      },
      {
        name: 'Units',
        description: 'Unit management within blocks',
      },
      {
        name: 'Residents',
        description: 'Resident management endpoints',
      },
      {
        name: 'Periods',
        description: 'Billing period management endpoints',
      },
      {
        name: 'Readings',
        description: 'Water meter reading endpoints',
      },
      {
        name: 'Bills',
        description: 'Billing and payment endpoints',
      },
      {
        name: 'Admin',
        description: 'Administrative endpoints',
      },
      {
        name: 'Subscriptions',
        description: 'Subscription and pricing management endpoints',
      },
    ],
  },
  apis: [
    './src/routes/*.ts',
    './src/controllers/*.ts',
  ],
};

export const specs = swaggerJsdoc(options);