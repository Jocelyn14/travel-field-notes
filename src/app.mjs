import {
  buildGoogleMapsSearchUrl,
  cycleReservationStatus,
  normalizePersistedState,
  validateTrips,
} from './core.mjs?v=a11desk6';
import {
  addCustomPlace,
  applyItineraryEdits,
  recalculateDay,
  removePlace,
  reorderPlace,
  restorePlace,
  updatePlaceSchedule,
} from './itinerary.mjs?v=a11desk6';
import { searchPlace } from './search.mjs?v=a11desk6';
import { classifyHorizontalGesture, nextPanelState } from './interaction.mjs?v=a11desk6';
import { renderApp } from './view.mjs?v=a11desk6';

const STORAGE_KEY_PREFIX = 'travel-atlas-state';
const appRoot = new URL('../', import.meta.url);
const requestedTripId = document.documentElement.dataset.tripId;
const root = document.querySelector('#app');
let trips = [];
let state;
let storageKey;
let undoDeletedId = '';
let pointerGesture = null;
let panelState = null;

function readState() {
  try {
    return JSON.parse(localStorage.getItem(storageKey) ?? 'null');
  } catch {
    return null;
  }
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function showToast(message, actionLabel = '') {
  const toast = root.querySelector('.toast');
  if (!toast) return;
  toast.replaceChildren(document.createTextNode(message));
  if (actionLabel) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.action = 'undo-delete';
    button.textContent = actionLabel;
    toast.append(button);
  }
  toast.hidden = false;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => { toast.hidden = true; undoDeletedId = ''; }, actionLabel ? 6000 : 3200);
}

function render({ preserveScroll = false } = {}) {
  const scrollY = window.scrollY;
  root.innerHTML = renderApp(trips, state, navigator.onLine, { standalone: true, assetBase: appRoot.href });
  root.dataset.appReady = 'true';
  root.dataset.activeTrip = state.activeTripId;
  root.setAttribute('aria-busy', 'false');
  activateAppView(viewFromHash(), { updateHash: false, scroll: false });
  if (preserveScroll) window.scrollTo({ top: scrollY });
}

const APP_VIEWS = new Set(['overview', 'itinerary', 'checklist', 'budget']);

function viewFromHash() {
  const target = location.hash.slice(1);
  if (APP_VIEWS.has(target)) return target;
  if (target.startsWith('day-')) return 'itinerary';
  return 'overview';
}

function activateAppView(view, { updateHash = true, scroll = true } = {}) {
  const nextView = APP_VIEWS.has(view) ? view : 'overview';
  root.querySelectorAll('[data-app-view]').forEach((panel) => {
    panel.hidden = panel.dataset.appView !== nextView;
  });
  root.querySelectorAll('[data-app-tab]').forEach((tab) => {
    if (tab.dataset.appTab === nextView) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
  });
  if (updateHash && location.hash !== `#${nextView}`) history.pushState(null, '', `#${nextView}`);
  if (scroll) window.scrollTo({ top: 0, behavior: 'auto' });
}

function commit(options) {
  saveState();
  render(options);
}

function currentTrip() {
  return trips.find((trip) => trip.id === state.activeTripId) ?? trips[0];
}

function recalculateAndStore(date) {
  const trip = currentTrip();
  const editedDay = applyItineraryEdits(trip, state.itinerary).days.find((day) => day.date === date);
  if (!editedDay) return [];
  const result = recalculateDay(editedDay);
  for (const place of result.day.places) {
    state.itinerary = updatePlaceSchedule(state.itinerary, place.id, { time: place.time });
  }
  return result.conflicts;
}

function finishScheduleChange(date, message = '时间已更新，后续弹性行程已自动顺延。') {
  const conflicts = recalculateAndStore(date);
  commit({ preserveScroll: true });
  if (conflicts.length) {
    showToast(`已保留锁定时间，但有 ${conflicts.length} 处行程重叠，请调整停留或交通时间。`);
  } else {
    showToast(message);
  }
}

