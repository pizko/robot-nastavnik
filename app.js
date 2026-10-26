// Робот-наставник — кабинет (статичный MVP). Данные: data/data.json (выгрузка tools/export_mvp.py).
// Логика и данные прежние; здесь — представление, навигация, взаимодействия.

/* ============ утилиты ============ */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const app = $("#app");
const MINUS = "−";
const reduce = matchMedia("(prefers-reduced-motion: reduce)");
const fmt = (x, d = 0) => x == null || Number.isNaN(Number(x)) ? "—"
  : Number(x).toLocaleString("ru-RU", { minimumFractionDigits: d, maximumFractionDigits: d }).replace("-", MINUS);
const sfmt = (x, d = 1) => x == null ? "—" : (x > 0 ? "+" : "") + fmt(x, d);   // со знаком
const rub = (x, d = 0) => x == null ? "—" : `${fmt(x, d)} ₽`;
const pct = (x, d = 1) => x == null ? "—" : `${fmt(x, d)}%`;
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const dtm = (iso) => new Date(iso).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const tm = (iso) => new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
const ico = (id, cls = "") => `<svg class="${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
const ls = { get: (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

/* ============ глоссарий: наведение мышью, касание на тач-экране ============ */
const GLOSS = {
  "SMA": "Скользящая средняя — средняя цена за N дней. Сглаживает шум. Быстрая (8 дней) выше медленной (24 дня) — признак восходящего тренда.",
  "пробой": "Цена закрылась выше максимума за последние 55 дней. Часто означает начало нового движения, но бывают ложные пробои.",
  "моментум": "Насколько цена выросла или упала за последние дни. Сильный моментум — уверенный сигнал.",
  "RSI": "Индекс относительной силы (0–100). Выше 70 — бумага «перегрета» ростом, ниже 30 — «перепродана».",
  "ML": "Модель машинного обучения оценивает вероятность роста цены за 3 дня по истории похожих ситуаций. 50% — монетка.",
  "волатильность": "Насколько сильно цена скачет день ко дню. Чем выше, тем меньше робот вкладывает в бумагу.",
  "лот": "Минимальная порция бумаги на бирже. У GAZP лот — 10 акций, у LKOH — 1.",
  "комиссия": "Плата брокеру за сделку, процент от объёма. На маленьком счёте может съесть всю прибыль.",
  "проскальзывание": "Разница между ценой, которую видели, и ценой, по которой реально исполнилось.",
  "стоп-лосс": "Автоматическая продажа, если цена упала на заданный процент от покупки. Ограничивает убыток.",
  "тейк-профит": "Автоматическая продажа при росте на заданный процент — фиксация прибыли.",
  "трейлинг": "Стоп, который подтягивается за ценой: чем выше выросла бумага, тем выше уровень выхода.",
  "шорт": "Продажа бумаг, которых нет, в расчёте откупить дешевле. Убыток не ограничен. Робот шорт не делает.",
  "корреляция": "Бумаги, которые ходят вместе (например, нефтяные). Робот не кладёт слишком много денег в одну «тему».",
  "просадка": "Падение стоимости портфеля от его максимума. Главная мера риска.",
  "режим рынка": "Растёт ли рынок в целом (выше 100-дневной средней). В падающем рынке робот не открывает новые покупки.",
  "Sharpe": "Доходность на единицу риска. Выше 1 — хорошо, около 0 — доходность не окупает колебания.",
  "paper-счёт": "Учебный счёт: сделки по настоящим ценам, но без настоящих денег.",
};
const T = (word, label = word) => `<button type="button" class="term-b term" data-term="${esc(word)}">${esc(label)}</button>`;
const pop = $("#tip");
let popFor = null;
function place(el, x, y) {
  pop.hidden = false;
  const w = pop.offsetWidth, h = pop.offsetHeight;
  let left = Math.min(window.innerWidth - w - 12, Math.max(12, x));
  let top = y + 10;
  if (top + h > window.innerHeight - 12) top = Math.max(12, y - h - 34);
  pop.style.left = left + "px"; pop.style.top = top + "px";
}
function showTerm(el) {
  const text = GLOSS[el.dataset.term]; if (!text) return;
  pop.innerHTML = `<b>${esc(el.dataset.term)}</b>${esc(text)}`;
  const r = el.getBoundingClientRect();
  place(el, r.left, r.bottom);
  popFor = el;
}
function hidePop() { pop.hidden = true; popFor = null; }
document.addEventListener("pointerover", (e) => { if (e.pointerType === "mouse") { const t = e.target.closest(".term"); if (t) showTerm(t); else if (popFor) hidePop(); } });
document.addEventListener("click", (e) => {
  const t = e.target.closest(".term");
  if (t) { e.preventDefault(); e.stopPropagation(); popFor === t && !pop.hidden ? hidePop() : showTerm(t); return; }
  if (!e.target.closest("#tip")) hidePop();
});
document.addEventListener("focusin", (e) => { const t = e.target.closest(".term"); if (t) showTerm(t); });
document.addEventListener("focusout", (e) => { if (e.target.closest(".term")) hidePop(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") hidePop(); });
addEventListener("scroll", () => { if (popFor) hidePop(); }, { passive: true });

/* ============ уведомления ============ */
const toastEl = $("#toast");
function toast(msg, icon = "info") {
  toastEl.innerHTML = `${ico(icon)}<span>${msg}</span>`;
  toastEl.classList.add("show");
  clearTimeout(toast.h); toast.h = setTimeout(() => toastEl.classList.remove("show"), 3200);
}

/* ============ тема ============ */
const root = document.documentElement;
function isDark() { return root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches; }
$("#theme").addEventListener("click", () => {
  root.dataset.theme = isDark() ? "light" : "dark"; ls.set("theme", root.dataset.theme);
  $$('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", isDark() ? "#0B0C0F" : "#F5F5F7"));
  redrawCharts();
});

/* ============ режим доверия ============ */
const MODES = {
  observe: { name: "Наблюдение", short: "Робот предлагает — решаете вы",
    items: ["Каждую сделку робот присылает на подтверждение", "В карточке появляются кнопки «Подтвердить» и «Отклонить»", "Демо: подтверждение ничего не отправляет брокеру"] },
  autopilot: { name: "Автопилот", short: "Робот торгует сам в рамках страховки",
    items: ["Сделки проходят проверки и исполняются без вашего участия", "Лента показывает каждое решение с объяснением", "«Стоп-всё» останавливает новые сделки"] },
  paper: { name: "Учебный", short: "Тот же робот, счёт без денег",
    items: ["Сделки по реальным ценам МосБиржи, деньги условные", "Можно соревноваться с роботом в «Дуэли»", "Сейчас весь кабинет работает на учебном счёте"] },
};
let trust = MODES[ls.get("trust")] ? ls.get("trust") : "autopilot";
function paintMode() { $("#modePill").textContent = MODES[trust].name; }
paintMode();

/* ============ шапка: прозрачность и индикатор раздела ============ */
const bar = $("#bar");
const onScroll = () => bar.classList.toggle("scrolled", scrollY > 4);
addEventListener("scroll", onScroll, { passive: true }); onScroll();
function moveNav(tab) {
  const nav = $(".nav"), ind = $(".nav-ind"), a = nav && $(`a[data-tab="${tab}"]`, nav);
  if (!a || !nav.offsetParent) return;
  ind.style.width = a.offsetWidth + "px";
  ind.style.transform = `translateX(${a.offsetLeft}px)`;
}
function segInd(seg) {
  const on = $('[aria-checked="true"], [aria-pressed="true"]', seg); let ind = $(".seg-ind", seg);
  if (!ind) { ind = document.createElement("span"); ind.className = "seg-ind"; ind.setAttribute("aria-hidden", "true"); seg.prepend(ind); }
  if (!on) { ind.style.width = "0"; return; }
  ind.style.width = on.offsetWidth + "px"; ind.style.transform = `translateX(${on.offsetLeft - 3}px)`;
}

/* ============ данные: загрузка, ошибки, обновления ============ */
let D = null, loadError = null;
const seen = new Set();
const load = () => fetch(`data/data.json?t=${Date.now()}`, { cache: "no-store" }).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); });
function sessionOpen(now = new Date()) {
  const msk = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Moscow" }));
  const m = msk.getHours() * 60 + msk.getMinutes(), wd = msk.getDay();
  return wd >= 1 && wd <= 5 && m >= 10 * 60 + 5 && m <= 18 * 60 + 35;
}
// Статус честно говорит о свежести выгрузки, а не о «потоке котировок»
function paintStatus() {
  const st = $("#status"), t = $(".status-t", st);
  if (!D) { st.dataset.s = loadError ? "error" : ""; t.textContent = loadError ? "Нет данных" : "Загрузка…"; return; }
  const ago = Math.max(0, Math.round((Date.now() - new Date(D.generated)) / 60000));
  const when = ago < 1 ? "только что" : ago < 60 ? `${ago} мин назад` : dtm(D.generated);
  const open = sessionOpen();
  st.dataset.s = loadError ? "error" : open && ago <= 20 ? "fresh" : "stale";
  t.textContent = loadError ? `Нет связи · данные от ${dtm(D.generated)}` : open ? `Обновлено ${when}` : "Биржа закрыта";
  st.title = `Данные учебного счёта обновлены ${dtm(D.generated)}. Выгрузка — каждые 5 минут в часы торгов МосБиржи (10:05–18:35 МСК); это не поток котировок в реальном времени.`;
  $("#gen").textContent = `Данные учебного счёта: ${dtm(D.generated)} · ${open ? "торговая сессия идёт, выгрузка каждые 5 минут" : "биржа закрыта, следующая выгрузка в часы торгов"}`;
}
async function boot() {
  skeleton();
  try { D = await load(); loadError = null; D.cards.forEach((c) => seen.add(c.id)); }
  catch (e) { loadError = e; }
  paintStatus();
  if (!D) return errorView();
  route();
}
setInterval(async () => {
  if (!D) return;
  try {
    const fresh = await load(); loadError = null;
    if (fresh.generated !== D.generated) {
      const added = fresh.cards.filter((c) => !seen.has(c.id)); added.forEach((c) => seen.add(c.id));
      D = fresh;
      if (/^#\/(feed)?$/.test(location.hash || "#/feed")) route({ keepScroll: true, quiet: true });
      if (added.length) toast(`Новых решений робота: ${added.length}`, "spark");
    }
  } catch (e) { loadError = e; }
  paintStatus();
}, 60000);
setInterval(paintStatus, 30000);

function skeleton() {
  app.innerHTML = `<div class="wrap" aria-busy="true"><div class="skel" style="height:22px;width:180px"></div>
    <div class="skel" style="height:48px;width:min(520px,90%);margin-top:14px"></div>
    <div class="bento" style="margin-top:28px"><div class="card hero-card skel" style="height:260px"></div><div class="card metric skel" style="height:122px"></div><div class="card metric skel" style="height:122px"></div></div></div>`;
}
function errorView() {
  app.innerHTML = `<div class="wrap"><div class="card empty" role="alert"><div class="e-ic">${ico("warn")}</div>
    <b>Не удалось загрузить данные</b><p>Проверьте соединение и попробуйте ещё раз. Ничего не потеряно — данные хранятся на сервере.</p>
    <button class="btn primary" id="retry">Повторить</button></div></div>`;
  $("#retry").onclick = boot;
}

/* ============ смысловые преобразования (из фактических значений карточки) ============ */
const RULES_RU = {
  "quote.stale": "котировка устарела", "order.amount_limit": "сумма больше лимита на сделку",
  "concentration.instrument": "доля бумаги выше лимита", "concentration.issuer": "доля эмитента выше лимита",
  "cash.insufficient": "не хватает денег", "position.insufficient": "продажа больше, чем есть",
  "data.freshness": "данные несвежие", "price.not_guaranteed": "цена исполнения не гарантирована",
};
const ruleRu = (id) => RULES_RU[id] || id;
const STATUS = {
  done: { cls: "done", icon: "check", label: "Исполнено" },
  block: { cls: "block", icon: "stop", label: "Остановлено проверкой" },
  skip: { cls: "skip", icon: "skip", label: "Не вошёл" },
  wait: { cls: "wait", icon: "wait", label: "Ждёт вашего решения" },
};
function statusOf(c) {
  if (c.status === "blocked") return "block";
  if (c.status === "skipped" || !c.execution) return "skip";
  return trust === "observe" ? "wait" : "done";
}
const pill = (k) => { const s = STATUS[k]; return `<span class="pill ${s.cls}">${ico(s.icon)}${s.label}</span>`; };
function humanSignal(c) {
  const parts = [], s = c.signal || "";
  if (/пробой/.test(s)) parts.push(`цена ${T("пробой", "пробила")} максимум за 55 дней`);
  if (/пересёк slow вверх/.test(s)) parts.push(`быстрая ${T("SMA", "средняя")} пересекла медленную снизу вверх`);
  if (/тренд по SMA/.test(s)) parts.push(`идёт восходящий тренд: быстрая ${T("SMA", "средняя")} выше медленной`);
  const ml = (c.votes || []).find((v) => v.layer === "ML");
  if (ml) parts.push(`${T("ML")} оценивает вероятность роста в ${fmt(ml.value * 100)}%${ml.value < 0.5 ? " — скорее против, но вход не запрещает" : ""}`);
  return parts.length ? parts.join("; ") : esc(s);
}
function humanRisk(c) {
  const r = c.risk || ""; let m;
  if ((m = r.match(/уже (\d+)% портфеля в коррелированных/))) return `уже ${m[1]}% портфеля в бумагах, которые ходят вместе с этой (${T("корреляция")}), лимит — ${D.limits.max_cluster_exposure_pct}%`;
  if ((m = r.match(/объём (\d+) меньше минимальной позиции/))) return `на неё осталось бы только ${rub(m[1])} — меньше минимальной позиции ${D.limits.min_position_pct}% портфеля`;
  if ((m = r.match(/бюджет (\d+) < стоимости лота (\d+)/))) return `свободный лимит ${rub(m[1])} меньше цены одного ${T("лот", "лота")} (${rub(m[2])})`;
  if (/кулдаун/.test(r)) return "по этой бумаге уже была сделка меньше часа назад — робот не дёргается";
  if (/режим рынка/.test(r)) return `рынок в целом падает (${T("режим рынка")}) — новые покупки на паузе`;
  if (/пауза на входы/.test(r)) return `после трёх ${T("стоп-лосс", "стоп-лоссов")} подряд робот берёт паузу`;
  if (/фильтр сделок/.test(r)) return "модель качества сделок оценивает шанс успеха как низкий";
  if (/Перед сделкой/.test(r)) return "заявку остановили проверки перед сделкой";
  return esc(r);
}
const latestState = () => D.cards.find((c) => c.after) || null;

/* ============ счётчики ============ */
function countUp(el) {
  const to = Number(el.dataset.to), d = Number(el.dataset.d || 0), suf = el.dataset.suf || "";
  if (reduce.matches || !Number.isFinite(to)) { el.textContent = fmt(to, d) + suf; return; }
  const t0 = performance.now(), dur = 700, from = to * 0.92;
  const step = (t) => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    el.textContent = fmt(from + (to - from) * e, d) + suf; if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
const cu = (v, d = 0, suf = "") => `<span class="cu" data-to="${v}" data-d="${d}" data-suf="${esc(suf)}">${fmt(v, d)}${suf}</span>`;

/* ============ Лента ============ */
let feedFilter = "all";
function viewFeed() {
  const st = latestState();
  const total = st?.after?.total, cash = st?.after?.cash;
  const start = 1_000_000, delta = total != null ? total - start : null;
  const exec = D.cards.filter((c) => c.execution), blocked = D.cards.filter((c) => c.status === "blocked"), skipped = D.cards.filter((c) => c.status === "skipped");
  const positions = (st?.after?.positions || []).slice().sort((a, b) => b.value - a.value);
  const colors = ["var(--s1)", "var(--s2)", "var(--s3)"];
  const shown = positions.slice(0, 3), rest = positions.slice(3);
  const segs = [...shown.map((p, i) => ({ name: p.ticker, value: p.value, share: p.share, color: colors[i] })),
    ...(rest.length ? [{ name: rest.length === 1 ? rest[0].ticker : `Другие (${rest.length})`, value: rest.reduce((s, p) => s + p.value, 0), share: rest.reduce((s, p) => s + p.share, 0), color: "var(--s-other)" }] : []),
    ...(cash != null && total ? [{ name: "Деньги", value: cash, share: cash / total * 100, color: "var(--s-cash)", cash: true }] : [])];
  const open = sessionOpen();
  const ago = Math.round((Date.now() - new Date(D.generated)) / 60000);

  app.innerHTML = `<div class="wrap enter">
    <section class="hello" style="--i:0" aria-labelledby="hello-t">
      <div>
        <div class="eyebrow">Учебный портфель · ${T("paper-счёт")}</div>
        <h1 class="h-xl" id="hello-t" style="margin-top:8px">Ваш портфель.<br>Под контролем.</h1>
        <p class="lead">Робот торгует на учебном счёте по ценам МосБиржи и объясняет каждое решение — даже когда решает ничего не делать.</p>
      </div>
      <a class="robot-state" href="#/safety" aria-label="Режим робота: ${MODES[trust].name}. Изменить в Страховке">
        <span class="rs-ic">${ico("spark")}</span>
        <span><b>${MODES[trust].name}</b><span>${localStorage.getItem("stopall") === "1" ? "Новые сделки остановлены вами" : MODES[trust].short}</span></span>
      </a>
    </section>

    <section class="bento" aria-label="Сводка портфеля">
      <article class="card hero-card" style="--i:1">
        <div class="pf-top"><span class="eyebrow">Стоимость портфеля</span><span class="tag paper">Учебный · без реальных денег</span></div>
        ${total != null ? `
        <div class="pf-val num" aria-label="${fmt(total)} рублей">${cu(total)}<small>₽</small></div>
        <div class="pf-delta ${delta >= 0 ? "pos" : "neg"}">${delta >= 0 ? "▲" : "▼"} ${sfmt(delta, 0)} ₽ · ${sfmt(delta / start * 100, 2)}% <span class="muted pf-since">с начала · старт 1 000 000 ₽</span></div>
        <div class="alloc">
          <div class="alloc-bar" role="img" aria-label="Структура: ${segs.map((s) => `${s.name} ${fmt(s.share, 1)}%`).join(", ")}">
            ${segs.map((s, i) => `<span style="--i:${i};width:${Math.max(0.6, s.share)}%;background:${s.color}"></span>`).join("")}
          </div>
          <div class="alloc-legend">${segs.map((s) => `<div><i style="background:${s.color}${s.cash ? ";box-shadow:inset 0 0 0 1px var(--hair)" : ""}"></i><b>${esc(s.name)}</b><em>${fmt(s.share, 1)}%</em><small>${rub(s.value)}</small></div>`).join("")}</div>
          <p class="note" style="margin-top:14px">Состав на момент последнего решения робота, ${dtm(st.ts)}.</p>
        </div>` : `<div class="empty"><b>Портфель ещё не сформирован</b><p>Робот пока не совершал сделок.</p></div>`}
      </article>
      <article class="card metric" style="--i:2">
        <span class="m-l">Свободные деньги</span>
        <span class="m-v">${cash != null ? cu(cash, 0, " ₽") : "—"}</span>
        <span class="m-h">${total ? `${fmt(cash / total * 100, 1)}% портфеля · в бумагах не больше ${D.limits.max_total_exposure_pct}%` : ""}</span>
      </article>
      <article class="card metric" style="--i:3">
        <span class="m-l">${ico("check", "")} Сделок</span>
        <span class="m-v">${cu(exec.length)}</span>
        <span class="m-h">каждая — с разбором решения</span>
      </article>
      <article class="card metric" style="--i:4">
        <span class="m-l">Остановлено проверкой</span>
        <span class="m-v">${cu(blocked.length)}</span>
        <span class="m-h">второй контур риска сказал «нет»</span>
      </article>
      <article class="card metric" style="--i:5">
        <span class="m-l">Не вошёл</span>
        <span class="m-v">${cu(skipped.length)}</span>
        <span class="m-h">сигнал был, но робот воздержался</span>
      </article>
      <article class="card metric m-data" style="--i:6">
        <span class="m-l">Данные</span>
        <span class="m-v" style="font-size:22px;padding-top:6px">${ago < 60 ? `${ago} мин назад` : dtm(D.generated)}</span>
        <span class="m-h">${open ? "торги идут · выгрузка каждые 5 минут" : "биржа закрыта"}</span>
      </article>
    </section>

    <section aria-labelledby="tl-t" style="--i:7;margin-top:40px">
      <div class="sec-head">
        <div><h2 class="h-lg" id="tl-t">Решения робота</h2><p class="note" style="margin-top:6px">Каждое решение — с объяснением. Отказы тоже: это половина обучения.</p></div>
        <div class="seg full" role="radiogroup" aria-label="Фильтр решений" id="ff">
          ${[["all", "Все", D.cards.length], ["trades", "Сделки", exec.length], ["blocked", "Остановлены", blocked.length], ["skipped", "Пропущены", skipped.length]]
            .map(([k, l, n]) => `<button role="radio" data-f="${k}" aria-checked="${feedFilter === k}">${l} <span class="muted num">${n}</span></button>`).join("")}
        </div>
      </div>
      <div class="tl" id="tl">${timeline()}</div>
    </section>
  </div>`;
  $$(".cu", app).forEach(countUp);
  const ff = $("#ff"); segInd(ff);
  $$("button", ff).forEach((b) => b.addEventListener("click", () => {
    feedFilter = b.dataset.f; $$("button", ff).forEach((x) => x.setAttribute("aria-checked", x === b)); segInd(ff);
    const tl = $("#tl"); tl.innerHTML = timeline(); tl.classList.remove("fade"); void tl.offsetWidth; tl.classList.add("fade");
  }));
  ff.addEventListener("keydown", radioKeys);
}
function timeline() {
  const raw = D.cards.filter((c) => feedFilter === "all" || (feedFilter === "trades" ? c.execution : feedFilter === "blocked" ? c.status === "blocked" : c.status === "skipped"));
  if (!raw.length) return `<div class="card empty"><div class="e-ic">${ico("feed")}</div><b>Здесь пока пусто</b><p>Под этот фильтр решений нет. Робот записывает каждое действие — загляните позже.</p></div>`;
  // одинаковые отказы одного цикла схлопываем, ничего не теряя: остальные — в раскрывающемся списке
  const list = [], groups = {};
  for (const c of raw) {
    if (c.status !== "skipped") { list.push(c); continue; }
    const key = c.ts.slice(0, 15) + "|" + (c.risk || "").replace(/[\d.,:]+/g, "N");
    if (groups[key]) { groups[key].more.push(c); continue; }
    groups[key] = { ...c, more: [] }; list.push(groups[key]);
  }
  let lastDay = "";
  const today = new Date().toDateString();
  return list.map((c, i) => {
    const day = new Date(c.ts).toDateString();
    const head = day !== lastDay ? `<div class="day">${day === today ? "Сегодня" : new Date(c.ts).toLocaleDateString("ru-RU", { day: "numeric", month: "long", weekday: "long" })}</div>` : "";
    lastDay = day;
    const k = statusOf(c), s = STATUS[k];
    const act = c.execution ? `${c.side === "buy" ? "Купил" : "Продал"} ${fmt(c.lots)} лот. на ${rub(c.execution.amount)}`
      : c.status === "blocked" ? `Хотел купить ${fmt(c.lots)} лот. — остановлено` : "Хотел купить — не стал";
    const why = c.status === "skipped" ? humanRisk(c) : c.status === "blocked" ? `Проверки: ${(c.blocking || []).map(ruleRu).join(", ")}` : humanSignal(c);
    return `${head}<article class="tl-item" style="--i:${Math.min(i, 8)}">
      <div class="tl-ic ${s.cls}">${ico(s.icon)}</div>
      <div class="tl-main">
        <div class="tl-top"><a class="tl-link tl-tk" href="#/card/${c.id}">${esc(c.ticker)}</a><span class="tl-nm">${esc(c.name)}</span></div>
        <div class="tl-act">${act}</div>
        <div class="tl-why">${why}</div>
        ${c.more?.length ? `<details class="more"><summary>${ico("chev")}И ещё ${c.more.length} бумаг по той же причине</summary>
          <div class="chips">${c.more.map((m) => `<a href="#/card/${m.id}">${esc(m.ticker)}</a>`).join("")}</div></details>` : ""}
      </div>
      <div class="tl-side">${pill(k)}<span class="tl-time">${tm(c.ts)}</span><span class="tl-go" aria-hidden="true">${ico("chev")}</span></div>
    </article>`;
  }).join("");
}
function radioKeys(e) {
  if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return;
  const btns = $$("button", e.currentTarget), i = btns.indexOf(document.activeElement); if (i < 0) return;
  const n = btns[(i + (e.key === "ArrowRight" ? 1 : btns.length - 1)) % btns.length]; n.focus(); n.click(); e.preventDefault();
}

/* ============ Карточка решения ============ */
function factorRow(v) {
  // шкала от «против» (−1) через нейтраль к «за» (+1); вес — как в decision.combine
  let x, label;
  if (v.layer === "техника") { x = 1; label = "сигнал на покупку"; }
  else if (v.layer === "ML") { x = (v.value - 0.5) * 2; label = `${fmt(v.value * 100)}% вероятность роста`; }
  else { x = Math.max(-1, Math.min(1, v.value)); label = `тональность ${sfmt(v.value, 2)}`; }
  const w = Math.abs(x) * 50, neg = x < 0;
  const name = v.layer === "техника" ? T("SMA", "Техника") : v.layer === "ML" ? T("ML") : "Новости";
  return `<div class="factor"><div class="f-n">${name}<small>${label}</small></div>
    <div class="scale-wrap"><div class="scale" role="img" aria-label="${esc(v.layer)}: ${neg ? "против" : x === 0 ? "нейтрально" : "за"}, ${esc(label)}">
      <span class="mid"></span><span class="fill ${neg ? "neg" : ""}" style="${neg ? `left:${50 - w}%;--o:right` : "left:50%"};width:${w}%"></span></div>
      <div class="scale-lbl"><span>против</span><span>нейтрально</span><span>за</span></div></div>
    <div class="f-w">вес<b>${fmt(v.weight, 1)}</b></div></div>`;
}
function viewCard(id) {
  const c = D.cards.find((x) => String(x.id) === id);
  if (!c) {
    app.innerHTML = `<div class="wrap enter"><a class="back" href="#/feed">${ico("back")}Лента</a><div class="card empty"><div class="e-ic">${ico("info")}</div><b>Решение не найдено</b><p>Возможно, ссылка устарела.</p><a class="btn" href="#/feed">Вернуться в ленту</a></div></div>`;
    return;
  }
  const k = statusOf(c), ex = c.execution;
  const tech = (c.votes || []).find((v) => v.layer === "техника")?.details || {};
  const stages = [
    ["Сигнал", "on"], ["Анализ", "on"],
    ["Проверки", c.status === "skipped" || c.status === "blocked" ? "bad" : "on"],
    ["Решение", ex ? "on" : "bad"], ["Результат", ex ? "on" : "off"],
  ];
  const sum = ex ? `Робот ${c.side === "buy" ? "купил" : "продал"} <b>${fmt(c.trade?.qty)} шт.</b> (${fmt(c.lots)} ${T("лот", "лот.")}) по <b>${rub(ex.price, 2)}</b> на сумму <b>${rub(ex.amount)}</b>.`
    : c.status === "blocked" ? `Робот хотел купить ${fmt(c.lots)} лот., но проверки перед сделкой его остановили: <b>${(c.blocking || []).map(ruleRu).join(", ")}</b>.`
    : `Сигнал на покупку был, но робот <b>не стал входить</b>: ${humanRisk(c)}.`;
  const pos = (v) => Object.fromEntries((v?.positions || []).map((p) => [p.ticker, p]));
  const b = pos(c.before), a = pos(c.after);
  const tickers = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort((x, y) => (a[y]?.value || 0) - (a[x]?.value || 0));
  const maxShare = Math.max(1, ...tickers.flatMap((t) => [b[t]?.share || 0, a[t]?.share || 0]));
  const rsi = tech.rsi_14 != null ? tech.rsi_14 * 100 : null;
  const blockedChecks = c.findings.filter((f) => !["passed", "attention"].includes(f.severity));

  app.innerHTML = `<div class="wrap enter">
    <a class="back" href="#/feed" style="--i:0">${ico("back")}Лента</a>
    <section class="card dec-head" style="--i:1" aria-labelledby="dec-t">
      <div>
        <div class="eyebrow">${dtm(c.ts)} · <span class="tag paper" style="vertical-align:1px">Учебный счёт</span></div>
        <h1 class="h-xl" id="dec-t" style="margin-top:10px">${esc(c.ticker)} <span class="muted" style="font-weight:500">${esc(c.name)}</span></h1>
        <p class="dec-sum">${sum}</p>
        ${k === "wait" ? `<div class="obs"><button class="btn primary" data-act="ok">${ico("check")}Подтвердить</button><button class="btn" data-act="no">Отклонить</button></div>
          <p class="note" style="margin-top:8px">Режим «Наблюдение». В демо решение не отправляется брокеру.</p>` : ""}
      </div>
      <div>${pill(k)}</div>
    </section>

    <ol class="steps" aria-label="Ход решения" style="--i:2">
      ${stages.map(([n, s], i) => `<li class="step ${s}"><span class="st-dot">${s === "on" ? ico("check") : s === "bad" ? ico("stop") : i + 1}</span>${n}</li>`).join("")}
    </ol>

    <div class="flow">
      <section class="card pad" style="--i:3" aria-labelledby="s1">
        <div class="stage-h"><span class="stage-n">1</span><h2 class="h-sm" id="s1">Почему робот заинтересовался</h2></div>
        <p style="font-size:16px;line-height:1.55">${humanSignal(c)}.</p>
        <p class="note" style="margin-top:12px">Сигнал робота дословно: «${esc(c.signal || "—")}»</p>
      </section>

      <section class="card pad" style="--i:4" aria-labelledby="s2">
        <div class="stage-h"><span class="stage-n">2</span><h2 class="h-sm" id="s2">Анализ: голоса слоёв</h2></div>
        ${(c.votes || []).map(factorRow).join("") || `<p class="note">Нет данных о голосах.</p>`}
        <p class="note" style="margin-top:10px">Вход открывает только техника. Новости и ${T("ML")} могут запретить вход или изменить уверенность. Вес — как в формуле робота.</p>
      </section>

      <section class="card pad wide" style="--i:5" aria-labelledby="s2b">
        <div class="stage-h"><span class="stage-n">2</span><h2 class="h-sm" id="s2b">Анализ: технические показатели</h2></div>
        <dl class="kv" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr));margin-top:0">
          <div><dt>Быстрая / медленная ${T("SMA", "средняя")}</dt><dd>${fmt(tech.sma_fast, 2)} / ${fmt(tech.sma_slow, 2)}</dd></div>
          <div><dt>${T("моментум", "Рост за 8 дней")}</dt><dd class="${tech.momentum_pct > 0 ? "pos" : tech.momentum_pct < 0 ? "neg" : ""}">${tech.momentum_pct != null ? sfmt(tech.momentum_pct, 1) + "%" : "—"}</dd></div>
          <div><dt>${T("RSI")}</dt><dd>${rsi != null ? fmt(rsi) : "—"}</dd>${rsi != null ? `<div class="rsi" role="img" aria-label="RSI ${fmt(rsi)} из 100"><i style="left:${Math.max(0, Math.min(100, rsi))}%"></i></div>` : ""}</div>
          <div><dt>${T("волатильность", "Волатильность за день")}</dt><dd>${tech.volatility_10 != null ? fmt(tech.volatility_10 * 100, 1) + "%" : "—"}</dd></div>
        </dl>
      </section>

      <section class="card pad" style="--i:6" aria-labelledby="s3">
        <div class="stage-h"><span class="stage-n ${stages[2][1] === "bad" ? "bad" : ""}">3</span><h2 class="h-sm" id="s3">Проверки риска</h2></div>
        <div class="check"><span class="c-ic ${c.status === "skipped" ? "blocked" : "passed"}">${ico(c.status === "skipped" ? "stop" : "check")}</span>
          <div><b>Риск-контур робота</b><p>${c.status === "skipped" ? humanRisk(c) : esc(c.risk || "—")}</p></div></div>
        ${c.findings.length ? c.findings.map((f) => `<div class="check"><span class="c-ic ${f.severity}">${ico(f.severity === "passed" ? "check" : f.severity === "attention" ? "warn" : "stop")}</span>
          <div><b>${esc(f.title)}</b><p>${esc(f.message)}</p></div></div>`).join("")
          : `<p class="note" style="margin-top:8px">Проверки «Перед сделкой» не запускались: робот отказался раньше.</p>`}
      </section>

      <section class="card pad" style="--i:7" aria-labelledby="s4">
        <div class="stage-h"><span class="stage-n ${ex ? "" : "bad"}">4</span><h2 class="h-sm" id="s4">Решение</h2></div>
        <div class="verdict"><span class="v-ic tl-ic ${STATUS[k].cls}">${ico(STATUS[k].icon)}</span>
          <div><b style="font-size:17px">${ex ? (k === "wait" ? "Предложено к сделке" : "Сделка выполнена") : c.status === "blocked" ? "Сделка отклонена проверками" : "Робот воздержался"}</b>
          <p class="note" style="font-size:14px;margin-top:2px">${ex ? "Все блокирующие проверки пройдены." : c.status === "blocked" ? `Сработало: ${blockedChecks.map((f) => esc(f.title)).join("; ") || (c.blocking || []).map(ruleRu).join(", ")}.` : "Позиция не открывалась, деньги остались на счёте."}</p></div></div>
        ${ex ? `<dl class="kv"><div><dt>Цена исполнения</dt><dd>${rub(ex.price, 2)}</dd></div><div><dt>Сумма</dt><dd>${rub(ex.amount)}</dd></div>
          <div><dt>${T("комиссия", "Комиссия")}</dt><dd>${rub(c.trade?.commission, 2)}</dd></div><div><dt>Количество</dt><dd>${fmt(c.trade?.qty)} шт.</dd></div></dl>
          <p class="note" style="margin-top:10px">${T("проскальзывание", "Проскальзывание")} уже учтено в цене исполнения.</p>` : ""}
      </section>

      <section class="card pad wide" style="--i:8" aria-labelledby="s5">
        <div class="stage-h"><span class="stage-n">5</span><h2 class="h-sm" id="s5">Результат: портфель до и после</h2></div>
        ${c.before ? `
          <div class="legend" style="margin-bottom:14px"><span><i class="sq" style="background:var(--s-other)"></i>До</span><span><i class="sq" style="background:var(--accent)"></i>После</span></div>
          <div class="dbars">${tickers.map((t) => `<div class="dbar"><b>${esc(t)}</b>
            <div class="tr" role="img" aria-label="${esc(t)}: было ${b[t] ? fmt(b[t].share, 1) + "%" : "нет"}, стало ${a[t] ? fmt(a[t].share, 1) + "%" : "нет"}">
              <span class="b" style="width:${(b[t]?.share || 0) / maxShare * 100}%"></span><span class="a" style="width:${(a[t]?.share || 0) / maxShare * 100}%"></span></div>
            <span class="v">${b[t] ? fmt(b[t].share, 1) : "—"} → <b>${a[t] ? fmt(a[t].share, 1) + "%" : "—"}</b></span></div>`).join("")}</div>
          <details class="more" style="margin-top:14px"><summary>${ico("chev")}Точные значения</summary>
            <div class="tbl-wrap"><table><thead><tr><th>Бумага</th><th class="r">Доля до</th><th class="r">Доля после</th><th class="r">Стоимость после</th></tr></thead><tbody>
            ${tickers.map((t) => `<tr class="${t === c.ticker ? "hl" : ""}"><td>${esc(t)}</td><td class="r">${b[t] ? pct(b[t].share) : "—"}</td><td class="r">${a[t] ? pct(a[t].share) : "—"}</td><td class="r">${a[t] ? rub(a[t].value) : "—"}</td></tr>`).join("")}
            <tr class="total"><td>Свободные деньги</td><td class="r">${rub(c.before.cash)}</td><td class="r">${rub(c.after.cash)}</td><td></td></tr>
            <tr><td>Всего</td><td class="r">${rub(c.before.total)}</td><td class="r">${rub(c.after.total)}</td><td></td></tr></tbody></table></div></details>
          <p class="note" style="margin-top:10px">«После» — модель: полное исполнение по цене котировки минус комиссия.</p>`
        : `<div class="empty" style="padding:24px"><b>Портфель не изменился</b><p>Сделки не было — расчёт «до/после» не строился.</p></div>`}
      </section>
    </div>
  </div>`;
  $$("[data-act]", app).forEach((btn) => btn.addEventListener("click", () => toast(btn.dataset.act === "ok"
    ? "Демо: подтверждение записано только в браузере, брокеру ничего не отправлено"
    : "Отклонено. Робот учтёт ваше несогласие в разборе", "info")));
}

/* ============ Страховка ============ */
const LIMIT_GROUPS = [
  { title: "Одна бумага", icon: "safety", items: [
    ["max_position_pct", "Не больше %v% денег в одной бумаге", "Если бумага упадёт вдвое, портфель потеряет не больше половины этой доли.", 5, 25, 1],
    ["stop_loss_pct", "Продать, если бумага упала на %v%", "Это стоп-лосс. Ограничивает убыток по одной сделке.", 3, 15, 1],
    ["take_profit_pct", "Зафиксировать прибыль при +%v%", "Тейк-профит. Плюс трейлинг: при росте уровень выхода подтягивается.", 5, 40, 1]] },
  { title: "Весь портфель", icon: "results", items: [
    ["max_total_exposure_pct", "Не больше %v% портфеля в акциях", "Остальное — деньги: запас на просадки и новые возможности.", 20, 90, 5],
    ["max_daily_loss_pct", "Стоп на день при −%v%", "Новые сделки прекращаются до завтра.", 1, 10, 0.5],
    ["max_portfolio_drawdown_pct", "Всё продать при просадке −%v% от пика", "Предохранитель: робот уходит в деньги и делает паузу на 48 часов.", 5, 30, 1]] },
];
function viewSafety() {
  const stopped = ls.get("stopall") === "1";
  const L = D.limits;
  const lim = ([key, say, ex, min, max, step]) => {
    const v = Number(ls.get("lim_" + key, L[key])), d = step < 1 ? 1 : 0, p = (v - min) / (max - min) * 100;
    return `<div class="lim"><div class="lim-top"><label class="lim-say" for="l-${key}" data-say="${esc(say)}">${say.replace("%v", fmt(v, d))}</label>
      <output class="lim-val" for="l-${key}">${fmt(v, d)}%</output></div><p class="lim-ex">${ex}</p>
      <input class="slider" id="l-${key}" type="range" min="${min}" max="${max}" step="${step}" value="${v}" data-k="${key}" style="--p:${p}%">
      <div class="lim-range"><span>${fmt(min, d)}%</span><span>робот по умолчанию: ${fmt(L[key], d)}%</span><span>${fmt(max, d)}%</span></div></div>`;
  };
  app.innerHTML = `<div class="wrap enter">
    <section class="hello" style="--i:0"><div><div class="eyebrow">Центр безопасности</div>
      <h1 class="h-xl" style="margin-top:8px">Страховка</h1>
      <p class="lead">Рамки, внутри которых робот работает сам. Двигайте в разрешённых границах — шире платформа не даст.</p></div></section>
    <div class="safety">
      <div>
        ${LIMIT_GROUPS.map((g, gi) => `<section class="card pad lgroup" style="--i:${gi + 1}" aria-labelledby="g${gi}">
          <div class="lgroup-h"><span class="lgroup-ic">${ico(g.icon)}</span><h2 class="h-md" id="g${gi}">${g.title}</h2></div>
          ${g.items.map(lim).join("")}</section>`).join("")}
        <section class="card pad lgroup" style="--i:3" aria-labelledby="g-al">
          <h2 class="h-md" id="g-al" style="margin-bottom:12px">Работает всегда</h2>
          <ul class="always">
            <li>${ico("check")}<span>Не больше ${L.max_trades_per_day} сделок в день</span></li>
            <li>${ico("check")}<span>Не больше ${L.max_cluster_exposure_pct}% в бумагах, которые ходят вместе (${T("корреляция")})</span></li>
            <li>${ico("check")}<span>Пауза после ${L.loss_streak_n} ${T("стоп-лосс", "стоп-лоссов")} подряд</span></li>
            <li>${ico("check")}<span>Позиция не меньше ${L.min_position_pct}% портфеля — без «пылинок»</span></li>
            <li>${ico("check")}<span>Без ${T("шорт", "шортов")} и кредитного плеча</span></li>
          </ul>
        </section>
      </div>
      <div style="display:grid;gap:16px">
        <section class="card stop-card" style="--i:2" aria-labelledby="stop-t">
          <h2 class="h-md" id="stop-t">Стоп-всё</h2>
          <p class="note" style="font-size:14px;margin-top:6px">Запрещает роботу любые новые сделки. Открытые позиции остаются под стоп-лоссами. Снять — той же кнопкой.</p>
          <button class="stop-btn ${stopped ? "on" : ""}" id="stopall" aria-pressed="${stopped}">${ico(stopped ? "check" : "stop")}${stopped ? "Возобновить торговлю" : "Остановить все сделки"}</button>
          <div class="stop-state">${stopped ? `<span class="pill block">${ico("stop")}Новые сделки остановлены</span>` : `<span class="pill done">${ico("check")}Робот работает в рамках страховки</span>`}</div>
          <div class="demo-flag">${ico("info")}<span><b>Демо.</b> Кнопка меняет только состояние в этом браузере. Команды брокеру не отправляются — управления реальным счётом здесь нет.</span></div>
        </section>
        <section class="card pad" style="--i:3" aria-labelledby="mode-t">
          <h2 class="h-md" id="mode-t">Режим доверия</h2>
          <p class="note" style="margin:6px 0 14px">Сколько свободы вы даёте роботу.</p>
          <div class="seg lg full stretch" role="radiogroup" aria-label="Режим доверия" id="trust">
            ${Object.entries(MODES).map(([k, m]) => `<button role="radio" data-mode="${k}" aria-checked="${trust === k}">${m.name}</button>`).join("")}
          </div>
          <div class="mode-desc" id="mode-desc" aria-live="polite"></div>
        </section>
      </div>
    </div></div>`;
  $$(".slider", app).forEach((r) => r.addEventListener("input", () => {
    const row = r.closest(".lim"), step = Number(r.step), d = step < 1 ? 1 : 0;
    r.style.setProperty("--p", (r.value - r.min) / (r.max - r.min) * 100 + "%");
    const out = $("output", row); out.textContent = fmt(r.value, d) + "%";
    out.classList.add("bump"); clearTimeout(out.h); out.h = setTimeout(() => out.classList.remove("bump"), 160);
    const say = $(".lim-say", row); say.textContent = say.dataset.say.replace("%v", fmt(r.value, d));
    ls.set("lim_" + r.dataset.k, r.value);
  }));
  const seg = $("#trust"), desc = $("#mode-desc");
  const paintDesc = () => { const m = MODES[trust]; desc.innerHTML = `<b>${m.short}</b><ul>${m.items.map((x) => `<li>${x}</li>`).join("")}</ul>`; };
  paintDesc(); segInd(seg);
  $$("button", seg).forEach((b) => b.addEventListener("click", () => {
    trust = b.dataset.mode; ls.set("trust", trust); paintMode();
    $$("button", seg).forEach((x) => x.setAttribute("aria-checked", x === b)); segInd(seg); paintDesc();
  }));
  seg.addEventListener("keydown", radioKeys);
  $("#stopall").addEventListener("click", async () => {
    if (!stopped) {
      const ok = await confirmDlg("Остановить все сделки?", "Робот перестанет открывать новые позиции, пока вы не снимете стоп. Открытые позиции останутся под стоп-лоссами. В демо это меняет только состояние в браузере — брокеру ничего не отправляется.", "Остановить");
      if (!ok) return;
    }
    ls.set("stopall", stopped ? "0" : "1"); viewSafety();
    toast(stopped ? "Торговля возобновлена (демо)" : "Стоп-всё включён (демо, без команд брокеру)", stopped ? "check" : "stop");
  });
}
function confirmDlg(title, msg, okText) {
  const d = $("#confirm");
  $("#confirm-t").textContent = title; $("#confirm-m").textContent = msg; $("#confirm-ok").textContent = okText;
  if (!d.showModal) return Promise.resolve(window.confirm(`${title}\n\n${msg}`));
  d.showModal();
  return new Promise((res) => d.addEventListener("close", () => res(d.returnValue === "ok"), { once: true }));
}

/* ============ Графики: SVG, монотонная кривая без выбросов, перекрестие мышью/пальцем/клавишами ============ */
const charts = new Set();
function monoPath(pts) {
  // Fritsch–Carlson: проходит точно через точки, не «перелетает» значения
  const p = pts.filter((q) => q[1] != null); const n = p.length;
  if (n < 2) return "";
  const dx = [], m = [], t = [];
  for (let i = 0; i < n - 1; i++) { dx[i] = p[i + 1][0] - p[i][0]; m[i] = (p[i + 1][1] - p[i][1]) / dx[i]; }
  t[0] = m[0]; t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : 3 * (dx[i - 1] + dx[i]) / ((2 * dx[i] + dx[i - 1]) / m[i - 1] + (dx[i] + 2 * dx[i - 1]) / m[i]);
  let d = `M${p[0][0].toFixed(1)},${p[0][1].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += `C${(p[i][0] + h).toFixed(1)},${(p[i][1] + t[i] * h).toFixed(1)} ${(p[i + 1][0] - h).toFixed(1)},${(p[i + 1][1] - t[i + 1] * h).toFixed(1)} ${p[i + 1][0].toFixed(1)},${p[i + 1][1].toFixed(1)}`;
  }
  return d;
}
function lineChart(box, o) {
  const st = { ...o, draw: o.draw !== false };
  const render = () => {
    const W = Math.max(280, box.clientWidth), H = st.height || Math.round(Math.min(380, Math.max(220, W * 0.42)));
    const L = 44, R = W < 520 ? 12 : 78, Tp = 14, B = 30;
    const vals = st.series.flatMap((s) => s.values).filter((v) => v != null).concat(st.baseline != null ? [st.baseline] : []);
    let lo = Math.min(...vals), hi = Math.max(...vals); const pad = (hi - lo) * 0.08 || 1; lo -= pad; hi += pad;
    const n = st.x.length;
    const sx = (i) => L + (i / (n - 1)) * (W - L - R), sy = (v) => Tp + (1 - (v - lo) / (hi - lo)) * (H - Tp - B);
    const nT = H < 260 ? 3 : 4, yt = Array.from({ length: nT + 1 }, (_, i) => lo + (hi - lo) * i / nT);
    const xt = W < 520 ? [0, Math.floor((n - 1) / 2), n - 1] : [0, Math.floor((n - 1) / 3), Math.floor(2 * (n - 1) / 3), n - 1];
    const pts = (s) => s.values.map((v, i) => [sx(i), v == null ? null : sy(v)]);
    const lastIdx = (s) => s.values.length - 1 - [...s.values].reverse().findIndex((v) => v != null);
    // подписи на концах линий: раздвигаем, чтобы не наезжали
    const ends = st.series.filter((s) => s.endLabel !== false).map((s) => ({ s, y: sy(s.values[lastIdx(s)]) })).sort((a, b) => a.y - b.y);
    for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 15) ends[i].y = ends[i - 1].y + 15;
    box.innerHTML = `<svg class="chart" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(st.label || "")}">
      <g>${yt.map((v) => `<line class="gl" x1="${L}" x2="${W - R}" y1="${sy(v)}" y2="${sy(v)}"/><text x="${L - 8}" y="${sy(v) + 4}" text-anchor="end">${st.yfmt(v)}</text>`).join("")}</g>
      ${st.baseline != null ? `<line class="zero" x1="${L}" x2="${W - R}" y1="${sy(st.baseline)}" y2="${sy(st.baseline)}"/>` : ""}
      ${xt.map((i) => `<text x="${sx(i)}" y="${H - 8}" text-anchor="${i === 0 ? "start" : i === n - 1 ? "end" : "middle"}">${esc(st.xfmt(st.x[i], true))}</text>`).join("")}
      ${st.mark != null ? `<rect x="${sx(st.mark)}" y="${Tp}" width="${W - R - sx(st.mark)}" height="${H - Tp - B}" fill="var(--surface-2)" rx="8"/>
        <line x1="${sx(st.mark)}" x2="${sx(st.mark)}" y1="${Tp}" y2="${H - B}" stroke="var(--text-3)" stroke-dasharray="3 4"/>
        <text x="${sx(st.mark) + 8}" y="${Tp + 14}" style="font-weight:600">после решения</text>` : ""}
      ${st.series.map((s, k) => {
        const d = monoPath(pts(s));
        const area = s.area ? `<path class="area" d="${d}L${sx(lastIdx(s))},${H - B}L${sx(s.values.findIndex((v) => v != null))},${H - B}Z" fill="${s.color}"/>` : "";
        return `${area}<path class="ln ${st.draw && !reduce.matches ? "draw" : ""}" data-k="${k}" d="${d}" stroke="${s.color}" ${s.dash ? `stroke-dasharray="${s.dash}"` : ""} style="${s.width ? `stroke-width:${s.width}` : ""}"/>`;
      }).join("")}
      ${st.dots ? st.dots.map((dt) => `<circle cx="${sx(dt.i)}" cy="${sy(dt.v)}" r="5" fill="${dt.color}" stroke="var(--surface)" stroke-width="2.5"/>`).join("") : ""}
      ${W >= 520 ? ends.map((e) => `<text class="end-lbl" x="${W - R + 8}" y="${e.y + 4}">${esc(e.s.short || e.s.name)}</text>`).join("") : ""}
      <g class="xh" style="display:none"><line y1="${Tp}" y2="${H - B}"/>${st.series.map((s) => `<circle r="4.5" fill="${s.color}"/>`).join("")}</g>
      <rect class="hit" x="${L}" y="${Tp}" width="${W - L - R}" height="${H - Tp - B}" fill="transparent" tabindex="0" aria-label="Перекрестие: стрелки влево и вправо"/>
    </svg>`;
    // штриховая анимация: длина пути
    $$(".ln.draw", box).forEach((p) => { if (!p.getAttribute("stroke-dasharray")) p.style.setProperty("--len", Math.ceil(p.getTotalLength())); else p.classList.remove("draw"); });
    st.draw = false;
    const svg = $("svg", box), xh = $(".xh", svg), hit = $(".hit", svg);
    let cur = -1;
    const show = (i, cx, cy) => {
      cur = Math.max(0, Math.min(n - 1, i));
      xh.style.display = ""; const l = $("line", xh); l.setAttribute("x1", sx(cur)); l.setAttribute("x2", sx(cur));
      $$("circle", xh).forEach((c, k) => { const v = st.series[k].values[cur]; c.style.display = v == null ? "none" : ""; if (v != null) { c.setAttribute("cx", sx(cur)); c.setAttribute("cy", sy(v)); } });
      pop.innerHTML = `<b>${esc(st.xfmt(st.x[cur], false))}</b>` + st.series.filter((s) => s.values[cur] != null && s.tip !== false)
        .map((s) => `<div class="row"><i style="border-color:${s.color};${s.dash ? (s.dash.startsWith("1.5") ? "border-top-style:dotted;border-top-width:3px" : "border-top-style:dashed") : ""}"></i><span>${esc(s.name)}</span><span>${st.yfmt(s.values[cur], true)}</span></div>`).join("");
      const r = svg.getBoundingClientRect();
      place(null, cx ?? r.left + (sx(cur) / W) * r.width + 14, cy ?? r.top + 20); popFor = null;
    };
    const fromEv = (ev) => { const r = svg.getBoundingClientRect(); const x = (ev.clientX - r.left) * (W / r.width); return Math.round((x - L) / (W - L - R) * (n - 1)); };
    hit.addEventListener("pointermove", (ev) => show(fromEv(ev), ev.clientX + 14, ev.clientY + 6));
    hit.addEventListener("pointerdown", (ev) => show(fromEv(ev), ev.clientX + 14, ev.clientY + 6));
    hit.addEventListener("pointerleave", (ev) => { if (ev.pointerType === "mouse") { xh.style.display = "none"; pop.hidden = true; } });
    hit.addEventListener("keydown", (ev) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(ev.key)) return; ev.preventDefault();
      const step = Math.max(1, Math.round(n / 40));
      show(ev.key === "Home" ? 0 : ev.key === "End" ? n - 1 : (cur < 0 ? n - 1 : cur) + (ev.key === "ArrowRight" ? step : -step));
    });
    hit.addEventListener("blur", () => { xh.style.display = "none"; pop.hidden = true; });
  };
  render();
  const api = {
    render, box,
    update(k, values, patch = {}) {
      // плавная смена линии: меняем d у того же пути (CSS transition на d)
      Object.assign(st.series[k], patch, { values });
      const old = $$(".ln", box).map((p) => p.getAttribute("d"));
      render();
      if (!reduce.matches) $$(".ln", box).forEach((p, i) => { const nd = p.getAttribute("d"); if (old[i] && old[i] !== nd) { p.setAttribute("d", old[i]); requestAnimationFrame(() => requestAnimationFrame(() => p.setAttribute("d", nd))); } });
    },
    recolor(fn) { st.series.forEach(fn); render(); },
  };
  charts.add(api);
  return api;
}
let rzT;
addEventListener("resize", () => { clearTimeout(rzT); rzT = setTimeout(() => { charts.forEach((c) => c.box.isConnected ? c.render() : charts.delete(c)); moveNav(currentTab); $$(".seg").forEach(segInd); }, 120); });
function redrawCharts() { charts.forEach((c) => { if (!c.box.isConnected) { charts.delete(c); return; } c.recolor((s) => { if (s.cssColor) s.color = css(s.cssColor); }); }); }

