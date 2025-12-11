import express from 'express';
import { z } from 'zod';
import { UserRole } from '@prisma/client';
import { prisma } from '../index';
import { createError, asyncHandler } from '../middleware/errorHandler';
import { authenticate, requireCondominiumAccess } from '../middleware/auth';
import { hashPassword } from '../utils/password';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Validation schemas
const createBlockSchema = z.object({
  name: z.string().min(1, 'Block name is required'),
  maxUnits: z.number().min(1, 'Max units must be at least 1'),
});

const createUnitSchema = z.object({
  name: z.string().min(1, 'Unit name is required'),
  blockId: z.string().min(1, 'Block ID is required'),
});

const createResidentSchema = z.object({
  name: z.string().min(1, 'Resident name is required'),
  email: z.string().email('Invalid email format').optional(),
  phone: z.string().optional(),
});

const updateResidentSchema = createResidentSchema.partial();

const assignResidentSchema = z.object({
  residentId: z.string().min(1, 'Resident ID is required'),
});

const createUserSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  phone: z.string().optional(),
  role: z.enum([UserRole.ADMIN, UserRole.ANALYST, UserRole.EDITOR]),
});

const createCondominiumSchema = z.object({
  name: z.string().min(1, 'Condominium name is required'),
  address: z.string().min(1, 'Address is required'),
  city: z.string().optional(),
  country: z.string().default('Perú'),
  readingDay: z.number().min(1).max(31).optional(),
  bankAccount: z.string().optional(),
  bankAccountHolder: z.string().optional(),
});

const createCondominiumWithStructureSchema = z.object({
  name: z.string().min(1, 'Condominium name is required'),
  address: z.string().min(1, 'Address is required'),
  city: z.string().optional(),
  country: z.string().default('Perú'),
  readingDay: z.number().min(1).max(31).optional(),
  bankAccount: z.string().optional(),
  bankAccountHolder: z.string().optional(),
  numberOfBlocks: z.number().min(1, 'Number of blocks must be at least 1'),
  totalUnits: z.number().min(1, 'Total units must be at least 1'),
});

// ============== CONDOMINIUM LIST ==============

/**
 * @swagger
 * /condominiums:
 *   get:
 *     summary: Get all condominiums for the authenticated user
 *     tags: [Condominiums]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of condominiums
 */
router.get('/', asyncHandler(async (req, res) => {
  const user = req.user!;
  
  let condominiums;
  
  if (user.role === 'SUPER_ADMIN') {
    // Super admin can see all condominiums
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
  } else {
    // Other users can only see condominiums they have access to
    condominiums = await prisma.condominium.findMany({
      where: {
        condominiumUsers: {
          some: {
            userId: user.id,
          },
        },
      },
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
  }

  res.json({ condominiums });
}));

/**
 * @swagger
 * /condominiums:
 *   post:
 *     summary: Create a new condominium
 *     tags: [Condominiums]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - address
 *             properties:
 *               name:
 *                 type: string
 *               address:
 *                 type: string
 *               city:
 *                 type: string
 *               country:
 *                 type: string
 *               readingDay:
 *                 type: integer
 *               bankAccount:
 *                 type: string
 *               bankAccountHolder:
 *                 type: string
 *     responses:
 *       201:
 *         description: Condominium created successfully
 */
router.post('/', asyncHandler(async (req, res) => {
  const user = req.user!;
  
  // Only admins and super admins can create condominiums
  if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError('Insufficient permissions to create condominium', 403);
  }

  const data = createCondominiumSchema.parse(req.body);

  // Get the default plan
  const defaultPlan = await prisma.plan.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
  });

  if (!defaultPlan) {
    throw createError('No active plan available. Please contact administrator.', 400);
  }

  // Create condominium in a transaction
  const result = await prisma.$transaction(async (tx) => {
    // Create the condominium
    const condominium = await tx.condominium.create({
      data: {
        name: data.name,
        address: data.address,
        city: data.city,
        country: data.country,
        readingDay: data.readingDay,
        bankAccount: data.bankAccount,
        bankAccountHolder: data.bankAccountHolder,
        planId: defaultPlan.id,
      },
    });

    // Assign the creator as admin of this condominium
    await tx.condominiumUser.create({
      data: {
        userId: user.id,
        condominiumId: condominium.id,
        role: UserRole.ADMIN,
      },
    });

    return condominium;
  });

  // Log the action
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: 'CREATE',
      entity: 'Condominium',
      entityId: result.id,
      newData: result,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    },
  });

  res.status(201).json(result);
}));

