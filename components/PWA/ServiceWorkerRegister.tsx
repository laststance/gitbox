/**
 * Service Worker Registration Component
 *
 * Registers the service worker for PWA functionality
 */

'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      // Register service worker on page load
      window.addEventListener('load', async () => {
        try {
          const registration = await navigator.serviceWorker.register('/sw.js', {
            scope: '/',
          });
          
          console.log('[PWA] Service Worker registered:', registration.scope);

          // Check for updates periodically
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // New content is available
                  console.log('[PWA] New content available, refresh to update');
                }
              });
            }
          });
        } catch (error) {
          console.error('[PWA] Service Worker registration failed:', error);
        }
      });
    }
  }, []);

  return null;
}

