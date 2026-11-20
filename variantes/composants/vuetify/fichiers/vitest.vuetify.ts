// Compléments à jsdom dont Vuetify a besoin dans les tests (absents de jsdom, présents dans les navigateurs).
class ObservateurTaille {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ObservateurTaille as unknown as typeof ResizeObserver
Object.defineProperty(globalThis, 'visualViewport', {
  configurable: true,
  value: Object.assign(new EventTarget(), { width: 1024, height: 768, offsetLeft: 0, offsetTop: 0, scale: 1 }),
})
