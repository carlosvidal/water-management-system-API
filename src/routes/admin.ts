import express from 'express';
import { z } from 'zod';
import { UserRole } from '@prisma/client';
import { prisma } from '../index';
import { createError, asyncHandler } from '../middleware/errorHandler';
import { authenticate, requireRole } from '../middleware/auth';
import { hashPassword } from '../utils/password';
// import { SubscriptionService } from '../services/subscription.service';
import { formatPricePEN } from '../utils/pricing';

const router = express.Router();
// const subscriptionService = new SubscriptionService();

// All admin routes require authentication and SUPER_ADMIN role
router.use(authenticate);
router.use(requireRole(UserRole.SUPER_ADMIN));

// Validation schemas
const createPlanSchema = z.object({
  name: z.string().min(1, 'Plan name is required').default('Per Unit Plan'),
  pricePerUnitPEN: z.number().min(0, 'Price per unit must be non-negative').default(1.0),
  minimumUnits: z.number().min(1, 'Minimum units must be at least 1').default(6),
  isAnnualPrepaid: z.boolean().default(true),
  features: z.array(z.string()).default([]),
});

const updatePlanSchema = createPlanSchema.partial();

const createCondominiumSchema = z.object({
  name: z.string().min(1, 'Condominium name is required'),
  address: z.string().min(1, 'Address is required'),
  city: z.string().optional(),
  country: z.string().optional(),
  planId: z.string().min(1, 'Plan ID is required'),
  readingDay: z.number().min(1).max(31).optional(),
  bankAccount: z.string().optional(),
  bankAccountHolder: z.string().optional(),
  adminUser: z.object({
    name: z.string().min(1, 'Admin name is required'),
    email: z.string().email('Invalid email format'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    phone: z.string().optional(),
  }),
});

// ============== PLANS MANAGEMENT ==============

// Get all plans
router.get('/plans', asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const search = req.query.search as string;
  const isActive = req.query.isActive as string;

  const where: any = {};
  
  if (search) {
    where.name = { contains: search, mode: 'insensitive' };
  }
  
  if (isActive !== undefined) {
    where.isActive = isActive === 'true';
  }

  const [plans, total] = await Promise.all([
    prisma.plan.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { condominiums: true },
        },
      },
    }),
    prisma.plan.count({ where }),
  ]);

  res.json({
    plans,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  });
}));

// Get plan by ID
router.get('/plans/:id', asyncHandler(async (req, res) => {
  const plan = await prisma.plan.findUnique({
    where: { id: req.params.id },
    include: {
      condominiums: {
        select: {
          id: true,
          name: true,
          address: true,
          isActive: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      },
      _count: {
        select: { condominiums: true },
      },
    },
  });

  if (!plan) {
    throw createError('Plan not found', 404);
  }

  res.json(plan);
}));

// Create new plan
router.post('/plans', asyncHandler(async (req, res) => {
  const data = createPlanSchema.parse(req.body);

  const plan = await prisma.plan.create({
    data: data as any,
  });

  // Log action
  await prisma.auditLog.create({
    data: {
      userId: req.user!.id,
      action: 'CREATE',
      entity: 'Plan',
      entityId: plan.id,
      newData: plan,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    },
  });

  res.status(201).json(plan);
}));

// Update plan
router.put('/plans/:id', asyncHandler(async (req, res) => {
  const data = updatePlanSchema.parse(req.body);

  const existingPlan = await prisma.plan.findUnique({
    where: { id: req.params.id },
  });

  if (!existingPlan) {
    throw createError('Plan not found', 404);
  }

  const updatedPlan = await prisma.plan.update({
    where: { id: req.params.id },
    data,
  });

  // Log action
  await prisma.auditLog.create({
    data: {
      userId: req.user!.id,
      action: 'UPDATE',
      entity: 'Plan',
      entityId: updatedPlan.id,
      oldData: existingPlan,
      newData: updatedPlan,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    },
  });

  res.json(updatedPlan);
}));

// Toggle plan status
router.put('/plans/:id/status', asyncHandler(async (req, res) => {
  const plan = await prisma.plan.findUnique({
    where: { id: req.params.id },
  });

  if (!plan) {
    throw createError('Plan not found', 404);
  }

  const updatedPlan = await prisma.plan.update({
    where: { id: req.params.id },
    data: { isActive: !plan.isActive },
  });

  // Log action
  await prisma.auditLog.create({
    data: {
      userId: req.user!.id,
      action: 'UPDATE',
      entity: 'Plan',
      entityId: updatedPlan.id,
      oldData: { isActive: plan.isActive },
      newData: { isActive: updatedPlan.isActive },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    },
  });

  res.json(updatedPlan);
}));

// ============== CONDOMINIUMS MANAGEMENT ==============

// Get all condominiums
router.get('/condominiums', asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const search = req.query.search as string;
  const isActive = req.query.isActive as string;
  const planId = req.query.planId as string;
  const expiring = req.query.expiring as string; // soon, expired

  const where: any = {};
  
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { address: { contains: search, mode: 'insensitive' } },
    ];
  }
  
  if (isActive !== undefined) {
    where.isActive = isActive === 'true';
  }

  if (planId) {
    where.planId = planId;
  }

  if (expiring === 'soon') {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    where.expiresAt = { lte: thirtyDaysFromNow };
  } else if (expiring === 'expired') {
    where.expiresAt = { lt: new Date() };
  }

  const [condominiums, total] = await Promise.all([
    prisma.condominium.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
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
        _count: {
          select: {
            blocks: true,
            residents: true,
            periods: true,
          },
        },
      },
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

// Get condominium by ID
router.get('/condominiums/:id', asyncHandler(async (req, res) => {
  const condominium = await prisma.condominium.findUnique({
    where: { id: req.params.id },
    include: {
      plan: true,
      blocks: {
        include: {
          _count: {
            select: { units: true },
          },
        },
      },
      condominiumUsers: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              isActive: true,
            },
          },
        },
      },
      _count: {
        select: {
          residents: true,
          periods: true,
        },
      },
    },
  });

  if (!condominium) {
    throw createError('Condominium not found', 404);
  }

  res.json(condominium);
}));

