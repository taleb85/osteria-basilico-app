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

    // Se è una notifica di aggiornamento forzato: non mostrare nel centro notifiche,
    // ma postare direttamente a tutte le finestre aperte per triggerare l'overlay.
    if (notificationData.type === 'force_reload') {
      event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
          clientList.forEach(function (client) {
            client.postMessage({ type: 'FORCE_DATA_RELOAD' });
          });
        })
      );
      return;
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

    // Badge sull'icona dell'app (il numero viene aggiornato dall'app quando aperta)
    if (navigator.setAppBadge) {
      navigator.setAppBadge().catch(() => {});
    }

    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  });

  /**
   * Evento `notificationclick`: apre l'app e mostra il pannello notifiche.
   * - Se l'app è già aperta: manda un messaggio per aprire il modal
   * - Se l'app è chiusa: apre con parametro ?open=notifications
   */
  self.addEventListener('notificationclick', function (event) {
    event.notification.close();

    var baseUrl = self.location.origin;
    var openUrl = baseUrl + '/?open=notifications';

    event.waitUntil(
      self.clients
        .matchAll({ type: 'window', includeUncontrolled: true })
        .then(function (clientList) {
          // Se c'è già una finestra aperta: portala in primo piano e apri il modal
          for (var i = 0; i < clientList.length; i++) {
            var client = clientList[i];
            if ('focus' in client) {
              client.postMessage({ type: 'OPEN_NOTIFICATIONS' });
              return client.focus();
            }
          }
          // Nessuna finestra aperta: apri l'app con il parametro
          if (self.clients.openWindow) {
            return self.clients.openWindow(openUrl);
          }
        })
    );

    // Pulisci il badge
    if (navigator.clearAppBadge) {
      navigator.clearAppBadge().catch(function () {});
    }
  });

  /**
   * Evento `notificationclose`: log quando l'utente chiude la notifica.
   */
  self.addEventListener('notificationclose', function (event) {
    console.log('[Push] Notifica chiusa:', event.notification.tag);
  });
})();