function movePlace(placeId, date, targetIndex) {
  state.itinerary = reorderPlace(state.itinerary, currentTrip(), date, placeId, targetIndex);
  finishScheduleChange(date, '顺序与时间已重新计算。');
}

function setDeleteRail(item, isOpen) {
  item?.classList.toggle('is-swiped', isOpen);
}

function closeOtherDeleteRails(exceptItem = null) {
  root.querySelectorAll('.timeline-item.is-swiped').forEach((item) => {
    if (item !== exceptItem) setDeleteRail(item, false);
  });
}

function closePlaceEditor() {
  const panel = root.querySelector('[data-panel="place-editor"]');
  if (!panel || panel.hidden) return;
  panel.hidden = true;
  panel.setAttribute('aria-hidden', 'true');
  const backdrop = root.querySelector('[data-panel-backdrop]');
  if (backdrop) backdrop.hidden = true;
  document.body.classList.remove('panel-open');
  const originId = panelState?.originId;
  panelState = nextPanelState(panelState, { type: 'close' });
  if (originId) document.getElementById(originId)?.focus();
}

function openPlaceEditor(date, trigger) {
  const panel = root.querySelector('[data-panel="place-editor"]');
  const form = panel?.querySelector('form');
  if (!panel || !form) return;
  if (!trigger.id) trigger.id = `add-place-${date}`;
  panelState = nextPanelState(panelState, { type: 'open-editor', dayDate: date, originId: trigger.id });
  form.reset();
  form.elements.dayDate.value = date;
  form.dataset.searchResult = '';
  form.querySelector('[data-search-status]').textContent = navigator.onLine
    ? '搜索结果会自动填入下方，所有内容仍可修改。'
    : '当前离线，请手动填写；联网后可使用自动搜索。';
  panel.hidden = false;
  panel.setAttribute('aria-hidden', 'false');
  const backdrop = root.querySelector('[data-panel-backdrop]');
  if (backdrop) backdrop.hidden = false;
  document.body.classList.add('panel-open');
  requestAnimationFrame(() => form.elements.search.focus());
}

function placeEmoji(name = '') {
  if (/寺|神社|temple|shrine/i.test(name)) return '⛩️';
  if (/博物|美术|museum|gallery/i.test(name)) return '🏛️';
  if (/公园|庭园|花园|park|garden/i.test(name)) return '🌿';
  if (/市场|集市|market/i.test(name)) return '🛍️';
  if (/餐厅|咖啡|restaurant|cafe/i.test(name)) return '🍽️';
  return '📍';
}

function closeEveningGuide() {
  const panel = root.querySelector('[data-panel="evening-guide"]');
  if (!panel || panel.hidden) return;
  panel.hidden = true;
  panel.setAttribute('aria-hidden', 'true');
  const backdrop = root.querySelector('[data-evening-backdrop]');
  if (backdrop) backdrop.hidden = true;
  document.body.classList.remove('panel-open');
  const originId = panelState?.originId;
  panelState = nextPanelState(panelState, { type: 'close' });
  if (originId) document.getElementById(originId)?.focus();
}

function selectGuideTab(guide, selectedPage) {
  guide.querySelectorAll('[data-guide-tab]').forEach((tab) => {
    const isSelected = tab.dataset.guideTab === selectedPage;
    tab.setAttribute('aria-selected', String(isSelected));
    tab.tabIndex = isSelected ? 0 : -1;
  });
  guide.querySelectorAll('[data-guide-page]').forEach((page) => {
    const isSelected = page.dataset.guidePage === selectedPage;
    page.setAttribute('aria-hidden', String(!isSelected));
    page.toggleAttribute('inert', !isSelected);
  });
}

