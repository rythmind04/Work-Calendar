import { dayNumber, monthDays, patternLabel, sharedDays, shiftOn, todayKey, toggleShift } from "./schedule.js";

const byId = id => document.getElementById(id);
const scopePath = new URL("./", location.href).pathname;
const storageKey = "smeny:" + scopePath;
const themeKey = "smeny-theme:" + scopePath;
const monthFormat = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric", timeZone: "UTC" });
const dateFormat = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", weekday: "short", timeZone: "UTC" });
const status = byId("status");
const editor = byId("editor");
const form = byId("profile-form");
const nameField = byId("name");
const startField = byId("start");
const patternField = byId("pattern");
const partnerField = byId("partner");
const daysGrid = byId("days");

let model = { profiles: [], activeId: null };
try {
  const saved = JSON.parse(localStorage.getItem(storageKey));
  if (Array.isArray(saved?.profiles)) model = saved;
} catch {
  status.textContent = "Не удалось прочитать сохранённые графики.";
}

let editingId = null;
let partnerId = null;
let comparing = false;
let year;
let month;

function showMonth(key) {
  year = Number(key.slice(0, 4));
  month = Number(key.slice(5, 7)) - 1;
}
showMonth(todayKey());

function save(message = "") {
  try {
    localStorage.setItem(storageKey, JSON.stringify(model));
    status.textContent = message;
  } catch {
    status.textContent = "Устройство не смогло сохранить изменения. Они доступны до закрытия страницы.";
  }
}

