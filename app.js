// Робот-наставник — статичный MVP кабинета. Данные: data/data.json (выгрузка tools/export_mvp.py).
const $ = (s, el = document) => el.querySelector(s);
const app = $("#app");
const fmt = (x, d = 0) => x == null ? "—" : Number(x).toLocaleString("ru-RU", { minimumFractionDigits: d, maximumFractionDigits: d });
const rub = (x, d = 0) => x == null ? "—" : `${fmt(x, d)} ₽`;
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const dt = (iso) => new Date(iso).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

// ---------- глоссарий: наведение на термин → объяснение ----------
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
const T = (word, label = word) => `<span class="term" tabindex="0" data-term="${esc(word)}">${esc(label)}</span>`;
const tip = $("#tip");
function showTip(el) {
  const text = GLOSS[el.dataset.term]; if (!text) return;
  tip.textContent = text; tip.hidden = false;
  const r = el.getBoundingClientRect();
  tip.style.left = Math.min(window.innerWidth - 316, Math.max(8, r.left)) + "px";
  tip.style.top = (r.bottom + 8) + "px";
}
document.addEventListener("mouseover", (e) => { const t = e.target.closest(".term"); t ? showTip(t) : (tip.hidden = true); });
document.addEventListener("focusin", (e) => { const t = e.target.closest(".term"); t ? showTip(t) : (tip.hidden = true); });
document.addEventListener("scroll", () => (tip.hidden = true), { passive: true });

function toast(msg) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => (t.hidden = true), 2600); }

// ---------- тема и режим доверия ----------
const root = document.documentElement;
const savedTheme = localStorage.getItem("theme"); if (savedTheme) root.dataset.theme = savedTheme;
$("#theme").onclick = () => {
  const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  root.dataset.theme = dark ? "light" : "dark"; localStorage.setItem("theme", root.dataset.theme); route();
};
let trust = localStorage.getItem("trust") || "autopilot";
function paintTrust() { document.querySelectorAll("#trust button").forEach((b) => b.setAttribute("aria-checked", b.dataset.mode === trust)); }
document.querySelectorAll("#trust button").forEach((b) => (b.onclick = () => {
  trust = b.dataset.mode; localStorage.setItem("trust", trust); paintTrust(); route();
  toast({ observe: "Наблюдение: робот только предлагает, решаете вы", autopilot: "Автопилот: робот торгует сам в рамках страховки", paper: "Учебный: тот же робот, но на счёте без денег" }[trust]);
}));
paintTrust();