function activateGuideTab(tab) {
  const guide = tab.closest('[data-evening-guide-date]');
  const carousel = guide?.querySelector('.guide-carousel');
  const page = guide?.querySelector(`[data-guide-page="${tab.dataset.guideTab}"]`);
  if (!guide || !carousel || !page) return;
  const pageIndex = [...carousel.querySelectorAll('[data-guide-page]')].indexOf(page);
  const previousScrollBehavior = carousel.style.scrollBehavior;
  carousel.style.scrollBehavior = 'auto';
  carousel.scrollLeft = pageIndex * carousel.clientWidth;
  carousel.style.scrollBehavior = previousScrollBehavior;
  selectGuideTab(guide, tab.dataset.guideTab);
}

function moveGuideTabFocus(tab, key) {
  const tabList = tab.closest('[role="tablist"]');
  if (!tabList) return;
  const tabs = [...tabList.querySelectorAll('[data-guide-tab]')];
  const currentIndex = tabs.indexOf(tab);
  let targetIndex = currentIndex;
  if (key === 'Home') targetIndex = 0;
  if (key === 'End') targetIndex = tabs.length - 1;
  if (key === 'ArrowRight') targetIndex = (currentIndex + 1) % tabs.length;
  if (key === 'ArrowLeft') targetIndex = (currentIndex - 1 + tabs.length) % tabs.length;
  tabs.forEach((item, index) => { item.tabIndex = index === targetIndex ? 0 : -1; });
  tabs[targetIndex].focus();
}

function syncGuideTabToCarousel(carousel) {
  if (!carousel.clientWidth) return;
  const pages = [...carousel.querySelectorAll('[data-guide-page]')];
  const pageIndex = Math.max(0, Math.min(pages.length - 1, Math.round(carousel.scrollLeft / carousel.clientWidth)));
  const selectedPage = pages[pageIndex]?.dataset.guidePage;
  const guide = carousel.closest('[data-evening-guide-date]');
  if (guide && selectedPage) selectGuideTab(guide, selectedPage);
}

function openEveningGuide(date, trigger) {
  const panel = root.querySelector('[data-panel="evening-guide"]');
  const guide = panel?.querySelector(`[data-evening-guide-date="${CSS.escape(date)}"]`);
  if (!panel || !guide) return;
  if (!trigger.id) trigger.id = `evening-${date}`;
  panelState = nextPanelState(panelState, { type: 'open-evening', guideDate: date, originId: trigger.id });
  panel.querySelectorAll('[data-evening-guide-date]').forEach((item) => { item.hidden = item !== guide; });
  const carousel = guide.querySelector('.guide-carousel');
  if (carousel) {
    carousel.scrollLeft = 0;
    const firstPage = carousel.querySelector('[data-guide-page]')?.dataset.guidePage;
    if (firstPage) selectGuideTab(guide, firstPage);
  }
  panel.hidden = false;
  panel.setAttribute('aria-hidden', 'false');
  const backdrop = root.querySelector('[data-evening-backdrop]');
  if (backdrop) backdrop.hidden = false;
  document.body.classList.add('panel-open');
  requestAnimationFrame(() => panel.querySelector('[data-action="close-evening"]')?.focus());
}

function updateRate(input) {
  const rate = Number(input.value);
  if (!Number.isFinite(rate) || rate <= 0) {
    showToast('请输入大于 0 的参考汇率。');
    return;
  }
  state.rates[input.dataset.tripId] = rate;
  commit({ preserveScroll: true });
  showToast('人民币参考汇率已保存。');
}

