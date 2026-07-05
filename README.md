# Way2Travels

A full-stack travel agency website with public pages, REST backend APIs, JSON persistence, and a protected admin dashboard.

## Business Details

- Brand: Way2Travels
- Email: info@way2travels.com
- Phone / WhatsApp: +91 92581 91298
- Currency: INR (`₹`)

## Run Locally

```bash
npm start
```

Open `http://localhost:5188`.

Admin dashboard:

- URL: `http://localhost:5188/admin.html`
- Email: `admin@way2travels.com`
- Password: `way2travels123`

## Features

- Public home, packages, destinations, reviews, blogs, about, contact, FAQ, privacy, and terms views
- Package detail modal with itinerary, inclusions, exclusions, gallery, hotel options, INR pricing, and inquiry form
- Backend REST APIs for packages, destinations, reviews, inquiries, blogs, FAQs, settings, offers, and auth
- Admin dashboard for create, edit, delete, publish/unpublish, inquiry CRM status updates, and site settings
- Seed data for Indian and international destinations, packages, realistic sample reviews, blogs, FAQs, and offers
- Click-to-call and WhatsApp CTAs using +91 92581 91298

## API Notes

Admin endpoints require `Authorization: Bearer <token>` after logging in at `/api/auth/login`.

This version uses `data/db.json` as a local database so it runs without installing external dependencies. A Prisma schema is included in `prisma/schema.prisma` as a migration-ready blueprint for PostgreSQL when you move to production.

## Production Upgrade Path

- Replace JSON storage in `server.js` with Prisma Client
- Use PostgreSQL on Neon/Supabase
- Move admin auth to NextAuth/JWT with hashed passwords
- Move image URLs to Cloudinary or S3
- Configure SMTP/Resend credentials for real inquiry notification emails