// ---------- данные ----------
// Живая лента: data.json обновляется на сервере каждые 5 минут в торговые часы,
// страница перечитывает его раз в минуту и перерисовывает текущий экран.
const load = () => fetch(`data/data.json?t=${Date.now()}`, { cache: "no-store" }).then((r) => r.json());
let D = await load();
const seen = new Set(D.cards.map((c) => c.id));
function marketOpen(now = new Date()) {
  const msk = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Moscow" }));
  const m = msk.getHours() * 60 + msk.getMinutes(), wd = msk.getDay();
  return wd >= 1 && wd <= 5 && m >= 10 * 60 + 5 && m <= 18 * 60 + 35;
}
function paintLive() {
  const ago = Math.max(0, Math.round((Date.now() - new Date(D.generated)) / 60000));
  const agoTxt = ago < 1 ? "только что" : ago < 60 ? `${ago} мин назад` : new Date(D.generated).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  $("#gen").textContent = marketOpen() ? `● в эфире · обновлено ${agoTxt}` : `биржа закрыта · последнее обновление ${agoTxt}`;
}
paintLive();
setInterval(async () => {
  try {
    const fresh = await load();
    if (fresh.generated !== D.generated) {
      const added = fresh.cards.filter((c) => !seen.has(c.id));
      added.forEach((c) => seen.add(c.id));
      D = fresh;
      if (!/#\/(card|learn)/.test(location.hash)) route();
      if (added.length) toast(`Новых решений робота: ${added.length}`);
    }
  } catch { /* сеть моргнула — попробуем через минуту */ }
  paintLive();
}, 60000);

const STATUS = {
  done: ["b-done", "Исполнено"], attention: ["b-attn", "Исполнено с оговорками"], blocked: ["b-block", "Остановлено проверкой"],
  skipped: ["b-skip", "Не вошёл"], wait: ["b-wait", "Ждёт вашего решения"],
};
function statusOf(c) {
  if (c.status === "blocked") return "blocked";
  if (c.status === "skipped") return "skipped";
  if (trust === "observe" && c.execution) return "wait";
  return c.execution ? "done" : "skipped";
}
const badge = (k) => `<span class="badge ${STATUS[k][0]}"><span class="dot" aria-hidden="true"></span>${STATUS[k][1]}</span>`;

// Человеческий пересказ причины сигнала — только из фактических значений карточки
function humanSignal(c) {
  const parts = [];
  const s = c.signal || "";
  if (/пробой/.test(s)) parts.push(`цена ${T("пробой", "пробила")} максимум за 55 дней`);
  if (/пересёк slow вверх/.test(s)) parts.push(`быстрая ${T("SMA", "средняя")} пересекла медленную снизу вверх`);
  if (/тренд по SMA/.test(s)) parts.push(`идёт восходящий тренд: быстрая ${T("SMA", "средняя")} выше медленной`);
  const ml = (c.votes || []).find((v) => v.layer === "ML");
  if (ml) parts.push(`${T("ML")} даёт вероятность роста ${fmt(ml.value * 100)}%${ml.value < 0.5 ? " — скорее против, но не запрещает вход" : ""}`);
  return parts.length ? parts.join("; ") : esc(s);
}
function humanRisk(c) {
  const r = c.risk || "";
  let m;
  if ((m = r.match(/уже (\d+)% портфеля в коррелированных/))) return `уже ${m[1]}% портфеля в бумагах, которые ходят вместе с этой (${T("корреляция", "корреляция")}), лимит — ${D.limits.max_cluster_exposure_pct}%`;
  if ((m = r.match(/объём (\d+) меньше минимальной позиции/))) return `на неё осталось бы только ${rub(m[1])} — меньше минимальной позиции ${D.limits.min_position_pct}% портфеля, такая покупка ничего не даёт`;
  if ((m = r.match(/бюджет (\d+) < стоимости лота (\d+)/))) return `свободный лимит ${rub(m[1])} меньше цены одного ${T("лот", "лота")} (${rub(m[2])})`;
  if (/кулдаун/.test(r)) return "по этой бумаге уже была сделка меньше часа назад — робот не дёргается";
  if (/режим рынка/.test(r)) return `рынок в целом падает (${T("режим рынка")}) — новые покупки на паузе`;
  if (/пауза на входы/.test(r)) return `после трёх ${T("стоп-лосс", "стоп-лоссов")} подряд робот берёт паузу`;
  if (/фильтр сделок/.test(r)) return `модель качества сделок оценивает шанс успеха как низкий`;
  if (/Перед сделкой/.test(r)) return "заявку остановили проверки перед сделкой";
  return esc(r);
}

// ---------- лента ----------
let feedFilter = "all";
function viewFeed() {
  const cards = D.cards;
  const last = cards.find((c) => c.after) || {};
  const done = cards.filter((c) => c.execution).length;
  const blocked = cards.filter((c) => c.status === "blocked").length;
  const skipped = cards.filter((c) => c.status === "skipped").length;
  const raw = cards.filter((c) => feedFilter === "all" || (feedFilter === "trades" ? c.execution : feedFilter === "blocked" ? c.status === "blocked" : c.status === "skipped"));
  // одинаковые отказы одного цикла схлопываем: «ещё 19 бумаг — не хватило лимита»
  const list = [], groups = {};
  for (const c of raw) {
    if (c.status !== "skipped") { list.push(c); continue; }
    const key = c.ts.slice(0, 15) + "|" + (c.risk || "").replace(/[\d.,:]+/g, "N");
    if (groups[key]) { groups[key].more.push(c); continue; }
    groups[key] = { ...c, more: [] }; list.push(groups[key]);
  }
  app.innerHTML = `
    <div class="tiles">
      <div class="tile"><div class="label">Портфель</div><div class="value num">${rub(last.after?.total)}</div><div class="hint">${T("paper-счёт")}, старт 1 000 000 ₽</div></div>
      <div class="tile"><div class="label">Свободные деньги</div><div class="value num">${rub(last.after?.cash)}</div><div class="hint">робот держит до ${D.limits.max_total_exposure_pct}% в бумагах</div></div>
      <div class="tile"><div class="label">Сделок</div><div class="value">${done}</div><div class="hint">каждая с объяснением</div></div>
      <div class="tile"><div class="label">Остановлено и пропущено</div><div class="value">${blocked + skipped}</div><div class="hint">тоже объяснены — это половина обучения</div></div>
    </div>
    ${trust === "observe" ? `<div class="panel note">Режим «Наблюдение»: робот ничего не покупает сам. Сделки ниже он <b>предлагает</b> — откройте карточку и подтвердите или отклоните.</div>` : ""}
    <div class="filters" role="group" aria-label="Фильтр ленты">
      ${[["all", "Все"], ["trades", "Сделки"], ["blocked", "Остановлены"], ["skipped", "Не вошёл"]].map(([k, l]) => `<button class="chip" data-f="${k}" aria-pressed="${feedFilter === k}">${l}</button>`).join("")}
    </div>
    <div class="feed">${list.map((c) => {
      const k = statusOf(c);
      const more = c.more?.length ? ` <span class="muted">и ещё ${c.more.length}: ${c.more.map((m) => esc(m.ticker)).join(", ")}</span>` : "";
      const what = c.execution ? `${c.side === "buy" ? "Купил" : "Продал"} ${fmt(c.lots)} лот. на ${rub(c.execution.amount)}` : c.status === "blocked" ? `Хотел купить ${fmt(c.lots)} лот.` : "Хотел купить";
      const why = c.status === "skipped" ? `Не стал: ${humanRisk(c)}` : c.status === "blocked" ? `Остановлено: ${(c.blocking || []).map(ruleRu).join(", ")}` : `Почему: ${humanSignal(c)}`;
      return `<a class="item" href="#/card/${c.id}"><div><div class="tk">${esc(c.ticker)}</div><div class="nm">${esc(c.name)}</div></div>
        <div><div>${what}${more}</div><div class="why">${why.replace(/на неё осталось бы только [\d\s\u00a0]+ ₽ — /, c.more?.length ? "на них оставалось ~" + rub(Number((c.risk.match(/объём (\d+)/) || [])[1])) + " — " : "$&")}</div></div>
        <div class="meta">${badge(k)}<div>${dt(c.ts)}</div></div></a>`;
    }).join("") || `<div class="panel muted">Нет записей под этот фильтр.</div>`}</div>`;
  app.querySelectorAll(".chip").forEach((b) => (b.onclick = () => { feedFilter = b.dataset.f; viewFeed(); }));
}

const RULES_RU = {
  "quote.stale": "котировка устарела", "order.amount_limit": "сумма больше лимита на сделку",
  "concentration.instrument": "доля бумаги выше лимита", "concentration.issuer": "доля эмитента выше лимита",
  "cash.insufficient": "не хватает денег", "position.insufficient": "продажа больше, чем есть",
  "data.freshness": "данные несвежие", "price.not_guaranteed": "цена исполнения не гарантирована",
};
const ruleRu = (id) => RULES_RU[id] || id;

// ---------- карточка ----------
function voteRow(v) {
  let pos = 0, neg = false, label = "";
  if (v.layer === "техника") { pos = 1; label = "за покупку"; }
  else if (v.layer === "ML") { const x = (v.value - 0.5) * 2; pos = Math.abs(x); neg = x < 0; label = `${fmt(v.value * 100)}% рост`; }
  else { pos = Math.min(1, Math.abs(v.value)); neg = v.value < 0; label = `${v.value > 0 ? "+" : ""}${fmt(v.value, 2)}`; }
  const w = pos * 50;
  const style = v.layer === "техника" ? `left:50%;width:50%` : neg ? `left:${50 - w}%;width:${w}%` : `left:50%;width:${w}%`;
  const name = v.layer === "техника" ? T("SMA", "Техника") : v.layer === "ML" ? T("ML") : "Новости";
  return `<div class="vote"><div>${name}<div class="muted" style="font-size:12px">${label}</div></div>
    <div class="track" role="img" aria-label="${esc(v.layer)}: ${esc(label)}"><div class="mid"></div><div class="fill ${neg ? "neg" : ""}" style="${style}"></div></div>
    <div class="w">вес ${fmt(v.weight, 1)}</div></div>`;
}
function viewCard(id) {
  const c = D.cards.find((x) => String(x.id) === id);
  if (!c) { app.innerHTML = `<a class="back" href="#/feed">← Лента</a><p>Карточка не найдена.</p>`; return; }
  const k = statusOf(c);
  const tech = (c.votes || []).find((v) => v.layer === "техника")?.details || {};
  const ex = c.execution;
  const pos = (v) => Object.fromEntries((v?.positions || []).map((p) => [p.ticker, p]));
  const b = pos(c.before), a = pos(c.after);
  const tickers = [...new Set([...Object.keys(b), ...Object.keys(a)])];
  app.innerHTML = `
    <a class="back" href="#/feed">← Лента</a>
    <div class="panel">
      <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-start">
        <div><h1>${esc(c.ticker)} · ${esc(c.name)}</h1><div class="sec">${dt(c.ts)}</div></div>${badge(k)}
      </div>
      ${ex ? `<p style="font-size:17px">Робот ${c.side === "buy" ? "купил" : "продал"} <b>${fmt(c.trade?.qty)} шт.</b> (${fmt(c.lots)} ${T("лот", "лот.")}) по <b>${rub(ex.price, 2)}</b> на <b>${rub(ex.amount)}</b>. ${T("комиссия", "Комиссия")} ≈ ${rub(c.trade?.commission, 2)}, ${T("проскальзывание")} учтено в цене.</p>`
        : c.status === "blocked" ? `<p style="font-size:17px">Робот хотел купить ${fmt(c.lots)} лот., но проверки перед сделкой его остановили: <b>${(c.blocking || []).map(ruleRu).join(", ")}</b>.</p>`
        : `<p style="font-size:17px">Сигнал на покупку был, но робот <b>не стал входить</b>: ${humanRisk(c)}.</p>`}
      ${k === "wait" ? `<div class="duel-actions"><button class="btn primary" data-act="ok">Подтвердить сделку</button><button class="btn" data-act="no">Отклонить</button></div>` : ""}
    </div>
    <div class="grid2">
      <div class="panel">
        <h2>Почему</h2>
        <p class="sec">${humanSignal(c)}.</p>
        ${(c.votes || []).map(voteRow).join("")}
        <p class="note">Решение принимает техника; новости и ${T("ML")} могут запретить вход или изменить уверенность. Серая черта — нейтраль.</p>
        <dl class="kv">
          <dt>Быстрая / медленная ${T("SMA", "средняя")}</dt><dd>${fmt(tech.sma_fast, 2)} / ${fmt(tech.sma_slow, 2)} ₽</dd>
          <dt>${T("моментум", "Рост за 8 дней")}</dt><dd>${tech.momentum_pct != null ? (tech.momentum_pct > 0 ? "+" : "") + fmt(tech.momentum_pct, 1) + "%" : "—"}</dd>
          <dt>${T("RSI")}</dt><dd>${tech.rsi_14 != null ? fmt(tech.rsi_14 * 100) : "—"}</dd>
          <dt>${T("волатильность", "Дневная волатильность")}</dt><dd>${tech.volatility_10 != null ? fmt(tech.volatility_10 * 100, 1) + "%" : "—"}</dd>
        </dl>
      </div>
      <div class="panel">
        <h2>Проверки перед сделкой</h2>
        ${c.findings.length ? c.findings.map((f) => `<div class="finding"><div class="ic ${f.severity}" aria-hidden="true">${f.severity === "passed" ? "✓" : f.severity === "attention" ? "!" : "✕"}</div>
          <div><div class="t">${esc(f.title)}</div><div class="m">${esc(f.message)}</div></div></div>`).join("")
          : `<p class="sec">До расчёта не дошло: робот отказался сам — ${humanRisk(c)}.</p>`}
        <p class="note">Риск-контур робота: ${esc(c.risk || "—")}</p>
      </div>
    </div>
    ${c.before ? `<div class="panel"><h2>Портфель до и после</h2>
      <table><thead><tr><th>Бумага</th><th class="r">Доля до</th><th class="r">Доля после</th><th class="r">Стоимость после</th></tr></thead><tbody>
      ${tickers.map((t) => `<tr${t === c.ticker ? ' style="font-weight:650"' : ""}><td>${esc(t)}</td><td class="r">${b[t] ? fmt(b[t].share, 1) + "%" : "—"}</td><td class="r">${a[t] ? fmt(a[t].share, 1) + "%" : "—"}</td><td class="r">${a[t] ? rub(a[t].value) : "—"}</td></tr>`).join("")}
      <tr><td>Свободные деньги</td><td class="r">${rub(c.before.cash)}</td><td class="r">${rub(c.after.cash)}</td><td></td></tr>
      <tr><td>Всего</td><td class="r">${rub(c.before.total)}</td><td class="r">${rub(c.after.total)}</td><td></td></tr>
      </tbody></table><p class="note">«После» — модель: полное исполнение по цене котировки минус комиссия.</p></div>` : ""}`;
  app.querySelectorAll("[data-act]").forEach((btn) => (btn.onclick = () => toast(btn.dataset.act === "ok" ? "В демо заявка не отправляется. В рабочей версии — подтверждение с привязкой к цене и сроку." : "Отклонено. Робот запомнит, что вы не согласились — это попадёт в разбор.")));
}

// ---------- страховка ----------
const LIMITS = [
  ["max_position_pct", "Не больше %v% денег в одной бумаге", "Если бумага упадёт вдвое, портфель потеряет не больше половины этой доли.", 5, 25, 1],
  ["max_total_exposure_pct", "Не больше %v% портфеля в акциях", "Остальное — деньги. Запас на просадки и новые возможности.", 20, 90, 5],
  ["stop_loss_pct", "Продать, если бумага упала на %v%", "Это стоп-лосс. Ограничивает убыток по одной сделке.", 3, 15, 1],
  ["take_profit_pct", "Зафиксировать прибыль при +%v%", "Тейк-профит. Плюс трейлинг: при росте уровень выхода подтягивается.", 5, 40, 1],
  ["max_daily_loss_pct", "Стоп на день при −%v% за день", "Новые сделки прекращаются до завтра.", 1, 10, 0.5],
  ["max_portfolio_drawdown_pct", "Всё продать при просадке −%v% от пика", "Предохранитель: робот уходит в деньги и делает паузу на 48 часов.", 5, 30, 1],
];
function viewSafety() {
  const stopped = localStorage.getItem("stopall") === "1";
  app.innerHTML = `
    <div class="grid2">
      <div class="panel">
        <h2>Страховка</h2>
        <p class="sec">Лимиты, в рамках которых робот работает сам. Двигайте в разрешённых границах — шире не даст платформа.</p>
        ${LIMITS.map(([key, say, ex, min, max, step]) => {
          const v = localStorage.getItem("lim_" + key) ?? D.limits[key];
          return `<div class="limit"><div><div class="say" data-say="${esc(say)}">${say.replace("%v", fmt(v, step < 1 ? 1 : 0))}</div><div class="ex">${ex}</div></div>
            <input type="range" min="${min}" max="${max}" step="${step}" value="${v}" data-k="${key}" aria-label="${esc(say.replace("%v", "N"))}">
            <output>${fmt(v, step < 1 ? 1 : 0)}%</output></div>`;
        }).join("")}
        <p class="note">Ещё работают всегда: не больше ${D.limits.max_trades_per_day} сделок в день, не больше ${D.limits.max_cluster_exposure_pct}% в бумагах, которые ходят вместе (${T("корреляция")}), пауза после ${D.limits.loss_streak_n} стоп-лоссов подряд, без ${T("шорт", "шортов")} и плеча.</p>
      </div>
      <div class="panel">
        <h2>Кнопка «Стоп-всё»</h2>
        <p class="sec">Мгновенно запрещает роботу новые сделки. Открытые позиции остаются под стопами. Снять — той же кнопкой.</p>
        <button class="stop ${stopped ? "on" : ""}" id="stopall">${stopped ? "▶ Возобновить торговлю" : "■ Стоп-всё"}</button>
        <p class="note">${stopped ? "Сейчас: торговля остановлена вами." : "Сейчас: робот торгует в рамках страховки."} В демо кнопка ничего не отправляет.</p>
        <h3 style="margin-top:18px">Режимы доверия</h3>
        <dl class="kv"><dt>Наблюдение</dt><dd>робот предлагает, решаете вы</dd><dt>Автопилот</dt><dd>робот торгует сам в рамках лимитов</dd><dt>Учебный</dt><dd>${T("paper-счёт")} без денег</dd></dl>
      </div>
    </div>`;
  app.querySelectorAll("input[type=range]").forEach((r) => (r.oninput = () => {
    const row = r.closest(".limit"); const step = Number(r.step);
    row.querySelector("output").textContent = fmt(r.value, step < 1 ? 1 : 0) + "%";
    const say = row.querySelector(".say"); say.textContent = say.dataset.say.replace("%v", fmt(r.value, step < 1 ? 1 : 0));
    localStorage.setItem("lim_" + r.dataset.k, r.value);
  }));
  $("#stopall").onclick = () => { localStorage.setItem("stopall", stopped ? "0" : "1"); viewSafety(); toast(stopped ? "Торговля возобновлена" : "Стоп-всё: новые сделки запрещены"); };
}

// ---------- SVG-график линии с перекрестием ----------
function lineChart({ series, x, height = 280, yFmt = (v) => fmt(v), xFmt = (v) => v, mark, frac = 1 }) {
  const mainW = Math.min(1200, $("main").clientWidth) - 48;
  const W = Math.max(300, Math.round((window.innerWidth > 820 ? mainW * frac : mainW) - 40)), H = height, L = 44, R = 70, Tp = 12, B = 26;
  const all = series.flatMap((s) => s.values.filter((v) => v != null));
  let lo = Math.min(...all), hi = Math.max(...all); const pad = (hi - lo) * 0.08 || 1; lo -= pad; hi += pad;
  const n = x.length;
  const sx = (i) => L + (i / (n - 1)) * (W - L - R);
  const sy = (v) => Tp + (1 - (v - lo) / (hi - lo)) * (H - Tp - B);
  const ticks = 4, yt = Array.from({ length: ticks + 1 }, (_, i) => lo + ((hi - lo) * i) / ticks);
  const xt = [0, Math.floor(n / 3), Math.floor((2 * n) / 3), n - 1];
  const path = (vals, from = 0, to = n - 1) => vals.slice(from, to + 1).map((v, j) => v == null ? "" : `${j === 0 ? "M" : "L"}${sx(from + j).toFixed(1)},${sy(v).toFixed(1)}`).join("");
  const id = "c" + Math.random().toString(36).slice(2, 7);
  const svg = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(series.map((s) => s.name).join(", "))}" id="${id}">
    <g class="grid">${yt.map((v) => `<line x1="${L}" x2="${W - R}" y1="${sy(v)}" y2="${sy(v)}"/><text x="${L - 6}" y="${sy(v) + 4}" text-anchor="end">${yFmt(v)}</text>`).join("")}</g>
    <line class="base" x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}"/>
    ${xt.map((i) => `<text x="${sx(i)}" y="${H - 8}" text-anchor="middle">${esc(xFmt(x[i]))}</text>`).join("")}
    ${mark != null ? `<rect x="${sx(mark)}" y="${Tp}" width="${W - R - sx(mark)}" height="${H - Tp - B}" fill="var(--surface-2)"/><line x1="${sx(mark)}" x2="${sx(mark)}" y1="${Tp}" y2="${H - B}" stroke="var(--axis)" stroke-dasharray="3 3"/>` : ""}
    ${series.map((s) => `<path d="${path(s.values)}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" ${s.dash ? 'stroke-dasharray="5 4"' : ""}/>`).join("")}
    ${series.map((s) => { const i = s.values.length - 1 - [...s.values].reverse().findIndex((v) => v != null); return s.label === false ? "" : `<text x="${sx(i) + 6}" y="${sy(s.values[i]) + 4}" style="fill:var(--text-secondary)">${esc(s.short || s.name)}</text>`; }).join("")}
    <g class="hover" style="display:none"><line y1="${Tp}" y2="${H - B}" stroke="var(--axis)"/>${series.map((s) => `<circle r="4" fill="${s.color}" stroke="var(--surface-1)" stroke-width="2"/>`).join("")}</g>
    <rect x="${L}" y="${Tp}" width="${W - L - R}" height="${H - Tp - B}" fill="transparent" class="hit"/>
  </svg>`;
  const bind = () => {
    const el = document.getElementById(id); if (!el) return;
    const g = el.querySelector(".hover"), hit = el.querySelector(".hit");
    const move = (ev) => {
      const pt = el.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
      const p = pt.matrixTransform(el.getScreenCTM().inverse());
      const i = Math.max(0, Math.min(n - 1, Math.round(((p.x - L) / (W - L - R)) * (n - 1))));
      g.style.display = ""; g.querySelector("line").setAttribute("x1", sx(i)); g.querySelector("line").setAttribute("x2", sx(i));
      g.querySelectorAll("circle").forEach((c, k) => { const v = series[k].values[i]; c.style.display = v == null ? "none" : ""; if (v != null) { c.setAttribute("cx", sx(i)); c.setAttribute("cy", sy(v)); } });
      tip.innerHTML = `<b>${esc(xFmt(x[i]))}</b><br>` + series.filter((s) => s.values[i] != null).map((s) => `<span style="display:inline-block;width:10px;height:3px;background:${s.color};vertical-align:middle;margin-right:6px"></span>${esc(s.name)}: ${yFmt(s.values[i])}`).join("<br>");
      tip.hidden = false; tip.style.left = Math.min(window.innerWidth - 316, ev.clientX + 14) + "px"; tip.style.top = ev.clientY + 14 + "px";
    };
    hit.addEventListener("pointermove", move); hit.addEventListener("pointerleave", () => { g.style.display = "none"; tip.hidden = true; });
  };
  return [svg, bind];
}
const css = (v) => getComputedStyle($(".viz-root")).getPropertyValue(v).trim();

// ---------- учёба: дуэль + глоссарий ----------
let duelI = 0, duelScore = { you: 0, robot: 0, n: 0 }, duelChoice = null;
function viewLearn() {
  const d = D.duel[duelI % D.duel.length];
  const revealed = duelChoice != null;
  const vals = revealed ? [...d.before, ...d.after.slice(1)] : d.before;
  const x = vals.map((_, i) => i - d.before.length + 1);
  const [svg, bind] = lineChart({ series: [{ name: d.ticker, values: vals, color: css("--series-1"), label: false }], x, height: 240, frac: 0.5,
    yFmt: (v) => fmt(v, v < 100 ? 2 : 0), xFmt: (v) => v === 0 ? "решение" : v < 0 ? `${v} дн.` : `+${v} дн.`, mark: revealed ? d.before.length - 1 : null });
  let verdict = "";
  if (revealed) {
    verdict = `<div class="verdict"><b>Робот купил.</b> Причина: ${d.robot_reason}. Вышел через ${d.hold_days} дн. (${esc(d.exit_reason)}), результат <b class="${d.robot_pnl >= 0 ? "up" : "down"}">${d.robot_pnl > 0 ? "+" : ""}${fmt(d.robot_pnl, 1)}%</b>.
      <br>Вы ${duelChoice === "buy" ? "купили — ваш результат такой же" : "пропустили — ваш результат 0%"}. ${duelChoice === "skip" && d.robot_pnl < 0 ? "Здесь осторожность была правильной." : duelChoice === "buy" && d.robot_pnl < 0 ? `Сработал ${T("стоп-лосс")} или выход по сигналу — убыток ограничен.` : ""}
      <div class="note" style="margin-top:6px">Ситуация из реальной истории: ${esc(d.ticker)}, ${new Date(d.date).toLocaleDateString("ru-RU")}. Счёт: вы ${fmt(duelScore.you, 1)}% · робот ${fmt(duelScore.robot, 1)}% за ${duelScore.n} раунд(ов).</div></div>`;
  }
  app.innerHTML = `
    <div class="grid2">
      <div class="panel">
        <h2>Дуэль с роботом</h2>
        <p class="sec">Перед вами 60 дней цены бумаги <b>${revealed ? esc(d.ticker) : "«X»"}</b>. Робот видит здесь сигнал. Купили бы вы? После ответа покажем, что было дальше.</p>
        ${svg}
        <div class="duel-actions">
          ${revealed ? `<button class="btn primary" id="next">Следующая ситуация →</button>`
            : `<button class="btn primary" data-c="buy">Купить</button><button class="btn" data-c="skip">Пропустить</button>`}
          <span class="score">Раунд ${duelI % D.duel.length + 1} из ${D.duel.length}</span>
        </div>
        ${verdict}
      </div>
      <div class="panel">
        <h2>Словарь</h2>
        <p class="sec">Эти слова подчёркнуты пунктиром по всему кабинету — наведите или нажмите, чтобы увидеть объяснение.</p>
        <dl class="kv" style="grid-template-columns:130px 1fr">${Object.entries(GLOSS).map(([k, v]) => `<dt>${esc(k)}</dt><dd style="font-variant-numeric:normal">${esc(v)}</dd>`).join("")}</dl>
      </div>
    </div>
    <div class="panel"><h2>Дальше в учебном слое</h2><p class="sec">Разбор «что было бы, если…» по каждой сделке · энциклопедия стратегий и известных трейдеров · прогресс: какие темы пройдены и где вы чаще ошибаетесь.</p></div>`;
  bind();
  app.querySelectorAll("[data-c]").forEach((b) => (b.onclick = () => {
    duelChoice = b.dataset.c; duelScore.n++; duelScore.robot += d.robot_pnl; if (duelChoice === "buy") duelScore.you += d.robot_pnl; viewLearn();
  }));
  const nx = $("#next"); if (nx) nx.onclick = () => { duelI++; duelChoice = null; viewLearn(); };
}

// ---------- результаты ----------
let tariffHi = false, showTable = false;
function viewResults() {
  const B = D.backtest, st0 = tariffHi ? B.stats_hi : B.stats;
  const st = Object.fromEntries(Object.entries(st0).map(([k, v]) => [k, String(v).replace(".", ",").replace("-", "−")]));
  const x = B.equity.map((r) => r.d);
  const robot = { name: tariffHi ? "Робот (комиссия 0,3%)" : "Робот (комиссия 0,05%)", short: "Робот", values: B.equity.map((r) => tariffHi ? r.robot_hi : r.robot), color: css("--series-1") };
  const imoex = { name: "Индекс МосБиржи", short: "Индекс", values: B.equity.map((r) => r.imoex), color: css("--series-2") };
  const ew = { name: "Все 40 бумаг поровну", short: "Поровну", values: B.equity.map((r) => r.ew), color: css("--series-3") };
  const [svg, bind] = lineChart({ series: [robot, imoex, ew], x, yFmt: (v) => fmt(v), xFmt: (d) => new Date(d).toLocaleDateString("ru-RU", { month: "short", year: "numeric" }) });
  const maxAbs = Math.max(...B.exits.map((e) => Math.abs(e.avg)));
  const EXIT_RU = { "SMA": "разворот средних", "смена": "смена режима рынка", "стоп-лосс": "стоп-лосс", "тейк-профит": "тейк-профит", "трейлинг": "трейлинг", "предохранитель": "предохранитель просадки" };
  app.innerHTML = `
    <div class="tiles">
      <div class="tile"><div class="label">Доходность за ${B.from.slice(0, 4)}–${B.to.slice(0, 4)}</div><div class="hero">${st["доходность"]}</div><div class="hint">${st["годовых"]} годовых</div></div>
      <div class="tile"><div class="label">Макс. ${T("просадка")}</div><div class="value">${st["макс. просадка"]}</div><div class="hint">индекс за то же время ${fmt(B.equity.at(-1).imoex - 100, 0).replace("-", "−")}%</div></div>
      <div class="tile"><div class="label">${T("Sharpe")}</div><div class="value">${st["Sharpe"]}</div><div class="hint">доходность на единицу риска</div></div>
      <div class="tile"><div class="label">Сделок / прибыльных</div><div class="value">${st["сделок"]} / ${st["прибыльных"]}</div><div class="hint">средняя сделка ${st["средняя сделка"]}</div></div>
    </div>
    <div class="panel">
      <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:baseline">
        <h2>Проверка на истории: 1 000 000 ₽ = 100</h2>
        <div class="seg" role="radiogroup" aria-label="Тариф брокера">
          <button role="radio" aria-checked="${!tariffHi}" data-t="0">Комиссия 0,05%</button><button role="radio" aria-checked="${tariffHi}" data-t="1">Комиссия 0,3%</button>
        </div>
      </div>
      <div class="legend">${[robot, imoex, ew].map((s) => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join("")}</div>
      ${svg}
      <button class="linkbtn" id="tbl">${showTable ? "Скрыть таблицу" : "Показать таблицей"}</button>
      ${showTable ? `<table style="margin-top:8px"><thead><tr><th>Неделя</th><th class="r">Робот</th><th class="r">Индекс</th><th class="r">Поровну</th></tr></thead><tbody>${B.equity.filter((_, i) => i % 4 === 0).map((r) => `<tr><td>${r.d}</td><td class="r">${fmt(tariffHi ? r.robot_hi : r.robot, 1)}</td><td class="r">${fmt(r.imoex, 1)}</td><td class="r">${fmt(r.ew, 1)}</td></tr>`).join("")}</tbody></table>` : ""}
      <p class="note">Решение по закрытию дня, исполнение по открытию следующего, ${T("стоп-лосс", "стопы")} по внутридневным минимумам с гэпами, комиссия и ${T("проскальзывание")}. Индекс — ценовой, без дивидендов. Новости и ${T("ML")} в проверку не входят. Прошлые результаты не гарантируют будущих.</p>
    </div>
    <div class="grid2">
      <div class="panel">
        <h2>Чем заканчиваются сделки</h2>
        <p class="sec">Средний результат сделки по причине выхода. Прибыль приносят ${T("тейк-профит", "тейк-профиты")}, остальное — плата за участие.</p>
        ${B.exits.slice().sort((a, b) => b.avg - a.avg).map((e) => { const w = (Math.abs(e.avg) / maxAbs) * 50; return `<div class="vote" style="grid-template-columns:150px 1fr 90px"><div>${esc(EXIT_RU[e.reason] || e.reason)}<div class="muted" style="font-size:12px">${e.n} сделок</div></div>
          <div class="track" role="img" aria-label="${esc(e.reason)} ${e.avg}%"><div class="mid"></div><div class="fill ${e.avg < 0 ? "neg" : ""}" style="${e.avg < 0 ? `left:${50 - w}%;width:${w}%` : `left:50%;width:${w}%`}"></div></div>
          <div class="w num ${e.avg >= 0 ? "up" : "down"}" style="font-size:14px">${e.avg > 0 ? "+" : ""}${fmt(e.avg, 2)}%</div></div>`; }).join("")}
      </div>
      <div class="panel">
        <h2>Честно о результатах</h2>
        <ul class="sec" style="padding-left:18px;margin:0">
          <li>Робот обгоняет рынок в основном за счёт того, что уходит в деньги, когда рынок падает (${T("режим рынка")}).</li>
          <li>На дорогом тарифе (0,3%) прибыль почти полностью съедает ${T("комиссия")} — переключите выше.</li>
          <li>За последние 12 месяцев результат около нуля. Стратегию продолжаем проверять на ${T("paper-счёт", "paper-счёте")}.</li>
          <li>Поэтому продукт — про понимание и обучение, а не про обещание дохода.</li>
        </ul>
      </div>
    </div>`;
  bind();
  app.querySelectorAll("[data-t]").forEach((b) => (b.onclick = () => { tariffHi = b.dataset.t === "1"; viewResults(); }));
  $("#tbl").onclick = () => { showTable = !showTable; viewResults(); };
}

// ---------- роутер ----------
function route() {
  const h = location.hash || "#/feed";
  const [, tab, arg] = h.split("/");
  document.querySelectorAll(".tabs a").forEach((a) => { if (a.dataset.tab === (tab === "card" ? "feed" : tab)) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
  tip.hidden = true;
  ({ feed: viewFeed, card: () => viewCard(arg), safety: viewSafety, learn: viewLearn, results: viewResults }[tab] || viewFeed)();
  window.scrollTo(0, 0);
}
window.addEventListener("hashchange", route);
let rz; window.addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => { if (/results|learn/.test(location.hash)) route(); }, 200); });
route();
