/*
  Warnings:

  - You are about to drop the column `expiresAt` on the `condominiums` table. All the data in the column will be lost.
  - You are about to drop the column `maxUnits` on the `plans` table. All the data in the column will be lost.
  - You are about to drop the column `monthlyPrice` on the `plans` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('PENDING', 'PAID', 'ACTIVE', 'EXPIRED', 'CANCELLED', 'SUSPENDED');

-- AlterTable
ALTER TABLE "condominiums" DROP COLUMN "expiresAt",
ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "totalUnitsPlanned" INTEGER;

-- AlterTable
ALTER TABLE "plans" DROP COLUMN "maxUnits",
DROP COLUMN "monthlyPrice",
ADD COLUMN     "isAnnualPrepaid" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "minimumUnits" INTEGER NOT NULL DEFAULT 6,
ADD COLUMN     "pricePerUnitPEN" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
ALTER COLUMN "name" SET DEFAULT 'Per Unit Plan',
ALTER COLUMN "features" SET DEFAULT '[]';

-- CreateTable
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

-- CreateTable
CREATE TABLE "unit_residents" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "residentId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "unit_residents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "unit_residents_unitId_residentId_key" ON "unit_residents"("unitId", "residentId");

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_condominiumId_fkey" FOREIGN KEY ("condominiumId") REFERENCES "condominiums"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_residents" ADD CONSTRAINT "unit_residents_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_residents" ADD CONSTRAINT "unit_residents_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "residents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