// Create new condominium
router.post('/condominiums', asyncHandler(async (req, res) => {
  const data = createCondominiumSchema.parse(req.body);

  // Verify plan exists and is active
  const plan = await prisma.plan.findUnique({
    where: { id: data.planId },
  });

  if (!plan || !plan.isActive) {
    throw createError('Invalid or inactive plan', 400);
  }

  // Check if admin email already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: data.adminUser.email.toLowerCase() },
  });

  if (existingUser) {
    throw createError('Admin email already exists', 400);
  }

  // Create everything in a transaction
  const result = await prisma.$transaction(async (tx) => {
    // Create admin user
    const hashedPassword = await hashPassword(data.adminUser.password);
    const adminUser = await tx.user.create({
      data: {
        name: data.adminUser.name,
        email: data.adminUser.email.toLowerCase(),
        password: hashedPassword,
        phone: data.adminUser.phone,
        role: UserRole.ADMIN,
      },
    });

    // Create condominium
    const condominium = await tx.condominium.create({
      data: {
        name: data.name,
        address: data.address,
        city: data.city,
        country: data.country,
        planId: data.planId,
        readingDay: data.readingDay,
        bankAccount: data.bankAccount,
        bankAccountHolder: data.bankAccountHolder,
      },
    });

    // Link admin user to condominium
    await tx.condominiumUser.create({
      data: {
        userId: adminUser.id,
        condominiumId: condominium.id,
        role: UserRole.ADMIN,
      },
    });

    return { condominium, adminUser };
  });

  // Log action
  await prisma.auditLog.create({
    data: {
      userId: req.user!.id,
      action: 'CREATE',
      entity: 'Condominium',
      entityId: result.condominium.id,
      newData: result.condominium,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    },
  });

  res.status(201).json({
    condominium: result.condominium,
    adminUser: {
      id: result.adminUser.id,
      name: result.adminUser.name,
      email: result.adminUser.email,
      phone: result.adminUser.phone,
    },
  });
}));

// Toggle condominium status
router.put('/condominiums/:id/status', asyncHandler(async (req, res) => {
  const condominium = await prisma.condominium.findUnique({
    where: { id: req.params.id },
  });

  if (!condominium) {
    throw createError('Condominium not found', 404);
  }

  const updatedCondominium = await prisma.condominium.update({
    where: { id: req.params.id },
    data: { isActive: !condominium.isActive },
  });

  // Log action
  await prisma.auditLog.create({
    data: {
      userId: req.user!.id,
      action: 'UPDATE',
      entity: 'Condominium',
      entityId: updatedCondominium.id,
      oldData: { isActive: condominium.isActive },
      newData: { isActive: updatedCondominium.isActive },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    },
  });

  res.json(updatedCondominium);
}));

// ============== DASHBOARD METRICS ==============

router.get('/dashboard/metrics', asyncHandler(async (req, res) => {
  const [
    totalCondominiums,
    activeCondominiums,
    totalPlans,
    activePlans,
    totalUsers,
    activeUsers,
    subscriptionStats,
  ] = await Promise.all([
    prisma.condominium.count(),
    prisma.condominium.count({ where: { isActive: true } }),
    prisma.plan.count(),
    prisma.plan.count({ where: { isActive: true } }),
    prisma.user.count(),
    prisma.user.count({ where: { isActive: true } }),
    // subscriptionService.getSubscriptionStats(),
    Promise.resolve({ total: 0, active: 0, pending: 0, expired: 0, totalRevenue: 0 }),
  ]);

  // Calculate total units across all active condominiums
  const totalUnitsData = await prisma.condominium.findMany({
    where: { isActive: true },
    include: {
      blocks: {
        include: {
          units: {
            where: { isActive: true }
          }
        }
      }
    }
  });

  const totalUnits = totalUnitsData.reduce((sum, condo) => 
    sum + condo.blocks.reduce((blockSum, block) => 
      blockSum + block.units.length, 0
    ), 0
  );

  // Get default pricing info
  const defaultPlan = await prisma.plan.findFirst({
    where: { isActive: true }
  });

  const pricePerUnit = defaultPlan?.pricePerUnitPEN || 1.0;
  const estimatedMonthlyRevenue = totalUnits * pricePerUnit;

  res.json({
    condominiums: {
      total: totalCondominiums,
      active: activeCondominiums,
    },
    plans: {
      total: totalPlans,
      active: activePlans,
    },
    users: {
      total: totalUsers,
      active: activeUsers,
    },
    subscriptions: subscriptionStats,
    units: {
      total: totalUnits,
      pricePerUnit: pricePerUnit,
      currency: 'PEN',
    },
    revenue: {
      estimated: estimatedMonthlyRevenue,
      annual: subscriptionStats.totalRevenue,
      currency: 'PEN',
      formatted: {
        estimated: formatPricePEN(estimatedMonthlyRevenue),
        annual: formatPricePEN(subscriptionStats.totalRevenue),
      }
    },
  });
}));

export default router;