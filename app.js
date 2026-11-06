/* Продукты: закупка / готовка / остатки. Все данные — в localStorage. */
(() => {
  'use strict';

  const STORAGE_KEY = 'eatapp.state.v1';
  const UNITS = { g: 'г', ml: 'мл', pcs: 'шт' };

  // Предустановленный список продуктов: название, единица, план закупки, минимальный остаток
  const DEFAULT_PRODUCTS = [
    ['Куриное филе', 'g', 1000, 300],
    ['Говядина', 'g', 1000, 300],
    ['Фарш', 'g', 500, 200],
    ['Рыба', 'g', 600, 200],
    ['Яйца', 'pcs', 20, 6],
    ['Молоко', 'ml', 2000, 500],
    ['Творог', 'g', 600, 200],
    ['Сыр', 'g', 400, 100],
    ['Сметана', 'g', 400, 100],
    ['Масло сливочное', 'g', 200, 50],
    ['Масло растительное', 'ml', 1000, 200],
    ['Рис', 'g', 1000, 300],
    ['Гречка', 'g', 1000, 300],
    ['Макароны', 'g', 1000, 300],
    ['Овсянка', 'g', 1000, 300],
    ['Мука', 'g', 1000, 300],
    ['Сахар', 'g', 1000, 300],
    ['Соль', 'g', 500, 100],
    ['Хлеб', 'pcs', 2, 1],
    ['Картофель', 'g', 2000, 500],
    ['Морковь', 'g', 1000, 300],
    ['Лук', 'g', 1000, 300],
    ['Чеснок', 'pcs', 3, 1],
    ['Помидоры', 'g', 1000, 300],
    ['Огурцы', 'g', 1000, 300],
    ['Капуста', 'g', 1500, 500],
    ['Перец болгарский', 'pcs', 4, 1],
    ['Зелень', 'pcs', 2, 1],
    ['Яблоки', 'g', 1500, 500],
    ['Бананы', 'g', 1000, 300],
    ['Лимон', 'pcs', 2, 1],
    ['Чай', 'g', 200, 50],
    ['Кофе', 'g', 250, 50],
  ];

  // ---------- Состояние ----------

  let state = loadState();
  let screen = 'shop';
  const ui = {
    search: { shop: '', cook: '', stock: '' },
    shopOnlyNeeded: false,
    shopHideTaken: false,
    cookOnlyAvailable: true,
    stockOnlyNeeded: false,
  };
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function makeDefaultProducts() {
    return DEFAULT_PRODUCTS.map(([name, unit, plan, min]) => ({
      id: uid(), name, unit, plan, min, stock: 0, taken: false, takenQty: 0,
    }));
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s && Array.isArray(s.products)) {
          s.history = Array.isArray(s.history) ? s.history : [];
          return s;
        }
      }
    } catch (e) { console.warn('Не удалось прочитать состояние', e); }
    return { version: 1, products: makeDefaultProducts(), history: [] };
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function findProduct(id) {
    return state.products.find(p => p.id === id);
  }

  function addHistory(type, p, qty) {
    state.history.unshift({ id: uid(), type, productId: p.id, name: p.name, qty, unit: p.unit, ts: Date.now() });
    if (state.history.length > 200) state.history.length = 200;
  }

  function isLow(p) { return p.stock > 0 && p.stock <= p.min; }
  function isEmpty(p) { return p.stock <= 0; }
  function needsBuy(p) { return p.stock <= p.min; }

  // ---------- Утилиты ----------

  function fmt(n) {
    if (!isFinite(n)) return '0';
    return Number(n.toFixed(2)).toString().replace('.', ',');
  }
  function fmtQty(n, unit) { return `${fmt(n)} ${UNITS[unit] || unit}`; }
  function fmtDate(ts) {
    const d = new Date(ts);
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) + ' ' +
      d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }
  function parseNum(v) {
    const n = parseFloat(String(v).replace(',', '.'));
    return isFinite(n) ? n : 0;
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function el(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }
  function matches(p, q) {
    return !q || p.name.toLowerCase().includes(q.toLowerCase());
  }
  function sortByName(list) {
    return list.slice().sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }

  // ---------- Toast ----------

  let toastTimer = null;
  function toast(msg, undoFn) {
    const t = document.getElementById('toast');
    t.innerHTML = `<span>${esc(msg)}</span>` + (undoFn ? '<button type="button">Отменить</button>' : '');
    if (undoFn) t.querySelector('button').onclick = () => { undoFn(); hideToast(); };
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, undoFn ? 5000 : 2000);
  }
  function hideToast() { document.getElementById('toast').hidden = true; }

  // ---------- Модальные окна ----------

  function openModal(contentEl) {
    closeModal();
    const root = document.getElementById('modal-root');
    const backdrop = el('<div class="modal-backdrop"></div>');
    const modal = el('<div class="modal"></div>');
    modal.appendChild(contentEl);
    backdrop.appendChild(modal);
    backdrop.addEventListener('click', e => { if (e.target === backdrop) closeModal(); });
    root.appendChild(backdrop);
    const first = modal.querySelector('input[data-autofocus]');
    if (first) { first.focus(); first.select(); }
  }
  function closeModal() {
    document.getElementById('modal-root').innerHTML = '';
  }

  // Окно ввода количества (используется в Закупке и Готовке)
  function qtyModal({ title, hint, unit, initial, quick, confirmText, onConfirm, extraButton }) {
    const step = unit === 'pcs' ? 1 : (unit === 'g' || unit === 'ml' ? 50 : 1);
    const box = el(`
      <div>
        <h2>${esc(title)}</h2>
        ${hint ? `<p class="hint">${esc(hint)}</p>` : ''}
        <div class="qty-row">
          <button type="button" data-step="-1">−</button>
          <input type="number" inputmode="decimal" min="0" step="any" value="${fmt(initial).replace(',', '.')}" data-autofocus />
          <button type="button" data-step="1">+</button>
        </div>
        <div class="quick"></div>
        <div class="modal-actions">
          <button type="button" class="btn secondary" data-act="cancel">Отмена</button>
          ${extraButton ? `<button type="button" class="btn danger" data-act="extra">${esc(extraButton.text)}</button>` : ''}
          <button type="button" class="btn" data-act="ok">${esc(confirmText)} (${UNITS[unit]})</button>
        </div>
      </div>`);
    const input = box.querySelector('input');
    const quickBox = box.querySelector('.quick');
    quick.forEach(q => {
      const b = el(`<button type="button">${fmtQty(q, unit)}</button>`);
      b.onclick = () => { input.value = q; input.focus(); };
      quickBox.appendChild(b);
    });
    box.querySelectorAll('[data-step]').forEach(b => {
      b.onclick = () => {
        const dir = Number(b.dataset.step);
        input.value = Math.max(0, parseNum(input.value) + dir * step);
      };
    });
    const submit = () => {
      const q = parseNum(input.value);
      if (q <= 0) { input.focus(); return; }
      closeModal();
      onConfirm(q);
    };
    box.querySelector('[data-act="ok"]').onclick = submit;
    box.querySelector('[data-act="cancel"]').onclick = closeModal;
    if (extraButton) box.querySelector('[data-act="extra"]').onclick = () => { closeModal(); extraButton.onClick(); };
    input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
    openModal(box);
  }

  function quickValues(p, mode) {
    const set = new Set();
    if (mode === 'buy') {
      set.add(p.plan);
      if (p.min > 0 && p.plan - p.stock > 0) set.add(Math.max(0, p.plan - p.stock));
      set.add(p.plan * 2);
      if (p.unit === 'pcs') [1, 2, 5, 10].forEach(v => set.add(v));
      else [100, 250, 500, 1000].forEach(v => set.add(v));
    } else {
      if (p.unit === 'pcs') [1, 2, 3, 5].forEach(v => set.add(v));
      else [50, 100, 200, 300, 500].forEach(v => set.add(v));
      if (p.stock > 0) set.add(p.stock);
    }
    return [...set].filter(v => v > 0).sort((a, b) => a - b).slice(0, 7);
  }

  // ---------- Действия ----------

  function buy(p, qty) {
    const before = { stock: p.stock, taken: p.taken, takenQty: p.takenQty };
    if (p.taken) p.stock -= p.takenQty; // замена предыдущей отметки в этом походе
    p.stock += qty;
    p.taken = true;
    p.takenQty = qty;
    addHistory('buy', p, qty);
    const histId = state.history[0].id;
    save(); render();
    toast(`Взял ${p.name}: ${fmtQty(qty, p.unit)}`, () => {
      Object.assign(p, before);
      state.history = state.history.filter(h => h.id !== histId);
      save(); render();
    });
  }

  function untake(p) {
    if (!p.taken) return;
    const before = { stock: p.stock, taken: p.taken, takenQty: p.takenQty };
    p.stock -= p.takenQty;
    p.taken = false;
    p.takenQty = 0;
    addHistory('unbuy', p, before.takenQty);
    const histId = state.history[0].id;
    save(); render();
    toast(`Отметка снята: ${p.name}`, () => {
      Object.assign(p, before);
      state.history = state.history.filter(h => h.id !== histId);
      save(); render();
    });
  }

  function use(p, qty) {
    const before = p.stock;
    const actual = Math.min(qty, Math.max(0, p.stock));
    p.stock = Math.max(0, p.stock - qty);
    addHistory('use', p, qty);
    const histId = state.history[0].id;
    save(); render();
    const note = actual < qty ? ' (остаток обнулён)' : '';
    toast(`Использовал ${p.name}: ${fmtQty(qty, p.unit)}${note}`, () => {
      p.stock = before;
      state.history = state.history.filter(h => h.id !== histId);
      save(); render();
    });
  }

  function resetTrip() {
    const any = state.products.some(p => p.taken);
    if (!any) { toast('Отметок нет'); return; }
    if (!confirm('Начать новую закупку? Отметки «взял» будут сняты, остатки сохранятся.')) return;
    state.products.forEach(p => { p.taken = false; p.takenQty = 0; });
    save(); render();
    toast('Новая закупка начата');
  }

  // ---------- Редактор продукта ----------

  function productModal(p) {
    const isNew = !p;
    const d = p || { name: '', unit: 'g', plan: 500, min: 100, stock: 0 };
    const box = el(`
      <div>
        <h2>${isNew ? 'Новый продукт' : 'Редактировать продукт'}</h2>
        <div class="field">
          <label>Название</label>
          <input type="text" name="name" value="${esc(d.name)}" data-autofocus />
        </div>
        <div class="field-row">
          <div class="field">
            <label>Единица</label>
            <select name="unit">
              <option value="g" ${d.unit === 'g' ? 'selected' : ''}>граммы</option>
              <option value="ml" ${d.unit === 'ml' ? 'selected' : ''}>миллилитры</option>
              <option value="pcs" ${d.unit === 'pcs' ? 'selected' : ''}>штуки</option>
            </select>
          </div>
          <div class="field">
            <label>Остаток сейчас</label>
            <input type="number" inputmode="decimal" step="any" min="0" name="stock" value="${d.stock}" />
          </div>
        </div>
        <div class="field-row">
          <div class="field">
            <label>План закупки</label>
            <input type="number" inputmode="decimal" step="any" min="0" name="plan" value="${d.plan}" />
          </div>
          <div class="field">
            <label>Мин. остаток (подсветка)</label>
            <input type="number" inputmode="decimal" step="any" min="0" name="min" value="${d.min}" />
          </div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn secondary" data-act="cancel">Отмена</button>
          ${isNew ? '' : '<button type="button" class="btn danger" data-act="del">Удалить</button>'}
          <button type="button" class="btn" data-act="ok">Сохранить</button>
        </div>
      </div>`);
    const val = n => box.querySelector(`[name="${n}"]`).value;
    box.querySelector('[data-act="cancel"]').onclick = closeModal;
    box.querySelector('[data-act="ok"]').onclick = () => {
      const name = val('name').trim();
      if (!name) { box.querySelector('[name="name"]').focus(); return; }
      const data = {
        name, unit: val('unit'),
        plan: Math.max(0, parseNum(val('plan'))),
        min: Math.max(0, parseNum(val('min'))),
        stock: Math.max(0, parseNum(val('stock'))),
      };
      if (isNew) {
        state.products.push({ id: uid(), ...data, taken: false, takenQty: 0 });
      } else {
        if (data.stock !== p.stock) addHistory('adjust', { ...p, name }, data.stock - p.stock);
        Object.assign(p, data);
      }
      save(); closeModal(); render();
      toast(isNew ? 'Продукт добавлен' : 'Сохранено');
    };
    if (!isNew) {
      box.querySelector('[data-act="del"]').onclick = () => {
        if (!confirm(`Удалить «${p.name}»?`)) return;
        state.products = state.products.filter(x => x.id !== p.id);
        save(); closeModal(); render();
        toast('Продукт удалён');
      };
    }
    openModal(box);
  }

  // ---------- Экспорт / импорт ----------

  function exportJson() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `eatapp-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function importJson() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = () => {
      const f = input.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        try {
          const s = JSON.parse(r.result);
          if (!s || !Array.isArray(s.products)) throw new Error('bad');
          if (!confirm('Заменить все текущие данные импортированными?')) return;
          state = { version: 1, products: s.products, history: Array.isArray(s.history) ? s.history : [] };
          save(); render();
          toast('Данные импортированы');
        } catch { alert('Не удалось прочитать файл'); }
      };
      r.readAsText(f);
    };
    input.click();
  }

  function settingsModal() {
    const box = el(`
      <div>
        <h2>Данные</h2>
        <p class="hint">Все данные хранятся только в этом браузере (localStorage). Сделайте резервную копию перед очисткой браузера.</p>
        <div class="list">
          <button type="button" class="btn secondary block" data-act="export">Экспорт в JSON</button>
          <button type="button" class="btn secondary block" data-act="import">Импорт из JSON</button>
          <button type="button" class="btn secondary block" data-act="clear-hist">Очистить историю операций</button>
          <button type="button" class="btn danger block" data-act="reset">Сбросить к предустановленному списку</button>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn secondary" data-act="cancel">Закрыть</button>
        </div>
      </div>`);
    box.querySelector('[data-act="cancel"]').onclick = closeModal;
    box.querySelector('[data-act="export"]').onclick = () => { closeModal(); exportJson(); };
    box.querySelector('[data-act="import"]').onclick = () => { closeModal(); importJson(); };
    box.querySelector('[data-act="clear-hist"]').onclick = () => {
      if (!confirm('Очистить историю операций? Остатки не изменятся.')) return;
      state.history = []; save(); closeModal(); render();
    };
    box.querySelector('[data-act="reset"]').onclick = () => {
      if (!confirm('Удалить все продукты, остатки и историю и вернуть предустановленный список?')) return;
      state = { version: 1, products: makeDefaultProducts(), history: [] };
      save(); closeModal(); render();
      toast('Список сброшен');
    };
    openModal(box);
  }

  // ---------- Рендер ----------

  function render() {
    const root = document.getElementById('screen');
    const actions = document.getElementById('topbar-actions');
    root.innerHTML = '';
    actions.innerHTML = '';
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.screen === screen));
    const titles = { shop: 'Закупка', cook: 'Готовка', stock: 'Остатки' };
    document.getElementById('screen-title').textContent = titles[screen];
    ({ shop: renderShop, cook: renderCook, stock: renderStock })[screen](root, actions);
  }

  function searchBox(key, placeholder) {
    const inp = el(`<input type="search" placeholder="${placeholder}" value="${esc(ui.search[key])}" />`);
    inp.addEventListener('input', () => {
      ui.search[key] = inp.value;
      renderListOnly();
    });
    return inp;
  }
  function chip(text, active, onClick) {
    const b = el(`<button type="button" class="chip ${active ? 'active' : ''}">${esc(text)}</button>`);
    b.onclick = onClick;
    return b;
  }
  // Перерисовка без потери фокуса в поле поиска
  function renderListOnly() {
    const listEl = document.querySelector('#screen .list-wrap');
    if (!listEl) { render(); return; }
    const fresh = buildList();
    listEl.replaceWith(fresh);
  }
  let buildList = () => document.createElement('div');

  // --- Закупка ---
  function renderShop(root, actions) {
    const resetBtn = el('<button type="button">Новая закупка</button>');
    resetBtn.onclick = resetTrip;
    actions.appendChild(resetBtn);

    const tb = el('<div class="toolbar"></div>');
    tb.appendChild(searchBox('shop', 'Поиск продукта'));
    tb.appendChild(chip('Нужно докупить', ui.shopOnlyNeeded, () => { ui.shopOnlyNeeded = !ui.shopOnlyNeeded; render(); }));
    tb.appendChild(chip('Скрыть взятые', ui.shopHideTaken, () => { ui.shopHideTaken = !ui.shopHideTaken; render(); }));
    root.appendChild(tb);

    buildList = () => {
      const wrap = el('<div class="list-wrap"></div>');
      const q = ui.search.shop;
      let items = state.products.filter(p => matches(p, q));
      if (ui.shopOnlyNeeded) items = items.filter(p => needsBuy(p) || p.taken);
      if (ui.shopHideTaken) items = items.filter(p => !p.taken);
      items = sortByName(items).sort((a, b) => Number(a.taken) - Number(b.taken));

      const taken = state.products.filter(p => p.taken).length;
      wrap.appendChild(el(`<p class="summary">Взято: ${taken} из ${state.products.length}</p>`));

      const list = el('<div class="list"></div>');
      if (!items.length) list.appendChild(el('<div class="empty">Ничего не найдено</div>'));
      items.forEach(p => {
        const cls = ['item', p.taken ? 'done' : '', !p.taken && isEmpty(p) ? 'danger' : '', !p.taken && isLow(p) ? 'warn' : ''].join(' ');
        const row = el(`
          <div class="${cls}">
            <div class="check">${p.taken ? '✓' : ''}</div>
            <div class="item-body">
              <div class="item-name">${esc(p.name)}</div>
              <div class="item-sub">План: <b>${fmtQty(p.plan, p.unit)}</b> · Остаток: ${fmtQty(p.stock, p.unit)}</div>
            </div>
            <div class="item-right">
              ${p.taken ? `<div class="item-qty">+${fmt(p.takenQty)}</div><div class="item-unit">${UNITS[p.unit]}</div>` : ''}
            </div>
          </div>`);
        row.onclick = () => {
          qtyModal({
            title: p.name,
            hint: `План ${fmtQty(p.plan, p.unit)} · сейчас дома ${fmtQty(p.stock, p.unit)}` + (p.taken ? ` · уже отмечено ${fmtQty(p.takenQty, p.unit)}` : ''),
            unit: p.unit,
            initial: p.taken ? p.takenQty : p.plan,
            quick: quickValues(p, 'buy'),
            confirmText: 'Взял',
            onConfirm: qty => buy(p, qty),
            extraButton: p.taken ? { text: 'Снять отметку', onClick: () => untake(p) } : null,
          });
        };
        list.appendChild(row);
      });
      wrap.appendChild(list);
      return wrap;
    };
    root.appendChild(buildList());
  }

  // --- Готовка ---
  function renderCook(root) {
    const tb = el('<div class="toolbar"></div>');
    tb.appendChild(searchBox('cook', 'Поиск продукта'));
    tb.appendChild(chip('Только в наличии', ui.cookOnlyAvailable, () => { ui.cookOnlyAvailable = !ui.cookOnlyAvailable; render(); }));
    root.appendChild(tb);

    buildList = () => {
      const wrap = el('<div class="list-wrap"></div>');
      let items = state.products.filter(p => matches(p, ui.search.cook));
      if (ui.cookOnlyAvailable) items = items.filter(p => p.stock > 0);
      items = sortByName(items);
      const list = el('<div class="list"></div>');
      if (!items.length) list.appendChild(el('<div class="empty">Нет продуктов в наличии.<br>Отметьте покупки в разделе «Закупка».</div>'));
      items.forEach(p => {
        const cls = ['item', isEmpty(p) ? 'danger' : '', isLow(p) ? 'warn' : ''].join(' ');
        const row = el(`
          <div class="${cls}">
            <div class="item-body">
              <div class="item-name">${esc(p.name)}</div>
              <div class="item-sub">В наличии</div>
            </div>
            <div class="item-right">
              <div class="item-qty ${isEmpty(p) ? 'danger' : isLow(p) ? 'warn' : ''}">${fmt(p.stock)}</div>
              <div class="item-unit">${UNITS[p.unit]}</div>
            </div>
          </div>`);
        row.onclick = () => {
          qtyModal({
            title: p.name,
            hint: `В наличии ${fmtQty(p.stock, p.unit)}`,
            unit: p.unit,
            initial: p.unit === 'pcs' ? 1 : 100,
            quick: quickValues(p, 'use'),
            confirmText: 'Использовал',
            onConfirm: qty => use(p, qty),
          });
        };
        list.appendChild(row);
      });
      wrap.appendChild(list);
      return wrap;
    };
    root.appendChild(buildList());
  }

  // --- Остатки ---
  function renderStock(root, actions) {
    const menuBtn = el('<button type="button" aria-label="Данные">⋯</button>');
    menuBtn.onclick = settingsModal;
    actions.appendChild(menuBtn);

    const tb = el('<div class="toolbar"></div>');
    tb.appendChild(searchBox('stock', 'Поиск продукта'));
    tb.appendChild(chip('Нужно докупить', ui.stockOnlyNeeded, () => { ui.stockOnlyNeeded = !ui.stockOnlyNeeded; render(); }));
    root.appendChild(tb);
    root.appendChild(el('<div class="legend"><span class="l-danger">закончилось</span><span class="l-warn">мало (≤ мин.)</span></div>'));

    buildList = () => {
      const wrap = el('<div class="list-wrap"></div>');
      let items = state.products.filter(p => matches(p, ui.search.stock));
      if (ui.stockOnlyNeeded) items = items.filter(needsBuy);
      // Сначала закончившиеся, потом мало, потом остальные
      items = sortByName(items).sort((a, b) => rank(a) - rank(b));
      function rank(p) { return isEmpty(p) ? 0 : isLow(p) ? 1 : 2; }

      const need = state.products.filter(needsBuy).length;
      wrap.appendChild(el(`<p class="summary">Нужно докупить: ${need} из ${state.products.length}</p>`));

      const list = el('<div class="list"></div>');
      if (!items.length) list.appendChild(el('<div class="empty">Ничего не найдено</div>'));
      items.forEach(p => {
        const cls = ['item', isEmpty(p) ? 'danger' : '', isLow(p) ? 'warn' : ''].join(' ');
        const badge = isEmpty(p) ? '<span class="badge danger">Закончилось</span>' : isLow(p) ? '<span class="badge warn">Мало</span>' : '';
        const row = el(`
          <div class="${cls}">
            <div class="item-body">
              <div class="item-name">${esc(p.name)}</div>
              <div class="item-sub">Мин: ${fmtQty(p.min, p.unit)} · План: ${fmtQty(p.plan, p.unit)}</div>
              ${badge}
            </div>
            <div class="item-right">
              <div class="item-qty ${isEmpty(p) ? 'danger' : isLow(p) ? 'warn' : ''}">${fmt(p.stock)}</div>
              <div class="item-unit">${UNITS[p.unit]}</div>
            </div>
          </div>`);
        row.onclick = () => productModal(p);
        list.appendChild(row);
      });
      wrap.appendChild(list);

      if (state.history.length) {
        const hist = el('<div class="history"><h3>Последние операции</h3></div>');
        const labels = { buy: 'Куплено', unbuy: 'Отмена покупки', use: 'Использовано', adjust: 'Корректировка' };
        state.history.slice(0, 30).forEach(h => {
          const sign = h.type === 'buy' ? '+' : h.type === 'use' || h.type === 'unbuy' ? '−' : (h.qty >= 0 ? '+' : '');
          const cls = sign === '+' ? 'plus' : 'minus';
          hist.appendChild(el(`
            <div class="hist-item">
              <div><div>${esc(h.name)} <span class="date">· ${labels[h.type] || h.type}</span></div><div class="date">${fmtDate(h.ts)}</div></div>
              <div class="${cls}">${sign}${fmt(Math.abs(h.qty))} ${UNITS[h.unit] || ''}</div>
            </div>`));
        });
        wrap.appendChild(hist);
      }
      return wrap;
    };
    root.appendChild(buildList());

    const fab = el('<button type="button" class="fab" aria-label="Добавить продукт">+</button>');
    fab.onclick = () => productModal(null);
    root.appendChild(fab);
  }

  // ---------- Инициализация ----------

  document.querySelectorAll('.tab').forEach(t => {
    t.addEventListener('click', () => { screen = t.dataset.screen; closeModal(); render(); });
  });

  // Синхронизация между вкладками
  window.addEventListener('storage', e => { if (e.key === STORAGE_KEY) { state = loadState(); render(); } });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(err => console.warn('SW error', err));
    });
  }

  render();
})();
