import express from 'express';
import { z } from 'zod';
import { UserRole, PeriodStatus } from '@prisma/client';
import { prisma } from '../index';
import { createError, asyncHandler } from '../middleware/errorHandler';
import { authenticate, requireCondominiumAccess } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Validation schemas
const createPeriodSchema = z.object({
  condominiumId: z.string().min(1, 'Condominium ID is required'),
  startDate: z.string().datetime('Invalid start date'),
});

const createReadingSchema = z.object({
  meterId: z.string().min(1, 'Meter ID is required'),
  value: z.number().min(0, 'Reading value must be non-negative'),
  photo1: z.string().url().optional(),
  photo2: z.string().url().optional(),
  ocrValue: z.number().min(0).optional(),
  ocrConfidence: z.number().min(0).max(1).optional(),
  notes: z.string().optional().nullable(),
  isValidated: z.boolean().optional(),
  isAnomalous: z.boolean().optional(),
});

const updateReceiptSchema = z.object({
  totalVolume: z.number().min(0, 'Total volume must be non-negative'),
  totalAmount: z.number().min(0, 'Total amount must be non-negative'),
  receiptPhoto1: z.string().url().optional(),
  receiptPhoto2: z.string().url().optional(),
});

const updatePeriodSchema = z.object({
  startDate: z.string().datetime('Invalid start date').optional(),
  endDate: z.string().datetime('Invalid end date').optional(),
  status: z.enum(['OPEN', 'PENDING_RECEIPT', 'CALCULATING', 'CLOSED']).optional(),
  totalVolume: z.number().min(0, 'Total volume must be non-negative').optional(),
  totalAmount: z.number().min(0, 'Total amount must be non-negative').optional(),
  receiptPhoto1: z.string().url().optional(),
  receiptPhoto2: z.string().url().optional(),
});

const validateReadingSchema = z.object({
  isValidated: z.boolean(),
  isAnomalous: z.boolean(),
  notes: z.string().optional().nullable(),
});

const updateReadingSchema = z.object({
  value: z.number().min(0, 'Reading value must be non-negative'),
  photo1: z.string().url().optional(),
  photo2: z.string().url().optional(),
  ocrValue: z.number().min(0).optional(),
  ocrConfidence: z.number().min(0).max(1).optional(),
  notes: z.string().optional().nullable(),
  isValidated: z.boolean().optional(),
  isAnomalous: z.boolean().optional(),
});

// ============== PERIODS MANAGEMENT ==============

// Create new period
router.post('/', asyncHandler(async (req, res) => {
  const data = createPeriodSchema.parse(req.body);
  
  // Verify user has access to this condominium
  if (req.user!.role !== UserRole.SUPER_ADMIN) {
    const hasAccess = req.condominiumAccess?.some(
      access => access.condominiumId === data.condominiumId && 
      [UserRole.ADMIN, UserRole.ANALYST].includes(access.role)
    );
    
    if (!hasAccess) {
      throw createError('Access denied to this condominium', 403);
    }
  }

  // Check if condominium has an open period
  const openPeriod = await prisma.period.findFirst({
    where: {
      condominiumId: data.condominiumId,
      status: PeriodStatus.OPEN,
    },
  });

  if (openPeriod) {
    throw createError('Condominium already has an open period', 400);
  }

  // Verify condominium exists and is active
  const condominium = await prisma.condominium.findUnique({
    where: { id: data.condominiumId },
  });

  if (!condominium || !condominium.isActive) {
    throw createError('Condominium not found or inactive', 404);
  }

  const period = await prisma.period.create({
    data: {
      condominiumId: data.condominiumId,
      startDate: new Date(data.startDate),
      status: PeriodStatus.OPEN,
    },
    include: {
      condominium: {
        select: {
          id: true,
          name: true,
          address: true,
        },
      },
    },
  });

  // Log action
  await prisma.auditLog.create({
    data: {
      userId: req.user!.id,
      action: 'CREATE',
      entity: 'Period',
      entityId: period.id,
      newData: period,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    },
  });

  res.status(201).json(period);
}));

