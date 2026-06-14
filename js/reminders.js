// Local reminders stored in localStorage
const Reminders = (() => {
  const KEY = 'todo-calendar-reminders';

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; }
    catch { return []; }
  }

  function save(items) {
    localStorage.setItem(KEY, JSON.stringify(items));
  }

  function add(text) {
    const items = load();
    const item = { id: Date.now(), text: text.trim(), createdAt: new Date().toISOString() };
    items.unshift(item);
    save(items);
    return item;
  }

  function remove(id) {
    const items = load().filter(i => i.id !== id);
    save(items);
  }

  function getAll() { return load(); }

  return { add, remove, getAll };
})();
