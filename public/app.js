let state = { settings: {}, destinations: [], packages: [], reviews: [], blogs: [], faqs: [], offers: [] };

const rupee = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value || 0));
const phoneDigits = phone => String(phone || '').replace(/\D/g, '');
const whatsappUrl = (phone, message = 'Hi Way2Travels, I want to plan a trip.') => `https://wa.me/${phoneDigits(phone)}?text=${encodeURIComponent(message)}`;
const destinationName = id => (state.destinations.find(item => item.id === id) || {}).name || 'Custom destination';

function optionList(items, selected = '') {
  return items.map(item => `<option value="${item.id}" ${item.id === selected ? 'selected' : ''}>${item.name}</option>`).join('');
}

function setContactLinks() {
  const s = state.settings;
  document.getElementById('heroSubtitle').textContent = s.heroSubtitle || '';
  document.getElementById('emailLink').textContent = s.email;
  document.getElementById('emailLink').href = `mailto:${s.email}`;
  document.getElementById('phoneLink').textContent = s.phone;
  document.getElementById('phoneLink').href = `tel:+${phoneDigits(s.phone)}`;
  document.getElementById('whatsappLink').href = whatsappUrl(s.whatsapp);
  document.getElementById('heroWhatsapp').href = whatsappUrl(s.whatsapp);
  document.getElementById('floatCall').href = `tel:+${phoneDigits(s.phone)}`;
  document.getElementById('floatWhatsapp').href = whatsappUrl(s.whatsapp);
}

function fillFilters() {
  const options = '<option value="">All destinations</option>' + state.destinations.map(item => `<option value="${item.id}">${item.name}</option>`).join('');
  document.getElementById('destinationFilter').innerHTML = options;
  document.getElementById('quickDestination').innerHTML = state.destinations.map(item => `<option>${item.name}</option>`).join('');
}

function renderPackages() {
  const type = document.getElementById('typeFilter').value;
  const destination = document.getElementById('destinationFilter').value;
  const sort = document.getElementById('sortFilter').value;
  let packages = [...state.packages];
  if (type) packages = packages.filter(item => item.type === type);
  if (destination) packages = packages.filter(item => item.destinationId === destination);
  if (sort === 'priceAsc') packages.sort((a, b) => a.price - b.price);
  if (sort === 'priceDesc') packages.sort((a, b) => b.price - a.price);
  if (sort === 'newest') packages.reverse();
  if (sort === 'featured') packages.sort((a, b) => Number(b.featured) - Number(a.featured));

  document.getElementById('packageGrid').innerHTML = packages.map((item, index) => `
    <article class="card" style="animation-delay: ${index * 0.05}s">
      <img src="${item.image}" alt="${item.title}">
      <div class="card-body">
        <span class="badge">${item.discount || 0}% off</span>
        <h3>${item.title}</h3>
        <p class="muted">${destinationName(item.destinationId)} • ${item.nights}N/${item.days}D • ${item.cities.join(', ')}</p>
        <div class="pills">${item.inclusions.slice(0, 5).map(text => `<span class="pill">${text}</span>`).join('')}</div>
        <div class="price-row"><div><div class="price">${rupee(item.price)}</div><div class="old-price">${rupee(item.oldPrice)}</div></div><button class="btn primary" onclick="openPackage('${item.id}')">Customize & Book</button></div>
      </div>
    </article>
  `).join('') || '<p>No packages found.</p>';
}

function renderDestinations() {
  document.getElementById('destinationGrid').innerHTML = state.destinations.map((item, index) => `
    <article class="card destination-card" style="background-image:url('${item.coverImage}'); animation-delay: ${index * 0.05}s">
      <div class="card-body">
        <span class="badge">${item.type}</span>
        <h3>${item.name}</h3>
        <p>${item.summary}</p>
      </div>
    </article>
  `).join('');
}

function renderReviews() {
  document.getElementById('reviewGrid').innerHTML = state.reviews.map((item, index) => `
    <article class="card review" style="animation-delay: ${index * 0.05}s">
      <div class="stars">${'★'.repeat(item.rating)}${'☆'.repeat(5 - item.rating)}</div>
      <p>“${item.text}”</p>
      <strong>${item.name}</strong>
      <p class="muted">${item.city}, ${item.country} • ${item.destination}</p>
    </article>
  `).join('');
}