/* ============ Учёба ============ */
let duelI = 0, duelChoice = null;
const duelLog = [];   // {choice, you, robot}
function viewLearn() {
  const all = D.duel || [];
  if (!all.length) { app.innerHTML = `<div class="wrap"><div class="card empty"><div class="e-ic">${ico("learn")}</div><b>Заданий пока нет</b></div></div>`; return; }
  const finished = duelLog.length >= all.length && duelChoice == null;
  const d = all[duelI % all.length], revealed = duelChoice != null;
  const you = revealed ? (duelChoice === "buy" ? d.robot_pnl : 0) : null;
  const good = revealed && ((duelChoice === "buy" && d.robot_pnl > 0) || (duelChoice === "skip" && d.robot_pnl <= 0));
  const totYou = duelLog.reduce((s, r) => s + r.you, 0), totRobot = duelLog.reduce((s, r) => s + r.robot, 0);
  const move = d.move_20d;

  app.innerHTML = `<div class="wrap enter">
    <section class="hello" style="--i:0"><div><div class="eyebrow">Учебный слой</div>
      <h1 class="h-xl" style="margin-top:8px">Учёба</h1>
      <p class="lead">Решайте сами на реальных ситуациях из истории и сравнивайте себя с роботом. Без денег и без риска.</p></div></section>
    <div class="learn">
      <section class="card duel" style="--i:1" aria-labelledby="duel-t">
        <div class="score-row">
          <span class="eyebrow">Дуэль с роботом · раунд ${Math.min(duelLog.length + (revealed ? 0 : 1), all.length)} из ${all.length}</span>
          <div class="rounds" aria-hidden="true">${all.map((_, i) => { const r = duelLog[i]; const cls = r ? (r.good ? "win" : "lose") : i === duelLog.length && !revealed ? "cur" : ""; return `<i class="${cls}"></i>`; }).join("")}</div>
        </div>
        ${finished ? `
          <h2 class="h-lg" id="duel-t" style="margin-top:14px">Дуэль пройдена</h2>
          <div class="vs" style="margin-top:18px">
            <div><div class="who">Вы, сумма результатов</div><div class="res ${totYou >= 0 ? "pos" : "neg"}">${sfmt(totYou)}%</div></div>
            <div><div class="who">Робот, сумма результатов</div><div class="res ${totRobot >= 0 ? "pos" : "neg"}">${sfmt(totRobot)}%</div></div>
          </div>
          <p class="note" style="margin-top:12px">Верных решений: ${duelLog.filter((r) => r.good).length} из ${all.length}. Это простая сумма процентов по раундам, не доходность портфеля.</p>
          <div class="choice" style="grid-template-columns:1fr"><button class="buy" id="again"><b>Пройти ещё раз</b><span>Те же ${all.length} ситуаций</span></button></div>`
        : `
          <h2 class="h-lg" id="duel-t" style="margin-top:14px">${revealed ? `Это был ${esc(d.ticker)}` : "Купили бы вы бумагу «X»?"}</h2>
          <p class="note" style="font-size:14.5px;margin-top:8px">${revealed ? `${new Date(d.date).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })} · реальная история торгов` : "60 дней цены перед моментом, когда робот увидел сигнал. Название скрыто, чтобы оно не подсказывало."}</p>
          <div class="duel-chart" id="duel-chart"></div>
          ${revealed ? `
          <div class="reveal" aria-live="polite">
            <div class="vs">
              <div><div class="who">Вы</div><div class="what">${duelChoice === "buy" ? "Купили" : "Пропустили"}</div><div class="res ${you > 0 ? "pos" : you < 0 ? "neg" : ""}">${sfmt(you)}%</div></div>
              <div><div class="who">Робот</div><div class="what">Купил · ${esc(d.exit_reason)} через ${d.hold_days} дн.</div><div class="res ${d.robot_pnl >= 0 ? "pos" : "neg"}">${sfmt(d.robot_pnl)}%</div></div>
            </div>
            <div class="explain">${good ? `<span class="win-burst" aria-hidden="true">${ico("check")}</span> <b>Верное решение.</b> ` : `<b>${duelChoice === "buy" ? "Здесь лучше было пропустить." : "Здесь вход окупился."}</b> `}
              ${move != null ? `За 20 торговых дней после сигнала цена изменилась на <b class="${move >= 0 ? "pos" : "neg"}">${sfmt(move)}%</b>. ` : ""}
              Робот держал позицию ${d.hold_days} дн. и вышел по правилу «${esc(d.exit_reason)}»${/стоп/.test(d.exit_reason) ? ` — ${T("стоп-лосс")} ограничил убыток` : /тейк/.test(d.exit_reason) ? ` — ${T("тейк-профит")} зафиксировал прибыль` : ""}.
              Причина входа: ${esc(d.robot_reason)}.</div>
            <div class="choice" style="grid-template-columns:1fr;margin-top:4px"><button class="buy" id="next"><b>${duelLog.length >= all.length ? "Итоги дуэли" : "Следующая ситуация"} →</b><span>Счёт: вы ${sfmt(totYou)}% · робот ${sfmt(totRobot)}%</span></button></div>
          </div>` : `
          <div class="choice" role="group" aria-label="Ваше решение">
            <button class="buy" data-c="buy"><b>Купить</b><span>Вхожу вслед за сигналом</span></button>
            <button data-c="skip"><b>Пропустить</b><span>Не верю в движение</span></button>
          </div>`}`}
      </section>

      <section class="card pad gloss" style="--i:2" aria-labelledby="gl-t">
        <h2 class="h-md" id="gl-t">Словарь</h2>
        <p class="note" style="margin-top:6px">Подчёркнутые слова по всему кабинету открываются касанием или наведением.</p>
        <label class="gloss-search">${ico("search")}<span class="sr">Поиск термина</span><input id="gq" type="search" placeholder="Найти термин" autocomplete="off"></label>
        <div id="gl">${glossList("")}</div>
      </section>
    </div>
    <section style="--i:3;margin-top:16px" class="card pad" aria-labelledby="nx-t">
      <h2 class="h-md" id="nx-t">В разработке</h2>
      <div class="next-up">
        <div><b>Разбор «что было бы, если…»</b>по каждой сделке робота</div>
        <div><b>Энциклопедия стратегий</b>и истории известных трейдеров</div>
        <div><b>Прогресс</b>какие темы пройдены и где вы чаще ошибаетесь</div>
      </div>
    </section>
  </div>`;

  if (!finished) {
    const vals = revealed ? [...d.before, ...d.after.slice(1)] : d.before;
    const x = vals.map((_, i) => i - d.before.length + 1);
    const color = css("--s1");
    lineChart($("#duel-chart"), {
      x, label: `Цена ${revealed ? d.ticker : "бумаги"} за ${vals.length} дней`, height: 240, draw: true,
      series: [{ name: "Цена", values: vals, color, cssColor: "--s1", area: true, endLabel: false }],
      yfmt: (v, tip) => fmt(v, v < 100 ? 2 : 0) + (tip ? " ₽" : ""),
      xfmt: (v, axis) => v === 0 ? (axis ? "сигнал" : "день сигнала") : v < 0 ? `${MINUS}${-v} дн.` : `+${v} дн.`,
      mark: revealed ? d.before.length - 1 : null,
      dots: [{ i: d.before.length - 1, v: d.before.at(-1), color }],
    });
  }
  $$("[data-c]", app).forEach((b) => b.addEventListener("click", () => {
    duelChoice = b.dataset.c;
    const yv = duelChoice === "buy" ? d.robot_pnl : 0;
    duelLog.push({ choice: duelChoice, you: yv, robot: d.robot_pnl, good: (duelChoice === "buy" && d.robot_pnl > 0) || (duelChoice === "skip" && d.robot_pnl <= 0) });
    viewLearn(); $("#duel-t")?.focus?.();
  }));
  $("#next")?.addEventListener("click", () => { duelI++; duelChoice = null; viewLearn(); });
  $("#again")?.addEventListener("click", () => { duelI = 0; duelChoice = null; duelLog.length = 0; viewLearn(); });
  $("#gq").addEventListener("input", (e) => { $("#gl").innerHTML = glossList(e.target.value); });
}
function glossList(q) {
  const s = q.trim().toLowerCase();
  const items = Object.entries(GLOSS).filter(([k, v]) => !s || k.toLowerCase().includes(s) || v.toLowerCase().includes(s));
  return items.length ? items.map(([k, v]) => `<details><summary>${esc(k)}${ico("chev")}</summary><p>${esc(v)}</p></details>`).join("")
    : `<p class="note" style="padding:16px 0">Ничего не найдено по запросу «${esc(q)}».</p>`;
}

