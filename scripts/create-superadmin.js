/**
 * CLI Script: Create or Promote a Super Admin / Platform Owner
 * Usage:
 *   node scripts/create-superadmin.js [email] [password] [fullName]
 *
 * Example:
 *   node scripts/create-superadmin.js admin@smsapp.com Admin@2026! "Master Admin"
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const email = (args[0] || 'admin@smsapp.com').toLowerCase().trim();
  const password = args[1] || 'Admin@2026!';
  const fullName = args[2] || 'Platform Owner';

  console.log('--------------------------------------------------');
  console.log('🚀 SMS SaaS Platform - Super Admin Provisioning');
  console.log('--------------------------------------------------');
  console.log(`Email:     ${email}`);
  console.log(`Full Name: ${fullName}`);
  console.log(`Password:  ${password}`);
  console.log('--------------------------------------------------');

  try {
    // 1. Ensure master system platform tenant exists
    const masterSubdomain = 'platform-admin';
    let tenant = await prisma.tenant.findUnique({
      where: { subdomain: masterSubdomain },
    });

    if (!tenant) {
      console.log('Creating master platform tenant...');
      tenant = await prisma.tenant.create({
        data: {
          name: 'SMS Global Platform Headquarters',
          alias: 'HQ',
          subdomain: masterSubdomain,
          currency: 'GHS',
          plan: 'ENTERPRISE',
          studentLimit: 999999,
          status: 'ACTIVE',
        },
      });
      console.log(`✅ Master tenant created (ID: ${tenant.id})`);
    } else {
      console.log(`ℹ️ Master tenant exists (ID: ${tenant.id})`);
    }

    // 2. Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // 3. Find if user exists
    const existingUser = await prisma.user.findFirst({
      where: { email },
    });

    let user;
    if (existingUser) {
      console.log(`User ${email} already exists. Updating to SUPER_ADMIN role and setting new password...`);
      user = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          role: 'SUPER_ADMIN',
          passwordHash,
          fullName,
          status: 'ACTIVE',
        },
      });
      console.log(`✅ User ${user.email} promoted to SUPER_ADMIN!`);
    } else {
      console.log(`Creating new SUPER_ADMIN user...`);
      user = await prisma.user.create({
        data: {
          tenantId: tenant.id,
          email,
          fullName,
          passwordHash,
          role: 'SUPER_ADMIN',
          status: 'ACTIVE',
        },
      });
      console.log(`✅ Super Admin created with ID: ${user.id}`);
    }

    console.log('--------------------------------------------------');
    console.log('🎉 Super Admin account ready!');
    console.log(`You can now log in at: http://localhost:3000/admin`);
    console.log(`Email:    ${email}`);
    console.log(`Password: ${password}`);
    console.log('--------------------------------------------------');
  } catch (err) {
    console.error('❌ Error creating Super Admin:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
