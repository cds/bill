const status = document.querySelector('#connection-status');
const retryLink = document.querySelector('.retry');

function updateConnectionStatus() {
  const isOnline = navigator.onLine;
  status.dataset.online = String(isOnline);
  status.textContent = isOnline ? 'Online' : 'Offline';
}

if (retryLink) {
  retryLink.href = window.location.href;
}

window.addEventListener('online', updateConnectionStatus);
window.addEventListener('offline', updateConnectionStatus);
updateConnectionStatus();
