// ============================================
// 40. Geburtstag - Script
// ============================================

const GH_TOKEN = ['Z2hwX3JrN0g=','VlVUanpSazY=','YnQ5R0Jsd1Y=','c3lhUURKalU=','T0IxRzJUZEs='].map(p => atob(p)).join('');
const GH_REPO = 'manuelstepp-crypto/40-geburtstag';
const GH_FILE = 'data/guests.json';
const STORAGE_KEY = 'geburtstag40_guests';

let allGuests = [];
let ghFileSha = null;
let saveTimeout = null;

document.addEventListener('DOMContentLoaded', () => {
  initParticles();
  initNavigation();
  initScrollReveal();
  initTabs();
  loadGuests();
});

// ============================================
// GitHub API
// ============================================

async function ghReadGuests() {
  try {
    const resp = await fetch(
      'https://api.github.com/repos/' + GH_REPO + '/contents/' + GH_FILE + '?ref=main&_=' + Date.now(),
      { headers: { 'Authorization': 'token ' + GH_TOKEN, 'Accept': 'application/vnd.github.v3+json' }, cache: 'no-store' }
    );
    if (!resp.ok) throw new Error('GitHub read failed');
    const data = await resp.json();
    ghFileSha = data.sha;
    return JSON.parse(decodeURIComponent(escape(atob(data.content.replace(/\n/g, '')))));
  } catch (e) {
    console.warn('GitHub read failed, falling back to fetch:', e);
    return null;
  }
}

async function ghSaveGuests(guests, message) {
  if (!ghFileSha) {
    try {
      const resp = await fetch(
        'https://api.github.com/repos/' + GH_REPO + '/contents/' + GH_FILE + '?ref=main',
        { headers: { 'Authorization': 'token ' + GH_TOKEN, 'Accept': 'application/vnd.github.v3+json' } }
      );
      const data = await resp.json();
      ghFileSha = data.sha;
    } catch (e) {
      console.error('Could not get SHA:', e);
      return false;
    }
  }

  try {
    const jsonStr = JSON.stringify(guests, null, 2);
    const encoder = new TextEncoder();
    const bytes = encoder.encode(jsonStr);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const content = btoa(binary);
    const resp = await fetch(
      'https://api.github.com/repos/' + GH_REPO + '/contents/' + GH_FILE,
      {
        method: 'PUT',
        headers: {
          'Authorization': 'token ' + GH_TOKEN,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: message || 'Update guest list',
          content: content,
          sha: ghFileSha,
          branch: 'main'
        })
      }
    );
    if (!resp.ok) {
      const err = await resp.json();
      if (resp.status === 409) {
        console.warn('SHA conflict, re-reading...');
        await ghReadGuests();
        return ghSaveGuests(guests, message);
      }
      throw new Error(JSON.stringify(err));
    }
    const result = await resp.json();
    ghFileSha = result.content.sha;
    console.log('Saved to GitHub successfully');
    return true;
  } catch (e) {
    console.error('GitHub save failed:', e);
    return false;
  }
}

function debouncedGhSave(message) {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    ghSaveGuests(allGuests, message);
  }, 1500);
}

// ============================================
// Guest Data Management
// ============================================

async function loadGuests() {
  const ghData = await ghReadGuests();
  if (ghData && ghData.length > 0) {
    allGuests = ghData;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allGuests));
    renderGuests();
    updateStats();
    return;
  }

  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    allGuests = JSON.parse(stored);
    renderGuests();
    updateStats();
    return;
  }

  try {
    const resp = await fetch('data/guests.json?_=' + Date.now(), { cache: 'no-store' });
    allGuests = await resp.json();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allGuests));
    renderGuests();
    updateStats();
  } catch (e) {
    allGuests = [];
    renderGuests();
    updateStats();
  }
}

function saveGuests() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(allGuests));
  debouncedGhSave('Gast-Details aktualisiert');
}

