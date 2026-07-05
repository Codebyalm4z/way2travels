const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
require('dotenv').config();

const prisma = new PrismaClient();
const newPlainPassword = 'almaz@1322'; // desired admin password

async function resetAdminPassword() {
  try {
    const hashed = await bcrypt.hash(newPlainPassword, 10);
    await prisma.user.upsert({
      where: { email: 'admin@way2travels.com' },
      update: { password: hashed },
      create: {
        name: 'Admin User',
        email: 'admin@way2travels.com',
        password: hashed,
        role: 'SUPER_ADMIN',
      },
    });
    console.log('✅ Admin password reset to', newPlainPassword);
  } catch (e) {
    console.error('Error resetting admin password:', e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

resetAdminPassword();
