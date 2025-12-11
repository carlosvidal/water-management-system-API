import express from 'express';
import { z } from 'zod';
import { UserRole, BillStatus } from '@prisma/client';
import { prisma } from '../index';
import { createError, asyncHandler } from '../middleware/errorHandler';
import { authenticate, requireCondominiumAccess } from '../middleware/auth';
import { CalculationService } from '../services/calculationService';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

const calculationService = new CalculationService(prisma);

// Validation schemas
const calculatePeriodSchema = z.object({
  periodId: z.string().min(1, 'Period ID is required'),
});

const updateBillStatusSchema = z.object({
  status: z.enum([BillStatus.PENDING, BillStatus.SENT, BillStatus.PAID, BillStatus.OVERDUE]),
  paidAt: z.string().datetime().optional(),
});

// ============== CALCULATION ENDPOINTS ==============

// Calculate bills for a period
router.post('/calculate', asyncHandler(async (req, res) => {
  const { periodId } = calculatePeriodSchema.parse(req.body);

  // Get period to check condominium access
  const period = await prisma.period.findUnique({
    where: { id: periodId },
    select: { condominiumId: true },
  });

  if (!period) {
    throw createError('Period not found', 404);
  }

  // Check access to condominium - only ADMIN can calculate bills
  if (req.user!.role !== UserRole.SUPER_ADMIN) {
    const hasAccess = req.condominiumAccess?.some(
      access => access.condominiumId === period.condominiumId &&
      access.role === UserRole.ADMIN
    );

    if (!hasAccess) {
      throw createError('Access denied. Only administrators can calculate bills.', 403);
    }
  }

  // Validate period is ready for calculation
  const validation = await calculationService.validatePeriodForCalculation(periodId);
  if (!validation.isValid) {
    return res.status(400).json({
      error: 'Period is not ready for calculation',
      validationErrors: validation.errors,
    });
  }

  try {
    // Perform calculation
    const calculationResult = await calculationService.calculatePeriodBills(periodId);
    
    // Save bills to database
    await calculationService.saveBills(periodId, calculationResult);

    // Log action
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'CALCULATE',
        entity: 'Period',
        entityId: periodId,
        newData: {
          totalBills: calculationResult.bills.length,
          totalAmount: calculationResult.bills.reduce((sum, bill) => sum + bill.totalCost, 0),
          anomalies: calculationResult.anomalies,
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });

    res.json({
      success: true,
      message: 'Bills calculated and saved successfully',
      summary: {
        totalBills: calculationResult.bills.length,
        totalIndividualConsumption: calculationResult.totalIndividualConsumption,
        commonAreaConsumption: calculationResult.commonAreaConsumption,
        commonAreaCostPerUnit: calculationResult.commonAreaCostPerUnit,
        totalAmount: calculationResult.bills.reduce((sum, bill) => sum + bill.totalCost, 0),
        anomalies: calculationResult.anomalies,
      },
    });
  } catch (error) {
    throw createError(`Calculation failed: ${error.message}`, 500);
  }
}));

// Get calculation preview (without saving)
router.post('/preview', asyncHandler(async (req, res) => {
  const { periodId } = calculatePeriodSchema.parse(req.body);

  // Get period to check condominium access
  const period = await prisma.period.findUnique({
    where: { id: periodId },
    select: { condominiumId: true },
  });

  if (!period) {
    throw createError('Period not found', 404);
  }

  // Check access to condominium
  if (req.user!.role !== UserRole.SUPER_ADMIN) {
    const hasAccess = req.condominiumAccess?.some(
      access => access.condominiumId === period.condominiumId
    );
    
    if (!hasAccess) {
      throw createError('Access denied to preview calculations for this period', 403);
    }
  }

  try {
    const calculationResult = await calculationService.calculatePeriodBills(periodId);
    res.json(calculationResult);
  } catch (error) {
    throw createError(`Preview calculation failed: ${error.message}`, 400);
  }
}));

// Get calculation summary for a period
router.get('/summary/:periodId', asyncHandler(async (req, res) => {
  const periodId = req.params.periodId;

  // Get period to check condominium access
  const period = await prisma.period.findUnique({
    where: { id: periodId },
    select: { condominiumId: true },
  });

  if (!period) {
    throw createError('Period not found', 404);
  }

  // Check access to condominium
  if (req.user!.role !== UserRole.SUPER_ADMIN) {
    const hasAccess = req.condominiumAccess?.some(
      access => access.condominiumId === period.condominiumId
    );
    
    if (!hasAccess) {
      throw createError('Access denied to this period', 403);
    }
  }

  const summary = await calculationService.getCalculationSummary(periodId);
  res.json(summary);
}));

// ============== BILLS MANAGEMENT ==============

// Get bills for a period
router.get('/period/:periodId', asyncHandler(async (req, res) => {
  const periodId = req.params.periodId;

  // Get period to check condominium access
  const period = await prisma.period.findUnique({
    where: { id: periodId },
    select: { condominiumId: true },
  });

  if (!period) {
    throw createError('Period not found', 404);
  }

  // Check access to condominium
  if (req.user!.role !== UserRole.SUPER_ADMIN) {
    const hasAccess = req.condominiumAccess?.some(
      access => access.condominiumId === period.condominiumId
    );
    
    if (!hasAccess) {
      throw createError('Access denied to this period', 403);
    }
  }

  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const status = req.query.status as BillStatus;

  const where: any = {
    periodId,
  };

  if (status) {
    where.status = status;
  }

  const [bills, total] = await Promise.all([
    prisma.bill.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        unit: {
          include: {
            block: {
              select: {
                name: true,
              },
            },
            resident: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
              },
            },
          },
        },
        period: {
          select: {
            id: true,
            startDate: true,
            endDate: true,
            condominium: {
              select: {
                name: true,
                address: true,
              },
            },
          },
        },
      },
      orderBy: [
        { unit: { block: { name: 'asc' } } },
        { unit: { name: 'asc' } },
      ],
    }),
    prisma.bill.count({ where }),
  ]);

  res.json({
    bills,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  });
}));

