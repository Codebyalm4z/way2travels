// server.js
// Refactored backend using Prisma, JWT, bcrypt, Cloudinary signed uploads, and Resend email.
// Preserves existing API paths and response shapes for the frontend/admin dashboard.

require('dotenv').config();
const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const multer = require('multer');
const { PrismaClient } = require('@prisma/client');
const cloudinary = require('cloudinary').v2;
const { Resend } = require('resend');

const prisma = new PrismaClient();
const upload = multer({ dest: path.join(__dirname, 'uploads/') });
const resend = new Resend(process.env.RESEND_API_KEY);

// Cloudinary configuration (signed uploads)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const PORT = process.env.PORT || 5188;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');

// Utility: parse JSON string fields stored in SQLite (fallback to [] on error)
function parseJsonField(value) {
  if (!value) return [];
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}

// Helper: send response with proper headers (CORS enabled for admin UI)
function send(res, status, data, type = 'application/json; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': type,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  });
  res.end(type.includes('application/json') ? JSON.stringify(data) : data);
}

// JWT auth middleware – verifies token and attaches user to request
function authenticate(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return null;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    return payload; // { id, email, role, name }
  } catch {
    return null;
  }
}

// Admin guard – ensures JWT present and role is permitted
function requireAdmin(req, res) {
  const user = authenticate(req);
  if (!user) {
    send(res, 401, { error: 'Unauthorized' });
    return null;
  }
  if (!['SUPER_ADMIN', 'ADMIN', 'EDITOR'].includes(user.role)) {
    send(res, 403, { error: 'Forbidden' });
    return null;
  }
  return user;
}

// Public data endpoint – mirrors original structure
async function getPublicData() {
  const settingsRows = await prisma.siteSetting.findMany();
  const settings = {};
  for (const row of settingsRows) {
    settings[row.key] = row.value;
  }
  const destinations = await prisma.destination.findMany({ where: { isPublished: true } });
  const packages = await prisma.package.findMany({
    where: { isPublished: true },
    include: { destination: true, gallery: true, itinerary: true },
  });
  const reviews = await prisma.review.findMany({ where: { approved: true }, orderBy: { displayOrder: 'asc' } });
  const blogs = await prisma.blogPost.findMany({ where: { isPublished: true } });
  const faqs = await prisma.fAQ.findMany({ where: { isPublished: true } });
  const offers = await prisma.offer.findMany({ where: { isPublished: true } });

  const transformedPackages = packages.map(p => ({
    ...p,
    destination: p.destination,
    cities: parseJsonField(p.cities),
    hotelOptions: parseJsonField(p.hotelOptions),
    inclusions: parseJsonField(p.inclusions),
    exclusions: parseJsonField(p.exclusions),
    gallery: p.gallery.map(g => g.url),
    itinerary: p.itinerary.map(i => i.details),
  }));

  const transformedBlogs = blogs.map(b => ({
    ...b,
    tags: parseJsonField(b.tags),
  }));

  return {
    settings,
    destinations,
    packages: transformedPackages,
    reviews,
    blogs: transformedBlogs,
    faqs,
    offers,
  };
}

// Generic CRUD handling for admin resources using Prisma models
const modelMap = {
  packages: 'package',
  destinations: 'destination',
  reviews: 'review',
  blogs: 'blogPost',
  faqs: 'fAQ',
  offers: 'offer',
  inquiries: 'inquiry',
  settings: 'siteSetting',
};

