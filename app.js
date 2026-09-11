import { saveSession, getActiveSession, getHistory, endActiveSession } from './db.js';
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
const activeCoords = document.getElementById('active-coords');
const activePhoto = document.getElementById('active-photo');
const activeRemaining = document.getElementById('active-remaining');
const navigateButton = document.getElementById('navigate-button');
const doneButton = document.getElementById('done-button');
const historySection = document.getElementById('history-section');
const historyList = document.getElementById('history-list');

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
      session.notified10min = true;
      await saveSession(session);
      checkNotificationsOnResume().catch(console.error);
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
  let active;
  try {
    active = await getActiveSession();
  } catch (err) {
    console.error('Actieve sessie ophalen mislukt:', err);
    return;
  }
  if (!active) {
    hideBanner();
    return;
  }
  try {
    const now = Date.now();
    const due = getNotificationDue(active, now);
    if (due === 'warning') {
      await fireNotification('Je parkeertijd loopt bijna af', 'Nog 10 minuten voordat je parkeertijd verloopt.');
      active.notified10min = true;
      await saveSession(active);
    } else if (due === 'expiry') {
      await fireNotification('Je parkeertijd is verlopen', 'Tijd om je auto op te halen.');
      active.notifiedExpiry = true;
      active.notified10min = true;
      await saveSession(active);
    }
  } catch (err) {
    console.error('Notificatie verwerken/opslaan mislukt:', err);
  }
  if (active.expiryTimestamp !== null && Date.now() >= active.expiryTimestamp) {
    showBanner('Je parkeertijd is verlopen. Tik op "Navigeer terug" om je auto op te halen.');
  } else {
    hideBanner();
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    checkNotificationsOnResume().catch(console.error);
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
    let message = 'Er ging iets mis bij het opslaan van je parkeersessie.';
    if (err && typeof err.code === 'number' && err.code >= 1 && err.code <= 3 && 'PERMISSION_DENIED' in err) {
      // GeolocationPositionError: duck-typed since instanceof isn't reliable across browsers/automation.
      if (err.code === err.PERMISSION_DENIED) message = 'Locatietoegang geweigerd. Sta locatietoegang toe om te kunnen parkeren.';
      else if (err.code === err.POSITION_UNAVAILABLE) message = 'Locatie kon niet worden bepaald. Probeer het opnieuw.';
      else if (err.code === err.TIMEOUT) message = 'Het ophalen van je locatie duurde te lang. Probeer het opnieuw.';
    } else if (err && err.message && err.message.includes('customMinutes')) {
      message = 'Vul een geldig aantal minuten in (groter dan 0).';
    }
    parkError.textContent = message;
    parkError.classList.remove('hidden');
  } finally {
    parkButton.disabled = false;
  }
});

function renderActiveSession(session) {
  currentSession = session;
  activeNote.textContent = session.note || '(geen notitie)';
  activeCoords.textContent = `${session.lat.toFixed(5)}, ${session.lng.toFixed(5)}`;

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

function formatHistoryTimestamp(ts) {
  return new Date(ts).toLocaleString('nl-BE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

async function renderHistory() {
  const history = await getHistory();
  historyList.innerHTML = '';
  if (history.length === 0) {
    historySection.classList.add('hidden');
    return;
  }
  historySection.classList.remove('hidden');
  history.forEach((session) => {
    const li = document.createElement('li');
    const when = formatHistoryTimestamp(session.timestamp);
    const noteText = session.note ? ` — ${session.note}` : '';
    const coordsText = ` — ${session.lat.toFixed(5)}, ${session.lng.toFixed(5)}`;
    li.textContent = `${when}${noteText}${coordsText}`;
    historyList.appendChild(li);
  });
}

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
    await renderHistory();
  }
}

async function init() {
  swRegistration = await registerServiceWorker();
  updateCustomMinutesVisibility();
  await renderApp();
  await checkNotificationsOnResume();
}

init().catch((err) => {
  console.error('App initialisatie mislukt:', err);
  parkError.textContent = 'Opslag niet beschikbaar — je sessie kon niet geladen worden.';
  parkError.classList.remove('hidden');
});
