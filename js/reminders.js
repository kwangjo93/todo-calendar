// Reminders — localStorage for instant UI, Google Drive for cross-device sync
const Reminders = (() => {
  const LOCAL_KEY   = 'todo-calendar-reminders';
  const DRIVE_FILE  = 'reminders.json';

  let driveFileId   = null;
  let onChangeCallback = null;

  // ── localStorage (always available) ──────────────────────────────────────
  function localLoad() {
    try { return JSON.parse(localStorage.getItem(LOCAL_KEY)) || []; }
    catch { return []; }
  }

  function localSave(items) {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(items));
  }

  // ── Google Drive ──────────────────────────────────────────────────────────
  async function driveFindFile() {
    const resp = await gapi.client.drive.files.list({
      spaces: 'appDataFolder',
      q: `name='${DRIVE_FILE}'`,
      fields: 'files(id)',
    });
    const files = resp.result.files || [];
    return files.length ? files[0].id : null;
  }

  async function driveRead(fileId) {
    const resp = await gapi.client.drive.files.get({ fileId, alt: 'media' });
    try { return JSON.parse(resp.body) || []; }
    catch { return []; }
  }

  async function driveWrite(items) {
    const content = JSON.stringify(items);
    if (driveFileId) {
      // Update existing file
      await gapi.client.request({
        path: `/upload/drive/v3/files/${driveFileId}`,
        method: 'PATCH',
        params: { uploadType: 'media' },
        headers: { 'Content-Type': 'application/json' },
        body: content,
      });
    } else {
      // Create new file in appDataFolder
      const boundary = 'remind_boundary_314159';
      const body = [
        `--${boundary}`,
        'Content-Type: application/json\r\n',
        JSON.stringify({ name: DRIVE_FILE, parents: ['appDataFolder'] }),
        `--${boundary}`,
        'Content-Type: application/json\r\n',
        content,
        `--${boundary}--`,
      ].join('\r\n');

      const resp = await gapi.client.request({
        path: '/upload/drive/v3/files',
        method: 'POST',
        params: { uploadType: 'multipart' },
        headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
        body,
      });
      driveFileId = resp.result.id;
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────

  // Called after sign-in — load from Drive and sync to localStorage
  async function loadFromDrive() {
    try {
      driveFileId = await driveFindFile();
      if (driveFileId) {
        const items = await driveRead(driveFileId);
        localSave(items);
      } else {
        // First time: push existing localStorage items to Drive
        await driveWrite(localLoad());
      }
      onChangeCallback && onChangeCallback();
    } catch (err) {
      console.warn('Drive 로드 실패, localStorage 사용:', err);
      onChangeCallback && onChangeCallback();
    }
  }

  // Called on sign-out — fall back to localStorage
  function resetDrive() {
    driveFileId = null;
  }

  function setOnChange(fn) {
    onChangeCallback = fn;
  }

  function getAll() {
    return localLoad();
  }

  function add(text) {
    const items = localLoad();
    const item = { id: Date.now(), text: text.trim(), createdAt: new Date().toISOString() };
    items.unshift(item);
    localSave(items);
    driveWrite(items).catch(err => console.warn('Drive 저장 실패:', err));
    return item;
  }

  function remove(id) {
    const items = localLoad().filter(i => i.id !== id);
    localSave(items);
    driveWrite(items).catch(err => console.warn('Drive 저장 실패:', err));
  }

  return { loadFromDrive, resetDrive, setOnChange, getAll, add, remove };
})();
