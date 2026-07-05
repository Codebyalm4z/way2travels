let token = '';
try {
  token = localStorage.getItem('way2travelsToken') || '';
} catch (error) {
  token = '';
}
let db = {};
let active = 'dashboard';

const sections = ['dashboard', 'packages', 'destinations', 'inquiries', 'reviews', 'blogs', 'faqs', 'settings'];
const rupee = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value || 0));
const api = (path, options = {}) => fetch(path, { ...options, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(options.headers || {}) } });
const parseList = value => String(value || '').split('\n').map(item => item.trim()).filter(Boolean);
const parseCsv = value => String(value || '').split(',').map(item => item.trim()).filter(Boolean);
const destinationName = id => (db.destinations || []).find(item => item.id === id)?.name || 'Unassigned';

function showApp(loggedIn) {
  document.getElementById('loginScreen').hidden = loggedIn;
  document.getElementById('adminApp').hidden = !loggedIn;
}

function nav() {
  document.getElementById('adminNav').innerHTML = sections.map(section => `<button class="${active === section ? 'active' : ''}" onclick="setActive('${section}')">${section[0].toUpperCase() + section.slice(1)}</button>`).join('');
}

async function loadAll() {
  const names = ['packages', 'destinations', 'inquiries', 'reviews', 'blogs', 'faqs', 'offers'];
  const responses = await Promise.all(names.map(name => api(`/api/${name}`).then(res => res.json())));
  db = Object.fromEntries(names.map((name, index) => [name, responses[index]]));
  db.settings = await api('/api/settings').then(res => res.json());
}

async function setActive(section) {
  active = section;
  nav();
  await render();
}

function metric(title, value) {
  return `<div class="admin-card"><p class="muted">${title}</p><h2>${value}</h2></div>`;
}

function renderDashboard() {
  const newLeads = db.inquiries.filter(item => item.status === 'NEW').length;
  return `
    <h1>Dashboard</h1>
    <div class="admin-grid">
      ${metric('Total packages', db.packages.length)}
      ${metric('New inquiries', newLeads)}
      ${metric('Published reviews', db.reviews.filter(item => item.approved).length)}
      ${metric('Destinations', db.destinations.length)}
    </div>
    <h2 style="margin-top:28px">Recent Leads</h2>
    ${table(['Name', 'Phone', 'Destination', 'Status', 'Created'], db.inquiries.slice(0, 8).map(item => [item.name, item.phone, item.destination || item.package, item.status, new Date(item.createdAt).toLocaleString()]))}
  `;
}

