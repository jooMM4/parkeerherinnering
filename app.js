import { saveSession, getActiveSession, endActiveSession } from './db.js';
import {
  PRESETS,
  WARNING_MINUTES_BEFORE,
  calculateExpiryTimestamp,
  getRemainingMs,
  formatRemainingTime,
  getNotificationDue,
} from './lib/session-logic.js';

const startView = document.getElementById('start-view');
const activeView = document.getElementById('active-view');
const banner = document.getElementById('banner');
const parkForm = document.getElementById('park-form');
const parkButton = document.getElementById('park-button');
const parkError = document.getElementById('park-error');
const presetRadios = parkForm.querySelectorAll('input[name="preset"]');
const customMinutesWrap = document.getElementById('custom-minutes-wrap');
const customMinutesInput = document.getElementById('custom-minutes');
const activeNote = document.getElementById('active-note');
const activePhoto = document.getElementById('active-photo');
const activeRemaining = document.getElementById('active-remaining');
const navigateButton = document.getElementById('navigate-button');
const doneButton = document.getElementById('done-button');

let swRegistration = null;
let currentSession = null;
let countdownInterval = null;
let currentPhotoUrl = null;
let warningTimeoutId = null;
let expiryTimeoutId = null;

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

async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Notification.permission;
  }
  return Notification.requestPermission();
}

async function fireNotification(title, body) {
  try {
    if (swRegistration && swRegistration.showNotification) {
      await swRegistration.showNotification(title, { body });
    } else if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body });
    }
  } catch (err) {
    console.error('Notificatie tonen mislukt:', err);
  }
}

function clearScheduledNotifications() {
  if (warningTimeoutId) { clearTimeout(warningTimeoutId); warningTimeoutId = null; }
  if (expiryTimeoutId) { clearTimeout(expiryTimeoutId); expiryTimeoutId = null; }
}

function scheduleNotifications(session) {
  clearScheduledNotifications();
  if (session.expiryTimestamp === null) return;

  const now = Date.now();
  const warningAt = session.expiryTimestamp - WARNING_MINUTES_BEFORE * 60 * 1000;

  if (!session.notified10min && warningAt > now) {
    warningTimeoutId = setTimeout(async () => {
      await fireNotification('Je parkeertijd loopt bijna af', 'Nog 10 minuten voordat je parkeertijd verloopt.');
      session.notified10min = true;
      await saveSession(session);
    }, warningAt - now);
  }

  if (!session.notifiedExpiry && session.expiryTimestamp > now) {
    expiryTimeoutId = setTimeout(async () => {
      await fireNotification('Je parkeertijd is verlopen', 'Tijd om je auto op te halen.');
      session.notifiedExpiry = true;
      await saveSession(session);
      await checkNotificationsOnResume();
    }, session.expiryTimestamp - now);
  }
}

function showBanner(message) {
  banner.textContent = message;
  banner.classList.remove('hidden');
}

function hideBanner() {
  banner.classList.add('hidden');
  banner.textContent = '';
}

async function checkNotificationsOnResume() {
  const active = await getActiveSession();
  if (!active) {
    hideBanner();
    return;
  }
  const now = Date.now();
  const due = getNotificationDue(active, now);
  if (due === 'warning') {
    await fireNotification('Je parkeertijd loopt bijna af', 'Nog 10 minuten voordat je parkeertijd verloopt.');
    active.notified10min = true;
    await saveSession(active);
  } else if (due === 'expiry') {
    await fireNotification('Je parkeertijd is verlopen', 'Tijd om je auto op te halen.');
    active.notifiedExpiry = true;
    await saveSession(active);
  }
  if (active.expiryTimestamp !== null && now >= active.expiryTimestamp) {
    showBanner('Je parkeertijd is verlopen. Tik op "Navigeer terug" om je auto op te halen.');
  } else {
    hideBanner();
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    checkNotificationsOnResume();
  }
});

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

    await requestNotificationPermission();
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

function renderActiveSession(session) {
  currentSession = session;
  activeNote.textContent = session.note || '(geen notitie)';

  if (currentPhotoUrl) {
    URL.revokeObjectURL(currentPhotoUrl);
    currentPhotoUrl = null;
  }
  if (session.photoBlob) {
    currentPhotoUrl = URL.createObjectURL(session.photoBlob);
    activePhoto.src = currentPhotoUrl;
    activePhoto.classList.remove('hidden');
  } else {
    activePhoto.classList.add('hidden');
  }

  updateRemainingDisplay();
  if (countdownInterval) clearInterval(countdownInterval);
  countdownInterval = setInterval(updateRemainingDisplay, 30000);

  scheduleNotifications(session);
}

function updateRemainingDisplay() {
  if (!currentSession) return;
  const remainingMs = getRemainingMs(currentSession.expiryTimestamp, Date.now());
  activeRemaining.textContent = formatRemainingTime(remainingMs);
}

navigateButton.addEventListener('click', () => {
  if (!currentSession) return;
  const url = `https://www.google.com/maps/dir/?api=1&destination=${currentSession.lat},${currentSession.lng}`;
  window.open(url, '_blank');
});

doneButton.addEventListener('click', async () => {
  clearScheduledNotifications();
  hideBanner();
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
  await endActiveSession();
  currentSession = null;
  await renderApp();
});

async function renderApp() {
  const active = await getActiveSession();
  if (active) {
    startView.classList.add('hidden');
    activeView.classList.remove('hidden');
    renderActiveSession(active);
  } else {
    startView.classList.remove('hidden');
    activeView.classList.add('hidden');
    clearScheduledNotifications();
    hideBanner();
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
  }
}

async function init() {
  swRegistration = await registerServiceWorker();
  updateCustomMinutesVisibility();
  await renderApp();
  await checkNotificationsOnResume();
}

init();