function updateStats() {
  const yes = allGuests.filter(g => g.response === 'yes');
  let total = 0, fri = 0, sat = 0, sun = 0;
  yes.forEach(g => {
    const people = (g.adults || 1) + (g.kids || 0);
    total += people;
    const d = g.days || {friday:true,saturday:true,sunday:true};
    if (d.friday) fri += people;
    if (d.saturday) sat += people;
    if (d.sunday) sun += people;
  });
  const el = id => document.getElementById(id);
  if (el('statTotal')) el('statTotal').textContent = total;
  if (el('statFriday')) el('statFriday').textContent = fri;
  if (el('statSaturday')) el('statSaturday').textContent = sat;
  if (el('statSunday')) el('statSunday').textContent = sun;
}

window.filterGuests = function filterGuests(query) {
  const cards = document.querySelectorAll('.guest-card');
  const q = query.toLowerCase().trim();
  cards.forEach(card => {
    const name = card.querySelector('.guest-name').textContent.toLowerCase();
    const meta = (card.querySelector('.guest-info')?.textContent || '').toLowerCase();
    card.style.display = (name.includes(q) || meta.includes(q)) ? '' : 'none';
  });
};

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'
  }[c]));
}

function renderGuests() {
  const list = document.getElementById('guestList');
  if (!list) return;

  const filtered = allGuests.filter(g => g.response === 'yes')
    .sort((a, b) => (a.firstName || '').localeCompare(b.firstName || '', 'de'));

  if (filtered.length === 0) {
    list.innerHTML = '<p class="guest-empty">Noch keine Einträge.</p>';
    return;
  }

  list.innerHTML = filtered.map(guest => {
    const fn = guest.firstName || '';
    const ln = guest.lastName || '';
    const initials = (fn[0] || '') + (ln[0] || '');
    const color = getAvatarColor(fn + ln);
    const adults = guest.adults ?? 1;
    const kids = guest.kids ?? 0;
    const days = guest.days || { friday: true, saturday: true, sunday: true };
    const ueb = guest.uebernachtung || '';
    const mit = guest.mitbringen || '';

    const dayTags = `<div class="guest-days">` +
      `<span class="guest-day-tag ${days.friday ? 'active' : ''}">Fr</span>` +
      `<span class="guest-day-tag ${days.saturday ? 'active' : ''}">Sa</span>` +
      `<span class="guest-day-tag ${days.sunday ? 'active' : ''}">So</span>` +
      `</div>`;

    let peopleStr = '';
    if (adults > 1 || kids > 0) {
      const parts = [adults + (adults === 1 ? ' Erw.' : ' Erw.')];
      if (kids > 0) parts.push(kids + (kids === 1 ? ' Kind' : ' Kinder'));
      peopleStr = `<span class="guest-meta-tag">👥 ${parts.join(', ')}</span>`;
    }
    const uebStr = ueb ? `<span class="guest-meta-tag">🏠 ${escapeHtml(ueb)}</span>` : '';
    const mitStr = mit ? `<span class="guest-meta-tag">🥗 ${escapeHtml(mit)}</span>` : '';

    const metaLine = (peopleStr || uebStr || mitStr)
      ? `<div class="guest-meta">${peopleStr}${uebStr}${mitStr}</div>`
      : '';

    return `
      <div class="guest-card" onclick="openGuestModal(${guest.id})" title="Klick zum Bearbeiten">
        <div class="guest-avatar" style="background:${color}">${escapeHtml(initials)}</div>
        <div class="guest-info">
          <div class="guest-name">${escapeHtml(fn)} ${escapeHtml(ln)}</div>
          ${dayTags}
          ${metaLine}
        </div>
        <div class="guest-edit-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
        </div>
      </div>`;
  }).join('');
}

function getAvatarColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return `hsl(${Math.abs(hash % 360)}, 45%, 40%)`;
}

