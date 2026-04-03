// ============================================
// 40. Geburtstag - Script
// ============================================

const STORAGE_KEY = 'geburtstag40_guests';
const ADMIN_PASS = 'manu40';
let allGuests = [];

document.addEventListener('DOMContentLoaded', () => {
    initParticles();
    initCountdown();
    initNavigation();
    initScrollReveal();
    initTabs();
    loadGuests();
    initRSVP();
});

// ============================================
// Guest Data Management
// ============================================
function loadGuests() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        allGuests = JSON.parse(stored);
        renderGuests();
        updateStats();
    } else {
        fetch('data/guests.json')
            .then(r => r.json())
            .then(data => {
                allGuests = data;
                localStorage.setItem(STORAGE_KEY, JSON.stringify(allGuests));
                renderGuests();
                updateStats();
            })
            .catch(() => {
                allGuests = [];
                renderGuests();
                updateStats();
            });
    }
}

function saveGuests() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allGuests));
}

function addGuest(guest) {
    guest.id = allGuests.length ? Math.max(...allGuests.map(g => g.id)) + 1 : 1;
    guest.timestamp = new Date().toISOString();
    allGuests.push(guest);
    saveGuests();
    renderGuests();
    updateStats();
}

function updateStats() {
    const yes = allGuests.filter(g => g.response === 'yes');
    const maybe = allGuests.filter(g => g.response === 'maybe');
    const totalPeople = yes.reduce((sum, g) => sum + (g.guests || 1), 0);

    const statYes = document.getElementById('statYes');
    const statMaybe = document.getElementById('statMaybe');
    const statTotal = document.getElementById('statTotal');

    if (statYes) statYes.textContent = yes.length;
    if (statMaybe) statMaybe.textContent = maybe.length;
    if (statTotal) statTotal.textContent = totalPeople;
}

function renderGuests() {
    const list = document.getElementById('guestList');
    if (!list) return;

    const filtered = allGuests.filter(g => g.response === 'yes');

    if (filtered.length === 0) {
        list.innerHTML = '<p class="guest-empty">Noch keine Einträge.</p>';
        return;
    }

    list.innerHTML = filtered.map(guest => {
        const initials = (guest.firstName[0] || '') + (guest.lastName?.[0] || '');
        const color = getAvatarColor(guest.firstName + guest.lastName);
        const guestCount = guest.guests > 1 ? `<span class="guest-plus">+${guest.guests - 1}</span>` : '';
        const comment = guest.comment ? `<p class="guest-comment">"${guest.comment}"</p>` : '';
        return `
            <div class="guest-card">
                <div class="guest-avatar" style="background:${color}">${initials}${guestCount}</div>
                <div class="guest-info">
                    <div class="guest-name">${guest.firstName} ${guest.lastName || ''}</div>
                    ${comment}
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
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 45%, 40%)`;
}

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
// Countdown Timer
// ============================================
function initCountdown() {
    const targetDate = new Date('2026-07-10T15:00:00+02:00');

    function update() {
        const now = new Date();
        const diff = targetDate - now;

        if (diff <= 0) {
            document.getElementById('days').textContent = '00';
            document.getElementById('hours').textContent = '00';
            document.getElementById('minutes').textContent = '00';
            document.getElementById('seconds').textContent = '00';
            return;
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        document.getElementById('days').textContent = String(days).padStart(2, '0');
        document.getElementById('hours').textContent = String(hours).padStart(2, '0');
        document.getElementById('minutes').textContent = String(minutes).padStart(2, '0');
        document.getElementById('seconds').textContent = String(seconds).padStart(2, '0');
    }

    update();
    setInterval(update, 1000);
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
            guests: parseInt(data.guests) || 1,
            comment: data.comment?.trim() || ''
        };

        addGuest(guest);

        form.classList.add('hidden');
        success.classList.remove('hidden');
        success.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
}