// Get periods for condominium
router.get('/condominium/:condominiumId', 
  requireCondominiumAccess(),
  asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as PeriodStatus;

    const where: any = {
      condominiumId: req.params.condominiumId,
    };

    if (status) {
      where.status = status;
    }

    const [periods, total] = await Promise.all([
      prisma.period.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          _count: {
            select: {
              readings: true,
              bills: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.period.count({ where }),
    ]);

    res.json({
      periods,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  })
);

// Get period details
router.get('/:id', asyncHandler(async (req, res) => {
  const period = await prisma.period.findUnique({
    where: { id: req.params.id },
    include: {
      condominium: {
        select: {
          id: true,
          name: true,
          address: true,
        },
      },
      readings: {
        include: {
          meter: {
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
                    },
                  },
                },
              },
            },
          },
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
      _count: {
        select: {
          readings: true,
          bills: true,
        },
      },
    },
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

  res.json(period);
}));

// Update period
router.put('/:id', asyncHandler(async (req, res) => {
  const data = updatePeriodSchema.parse(req.body);

  const period = await prisma.period.findUnique({
    where: { id: req.params.id },
  });

  if (!period) {
    throw createError('Period not found', 404);
  }

  // Check access to condominium
  if (req.user!.role !== UserRole.SUPER_ADMIN) {
    const hasAccess = req.condominiumAccess?.some(
      access => access.condominiumId === period.condominiumId && 
      [UserRole.ADMIN, UserRole.ANALYST].includes(access.role)
    );
    
    if (!hasAccess) {
      throw createError('Access denied to this period', 403);
    }
  }

  // Only allow updates if period is OPEN (for safety)
  if (period.status !== PeriodStatus.OPEN) {
    throw createError('Only open periods can be updated', 400);
  }

  // Prepare update data
  const updateData: any = {
    updatedAt: new Date(),
  };

  if (data.startDate) {
    updateData.startDate = new Date(data.startDate);
  }
  
  if (data.endDate) {
    updateData.endDate = new Date(data.endDate);
  }
  
  if (data.status) {
    updateData.status = data.status;
  }
  
  if (data.totalVolume !== undefined) {
    updateData.totalVolume = data.totalVolume;
  }
  
  if (data.totalAmount !== undefined) {
    updateData.totalAmount = data.totalAmount;
  }
  
  if (data.receiptPhoto1) {
    updateData.receiptPhoto1 = data.receiptPhoto1;
  }
  
  if (data.receiptPhoto2) {
    updateData.receiptPhoto2 = data.receiptPhoto2;
  }

  const updatedPeriod = await prisma.period.update({
    where: { id: req.params.id },
    data: updateData,
    include: {
      condominium: {
        select: {
          id: true,
          name: true,
          address: true,
        },
      },
    },
  });

  // Log action
  await prisma.auditLog.create({
    data: {
      userId: req.user!.id,
      action: 'UPDATE',
      entity: 'Period',
      entityId: period.id,
      oldData: period,
      newData: updatedPeriod,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    },
  });

  res.json(updatedPeriod);
}));

// Delete period
router.delete('/:id', asyncHandler(async (req, res) => {
  const period = await prisma.period.findUnique({
    where: { id: req.params.id },
    include: {
      readings: true,
      bills: true,
    },
  });

  if (!period) {
    throw createError('Period not found', 404);
  }

  // Check access to condominium
  if (req.user!.role !== UserRole.SUPER_ADMIN) {
    const hasAccess = req.condominiumAccess?.some(
      access => access.condominiumId === period.condominiumId && 
      [UserRole.ADMIN].includes(access.role) // Only ADMIN can delete
    );
    
    if (!hasAccess) {
      throw createError('Access denied to delete this period', 403);
    }
  }

  // Temporarily allow deletion of any period for testing
  // TODO: Restore restriction to OPEN periods only in production
  // if (period.status !== PeriodStatus.OPEN) {
  //   throw createError('Only open periods can be deleted', 400);
  // }

  // Delete all related readings first (cascade delete)
  await prisma.reading.deleteMany({
    where: { periodId: req.params.id },
  });

  // Delete all related bills if any
  await prisma.bill.deleteMany({
    where: { periodId: req.params.id },
  });

  // Delete the period
  await prisma.period.delete({
    where: { id: req.params.id },
  });

  // Log action
  await prisma.auditLog.create({
    data: {
      userId: req.user!.id,
      action: 'DELETE',
      entity: 'Period',
      entityId: period.id,
      oldData: period,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    },
  });

  res.status(204).send();
}));

// Reset period status to OPEN (temporary helper)
router.put('/:id/reset', asyncHandler(async (req, res) => {
  const period = await prisma.period.findUnique({
    where: { id: req.params.id },
  });

  if (!period) {
    throw createError('Period not found', 404);
  }

  // Check access to condominium
  if (req.user!.role !== UserRole.SUPER_ADMIN) {
    const hasAccess = req.condominiumAccess?.some(
      access => access.condominiumId === period.condominiumId && 
      [UserRole.ADMIN, UserRole.ANALYST].includes(access.role)
    );
    
    if (!hasAccess) {
      throw createError('Access denied to reset this period', 403);
    }
  }

  const updatedPeriod = await prisma.period.update({
    where: { id: req.params.id },
    data: {
      status: PeriodStatus.OPEN,
      updatedAt: new Date(),
    },
    include: {
      condominium: {
        select: {
          id: true,
          name: true,
          address: true,
        },
      },
    },
  });

  res.json(updatedPeriod);
}));

// Close period
router.put('/:id/close', asyncHandler(async (req, res) => {
  const period = await prisma.period.findUnique({
    where: { id: req.params.id },
    include: {
      readings: true,
    },
  });

  if (!period) {
    throw createError('Period not found', 404);
  }

  // Check access to condominium
  if (req.user!.role !== UserRole.SUPER_ADMIN) {
    const hasAccess = req.condominiumAccess?.some(
      access => access.condominiumId === period.condominiumId && 
      [UserRole.ADMIN, UserRole.ANALYST].includes(access.role)
    );
    
    if (!hasAccess) {
      throw createError('Access denied to close this period', 403);
    }
  }

  if (period.status === PeriodStatus.CLOSED) {
    throw createError('Period is already closed', 400);
  }

  // Verify all readings are validated before closing
  const unvalidatedReadings = await prisma.reading.count({
    where: {
      periodId: req.params.id,
      isValidated: false,
    },
  });

  if (unvalidatedReadings > 0) {
    throw createError(`Cannot close period: ${unvalidatedReadings} readings are not validated`, 400);
  }

  const updatedPeriod = await prisma.period.update({
    where: { id: req.params.id },
    data: {
      status: PeriodStatus.CLOSED,
      endDate: new Date(),
      updatedAt: new Date(),
    },
    include: {
      condominium: {
        select: {
          id: true,
          name: true,
          address: true,
        },
      },
    },
  });

  // Log action
  await prisma.auditLog.create({
    data: {
      userId: req.user!.id,
      action: 'UPDATE',
      entity: 'Period',
      entityId: period.id,
      oldData: period,
      newData: updatedPeriod,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    },
  });

  res.json(updatedPeriod);
}));

// Update period receipt info
router.put('/:id/receipt', asyncHandler(async (req, res) => {
  const data = updateReceiptSchema.parse(req.body);

  const period = await prisma.period.findUnique({
    where: { id: req.params.id },
  });

  if (!period) {
    throw createError('Period not found', 404);
  }

  // Check access to condominium
  if (req.user!.role !== UserRole.SUPER_ADMIN) {
    const hasAccess = req.condominiumAccess?.some(
      access => access.condominiumId === period.condominiumId && 
      [UserRole.ADMIN, UserRole.ANALYST].includes(access.role)
    );
    
    if (!hasAccess) {
      throw createError('Access denied to this period', 403);
    }
  }

  if (period.status !== PeriodStatus.PENDING_RECEIPT) {
    throw createError('Period is not ready for receipt data', 400);
  }

  const updatedPeriod = await prisma.period.update({
    where: { id: req.params.id },
    data: {
      ...data,
      status: PeriodStatus.CALCULATING,
      updatedAt: new Date(),
    },
  });

  res.json(updatedPeriod);
}));

// ============== READINGS MANAGEMENT ==============

// Create reading
router.post('/:periodId/readings', asyncHandler(async (req, res) => {
  const data = createReadingSchema.parse(req.body);

  const period = await prisma.period.findUnique({
    where: { id: req.params.periodId },
    include: {
      condominium: {
        select: {
          id: true,
          name: true,
        },
      },
    },
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

  if (period.status !== PeriodStatus.OPEN) {
    throw createError('Period is not open for new readings', 400);
  }

  // Verify meter exists and belongs to the condominium
  const meter = await prisma.meter.findFirst({
    where: {
      id: data.meterId,
      unit: {
        block: {
          condominiumId: period.condominiumId,
        },
      },
    },
    include: {
      unit: {
        include: {
          block: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  if (!meter) {
    throw createError('Meter not found in this condominium', 404);
  }

  // Check if reading already exists for this meter and period
  const existingReading = await prisma.reading.findUnique({
    where: {
      meterId_periodId: {
        meterId: data.meterId,
        periodId: req.params.periodId,
      },
    },
  });

  if (existingReading) {
    throw createError('Reading already exists for this meter in this period', 400);
  }

  // Get previous reading for validation
  const previousReading = await prisma.reading.findFirst({
    where: {
      meterId: data.meterId,
      period: {
        condominiumId: period.condominiumId,
        status: PeriodStatus.CLOSED,
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Validate reading value (only if not explicitly set)
  let isAnomalous = data.isAnomalous ?? false;
  if (data.isAnomalous === undefined && previousReading && data.value < previousReading.value) {
    // Reading is lower than previous (possible meter replacement) - only auto-detect if not set
    isAnomalous = true;
  }

  // Default validation status (auto-validate if not specified)
  const isValidated = data.isValidated ?? true;

  const reading = await prisma.reading.create({
    data: {
      meterId: data.meterId,
      value: data.value,
      photo1: data.photo1,
      photo2: data.photo2,
      ocrValue: data.ocrValue,
      ocrConfidence: data.ocrConfidence,
      notes: data.notes,
      periodId: req.params.periodId,
      userId: req.user!.id,
      isValidated,
      isAnomalous,
    },
    include: {
      meter: {
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
                  name: true,
                },
              },
            },
          },
        },
      },
      user: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  // Check if all units have been read
  const totalUnits = await prisma.unit.count({
    where: {
      block: {
        condominiumId: period.condominiumId,
      },
      isActive: true,
    },
  });

  const readingsCount = await prisma.reading.count({
    where: { periodId: req.params.periodId },
  });

  // TODO: Make this conditional based on period type (first period vs normal)
  // For now, keep periods in OPEN status to allow manual closure
  // Update period status if all readings are complete
  // if (readingsCount >= totalUnits) {
  //   await prisma.period.update({
  //     where: { id: req.params.periodId },
  //     data: { status: PeriodStatus.PENDING_RECEIPT },
  //   });
  // }

  res.status(201).json(reading);
}));

// Update reading
router.put('/:periodId/readings/:readingId', asyncHandler(async (req, res) => {
  const data = updateReadingSchema.parse(req.body);

  const reading = await prisma.reading.findUnique({
    where: { id: req.params.readingId },
    include: {
      period: {
        select: {
          condominiumId: true,
          status: true,
        },
      },
    },
  });

  if (!reading) {
    throw createError('Reading not found', 404);
  }

  // Check if period belongs to the route parameter
  if (reading.periodId !== req.params.periodId) {
    throw createError('Reading does not belong to this period', 400);
  }

  // Check access to condominium
  if (req.user!.role !== UserRole.SUPER_ADMIN) {
    const hasAccess = req.condominiumAccess?.some(
      access => access.condominiumId === reading.period.condominiumId && 
      [UserRole.ADMIN, UserRole.EDITOR].includes(access.role)
    );
    
    if (!hasAccess) {
      throw createError('Access denied to update readings in this period', 403);
    }
  }

  // Check if period is still open for modifications
  if (reading.period.status === 'CLOSED') {
    throw createError('Cannot update readings in a closed period', 400);
  }

  const updatedReading = await prisma.reading.update({
    where: { id: req.params.readingId },
    data,
    include: {
      meter: {
        select: {
          serialNumber: true,
          type: true,
        },
      },
    },
  });

  // Log action
  await prisma.auditLog.create({
    data: {
      userId: req.user!.id,
      action: 'UPDATE',
      entity: 'Reading',
      entityId: reading.id,
      oldData: reading,
      newData: updatedReading,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    },
  });

  res.json(updatedReading);
}));

// Get readings for period
router.get('/:periodId/readings', asyncHandler(async (req, res) => {
  const period = await prisma.period.findUnique({
    where: { id: req.params.periodId },
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
  const isValidated = req.query.isValidated as string;
  const isAnomalous = req.query.isAnomalous as string;

  const where: any = {
    periodId: req.params.periodId,
  };

  if (isValidated !== undefined) {
    where.isValidated = isValidated === 'true';
  }

  if (isAnomalous !== undefined) {
    where.isAnomalous = isAnomalous === 'true';
  }

  const [readings, total] = await Promise.all([
    prisma.reading.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        meter: {
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
                  },
                },
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { meter: { unit: { block: { name: 'asc' } } } },
        { meter: { unit: { name: 'asc' } } },
      ],
    }),
    prisma.reading.count({ where }),
  ]);

  res.json({
    readings,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  });
}));

// Validate all readings in period (bulk validation)
router.put('/:periodId/readings/validate-all', asyncHandler(async (req, res) => {
  const period = await prisma.period.findUnique({
    where: { id: req.params.periodId },
    select: { condominiumId: true },
  });

  if (!period) {
    throw createError('Period not found', 404);
  }

  // Check access to condominium
  if (req.user!.role !== UserRole.SUPER_ADMIN) {
    const hasAccess = req.condominiumAccess?.some(
      access => access.condominiumId === period.condominiumId && 
      [UserRole.ADMIN, UserRole.ANALYST].includes(access.role)
    );
    
    if (!hasAccess) {
      throw createError('Access denied to validate readings in this period', 403);
    }
  }

  // Validate all unvalidated readings in the period
  const updatedReadings = await prisma.reading.updateMany({
    where: {
      periodId: req.params.periodId,
      isValidated: false,
    },
    data: {
      isValidated: true,
      isAnomalous: false,
    },
  });

  res.json({
    message: `${updatedReadings.count} readings validated successfully`,
    count: updatedReadings.count,
  });
}));

// Update reading validation
router.put('/:periodId/readings/:readingId/validate', 
  asyncHandler(async (req, res) => {
    const data = validateReadingSchema.parse(req.body);

    const reading = await prisma.reading.findUnique({
      where: { id: req.params.readingId },
      include: {
        period: {
          select: {
            condominiumId: true,
          },
        },
      },
    });

    if (!reading) {
      throw createError('Reading not found', 404);
    }

    if (reading.periodId !== req.params.periodId) {
      throw createError('Reading does not belong to this period', 400);
    }

    // Check access to condominium
    if (req.user!.role !== UserRole.SUPER_ADMIN) {
      const hasAccess = req.condominiumAccess?.some(
        access => access.condominiumId === reading.period.condominiumId && 
        [UserRole.ADMIN, UserRole.ANALYST].includes(access.role)
      );
      
      if (!hasAccess) {
        throw createError('Access denied to validate this reading', 403);
      }
    }

    const updatedReading = await prisma.reading.update({
      where: { id: req.params.readingId },
      data,
    });

    res.json(updatedReading);
  })
);

// Get pending readings (units not yet read)
router.get('/:periodId/pending', asyncHandler(async (req, res) => {
  const period = await prisma.period.findUnique({
    where: { id: req.params.periodId },
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

  // Get all active units that don't have readings for this period
  const pendingUnits = await prisma.unit.findMany({
    where: {
      block: {
        condominiumId: period.condominiumId,
      },
      isActive: true,
      meters: {
        some: {
          isActive: true,
          readings: {
            none: {
              periodId: req.params.periodId,
            },
          },
        },
      },
    },
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
        },
      },
      meters: {
        where: { isActive: true },
        select: {
          id: true,
          type: true,
          serialNumber: true,
        },
      },
    },
    orderBy: [
      { block: { name: 'asc' } },
      { name: 'asc' },
    ],
  });

  res.json({
    pendingUnits,
    total: pendingUnits.length,
  });
}));

// Get previous period readings for consumption calculation
router.get('/:periodId/previous-readings', asyncHandler(async (req, res) => {
  const currentPeriod = await prisma.period.findUnique({
    where: { id: req.params.periodId },
    select: { condominiumId: true },
  });

  if (!currentPeriod) {
    throw createError('Period not found', 404);
  }

  // Check access to condominium
  if (req.user!.role !== UserRole.SUPER_ADMIN) {
    const hasAccess = req.condominiumAccess?.some(
      access => access.condominiumId === currentPeriod.condominiumId
    );
    
    if (!hasAccess) {
      throw createError('Access denied to this period', 403);
    }
  }

  // Find the most recent closed period for this condominium
  const previousPeriod = await prisma.period.findFirst({
    where: {
      condominiumId: currentPeriod.condominiumId,
      status: PeriodStatus.CLOSED,
      id: { not: req.params.periodId }, // Exclude current period
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!previousPeriod) {
    // No previous period found, return empty readings
    return res.json({
      readings: [],
      previousPeriodId: null,
    });
  }

  // Get readings from the previous period
  const previousReadings = await prisma.reading.findMany({
    where: { periodId: previousPeriod.id },
    include: {
      meter: {
        select: {
          id: true,
          type: true,
          serialNumber: true,
        },
      },
    },
  });

  res.json({
    readings: previousReadings,
    previousPeriodId: previousPeriod.id,
  });
}));

// ============== STORED CALCULATIONS MANAGEMENT ==============

// Save period calculations when closing period
router.post('/:periodId/calculations', asyncHandler(async (req, res) => {
  const { periodCalculation, unitCalculations } = req.body;

  const period = await prisma.period.findUnique({
    where: { id: req.params.periodId },
    select: { condominiumId: true, status: true },
  });

  if (!period) {
    throw createError('Period not found', 404);
  }

  // Check access to condominium
  if (req.user!.role !== UserRole.SUPER_ADMIN) {
    const hasAccess = req.condominiumAccess?.some(
      access => access.condominiumId === period.condominiumId && 
      [UserRole.ADMIN, UserRole.EDITOR].includes(access.role)
    );
    
    if (!hasAccess) {
      throw createError('Access denied to save calculations for this period', 403);
    }
  }

  // Use transaction to ensure data consistency
  const result = await prisma.$transaction(async (tx) => {
    // Save period-level calculations
    const savedPeriodCalc = await tx.periodCalculation.create({
      data: {
        periodId: req.params.periodId,
        ...periodCalculation,
      },
    });

    // Save unit-level calculations
    const savedUnitCalcs = await tx.unitCalculation.createMany({
      data: unitCalculations.map((calc: any) => ({
        periodId: req.params.periodId,
        ...calc,
      })),
    });

    return { periodCalculation: savedPeriodCalc, unitCalculationsCount: savedUnitCalcs.count };
  });

  res.json(result);
}));

// Get stored calculations for a closed period
router.get('/:periodId/calculations', asyncHandler(async (req, res) => {
  const period = await prisma.period.findUnique({
    where: { id: req.params.periodId },
    select: { condominiumId: true, status: true },
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
      throw createError('Access denied to view calculations for this period', 403);
    }
  }

  // Get period-level calculations
  const periodCalculation = await prisma.periodCalculation.findUnique({
    where: { periodId: req.params.periodId },
  });

  // Get unit-level calculations
  const unitCalculations = await prisma.unitCalculation.findMany({
    where: { periodId: req.params.periodId },
    include: {
      unit: {
        include: {
          block: true,
        },
      },
    },
    orderBy: [
      { unit: { block: { name: 'asc' } } },
      { unit: { name: 'asc' } },
    ],
  });

  res.json({
    periodCalculation,
    unitCalculations,
  });
}));

// Delete stored calculations (for reopening period) - Super Admin only
router.delete('/:periodId/calculations', asyncHandler(async (req, res) => {
  // Only SUPER_ADMIN can delete calculations to reopen periods
  if (req.user!.role !== UserRole.SUPER_ADMIN) {
    throw createError('Access denied. Only Super Admin can reopen periods.', 403);
  }

  const period = await prisma.period.findUnique({
    where: { id: req.params.periodId },
    select: { status: true },
  });

  if (!period) {
    throw createError('Period not found', 404);
  }

  if (period.status !== 'CLOSED') {
    throw createError('Can only delete calculations from closed periods', 400);
  }

  // Use transaction to ensure data consistency
  await prisma.$transaction(async (tx) => {
    // Delete unit calculations first (foreign key constraint)
    await tx.unitCalculation.deleteMany({
      where: { periodId: req.params.periodId },
    });

    // Delete period calculation
    await tx.periodCalculation.deleteMany({
      where: { periodId: req.params.periodId },
    });

    // Reset period status to PENDING_RECEIPT to allow recalculation
    await tx.period.update({
      where: { id: req.params.periodId },
      data: { status: 'PENDING_RECEIPT' },
    });
  });

  // Log action
  await prisma.auditLog.create({
    data: {
      userId: req.user!.id,
      action: 'DELETE',
      entity: 'PeriodCalculations',
      entityId: req.params.periodId,
      oldData: { action: 'Period reopened by Super Admin' },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    },
  });

  res.json({ message: 'Period reopened successfully. Calculations deleted.' });
}));

export default router;