// ── Main application orchestrator ─────────────────────────────────────────

const App = (() => {
  let calendars = [];
  let enabledIds = new Set();
  let allEvents = [];
  let viewYear, viewMonth;
  let googleReady = false;

  // ── Init (runs immediately on DOMContentLoaded) ────────────────────────
  function init() {
    const today = new Date();
    viewYear = today.getFullYear();
    viewMonth = today.getMonth();

    setDateLabels(today);
    UI.renderReminders();
    UI.showSignedOut();
    UI.renderCalendar(viewYear, viewMonth, [], {}, openDayDetail);
    Reminders.setOnChange(() => UI.renderReminders());
    bindStaticEvents();
  }

  function setDateLabels(today) {
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    document.getElementById('today-date-label').textContent =
      today.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' });
    document.getElementById('tomorrow-date-label').textContent =
      tomorrow.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
  }

  // Called once Google libs are fully ready
  function onGoogleReady() {
    googleReady = true;
    const authBtn = document.getElementById('btn-auth');
    authBtn.disabled = false;
    // Show connecting state if previously signed in
    if (Auth.wasPreviouslySignedIn()) {
      authBtn.textContent = '연결 중...';
      authBtn.disabled = true;
    }
  }

  // ── After Google sign-in ───────────────────────────────────────────────
  async function onSignedIn() {
    try {
      const profile = await CalendarAPI.getUserInfo();
      if (profile && profile.email) Auth.saveEmail(profile.email);
      UI.showUser(profile);

      // Load reminders from Drive (cross-device sync)
      await Reminders.loadFromDrive();

      calendars = await CalendarAPI.listCalendars();
      const DEFAULT_CALENDARS = ['생산일정', '연구일정'];
      const defaultMatches = calendars.filter(c => DEFAULT_CALENDARS.includes(c.summary));
      enabledIds = new Set(
        defaultMatches.length ? defaultMatches.map(c => c.id) : calendars.map(c => c.id)
      );
      UI.renderCalendarFilter(calendars, enabledIds, onToggleCalendar);
      UI.populateCalendarSelect(calendars);

      await loadAndRenderAll();
    } catch (err) {
      console.error(err);
      UI.toast('캘린더 로드 실패: ' + (err.message || err));
    }
  }

  function onSignedOut() {
    Reminders.resetDrive();
    UI.showSignedOut();
    // Restore login button in case it was showing "연결 중..."
    const authBtn = document.getElementById('btn-auth');
    authBtn.disabled = false;
    authBtn.innerHTML = '<img src="https://www.google.com/favicon.ico" width="16" height="16" alt="G" /> Google 로그인';
    calendars = [];
    enabledIds = new Set();
    allEvents = [];
    UI.renderToday([], {});
    UI.renderTomorrow([], {});
    UI.renderCalendar(viewYear, viewMonth, [], {}, openDayDetail);
  }

  // ── Load events ────────────────────────────────────────────────────────
  async function loadAndRenderAll() {
    const windowStart = new Date(viewYear, viewMonth - 1, 1);
    const windowEnd   = new Date(viewYear, viewMonth + 2, 0, 23, 59, 59);
    const ids = [...enabledIds];

    if (!ids.length) {
      allEvents = [];
      renderViews();
      return;
    }

    try {
      allEvents = await CalendarAPI.listEventsForRange(ids, windowStart, windowEnd);
      renderViews();
    } catch (err) {
      console.error(err);
      UI.toast('일정 로드 오류: ' + (err.message || err));
    }
  }

  function renderViews() {
    const calMap = buildCalMap();
    const today = new Date();
    const todayStr = UI.dateStr(today);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const tomorrowStr = UI.dateStr(tomorrow);

    const todayEvs = allEvents.filter(ev =>
      (ev.start.dateTime || ev.start.date || '').slice(0, 10) === todayStr
    ).sort(sortEvents);

    const tomorrowEvs = allEvents.filter(ev =>
      (ev.start.dateTime || ev.start.date || '').slice(0, 10) === tomorrowStr
    ).sort(sortEvents);

    UI.renderToday(todayEvs, calMap);
    UI.renderTomorrow(tomorrowEvs, calMap);
    UI.renderCalendar(viewYear, viewMonth, allEvents, calMap, openDayDetail);
  }

  function buildCalMap() {
    const m = {};
    calendars.forEach(c => { m[c.id] = c; });
    return m;
  }

  function sortEvents(a, b) {
    const ta = a.start.dateTime || a.start.date;
    const tb = b.start.dateTime || b.start.date;
    return ta < tb ? -1 : ta > tb ? 1 : 0;
  }

  // ── Calendar toggle ────────────────────────────────────────────────────
  function onToggleCalendar(id, enabled) {
    if (enabled) enabledIds.add(id);
    else enabledIds.delete(id);
    loadAndRenderAll();
  }

  // ── Month navigation ───────────────────────────────────────────────────
  async function changeMonth(delta) {
    viewMonth += delta;
    if (viewMonth > 11) { viewMonth = 0; viewYear++; }
    if (viewMonth < 0)  { viewMonth = 11; viewYear--; }
    await loadAndRenderAll();
  }

  // ── Day detail ─────────────────────────────────────────────────────────
  function openDayDetail(date, events, calMap) {
    UI.showDayDetail(date, events, calMap);
  }

  // ── Add event ──────────────────────────────────────────────────────────
  async function submitAddEvent(e) {
    e.preventDefault();
    const title  = document.getElementById('ev-title').value.trim();
    const date   = document.getElementById('ev-date').value;
    const start  = document.getElementById('ev-start-time').value;
    const end    = document.getElementById('ev-end-time').value;
    const calId  = document.getElementById('ev-calendar').value;
    const desc   = document.getElementById('ev-description').value.trim();
    const allDay = document.getElementById('ev-allday').checked;

    if (!title || !date || !calId) {
      UI.toast('제목과 날짜, 캘린더를 입력해주세요');
      return;
    }

    let eventBody;
    if (allDay || (!start && !end)) {
      eventBody = { summary: title, description: desc || undefined,
        start: { date }, end: { date } };
    } else {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      eventBody = { summary: title, description: desc || undefined,
        start: { dateTime: `${date}T${start || '00:00'}:00`, timeZone: tz },
        end:   { dateTime: `${date}T${end || start || '00:00'}:00`, timeZone: tz } };
    }

    const submitBtn = document.querySelector('#form-add-event .btn-primary');
    try {
      submitBtn.disabled = true;
      submitBtn.textContent = '저장 중...';
      await CalendarAPI.createEvent(calId, eventBody);
      closeModal('modal-add-event');
      document.getElementById('form-add-event').reset();
      await loadAndRenderAll();
      UI.toast('일정이 구글 캘린더에 추가되었습니다 ✓');
    } catch (err) {
      console.error(err);
      UI.toast('일정 저장 실패: ' + (err.message || err));
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = '저장';
    }
  }

  // ── Modal helpers ──────────────────────────────────────────────────────
  function openModal(id)  { document.getElementById(id).classList.remove('hidden'); }
  function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

  // ── Bind static events (runs immediately, no Google dep) ───────────────
  function bindStaticEvents() {
    // Auth button — show feedback if Google libs not ready yet
    document.getElementById('btn-auth').addEventListener('click', () => {
      if (!googleReady) {
        UI.toast('Google 라이브러리 로딩 중... 잠시 후 다시 눌러주세요.');
        return;
      }
      Auth.signIn();
    });

    document.getElementById('btn-logout').addEventListener('click', () => Auth.signOut());

    // Calendar filter
    document.getElementById('btn-calendar-filter').addEventListener('click', () => {
      document.getElementById('filter-panel').classList.toggle('hidden');
    });
    document.getElementById('btn-close-filter').addEventListener('click', () => {
      document.getElementById('filter-panel').classList.add('hidden');
    });

    // Month nav
    document.getElementById('btn-prev-month').addEventListener('click', () => changeMonth(-1));
    document.getElementById('btn-next-month').addEventListener('click', () => changeMonth(1));
    document.getElementById('btn-today').addEventListener('click', () => {
      const now = new Date();
      viewYear = now.getFullYear();
      viewMonth = now.getMonth();
      loadAndRenderAll();
    });

    // Add event modal
    document.getElementById('btn-add-event').addEventListener('click', () => {
      document.getElementById('ev-date').value = UI.dateStr(new Date());
      openModal('modal-add-event');
    });

    document.getElementById('btn-add-on-day').addEventListener('click', () => {
      const date = document.getElementById('btn-add-on-day').dataset.date;
      closeModal('modal-day-detail');
      document.getElementById('ev-date').value = date;
      openModal('modal-add-event');
    });

    document.getElementById('form-add-event').addEventListener('submit', submitAddEvent);

    // Modal close
    document.querySelectorAll('.modal-close, .modal-cancel').forEach(btn => {
      btn.addEventListener('click', () => btn.closest('.modal').classList.add('hidden'));
    });
    document.querySelectorAll('.modal-backdrop').forEach(bd => {
      bd.addEventListener('click', () => bd.closest('.modal').classList.add('hidden'));
    });

    // All-day checkbox
    document.getElementById('ev-allday').addEventListener('change', (e) => {
      const s = document.getElementById('ev-start-time').parentElement;
      const en = document.getElementById('ev-end-time').parentElement;
      s.style.display = en.style.display = e.target.checked ? 'none' : '';
    });

    // Reminders
    document.getElementById('remind-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('remind-input');
      const text = input.value.trim();
      if (!text) return;
      Reminders.add(text);
      input.value = '';
      UI.renderReminders();
    });
    document.getElementById('remind-list').addEventListener('click', (e) => {
      const btn = e.target.closest('.remind-item-del');
      if (!btn) return;
      Reminders.remove(Number(btn.dataset.id));
      UI.renderReminders();
    });

    // Setup modal
    document.getElementById('btn-close-setup').addEventListener('click', () => {
      closeModal('modal-setup');
    });
  }

  return { init, onGoogleReady, onSignedIn, onSignedOut };
})();

