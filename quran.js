/* Quran memorization (tab "Quran"): surahs of up to 20 verses for now.
   Up to 10 verses = 10 points, 11–20 verses = 15 points. Points count only after Dad or Mom approves.
   A child records the recitation (or says "I recited to Dad / Mom"); parents approve, ask for more review,
   award directly after hearing it in person, or mark a surah the child already knew (no points).
   Uses the shared state from index.html: session, KIDS, CONFIG, el, api, auth, render, fmtD, fmtT, parts, monthKey, pts, money, RULES. */
(function () {
  const $ = id => document.getElementById(id);
  const S = [ // [number, English name, Arabic name, verses]
    [1, "Al-Fatihah", "الفاتحة", 7], [114, "An-Nas", "الناس", 6], [113, "Al-Falaq", "الفلق", 5], [112, "Al-Ikhlas", "الإخلاص", 4],
    [111, "Al-Masad", "المسد", 5], [110, "An-Nasr", "النصر", 3], [109, "Al-Kafirun", "الكافرون", 6], [108, "Al-Kawthar", "الكوثر", 3],
    [107, "Al-Ma'un", "الماعون", 7], [106, "Quraysh", "قريش", 4], [105, "Al-Fil", "الفيل", 5], [104, "Al-Humazah", "الهمزة", 9],
    [103, "Al-'Asr", "العصر", 3], [102, "At-Takathur", "التكاثر", 8], [101, "Al-Qari'ah", "القارعة", 11], [100, "Al-'Adiyat", "العاديات", 11],
    [99, "Az-Zalzalah", "الزلزلة", 8], [98, "Al-Bayyinah", "البينة", 8], [97, "Al-Qadr", "القدر", 5], [96, "Al-'Alaq", "العلق", 19],
    [95, "At-Tin", "التين", 8], [94, "Ash-Sharh", "الشرح", 8], [93, "Ad-Duha", "الضحى", 11], [91, "Ash-Shams", "الشمس", 15],
    [90, "Al-Balad", "البلد", 20], [87, "Al-A'la", "الأعلى", 19], [86, "At-Tariq", "الطارق", 17], [82, "Al-Infitar", "الانفطار", 19],
  ];
  const info = n => S.find(x => x[0] === n);
  const ptsFor = v => v <= 10 ? 10 : 15;
  const MAX_REC = 120;
  let qKid = null, rec = null, recBlob = null, recFor = 0, recStart = 0, recTimer = null;
  const isParent = () => !!(session && (session.viewAll || session.admin));
  const list = () => Array.isArray(window.quran) ? window.quran : [];
  const recOf = (child, n) => {                      // the record that decides how the tile looks
    const rs = list().filter(q => q.child === child && q.surah === n);
    return rs.find(q => q.status === "approved") || rs.find(q => q.status === "known") || rs.find(q => q.status === "pending") || rs.sort((a, b) => b.created - a.created)[0] || null;
  };
  const setMsg = (st, m, err) => { st.className = "status" + (err ? " err" : ""); st.textContent = m; };

  /* points that count for a month (used by the month table / stats in index.html) */
  window.quranPoints = (child, mk) => list().filter(q => q.child === child && q.status === "approved" && q.decided && monthKey(parts(q.decided)) === mk)
    .reduce((a, q) => a + q.points, 0);
  window.quranBadge = () => isParent() ? list().filter(q => q.status === "pending").length : 0;

  async function apiPost(params) {
    let j;
    try { const r = await fetch(CONFIG.scriptUrl, { method: "POST", body: JSON.stringify(params), redirect: "follow" }); j = await r.json(); }
    catch (e) { const err = new Error("Couldn't send. Check the internet and try again."); err.code = "net"; throw err; }
    if (!j.ok) { const err = new Error(j.message || "Something went wrong"); err.code = j.error; throw err; }
    return j;
  }
  const oldScript = e => e && e.code !== "net" && e.code !== "bad" && e.code !== "login";

  /* listen: Sheikh Sudais, verse by verse (everyayah.com) on one shared player */
  const player = new Audio(); let queue = [], playingBtn = null;
  function listen(n, btn) {
    if (playingBtn === btn && !player.paused) { player.pause(); queue = []; btn.textContent = "▶ Listen"; playingBtn = null; return; }
    if (playingBtn) playingBtn.textContent = "▶ Listen";
    const v = info(n)[3], pad = x => String(x).padStart(3, "0");
    queue = Array.from({ length: v }, (_, i) => "https://everyayah.com/data/Abdurrahmaan_As-Sudais_192kbps/" + pad(n) + pad(i + 1) + ".mp3");
    playingBtn = btn; btn.textContent = "⏸ Stop"; next();
  }
  function next() {
    if (!queue.length) { if (playingBtn) playingBtn.textContent = "▶ Listen"; playingBtn = null; return; }
    player.src = queue.shift(); player.play().catch(() => { if (playingBtn) playingBtn.textContent = "▶ Listen"; playingBtn = null; });
  }
  player.addEventListener("ended", next);

  /* ---------- the tab ---------- */
  window.renderQuran = function (force) {
    const box = $("quranbody"); if (!box) return;
    const a = document.activeElement;
    if (!force && ((rec && rec.state === "recording") || (a && box.contains(a) && /^(INPUT|TEXTAREA)$/.test(a.tagName)))) return;
    box.replaceChildren();
    if (!Array.isArray(window.quran)) { box.append(el("p", "note", "The Quran tab needs the updated Google script (ask Dad).")); return; }
    const parent = isParent();
    if (parent && !KIDS.some(k => k.id === qKid)) qKid = KIDS[0].id;
    const child = parent ? qKid : session.user;
    const st = el("div", "status"); st.id = "qstatus";
    box.append(el("p", "note qrule", "Memorize a surah and recite it to Mom or Dad. Up to 10 verses: 10 points ($" + (10 * RULES.dollarsPerPoint).toFixed(2) + "). 11–20 verses: 15 points ($" + (15 * RULES.dollarsPerPoint).toFixed(2) + ")."));
    if (parent) {
      const pend = list().filter(q => q.status === "pending").sort((x, y) => x.created - y.created);
      if (pend.length) { box.append(el("h3", "fh", "Waiting for you (" + pend.length + ")")); pend.forEach(q => box.append(pendingCard(q, st))); }
      const seg = el("div", "seg");
      KIDS.forEach(k => { const b = el("button", null, k.id); b.setAttribute("aria-pressed", String(qKid === k.id)); b.onclick = () => { qKid = k.id; window.renderQuran(true); }; seg.append(b); });
      box.append(seg);
    }
    const done = S.filter(x => { const r = recOf(child, x[0]); return r && (r.status === "approved" || r.status === "known"); }).length;
    const mk = monthKey(parts(Date.now())), mp = window.quranPoints(child, mk);
    const head = el("div", "qhead");
    const bar = el("div", "qbar"), fill = el("span"); fill.style.width = Math.round(done * 100 / S.length) + "%"; bar.append(fill);
    head.append(el("b", null, (parent ? child + " has" : "You have") + " memorized " + done + " of " + S.length + " surahs"), bar,
      el("span", "note", "This month: +" + pts(mp) + " points from the Quran (" + money(mp * RULES.dollarsPerPoint) + ")"));
    box.append(head, st);
    const grid = el("div", "qgrid");
    S.forEach(x => {
      const r = recOf(child, x[0]), cls = r ? r.status : "none";
      const t = el("button", "qtile q-" + cls);
      t.append(el("span", "qar", x[2]), el("span", "qen", x[1]), el("span", "qmeta", x[3] + " verses · " + ptsFor(x[3]) + " pts"),
        el("span", "qst", { approved: "✨ Memorized", known: "✓ Knew it", pending: "⏳ Waiting", review: "🔁 Practice more", none: "" }[cls]));
      t.onclick = () => openSurah(child, x[0]);
      grid.append(t);
    });
    box.append(grid);
  };

  function pendingCard(q, st) {
    const x = info(q.surah), c = el("div", "fcard qpend"), top = el("div", "fhead"), tx = el("div", "fmain");
    top.append(window.avatar ? window.avatar(q.child, "av sm") : el("span"));
    tx.append(el("b", null, q.child + " · " + x[1] + " (" + x[2] + ")"), el("div", "note", x[3] + " verses · +" + q.points + " points · " + fmtD(q.created) + ", " + fmtT(q.created)));
    top.append(tx); c.append(top);
    if (q.audio) c.append(playRec(q, st)); else c.append(el("div", "note", "🗣️ Says they recited it to you in person."));
    const note = el("input"); note.placeholder = "Note (optional), e.g. practise verse 5"; note.maxLength = 200; note.setAttribute("aria-label", "Note for " + q.child);
    const ok = el("button", "primary", "✅ Memorized (+" + q.points + ")"), more = el("button", "ghost", "🔁 Practice more");
    ok.onclick = () => act({ action: "quran_decide", id: q.id, status: "approved", note: note.value.trim() }, () => Object.assign(q, { status: "approved", decidedBy: session.user, decided: Date.now(), note: note.value.trim() }), ok, st);
    more.onclick = () => act({ action: "quran_decide", id: q.id, status: "review", note: note.value.trim() }, () => Object.assign(q, { status: "review", points: 0, decidedBy: session.user, decided: Date.now(), note: note.value.trim() }), more, st);
    const b = el("div", "right left"); b.append(ok, more);
    c.append(note, b);
    return c;
  }
  function playRec(q, st) {
    const pb = el("button", "ghost", "▶ Play the recitation");
    pb.onclick = async () => {
      pb.disabled = true; pb.textContent = "Loading…";
      try { const j = await api({ ...auth(), action: "audio", id: q.audio }); const a = document.createElement("audio"); a.controls = true; a.src = j.audio; a.className = "aud"; pb.replaceWith(a); a.play().catch(() => {}); }
      catch (e) { pb.disabled = false; pb.textContent = "▶ Play the recitation"; setMsg(st, e.message, true); }
    };
    return pb;
  }
  async function act(params, apply, btn, st) {
    btn.disabled = true; setMsg(st, "Saving…");
    try { await api({ ...auth(), ...params }); apply(); document.querySelectorAll(".nov").forEach(x => x.remove()); render(); window.renderQuran(true); const s2 = $("qstatus"); if (s2) setMsg(s2, "Saved."); }
    catch (e) { btn.disabled = false; setMsg(st, oldScript(e) ? "This needs the updated Google script." : e.message, true); }
  }

  /* ---------- one surah ---------- */
  function openSurah(child, n) {
    document.querySelectorAll(".nov").forEach(x => x.remove());
    const x = info(n), r = recOf(child, n), parent = isParent();
    const ov = el("div", "nov"), card = el("div", "novcard qsheet"), close = el("button", "ghost", "Close"), st = el("div", "status");
    close.onclick = () => { if (rec && rec.state === "recording") rec.stop(); ov.remove(); };
    const head = el("div", "phhead"); head.append(el("h2", null, x[1]), close);
    card.append(head, el("div", "qbigar", x[2]), el("p", "note", "Surah " + n + " · " + x[3] + " verses · " + ptsFor(x[3]) + " points"));
    const lb = el("button", "ghost", "▶ Listen"); lb.onclick = () => listen(n, lb);
    const tools = el("div", "right left"); tools.append(lb); card.append(tools);
    if (r) {
      const txt = { approved: "✨ Memorized" + (r.points ? " · +" + r.points + " points" : ""), known: "✓ Already knew it (no points)", pending: "⏳ Waiting for Mom or Dad", review: "🔁 Practice a bit more, then try again" }[r.status];
      card.append(el("p", "qstate q-" + r.status, txt + (r.decidedBy ? " · " + r.decidedBy + (r.decided ? ", " + fmtD(r.decided) : "") : "")));
      if (r.note) card.append(el("p", "reply", "💬 " + r.note));
    }
    const can = !r || r.status === "review";
    if (!parent && can) {                             // child: record, or "I recited to Dad / Mom"
      const rb = el("button", "recb" + (rec && rec.state === "recording" && recFor === n ? " on" : ""), rec && rec.state === "recording" && recFor === n ? "■ Stop" : "🎤 Record my recitation"); rb.id = "qrecbtn";
      rb.onclick = () => rec && rec.state === "recording" ? rec.stop() : startRec(n, st);
      const row = el("div", "right left"); row.append(rb);
      if (recBlob && recFor === n) {
        const a = document.createElement("audio"); a.controls = true; a.src = URL.createObjectURL(recBlob); a.className = "aud";
        const del = el("button", "ghost", "Delete recording"); del.onclick = () => { recBlob = null; openSurah(child, n); };
        row.append(a, del);
      }
      const send = el("button", "primary", recBlob && recFor === n ? "Send to Mom and Dad" : "I recited it to Mom or Dad");
      send.onclick = async () => {
        send.disabled = true; setMsg(st, "Sending…");
        try {
          const audio = recBlob && recFor === n ? await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.onerror = rej; fr.readAsDataURL(recBlob); }) : "";
          if (audio.length > 900000) throw new Error("The recording is too long. Try a shorter one.");
          await apiPost({ ...auth(), action: "quran_submit", surah: n, audio });
          recBlob = null; await load(); ov.remove(); window.renderQuran(true);
          const s2 = $("qstatus"); if (s2) setMsg(s2, "Sent! Mom or Dad will listen soon. 🌟");
        } catch (e) { send.disabled = false; setMsg(st, oldScript(e) ? "The Quran tab needs the updated Google script." : e.message, true); }
      };
      card.append(row, send);
    }
    if (parent) {                                     // parents: award after hearing it, mark "already knew it", or undo
      const b = el("div", "right left");
      if (!r || r.status === "review" || r.status === "pending") {
        if (r && r.status === "pending") {
          if (r.audio) card.append(playRec(r, st));
          const ok = el("button", "primary", "✅ Memorized (+" + ptsFor(x[3]) + ")"), more = el("button", "ghost", "🔁 Practice more");
          ok.onclick = () => act({ action: "quran_decide", id: r.id, status: "approved" }, () => Object.assign(r, { status: "approved", decidedBy: session.user, decided: Date.now() }), ok, st);
          more.onclick = () => act({ action: "quran_decide", id: r.id, status: "review" }, () => Object.assign(r, { status: "review", points: 0, decidedBy: session.user, decided: Date.now() }), more, st);
          b.append(ok, more);
        } else {
          const ok = el("button", "primary", "✅ " + child + " recited it to me (+" + ptsFor(x[3]) + ")"), kn = el("button", "ghost", "✓ Already knew it (no points)");
          ok.onclick = () => act({ action: "quran_mark", child, surah: n, status: "approved" }, () => window.quran.push({ id: "tmp" + Date.now(), created: Date.now(), child, surah: n, ayahs: x[3], points: ptsFor(x[3]), status: "approved", decidedBy: session.user, decided: Date.now(), audio: "", note: "", mode: "live" }), ok, st);
          kn.onclick = () => act({ action: "quran_mark", child, surah: n, status: "known" }, () => window.quran.push({ id: "tmp" + Date.now(), created: Date.now(), child, surah: n, ayahs: x[3], points: 0, status: "known", decidedBy: session.user, decided: Date.now(), audio: "", note: "", mode: "live" }), kn, st);
          b.append(ok, kn);
        }
      }
      if (r && (r.status === "approved" || r.status === "known")) {
        const un = el("button", "ghost", "Undo");
        un.onclick = () => { if (confirm("Remove " + x[1] + " from " + child + "'s list?")) act({ action: "quran_delete", id: r.id }, () => window.quran = list().filter(q => q.id !== r.id), un, st); };
        b.append(un);
      }
      card.append(b);
    }
    card.append(st); ov.append(card); document.body.append(ov);
    ov.addEventListener("click", e => { if (e.target === ov) close.onclick(); });
  }

  async function startRec(n, st) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) { setMsg(st, "This device can't record here. Use “I recited it to Mom or Dad”.", true); return; }
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch (e) { setMsg(st, "The microphone is blocked. Allow it in the browser settings.", true); return; }
    const mime = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"].find(m => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) || "";
    const opts = { audioBitsPerSecond: 32000 }; if (mime) opts.mimeType = mime;
    try { rec = new MediaRecorder(stream, opts); } catch (e) { rec = new MediaRecorder(stream); }
    const chunks = []; recFor = n; recBlob = null;
    rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = () => { stream.getTracks().forEach(t => t.stop()); clearInterval(recTimer);
      recBlob = chunks.length ? new Blob(chunks, { type: rec.mimeType || mime || "audio/mp4" }) : null;
      openSurah(session.user, n); };
    rec.start(1000); recStart = Date.now();
    openSurah(session.user, n);
    recTimer = setInterval(() => {
      const s = Math.floor((Date.now() - recStart) / 1000), b = $("qrecbtn");
      if (b) b.textContent = "■ Stop (" + Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0") + " / 2:00)";
      if (s >= MAX_REC && rec.state === "recording") rec.stop();
    }, 250);
  }

  document.head.insertAdjacentHTML("beforeend", `<style>
  .qrule{margin:0}
  .qhead{display:flex;flex-direction:column;gap:6px;padding:12px;border-radius:12px;background:var(--wait-bg)}
  .qbar{height:10px;border-radius:999px;background:var(--surface);overflow:hidden}.qbar span{display:block;height:100%;background:linear-gradient(90deg,var(--gold),#e8b84a);border-radius:999px}
  .qgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:8px}
  .qtile{display:flex;flex-direction:column;align-items:center;gap:1px;padding:10px 6px;border-radius:12px;background:var(--wait-bg);color:var(--fg);border:2px solid transparent;font-weight:500;min-width:0}
  .qar{font-size:20px;font-family:"Amiri","Noto Naskh Arabic","Geeza Pro",serif;line-height:1.5}
  .qen{font-size:12px;font-weight:700;text-align:center}
  .qmeta{font-size:10px;color:var(--muted)}
  .qst{font-size:11px;font-weight:700;min-height:1em}
  .qtile.q-approved{background:#fbf1d8;border-color:var(--gold)}.qtile.q-approved .qst{color:#8a5a12}
  .qtile.q-known{background:var(--done-bg)}.qtile.q-known .qst{color:var(--done)}
  .qtile.q-pending{border-style:dashed;border-color:var(--accent)}.qtile.q-pending .qst{color:var(--accent)}
  .qtile.q-review .qst{color:var(--late)}
  @media (prefers-color-scheme:dark){.qtile.q-approved{background:#3d3018}.qtile.q-approved .qst{color:#f0c870}}
  .qbigar{font-size:40px;text-align:center;font-family:"Amiri","Noto Naskh Arabic","Geeza Pro",serif;line-height:1.4}
  .qstate{margin:0;font-weight:600}.qstate.q-approved{color:#8a5a12}.qstate.q-known{color:var(--done)}.qstate.q-pending{color:var(--accent)}.qstate.q-review{color:var(--late)}
  .qsheet{max-height:88vh;overflow:auto}
  .fcard.qpend{border:1px dashed var(--accent)}
  </style>`);
})();
