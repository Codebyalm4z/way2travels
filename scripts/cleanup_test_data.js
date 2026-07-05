const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const prisma = new PrismaClient();

async function cleanup() {
  try {
    // Delete test package
    await prisma.package.deleteMany({ where: { slug: 'test-package' } });
    console.log('Deleted test packages');
    // Delete test blog
    await prisma.blogPost.deleteMany({ where: { slug: 'test-blog' } });
    console.log('Deleted test blogs');
    // Delete test FAQ
    await prisma.fAQ.deleteMany({ where: { question: 'Test FAQ?' } });
    console.log('Deleted test FAQs');
    // Delete test inquiry
    await prisma.inquiry.deleteMany({ where: { email: 'john@example.com', name: 'John Doe' } });
    console.log('Deleted test inquiries');
  } catch (e) {
    console.error('Cleanup error:', e);
  } finally {
    await prisma.$disconnect();
  }
}

cleanup();
