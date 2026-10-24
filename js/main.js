// Page interactions: navigation, scroll reveal, app tabs, loudness slider and plans.
import { initDemo } from './demo.js';

// ---------- Navigation ----------

const nav = document.querySelector('[data-nav]');
const toggle = document.querySelector('[data-nav-toggle]');
const links = document.getElementById('nav-links');

toggle.addEventListener('click', () => {
  const open = toggle.getAttribute('aria-expanded') !== 'true';
  toggle.setAttribute('aria-expanded', String(open));
  links.classList.toggle('open', open);
});
links.addEventListener('click', (e) => {
  if (!e.target.closest('a')) return;
  toggle.setAttribute('aria-expanded', 'false');
  links.classList.remove('open');
});
const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 8);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// ---------- Scroll reveal ----------

const reveals = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('in');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12 });
  reveals.forEach((el) => observer.observe(el));
} else {
  reveals.forEach((el) => el.classList.add('in'));
}

// ---------- Demo ----------

initDemo(document.getElementById('demo'));

// ---------- App screen tabs ----------

const TABS = {
  home: ['screen-home.png', 'Safety Pear home screen', 'Your home screen: one big button, your contacts, night tracking and device status.'],
  countdown: ['screen-countdown.png', 'SOS countdown screen', 'Press the keychain and this pops up by itself. Only your password cancels it.'],
  sos: ['screen-sos.png', 'SOS sent screen with a live map', 'Your contacts and the control room are alerted, with your live location on a map.'],
  map: ['screen-map.png', 'Live location map screen', 'See your live location and the route that night tracking has recorded.'],
};
const tabButtons = [...document.querySelectorAll('[data-tab]')];
const tabImg = document.querySelector('[data-tab-img]');
const tabText = document.querySelector('[data-tab-text]');

function selectTab(name, focus = false) {
  const [file, alt, text] = TABS[name];
  tabButtons.forEach((b) => {
    const on = b.dataset.tab === name;
    b.setAttribute('aria-selected', String(on));
    b.tabIndex = on ? 0 : -1;
    if (on && focus) b.focus();
  });
  tabText.textContent = text;
  tabImg.classList.add('swap');
  setTimeout(() => {
    tabImg.src = `assets/${file}`;
    tabImg.alt = alt;
    tabImg.classList.remove('swap');
  }, 150);
}
tabButtons.forEach((b, i) => {
  b.addEventListener('click', () => selectTab(b.dataset.tab));
  b.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const next = tabButtons[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabButtons.length) % tabButtons.length];
    selectTab(next.dataset.tab, true);
  });
});
selectTab('home');

// ---------- Loudness slider ----------

const LEVELS = [
  [30, 'Whisper'],
  [60, 'Normal conversation'],
  [85, 'Busy city traffic'],
  [100, 'Motorbike passing close by'],
  [120, 'Ambulance siren up close'],
  [130, 'Safety Pear siren'],
];
const dbInput = document.querySelector('[data-db]');
const dbValue = document.querySelector('[data-db-value]');
const dbLabel = document.querySelector('[data-db-label]');
const dbFill = document.querySelector('[data-db-fill]');

function showDb() {
  const v = Number(dbInput.value);
  const label = LEVELS.filter(([db]) => db <= v).pop()[1];
  dbValue.textContent = `${v} dB`;
  dbLabel.textContent = label;
  dbInput.setAttribute('aria-valuetext', `${v} decibels, about as loud as: ${label}`);
  dbFill.style.width = `${((v - 30) / 100) * 100}%`;
}
dbInput.addEventListener('input', showDb);
showDb();

// ---------- Plans ----------

const PLANS = {
  basic: {
    tag: 'Launching first',
    name: 'Basic',
    price: '₹999 – ₹1,499',
    note: 'One-time price · no subscription',
    blurb: 'A Bluetooth keychain that works with your phone and the free app.',
    features: ['130 dB siren', 'Hold-to-trigger button', 'Fall and snatch alerts', 'Free app with live location', 'SOS beacon when your phone isn’t nearby', 'Long-lasting rechargeable battery'],
  },
  plus: {
    tag: 'Coming later',
    name: 'Plus',
    price: '₹2,499 – ₹3,499',
    note: 'Plus ₹49–99 a month for data',
    blurb: 'Works fully on its own, even when your phone is dead or taken.',
    features: ['Everything in Basic', 'Built-in 4G with its own SIM', 'GPS and NavIC location', 'Sends alerts without your phone', 'Rechargeable battery'],
  },
};
const planButtons = [...document.querySelectorAll('[data-plan]')];
const planCard = document.querySelector('[data-plan-card]');

function selectPlan(key) {
  const p = PLANS[key];
  planButtons.forEach((b) => b.setAttribute('aria-checked', String(b.dataset.plan === key)));
  planCard.innerHTML = `
    <div>
      <span class="tag">${p.tag}</span>
      <h3 style="font-size:30px;margin-top:14px">${p.name}</h3>
      <p class="price">${p.price}</p>
      <p class="muted">${p.note}</p>
      <p style="margin-top:14px">${p.blurb}</p>
    </div>
    <ul>${p.features.map((f) => `<li>${f}</li>`).join('')}</ul>`;
}
planButtons.forEach((b) => b.addEventListener('click', () => selectPlan(b.dataset.plan)));
selectPlan('basic');
