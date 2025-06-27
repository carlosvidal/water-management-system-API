/**
 * Pricing Utilities
 * Maneja el cálculo de precios basado en unidades
 */

export interface PricingCalculation {
  unitsCount: number;
  billingUnits: number;
  monthlyAmount: number;
  annualAmount: number;
  savings: number; // Descuento por pago anual
}

export interface PricingConfig {
  pricePerUnitPEN: number;
  minimumUnits: number;
  isAnnualPrepaid: boolean;
  annualDiscountPercent?: number; // Descuento por pago anual (opcional)
}

/**
 * Calcula el pricing basado en el número de unidades
 */
export function calculatePricing(
  unitsCount: number,
  config: PricingConfig
): PricingCalculation {
  // El mínimo de unidades a facturar
  const billingUnits = Math.max(unitsCount, config.minimumUnits);
  
  // Cálculo mensual base
  const monthlyAmount = billingUnits * config.pricePerUnitPEN;
  
  // Cálculo anual (12 meses)
  let annualAmount = monthlyAmount * 12;
  
  // Aplicar descuento anual si está configurado
  const discountPercent = config.annualDiscountPercent || 0;
  const savings = annualAmount * (discountPercent / 100);
  annualAmount = annualAmount - savings;

  return {
    unitsCount,
    billingUnits,
    monthlyAmount,
    annualAmount,
    savings
  };
}

/**
 * Obtiene la configuración de pricing por defecto
 */
export function getDefaultPricingConfig(): PricingConfig {
  return {
    pricePerUnitPEN: 1.0,
    minimumUnits: 6,
    isAnnualPrepaid: true,
    annualDiscountPercent: 0 // Sin descuento por ahora
  };
}

/**
 * Valida si un condominio cumple con los requisitos mínimos
 */
export function validateMinimumUnits(unitsCount: number, minimumUnits: number = 6): boolean {
  return unitsCount >= minimumUnits;
}

/**
 * Calcula la fecha de expiración de una suscripción
 */
export function calculateSubscriptionDates(startDate: Date = new Date()) {
  const endDate = new Date(startDate);
  endDate.setFullYear(endDate.getFullYear() + 1);
  
  const renewalDate = new Date(endDate);
  renewalDate.setMonth(renewalDate.getMonth() - 1); // Recordatorio 1 mes antes
  
  return {
    startDate,
    endDate,
    renewalDate
  };
}

/**
 * Formatea el precio en soles peruanos
 */
export function formatPricePEN(amount: number): string {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2
  }).format(amount);
}

/**
 * Ejemplos de uso del pricing
 */
export function getPricingExamples() {
  const config = getDefaultPricingConfig();
  
  return [
    {
      scenario: "Condominio con 8 unidades",
      calculation: calculatePricing(8, config),
      formatted: {
        monthly: formatPricePEN(calculatePricing(8, config).monthlyAmount),
        annual: formatPricePEN(calculatePricing(8, config).annualAmount)
      }
    },
    {
      scenario: "Condominio con 4 unidades (mínimo aplicado)",
      calculation: calculatePricing(4, config),
      formatted: {
        monthly: formatPricePEN(calculatePricing(4, config).monthlyAmount),
        annual: formatPricePEN(calculatePricing(4, config).annualAmount)
      }
    },
    {
      scenario: "Condominio con 20 unidades",
      calculation: calculatePricing(20, config),
      formatted: {
        monthly: formatPricePEN(calculatePricing(20, config).monthlyAmount),
        annual: formatPricePEN(calculatePricing(20, config).annualAmount)
      }
    }
  ];
}