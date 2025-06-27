import { PrismaClient, PeriodStatus, BillStatus } from '@prisma/client';

interface CalculationResult {
  totalIndividualConsumption: number;
  commonAreaConsumption: number;
  commonAreaCostPerUnit: number;
  bills: BillData[];
  anomalies: string[];
}

interface BillData {
  unitId: string;
  unitName: string;
  blockName: string;
  residentName?: string;
  currentReading: number;
  previousReading: number;
  consumption: number;
  individualCost: number;
  commonAreaCost: number;
  totalCost: number;
  extraCharges?: ExtraCharge[];
}

interface ExtraCharge {
  description: string;
  amount: number;
  type: 'fixed' | 'percentage';
}

interface WaterRates {
  basicRate: number; // Cost per m³ for individual consumption
  commonAreaRate?: number; // Optional different rate for common areas
  fixedCharge?: number; // Fixed monthly charge per unit
  minimumConsumption?: number; // Minimum billable consumption
}

export class CalculationService {
  constructor(private prisma: PrismaClient) {}

  async calculatePeriodBills(periodId: string): Promise<CalculationResult> {
    // Get period with all necessary data
    const period = await this.prisma.period.findUnique({
      where: { id: periodId },
      include: {
        condominium: {
          include: {
            blocks: {
              include: {
                units: {
                  where: { isActive: true },
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
                    meters: {
                      where: { isActive: true, type: 'WATER' },
                    },
                  },
                },
              },
            },
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
                        name: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!period) {
      throw new Error('Period not found');
    }

    if (period.status !== PeriodStatus.CALCULATING) {
      throw new Error('Period is not ready for calculation');
    }

    if (!period.totalVolume || !period.totalAmount) {
      throw new Error('Period receipt data is incomplete');
    }

    // Get water rates (from system config or default values)
    const waterRates = await this.getWaterRates();
    
    // Get all active units for this condominium
    const activeUnits = period.condominium.blocks.flatMap(block => 
      block.units.filter(unit => unit.isActive && unit.meters.length > 0).map(unit => ({
        ...unit,
        block: { name: block.name }
      }))
    );

    // Get previous period readings for comparison
    const previousReadings = await this.getPreviousReadings(
      period.condominiumId,
      activeUnits.map(unit => unit.meters[0].id)
    );

    const anomalies: string[] = [];
    const bills: BillData[] = [];
    let totalIndividualConsumption = 0;

    // Calculate individual consumptions
    for (const unit of activeUnits) {
      const meter = unit.meters[0]; // Primary water meter
      const currentReading = period.readings.find(r => r.meterId === meter.id);
      
      if (!currentReading) {
        anomalies.push(`Missing reading for unit ${unit.name} in block ${unit.block?.name || 'Unknown'}`);
        continue;
      }

      const previousReading = previousReadings.get(meter.id);
      const previousValue = previousReading?.value || 0;

      // Handle meter replacement or anomalous readings
      let consumption = currentReading.value - previousValue;
      if (consumption < 0) {
        // Possible meter replacement - use current reading as consumption
        consumption = currentReading.value;
        anomalies.push(
          `Meter replacement detected for unit ${unit.name}: previous=${previousValue}, current=${currentReading.value}`
        );
      }

      // Apply minimum consumption if configured
      if (waterRates.minimumConsumption && consumption < waterRates.minimumConsumption) {
        consumption = waterRates.minimumConsumption;
      }

      totalIndividualConsumption += consumption;

      // Calculate individual cost
      const individualCost = this.calculateIndividualCost(consumption, waterRates);

      const billData: BillData = {
        unitId: unit.id,
        unitName: unit.name,
        blockName: unit.block?.name || 'Unknown',
        residentName: unit.resident?.name,
        currentReading: currentReading.value,
        previousReading: previousValue,
        consumption,
        individualCost,
        commonAreaCost: 0, // Will be calculated after
        totalCost: 0, // Will be calculated after
      };

      bills.push(billData);
    }

    // Calculate common area consumption and distribution
    const commonAreaConsumption = Math.max(0, period.totalVolume - totalIndividualConsumption);
    const commonAreaTotalCost = Math.max(0, period.totalAmount - bills.reduce((sum, bill) => sum + bill.individualCost, 0));
    const commonAreaCostPerUnit = bills.length > 0 ? commonAreaTotalCost / bills.length : 0;

    // Apply common area costs to each bill
    bills.forEach(bill => {
      bill.commonAreaCost = commonAreaCostPerUnit;
      bill.totalCost = bill.individualCost + bill.commonAreaCost;
      
      // Add any extra charges if configured
      const extraCharges = this.getExtraCharges(bill.unitId, period.condominiumId);
      if (extraCharges.length > 0) {
        bill.extraCharges = extraCharges;
        const extraTotal = extraCharges.reduce((sum, charge) => {
          return sum + (charge.type === 'percentage' 
            ? bill.totalCost * (charge.amount / 100)
            : charge.amount
          );
        }, 0);
        bill.totalCost += extraTotal;
      }
    });

    // Validate calculations
    const calculatedTotal = bills.reduce((sum, bill) => sum + bill.totalCost, 0);
    const difference = Math.abs(calculatedTotal - period.totalAmount);
    
    if (difference > 0.01) { // Allow for small rounding differences
      anomalies.push(
        `Total calculation mismatch: calculated=${calculatedTotal.toFixed(2)}, receipt=${period.totalAmount.toFixed(2)}, difference=${difference.toFixed(2)}`
      );
    }

    return {
      totalIndividualConsumption,
      commonAreaConsumption,
      commonAreaCostPerUnit,
      bills,
      anomalies,
    };
  }

  async saveBills(periodId: string, calculationResult: CalculationResult): Promise<void> {
    // Delete existing bills for this period
    await this.prisma.bill.deleteMany({
      where: { periodId },
    });

    // Create new bills
    const billsData = calculationResult.bills.map(bill => ({
      periodId,
      unitId: bill.unitId,
      currentReading: bill.currentReading,
      previousReading: bill.previousReading,
      consumption: bill.consumption,
      individualCost: bill.individualCost,
      commonAreaCost: bill.commonAreaCost,
      totalCost: bill.totalCost,
      extraCharges: bill.extraCharges as any || [],
      status: BillStatus.PENDING,
    }));

    await this.prisma.bill.createMany({
      data: billsData,
    });

    // Update period status to CLOSED
    await this.prisma.period.update({
      where: { id: periodId },
      data: {
        status: PeriodStatus.CLOSED,
        endDate: new Date(),
      },
    });
  }

  private async getWaterRates(): Promise<WaterRates> {
    // Get rates from system configuration
    const configs = await this.prisma.systemConfig.findMany({
      where: {
        key: {
          in: ['water_basic_rate', 'water_common_area_rate', 'water_fixed_charge', 'water_minimum_consumption'],
        },
      },
    });

    const configMap = new Map(configs.map(c => [c.key, parseFloat(c.value)]));

    return {
      basicRate: configMap.get('water_basic_rate') || 1.5, // Default $1.5 per m³
      commonAreaRate: configMap.get('water_common_area_rate'),
      fixedCharge: configMap.get('water_fixed_charge'),
      minimumConsumption: configMap.get('water_minimum_consumption'),
    };
  }

  private async getPreviousReadings(
    condominiumId: string,
    meterIds: string[]
  ): Promise<Map<string, { value: number; periodId: string }>> {
    const previousReadings = await this.prisma.reading.findMany({
      where: {
        meterId: { in: meterIds },
        period: {
          condominiumId,
          status: PeriodStatus.CLOSED,
        },
      },
      orderBy: { createdAt: 'desc' },
      distinct: ['meterId'],
    });

    return new Map(
      previousReadings.map(reading => [
        reading.meterId,
        { value: reading.value, periodId: reading.periodId },
      ])
    );
  }

  private calculateIndividualCost(consumption: number, rates: WaterRates): number {
    let cost = consumption * rates.basicRate;
    
    if (rates.fixedCharge) {
      cost += rates.fixedCharge;
    }

    return Math.round(cost * 100) / 100; // Round to 2 decimal places
  }

  private getExtraCharges(unitId: string, condominiumId: string): ExtraCharge[] {
    // This could be expanded to get unit-specific or condominium-specific charges
    // from a configuration table. For now, return empty array.
    return [];
  }

  async validatePeriodForCalculation(periodId: string): Promise<{
    isValid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    const period = await this.prisma.period.findUnique({
      where: { id: periodId },
      include: {
        readings: true,
        condominium: {
          include: {
            blocks: {
              include: {
                units: {
                  where: { isActive: true },
                  include: {
                    meters: {
                      where: { isActive: true, type: 'WATER' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!period) {
      errors.push('Period not found');
      return { isValid: false, errors };
    }

    // Check period status
    if (period.status !== PeriodStatus.CALCULATING) {
      errors.push(`Period status must be CALCULATING, current: ${period.status}`);
    }

    // Check receipt data
    if (!period.totalVolume || period.totalVolume <= 0) {
      errors.push('Total volume from receipt is required and must be positive');
    }

    if (!period.totalAmount || period.totalAmount <= 0) {
      errors.push('Total amount from receipt is required and must be positive');
    }

    // Check if all units have readings
    const activeUnits = period.condominium.blocks.flatMap(block => 
      block.units.filter(unit => unit.isActive && unit.meters.length > 0).map(unit => ({
        ...unit,
        block: { name: block.name }
      }))
    );

    const readingMeterIds = new Set(period.readings.map(r => r.meterId));
    const missingReadings = activeUnits.filter(unit => 
      !readingMeterIds.has(unit.meters[0].id)
    );

    if (missingReadings.length > 0) {
      errors.push(
        `Missing readings for ${missingReadings.length} units: ${missingReadings
          .map(u => `${u.block?.name || 'Unknown'}-${u.name}`)
          .join(', ')}`
      );
    }

    // Check for unvalidated anomalous readings
    const anomalousReadings = period.readings.filter(r => r.isAnomalous && !r.isValidated);
    if (anomalousReadings.length > 0) {
      errors.push(`${anomalousReadings.length} anomalous readings need validation`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  async getCalculationSummary(periodId: string): Promise<{
    periodInfo: any;
    readingsSummary: any;
    calculationPreview?: CalculationResult;
  }> {
    const period = await this.prisma.period.findUnique({
      where: { id: periodId },
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
                      select: { name: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!period) {
      throw new Error('Period not found');
    }

    const totalUnits = await this.prisma.unit.count({
      where: {
        block: {
          condominiumId: period.condominiumId,
        },
        isActive: true,
      },
    });

    const readingsSummary = {
      total: period.readings.length,
      totalUnits,
      completed: period.readings.length,
      pending: totalUnits - period.readings.length,
      validated: period.readings.filter(r => r.isValidated).length,
      anomalous: period.readings.filter(r => r.isAnomalous).length,
    };

    let calculationPreview;
    if (period.status === PeriodStatus.CALCULATING && period.totalVolume && period.totalAmount) {
      try {
        calculationPreview = await this.calculatePeriodBills(periodId);
      } catch (error) {
        // Preview calculation failed, but still return summary
        console.error('Calculation preview failed:', error);
      }
    }

    return {
      periodInfo: {
        id: period.id,
        status: period.status,
        startDate: period.startDate,
        endDate: period.endDate,
        totalVolume: period.totalVolume,
        totalAmount: period.totalAmount,
        condominium: period.condominium,
      },
      readingsSummary,
      calculationPreview,
    };
  }
}