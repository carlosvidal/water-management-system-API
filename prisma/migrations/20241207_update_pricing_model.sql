-- Migration: Update pricing model to unit-based billing
-- Date: 2024-12-07

-- Add new columns to plans table
ALTER TABLE "plans" ADD COLUMN "pricePerUnitPEN" DOUBLE PRECISION DEFAULT 1.0;
ALTER TABLE "plans" ADD COLUMN "minimumUnits" INTEGER DEFAULT 6;
ALTER TABLE "plans" ADD COLUMN "isAnnualPrepaid" BOOLEAN DEFAULT true;

-- Add new columns to condominiums table
ALTER TABLE "condominiums" ADD COLUMN "city" TEXT;
ALTER TABLE "condominiums" ADD COLUMN "country" TEXT;

-- Create subscription status enum
CREATE TYPE "SubscriptionStatus" AS ENUM ('PENDING', 'PAID', 'ACTIVE', 'EXPIRED', 'CANCELLED', 'SUSPENDED');

-- Create subscriptions table
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "condominiumId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "unitsCount" INTEGER NOT NULL,
    "billingUnits" INTEGER NOT NULL,
    "monthlyAmount" DOUBLE PRECISION NOT NULL,
    "annualAmount" DOUBLE PRECISION NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "renewalDate" TIMESTAMP(3) NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "paymentMethod" TEXT,
    "paymentRef" TEXT,
    "paymentProof" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- Create indexes and constraints for subscriptions
CREATE UNIQUE INDEX "subscriptions_condominiumId_startDate_key" ON "subscriptions"("condominiumId", "startDate");

-- Add foreign key constraints
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_condominiumId_fkey" FOREIGN KEY ("condominiumId") REFERENCES "condominiums"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Update existing plans with new pricing model
UPDATE "plans" SET 
    "name" = 'Per Unit Plan',
    "pricePerUnitPEN" = 1.0,
    "minimumUnits" = 6,
    "isAnnualPrepaid" = true,
    "features" = '[]'::jsonb
WHERE "id" IS NOT NULL;

-- Migrate existing condominiums to new subscription model
-- This will create initial subscriptions for existing condominiums
INSERT INTO "subscriptions" (
    "id", 
    "condominiumId", 
    "planId", 
    "unitsCount", 
    "billingUnits", 
    "monthlyAmount", 
    "annualAmount", 
    "startDate", 
    "endDate", 
    "renewalDate", 
    "status"
)
SELECT 
    gen_random_uuid()::text,
    c."id",
    c."planId",
    COALESCE((
        SELECT COUNT(*) 
        FROM "units" u 
        JOIN "blocks" b ON u."blockId" = b."id" 
        WHERE b."condominiumId" = c."id" AND u."isActive" = true
    ), 6) as unitsCount,
    GREATEST(COALESCE((
        SELECT COUNT(*) 
        FROM "units" u 
        JOIN "blocks" b ON u."blockId" = b."id" 
        WHERE b."condominiumId" = c."id" AND u."isActive" = true
    ), 6), 6) as billingUnits,
    GREATEST(COALESCE((
        SELECT COUNT(*) 
        FROM "units" u 
        JOIN "blocks" b ON u."blockId" = b."id" 
        WHERE b."condominiumId" = c."id" AND u."isActive" = true
    ), 6), 6) * 1.0 as monthlyAmount,
    GREATEST(COALESCE((
        SELECT COUNT(*) 
        FROM "units" u 
        JOIN "blocks" b ON u."blockId" = b."id" 
        WHERE b."condominiumId" = c."id" AND u."isActive" = true
    ), 6), 6) * 12.0 as annualAmount,
    COALESCE(c."createdAt", CURRENT_TIMESTAMP) as startDate,
    COALESCE(c."expiresAt", CURRENT_TIMESTAMP + INTERVAL '1 year') as endDate,
    COALESCE(c."expiresAt", CURRENT_TIMESTAMP + INTERVAL '1 year') as renewalDate,
    CASE 
        WHEN c."expiresAt" > CURRENT_TIMESTAMP THEN 'ACTIVE'::SubscriptionStatus
        ELSE 'EXPIRED'::SubscriptionStatus
    END as status
FROM "condominiums" c
WHERE c."isActive" = true;

-- Now we can safely drop the old columns
-- Note: We'll do this in a separate migration to ensure data safety
-- ALTER TABLE "condominiums" DROP COLUMN "expiresAt";
-- ALTER TABLE "plans" DROP COLUMN "maxUnits";
-- ALTER TABLE "plans" DROP COLUMN "monthlyPrice";