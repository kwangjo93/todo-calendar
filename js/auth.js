const Auth = (() => {
  const KEY_SIGNED_IN = 'todo-cal-signed-in';
  const KEY_EMAIL     = 'todo-cal-email';

  let tokenClient     = null;
  let accessToken     = null;
  let refreshTimer    = null;
  let onSignInCallback  = null;
  let onSignOutCallback = null;

  function init(onSignIn, onSignOut) {
    onSignInCallback  = onSignIn;
    onSignOutCallback = onSignOut;
  }

  function setupTokenClient(hint, prompt) {
    if (typeof google === 'undefined' || !google.accounts) return false;
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id:  CONFIG.CLIENT_ID,
      scope:      CONFIG.SCOPES,
      hint:       hint  || localStorage.getItem(KEY_EMAIL) || undefined,
      prompt:     prompt !== undefined ? prompt : '',
      callback:   handleTokenResponse,
    });
    return true;
  }

  function handleTokenResponse(response) {
    if (response.error) {
      // Silent failed — restore UI so user can click manually
      localStorage.removeItem(KEY_SIGNED_IN);
      onSignOutCallback && onSignOutCallback();
      return;
    }
    accessToken = response.access_token;
    gapi.client.setToken({ access_token: accessToken });
    localStorage.setItem(KEY_SIGNED_IN, '1');

    // Schedule silent token refresh before the 1-hour expiry
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => silentRefresh(), 50 * 60 * 1000); // 50 min

    onSignInCallback && onSignInCallback(accessToken);
  }

  // Silent refresh — no UI, reuses existing Google session
  function silentRefresh() {
    if (!tokenClient) setupTokenClient();
    if (tokenClient) tokenClient.requestAccessToken({ prompt: '' });
  }

  // Called on page load if previously signed in
  function tryAutoSignIn() {
    if (!localStorage.getItem(KEY_SIGNED_IN)) return;
    const hint = localStorage.getItem(KEY_EMAIL) || '';
    // Re-create tokenClient with stored hint so Google skips account picker
    if (!setupTokenClient(hint, '')) return;
    tokenClient.requestAccessToken({ prompt: '' });
  }

  // Manual sign-in (button click) — always force consent to ensure all scopes granted
  function signIn() {
    if (!setupTokenClient('', 'consent')) {
      alert('Google 라이브러리가 아직 로드되지 않았습니다. 잠시 후 다시 시도해주세요.');
      return;
    }
    tokenClient.requestAccessToken({ prompt: 'consent' });
  }

  function signOut() {
    clearTimeout(refreshTimer);
    if (accessToken) {
      google.accounts.oauth2.revoke(accessToken, () => {});
      accessToken = null;
      gapi.client.setToken(null);
    }
    localStorage.removeItem(KEY_SIGNED_IN);
    localStorage.removeItem(KEY_EMAIL);
    onSignOutCallback && onSignOutCallback();
  }

  function saveEmail(email) {
    if (email) localStorage.setItem(KEY_EMAIL, email);
  }

  function wasPreviouslySignedIn() { return !!localStorage.getItem(KEY_SIGNED_IN); }
  function isSignedIn()  { return !!accessToken; }
  function getToken()    { return accessToken; }

  return { init, setupTokenClient, tryAutoSignIn, signIn, signOut,
           isSignedIn, getToken, wasPreviouslySignedIn, saveEmail };
})();