async function handleCrud(req, res, collection, id) {
  const prismaModel = prisma[modelMap[collection]];
  if (!prismaModel) {
    send(res, 404, { error: 'Collection not found' });
    return;
  }

  const adminRequired = !(collection === 'inquiries' && req.method === 'POST');
  if (adminRequired) {
    const admin = requireAdmin(req, res);
    if (!admin) return;
  }

  if (req.method === 'GET' && !id) {
    const data = await prismaModel.findMany();
    if (collection === 'packages') {
      return send(res, 200, data.map(p => ({
        ...p,
        cities: parseJsonField(p.cities),
        hotelOptions: parseJsonField(p.hotelOptions),
        inclusions: parseJsonField(p.inclusions),
        exclusions: parseJsonField(p.exclusions),
      })));
    }
    if (collection === 'blogs') {
      return send(res, 200, data.map(b => ({ ...b, tags: parseJsonField(b.tags) })));
    }
    return send(res, 200, data);
  }

  if (req.method === 'GET' && id) {
    const item = await prismaModel.findUnique({ where: { id } });
    if (!item) return send(res, 404, { error: 'Item not found' });
    if (collection === 'packages') {
      return send(res, 200, {
        ...item,
        cities: parseJsonField(item.cities),
        hotelOptions: parseJsonField(item.hotelOptions),
        inclusions: parseJsonField(item.inclusions),
        exclusions: parseJsonField(item.exclusions),
      });
    }
    if (collection === 'blogs') {
      return send(res, 200, { ...item, tags: parseJsonField(item.tags) });
    }
    return send(res, 200, item);
  }

  const body = await new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; if (data.length > 1e6) req.destroy(); });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  }).catch(err => {
    send(res, 400, { error: 'Invalid JSON' });
    return null;
  });
  if (body === null) return;

  if (req.method === 'POST' && !id) {
    if (collection === 'packages') {
      if (body.cities) body.cities = JSON.stringify(body.cities);
      if (body.hotelOptions) body.hotelOptions = JSON.stringify(body.hotelOptions);
      if (body.inclusions) body.inclusions = JSON.stringify(body.inclusions);
      if (body.exclusions) body.exclusions = JSON.stringify(body.exclusions);
    }
    if (collection === 'blogs' && body.tags) {
      body.tags = JSON.stringify(body.tags);
    }
    const created = await prismaModel.create({ data: { ...body } });
    return send(res, 201, created);
  }

  if (req.method === 'PUT' && id) {
    if (collection === 'packages') {
      if (body.cities) body.cities = JSON.stringify(body.cities);
      if (body.hotelOptions) body.hotelOptions = JSON.stringify(body.hotelOptions);
      if (body.inclusions) body.inclusions = JSON.stringify(body.inclusions);
      if (body.exclusions) body.exclusions = JSON.stringify(body.exclusions);
    }
    if (collection === 'blogs' && body.tags) {
      body.tags = JSON.stringify(body.tags);
    }
    const updated = await prismaModel.update({ where: { id }, data: { ...body } });
    return send(res, 200, updated);
  }

  if (req.method === 'DELETE' && id) {
    const removed = await prismaModel.delete({ where: { id } });
    return send(res, 200, removed);
  }

  send(res, 405, { error: 'Method not allowed' });
}

// Inquiry POST (public) – also sends email via Resend
async function handleInquiry(req, res) {
  const body = await new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; if (data.length > 1e6) req.destroy(); });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  }).catch(err => {
    send(res, 400, { error: 'Invalid JSON' });
    return null;
  });
  if (!body) return;

  const inquiry = await prisma.inquiry.create({
    data: {
      name: body.name || '',
      email: body.email || '',
      phone: body.phone || '',
      destination: body.destination || '',
      package: body.package || '',
      travelDate: body.travelDate ? new Date(body.travelDate) : null,
      travelers: Number(body.travelers || 1),
      message: body.message || '',
      status: 'NEW',
      notes: '',
    },
  });

  try {
    await resend.emails.send({
      from: 'no-reply@way2travels.com',
      to: process.env.INFO_EMAIL || 'info@way2travels.com',
      subject: 'New Way2Travels Inquiry',
      html: `<p><strong>Name:</strong> ${inquiry.name}</p>
        <p><strong>Email:</strong> ${inquiry.email}</p>
        <p><strong>Phone:</strong> ${inquiry.phone}</p>
        <p><strong>Destination:</strong> ${inquiry.destination}</p>
        <p><strong>Message:</strong> ${inquiry.message}</p>`,
    });
  } catch (e) {
    console.error('Resend email error', e);
  }
  return send(res, 201, inquiry);
}

// Cloudinary signed upload endpoint (admin only)
async function handleUpload(req, res) {
  const admin = requireAdmin(req, res);
  if (!admin) return;

  upload.single('file')(req, res, async err => {
    if (err) return send(res, 500, { error: 'Upload error' });
    if (!req.file) return send(res, 400, { error: 'No file provided' });
    try {
      const result = await cloudinary.uploader.upload(req.file.path, { folder: 'way2travels' });
      fs.unlinkSync(req.file.path);
      return send(res, 200, { url: result.secure_url, public_id: result.public_id });
    } catch (e) {
      console.error('Cloudinary upload error', e);
      return send(res, 500, { error: 'Cloudinary upload failed' });
    }
  });
}

