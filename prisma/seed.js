// prisma/seed.js
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  const dbPath = path.join(__dirname, '..', 'data', 'db.json');
  const raw = fs.readFileSync(dbPath, 'utf-8');
  // Remove possible BOM character that can cause JSON parsing errors
  const cleanRaw = raw.replace(/^\uFEFF/, '');
  const data = JSON.parse(cleanRaw);

  // Settings (key/value)
  if (data.settings) {
    for (const [key, value] of Object.entries(data.settings)) {
      await prisma.siteSetting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      });
    }
  }

  // Default SUPER_ADMIN user
  const adminEmail = 'admin@way2travels.com';
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    const hashed = await bcrypt.hash('change-this-before-launch', 10);
    await prisma.user.create({
      data: {
        name: 'Admin User',
        email: adminEmail,
        password: hashed,
        role: 'SUPER_ADMIN',
      },
    });
    console.log('✅ SUPER_ADMIN created');
  } else {
    console.log('ℹ️ SUPER_ADMIN already exists');
  }

  // Destinations
  const destMap = {};
  if (Array.isArray(data.destinations)) {
    for (const dest of data.destinations) {
      const created = await prisma.destination.upsert({
        where: { id: dest.id },
        update: {
          name: dest.name,
          slug: dest.slug,
          type: dest.type,
          coverImage: dest.coverImage,
          summary: dest.summary,
          isPublished: dest.isPublished,
        },
        create: {
          id: dest.id,
          name: dest.name,
          slug: dest.slug,
          type: dest.type,
          coverImage: dest.coverImage,
          summary: dest.summary,
          isPublished: dest.isPublished,
        },
      });
      destMap[dest.id] = created.id;
    }
  }

  // Packages (including gallery and itinerary)
  if (Array.isArray(data.packages)) {
    for (const pkg of data.packages) {
      const pkgRecord = await prisma.package.upsert({
        where: { id: pkg.id },
        update: {
          title: pkg.title,
          slug: pkg.slug,
          destinationId: pkg.destinationId,
          type: pkg.type,
          cities: JSON.stringify(pkg.cities ?? []),
          nights: pkg.nights,
          days: pkg.days,
          price: pkg.price,
          oldPrice: pkg.oldPrice,
          discount: pkg.discount,
          hotelOptions: JSON.stringify(pkg.hotelOptions ?? []),
          packageType: pkg.packageType,
          featured: pkg.featured,
          isPublished: pkg.isPublished,
          image: pkg.image,
          inclusions: JSON.stringify(pkg.inclusions ?? []),
          exclusions: JSON.stringify(pkg.exclusions ?? []),
          terms: pkg.terms,
        },
        create: {
          id: pkg.id,
          title: pkg.title,
          slug: pkg.slug,
          destinationId: pkg.destinationId,
          type: pkg.type,
          cities: JSON.stringify(pkg.cities ?? []),
          nights: pkg.nights,
          days: pkg.days,
          price: pkg.price,
          oldPrice: pkg.oldPrice,
          discount: pkg.discount,
          hotelOptions: JSON.stringify(pkg.hotelOptions ?? []),
          packageType: pkg.packageType,
          featured: pkg.featured,
          isPublished: pkg.isPublished,
          image: pkg.image,
          inclusions: JSON.stringify(pkg.inclusions ?? []),
          exclusions: JSON.stringify(pkg.exclusions ?? []),
          terms: pkg.terms,
        },
      });

      // Gallery images
      if (Array.isArray(pkg.gallery)) {
        for (const url of pkg.gallery) {
          await prisma.packageImage.create({
            data: { url, packageId: pkgRecord.id },
          });
        }
      }

      // Itinerary days
      if (Array.isArray(pkg.itinerary)) {
        for (let i = 0; i < pkg.itinerary.length; i++) {
          await prisma.itineraryDay.create({
            data: {
              dayNumber: i + 1,
              title: null,
              details: pkg.itinerary[i],
              packageId: pkgRecord.id,
            },
          });
        }
      }
    }
  }

  // Reviews
  if (Array.isArray(data.reviews)) {
    for (const rev of data.reviews) {
      await prisma.review.upsert({
        where: { id: rev.id },
        update: {
          name: rev.name,
          city: rev.city,
          country: rev.country,
          rating: rev.rating,
          text: rev.text,
          destination: rev.destination,
          photo: rev.photo,
          approved: rev.approved,
          verified: rev.verified,
          displayOrder: rev.displayOrder,
        },
        create: {
          id: rev.id,
          name: rev.name,
          city: rev.city,
          country: rev.country,
          rating: rev.rating,
          text: rev.text,
          destination: rev.destination,
          photo: rev.photo,
          approved: rev.approved,
          verified: rev.verified,
          displayOrder: rev.displayOrder,
        },
      });
    }
  }

  // Blog posts
  if (Array.isArray(data.blogs)) {
    for (const blog of data.blogs) {
      await prisma.blogPost.upsert({
        where: { id: blog.id },
        update: {
          title: blog.title,
          slug: blog.slug,
          category: blog.category,
          coverImage: blog.coverImage,
          excerpt: blog.excerpt,
          content: blog.content,
          tags: JSON.stringify(blog.tags ?? []),
          seoTitle: blog.seoTitle,
          seoDescription: blog.seoDescription,
          isPublished: blog.isPublished,
        },
        create: {
          id: blog.id,
          title: blog.title,
          slug: blog.slug,
          category: blog.category,
          coverImage: blog.coverImage,
          excerpt: blog.excerpt,
          content: blog.content,
          tags: JSON.stringify(blog.tags ?? []),
          seoTitle: blog.seoTitle,
          seoDescription: blog.seoDescription,
          isPublished: blog.isPublished,
        },
      });
    }
  }

  // FAQs
  if (Array.isArray(data.faqs)) {
    for (const faq of data.faqs) {
      await prisma.fAQ.upsert({
        where: { id: faq.id },
        update: {
          question: faq.question,
          answer: faq.answer,
          isPublished: faq.isPublished,
        },
        create: {
          id: faq.id,
          question: faq.question,
          answer: faq.answer,
          isPublished: faq.isPublished,
        },
      });
    }
  }

  // Offers
  if (Array.isArray(data.offers)) {
    for (const offer of data.offers) {
      await prisma.offer.upsert({
        where: { id: offer.id },
        update: {
          title: offer.title,
          description: offer.description,
          isPublished: offer.isPublished,
        },
        create: {
          id: offer.id,
          title: offer.title,
          description: offer.description,
          isPublished: offer.isPublished,
        },
      });
    }
  }

  // Inquiries (if any)
  if (Array.isArray(data.inquiries)) {
    for (const inc of data.inquiries) {
      await prisma.inquiry.upsert({
        where: { id: inc.id },
        update: {
          name: inc.name,
          email: inc.email,
          phone: inc.phone,
          destination: inc.destination,
          package: inc.package,
          travelDate: inc.travelDate ? new Date(inc.travelDate) : null,
          travelers: inc.travelers,
          message: inc.message,
          status: inc.status,
          notes: inc.notes,
        },
        create: {
          id: inc.id,
          name: inc.name,
          email: inc.email,
          phone: inc.phone,
          destination: inc.destination,
          package: inc.package,
          travelDate: inc.travelDate ? new Date(inc.travelDate) : null,
          travelers: inc.travelers,
          message: inc.message,
          status: inc.status,
          notes: inc.notes,
        },
      });
    }
  }

  console.log('✅ Seed completed');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