/* ============ Результаты ============ */
let tariffHi = false, showTable = false;
function viewResults() {
  const B = D.backtest;
  const stats = () => tariffHi ? B.stats_hi : B.stats;
  const S = (k) => String(stats()[k]).replace(".", ",").replace("-", MINUS);
  const idxEnd = B.equity.at(-1).imoex - 100;
  const EXIT_RU = { "SMA": "разворот средних", "смена": "смена режима рынка", "стоп-лосс": "стоп-лосс", "тейк-профит": "тейк-профит", "трейлинг": "трейлинг", "предохранитель": "предохранитель просадки" };
  const maxAbs = Math.max(...B.exits.map((e) => Math.abs(e.avg)));
  const yr = (s) => s.slice(0, 4);

  app.innerHTML = `<div class="wrap enter">
    <section class="hello" style="--i:0"><div>
      <div class="eyebrow"><span class="src"><i></i>Исторические данные · проверка на истории ${yr(B.from)}–${yr(B.to)}</span></div>
      <h1 class="h-xl" style="margin-top:8px">Результаты</h1>
      <p class="lead">Как стратегия робота вела бы себя последние пять лет — с комиссиями, проскальзыванием и честным исполнением на следующий день.</p></div></section>

    <section class="stats" aria-label="Ключевые показатели" id="stats" style="--i:1">${statTiles()}</section>

    <section class="card chart-card" style="--i:2" aria-labelledby="ch-t">
      <div class="chart-top">
        <div><h2 class="h-md" id="ch-t">Капитал робота против рынка</h2>
          <p class="note" style="margin-top:4px">1 000 000 ₽ на старте = 100 · недельные значения</p></div>
        <div><div class="eyebrow" style="margin-bottom:6px">Комиссия брокера</div>
          <div class="seg lg" role="radiogroup" aria-label="Комиссия брокера" id="tariff">
            <button role="radio" data-t="0" aria-checked="${!tariffHi}">0,05%</button><button role="radio" data-t="1" aria-checked="${tariffHi}">0,3%</button></div></div>
      </div>
      <div class="legend" style="margin-top:16px">
        <span><i style="border-color:var(--s1)"></i>Робот</span><span><i class="dash" style="border-color:var(--s2)"></i>Индекс МосБиржи</span><span><i class="dot" style="border-color:var(--s3)"></i>Все 40 бумаг поровну</span>
        <span><i class="dash" style="border-color:var(--text-3);border-top-width:1.5px"></i>Старт = 100</span>
      </div>
      <div class="chart-box" id="eq"></div>
      <button class="linkbtn" id="tbl" aria-expanded="${showTable}">${showTable ? "Скрыть таблицу" : "Показать значения таблицей"}</button>
      <div id="tblbox">${showTable ? eqTable() : ""}</div>
      <p class="note">Решение по закрытию дня, исполнение по открытию следующего, ${T("стоп-лосс", "стопы")} по внутридневным минимумам с гэпами, ${T("комиссия")} и ${T("проскальзывание")}. Индекс — ценовой, без дивидендов. Новости и ${T("ML")} в проверку не входят. Прошлые результаты не гарантируют будущих.</p>
    </section>

    <div class="res-grid">
      <section class="card honest" style="--i:3" aria-labelledby="hn-t">
        <div class="stage-h" style="margin:0"><span class="lgroup-ic">${ico("info")}</span><h2 class="h-md" id="hn-t">Честно о результатах</h2></div>
        <ul>
          <li>${ico("check")}<span>Робот обгоняет рынок в основном потому, что уходит в деньги, когда рынок падает (${T("режим рынка")}). Индекс за тот же период: ${sfmt(idxEnd, 0)}%.</span></li>
          <li>${ico("check")}<span>На тарифе 0,3% ${T("комиссия")} съедает почти всю прибыль — переключите выше и сравните.</span></li>
          <li>${ico("check")}<span>За последние 12 месяцев результат около нуля. Стратегию продолжаем проверять на учебном счёте.</span></li>
          <li>${ico("check")}<span>Поэтому продукт — про понимание и обучение, а не про обещание дохода.</span></li>
        </ul>
      </section>
      <section class="card pad" style="--i:4" aria-labelledby="ex-t">
        <h2 class="h-md" id="ex-t">Чем заканчиваются сделки</h2>
        <p class="note" style="margin:6px 0 10px">Средний результат сделки по причине выхода. Прибыль приносят ${T("тейк-профит", "тейк-профиты")}, остальное — плата за участие.</p>
        ${B.exits.slice().sort((a, b) => b.avg - a.avg).map((e) => { const w = Math.abs(e.avg) / maxAbs * 50, neg = e.avg < 0;
          return `<div class="exit"><div class="e-n">${esc(EXIT_RU[e.reason] || e.reason)}<small>${e.n} сделок</small></div>
            <div class="e-bar"><div class="scale" role="img" aria-label="${esc(EXIT_RU[e.reason] || e.reason)}: в среднем ${sfmt(e.avg, 2)}%"><span class="mid"></span><span class="fill ${neg ? "neg" : ""}" style="${neg ? `left:${50 - w}%;--o:right` : "left:50%"};width:${w}%"></span></div></div>
            <div class="e-v ${neg ? "neg" : "pos"}">${sfmt(e.avg, 2)}%</div></div>`; }).join("")}
      </section>
    </div>
  </div>`;

  const x = B.equity.map((r) => r.d);
  const xfmt = (d, axis) => new Date(d).toLocaleDateString("ru-RU", axis ? { month: "short", year: "numeric" } : { day: "numeric", month: "long", year: "numeric" });
  const chart = lineChart($("#eq"), {
    x, label: "Капитал робота, индекса МосБиржи и равновзвешенного портфеля, старт = 100", baseline: 100,
    yfmt: (v, tip) => fmt(v, tip ? 1 : 0), xfmt,
    series: [
      { name: "Робот", short: "Робот", values: B.equity.map((r) => tariffHi ? r.robot_hi : r.robot), color: css("--s1"), cssColor: "--s1", width: 2.5 },
      { name: "Индекс МосБиржи", short: "Индекс", values: B.equity.map((r) => r.imoex), color: css("--s2"), cssColor: "--s2", dash: "6 5", width: 1.75 },
      { name: "Поровну", short: "Поровну", values: B.equity.map((r) => r.ew), color: css("--s3"), cssColor: "--s3", dash: "1.5 4", width: 2.25 },
    ],
  });
  const seg = $("#tariff"); segInd(seg); seg.addEventListener("keydown", radioKeys);
  $$("button", seg).forEach((b) => b.addEventListener("click", () => {
    tariffHi = b.dataset.t === "1";
    $$("button", seg).forEach((x2) => x2.setAttribute("aria-checked", x2 === b)); segInd(seg);
    chart.update(0, B.equity.map((r) => tariffHi ? r.robot_hi : r.robot));
    const box = $("#stats"); box.style.opacity = ".35"; setTimeout(() => { box.innerHTML = statTiles(); box.style.opacity = ""; }, 140);
    if (showTable) $("#tblbox").innerHTML = eqTable();
  }));
  $("#tbl").addEventListener("click", (e) => { showTable = !showTable; e.target.textContent = showTable ? "Скрыть таблицу" : "Показать значения таблицей"; e.target.setAttribute("aria-expanded", showTable); $("#tblbox").innerHTML = showTable ? eqTable() : ""; });

  function statTiles() {
    return `<article class="card stat big"><div class="s-l">Доходность ${yr(B.from)}–${yr(B.to)}</div><div class="s-v ${String(stats()["доходность"]).startsWith("-") ? "neg" : ""}">${S("доходность")}</div><div class="s-h">${S("годовых")} годовых · комиссия ${tariffHi ? "0,3" : "0,05"}%</div></article>
      <article class="card stat"><div class="s-l">Макс. ${T("просадка")}</div><div class="s-v">${S("макс. просадка")}</div><div class="s-h">индекс: ${sfmt(idxEnd, 0)}% за период</div></article>
      <article class="card stat"><div class="s-l">${T("Sharpe")}</div><div class="s-v">${S("Sharpe")}</div><div class="s-h">доходность на единицу риска</div></article>
      <article class="card stat"><div class="s-l">Сделок · прибыльных</div><div class="s-v">${S("сделок")} · ${S("прибыльных")}</div><div class="s-h">средняя сделка ${S("средняя сделка")}</div></article>`;
  }
  function eqTable() {
    return `<div class="tbl-wrap"><table><caption class="sr">Значения по месяцам</caption><thead><tr><th>Неделя</th><th class="r">Робот (${tariffHi ? "0,3" : "0,05"}%)</th><th class="r">Индекс</th><th class="r">Поровну</th></tr></thead><tbody>
      ${B.equity.filter((_, i) => i % 4 === 0 || i === B.equity.length - 1).map((r) => `<tr><td>${new Date(r.d).toLocaleDateString("ru-RU")}</td><td class="r">${fmt(tariffHi ? r.robot_hi : r.robot, 1)}</td><td class="r">${fmt(r.imoex, 1)}</td><td class="r">${fmt(r.ew, 1)}</td></tr>`).join("")}
      </tbody></table></div>`;
  }
}

/* ============ маршрутизация ============ */
let currentTab = "feed";
function route(opt = {}) {
  if (!D) return;
  const h = location.hash || "#/feed";
  const [, tab, arg] = h.split("/");
  const sect = tab === "card" ? "feed" : ({ feed: 1, safety: 1, learn: 1, results: 1 }[tab] ? tab : "feed");
  currentTab = sect;
  $$(".nav a, .tabbar a").forEach((a) => a.dataset.tab === sect ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current"));
  moveNav(sect);
  hidePop();
  const y = scrollY;
  ({ feed: viewFeed, card: () => viewCard(arg), safety: viewSafety, learn: viewLearn, results: viewResults }[tab] || viewFeed)();
  if (opt.keepScroll) { scrollTo(0, y); $$(".enter", app).forEach((e) => e.classList.remove("enter")); }
  else { scrollTo({ top: 0 }); if (!opt.quiet && opt.focus !== false) app.focus({ preventScroll: true }); }
  document.title = { feed: "Лента", card: "Решение", safety: "Страховка", learn: "Учёба", results: "Результаты" }[tab || "feed"] + " — Робот-наставник";
}
addEventListener("hashchange", () => route());
document.fonts?.ready?.then(() => moveNav(currentTab));
boot();
