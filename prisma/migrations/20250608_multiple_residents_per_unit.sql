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
ALTER TABLE "unit_residents" ADD CONSTRAINT "unit_residents_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_residents" ADD CONSTRAINT "unit_residents_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "residents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrar datos existentes de la relación legacy a la nueva tabla
INSERT INTO "unit_residents" ("id", "unitId", "residentId", "isPrimary", "createdAt", "updatedAt")
SELECT 
    CONCAT('ur_', "id") as id,
    "id" as unitId,
    "residentId" as residentId,
    true as isPrimary,
    "createdAt",
    "updatedAt"
FROM "units" 
WHERE "residentId" IS NOT NULL;