root.addEventListener('click', (event) => {
  const externalLink = event.target.closest('[data-external="true"]');
  if (externalLink && !navigator.onLine) {
    event.preventDefault();
    showToast('当前离线，地图与官网需要联网后打开。');
    return;
  }

  const action = event.target.closest('[data-action]');
  if (!action) return;
  if (action.dataset.action === 'app-tab') {
    event.preventDefault();
    activateAppView(action.dataset.appTab);
    return;
  }
  if (action.dataset.action === 'reservation') {
    const id = action.dataset.reservationId;
    state.reservations[id] = cycleReservationStatus(state.reservations[id] ?? '待预订');
    commit({ preserveScroll: true });
    return;
  }
  if (action.dataset.action === 'budget-entry-delete') {
    state.budgetEntries = state.budgetEntries.filter((entry) => entry.id !== action.dataset.budgetEntryId);
    commit({ preserveScroll: true });
    showToast('这笔支出已删除。');
    return;
  }
  if (action.dataset.action === 'add-place') {
    openPlaceEditor(action.dataset.dayDate, action);
    return;
  }
  if (action.dataset.action === 'open-evening') {
    openEveningGuide(action.dataset.guideDate, action);
    return;
  }
  if (action.dataset.action === 'close-evening') {
    closeEveningGuide();
    return;
  }
  if (action.dataset.action === 'guide-tab') {
    activateGuideTab(action);
    return;
  }
  if (action.dataset.action === 'guide-top') {
    action.closest('[data-evening-guide-date]')?.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  if (action.dataset.action === 'close-editor') {
    closePlaceEditor();
    return;
  }
  if (action.dataset.action === 'todo-delete') {
    state.customTodos = state.customTodos.filter((todo) => todo.id !== action.dataset.itemId);
    commit({ preserveScroll: true });
    showToast('Todo 已删除。');
    return;
  }
  if (action.dataset.action === 'delete-place') {
    undoDeletedId = action.dataset.placeId;
    state.itinerary = removePlace(state.itinerary, undoDeletedId);
    commit({ preserveScroll: true });
    showToast('这条行程已删除。', '撤销');
    return;
  }
  if (action.dataset.action === 'undo-delete' && undoDeletedId) {
    state.itinerary = restorePlace(state.itinerary, undoDeletedId);
    undoDeletedId = '';
    commit({ preserveScroll: true });
    showToast('行程已恢复。');
    return;
  }
  if (action.dataset.action === 'search-place') {
    const form = action.closest('form');
    const status = form.querySelector('[data-search-status]');
    const query = form.elements.search.value.trim();
    if (!navigator.onLine) {
      status.textContent = '当前离线，请先手动填写。';
      return;
    }
    action.disabled = true;
    status.textContent = '正在搜索 Wikipedia、公开地点资料与 Google Maps…';
    searchPlace(query, state.activeTripId).then((result) => {
      for (const field of ['name', 'nameEn', 'nameLocal', 'address', 'note']) form.elements[field].value = result[field] ?? '';
      form.dataset.searchResult = JSON.stringify(result);
      status.textContent = '已自动补全名称、景点简介、地址与图片，请检查后保存。';
    }).catch((error) => {
      status.textContent = error.message;
    }).finally(() => { action.disabled = false; });
  }
});

root.addEventListener('change', (event) => {
  const action = event.target.dataset.action;
  if (action === 'checklist') {
    state.checklist[event.target.dataset.itemId] = event.target.checked;
    commit({ preserveScroll: true });
  }
  if (action === 'custom-todo') {
    const todo = state.customTodos.find((item) => item.id === event.target.dataset.itemId);
    if (todo) todo.checked = event.target.checked;
    commit({ preserveScroll: true });
  }
  if (action === 'rate') updateRate(event.target);
  if (action === 'budget-plan') {
    const amount = Math.max(0, Number(event.target.value) || 0);
    state.budgetPlans[event.target.dataset.budgetItemId] = amount;
    commit({ preserveScroll: true });
    showToast('计划预算已更新。');
  }
  if (['place-time', 'place-duration', 'place-travel', 'place-fixed'].includes(action)) {
    const item = event.target.closest('.timeline-item');
    const placeId = event.target.dataset.placeId;
    const date = item?.dataset.dayDate;
    if (!placeId || !date) return;
    let override;
    if (action === 'place-time') override = { time: event.target.value, timeMode: 'fixed' };
    if (action === 'place-duration') override = { durationMinutes: Math.max(5, Number(event.target.value) || 5) };
    if (action === 'place-travel') override = { travelMinutes: Math.max(0, Number(event.target.value) || 0) };
    if (action === 'place-fixed') override = { timeMode: event.target.checked ? 'fixed' : 'flexible' };
    state.itinerary = updatePlaceSchedule(state.itinerary, placeId, override);
    finishScheduleChange(date);
  }
});

root.addEventListener('keydown', (event) => {
  const guideTab = event.target.closest?.('[data-guide-tab]');
  if (guideTab && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
    event.preventDefault();
    moveGuideTabFocus(guideTab, event.key);
    return;
  }
  if (guideTab && ['Enter', ' ', 'Spacebar'].includes(event.key)) {
    event.preventDefault();
    activateGuideTab(guideTab);
    return;
  }
  if (event.target.dataset.action === 'rate' && event.key === 'Enter') {
    event.preventDefault();
    updateRate(event.target);
  }
  const item = event.target.closest?.('.timeline-item');
  if (item && event.altKey && ['ArrowUp', 'ArrowDown'].includes(event.key)) {
    event.preventDefault();
    const items = [...item.closest('[data-day-timeline]').querySelectorAll('.timeline-item')];
    const currentIndex = items.indexOf(item);
    const targetIndex = currentIndex + (event.key === 'ArrowUp' ? -1 : 1);
    if (targetIndex >= 0 && targetIndex < items.length) movePlace(item.dataset.placeId, item.dataset.dayDate, targetIndex);
  }
  if (item && event.key === 'Delete') {
    event.preventDefault();
    undoDeletedId = item.dataset.placeId;
    state.itinerary = removePlace(state.itinerary, undoDeletedId);
    commit({ preserveScroll: true });
    showToast('这条行程已删除。', '撤销');
  }
});

root.addEventListener('submit', (event) => {
  const todoForm = event.target.closest('[data-action="todo-add"]');
  if (todoForm) {
    event.preventDefault();
    const label = String(new FormData(todoForm).get('label') ?? '').trim();
    if (!label) return;
    state.customTodos.push({ id: `todo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, label, checked: false });
    todoForm.reset();
    commit({ preserveScroll: true });
    showToast('Todo 已添加。');
    return;
  }
  const accommodationForm = event.target.closest('[data-action="accommodation-form"]');
  if (accommodationForm) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(accommodationForm));
    const startDate = accommodationForm.dataset.dayDate;
    const copyThrough = values.copyThrough >= startDate ? values.copyThrough : startDate;
    const stay = {
      name: String(values.name ?? '').trim(),
      address: String(values.address ?? '').trim(),
    };
    if (!stay.name) return;
    stay.maps = buildGoogleMapsSearchUrl(stay.name, stay.address);
    for (const day of currentTrip().days) {
      if (day.date >= startDate && day.date <= copyThrough) state.accommodations[day.date] = { ...stay };
    }
    commit({ preserveScroll: true });
    showToast(startDate === copyThrough ? '住宿信息已保存。' : '住宿信息已复制到所选日期。');
    return;
  }
  const budgetForm = event.target.closest('[data-action="budget-entry-add"]');
  if (budgetForm) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(budgetForm));
    const amount = Number(values.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast('请输入大于 0 的支出金额。');
      return;
    }
    state.budgetEntries.push({
      id: `expense-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      budgetItemId: budgetForm.dataset.budgetItemId,
      amount,
      note: String(values.note ?? '').trim(),
    });
    budgetForm.reset();
    commit({ preserveScroll: true });
    showToast('支出已记录并计入总额。');
    return;
  }
  const form = event.target.closest('[data-action="place-form"]');
  if (!form) return;
  event.preventDefault();
  const values = Object.fromEntries(new FormData(form));
  const searchResult = form.dataset.searchResult ? JSON.parse(form.dataset.searchResult) : {};
  const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const place = {
    id,
    name: values.name.trim(),
    nameEn: values.nameEn.trim(),
    nameLocal: values.nameLocal.trim(),
    category: '自定义',
    time: values.time,
    durationMinutes: Number(values.durationMinutes),
    travelMinutes: Number(values.travelMinutes),
    timeMode: 'flexible',
    address: values.address.trim(),
    cost: 0,
    transit: '请补充前往下一站的交通方式。',
    note: values.note.trim() || '私人兴趣地点，具体安排待补充。',
    culture: values.note.trim() || '这是后续加入的私人兴趣地点。',
    tips: '开放时间、休馆日、票价与预约规则请在出发前再次核对。',
    image: searchResult.image || '',
    imageSource: searchResult.imageSource || '',
    imageFallback: placeEmoji(values.name.trim()),
    imageAlt: `${values.name.trim()}实景图片`,
    links: {
      maps: searchResult.maps || buildGoogleMapsSearchUrl(values.name, values.address),
      official: '',
      booking: '',
    },
  };
  state.itinerary = addCustomPlace(state.itinerary, values.dayDate, place);
  recalculateAndStore(values.dayDate);
  closePlaceEditor();
  commit({ preserveScroll: true });
  showToast('新行程已加入，后续时间已自动顺延。');
});

root.addEventListener('dragstart', (event) => {
  const item = event.target.closest('.timeline-item');
  if (!item) return;
  item.classList.add('is-dragging');
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', item.dataset.placeId);
});

root.addEventListener('dragover', (event) => {
  const item = event.target.closest('.timeline-item');
  if (!item) return;
  event.preventDefault();
  root.querySelectorAll('.is-drop-target').forEach((node) => node.classList.remove('is-drop-target'));
  item.classList.add('is-drop-target');
});

root.addEventListener('drop', (event) => {
  const target = event.target.closest('.timeline-item');
  if (!target) return;
  event.preventDefault();
  const placeId = event.dataTransfer.getData('text/plain');
  const items = [...target.closest('[data-day-timeline]').querySelectorAll('.timeline-item')];
  movePlace(placeId, target.dataset.dayDate, items.indexOf(target));
});

root.addEventListener('dragend', () => {
  root.querySelectorAll('.is-dragging, .is-drop-target').forEach((node) => node.classList.remove('is-dragging', 'is-drop-target'));
});

root.addEventListener('pointerdown', (event) => {
  const item = event.target.closest('.timeline-item');
  if (!item) return;
  pointerGesture = {
    pointerId: event.pointerId,
    item,
    startX: event.clientX,
    startY: event.clientY,
    mode: event.target.closest('[data-action="drag-place"]') ? 'reorder' : 'swipe',
    targetIndex: -1,
  };
  if (pointerGesture.mode === 'reorder') {
    event.preventDefault();
    item.setPointerCapture(event.pointerId);
    item.classList.add('is-dragging');
  }
});

root.addEventListener('click', (event) => {
  if (event.target.matches('[data-panel-backdrop]')) closePlaceEditor();
  if (event.target.matches('[data-evening-backdrop]')) closeEveningGuide();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && panelState?.type === 'editor') {
    event.preventDefault();
    closePlaceEditor();
  }
  if (event.key === 'Escape' && panelState?.type === 'evening') {
    event.preventDefault();
    closeEveningGuide();
  }
});

