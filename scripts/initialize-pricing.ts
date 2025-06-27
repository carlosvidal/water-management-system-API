/**
 * Script to initialize the new pricing model
 * Run this after the database migration to set up the new pricing system
 */
import { PrismaClient } from '@prisma/client';
import { SubscriptionService } from '../src/services/subscription.service';
import { calculatePricing, getDefaultPricingConfig } from '../src/utils/pricing';

const prisma = new PrismaClient();
const subscriptionService = new SubscriptionService();

async function initializePricingModel() {
  console.log('🚀 Starting pricing model initialization...');

  try {
    // 1. Create default plan if it doesn't exist
    console.log('📋 Checking for existing plans...');
    
    let defaultPlan = await prisma.plan.findFirst({
      where: { isActive: true }
    });

    if (!defaultPlan) {
      console.log('📝 Creating default plan...');
      defaultPlan = await prisma.plan.create({
        data: {
          name: 'Per Unit Plan',
          pricePerUnitPEN: 1.0,
          minimumUnits: 6,
          isAnnualPrepaid: true,
          features: [],
          isActive: true
        }
      });
      console.log(`✅ Default plan created: ${defaultPlan.id}`);
    } else {
      console.log(`✅ Found existing plan: ${defaultPlan.name}`);
    }

    // 2. Update existing condominiums to use the default plan if they don't have one
    console.log('🏢 Updating existing condominiums...');
    
    const condominiumsWithoutPlan = await prisma.condominium.findMany({
      where: {
        planId: null
      }
    });

    for (const condo of condominiumsWithoutPlan) {
      await prisma.condominium.update({
        where: { id: condo.id },
        data: { planId: defaultPlan.id }
      });
      console.log(`📍 Updated condominium: ${condo.name}`);
    }

    // 3. Create initial subscriptions for existing condominiums
    console.log('💳 Creating initial subscriptions...');
    
    const condominiums = await prisma.condominium.findMany({
      where: { isActive: true },
      include: {
        blocks: {
          include: {
            units: {
              where: { isActive: true }
            }
          }
        },
        subscriptions: true
      }
    });

    for (const condo of condominiums) {
      // Skip if already has an active subscription
      const hasActiveSubscription = condo.subscriptions.some(
        sub => sub.status === 'ACTIVE' && new Date(sub.endDate) > new Date()
      );

      if (hasActiveSubscription) {
        console.log(`⏭️  Skipping ${condo.name} - already has active subscription`);
        continue;
      }

      // Count units
      const unitsCount = condo.blocks.reduce(
        (total, block) => total + block.units.length, 
        0
      );

      if (unitsCount === 0) {
        console.log(`⚠️  Skipping ${condo.name} - no units found`);
        continue;
      }

      try {
        const subscription = await subscriptionService.createSubscription({
          condominiumId: condo.id,
          planId: defaultPlan.id,
          notes: 'Initial subscription created during pricing model migration'
        });

        console.log(`✅ Created subscription for ${condo.name} - ${unitsCount} units - S/ ${subscription.annualAmount}`);
      } catch (error) {
        console.error(`❌ Failed to create subscription for ${condo.name}:`, error);
      }
    }

    // 4. Display pricing examples
    console.log('\n💰 Pricing Examples:');
    const examples = [
      { units: 4, note: 'Below minimum (will be billed for 6 units)' },
      { units: 6, note: 'At minimum' },
      { units: 8, note: 'Common size' },
      { units: 12, note: 'Medium size' },
      { units: 20, note: 'Large condominium' }
    ];

    const config = getDefaultPricingConfig();
    
    examples.forEach(({ units, note }) => {
      const pricing = calculatePricing(units, config);
      console.log(`  📊 ${units} units (${note}): S/ ${pricing.monthlyAmount}/month, S/ ${pricing.annualAmount}/year`);
    });

    // 5. Display summary
    const stats = await subscriptionService.getSubscriptionStats();
    console.log('\n📈 Summary:');
    console.log(`  • Total subscriptions: ${stats.total}`);
    console.log(`  • Active subscriptions: ${stats.active}`);
    console.log(`  • Pending subscriptions: ${stats.pending}`);
    console.log(`  • Total annual revenue: S/ ${stats.totalRevenue}`);

    console.log('\n🎉 Pricing model initialization completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('  1. Review pending subscriptions in the admin dashboard');
    console.log('  2. Approve valid payments manually');
    console.log('  3. Contact condominium administrators for payment');
    console.log('  4. Update bank account information in condominium settings');

  } catch (error) {
    console.error('❌ Error during initialization:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
if (require.main === module) {
  initializePricingModel()
    .then(() => {
      console.log('✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

export { initializePricingModel };