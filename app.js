import { saveSession, getActiveSession } from './db.js';
import { PRESETS, calculateExpiryTimestamp } from './lib/session-logic.js';

const startView = document.getElementById('start-view');
const activeView = document.getElementById('active-view');
const parkForm = document.getElementById('park-form');
const parkButton = document.getElementById('park-button');
const parkError = document.getElementById('park-error');
const presetRadios = parkForm.querySelectorAll('input[name="preset"]');
const customMinutesWrap = document.getElementById('custom-minutes-wrap');
const customMinutesInput = document.getElementById('custom-minutes');

let swRegistration = null;

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('./sw.js');
  } catch (err) {
    console.error('Service worker registratie mislukt:', err);
    return null;
  }
}

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Geolocation wordt niet ondersteund door deze browser.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
    });
  });
}

function updateCustomMinutesVisibility() {
  const selected = parkForm.querySelector('input[name="preset"]:checked').value;
  customMinutesWrap.classList.toggle('hidden', selected !== PRESETS.PAID);
}

presetRadios.forEach((radio) => radio.addEventListener('change', updateCustomMinutesVisibility));

parkForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  parkError.classList.add('hidden');
  parkButton.disabled = true;
  try {
    const position = await getCurrentPosition();
    const preset = parkForm.querySelector('input[name="preset"]:checked').value;
    const customMinutes = preset === PRESETS.PAID ? Number(customMinutesInput.value) : null;
    const now = Date.now();
    const expiryTimestamp = calculateExpiryTimestamp(preset, customMinutes, now);
    const photoFile = document.getElementById('photo').files[0] || null;

    const session = {
      id: crypto.randomUUID(),
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      timestamp: now,
      note: document.getElementById('note').value.trim(),
      photoBlob: photoFile,
      expiryTimestamp,
      presetType: preset,
      active: true,
      notified10min: false,
      notifiedExpiry: false,
    };

    await saveSession(session);
    parkForm.reset();
    updateCustomMinutesVisibility();
    await renderApp();
  } catch (err) {
    console.error(err);
    parkError.textContent = err.message || 'Er ging iets mis bij het opslaan van je parkeersessie.';
    parkError.classList.remove('hidden');
  } finally {
    parkButton.disabled = false;
  }
});

async function renderApp() {
  const active = await getActiveSession();
  if (active) {
    startView.classList.add('hidden');
    activeView.classList.remove('hidden');
  } else {
    startView.classList.remove('hidden');
    activeView.classList.add('hidden');
  }
}

async function init() {
  swRegistration = await registerServiceWorker();
  updateCustomMinutesVisibility();
  await renderApp();
}

init();
