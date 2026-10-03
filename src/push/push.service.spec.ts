import { isPushEndpoint } from './push.service';

describe('isPushEndpoint', () => {
  it.each([
    'https://fcm.googleapis.com/fcm/send/abc',
    'https://updates.push.services.mozilla.com/wpush/v2/abc',
    'https://db5p.notify.windows.com/w/?token=abc',
    'https://web.push.apple.com/abc',
  ])('accepts the browser push service %s', (endpoint) => {
    expect(isPushEndpoint(endpoint)).toBe(true);
  });

  it.each([
    'http://fcm.googleapis.com/fcm/send/abc',
    'https://fcm.googleapis.com.evil.example/abc',
    'https://localhost:3001/admin',
    'https://169.254.169.254/latest/meta-data',
    'not a url',
  ])('refuses %s', (endpoint) => {
    expect(isPushEndpoint(endpoint)).toBe(false);
  });
});
