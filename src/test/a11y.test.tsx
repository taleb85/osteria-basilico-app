import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { axe, toHaveNoViolations } from 'jest-axe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LoginPage from '../components/LoginPage';

vi.mock('../context/AppContext', () => ({
  useApp: () => ({
    users: [],
    setCurrentUser: vi.fn(),
    setLanguage: vi.fn(),
    setIsSessionElevated: vi.fn(),
    featureFlags: { kiosk_active: true },
  }),
}));

vi.mock('../context/TenantContext', () => ({
  useTenant: () => ({ tenant: null, loadTenantBySlug: vi.fn() }),
}));

/** Evita chiamate WebAuthn in jsdom */
vi.mock('../utils/pinUnlockWebAuthn', () => ({
  supportsPinUnlockWebAuthn: () => false,
  registerPinUnlockCredential: vi.fn(),
  hasAnyPinUnlockCredentialOnDevice: () => Promise.resolve(false),
  authenticatePinUnlockAndResolveUserId: vi.fn(),
  hasPinUnlockCredential: () => Promise.resolve(false),
  hasPlatformBiometricAuthenticator: () => Promise.resolve(false),
}));

expect.extend(toHaveNoViolations);

describe('a11y', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('LoginPage non ha violazioni a11y (jest-axe)', async () => {
    const { container } = render(
      <MemoryRouter>
        <LoginPage onLogin={() => {}} onBack={() => {}} />
      </MemoryRouter>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
