// UI rendering helpers
const UI = (() => {

  // ── Reminders ────────────────────────────────────────────────────────────
  function renderReminders() {
    const list = document.getElementById('remind-list');
    const items = Reminders.getAll();
    list.innerHTML = '';
    if (!items.length) {
      list.innerHTML = '<li class="empty-state"><span>아직 작성된 메모가 없습니다</span></li>';
      return;
    }
    items.forEach(item => {
      const li = document.createElement('li');
      li.className = 'remind-item';
      li.dataset.id = item.id;
      li.innerHTML = `<span>${escHtml(item.text)}</span><button class="remind-item-del" data-id="${item.id}" title="삭제">✕</button>`;
      list.appendChild(li);
    });
  }

  // ── Event helpers ─────────────────────────────────────────────────────────
  function getEventTime(ev) {
    if (ev.start.dateTime) {
      return new Date(ev.start.dateTime).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
    }
    return '종일';
  }

  function eventCardHTML(ev, calMap, large = false) {
    const cal = calMap[ev._calendarId] || {};
    const color = cal.backgroundColor || '#4285f4';
    const time = getEventTime(ev);
    const isAllDay = !ev.start.dateTime;
    return `
      <div class="event-card ${large ? 'today-event-card' : ''} ${isAllDay ? 'allday' : ''}"
           style="border-left-color: ${color}; background: ${color}11;">
        <div>
          <div class="ev-time">${escHtml(time)}</div>
          ${isAllDay ? '' : `<div class="ev-cal" style="color:${color}">${escHtml(cal.summary || '')}</div>`}
        </div>
        <div>
          <div class="ev-title">${escHtml(ev.summary || '(제목 없음)')}</div>
          ${isAllDay ? `<div class="ev-cal" style="color:${color}">${escHtml(cal.summary || '')}</div>` : ''}
          ${ev.location ? `<div class="ev-cal">📍 ${escHtml(ev.location)}</div>` : ''}
        </div>
      </div>`;
  }

  // ── Today events ──────────────────────────────────────────────────────────
  function renderToday(events, calMap) {
    const container = document.getElementById('today-events');
    if (!events.length) {
      container.innerHTML = '<div class="empty-state"><span>오늘 일정이 없습니다</span></div>';
      return;
    }
    container.innerHTML = events.map(ev => eventCardHTML(ev, calMap, true)).join('');
  }

  // ── Tomorrow events ───────────────────────────────────────────────────────
  function renderTomorrow(events, calMap) {
    const container = document.getElementById('tomorrow-events');
    if (!events.length) {
      container.innerHTML = '<div class="empty-state"><span>내일 일정이 없습니다</span></div>';
      return;
    }
    container.innerHTML = events.map(ev => eventCardHTML(ev, calMap)).join('');
  }

  // ── 30-day calendar grid ──────────────────────────────────────────────────
  function renderCalendar(year, month, events, calMap, onDayClick) {
    const label = document.getElementById('calendar-month-label');
    label.textContent = new Date(year, month).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' });

    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = '';

    const today = new Date();
    const todayStr = dateStr(today);

    // First day of month & padding
    const firstDay = new Date(year, month, 1);
    const startPad = firstDay.getDay(); // 0=Sun

    // Last day of month
    const lastDay = new Date(year, month + 1, 0).getDate();

    // Previous month days for padding
    const prevMonthLast = new Date(year, month, 0).getDate();

    // Group events by day
    const byDay = {};
    events.forEach(ev => {
      const d = (ev.start.dateTime ? ev.start.dateTime : ev.start.date).slice(0, 10);
      if (!byDay[d]) byDay[d] = [];
      byDay[d].push(ev);
    });

    const MAX_PILLS = 3;

    // Render cells: prev month padding + current + next month padding
    const totalCells = Math.ceil((startPad + lastDay) / 7) * 7;

    for (let i = 0; i < totalCells; i++) {
      const cell = document.createElement('div');
      cell.className = 'cal-day';

      let cellDate, inCurrentMonth;

      if (i < startPad) {
        const d = prevMonthLast - startPad + 1 + i;
        cellDate = new Date(year, month - 1, d);
        inCurrentMonth = false;
      } else if (i >= startPad + lastDay) {
        const d = i - startPad - lastDay + 1;
        cellDate = new Date(year, month + 1, d);
        inCurrentMonth = false;
      } else {
        const d = i - startPad + 1;
        cellDate = new Date(year, month, d);
        inCurrentMonth = true;
      }

      const ds = dateStr(cellDate);
      const dow = cellDate.getDay();

      if (!inCurrentMonth) cell.classList.add('other-month');
      if (ds === todayStr) cell.classList.add('today');
      if (dow === 0) cell.classList.add('sunday');
      if (dow === 6) cell.classList.add('saturday');

      cell.innerHTML = `<span class="day-num">${cellDate.getDate()}</span>`;

      const dayEvents = byDay[ds] || [];
      const shown = dayEvents.slice(0, MAX_PILLS);
      const more = dayEvents.length - MAX_PILLS;

      shown.forEach(ev => {
        const cal = calMap[ev._calendarId] || {};
        const color = cal.backgroundColor || '#4285f4';
        const pill = document.createElement('div');
        pill.className = 'cal-event-pill';
        pill.style.background = color;
        pill.textContent = ev.summary || '(제목 없음)';
        cell.appendChild(pill);
      });

      if (more > 0) {
        const moreEl = document.createElement('div');
        moreEl.className = 'cal-more';
        moreEl.textContent = `+${more}개 더보기`;
        cell.appendChild(moreEl);
      }

      cell.addEventListener('click', () => onDayClick(cellDate, dayEvents, calMap));
      grid.appendChild(cell);
    }
  }

  // ── Calendar filter panel ─────────────────────────────────────────────────
  function renderCalendarFilter(calendars, enabledIds, onToggle) {
    const list = document.getElementById('calendar-list');
    list.innerHTML = '';
    calendars.forEach(cal => {
      const item = document.createElement('div');
      item.className = 'calendar-item' + (enabledIds.has(cal.id) ? ' checked' : '');
      item.innerHTML = `
        <span class="cal-color-dot" style="background: ${cal.backgroundColor || '#4285f4'}"></span>
        <span class="cal-name">${escHtml(cal.summary)}</span>
        <span class="cal-check">✓</span>`;
      item.addEventListener('click', () => {
        const checked = item.classList.toggle('checked');
        onToggle(cal.id, checked);
      });
      list.appendChild(item);
    });
  }

  // ── Event calendar selector in modal ─────────────────────────────────────
  function populateCalendarSelect(calendars) {
    const sel = document.getElementById('ev-calendar');
    sel.innerHTML = calendars.map(c =>
      `<option value="${escHtml(c.id)}">${escHtml(c.summary)}</option>`
    ).join('');
  }

  // ── Day detail modal ──────────────────────────────────────────────────────
  function showDayDetail(date, events, calMap) {
    const modal = document.getElementById('modal-day-detail');
    const title = document.getElementById('day-detail-title');
    const container = document.getElementById('day-detail-events');

    title.textContent = date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });

    if (!events.length) {
      container.innerHTML = '<div class="empty-state"><span>일정이 없습니다</span></div>';
    } else {
      container.innerHTML = events.map(ev => eventCardHTML(ev, calMap)).join('');
    }

    modal.classList.remove('hidden');
    document.getElementById('btn-add-on-day').dataset.date = dateStr(date);
  }

  // ── User info ─────────────────────────────────────────────────────────────
  function showUser(profile) {
    document.getElementById('btn-auth').classList.add('hidden');
    const info = document.getElementById('user-info');
    info.classList.remove('hidden');
    if (profile) {
      document.getElementById('user-avatar').src = profile.picture || '';
      document.getElementById('user-name').textContent = profile.name || profile.email || '';
    }
    document.getElementById('btn-add-event').disabled = false;
  }

  function showSignedOut() {
    document.getElementById('btn-auth').classList.remove('hidden');
    document.getElementById('user-info').classList.add('hidden');
    document.getElementById('btn-add-event').disabled = true;
  }

  // ── Toast ─────────────────────────────────────────────────────────────────
  let toastTimer;
  function toast(msg, duration = 2800) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add('hidden'), duration);
  }

  // ── Util ──────────────────────────────────────────────────────────────────
  function escHtml(s) {
    if (!s) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function dateStr(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  return {
    renderReminders, renderToday, renderTomorrow, renderCalendar,
    renderCalendarFilter, populateCalendarSelect,
    showDayDetail, showUser, showSignedOut, toast, dateStr,
  };
})();
