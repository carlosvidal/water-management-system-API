import { PrismaClient, UserRole } from '@prisma/client';
import { hashPassword } from '../src/utils/password';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create system configurations
  console.log('📝 Creating system configurations...');
  await prisma.systemConfig.createMany({
    data: [
      {
        key: 'water_basic_rate',
        value: '1.5',
        description: 'Basic water rate per cubic meter ($/m³)',
      },
      {
        key: 'water_fixed_charge',
        value: '5.0',
        description: 'Fixed monthly charge per unit ($)',
      },
      {
        key: 'water_minimum_consumption',
        value: '2.0',
        description: 'Minimum billable consumption per unit (m³)',
      },
      {
        key: 'app_name',
        value: 'Water Management System',
        description: 'Application name',
      },
      {
        key: 'company_name',
        value: 'AquaFlow Solutions',
        description: 'Company name for branding',
      },
    ],
    skipDuplicates: true,
  });

  // Create default plans
  console.log('📋 Creating subscription plans...');
  const basicPlan = await prisma.plan.create({
    data: {
      name: 'Basic Plan',
      pricePerUnitPEN: 1.0,
      minimumUnits: 6,
      isAnnualPrepaid: true,
      features: [
        'Up to 50 units',
        'Basic water consumption tracking',
        'Monthly billing reports',
        'Email support',
      ],
      isActive: true,
    },
  });

  const proPlan = await prisma.plan.create({
    data: {
      name: 'Professional Plan',
      pricePerUnitPEN: 1.0,
      minimumUnits: 6,
      isAnnualPrepaid: true,
      features: [
        'Up to 150 units',
        'Advanced consumption analytics',
        'Real-time billing calculations',
        'OCR reading support',
        'Priority email support',
        'Custom reports',
      ],
      isActive: true,
    },
  });

  const enterprisePlan = await prisma.plan.create({
    data: {
      name: 'Enterprise Plan',
      pricePerUnitPEN: 1.0,
      minimumUnits: 6,
      isAnnualPrepaid: true,
      features: [
        'Up to 500 units',
        'Full feature access',
        'API access',
        'White-label options',
        'Dedicated support',
        'Custom integrations',
        'Advanced reporting suite',
      ],
      isActive: true,
    },
  });

  // Create super admin user
  console.log('👤 Creating super admin user...');
  const hashedPassword = await hashPassword('SuperAdmin123!');
  
  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@aquaflow.com' },
    update: {},
    create: {
      email: 'admin@aquaflow.com',
      password: hashedPassword,
      name: 'Super Administrator',
      phone: '+1-555-0100',
      role: UserRole.SUPER_ADMIN,
      isActive: true,
    },
  });

  // Create demo condominium
  console.log('🏢 Creating demo condominium...');
  const demoAdminPassword = await hashPassword('DemoAdmin123!');
  
  const demoAdmin = await prisma.user.upsert({
    where: { email: 'demo@sunsetgardens.com' },
    update: {},
    create: {
      email: 'demo@sunsetgardens.com',
      password: demoAdminPassword,
      name: 'Maria Rodriguez',
      phone: '+1-555-0200',
      role: UserRole.ADMIN,
      isActive: true,
    },
  });

  const demoCondominium = await prisma.condominium.create({
    data: {
      name: 'Sunset Gardens Residences',
      address: '123 Palm Avenue, Miami, FL 33101',
      city: 'Miami',
      country: 'USA',
      readingDay: 15, // 15th of each month
      bankAccount: '1234567890',
      bankAccountHolder: 'Sunset Gardens HOA',
      planId: proPlan.id,
      totalUnitsPlanned: 35,
      isActive: true,
    },
  });

  // Link demo admin to demo condominium
  await prisma.condominiumUser.upsert({
    where: {
      userId_condominiumId: {
        userId: demoAdmin.id,
        condominiumId: demoCondominium.id,
      },
    },
    update: {},
    create: {
      userId: demoAdmin.id,
      condominiumId: demoCondominium.id,
      role: UserRole.ADMIN,
    },
  });

  // Create blocks for demo condominium
  console.log('🏗️ Creating blocks and units...');
  const blockA = await prisma.block.create({
    data: {
      name: 'Block A',
      condominiumId: demoCondominium.id,
      maxUnits: 20,
    },
  });

  const blockB = await prisma.block.create({
    data: {
      name: 'Block B',
      condominiumId: demoCondominium.id,
      maxUnits: 15,
    },
  });

  // Create some demo residents
  const residents = await Promise.all([
    prisma.resident.create({
      data: {
        name: 'John Smith',
        email: 'john.smith@email.com',
        phone: '+1-555-0301',
        condominiumId: demoCondominium.id,
      },
    }),
    prisma.resident.create({
      data: {
        name: 'Sarah Johnson',
        email: 'sarah.johnson@email.com',
        phone: '+1-555-0302',
        condominiumId: demoCondominium.id,
      },
    }),
    prisma.resident.create({
      data: {
        name: 'Carlos Mendez',
        email: 'carlos.mendez@email.com',
        phone: '+1-555-0303',
        condominiumId: demoCondominium.id,
      },
    }),
    prisma.resident.create({
      data: {
        name: 'Lisa Chen',
        email: 'lisa.chen@email.com',
        phone: '+1-555-0304',
        condominiumId: demoCondominium.id,
      },
    }),
    prisma.resident.create({
      data: {
        name: 'Michael Brown',
        email: 'michael.brown@email.com',
        phone: '+1-555-0305',
        condominiumId: demoCondominium.id,
      },
    }),
  ]);

  // Create units in Block A (apartments 101-110)
  for (let i = 1; i <= 10; i++) {
    const unit = await prisma.unit.create({
      data: {
        name: `A${100 + i}`,
        blockId: blockA.id,
        residentId: i <= residents.length ? residents[i - 1].id : null,
        isActive: true,
      },
    });

    // Create water meter for each unit
    await prisma.meter.create({
      data: {
        unitId: unit.id,
        type: 'WATER',
        serialNumber: `WM${String(100 + i).padStart(6, '0')}`,
        isActive: true,
      },
    });
  }

  // Create units in Block B (apartments 201-205)
  for (let i = 1; i <= 5; i++) {
    const unit = await prisma.unit.create({
      data: {
        name: `B${200 + i}`,
        blockId: blockB.id,
        isActive: true,
      },
    });

    // Create water meter for each unit
    await prisma.meter.create({
      data: {
        unitId: unit.id,
        type: 'WATER',
        serialNumber: `WM${String(200 + i).padStart(6, '0')}`,
        isActive: true,
      },
    });
  }

  // Create a conserje/janitor user
  console.log('👨‍🔧 Creating maintenance user...');
  const janitorPassword = await hashPassword('Janitor123!');
  
  const janitor = await prisma.user.upsert({
    where: { email: 'janitor@sunsetgardens.com' },
    update: {},
    create: {
      email: 'janitor@sunsetgardens.com',
      password: janitorPassword,
      name: 'Roberto Martinez',
      phone: '+1-555-0400',
      role: UserRole.EDITOR,
      isActive: true,
    },
  });

  // Link janitor to demo condominium
  await prisma.condominiumUser.upsert({
    where: {
      userId_condominiumId: {
        userId: janitor.id,
        condominiumId: demoCondominium.id,
      },
    },
    update: {},
    create: {
      userId: janitor.id,
      condominiumId: demoCondominium.id,
      role: UserRole.EDITOR,
    },
  });

  console.log('✅ Database seed completed successfully!');
  console.log('\n📧 Demo Accounts Created:');
  console.log('├── Super Admin: admin@aquaflow.com (password: SuperAdmin123!)');
  console.log('├── Condominium Admin: demo@sunsetgardens.com (password: DemoAdmin123!)');
  console.log('└── Maintenance Staff: janitor@sunsetgardens.com (password: Janitor123!)');
  console.log('\n🏢 Demo Condominium: Sunset Gardens Residences');
  console.log('├── Block A: 10 units (A101-A110) with residents');
  console.log('└── Block B: 5 units (B201-B205) available');
  console.log('\n💳 Subscription Plans:');
  console.log('├── Basic Plan: $29.99/month (50 units)');
  console.log('├── Professional Plan: $79.99/month (150 units)');
  console.log('└── Enterprise Plan: $199.99/month (500 units)');
}

main()
  .catch((e) => {
    console.error('❌ Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });