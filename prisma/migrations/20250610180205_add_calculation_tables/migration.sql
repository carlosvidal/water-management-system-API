-- CreateTable
CREATE TABLE "period_calculations" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "costPerCubicMeter" DOUBLE PRECISION NOT NULL,
    "totalIndividualConsumption" DOUBLE PRECISION NOT NULL,
    "totalCommonAreasConsumption" DOUBLE PRECISION NOT NULL,
    "totalIndividualAmount" DOUBLE PRECISION NOT NULL,
    "totalCommonAreasAmount" DOUBLE PRECISION NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "period_calculations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unit_calculations" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "meterId" TEXT,
    "previousReading" DOUBLE PRECISION NOT NULL,
    "currentReading" DOUBLE PRECISION NOT NULL,
    "consumption" DOUBLE PRECISION NOT NULL,
    "individualAmount" DOUBLE PRECISION NOT NULL,
    "commonAreasAmount" DOUBLE PRECISION NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "residentName" TEXT,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "unit_calculations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "period_calculations_periodId_key" ON "period_calculations"("periodId");

-- AddForeignKey
ALTER TABLE "period_calculations" ADD CONSTRAINT "period_calculations_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_calculations" ADD CONSTRAINT "unit_calculations_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_calculations" ADD CONSTRAINT "unit_calculations_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;