/**
 * @swagger
 * /condominiums/with-structure:
 *   post:
 *     summary: Create a new condominium with automatic block structure
 *     tags: [Condominiums]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - address
 *               - numberOfBlocks
 *               - totalUnits
 *             properties:
 *               name:
 *                 type: string
 *               address:
 *                 type: string
 *               city:
 *                 type: string
 *               country:
 *                 type: string
 *               readingDay:
 *                 type: integer
 *               bankAccount:
 *                 type: string
 *               bankAccountHolder:
 *                 type: string
 *               numberOfBlocks:
 *                 type: integer
 *               totalUnits:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Condominium created successfully with structure
 */
router.post('/with-structure', asyncHandler(async (req, res) => {
  const user = req.user!;
  
  // Only admins and super admins can create condominiums
  if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError('Insufficient permissions to create condominium', 403);
  }

  const data = createCondominiumWithStructureSchema.parse(req.body);

  // Get the default plan
  const defaultPlan = await prisma.plan.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
  });

  if (!defaultPlan) {
    throw createError('No active plan available. Please contact administrator.', 400);
  }

  // Create condominium with structure in a transaction
  const result = await prisma.$transaction(async (tx) => {
    // Create the condominium
    const condominium = await tx.condominium.create({
      data: {
        name: data.name,
        address: data.address,
        city: data.city,
        country: data.country,
        readingDay: data.readingDay,
        bankAccount: data.bankAccount,
        bankAccountHolder: data.bankAccountHolder,
        planId: defaultPlan.id,
        totalUnitsPlanned: data.totalUnits,
      },
    });

    // Assign the creator as admin of this condominium
    await tx.condominiumUser.create({
      data: {
        userId: user.id,
        condominiumId: condominium.id,
        role: UserRole.ADMIN,
      },
    });

    // Create blocks based on numberOfBlocks
    const blocks = [];
    if (data.numberOfBlocks === 1) {
      // If only 1 block, create it automatically with the total units as max
      const block = await tx.block.create({
        data: {
          name: 'Principal',
          condominiumId: condominium.id,
          maxUnits: data.totalUnits,
        },
      });
      blocks.push(block);
    } else {
      // If multiple blocks, create them with estimated units per block
      const unitsPerBlock = Math.ceil(data.totalUnits / data.numberOfBlocks);
      
      for (let i = 1; i <= data.numberOfBlocks; i++) {
        const blockName = data.numberOfBlocks <= 26 
          ? String.fromCharCode(64 + i) // A, B, C, etc.
          : `Bloque ${i}`;
        
        const block = await tx.block.create({
          data: {
            name: blockName,
            condominiumId: condominium.id,
            maxUnits: unitsPerBlock,
          },
        });
        blocks.push(block);
      }
    }

    return { condominium, blocks };
  });

  // Log the action
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: 'CREATE',
      entity: 'Condominium',
      entityId: result.condominium.id,
      newData: {
        ...result.condominium,
        numberOfBlocks: data.numberOfBlocks,
        totalUnits: data.totalUnits,
        blocksCreated: result.blocks.length,
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    },
  });

  res.status(201).json({
    condominium: result.condominium,
    blocks: result.blocks,
    message: data.numberOfBlocks === 1 
      ? `Condominium created with 1 automatic block. You can now add ${data.totalUnits} units.`
      : `Condominium created with ${data.numberOfBlocks} blocks for ${data.totalUnits} total units.`,
  });
}));