root.addEventListener('pointermove', (event) => {
  if (!pointerGesture || event.pointerId !== pointerGesture.pointerId) return;
  const dx = event.clientX - pointerGesture.startX;
  const dy = event.clientY - pointerGesture.startY;
  if (pointerGesture.mode === 'swipe') {
    if (dx < -18 && Math.abs(dx) > Math.abs(dy)) event.preventDefault();
    return;
  }
  event.preventDefault();
  const items = [...pointerGesture.item.closest('[data-day-timeline]').querySelectorAll('.timeline-item')];
  pointerGesture.targetIndex = items.findIndex((item) => event.clientY < item.getBoundingClientRect().top + item.getBoundingClientRect().height / 2);
  if (pointerGesture.targetIndex < 0) pointerGesture.targetIndex = items.length - 1;
  items.forEach((item, index) => item.classList.toggle('is-drop-target', index === pointerGesture.targetIndex));
});

root.addEventListener('pointerup', (event) => {
  if (!pointerGesture || event.pointerId !== pointerGesture.pointerId) return;
  const gesture = pointerGesture;
  pointerGesture = null;
  if (gesture.mode === 'reorder') {
    gesture.item.classList.remove('is-dragging');
    root.querySelectorAll('.is-drop-target').forEach((node) => node.classList.remove('is-drop-target'));
    if (gesture.targetIndex >= 0) movePlace(gesture.item.dataset.placeId, gesture.item.dataset.dayDate, gesture.targetIndex);
    return;
  }
  const dx = event.clientX - gesture.startX;
  const dy = event.clientY - gesture.startY;
  const result = classifyHorizontalGesture({ deltaX: dx, deltaY: dy, threshold: dx < 0 ? 52 : 32 });
  if (result === 'reveal') {
    closeOtherDeleteRails();
    setDeleteRail(gesture.item, true);
  } else if (result === 'close') {
    setDeleteRail(gesture.item, false);
  }
});