// ── Google API / GIS bootstrap ─────────────────────────────────────────────
// UI init runs immediately — no waiting for Google
document.addEventListener('DOMContentLoaded', () => App.init());

let __gapiReady = false;
let __gisReady  = false;

function tryInit() {
  if (window.__gapiLoaded) __gapiReady = true;
  if (window.__gisLoaded)  __gisReady  = true;
  if (__gapiReady && __gisReady) bootApp();
}

async function bootApp() {
  if (!CONFIG.CLIENT_ID || CONFIG.CLIENT_ID.includes('YOUR_GOOGLE')) {
    document.getElementById('setup-origin').textContent = window.location.origin;
    document.getElementById('modal-setup').classList.remove('hidden');
    return;
  }

  try {
    await new Promise((resolve, reject) => {
      gapi.load('client', { callback: resolve, onerror: reject });
    });

    await gapi.client.init({
      discoveryDocs: CONFIG.DISCOVERY_DOCS,
    });

    Auth.init(
      () => App.onSignedIn(),
      () => App.onSignedOut(),
    );
    Auth.setupTokenClient();
    App.onGoogleReady();
    Auth.tryAutoSignIn(); // 이전에 로그인했으면 자동 재연결
  } catch (err) {
    console.error('Google API 초기화 실패:', err);
    UI.toast('Google API 초기화 실패. 콘솔을 확인하세요.');
  }
}

window.tryInit = tryInit;
// Handle scripts already loaded before this file ran
if (window.__gapiLoaded) __gapiReady = true;
if (window.__gisLoaded)  __gisReady  = true;
if (__gapiReady && __gisReady) bootApp();
