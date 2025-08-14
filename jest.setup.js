import 'fake-indexeddb/auto';

if (typeof global.structuredClone === 'undefined') {
  global.structuredClone = (obj) => JSON.parse(JSON.stringify(obj));
}

if (typeof Blob !== 'undefined' && !Blob.prototype.arrayBuffer) {
  Blob.prototype.arrayBuffer = function() {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsArrayBuffer(this);
    });
  };
}

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
