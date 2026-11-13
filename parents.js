/* Parents only (Dad, Mom): Stats (day / week / month, any period back), Tracker (calendar of every prayer) and Notes.
   Uses the shared state from index.html: entries, notes, session, PRAYERS, KIDS, RULES, windowFor, parts,
   dayKey, fmtT, fmtD, pts, money, el, icon, kidKind, api, auth, say, render. */
(function () {
  const $ = id => document.getElementById(id);
  const OK = ["ontime", "late", "verylate"];
  let statKind = "week", statOff = 0, trackKid = null, trackOff = 0, trackSel = null;   // Off = how many days / weeks / months back

  /* ---------- dates (Toronto calendar days as [y, m, d]) ---------- */
  const addDays = (p, n) => { const d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n)); return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()]; };
  const weekday = p => new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay();         // 0 = Sunday
  const dayLabel = p => new Date(Date.UTC(p[0], p[1] - 1, p[2], 12)).toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  function period(kind, off) {
    off = off || 0;
    const today = parts(Date.now());
    let start, end, label;
    if (kind === "day") {
      start = end = addDays(today, off);
      label = off === 0 ? "Today · " + dayLabel(start) : off === -1 ? "Yesterday · " + dayLabel(start) : dayLabel(start) + " " + start[0];
    } else if (kind === "week") {
      start = addDays(today, -weekday(today) + 7 * off); end = addDays(start, 6);
      label = (off === 0 ? "This week" : off === -1 ? "Last week" : (-off) + " weeks ago") + " · " + dayLabel(start) + " – " + dayLabel(end);
    } else {
      let y = today[0], m = today[1] + off; while (m < 1) { m += 12; y--; }
      start = [y, m, 1]; end = addDays(m === 12 ? [y + 1, 1, 1] : [y, m + 1, 1], -1);
      label = new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("en", { month: "long", year: "numeric", timeZone: "UTC" }) + (off === 0 ? " (this month)" : off === -1 ? " (last month)" : "");
    }
    const days = [];
    for (let d = start; dayKey(d) <= dayKey(end) && dayKey(d) <= dayKey(today); d = addDays(d, 1)) days.push(d);
    return { label, days, start, end };
  }
  // ‹ label › bar to step back and forward (never into the future)
  function stepper(label, off, set, extra) {
    const bar = el("div", "stepper"), prev = el("button", "ghost stepb", "‹"), next = el("button", "ghost stepb", "›");
    prev.setAttribute("aria-label", "Earlier"); next.setAttribute("aria-label", "Later");
    prev.onclick = () => set(off - 1); next.onclick = () => set(off + 1); next.disabled = off >= 0;
    const mid = el("div", "steplabel"); mid.append(el("b", null, label)); if (extra) mid.append(extra);
    bar.append(prev, mid, next);
    if (off < 0) { const back = el("button", "ghost xs", "Back to now"); back.onclick = () => set(0); mid.append(back); }
    return bar;
  }

  // Counting starts on the first day anything was recorded, so days before the family started using the page aren't "missed".
  // Children: from the family's first record. Dad / Mom: from their own first record (they started later).
  const startDay = child => {
    const es = child && !KIDS.some(k => k.id === child) ? entries.filter(e => e.child === child) : entries;
    return es.length ? es.reduce((m, e) => e.day < m ? e.day : m, es[0].day) : dayKey(parts(Date.now()));
  };

  /* ---------- status of one prayer on one day ---------- */
  function statusOf(child, p, prayer, now) {
    const day = dayKey(p);
    const e = entries.find(x => x.child === child && x.day === day && x.prayer === prayer && OK.includes(x.key));
    const w = windowFor(prayer, p);
    if (e) return { key: e.key, e, w, day };
    if (day < startDay(child)) return { key: "before", w, day };
    if (now < w.start) return { key: "future", w, day };
    if (now <= w.end) return { key: "open", w, day };
    return { key: "missed", w, day };
  }
  const noteFor = (child, day, prayer) => (window.notes || []).find(n => n.child === child && n.day === day && n.prayer === prayer);

  function stats(child, days) {
    const now = Date.now(), per = {};
    PRAYERS.forEach(p => per[p] = { ontime: 0, late: 0, verylate: 0, missed: 0, possible: 0 });
    let points = 0;
    days.forEach(d => PRAYERS.forEach(p => {
      const s = statusOf(child, d, p, now);
      if (s.key === "future" || s.key === "open" || s.key === "before") return;   // not due yet / before tracking started
      per[p].possible++; per[p][s.key]++; if (s.e) points += s.e.points;
    }));
    const tot = { ontime: 0, late: 0, verylate: 0, missed: 0, possible: 0 };
    PRAYERS.forEach(p => Object.keys(tot).forEach(k => tot[k] += per[p][k]));
    return { per, tot, points };
  }

  /* ---------- Stats tab ---------- */
  function renderStats() {
    const box = $("statsbody"); box.replaceChildren();
    const bar = el("div", "seg");
    [["day", "Day"], ["week", "Week"], ["month", "Month"]].forEach(([k, t]) => {
      const b = el("button", null, t); b.setAttribute("aria-pressed", String(statKind === k)); b.onclick = () => { statKind = k; statOff = 0; renderStats(); }; bar.append(b);
    });
    const per = period(statKind, statOff);
    let pick = null;
    if (statKind === "day") {                      // jump straight to a date
      pick = document.createElement("input"); pick.type = "date"; pick.className = "daypick"; pick.setAttribute("aria-label", "Choose a day");
      pick.value = dayKey(per.start); pick.max = dayKey(parts(Date.now()));
      pick.onchange = () => { if (!pick.value) return; const [y, m, d] = pick.value.split("-").map(Number), t = parts(Date.now());
        statOff = Math.min(0, Math.round((Date.UTC(y, m - 1, d) - Date.UTC(t[0], t[1] - 1, t[2])) / 86400e3)); renderStats(); };
    }
    box.append(bar, stepper(per.label, statOff, o => { statOff = Math.min(0, o); renderStats(); }, pick));
    if (statKind === "day") { renderDay(box, per.start); return; }
    box.append(el("p", "note", "Weeks run Sunday to Saturday. Counting starts " + dayLabel(startDay().split("-").map(Number)) + "; prayers whose time hasn't ended yet aren't counted as missed."));
    MEMBERS.map(id => ({ id, kid: KIDS.some(k => k.id === id) })).forEach(k => {
      const st = stats(k.id, per.days), t = st.tot, done = t.ontime + t.late + t.verylate;
      const card = el("div", "scard"), head = el("div", "shead");
      const jum = per.days.filter(d => entries.some(e => e.child === k.id && e.day === dayKey(d) && e.jumuah && OK.includes(e.key))).length;
      const name = el("div"); name.append(el("b", null, k.id), el("div", "note", done + " of " + t.possible + " prayers" + (t.possible ? " · " + Math.round(done * 100 / t.possible) + "%" : "") + (jum ? " · 🕌 Jumu'ah ×" + jum : "")));
      head.append(av(k.id, "av"), name);
      const bars = el("div", "sbar");
      [["ontime", "ok"], ["late", "lt"], ["verylate", "vl"], ["missed", "ms"]].forEach(([key, cls]) => {
        if (!t.possible || !t[key]) return; const s = el("span", cls); s.style.flexGrow = t[key]; s.title = key; bars.append(s);
      });
      if (!t.possible) bars.append(el("span", "empty"));
      const nums = el("div", "snums");
      [["On time", t.ontime, "ok"], ["Late ≤2h", t.late, "lt"], ["Late 2h+", t.verylate, "vl"], ["Missed", t.missed, "ms"], ["Points", pts(st.points), ""], k.kid ? ["Earned", money(st.points * RULES.dollarsPerPoint), "money"] : ["Rate", t.possible ? Math.round(done * 100 / t.possible) + "%" : "–", ""]]
        .forEach(([l, v, c]) => { const d = el("div", "snum " + c); d.append(el("b", null, String(v)), el("span", null, l)); nums.append(d); });
      const tw = el("div", "tablewrap"), tb = el("table", "ptable"), hr = el("tr");
      ["Prayer", "On time", "Late", "Missed", "Rate"].forEach(h => hr.append(el("th", null, h))); tb.append(hr);
      PRAYERS.forEach(p => {
        const c = st.per[p], tr = el("tr"), ok = c.ontime + c.late + c.verylate;
        tr.append(el("td", null, p), el("td", "c-ok", String(c.ontime)), el("td", "c-lt", String(c.late + c.verylate)), el("td", "c-ms", String(c.missed)),
          el("td", null, c.possible ? Math.round(ok * 100 / c.possible) + "%" : "–"));
        tb.append(tr);
      });
      tw.append(tb);
      card.append(head, bars, nums, tw); box.append(card);
    });
  }

  /* ---------- one day: how many prayers each person prayed ---------- */
  const STAT_TXT = { ontime: "On time", late: "Late", verylate: "Late 2h+", missed: "Missed", open: "Time is open", future: "Not yet", before: "Before tracking" };
  function renderDay(box, d) {
    const now = Date.now(), sum = el("div", "daysum");
    const cards = MEMBERS.map(id => {
      const ss = PRAYERS.map(p => statusOf(id, d, p, now));
      const done = ss.filter(s => s.e).length, due = ss.filter(s => s.e || s.key === "missed").length;
      const chip = el("div", "dchip"); chip.dataset.who = id;
      chip.append(av(id, "av sm"), el("b", null, id), el("span", null, done + "/5"));
      sum.append(chip);
      const card = el("div", "scard"), head = el("div", "shead"), name = el("div");
      name.append(el("b", null, id), el("div", "note", done + " of 5 prayed" + (due > done ? " · " + (due - done) + " missed" : "") + (done === 5 ? " · 🌟 all five!" : "")));
      head.append(av(id, "av"), name); card.append(head);
      const list = el("div", "dlist");
      ss.forEach((s, i) => {
        const p = PRAYERS[i], row = el("div", "drow " + ({ ontime: "ok", late: "lt", verylate: "vl", missed: "ms" }[s.key] || "nx"));
        row.append(icon(p.toLowerCase(), "ticon"), el("span", "dp", s.e && s.e.jumuah ? "Jumu'ah" : p));
        row.append(el("span", "ds", s.e ? STAT_TXT[s.key] + " · " + fmtT(s.e.at) + (s.e.by !== id ? " · by " + s.e.by : "") : STAT_TXT[s.key] || s.key));
        list.append(row);
      });
      card.append(list);
      return card;
    });
    box.append(sum, ...cards);
  }

  /* ---------- Tracker tab ---------- */
  function renderTracker() {
    const box = $("trackerbody"); box.replaceChildren();
    if (!trackKid) trackKid = KIDS[0].id;
    const kids = el("div", "seg");
    MEMBERS.forEach(id => { const b = el("button", null, id); b.setAttribute("aria-pressed", String(trackKid === id)); b.onclick = () => { trackKid = id; trackSel = null; renderTracker(); }; kids.append(b); });
    const per = period("month", trackOff), now = Date.now();
    const months = stepper(per.label, trackOff, o => { trackOff = Math.min(0, o); trackSel = null; renderTracker(); });
    const legend = el("div", "legend");
    [["ok", "On time"], ["lt", "Late ≤2h"], ["vl", "Late 2h+"], ["ms", "Missed"], ["nx", "Not due yet"], ["bf", "Before tracking"]].forEach(([c, t]) => { const s = el("span"); s.append(el("i", "dot " + c), document.createTextNode(t)); legend.append(s); });
    box.append(kids, months, legend);

    const tw = el("div", "tablewrap"), tb = el("table", "track"), hr = el("tr");
    hr.append(el("th", null, ""));
    PRAYERS.forEach(p => { const th = el("th"); th.append(icon(p.toLowerCase(), "ticon"), el("span", null, p)); hr.append(th); });
    tb.append(hr);
    per.days.slice().reverse().forEach(d => {
      const tr = el("tr"), dd = new Date(Date.UTC(d[0], d[1] - 1, d[2], 12));
      const td0 = el("td", "tday"); td0.append(el("b", null, String(d[2])), el("span", null, dd.toLocaleDateString("en", { weekday: "short", timeZone: "UTC" }))); tr.append(td0);
      PRAYERS.forEach(p => {
        const s = statusOf(trackKid, d, p, now), n = noteFor(trackKid, s.day, p);
        const cls = { ontime: "ok", late: "lt", verylate: "vl", missed: "ms", before: "bf" }[s.key] || "nx";
        const b = el("button", "tcell " + cls + (trackSel && trackSel.day === s.day && trackSel.prayer === p ? " sel" : ""));
        b.textContent = s.e ? fmtT(s.e.at).replace(/\s?[AP]M$/i, "") : s.key === "missed" ? "✕" : s.key === "before" ? "–" : "·";
        if (n) b.append(el("span", "ndot", "✎"));
        if (s.e && s.e.jumuah) b.append(el("span", "jdot", "J"));
        b.setAttribute("aria-label", p + " " + dayLabel(d) + ": " + (s.e ? s.e.label + " at " + fmtT(s.e.at) : s.key) + (n ? ", has a note" : ""));
        b.onclick = () => { trackSel = { day: s.day, prayer: p, d }; renderTracker(); };
        const td = el("td"); td.append(b); tr.append(td);
      });
      tb.append(tr);
    });
    tw.append(tb); box.append(tw);
    if (!per.days.length) box.append(el("p", "note", "Nothing yet this month."));
    if (trackSel) box.append(detail(trackKid, trackSel.d, trackSel.prayer));
  }

  function detail(child, d, prayer) {
    const s = statusOf(child, d, prayer, Date.now()), n = noteFor(child, s.day, prayer), card = el("div", "tdetail");
    const label = s.e ? (s.e.jumuah ? "🕌 Jumu'ah · " : "") + s.e.label + " · " + fmtT(s.e.at) + " · +" + pts(s.e.points) + (s.e.by !== child ? " · marked by " + s.e.by : "")
      : s.key === "missed" ? "Not prayed (missed)" : s.key === "before" ? "Before tracking started" : s.key === "open" ? "Time is open now (until " + fmtT(s.w.end) + ")" : "Not due yet (starts " + fmtT(s.w.start) + ")";
    card.append(el("b", null, child + " · " + prayer + " · " + dayLabel(d)), el("div", "note", "Adhan " + fmtT(s.w.start) + " · " + label));
    const isKid = KIDS.some(k => k.id === child);
    if (!s.e && (s.key === "missed" || s.key === "open") && window.markForm && (isKid || child === session.user)) {   // forgot to mark? allowed for 24 hours only
      if (window.canMark(s.w)) {
        const st = el("div", "status"), b = el("button", "primary", "Mark prayed");
        const msg = (m, err) => { st.className = "status" + (err ? " err" : ""); st.textContent = m; };
        b.onclick = () => b.replaceWith(window.markForm(prayer, child, d, s.w, msg, () => { document.querySelectorAll(".nov").forEach(x => x.remove()); render(); }, () => render()));
        card.append(b, st);
      } else card.append(el("div", "note", "More than 24 hours have passed since this prayer's time, so it can't be marked anymore."));
    }
    if (isKid) card.append(noteEditor(child, s.day, prayer, n));
    return card;
  }

  /* ---------- Notes (Mom & Dad) ---------- */
  function noteEditor(child, day, prayer, n) {
    const wrap = el("div", "noteed");
    const id = "note-" + child + "-" + day + "-" + prayer;
    const lab = el("label", "note", "Note (only Mom and Dad see it)"); lab.htmlFor = id;
    const ta = el("textarea"); ta.id = id; ta.maxLength = 300; ta.rows = 2; ta.value = n ? n.text : ""; ta.placeholder = "e.g. prayed with Dad at the mosque, was sick, needs help with Al-Fatiha…";
    const meta = el("div", "note", n ? "Last written by " + n.by + (n.at ? " · " + fmtD(n.at) + ", " + fmtT(n.at) : "") : "");
    const save = el("button", "primary", "Save note"), del = el("button", "ghost", "Delete");
    const st = el("div", "status");
    save.onclick = () => saveNote(child, day, prayer, ta.value, save, st);
    del.onclick = () => saveNote(child, day, prayer, "", del, st);
    const btns = el("div", "right"); btns.append(save); if (n) btns.append(del);
    wrap.append(lab, ta, meta, btns, st);
    return wrap;
  }
  async function saveNote(child, day, prayer, text, btn, st) {
    btn.disabled = true; st.className = "status"; st.textContent = "Saving…";
    try {
      await api({ ...auth(), action: "note", child, prayer, date: day, note: text.trim() });
      window.notes = (window.notes || []).filter(x => !(x.child === child && x.day === day && x.prayer === prayer));
      if (text.trim()) window.notes.push({ day, child, prayer, text: text.trim(), by: session.user, at: Date.now() });
      st.textContent = text.trim() ? "Note saved." : "Note deleted.";
      setTimeout(() => render(), 600);
    } catch (e) { btn.disabled = false; st.className = "status err"; st.textContent = e.message + (e.code === "bad" ? "" : " (Is the script updated?)"); }
  }
  // note editor in a small sheet, opened from today's list
  window.openNote = function (child, p, prayer) {
    const ov = el("div", "nov"), card = el("div", "novcard"), close = el("button", "ghost", "Close");
    close.onclick = () => ov.remove();
    const head = el("div", "right"); head.append(close);
    card.append(head, detail(child, p, prayer)); ov.append(card); document.body.append(ov);
    ov.addEventListener("click", e => { if (e.target === ov) ov.remove(); });
  };
  window.noteFor = noteFor;

  window.renderParents = function (tab) {
    if (tab === "stats") renderStats();
    if (tab === "tracker") {
      const a = document.activeElement;                // don't wipe a note or time being typed (the page refreshes every 30 s)
      if (a && $("trackerbody").contains(a) && /^(INPUT|TEXTAREA)$/.test(a.tagName)) return;
      renderTracker();
    }
  };

  document.head.insertAdjacentHTML("beforeend", `<style>
  .ptabs{display:flex;gap:6px;background:var(--surface);border:1px solid var(--line);border-radius:999px;padding:4px}
  .ptabs button{flex:1;background:transparent;color:var(--fg);border-radius:999px;padding:9px 6px;font-weight:600}
  .ptabs button[aria-pressed="true"]{background:var(--accent);color:var(--accent-ink)}
  .seg{display:flex;gap:6px;flex-wrap:wrap}
  .seg button{background:var(--wait-bg);color:var(--fg);border-radius:999px;padding:7px 12px;font-weight:600;font-size:14px}
  .seg button[aria-pressed="true"]{background:var(--sel);color:var(--accent);box-shadow:inset 0 0 0 2px var(--accent)}
  .scard{display:flex;flex-direction:column;gap:10px;padding:14px;border:1px solid var(--line);border-radius:12px;background:var(--bg)}
  .shead{display:flex;align-items:center;gap:10px}.shead b{font-family:var(--display);font-weight:400;font-size:20px}
  .sbar{display:flex;height:12px;border-radius:999px;overflow:hidden;background:var(--wait-bg)}
  .sbar span{display:block}.sbar .ok{background:var(--done)}.sbar .lt{background:var(--gold)}.sbar .vl{background:var(--late)}.sbar .ms{background:var(--line)}.sbar .empty{flex:1}
  .snums{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
  .snum{background:var(--surface);border-radius:10px;padding:8px;display:flex;flex-direction:column;min-width:0}
  .snum b{font-size:20px;font-variant-numeric:tabular-nums}.snum span{font-size:12px;color:var(--muted)}
  .snum.ok b{color:var(--done)}.snum.lt b{color:var(--gold)}.snum.vl b{color:var(--late)}.snum.money b{color:var(--gold)}
  .ptable td.c-ok{color:var(--done);font-weight:600}.ptable td.c-lt{color:var(--gold);font-weight:600}.ptable td.c-ms{color:var(--late);font-weight:600}
  .legend{display:flex;flex-wrap:wrap;gap:10px;font-size:12px;color:var(--muted)}
  .legend span{display:inline-flex;align-items:center;gap:4px}
  .dot{display:inline-block;width:12px;height:12px;border-radius:4px}
  .dot.ok,.tcell.ok{background:var(--done-bg);color:var(--done)}.dot.lt,.tcell.lt{background:#f6ead2;color:#8a5a12}
  .dot.vl,.tcell.vl{background:var(--late-bg);color:var(--late)}.dot.ms,.tcell.ms{background:var(--wait-bg);color:var(--late)}
  .dot.nx,.tcell.nx{background:var(--wait-bg);color:var(--muted)}
  .dot.bf,.tcell.bf{background:transparent;color:var(--line);box-shadow:inset 0 0 0 1px var(--line)}
  @media (prefers-color-scheme:dark){.dot.lt,.tcell.lt{background:#3d3018;color:#f0c870}}
  table.track{border-collapse:separate;border-spacing:3px;width:100%;table-layout:fixed}
  table.track th:first-child,table.track td.tday{width:42px}
  table.track th{font-size:11px;color:var(--muted);font-weight:600;text-align:center;padding:2px}
  table.track th:first-child{text-align:left}
  .ticon{display:block;width:22px;height:22px;margin:0 auto;color:var(--muted)}.ticon svg{width:100%;height:100%}
  td.tday{font-size:11px;color:var(--muted);text-align:center;line-height:1.1}
  td.tday b{display:block;font-size:15px;color:var(--fg)}
  .tcell{position:relative;width:100%;min-width:0;border-radius:8px;padding:9px 0;font-size:12px;font-weight:600;font-variant-numeric:tabular-nums;letter-spacing:-.2px}
  .tcell.sel{outline:2px solid var(--accent);outline-offset:1px}
  .ndot{position:absolute;top:1px;right:3px;font-size:10px;color:var(--accent)}
  .jdot{position:absolute;bottom:1px;right:3px;font-size:9px;font-weight:700;color:var(--gold)}
  .stepper{display:flex;align-items:center;gap:8px}
  .stepb{font-size:22px;line-height:1;padding:6px 14px;font-weight:600}.stepb:disabled{opacity:.35;cursor:default}
  .steplabel{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:4px;text-align:center}
  .steplabel b{font-size:15px}
  .daypick{width:auto;padding:6px 8px}
  .daysum{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
  .dchip{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:12px;background:var(--wait-bg)}
  .dchip b{flex:1;min-width:0}.dchip span:last-child{font-weight:700;font-size:18px;font-variant-numeric:tabular-nums}
  .dchip[data-who=Dad]{background:var(--b-Dad)}.dchip[data-who=Mom]{background:var(--b-Mom)}.dchip[data-who=Yousuf]{background:var(--b-Yousuf)}.dchip[data-who=Eva]{background:var(--b-Eva)}
  .dlist{display:flex;flex-direction:column;gap:4px}
  .drow{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:8px;font-size:14px}
  .drow .ticon{margin:0;width:20px;height:20px}.drow .dp{font-weight:600;width:64px}.drow .ds{flex:1;min-width:0;color:var(--muted);font-size:13px}
  .drow.ok{background:var(--done-bg)}.drow.ok .ds{color:var(--done)}.drow.lt{background:#f6ead2}.drow.vl,.drow.ms{background:var(--late-bg)}.drow.ms .ds,.drow.vl .ds{color:var(--late)}
  @media (prefers-color-scheme:dark){.drow.lt{background:#3d3018}}
  .tdetail{display:flex;flex-direction:column;gap:6px;border:1px solid var(--line);border-radius:12px;padding:12px;background:var(--bg)}
  .noteed{display:flex;flex-direction:column;gap:6px;margin-top:4px}
  .noteed textarea{font:inherit;color:var(--fg);background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:10px;width:100%;resize:vertical}
  .notebtn{background:transparent;border:1px solid var(--line);color:var(--accent);padding:6px 10px;font-size:13px}
  .pnote{font-size:12px;color:var(--accent);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:240px}
  .nov{position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:40;display:flex;align-items:flex-end;justify-content:center;padding:12px}
  .novcard{background:var(--surface);border-radius:16px;padding:14px;width:100%;max-width:520px;display:flex;flex-direction:column;gap:8px;margin-bottom:env(safe-area-inset-bottom,0px)}
  </style>`);
})();
