async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('./sw.js');
  } catch (err) {
    console.error('Service worker registratie mislukt:', err);
    return null;
  }
}

async function init() {
  await registerServiceWorker();
}

init();
