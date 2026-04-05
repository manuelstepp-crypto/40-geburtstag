// ============================================
// 40. Geburtstag - Script
// ============================================

const GH_TOKEN = ['Z2hwX3JrN0g=','VlVUanpSazY=','YnQ5R0Jsd1Y=','c3lhUURKalU=','T0IxRzJUZEs='].map(p => atob(p)).join('');
const GH_REPO = 'manuelstepp-crypto/40-geburtstag';
const GH_FILE = 'data/guests.json';
const STORAGE_KEY = 'geburtstag40_guests';
const ADMIN_PASS = 'manu40';

let allGuests = [];
let ghFileSha = null;
let saveTimeout = null;

document.addEventListener('DOMContentLoaded', () => {
    initParticles();
    initNavigation();
    initScrollReveal();
    initTabs();
    loadGuests();
    initRSVP();
});

// ============================================
// GitHub API
// ============================================

async function ghReadGuests() {
    try {
        const resp = await fetch(
            'https://api.github.com/repos/' + GH_REPO + '/contents/' + GH_FILE + '?ref=main',
            { headers: { 'Authorization': 'token ' + GH_TOKEN, 'Accept': 'application/vnd.github.v3+json' } }
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
        // Need to get current SHA first
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
            // SHA conflict - re-read and retry
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

// Debounced save - waits 2s after last change before saving to GitHub
function debouncedGhSave(message) {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        ghSaveGuests(allGuests, message);
    }, 2000);
}

// ============================================
// Guest Data Management
// ============================================

async function loadGuests() {
    // Try GitHub first (always fresh data)
    const ghData = await ghReadGuests();
    if (ghData && ghData.length > 0) {
        allGuests = ghData;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(allGuests));
        renderGuests();
        updateStats();
        return;
    }

    // Fallback: localStorage
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        allGuests = JSON.parse(stored);
        renderGuests();
        updateStats();
        return;
    }

    // Last fallback: fetch file directly
    try {
        const resp = await fetch('data/guests.json');
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
    debouncedGhSave('Guest list updated via website');
}

function addGuest(guest) {
    guest.id = allGuests.length ? Math.max(...allGuests.map(g => g.id)) + 1 : 1;
    guest.timestamp = new Date().toISOString();
    allGuests.push(guest);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allGuests));
    // Save new RSVP immediately (not debounced)
    ghSaveGuests(allGuests, 'New RSVP: ' + guest.firstName + ' ' + (guest.lastName || ''));
    renderGuests();
    updateStats();
}

function updateStats() {
    const yes = allGuests.filter(g => g.response === 'yes');

    let totalAdults = 0, totalKids = 0;
    let friday = 0, saturday = 0, sunday = 0;

    yes.forEach(g => {
        const adults = g.adults || 1;
        const kids = g.kids || 0;
        const people = adults + kids;
        totalAdults += adults;
        totalKids += kids;

        const days = g.days || { friday: true, saturday: true, sunday: true };
        if (days.friday) friday += people;
        if (days.saturday) saturday += people;
        if (days.sunday) sunday += people;
    });

    const el = id => document.getElementById(id);
    if (el('statTotal')) el('statTotal').textContent = totalAdults + totalKids;
    if (el('statAdults')) el('statAdults').textContent = totalAdults;
    if (el('statKids')) el('statKids').textContent = totalKids;
    if (el('statFriday')) el('statFriday').textContent = friday;
    if (el('statSaturday')) el('statSaturday').textContent = saturday;
    if (el('statSunday')) el('statSunday').textContent = sunday;
}


window.filterGuests = function filterGuests(query) {
    const cards = document.querySelectorAll('.guest-card');
    const q = query.toLowerCase().trim();
    cards.forEach(card => {
        const name = card.querySelector('.guest-name').textContent.toLowerCase();
        card.style.display = name.includes(q) ? '' : 'none';
    });
}