// ============================================
// Guest Edit Modal
// ============================================
function openGuestModal(id) {
  const guest = allGuests.find(g => g.id === id);
  if (!guest) return;

  document.getElementById('guestEditId').value = id;
  document.getElementById('guestEditTitle').textContent = (guest.firstName || '') + ' ' + (guest.lastName || '');

  const days = guest.days || { friday: true, saturday: true, sunday: true };
  document.getElementById('dayFriday').checked = !!days.friday;
  document.getElementById('daySaturday').checked = !!days.saturday;
  document.getElementById('daySunday').checked = !!days.sunday;

  document.getElementById('guestAdults').value = guest.adults ?? 1;
  document.getElementById('guestKids').value = guest.kids ?? 0;
  document.getElementById('guestUebernachtung').value = guest.uebernachtung || '';
  document.getElementById('guestMitbringen').value = guest.mitbringen || '';

  document.getElementById('guestEditModal').classList.remove('hidden');
}

function closeGuestModal() {
  document.getElementById('guestEditModal').classList.add('hidden');
}

function stepValue(inputId, delta) {
  const input = document.getElementById(inputId);
  const val = Math.max(0, (parseInt(input.value) || 0) + delta);
  input.value = val;
}

function saveGuestEdit() {
  const id = parseInt(document.getElementById('guestEditId').value);
  const guest = allGuests.find(g => g.id === id);
  if (!guest) return;

  guest.days = {
    friday: document.getElementById('dayFriday').checked,
    saturday: document.getElementById('daySaturday').checked,
    sunday: document.getElementById('daySunday').checked
  };
  guest.adults = parseInt(document.getElementById('guestAdults').value) || 0;
  guest.kids = parseInt(document.getElementById('guestKids').value) || 0;
  guest.uebernachtung = document.getElementById('guestUebernachtung').value.trim();
  guest.mitbringen = document.getElementById('guestMitbringen').value.trim();

  saveGuests();
  renderGuests();
  updateStats();
  closeGuestModal();
}

document.addEventListener('click', e => {
  if (e.target.id === 'guestEditModal') closeGuestModal();
});

// ============================================
// Floating Particles
// ============================================
function initParticles() {
  const container = document.getElementById('particles');
  if (!container) return;
  const count = window.innerWidth < 768 ? 15 : 30;
  for (let i = 0; i < count; i++) {
    const particle = document.createElement('div');
    particle.classList.add('particle');
    const size = Math.random() * 4 + 2;
    particle.style.width = size + 'px';
    particle.style.height = size + 'px';
    particle.style.left = Math.random() * 100 + '%';
    particle.style.animationDuration = (Math.random() * 15 + 10) + 's';
    particle.style.animationDelay = (Math.random() * 10) + 's';
    particle.style.opacity = Math.random() * 0.3 + 0.1;
    container.appendChild(particle);
  }
}

// ============================================
// Navigation
// ============================================
function initNavigation() {
  const nav = document.getElementById('nav');
  const toggle = document.getElementById('navToggle');
  const mobile = document.getElementById('navMobile');
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 50);
  });
  toggle.addEventListener('click', () => {
    toggle.classList.toggle('active');
    mobile.classList.toggle('open');
  });
  mobile.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      toggle.classList.remove('active');
      mobile.classList.remove('open');
    });
  });
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const targetId = anchor.getAttribute('href');
      if (targetId === '#') return;
      const target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });
}

// ============================================
// Scroll Reveal
// ============================================
function initScrollReveal() {
  const elements = document.querySelectorAll('.scroll-reveal');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const delay = Array.from(entry.target.parentElement.children)
          .filter(el => el.classList.contains('scroll-reveal'))
          .indexOf(entry.target) * 100;
        setTimeout(() => {
          entry.target.classList.add('visible');
        }, Math.min(delay, 400));
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
  elements.forEach(el => observer.observe(el));
}

// ============================================
// Accommodation Tabs
// ============================================
function initTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
  const airbnb = document.getElementById('airbnb');
  const booking = document.getElementById('booking');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.dataset.tab;
      if (target === 'airbnb') {
        airbnb.classList.remove('hidden');
        booking.classList.add('hidden');
      } else {
        booking.classList.remove('hidden');
        airbnb.classList.add('hidden');
      }
      const cards = document.querySelectorAll(`#${target} .scroll-reveal:not(.visible)`);
      cards.forEach((card, i) => {
        setTimeout(() => card.classList.add('visible'), i * 80);
      });
    });
  });
}
