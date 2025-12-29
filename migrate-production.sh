#!/bin/bash

# Script para ejecutar migraciones en producción
# Este script debe ejecutarse en el servidor de Coolify

echo "🔄 Aplicando migraciones de Prisma en producción..."

# Aplicar migraciones
npx prisma migrate deploy

echo "✅ Migraciones aplicadas exitosamente"

# Generar cliente de Prisma
npx prisma generate

echo "✅ Cliente de Prisma generado"

echo "🎉 Proceso completado"