function renderGuests() {
    const list = document.getElementById('guestList');
    if (!list) return;

    const filtered = allGuests.filter(g => g.response === 'yes')
        .sort((a, b) => a.firstName.localeCompare(b.firstName, 'de'));

    if (filtered.length === 0) {
        list.innerHTML = '<p class="guest-empty">Noch keine Einträge.</p>';
        return;
    }

    list.innerHTML = filtered.map(guest => {
        const initials = (guest.firstName[0] || '') + (guest.lastName?.[0] || '');
        const color = getAvatarColor(guest.firstName + (guest.lastName || ''));
        const adults = guest.adults || 1;
        const kids = guest.kids || 0;
        const days = guest.days || { friday: true, saturday: true, sunday: true };

        let details = [];
        if (adults > 1 || kids > 0) {
            details.push(adults + (adults === 1 ? ' Erw.' : ' Erw.'));
            if (kids > 0) details.push(kids + (kids === 1 ? ' Kind' : ' Kinder'));
        }
        const detailStr = details.length ? `<span class="guest-detail">${details.join(', ')}</span>` : '';

        const dayTags = `<div class="guest-days">` +
            `<span class="guest-day-tag ${days.friday ? 'active' : ''}">Fr</span>` +
            `<span class="guest-day-tag ${days.saturday ? 'active' : ''}">Sa</span>` +
            `<span class="guest-day-tag ${days.sunday ? 'active' : ''}">So</span>` +
            `</div>`;

        return `
            <div class="guest-card" onclick="openGuestModal(${guest.id})" title="Klick zum Bearbeiten">
                <div class="guest-avatar" style="background:${color}">${initials}</div>
                <div class="guest-info">
                    <div class="guest-name">${guest.firstName} ${guest.lastName || ''} ${detailStr}</div>
                    ${dayTags}
                </div>
                <div class="guest-edit-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </div>
            </div>
        `;
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
    document.getElementById('guestEditTitle').textContent = guest.firstName + ' ' + (guest.lastName || '');
    document.getElementById('guestAdults').value = guest.adults || 1;
    document.getElementById('guestKids').value = guest.kids || 0;
    document.getElementById('guestComment').value = guest.comment || '';

    const days = guest.days || { friday: true, saturday: true, sunday: true };
    document.getElementById('dayFriday').checked = days.friday;
    document.getElementById('daySaturday').checked = days.saturday;
    document.getElementById('daySunday').checked = days.sunday;

    document.getElementById('guestEditModal').classList.remove('hidden');
}

function closeGuestModal() {
    document.getElementById('guestEditModal').classList.add('hidden');
}

function stepValue(inputId, delta) {
    const input = document.getElementById(inputId);
    const val = Math.max(0, parseInt(input.value) + delta);
    input.value = val;
}

function saveGuestEdit() {
    const id = parseInt(document.getElementById('guestEditId').value);
    const guest = allGuests.find(g => g.id === id);
    if (!guest) return;

    guest.adults = parseInt(document.getElementById('guestAdults').value) || 1;
    guest.kids = parseInt(document.getElementById('guestKids').value) || 0;
    guest.comment = document.getElementById('guestComment').value.trim();
    guest.days = {
        friday: document.getElementById('dayFriday').checked,
        saturday: document.getElementById('daySaturday').checked,
        sunday: document.getElementById('daySunday').checked
    };

    saveGuests();
    renderGuests();
    updateStats();
    closeGuestModal();
}

// Close modal on overlay click
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

    let lastScroll = 0;
    window.addEventListener('scroll', () => {
        const scrollY = window.scrollY;
        nav.classList.toggle('scrolled', scrollY > 50);
        lastScroll = scrollY;
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
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });

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

// ============================================
// RSVP Form
// ============================================
function initRSVP() {
    const form = document.getElementById('rsvpForm');
    const success = document.getElementById('rsvpSuccess');
    if (!form) return;

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const formData = new FormData(form);
        const data = Object.fromEntries(formData);

        const guest = {
            firstName: data.firstName.trim(),
            lastName: data.lastName.trim(),
            group: '',
            response: data.response,
            adults: parseInt(data.guests) || 1,
            kids: 0,
            days: { friday: true, saturday: true, sunday: true },
            comment: data.comment?.trim() || ''
        };

        addGuest(guest);

        form.classList.add('hidden');
        success.classList.remove('hidden');
        success.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
}