function make(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

const getProfile = id => model.profiles.find(profile => profile.id === id);
const activeProfile = () => getProfile(model.activeId) ?? model.profiles[0];
const formattedDate = key => dateFormat.format(new Date(key + "T00:00:00Z"));

function renderProfiles(active) {
  const list = byId("profiles");
  list.replaceChildren();
  for (const profile of model.profiles) {
    const row = make("div", "profile-row", "");
    const select = make("button", "profile", "");
    select.type = "button";
    select.setAttribute("aria-pressed", String(profile === active));
    select.append(make("span", "profile-name", profile.name), make("span", "cycle", patternLabel(profile.pattern)));
    select.addEventListener("click", () => {
      if (profile.id === partnerId) partnerId = active?.id;
      model.activeId = profile.id;
      save();
      render();
      list.querySelector('[aria-pressed="true"]')?.focus();
    });
    const edit = make("button", "edit", "✎");
    edit.type = "button";
    edit.setAttribute("aria-label", "Изменить график «" + profile.name + "»");
    edit.addEventListener("click", () => openEditor(profile));
    row.append(select, edit);
    list.append(row);
  }
}

function renderPartner(active) {
  const options = model.profiles.filter(profile => profile !== active);
  if (!options.some(profile => profile.id === partnerId)) partnerId = options[0]?.id ?? null;
  partnerField.replaceChildren();
  if (options.length === 0) partnerField.add(new Option("Выберите график", ""));
  for (const profile of options) partnerField.add(new Option(profile.name, profile.id));
  partnerField.value = partnerId ?? "";
  partnerField.disabled = options.length === 0;
  byId("compare").disabled = options.length === 0;
  byId("compare-hint").textContent = options.length === 0 ? "Добавьте два графика, чтобы найти общие выходные." : "";
  if (options.length === 0) comparing = false;
}

function renderResults(active, partner, shared, keys) {
  const visible = Boolean(comparing && active && partner);
  byId("results").hidden = !visible;
  byId("shared-key").hidden = !visible;
  if (!visible) return;
  const names = active.name + " и " + partner.name + ". ";
  const hasUnknown = keys.some(key => shiftOn(active, key) === null || shiftOn(partner, key) === null);
  const summary = shared.size ? "Совпадений за месяц: " + shared.size + "." : "За месяц общих выходных не найдено.";
  byId("results-summary").textContent = names + summary + (hasUnknown ? " Учтены даты, для которых заданы оба графика." : "");
  byId("results-dates").replaceChildren(...Array.from(shared, key => make("li", "", formattedDate(key))));
}

function renderCalendar() {
  const active = activeProfile();
  const partner = getProfile(partnerId);
  const keys = monthDays(year, month);
  const shared = new Set(comparing ? sharedDays(keys, active, partner) : []);
  byId("month-title").textContent = monthFormat.format(new Date(keys[0] + "T00:00:00Z"));
  byId("active-label").textContent = active ? active.name + " · " + patternLabel(active.pattern) : "Календарь";
  byId("prev").disabled = year === 1 && month === 0;
  byId("next").disabled = year === 9999 && month === 11;
  byId("legend").hidden = !active;
  byId("calendar-hint").textContent = active ? "Нажмите на дату, чтобы добавить или снять смену." : "Создайте график, чтобы отметить рабочие дни.";

  const fragment = document.createDocumentFragment();
  const offset = ((dayNumber(keys[0]) + 3) % 7 + 7) % 7;
  for (let i = 0; i < offset; i++) {
    const blank = document.createElement("span");
    blank.setAttribute("aria-hidden", "true");
    fragment.append(blank);
  }

  const today = todayKey();
  for (const [index, key] of keys.entries()) {
    const shift = shiftOn(active, key);
    const manual = active && Object.hasOwn(active.overrides, key);
    const day = make("button", "day " + (shared.has(key) ? "shared" : shift === true ? "work" : shift === false ? "off" : "unknown"), String(index + 1));
    day.type = "button";
    day.dataset.date = key;
    if (today === key) day.setAttribute("aria-current", "date");
    if (manual) day.classList.add("manual");
    const stateLabel = shared.has(key) ? "общий выходной" : shift === true ? "смена" : shift === false ? "выходной" : "график не задан";
    day.setAttribute("aria-label", formattedDate(key) + ", " + stateLabel + (manual ? ", ручная правка" : ""));
    if (active) {
      if (shift !== null) day.setAttribute("aria-pressed", String(shift));
      if (shift === true || shared.has(key)) day.append(make("small", "", shift === true ? "Смена" : "Вместе"));
    } else {
      day.disabled = true;
    }
    fragment.append(day);
  }
  daysGrid.replaceChildren(fragment);
  renderResults(active, partner, shared, keys);
}

function render() {
  const active = activeProfile();
  renderProfiles(active);
  renderPartner(active);
  renderCalendar();
}

function updateStartHint() {
  const weekdays = patternField.value === "5";
  byId("start-label").textContent = weekdays ? "Дата начала графика" : "Первый рабочий день цикла";
  byId("start-hint").textContent = weekdays
    ? "Рабочие дни с понедельника по пятницу, начиная с выбранной даты."
    : "С этой даты начнётся блок рабочих дней.";
}

function openEditor(profile) {
  editingId = profile?.id ?? null;
  byId("editor-title").textContent = profile ? "Изменить график" : "Новый график";
  nameField.value = profile?.name ?? (model.profiles.length === 0 ? "Мой график" : "");
  nameField.setCustomValidity("");
  startField.value = profile?.start ?? todayKey();
  patternField.value = profile?.pattern ?? "2";
  updateStartHint();
  byId("remove").hidden = !profile;
  editor.showModal();
}

nameField.addEventListener("input", () => nameField.setCustomValidity(""));
patternField.addEventListener("change", updateStartHint);
form.addEventListener("submit", event => {
  event.preventDefault();
  const name = nameField.value.trim();
  if (!name) {
    nameField.setCustomValidity("Введите название графика.");
    nameField.reportValidity();
    return;
  }
  const previous = getProfile(editingId);
  const id = previous?.id ?? (globalThis.crypto?.randomUUID?.() ?? String(Date.now()) + Math.random());
  const profile = { id, name, start: startField.value, pattern: Number(patternField.value), overrides: previous?.overrides ?? {} };
  model.profiles = previous ? model.profiles.map(item => item.id === id ? profile : item) : [...model.profiles, profile];
  model.activeId = id;
  comparing = false;
  if (!previous) showMonth(profile.start);
  save("График сохранён.");
  editor.close();
  render();
  byId("profiles").querySelector('[aria-pressed="true"]')?.focus();
});

byId("remove").addEventListener("click", () => {
  const profile = getProfile(editingId);
  if (!profile || !window.confirm("Удалить график «" + profile.name + "» и его ручные правки?")) return;
  model.profiles = model.profiles.filter(item => item.id !== profile.id);
  model.activeId = activeProfile()?.id ?? null;
  comparing = false;
  save("График удалён.");
  editor.close();
  render();
  byId("add").focus();
});

byId("add").addEventListener("click", () => openEditor());
byId("close").addEventListener("click", () => editor.close());

daysGrid.addEventListener("click", event => {
  const day = event.target.closest("[data-date]");
  const active = activeProfile();
  if (!day || !active) return;
  const key = day.dataset.date;
  const updated = toggleShift(active, key);
  model.profiles = model.profiles.map(profile => profile === active ? updated : profile);
  save(shiftOn(updated, key) ? "Смена добавлена." : "Смена снята.");
  renderCalendar();
  daysGrid.querySelector('[data-date="' + key + '"]')?.focus({ preventScroll: true });
});

function moveMonth(delta) {
  month += delta;
  if (month < 0) { year--; month = 11; }
  if (month > 11) { year++; month = 0; }
  renderCalendar();
}

byId("prev").addEventListener("click", () => moveMonth(-1));
byId("next").addEventListener("click", () => moveMonth(1));
byId("today").addEventListener("click", () => { showMonth(todayKey()); renderCalendar(); });
partnerField.addEventListener("change", () => { partnerId = partnerField.value; renderCalendar(); });
byId("compare").addEventListener("click", () => {
  comparing = true;
  renderCalendar();
  byId("results").scrollIntoView({ block: "nearest" });
});
byId("clear").addEventListener("click", () => {
  comparing = false;
  renderCalendar();
  byId("compare").focus();
});

const themeToggle = byId("theme-toggle");
if (themeToggle) {
  const root = document.documentElement;
  themeToggle.setAttribute("aria-pressed", String(root.dataset.theme === "dark"));
  themeToggle.addEventListener("click", () => {
    const theme = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = theme;
    themeToggle.setAttribute("aria-pressed", String(theme === "dark"));
    try {
      localStorage.setItem(themeKey, theme);
    } catch {
      status.textContent = "Тема сохранится до закрытия страницы.";
    }
  });
}

render();
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js")
    .then(() => navigator.serviceWorker.ready)
    .then(() => { byId("offline").hidden = false; })
    .catch(error => console.warn("Не удалось подготовить офлайн-режим", error));
}