root.addEventListener('wheel', (event) => {
  const item = event.target.closest?.('.timeline-item');
  if (!item || Math.abs(event.deltaX) <= Math.abs(event.deltaY) || Math.abs(event.deltaX) < 24) return;
  event.preventDefault();
  closeOtherDeleteRails(item);
  setDeleteRail(item, event.deltaX > 0);
}, { passive: false });

root.addEventListener('scroll', (event) => {
  if (event.target.matches?.('.guide-carousel')) syncGuideTabToCarousel(event.target);
}, true);

root.addEventListener('error', (event) => {
  const image = event.target.closest?.('.recommendation-media img, .place-photo img');
  const fallback = image?.closest('.recommendation-media, .place-photo')
    ?.querySelector('[data-media-fallback], .place-photo-fallback');
  if (!image || !fallback) return;
  image.hidden = true;
  image.setAttribute('aria-hidden', 'true');
  fallback.hidden = false;
  fallback.setAttribute('aria-hidden', 'false');
}, true);

window.addEventListener('online', () => render({ preserveScroll: true }));
window.addEventListener('offline', () => render({ preserveScroll: true }));
window.addEventListener('hashchange', () => activateAppView(viewFromHash(), { updateHash: false }));

async function start() {
  try {
    const response = await fetch(new URL('data/trips.json?v=a11desk6', appRoot));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const allTrips = await response.json();
    const validation = validateTrips(allTrips);
    if (!validation.ok) throw new Error(validation.errors.join('\n'));
    const requestedTrip = allTrips.find((trip) => trip.id === requestedTripId);
    if (!requestedTrip) throw new Error('页面没有指定有效的旅行目的地');
    trips = [requestedTrip];
    storageKey = `${STORAGE_KEY_PREFIX}:${requestedTrip.id}`;
    state = normalizePersistedState(readState(), trips);
    saveState();
    render();
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register(new URL('sw.js', appRoot), { scope: appRoot.pathname }).catch(() => {});
    }
  } catch (error) {
    root.setAttribute('aria-busy', 'false');
    root.innerHTML = `<main class="error-screen"><p>TRAVEL ATLAS / ERROR</p><h1>旅行数据暂时无法打开</h1><pre>${String(error.message).replaceAll('&', '&amp;').replaceAll('<', '&lt;')}</pre><button type="button" onclick="location.reload()">重新加载</button></main>`;
  }
}

start();