// Get bills for a specific unit
router.get('/unit/:unitId', asyncHandler(async (req, res) => {
  const unitId = req.params.unitId;

  // Get unit to check condominium access
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    include: {
      block: {
        select: {
          condominiumId: true,
        },
      },
    },
  });

  if (!unit) {
    throw createError('Unit not found', 404);
  }

  // Check access to condominium
  if (req.user!.role !== UserRole.SUPER_ADMIN) {
    const hasAccess = req.condominiumAccess?.some(
      access => access.condominiumId === unit.block.condominiumId
    );
    
    if (!hasAccess) {
      throw createError('Access denied to this unit', 403);
    }
  }

  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;

  const [bills, total] = await Promise.all([
    prisma.bill.findMany({
      where: { unitId },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        period: {
          select: {
            id: true,
            startDate: true,
            endDate: true,
            status: true,
          },
        },
        unit: {
          include: {
            block: {
              select: {
                name: true,
              },
            },
            resident: {
              select: {
                name: true,
                email: true,
                phone: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.bill.count({ where: { unitId } }),
  ]);

  res.json({
    bills,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  });
}));

// Get single bill details
router.get('/:billId', asyncHandler(async (req, res) => {
  const bill = await prisma.bill.findUnique({
    where: { id: req.params.billId },
    include: {
      unit: {
        include: {
          block: {
            select: {
              name: true,
              condominiumId: true,
            },
          },
          resident: {
            select: {
              name: true,
              email: true,
              phone: true,
            },
          },
        },
      },
      period: {
        select: {
          id: true,
          startDate: true,
          endDate: true,
          status: true,
          condominium: {
            select: {
              name: true,
              address: true,
              bankAccount: true,
              bankAccountHolder: true,
            },
          },
        },
      },
    },
  });

  if (!bill) {
    throw createError('Bill not found', 404);
  }

  // Check access to condominium
  if (req.user!.role !== UserRole.SUPER_ADMIN) {
    const hasAccess = req.condominiumAccess?.some(
      access => access.condominiumId === bill.unit.block.condominiumId
    );
    
    if (!hasAccess) {
      throw createError('Access denied to this bill', 403);
    }
  }

  res.json(bill);
}));

// Update bill status
router.put('/:billId/status', asyncHandler(async (req, res) => {
  const data = updateBillStatusSchema.parse(req.body);

  const bill = await prisma.bill.findUnique({
    where: { id: req.params.billId },
    include: {
      unit: {
        include: {
          block: {
            select: {
              condominiumId: true,
            },
          },
        },
      },
    },
  });

  if (!bill) {
    throw createError('Bill not found', 404);
  }

  // Check access to condominium - only ADMIN can update bill status
  if (req.user!.role !== UserRole.SUPER_ADMIN) {
    const hasAccess = req.condominiumAccess?.some(
      access => access.condominiumId === bill.unit.block.condominiumId &&
      access.role === UserRole.ADMIN
    );

    if (!hasAccess) {
      throw createError('Access denied. Only administrators can update bill status.', 403);
    }
  }

  const updateData: any = {
    status: data.status,
  };

  if (data.status === BillStatus.PAID && data.paidAt) {
    updateData.paidAt = new Date(data.paidAt);
  } else if (data.status === BillStatus.PAID && !data.paidAt) {
    updateData.paidAt = new Date();
  } else if (data.status !== BillStatus.PAID) {
    updateData.paidAt = null;
  }

  const updatedBill = await prisma.bill.update({
    where: { id: req.params.billId },
    data: updateData,
  });

  res.json(updatedBill);
}));

// ============== REPORTS ==============

// Get billing summary for condominium
router.get('/condominium/:condominiumId/summary', 
  requireCondominiumAccess(), 
  asyncHandler(async (req, res) => {
    const condominiumId = req.params.condominiumId;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    const where: any = {
      period: {
        condominiumId,
      },
    };

    if (startDate || endDate) {
      where.period.startDate = {};
      if (startDate) where.period.startDate.gte = new Date(startDate);
      if (endDate) where.period.startDate.lte = new Date(endDate);
    }

    const [
      totalBills,
      totalAmount,
      paidAmount,
      pendingAmount,
      overdueAmount,
      statusBreakdown,
    ] = await Promise.all([
      prisma.bill.count({ where }),
      prisma.bill.aggregate({
        where,
        _sum: { totalCost: true },
      }),
      prisma.bill.aggregate({
        where: { ...where, status: BillStatus.PAID },
        _sum: { totalCost: true },
      }),
      prisma.bill.aggregate({
        where: { ...where, status: BillStatus.PENDING },
        _sum: { totalCost: true },
      }),
      prisma.bill.aggregate({
        where: { ...where, status: BillStatus.OVERDUE },
        _sum: { totalCost: true },
      }),
      prisma.bill.groupBy({
        where,
        by: ['status'],
        _count: { status: true },
        _sum: { totalCost: true },
      }),
    ]);

    res.json({
      totalBills,
      totalAmount: totalAmount._sum.totalCost || 0,
      paidAmount: paidAmount._sum.totalCost || 0,
      pendingAmount: pendingAmount._sum.totalCost || 0,
      overdueAmount: overdueAmount._sum.totalCost || 0,
      statusBreakdown,
    });
  })
);

export default router;