function renderBlogs() {
  document.getElementById('blogGrid').innerHTML = state.blogs.map((item, index) => `
    <article class="card" style="animation-delay: ${index * 0.05}s">
      <img src="${item.coverImage}" alt="${item.title}">
      <div class="card-body">
        <span class="badge">${item.category}</span>
        <h3>${item.title}</h3>
        <p class="muted">${item.excerpt}</p>
        <p>${item.content}</p>
      </div>
    </article>
  `).join('');
}

function renderFaqs() {
  document.getElementById('faqList').innerHTML = state.faqs.map((item, index) => `
    <details style="animation-delay: ${index * 0.05}s">
      <summary>${item.question}</summary>
      <p>${item.answer}</p>
    </details>
  `).join('');
}

function openPackage(packageId) {
  const item = state.packages.find(packageItem => packageItem.id === packageId);
  if (!item) return;
  document.getElementById('packageDetail').innerHTML = `
    <div class="detail-hero"><img src="${item.image}" alt="${item.title}"></div>
    <div class="detail-content">
      <div>
        <span class="badge">${item.type} • ${item.packageType}</span>
        <h2>${item.title}</h2>
        <p class="muted">${item.cities.join(' → ')} • ${item.nights}N/${item.days}D</p>
      </div>
      <div class="detail-grid">
        <div>
          <h3>Itinerary</h3>
          <ol class="list">${item.itinerary.map(day => `<li>${day}</li>`).join('')}</ol>
          <h3>Inclusions</h3>
          <div class="pills">${item.inclusions.map(text => `<span class="pill">${text}</span>`).join('')}</div>
          <h3>Exclusions</h3>
          <ul class="list">${item.exclusions.map(text => `<li>${text}</li>`).join('')}</ul>
          <h3>Terms</h3>
          <p>${item.terms}</p>
        </div>
        <form class="contact-form" onsubmit="submitInquiry(event, '${item.title}')">
          <div class="price">${rupee(item.price)}</div>
          <p class="muted"><span class="old-price">${rupee(item.oldPrice)}</span> • ${item.discount}% off</p>
          <div class="pills">${item.hotelOptions.map(text => `<span class="pill">${text}</span>`).join('')}</div>
          <input name="name" placeholder="Your name" required>
          <input name="phone" placeholder="Phone number" required>
          <input name="email" type="email" placeholder="Email address">
          <input name="travelDate" type="date">
          <input name="travelers" type="number" min="1" value="2">
          <textarea name="message" placeholder="Hotel preference, dates, and special requests"></textarea>
          <button class="btn primary" type="submit">Request Package Quote</button>
          <p class="form-status" data-status></p>
        </form>
      </div>
    </div>
  `;
  document.getElementById('packageDialog').showModal();
}

async function submitInquiry(event, packageTitle = '') {
  event.preventDefault();
  const form = event.target;
  const status = form.querySelector('[data-status]');
  const data = Object.fromEntries(new FormData(form).entries());
  if (packageTitle) data.package = packageTitle;
  status.textContent = 'Sending...';
  const response = await fetch('/api/inquiries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  if (!response.ok) {
    status.textContent = 'Could not submit. Please call us.';
    return;
  }
  form.reset();
  status.textContent = 'Inquiry received. Way2Travels will contact you soon.';
}

async function init() {
  const response = await fetch('/api/public');
  state = await response.json();
  setContactLinks();
  fillFilters();
  renderPackages();
  renderDestinations();
  renderReviews();
  renderBlogs();
  renderFaqs();
  ['typeFilter', 'destinationFilter', 'sortFilter'].forEach(id => document.getElementById(id).addEventListener('change', renderPackages));
  document.getElementById('quickInquiry').addEventListener('submit', submitInquiry);
  document.getElementById('contactForm').addEventListener('submit', submitInquiry);
}

document.addEventListener('DOMContentLoaded', init);
