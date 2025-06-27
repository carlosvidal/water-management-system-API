import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { UserRole } from '@prisma/client';
import { asyncHandler } from '../middleware/errorHandler';
import { calculatePricing, formatPricePEN, getDefaultPricingConfig } from '../utils/pricing';

const router = Router();

/**
 * @swagger
 * /api/subscriptions/pricing/calculate:
 *   post:
 *     summary: Calculate pricing for a number of units
 *     tags:
 *       - Subscriptions
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - unitsCount
 *             properties:
 *               unitsCount:
 *                 type: integer
 *                 minimum: 1
 *                 example: 8
 *     responses:
 *       200:
 *         description: Pricing calculation successful
 */
router.post('/pricing/calculate', authenticate, asyncHandler(async (req, res) => {
  const { unitsCount } = req.body;

  if (!unitsCount || unitsCount < 1) {
    return res.status(400).json({
      message: 'Units count is required and must be greater than 0'
    });
  }

  const config = getDefaultPricingConfig();
  const pricing = calculatePricing(unitsCount, config);
  
  res.json({
    pricing,
    formatted: {
      monthly: formatPricePEN(pricing.monthlyAmount),
      annual: formatPricePEN(pricing.annualAmount)
    }
  });
}));

/**
 * @swagger
 * /api/subscriptions/pricing/info:
 *   get:
 *     summary: Get pricing information
 *     tags:
 *       - Subscriptions
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Pricing information retrieved successfully
 */
router.get('/pricing/info', authenticate, asyncHandler(async (req, res) => {
  const config = getDefaultPricingConfig();
  
  const examples = [
    { units: 4, note: 'Below minimum (will be billed for 6 units)' },
    { units: 6, note: 'At minimum' },
    { units: 8, note: 'Common size' },
    { units: 12, note: 'Medium size' },
    { units: 20, note: 'Large condominium' }
  ];

  const calculations = examples.map(({ units, note }) => {
    const pricing = calculatePricing(units, config);
    return {
      scenario: `${units} units - ${note}`,
      pricing,
      formatted: {
        monthly: formatPricePEN(pricing.monthlyAmount),
        annual: formatPricePEN(pricing.annualAmount)
      }
    };
  });

  res.json({
    config,
    examples: calculations,
    summary: {
      pricePerUnit: formatPricePEN(config.pricePerUnitPEN),
      minimumUnits: config.minimumUnits,
      minimumMonthly: formatPricePEN(config.minimumUnits * config.pricePerUnitPEN),
      minimumAnnual: formatPricePEN(config.minimumUnits * config.pricePerUnitPEN * 12),
      isAnnualPrepaid: config.isAnnualPrepaid
    }
  });
}));

export default router;