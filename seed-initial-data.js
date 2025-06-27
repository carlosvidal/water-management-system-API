const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database with initial data...');

  // Create default plan
  const existingPlan = await prisma.plan.findFirst();
  let defaultPlan;
  
  if (!existingPlan) {
    defaultPlan = await prisma.plan.create({
      data: {
        name: 'Per Unit Plan',
        pricePerUnitPEN: 1.0,
        minimumUnits: 6,
        isAnnualPrepaid: true,
        features: JSON.stringify([
          'Gestión de lecturas',
          'Reportes básicos',
          'Soporte técnico',
          'Almacenamiento en la nube'
        ]),
        isActive: true,
      },
    });
  } else {
    defaultPlan = existingPlan;
  }

  console.log('✅ Default plan created:', defaultPlan.name);

  // Create demo user if not exists
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@aquaflow.com' },
    update: {},
    create: {
      name: 'Demo User',
      email: 'demo@aquaflow.com',
      password: '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // password: demo123
      role: 'ADMIN',
      isActive: true,
    },
  });

  console.log('✅ Demo user created:', demoUser.email);

  // Give demo user access to existing condominiums
  const existingCondominiums = await prisma.condominium.findMany();
  
  for (const condominium of existingCondominiums) {
    const existingAccess = await prisma.condominiumUser.findUnique({
      where: {
        userId_condominiumId: {
          userId: demoUser.id,
          condominiumId: condominium.id,
        },
      },
    });

    if (!existingAccess) {
      await prisma.condominiumUser.create({
        data: {
          userId: demoUser.id,
          condominiumId: condominium.id,
          role: 'ADMIN',
        },
      });
      console.log(`✅ Demo user granted access to condominium: ${condominium.name}`);
    }
  }

  console.log('🎉 Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });