const status = document.querySelector('#connection-status');

function updateConnectionStatus() {
  const isOnline = navigator.onLine;
  status.dataset.online = String(isOnline);
  status.textContent = isOnline
    ? 'Connection restored. Retry to open the full workspace.'
    : 'You’re offline.';
}

window.addEventListener('online', updateConnectionStatus);
window.addEventListener('offline', updateConnectionStatus);
updateConnectionStatus();