// Main request dispatcher
async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'OPTIONS') return send(res, 204, {});

  if (url.pathname === '/api/public' && req.method === 'GET') {
    const data = await getPublicData();
    return send(res, 200, data);
  }

  if (url.pathname === '/api/auth/login' && req.method === 'POST') {
    const body = await new Promise((resolve, reject) => {
      let data = '';
      req.on('data', chunk => { data += chunk; if (data.length > 1e6) req.destroy(); });
      req.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
      req.on('error', reject);
    }).catch(() => null);
    if (!body) return send(res, 400, { error: 'Invalid JSON' });
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user) return send(res, 401, { error: 'Invalid credentials' });
    const passwordMatch = await bcrypt.compare(body.password, user.password);
    if (!passwordMatch) return send(res, 401, { error: 'Invalid credentials' });
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      process.env.JWT_SECRET || 'way2travels-local-dev-secret',
      { expiresIn: '7d' }
    );
    return send(res, 200, {
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  }

  if (url.pathname === '/api/auth/logout' && req.method === 'POST') {
    return send(res, 200, { ok: true });
  }

  if (url.pathname === '/api/inquiries' && req.method === 'POST') {
    return handleInquiry(req, res);
  }

  if (url.pathname === '/api/upload' && req.method === 'POST') {
    return handleUpload(req, res);
  }

  if (url.pathname.startsWith('/api/settings')) {
    const parts = url.pathname.split('/').filter(Boolean);
    if (req.method === 'GET' && parts.length === 2) {
      const rows = await prisma.siteSetting.findMany();
      const map = {};
      rows.forEach(r => (map[r.key] = r.value));
      return send(res, 200, map);
    }
    if (req.method === 'PUT' && parts.length === 2) {
      const admin = requireAdmin(req, res);
      if (!admin) return;
      const body = await new Promise((resolve, reject) => {
        let data = '';
        req.on('data', chunk => { data += chunk; if (data.length > 1e6) req.destroy(); });
        req.on('end', () => {
          try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
        });
        req.on('error', reject);
      }).catch(() => null);
      if (!body) return send(res, 400, { error: 'Invalid JSON' });
      const ops = Object.entries(body).map(async ([key, value]) => {
        await prisma.siteSetting.upsert({
          where: { key },
          update: { value: String(value) },
          create: { key, value: String(value) },
        });
      });
      await Promise.all(ops);
      const rows = await prisma.siteSetting.findMany();
      const map = {};
      rows.forEach(r => (map[r.key] = r.value));
      return send(res, 200, map);
    }
    return send(res, 405, { error: 'Method not allowed' });
  }

  if (url.pathname.startsWith('/api/')) {
    const parts = url.pathname.split('/').filter(Boolean);
    const collection = parts[1];
    const id = parts[2];
    if (modelMap[collection]) {
      return handleCrud(req, res, collection, id);
    }
  }

  // Static file serving (fallback to homepage for unknown non-API routes)
  if (!url.pathname.startsWith('/api/')) {
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/') pathname = '/index.html';
    const filePath = path.normalize(path.join(PUBLIC_DIR, pathname));
    if (!filePath.startsWith(PUBLIC_DIR)) return send(res, 403, 'Forbidden', 'text/plain; charset=utf-8');
    fs.readFile(filePath, (err, data) => {
      if (err) {
        fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (fallbackErr, fallbackData) => {
          if (fallbackErr) return send(res, 404, 'Not found', 'text/plain; charset=utf-8');
          return send(res, 200, fallbackData, 'text/html; charset=utf-8');
        });
        return;
      }
      const ext = path.extname(filePath);
      const mime = {
        '.html': 'text/html; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
      }[ext] || 'application/octet-stream';
      return send(res, 200, data, mime);
    });
    return;
  }

  send(res, 404, { error: 'API route not found' });
}

const server = http.createServer((req, res) => {
  handleRequest(req, res).catch(err => {
    console.error('Unhandled error', err);
    send(res, 500, { error: 'Server error', detail: err.message });
  });
});

server.listen(PORT, () => {
  console.log(`Way2Travels running at http://localhost:${PORT}`);
  console.log(`Admin dashboard: http://localhost:${PORT}/admin.html`);
});