// ============== CONDOMINIUM INFO ==============

/**
 * @swagger
 * /condominiums/{id}:
 *   get:
 *     summary: Get condominium details
 *     description: Retrieve detailed information about a specific condominium
 *     tags: [Condominiums]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Condominium unique identifier
 *         example: 123e4567-e89b-12d3-a456-426614174000
 *     responses:
 *       200:
 *         description: Condominium details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Condominium'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - No access to this condominium
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Condominium not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Get condominium details
router.get('/:id', requireCondominiumAccess(), asyncHandler(async (req, res) => {
  const condominium = await prisma.condominium.findUnique({
    where: { id: req.params.id },
    include: {
      plan: {
        select: {
          id: true,
          name: true,
          pricePerUnitPEN: true,
          minimumUnits: true,
          isAnnualPrepaid: true,
          features: true,
        },
      },
      blocks: {
        include: {
          units: {
            include: {
              resident: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  phone: true,
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
          },
          _count: {
            select: { units: true },
          },
        },
        orderBy: { name: 'asc' },
      },
      condominiumUsers: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              role: true,
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

// Update condominium info
router.put('/:id', requireCondominiumAccess([UserRole.ADMIN]), asyncHandler(async (req, res) => {
  const updateSchema = z.object({
    name: z.string().min(1).optional(),
    address: z.string().min(1).optional(),
    readingDay: z.number().min(1).max(31).optional(),
    bankAccount: z.string().optional(),
    bankAccountHolder: z.string().optional(),
  });

  const data = updateSchema.parse(req.body);

  const condominium = await prisma.condominium.update({
    where: { id: req.params.id },
    data,
  });

  res.json(condominium);
}));

// ============== BLOCKS MANAGEMENT ==============

// Create block
router.post('/:id/blocks', requireCondominiumAccess([UserRole.ADMIN]), asyncHandler(async (req, res) => {
  const data = createBlockSchema.parse(req.body);

  // Verify condominium exists and get total planned units
  const condominium = await prisma.condominium.findUnique({
    where: { id: req.params.id },
    include: {
      blocks: {
        select: {
          maxUnits: true,
        },
      },
    },
  });

  if (!condominium) {
    throw createError('Condominium not found', 404);
  }

  // Check if adding this block would exceed total planned units
  if (condominium.totalUnitsPlanned) {
    const currentTotalCapacity = condominium.blocks.reduce((sum, block) => sum + block.maxUnits, 0);
    const newTotalCapacity = currentTotalCapacity + data.maxUnits;

    if (newTotalCapacity > condominium.totalUnitsPlanned) {
      throw createError(
        `This block would exceed the total planned units (${condominium.totalUnitsPlanned}). Current capacity: ${currentTotalCapacity}, attempting to add: ${data.maxUnits}`,
        400
      );
    }
  }

  const block = await prisma.block.create({
    data: {
      name: data.name,
      maxUnits: data.maxUnits,
      condominiumId: req.params.id,
    },
  });

  // Log action
  await prisma.auditLog.create({
    data: {
      userId: req.user!.id,
      action: 'CREATE',
      entity: 'Block',
      entityId: block.id,
      newData: block,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    },
  });

  // Calculate remaining capacity
  const updatedCondominium = await prisma.condominium.findUnique({
    where: { id: req.params.id },
    include: {
      blocks: {
        select: {
          maxUnits: true,
        },
      },
    },
  });

  const totalCapacity = updatedCondominium!.blocks.reduce((sum, block) => sum + block.maxUnits, 0);
  const remainingCapacity = (condominium.totalUnitsPlanned || 0) - totalCapacity;

  res.status(201).json({
    ...block,
    remainingCapacity: condominium.totalUnitsPlanned ? remainingCapacity : null,
    totalCapacity,
    totalPlanned: condominium.totalUnitsPlanned,
  });
}));

// Get blocks
router.get('/:id/blocks', requireCondominiumAccess(), asyncHandler(async (req, res) => {
  const blocks = await prisma.block.findMany({
    where: { condominiumId: req.params.id },
    include: {
      units: {
        include: {
          resident: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
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
        orderBy: { name: 'asc' },
      },
      _count: {
        select: { units: true },
      },
    },
    orderBy: { name: 'asc' },
  });

  res.json(blocks);
}));

// ============== UNITS MANAGEMENT ==============

// Create unit (with automatic meter creation)
router.post('/:condominiumId/units', requireCondominiumAccess([UserRole.ADMIN, UserRole.EDITOR]), asyncHandler(async (req, res) => {
  const data = createUnitSchema.parse(req.body);

  // Verify block belongs to this condominium
  const block = await prisma.block.findFirst({
    where: {
      id: data.blockId,
      condominiumId: req.params.condominiumId,
    },
  });

  if (!block) {
    throw createError('Block not found in this condominium', 404);
  }

  // Check if block has space for more units
  const currentUnitsInBlock = await prisma.unit.count({
    where: { blockId: data.blockId },
  });

  if (currentUnitsInBlock >= block.maxUnits) {
    throw createError(`Block ${block.name} is at maximum capacity`, 400);
  }

  // Verify condominium exists (no unit limits in new pricing model)
  const condominium = await prisma.condominium.findUnique({
    where: { id: req.params.condominiumId },
  });

  if (!condominium) {
    throw createError('Condominium not found', 404);
  }

  // Create unit and meter in transaction
  const result = await prisma.$transaction(async (tx) => {
    const unit = await tx.unit.create({
      data: {
        name: data.name,
        blockId: data.blockId,
      },
    });

    // Auto-create water meter
    const meter = await tx.meter.create({
      data: {
        unitId: unit.id,
        type: 'WATER',
      },
    });

    return { unit, meter };
  });

  // Log action
  await prisma.auditLog.create({
    data: {
      userId: req.user!.id,
      action: 'CREATE',
      entity: 'Unit',
      entityId: result.unit.id,
      newData: result.unit,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    },
  });

  res.status(201).json({
    unit: result.unit,
    meter: result.meter,
  });
}));

// Get units
router.get('/:id/units', requireCondominiumAccess(), asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const blockId = req.query.blockId as string;

  const where: any = {
    block: {
      condominiumId: req.params.id,
    },
  };

  if (blockId) {
    where.blockId = blockId;
  }

  const [units, total] = await Promise.all([
    prisma.unit.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        block: {
          select: {
            id: true,
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
    }),
    prisma.unit.count({ where }),
  ]);

  res.json({
    units,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  });
}));

// Assign resident to unit
router.put('/:condominiumId/units/:unitId/resident', 
  requireCondominiumAccess([UserRole.ADMIN]), 
  asyncHandler(async (req, res) => {
    const data = assignResidentSchema.parse(req.body);

    // Verify unit belongs to this condominium
    const unit = await prisma.unit.findFirst({
      where: {
        id: req.params.unitId,
        block: {
          condominiumId: req.params.condominiumId,
        },
      },
    });

    if (!unit) {
      throw createError('Unit not found in this condominium', 404);
    }

    // Verify resident belongs to this condominium
    const resident = await prisma.resident.findFirst({
      where: {
        id: data.residentId,
        condominiumId: req.params.condominiumId,
      },
    });

    if (!resident) {
      throw createError('Resident not found in this condominium', 404);
    }

    const updatedUnit = await prisma.unit.update({
      where: { id: req.params.unitId },
      data: { residentId: data.residentId },
      include: {
        resident: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    res.json(updatedUnit);
  })
);

// ============== RESIDENTS MANAGEMENT ==============

// Create resident
router.post('/:id/residents', requireCondominiumAccess([UserRole.ADMIN, UserRole.EDITOR]), asyncHandler(async (req, res) => {
  const data = createResidentSchema.parse(req.body);

  const resident = await prisma.resident.create({
    data: {
      name: data.name,
      email: data.email,
      phone: data.phone,
      condominiumId: req.params.id,
    },
  });

  res.status(201).json(resident);
}));

// Get residents
router.get('/:id/residents', requireCondominiumAccess(), asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const search = req.query.search as string;

  const where: any = {
    condominiumId: req.params.id,
  };

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [residents, total] = await Promise.all([
    prisma.resident.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        units: {
          include: {
            block: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.resident.count({ where }),
  ]);

  res.json({
    residents,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  });
}));

// Update resident
router.put('/:condominiumId/residents/:residentId',
  requireCondominiumAccess([UserRole.ADMIN, UserRole.EDITOR]),
  asyncHandler(async (req, res) => {
    const data = updateResidentSchema.parse(req.body);

    // Verify resident belongs to this condominium
    const existingResident = await prisma.resident.findFirst({
      where: {
        id: req.params.residentId,
        condominiumId: req.params.condominiumId,
      },
    });

    if (!existingResident) {
      throw createError('Resident not found in this condominium', 404);
    }

    const resident = await prisma.resident.update({
      where: { id: req.params.residentId },
      data,
    });

    res.json(resident);
  })
);

// ============== USER MANAGEMENT ==============

// Create condominium user
router.post('/:id/users', requireCondominiumAccess([UserRole.ADMIN]), asyncHandler(async (req, res) => {
  const data = createUserSchema.parse(req.body);

  // Check if user email already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: data.email.toLowerCase() },
  });

  if (existingUser) {
    throw createError('Email already exists', 400);
  }

  // Create user and link to condominium in transaction
  const result = await prisma.$transaction(async (tx) => {
    const hashedPassword = await hashPassword(data.password);
    
    const user = await tx.user.create({
      data: {
        name: data.name,
        email: data.email.toLowerCase(),
        password: hashedPassword,
        phone: data.phone,
        role: data.role,
      },
    });

    await tx.condominiumUser.create({
      data: {
        userId: user.id,
        condominiumId: req.params.id,
        role: data.role,
      },
    });

    return user;
  });

  res.status(201).json({
    id: result.id,
    name: result.name,
    email: result.email,
    phone: result.phone,
    role: result.role,
    isActive: result.isActive,
  });
}));

// Get condominium users
router.get('/:id/users', requireCondominiumAccess([UserRole.ADMIN]), asyncHandler(async (req, res) => {
  const users = await prisma.condominiumUser.findMany({
    where: { condominiumId: req.params.id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json(users);
}));

// ============== MULTIPLE RESIDENTS PER UNIT ==============

// Add resident to unit (supports multiple residents)
router.post('/:condominiumId/units/:unitId/residents', requireCondominiumAccess([UserRole.ADMIN]), asyncHandler(async (req, res) => {
  const addResidentSchema = z.object({
    residentId: z.string().min(1, 'Resident ID is required'),
    isPrimary: z.boolean().optional().default(false),
  });

  const data = addResidentSchema.parse(req.body);

  // Verify unit exists and belongs to condominium
  const unit = await prisma.unit.findFirst({
    where: {
      id: req.params.unitId,
      block: {
        condominiumId: req.params.condominiumId,
      },
    },
    include: {
      unitResidents: true,
    },
  });

  if (!unit) {
    throw createError('Unit not found in this condominium', 404);
  }

  // Check if unit already has maximum residents (2)
  if (unit.unitResidents.length >= 2) {
    throw createError('Unit already has maximum number of residents (2)', 400);
  }

  // Verify resident exists and belongs to condominium
  const resident = await prisma.resident.findFirst({
    where: {
      id: data.residentId,
      condominiumId: req.params.condominiumId,
    },
  });

  if (!resident) {
    throw createError('Resident not found in this condominium', 404);
  }

  // Check if resident is already assigned to this unit
  const existingAssignment = await prisma.unitResident.findUnique({
    where: {
      unitId_residentId: {
        unitId: req.params.unitId,
        residentId: data.residentId,
      },
    },
  });

  if (existingAssignment) {
    throw createError('Resident is already assigned to this unit', 400);
  }

  // If this will be the primary resident, clear any existing primary
  if (data.isPrimary || unit.unitResidents.length === 0) {
    await prisma.unitResident.updateMany({
      where: { unitId: req.params.unitId },
      data: { isPrimary: false },
    });
  }

  // Create the assignment
  const unitResident = await prisma.unitResident.create({
    data: {
      unitId: req.params.unitId,
      residentId: data.residentId,
      isPrimary: data.isPrimary || unit.unitResidents.length === 0,
    },
    include: {
      resident: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
    },
  });

  // Update legacy field if this is primary
  if (unitResident.isPrimary) {
    await prisma.unit.update({
      where: { id: req.params.unitId },
      data: { residentId: data.residentId },
    });
  }

  res.status(201).json(unitResident);
}));

// Remove resident from unit
router.delete('/:condominiumId/units/:unitId/residents/:residentId', requireCondominiumAccess([UserRole.ADMIN]), asyncHandler(async (req, res) => {
  // Verify assignment exists
  const unitResident = await prisma.unitResident.findUnique({
    where: {
      unitId_residentId: {
        unitId: req.params.unitId,
        residentId: req.params.residentId,
      },
    },
    include: {
      unit: {
        include: {
          block: true,
        },
      },
    },
  });

  if (!unitResident) {
    throw createError('Resident assignment not found', 404);
  }

  // Verify unit belongs to condominium
  if (unitResident.unit.block.condominiumId !== req.params.condominiumId) {
    throw createError('Unit not found in this condominium', 404);
  }

  const wasPrimary = unitResident.isPrimary;

  // Remove the assignment
  await prisma.unitResident.delete({
    where: {
      unitId_residentId: {
        unitId: req.params.unitId,
        residentId: req.params.residentId,
      },
    },
  });

  // If this was the primary resident, update legacy field and promote another resident
  if (wasPrimary) {
    const remainingResidents = await prisma.unitResident.findMany({
      where: { unitId: req.params.unitId },
      orderBy: { createdAt: 'asc' },
    });

    if (remainingResidents.length > 0) {
      // Promote the first remaining resident to primary
      await prisma.unitResident.update({
        where: { id: remainingResidents[0].id },
        data: { isPrimary: true },
      });

      // Update legacy field
      await prisma.unit.update({
        where: { id: req.params.unitId },
        data: { residentId: remainingResidents[0].residentId },
      });
    } else {
      // No residents left, clear legacy field
      await prisma.unit.update({
        where: { id: req.params.unitId },
        data: { residentId: null },
      });
    }
  }

  res.status(204).send();
}));

// Get residents for a specific unit
router.get('/:condominiumId/units/:unitId/residents', requireCondominiumAccess(), asyncHandler(async (req, res) => {
  // Verify unit exists and belongs to condominium
  const unit = await prisma.unit.findFirst({
    where: {
      id: req.params.unitId,
      block: {
        condominiumId: req.params.condominiumId,
      },
    },
    include: {
      unitResidents: {
        include: {
          resident: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
        orderBy: [
          { isPrimary: 'desc' },
          { createdAt: 'asc' },
        ],
      },
    },
  });

  if (!unit) {
    throw createError('Unit not found in this condominium', 404);
  }

  const residents = unit.unitResidents.map(ur => ({
    ...ur.resident,
    isPrimary: ur.isPrimary,
    assignedAt: ur.createdAt,
  }));

  res.json({ residents });
}));

export default router;