function table(headers, rows) {
  return `<div class="table-wrap"><table><thead><tr>${headers.map(header => `<th>${header}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${cell ?? ''}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function bool(value) { return value ? 'Yes' : 'No'; }

function destinationOptions(selected) {
  return db.destinations.map(item => `<option value="${item.id}" ${item.id === selected ? 'selected' : ''}>${item.name}</option>`).join('');
}

function packageForm(item = {}) {
  return `
    <form class="editor-form" onsubmit="savePackage(event, '${item.id || ''}')">
      <input name="title" placeholder="Package title" value="${item.title || ''}" required>
      <input name="slug" placeholder="slug" value="${item.slug || ''}" required>
      <select name="destinationId">${destinationOptions(item.destinationId)}</select>
      <select name="type"><option ${item.type === 'Domestic' ? 'selected' : ''}>Domestic</option><option ${item.type === 'International' ? 'selected' : ''}>International</option></select>
      <input name="cities" placeholder="Cities comma separated" value="${(item.cities || []).join(', ')}">
      <input name="packageType" placeholder="Family / Honeymoon / Group" value="${item.packageType || ''}">
      <input name="nights" type="number" placeholder="Nights" value="${item.nights || 4}">
      <input name="days" type="number" placeholder="Days" value="${item.days || 5}">
      <input name="price" type="number" placeholder="Current price INR" value="${item.price || 0}">
      <input name="oldPrice" type="number" placeholder="Old price INR" value="${item.oldPrice || 0}">
      <input name="discount" type="number" placeholder="Discount %" value="${item.discount || 0}">
      <input name="hotelOptions" placeholder="Hotel options comma separated" value="${(item.hotelOptions || []).join(', ')}">
      <input class="full" name="image" placeholder="Main image URL" value="${item.image || ''}">
      <textarea class="full" name="inclusions" placeholder="Inclusions, one per line">${(item.inclusions || []).join('\n')}</textarea>
      <textarea class="full" name="exclusions" placeholder="Exclusions, one per line">${(item.exclusions || []).join('\n')}</textarea>
      <textarea class="full" name="itinerary" placeholder="Itinerary days, one per line">${(item.itinerary || []).join('\n')}</textarea>
      <textarea class="full" name="terms" placeholder="Terms">${item.terms || ''}</textarea>
      <label><input name="featured" type="checkbox" ${item.featured ? 'checked' : ''}> Featured</label>
      <label><input name="isPublished" type="checkbox" ${item.isPublished !== false ? 'checked' : ''}> Published</label>
      <button class="btn primary full" type="submit">${item.id ? 'Update' : 'Add'} Package</button>
    </form>`;
}

async function savePackage(event, id) {
  event.preventDefault();
  const form = event.target;
  const data = Object.fromEntries(new FormData(form).entries());
  const payload = {
    ...data,
    cities: parseCsv(data.cities), hotelOptions: parseCsv(data.hotelOptions), inclusions: parseList(data.inclusions), exclusions: parseList(data.exclusions), itinerary: parseList(data.itinerary), gallery: [data.image].filter(Boolean),
    nights: Number(data.nights), days: Number(data.days), price: Number(data.price), oldPrice: Number(data.oldPrice), discount: Number(data.discount),
    featured: form.featured.checked, isPublished: form.isPublished.checked
  };
  await api(`/api/packages${id ? '/' + id : ''}`, { method: id ? 'PUT' : 'POST', body: JSON.stringify(payload) });
  await refresh('packages');
}

function renderPackagesAdmin() {
  return `<h1>Packages</h1>${packageForm()}${table(['Title', 'Destination', 'Price', 'Published', 'Actions'], db.packages.map(item => [item.title, destinationName(item.destinationId), rupee(item.price), bool(item.isPublished !== false), actionButtons('packages', item.id)]))}`;
}

function renderDestinationsAdmin() {
  return `<h1>Destinations</h1>
    <form class="editor-form" onsubmit="saveSimple(event, 'destinations')">
      <input name="name" placeholder="Name" required><input name="slug" placeholder="slug" required>
      <select name="type"><option>Domestic</option><option>International</option></select><input name="coverImage" placeholder="Cover image URL">
      <textarea class="full" name="summary" placeholder="Summary"></textarea><label><input name="isPublished" type="checkbox" checked> Published</label>
      <button class="btn primary full">Add Destination</button>
    </form>
    ${table(['Name', 'Type', 'Published', 'Actions'], db.destinations.map(item => [item.name, item.type, bool(item.isPublished !== false), actionButtons('destinations', item.id)]))}`;
}

function renderInquiriesAdmin() {
  return `<h1>Inquiry CRM</h1>${table(['Name', 'Contact', 'Trip', 'Message', 'Status', 'Actions'], db.inquiries.map(item => [
    item.name,
    `<a href="tel:${item.phone}">${item.phone}</a><br>${item.email || ''}`,
    `${item.destination || ''}<br>${item.package || ''}<br>${item.travelDate || ''} • ${item.travelers || 1} travelers`,
    `${item.message || ''}<br><strong>Notes:</strong> ${item.notes || ''}`,
    `<select onchange="updateInquiry('${item.id}', this.value, null)">${['NEW','CONTACTED','QUOTED','WON','LOST'].map(status => `<option ${item.status === status ? 'selected' : ''}>${status}</option>`).join('')}</select>`,
    `<div class="actions"><a class="small-btn" href="tel:${item.phone}">Call</a><a class="small-btn" target="_blank" href="https://wa.me/${String(item.phone).replace(/\D/g, '')}">WhatsApp</a><button class="small-btn" onclick="noteInquiry('${item.id}')">Notes</button><button class="small-btn danger" onclick="removeItem('inquiries','${item.id}')">Delete</button></div>`
  ]))}`;
}

async function updateInquiry(id, status, notes) {
  const item = db.inquiries.find(row => row.id === id);
  await api(`/api/inquiries/${id}`, { method: 'PUT', body: JSON.stringify({ status: status || item.status, notes: notes ?? item.notes }) });
  await refresh('inquiries');
}
function noteInquiry(id) {
  const item = db.inquiries.find(row => row.id === id);
  const notes = prompt('Admin notes', item.notes || '');
  if (notes !== null) updateInquiry(id, item.status, notes);
}

function renderReviewsAdmin() {
  return `<h1>Reviews</h1>
    <form class="editor-form" onsubmit="saveSimple(event, 'reviews', reviewPayload)">
      <input name="name" placeholder="Traveler name" required><input name="city" placeholder="City">
      <input name="country" value="India"><input name="destination" placeholder="Destination">
      <input name="rating" type="number" min="1" max="5" value="5"><input name="displayOrder" type="number" value="10">
      <textarea class="full" name="text" placeholder="Review text"></textarea><label><input name="approved" type="checkbox" checked> Approved</label><label><input name="verified" type="checkbox"> Verified</label>
      <button class="btn primary full">Add Review</button>
    </form>
    ${table(['Name', 'Destination', 'Rating', 'Approved', 'Actions'], db.reviews.map(item => [item.name, item.destination, item.rating, bool(item.approved), actionButtons('reviews', item.id)]))}`;
}
function reviewPayload(formData, form) { return { ...formData, rating: Number(formData.rating), displayOrder: Number(formData.displayOrder), approved: form.approved.checked, verified: form.verified.checked }; }

function renderBlogsAdmin() {
  return `<h1>Blogs</h1>
    <form class="editor-form" onsubmit="saveSimple(event, 'blogs')">
      <input name="title" placeholder="Title" required><input name="slug" placeholder="slug" required>
      <input name="category" placeholder="Category"><input name="coverImage" placeholder="Cover image URL">
      <input class="full" name="excerpt" placeholder="Excerpt"><textarea class="full" name="content" placeholder="Content"></textarea>
      <label><input name="isPublished" type="checkbox" checked> Published</label><button class="btn primary full">Add Blog</button>
    </form>
    ${table(['Title', 'Category', 'Published', 'Actions'], db.blogs.map(item => [item.title, item.category, bool(item.isPublished !== false), actionButtons('blogs', item.id)]))}`;
}

function renderFaqsAdmin() {
  return `<h1>FAQs</h1>
    <form class="editor-form" onsubmit="saveSimple(event, 'faqs')">
      <input name="question" placeholder="Question" required><input name="answer" placeholder="Answer" required><label><input name="isPublished" type="checkbox" checked> Published</label><button class="btn primary full">Add FAQ</button>
    </form>
    ${table(['Question', 'Published', 'Actions'], db.faqs.map(item => [item.question, bool(item.isPublished !== false), actionButtons('faqs', item.id)]))}`;
}

function renderSettingsAdmin() {
  const s = db.settings;
  return `<h1>Site Settings</h1>
    <form class="editor-form" onsubmit="saveSettings(event)">
      ${Object.entries(s).map(([key, value]) => `<label>${key}<input name="${key}" value="${String(value).replace(/"/g, '&quot;')}"></label>`).join('')}
      <button class="btn primary full">Save Settings</button>
    </form>`;
}

function actionButtons(collection, id) {
  return `<div class="actions"><button class="small-btn" onclick="togglePublished('${collection}','${id}')">Toggle</button><button class="small-btn danger" onclick="removeItem('${collection}','${id}')">Delete</button></div>`;
}

async function togglePublished(collection, id) {
  const item = db[collection].find(row => row.id === id);
  const key = collection === 'reviews' ? 'approved' : 'isPublished';
  await api(`/api/${collection}/${id}`, { method: 'PUT', body: JSON.stringify({ [key]: !item[key] }) });
  await refresh(collection);
}

async function removeItem(collection, id) {
  if (!confirm('Delete this item?')) return;
  await api(`/api/${collection}/${id}`, { method: 'DELETE' });
  await refresh(collection);
}

async function saveSimple(event, collection, transform) {
  event.preventDefault();
  const form = event.target;
  const data = Object.fromEntries(new FormData(form).entries());
  ['isPublished', 'approved', 'verified'].forEach(key => { if (key in form) data[key] = form[key].checked; });
  const payload = transform ? transform(data, form) : data;
  await api(`/api/${collection}`, { method: 'POST', body: JSON.stringify(payload) });
  form.reset();
  await refresh(collection);
}

async function saveSettings(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.target).entries());
  await api('/api/settings', { method: 'PUT', body: JSON.stringify(data) });
  await refresh('settings');
}

async function refresh() {
  await loadAll();
  await render();
}

async function render() {
  const views = { dashboard: renderDashboard, packages: renderPackagesAdmin, destinations: renderDestinationsAdmin, inquiries: renderInquiriesAdmin, reviews: renderReviewsAdmin, blogs: renderBlogsAdmin, faqs: renderFaqsAdmin, settings: renderSettingsAdmin };
  document.getElementById('adminView').innerHTML = views[active]();
}

async function login(event) {
  event.preventDefault();
  const status = event.target.querySelector('[data-status]');
  const data = Object.fromEntries(new FormData(event.target).entries());
  status.textContent = 'Logging in...';
  const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  if (!response.ok) { status.textContent = 'Invalid login.'; return; }
  const result = await response.json();
  token = result.token;
  localStorage.setItem('way2travelsToken', token);
  await boot();
}

async function boot() {
  if (!token) { showApp(false); return; }
  try {
    await loadAll();
    showApp(true);
    nav();
    await render();
  } catch (error) {
    try { localStorage.removeItem('way2travelsToken'); } catch (error) {}
    token = '';
    showApp(false);
  }
}

document.getElementById('loginForm').addEventListener('submit', login);
document.getElementById('logoutButton').addEventListener('click', async () => {
  await api('/api/auth/logout', { method: 'POST' });
  try { localStorage.removeItem('way2travelsToken'); } catch (error) {}
  token = '';
  showApp(false);
});
boot();

