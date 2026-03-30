/**
 * Logica di Push Notifications per Osteria Basilico.
 * Caricato dal service worker (Workbox importScripts).
 * Gestisce gli eventi `push` per mostrare notifiche nel centro notifiche del sistema.
 * 
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Push_API
 */
(function () {
  var TAG_PUSH = 'osteria-push-notification';

  /**
   * Evento `push`: ricevuto quando il server invia una notifica push.
   * Mostra la notifica nel centro notifiche del sistema.
   */
  self.addEventListener('push', function (event) {
    if (!event.data) {
      console.warn('[Push] Notifica push ricevuta senza payload');
      return;
    }

    let notificationData = {};
    try {
      // Tenta di parsare il payload come JSON
      notificationData = event.data.json();
    } catch (e) {
      // Se non è JSON, usa il testo direttamente
      notificationData = {
        title: 'Osteria Basilico',
        body: event.data.text(),
      };
    }

    // Valori di default se non presenti nel payload
    const title = notificationData.title || 'Osteria Basilico';
    const options = {
      body: notificationData.body || 'Nuova notifica',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: TAG_PUSH,
      requireInteraction: notificationData.requireInteraction || false,
      // Dati aggiuntivi (visibili quando l'utente clicca sulla notifica)
      data: {
        url: notificationData.url || '/',
        type: notificationData.type || 'notification',
      },
      // Badge per il conteggio notifiche (se supportato)
      badge: '/icon-192.png',
      // Vibrazioni (ms)
      vibrate: [200, 100, 200],
      // Suono di notifica (URL nel manifesto)
    };

    // Se supportato: mostra badge sull'icona dell'app
    if (navigator.setAppBadge) {
      navigator.setAppBadge(1);
    }

    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  });

  /**
   * Evento `notificationclick`: gestisce i click sulla notifica dal centro notifiche.
   * Apre l'URL associato alla notifica e focalizza la finestra se già aperta.
   */
  self.addEventListener('notificationclick', function (event) {
    event.notification.close();

    const urlToOpen = event.notification.data?.url || '/';
    const baseUrl = self.location.origin;

    event.waitUntil(
      self.clients
        .matchAll({ type: 'window', includeUncontrolled: true })
        .then(function (clientList) {
          // Cerca una finestra già aperta con la stessa URL
          for (let i = 0; i < clientList.length; i++) {
            const client = clientList[i];
            if (client.url === baseUrl + urlToOpen && 'focus' in client) {
              return client.focus();
            }
          }
          // Se nessuna finestra aperta, aprine una nuova
          if (self.clients.openWindow) {
            return self.clients.openWindow(baseUrl + urlToOpen);
          }
        })
    );

    // Pulisci il badge dall'icona
    if (navigator.clearAppBadge) {
      navigator.clearAppBadge();
    }
  });

  /**
   * Evento `notificationclose`: log quando l'utente chiude la notifica.
   */
  self.addEventListener('notificationclose', function (event) {
    console.log('[Push] Notifica chiusa:', event.notification.tag);
  });
})();
