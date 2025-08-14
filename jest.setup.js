import 'fake-indexeddb/auto';

global.navigator = {
  ...global.navigator,
  onLine: true,
  serviceWorker: {
    ready: Promise.resolve({
      pushManager: {
        subscribe: jest.fn(),
        getSubscription: jest.fn(),
      },
    }),
    addEventListener: jest.fn(),
  },
  geolocation: {
    getCurrentPosition: jest.fn(),
  },
  mediaDevices: {
    getUserMedia: jest.fn(),
  },
};

global.MediaRecorder = jest.fn().mockImplementation(() => ({
  start: jest.fn(),
  stop: jest.fn(),
  ondataavailable: null,
  onstop: null,
}));

global.fetch = jest.fn();

Object.defineProperty(window, 'location', {
  value: {
    href: 'http://localhost:3000',
  },
  writable: true,
});
