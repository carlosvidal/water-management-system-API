#!/bin/bash

# Script de despliegue rápido para fix crítico
# Uso: ./deploy-fix.sh

set -e  # Salir si hay error

echo "🚀 Iniciando despliegue del fix crítico..."

# 1. Verificar que estamos en la rama correcta
echo "📍 Verificando rama git..."
CURRENT_BRANCH=$(git branch --show-current)
echo "   Rama actual: $CURRENT_BRANCH"

# 2. Compilar TypeScript
echo "🔨 Compilando TypeScript..."
npm run build

# 3. Verificar que no hay errores de sintaxis
echo "✅ Verificando sintaxis..."
node -c dist/index.js

# 4. Commit y push (opcional)
read -p "¿Deseas hacer commit y push? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]
then
    echo "📝 Haciendo commit..."
    git add src/routes/condominiums.ts
    git commit -m "fix: include blocks and units in GET /condominiums endpoint

- Changed _count to full include for blocks and units
- Fixes Flutter app showing 0 blocks/units
- Improves performance by reducing N+1 queries"

    echo "📤 Pushing a remoto..."
    git push
fi

# 5. Despliegue
echo ""
echo "🎯 Opciones de despliegue:"
echo "   1. PM2 (recomendado para VPS)"
echo "   2. Docker"
echo "   3. Manual (solo rebuild)"
echo ""
read -p "Selecciona opción (1-3): " -n 1 -r
echo

case $REPLY in
    1)
        echo "🔄 Reiniciando con PM2..."
        pm2 restart water-api || pm2 start dist/index.js --name water-api
        pm2 save
        echo "✅ API reiniciada con PM2"
        ;;
    2)
        echo "🐳 Reconstruyendo contenedor Docker..."
        docker-compose build api
        docker-compose up -d api
        echo "✅ Contenedor Docker actualizado"
        ;;
    3)
        echo "✅ Build completado. Reinicia el servidor manualmente."
        ;;
    *)
        echo "❌ Opción inválida"
        exit 1
        ;;
esac

echo ""
echo "✅ ¡Despliegue completado!"
echo ""
echo "🧪 Para probar el fix:"
echo "   curl https://api.consumos.online/api/condominiums -H 'Authorization: Bearer YOUR_TOKEN'"
echo ""
echo "📊 Verifica que la respuesta incluye:"
echo "   - blocks: [{ id, name, units: [...] }] ✅"
echo "   - NO solo _count: { blocks: 1 } ❌"
