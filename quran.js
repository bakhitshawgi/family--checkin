/* Quran memorization (tab "Quran"): surahs of up to 20 verses for now.
   Up to 10 verses = 10 points, 11–20 verses = 15 points. Points count only after Dad or Mom approves.
   A child records the recitation (or says "I recited to Dad / Mom"); parents approve, ask for more review,
   award directly after hearing it in person, or mark a surah the child already knew (no points).
   Uses the shared state from index.html: session, KIDS, CONFIG, el, api, auth, render, store, fmtD, fmtT, parts, monthKey, pts, money, RULES. */
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
  const MAIN = ["approved", "known", "pending", "review"];
  const REVIEW_PTS = 2, REVIEWS_PER_WEEK = 2, HELPER_PTS = 7;
  const weekKey = ms => { const p = parts(ms), d = new Date(Date.UTC(p[0], p[1] - 1, p[2])); d.setUTCDate(d.getUTCDate() - d.getUTCDay()); return d.toISOString().slice(0, 10); };
  const reviewsThisWeek = (child, n) => list().filter(q => q.child === child && q.surah === n && q.status === "refresher" && weekKey(q.created) === weekKey(Date.now())).length;
  const memorized = (child, n) => { const r = recOfMain(child, n); return r && (r.status === "approved" || r.status === "known"); };
  function recOfMain(child, n) { const rs = list().filter(q => q.child === child && q.surah === n && MAIN.includes(q.status));
    return rs.find(q => q.status === "approved") || rs.find(q => q.status === "known") || rs.find(q => q.status === "pending") || rs.sort((a, b) => b.created - a.created)[0] || null; }
  const sibling = child => KIDS.map(k => k.id).find(k => k !== child);
  const ptsFor = v => v <= 10 ? 10 : 15;
  const MAX_REC = 120;
  let qKid = null, rec = null, recBlob = null, recFor = 0, recStart = 0, recTimer = null;
  const isParent = () => !!(session && (session.viewAll || session.admin));
  const list = () => Array.isArray(window.quran) ? window.quran : [];
  const recOf = (child, n) => {                      // the record that decides how the tile looks
    const rs = list().filter(q => q.child === child && q.surah === n && MAIN.includes(q.status));   // "archived" = undone; "refresher"/"helper" = extra points
    return rs.find(q => q.status === "approved") || rs.find(q => q.status === "known") || rs.find(q => q.status === "pending") || rs.sort((a, b) => b.created - a.created)[0] || null;
  };
  const recToDataUrl = async blob => {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let bin = ""; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    let mime = String(blob.type || "").split(";")[0].trim().toLowerCase();
    if (!/^audio\/[a-z0-9.+-]+$/.test(mime)) mime = /webm/.test(String(blob.type)) ? "audio/webm" : "audio/mp4";
    return "data:" + mime + ";base64," + btoa(bin);
  };
  const MAX_UPLOAD = 1.9 * 1024 * 1024;                 // ~2 MB (about 2.6 million characters once encoded)
  const AUDIO_EXT = { m4a: "audio/mp4", mp4: "audio/mp4", aac: "audio/aac", mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg", oga: "audio/ogg", opus: "audio/ogg", webm: "audio/webm", caf: "audio/x-caf", "3gp": "audio/3gpp", amr: "audio/amr" };
  function audioFromFile(file) {
    const ext = (String(file.name || "").split(".").pop() || "").toLowerCase();
    const type = /^audio\//.test(file.type) ? file.type : AUDIO_EXT[ext] || (/^video\/(mp4|quicktime)/.test(file.type) ? "audio/mp4" : "");
    if (!type) throw new Error("That file isn't a sound recording. Choose an audio file (m4a, mp3, wav…).");
    if (file.size > MAX_UPLOAD) throw new Error("That recording is too big (" + (file.size / 1048576).toFixed(1) + " MB). The limit is about 2 MB – record it here instead, or trim it.");
    return new Blob([file], { type });
  }
  function uploadButton(label, onBlob, onError) {
    const inp = document.createElement("input"); inp.type = "file"; inp.accept = "audio/*,.m4a,.mp3,.wav,.aac,.ogg,.webm,.caf"; inp.className = "phfile";
    inp.id = "up" + Math.random().toString(36).slice(2, 8);
    const lab = el("label", "upbtn", label); lab.htmlFor = inp.id;
    inp.onchange = () => { const f = inp.files && inp.files[0]; inp.value = ""; if (!f) return; try { onBlob(audioFromFile(f)); } catch (e) { onError(e.message); } };
    const w = el("span", "upwrap"); w.append(lab, inp); return w;
  }
  const cleanAudio = (dataUrl, blob) => {
    const b64 = dataUrl.slice(dataUrl.indexOf("base64,") + 7);
    let mime = String((blob && blob.type) || "").split(";")[0].trim().toLowerCase();
    if (!/^audio\/[\w.+-]+$/.test(mime)) mime = /webm/.test(dataUrl.slice(0, 60)) ? "audio/webm" : "audio/mp4";
    return "data:" + mime + ";base64," + b64;
  };
  const setMsg = (st, m, err) => { st.className = "status" + (err ? " err" : ""); st.textContent = m; };

  /* points that count for a month (used by the month table / stats in index.html) */
  window.quranPoints = (child, mk) => list().filter(q => q.child === child && ["approved", "refresher", "helper"].includes(q.status) && (q.decided || q.created) && monthKey(parts(q.decided || q.created)) === mk)
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

  /* ---------- listening & Memorize mode ----------
     One shared player (iPhone / iPad need that). Verse by verse from everyayah.com.
     Memorize mode: repeat each verse, a pause after each verse to say it back, slower speed, a range of verses,
     and the verse text (fetched on the device from api.alquran.cloud, Uthmani script). */
  const RECITERS = [
    ["Husary_Muallim_128kbps", "Al-Husary – teaching (slow)"],
    ["Minshawy_Teacher_128kbps", "Al-Minshawi – with children"],
    ["Husary_128kbps", "Al-Husary – murattal"],
    ["Minshawy_Murattal_128kbps", "Al-Minshawi – murattal"],
    ["Abdurrahmaan_As-Sudais_192kbps", "As-Sudais"],
  ];
  const memo = Object.assign({ reciter: RECITERS[0][0], repeat: 3, pause: true, speed: 1 }, store.get("memo") || {});
  const saveMemo = () => store.set("memo", { reciter: memo.reciter, repeat: memo.repeat, pause: memo.pause, speed: memo.speed });
  const player = new Audio(); player.preload = "auto";
  let job = null;            // { n, from, to, v, rep, repeat, pause, speed, chain, ci, onUpdate, gapTimer }
  const pad3 = x => String(x).padStart(3, "0");
  const urlFor = (folder, n, v) => "https://everyayah.com/data/" + folder + "/" + pad3(n) + pad3(v) + ".mp3";

  function stopPlay(msg) {
    if (!job) return;
    clearTimeout(job.gapTimer); const j = job; job = null; player.pause();
    if (j.onUpdate) j.onUpdate({ state: "stopped", msg });
  }
  // reciters that turned out not to exist on this device's network are remembered and skipped
  const bad = new Set(store.get("badReciters") || []);
  const markBad = f => { bad.add(f); store.set("badReciters", [...bad]); };
  const firstGood = want => (bad.has(want) ? (RECITERS.find(r => !bad.has(r[0])) || RECITERS[RECITERS.length - 1])[0] : want);
  // iPhone / iPad only allow sound that starts inside the tap itself, so the first verse is played right here, synchronously.
  function startPlay(opts) {
    stopPlay();
    const first = firstGood(opts.reciter), i = RECITERS.findIndex(r => r[0] === first);
    const chain = [...RECITERS.slice(Math.max(0, i)).map(r => r[0]), ...RECITERS.slice(0, Math.max(0, i)).map(r => r[0])].filter(f => f === first || !bad.has(f));
    job = Object.assign({ v: opts.from, rep: 0, chain, ci: 0, started: false }, opts);
    playVerse();
  }
  function playVerse() {
    const j = job; if (!j) return;
    player.src = urlFor(j.chain[j.ci], j.n, j.v);
    player.playbackRate = j.speed; player.preservesPitch = true; player.webkitPreservesPitch = true;
    const p = player.play();
    if (p && p.catch) p.catch(err => {
      if (job !== j || !err || err.name !== "NotAllowedError") return;
      stopPlay("The iPad blocked the sound. Tap ▶ Start again.");      // the browser wants a fresh tap
    });
    if (j.onUpdate) j.onUpdate({ state: "playing" });
  }
  player.addEventListener("playing", () => { if (job) job.started = true; });
  player.addEventListener("ratechange", () => {});
  player.addEventListener("loadedmetadata", () => { if (job) player.playbackRate = job.speed; });
  player.addEventListener("error", () => {
    const j = job; if (!j || player.src.startsWith("data:")) return;
    const failed = j.chain[j.ci];
    if (!j.started) {                     // the very first verse failed: this reciter isn't there. Remember it, pick the next one, ask for a new tap.
      markBad(failed);
      const nextR = j.chain.find(f => f !== failed && !bad.has(f)) || "Abdurrahmaan_As-Sudais_192kbps";
      memo.reciter = nextR; saveMemo(); if (j.onReciter) j.onReciter(nextR);
      const name = (RECITERS.find(r => r[0] === failed) || ["", failed])[1], nn = (RECITERS.find(r => r[0] === nextR) || ["", nextR])[1];
      stopPlay(name + " isn't available. Switched to " + nn + " – tap ▶ again.");
      return;
    }
    if (j.ci < j.chain.length - 1) { j.ci++; playVerse(); return; }        // already playing: carry on with the next reciter
    stopPlay("Couldn't load the recitation. Check the internet.");
  });
  player.addEventListener("ended", () => {
    const j = job; if (!j || player.src.startsWith("data:")) return;
    const after = () => {
      if (!job) return;
      j.rep++;
      if (j.rep < j.repeat) return playVerse();
      j.rep = 0; j.v++;
      if (j.v > j.to) { const u = j.onUpdate; job = null; if (u) u({ state: "done" }); return; }
      playVerse();
    };
    if (j.pause) {                              // your turn: silence as long as the verse took
      const secs = (isFinite(player.duration) && player.duration > 0 ? player.duration / j.speed : 4) + 0.5;
      if (j.onUpdate) j.onUpdate({ state: "yourturn", secs });
      j.gapTimer = setTimeout(after, secs * 1000);
    } else after();
  });

  // verse text, cached on the device
  async function verses(n) {
    const key = "qtext" + n, have = store.get(key); if (have && have.length) return have;
    const r = await fetch("https://api.alquran.cloud/v1/surah/" + n + "/quran-uthmani"); const j = await r.json();
    let list = j.data.ayahs.map(a => a.text);
    if (n !== 1 && list[0] && list[0].startsWith("بِسْمِ")) {        // the API puts the basmala in front of verse 1
      const w = list[0].split(" "); if (w.length > 4) list[0] = w.slice(4).join(" ");
    }
    store.set(key, list); return list;
  }
  const arabicNum = k => String(k).replace(/\d/g, d => "٠١٢٣٤٥٦٧٨٩"[d]);

  function memoPanel(n, verseCount) {
    const wrap = el("div", "memo");
    const row = (label, ctrl) => { const r = el("div", "memorow"); r.append(el("span", "memolab", label), ctrl); return r; };
    const seg = (opts, cur, set) => { const s = el("div", "seg"); opts.forEach(([v, t]) => { const b = el("button", null, t); b.setAttribute("aria-pressed", String(cur() === v));
      b.onclick = () => { set(v); saveMemo(); [...s.children].forEach((c, i) => c.setAttribute("aria-pressed", String(opts[i][0] === cur()))); }; s.append(b); }); return s; };
    const rsel = document.createElement("select"); rsel.setAttribute("aria-label", "Reciter");
    RECITERS.forEach(([v, t]) => { const o = el("option", null, t + (bad.has(v) ? " (not available)" : "")); o.value = v; rsel.append(o); }); rsel.value = firstGood(memo.reciter);
    rsel.onchange = () => { memo.reciter = rsel.value; bad.delete(rsel.value); store.set("badReciters", [...bad]); saveMemo(); };
    const from = document.createElement("select"), to = document.createElement("select");
    for (let k = 1; k <= verseCount; k++) { const a = el("option", null, String(k)); a.value = k; from.append(a); const b = el("option", null, String(k)); b.value = k; to.append(b); }
    from.value = "1"; to.value = String(verseCount); from.setAttribute("aria-label", "From verse"); to.setAttribute("aria-label", "To verse");
    from.onchange = () => { if (+to.value < +from.value) to.value = from.value; }; to.onchange = () => { if (+to.value < +from.value) from.value = to.value; };
    const range = el("div", "memorange"); range.append(el("span", null, "Verses"), from, el("span", null, "to"), to);
    const pauseSeg = seg([[true, "Yes"], [false, "No"]], () => memo.pause, v => memo.pause = v);
    wrap.append(row("Reciter", rsel), row("Repeat each verse", seg([[1, "1×"], [3, "3×"], [5, "5×"]], () => memo.repeat, v => memo.repeat = v)),
      row("Pause to say it back", pauseSeg), row("Speed", seg([[0.75, "0.75×"], [0.85, "0.85×"], [1, "1×"]], () => memo.speed, v => memo.speed = v)), row("", range));

    const now = el("div", "memonow"), state = el("div", "memostate"), text = el("div", "memotext"); text.dir = "rtl"; text.lang = "ar";
    now.append(state, text);
    const go = el("button", "primary", "▶ Start"), stop = el("button", "ghost", "■ Stop"); stop.disabled = true;
    const btns = el("div", "right left"); btns.append(go, stop);
    const all = el("div", "memoverses"); all.dir = "rtl"; all.lang = "ar";
    wrap.append(btns, now, all);

    let vs = null;
    verses(n).then(list => { vs = list; all.replaceChildren(...list.map((t, i) => { const s = el("span", "mv", t + " ﴿" + arabicNum(i + 1) + "﴾ ");
      s.dataset.v = i + 1; s.title = "Start from verse " + (i + 1); s.onclick = () => { from.value = String(i + 1); if (+to.value < i + 1) to.value = String(i + 1); go.click(); }; return s; })); })
      .catch(() => all.replaceChildren(el("p", "note", "The verse text couldn't load (internet). The recitation still works.")));

    const show = u => {
      const j = job;
      all.querySelectorAll(".mv.on").forEach(x => x.classList.remove("on"));
      if (u.state === "done" || u.state === "stopped") {
        go.disabled = false; stop.disabled = true; text.textContent = "";
        state.textContent = u.state === "done" ? "🌟 Well done! Try saying the verses without listening." : (u.msg || "");
        state.className = "memostate" + (u.msg ? " err" : ""); return;
      }
      if (!j) return;
      const cur = all.querySelector('.mv[data-v="' + j.v + '"]'); if (cur) { cur.classList.add("on"); cur.scrollIntoView({ block: "nearest", behavior: "smooth" }); }
      text.textContent = vs ? vs[j.v - 1] + " ﴿" + arabicNum(j.v) + "﴾" : "";
      const used = RECITERS.find(r => r[0] === j.chain[j.ci]);
      state.className = "memostate" + (u.state === "yourturn" ? " turn" : "");
      state.textContent = (u.state === "yourturn" ? "🗣️ Your turn – say it! " : "🎧 Listen · ") + "Verse " + j.v + " of " + j.to + (j.repeat > 1 ? " · " + (j.rep + 1) + "/" + j.repeat : "") + (j.ci ? " · " + used[1] : "");
    };
    go.onclick = () => {
      go.disabled = true; stop.disabled = false;
      startPlay({ n, from: +from.value, to: +to.value, reciter: memo.reciter, repeat: memo.repeat, pause: memo.pause, speed: memo.speed, onUpdate: show, onReciter: r => { rsel.value = r; } });
    };
    stop.onclick = () => stopPlay();
    return wrap;
  }
  window.quranStop = () => stopPlay();

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
    box.append(head);
    if (!parent) { const rv = el("button", "primary qrevbtn", "🔁 Review a surah I memorized (+" + REVIEW_PTS + ")"); rv.onclick = () => openReviewPicker(child); box.append(rv); }
    const extra = list().filter(q => q.child === child && (q.status === "helper" || (q.status === "refresher" && weekKey(q.created) === weekKey(Date.now())))).sort((a, b) => b.created - a.created);
    if (extra.length) {
      const ex = el("div", "qextra"); ex.append(el("b", null, "Reviews this week & helping"));
      extra.slice(0, 12).forEach(q => { const xx = info(q.surah); ex.append(el("div", "note", (q.status === "helper" ? "🤝 Helped " + String(q.note || "").replace(/^Helped /, "") + " memorize " : "🔁 Reviewed ") + xx[1] + " · +" + q.points + " · " + fmtD(q.created))); });
      box.append(ex);
    }
    box.append(st);
    const grid = el("div", "qgrid");
    S.forEach(x => {
      const r = recOf(child, x[0]), cls = r ? r.status : "none";
      const t = el("button", "qtile q-" + cls);
      const hasRec = list().some(q => q.child === child && q.surah === x[0] && q.audio);
      t.append(el("span", "qar", x[2]), el("span", "qen", x[1] + (hasRec ? " 🎧" : "")), el("span", "qmeta", x[3] + " verses · " + ptsFor(x[3]) + " pts"),
        el("span", "qst", { approved: "✨ Memorized", known: "✓ Knew it", pending: "⏳ Waiting", review: "🔁 Practice more", none: "" }[cls]));
      t.onclick = () => openSurah(child, x[0]);
      grid.append(t);
    });
    box.append(grid);
  };

  /* ---------- review a memorized surah: record with the microphone, +2, up to twice a week ---------- */
  function reviewBlock(child, n, st, ov) {
    const x = info(n), used = reviewsThisWeek(child, n), left = REVIEWS_PER_WEEK - used, box = el("div", "qreview");
    box.append(el("b", null, "🔁 Review it (+" + REVIEW_PTS + " points)"), el("span", "note", used + " of " + REVIEWS_PER_WEEK + " reviews this week · keeps the surah fresh in your heart"));
    if (left <= 0) { box.append(el("p", "note", "✅ Done for this week. You can review it again next week (from Sunday).")); return box; }
    const rb = el("button", "recb" + (rec && rec.state === "recording" && recFor === n ? " on" : ""), rec && rec.state === "recording" && recFor === n ? "■ Stop" : "🎤 Record now"); rb.id = "qrecbtn";
    rb.onclick = () => rec && rec.state === "recording" ? rec.stop() : startRec(n, st);
    const row = el("div", "right left"); row.append(rb);
    if (recBlob && recFor === n) {
      const a = document.createElement("audio"); a.controls = true; a.src = URL.createObjectURL(recBlob); a.className = "aud";
      const del = el("button", "ghost", "Record again"); del.onclick = () => { recBlob = null; openSurah(child, n); };
      const send = el("button", "primary", "Send review (+" + REVIEW_PTS + ")");
      send.onclick = async () => {
        send.disabled = true; setMsg(st, "Sending…");
        try {
          const audio = await recToDataUrl(recBlob);
          if (audio.length > 2700000) throw new Error("The recording is too long. Record a shorter one.");
          const j = await apiPost({ ...auth(), action: "quran_review", surah: n, audio });
          recBlob = null; await load(); ov.remove(); window.renderQuran(true);
          const s2 = $("qstatus"); if (s2) setMsg(s2, "Great review of " + x[1] + "! +" + REVIEW_PTS + " points 🌟" + (j.left ? " (" + j.left + " more this week)" : ""));
        } catch (e) { send.disabled = false; setMsg(st, oldScript(e) ? "Reviews need the updated Google script." : e.message, true); }
      };
      row.append(a, del); box.append(row, send);
    } else box.append(row);
    return box;
  }
  // child: list of memorized surahs to review
  function openReviewPicker(child) {
    document.querySelectorAll(".nov").forEach(x => x.remove());
    const ov = el("div", "nov"), card = el("div", "novcard qsheet"), close = el("button", "ghost", "Close"); close.onclick = () => ov.remove();
    const head = el("div", "phhead"); head.append(el("h2", null, "🔁 Review a surah"), close); card.append(head,
      el("p", "note", "Recite a surah you already memorized: +" + REVIEW_PTS + " points each time, up to " + REVIEWS_PER_WEEK + " times a week per surah."));
    const mine = S.filter(x => memorized(child, x[0]));
    if (!mine.length) card.append(el("p", "note", "When Mom or Dad count a surah as memorized, it shows up here."));
    const grid = el("div", "qgrid");
    mine.forEach(x => { const used = reviewsThisWeek(child, x[0]), t = el("button", "qtile" + (used >= REVIEWS_PER_WEEK ? " q-known" : ""));
      t.append(el("span", "qar", x[2]), el("span", "qen", x[1]), el("span", "qst", used >= REVIEWS_PER_WEEK ? "✅ done this week" : used + "/" + REVIEWS_PER_WEEK + " this week"));
      t.onclick = () => { ov.remove(); openSurah(child, x[0]); }; grid.append(t); });
    card.append(grid); ov.append(card); document.body.append(ov); ov.addEventListener("click", e => { if (e.target === ov) ov.remove(); });
  }

  function pendingCard(q, st) {
    const x = info(q.surah), c = el("div", "fcard qpend"), top = el("div", "fhead"), tx = el("div", "fmain");
    top.append(window.avatar ? window.avatar(q.child, "av sm") : el("span"));
    tx.append(el("b", null, q.child + " · " + x[1] + " (" + x[2] + ")"), el("div", "note", x[3] + " verses · +" + q.points + " points · " + fmtD(q.created) + ", " + fmtT(q.created)));
    top.append(tx); c.append(top);
    if (q.audio) c.append(playRec(q, st)); else c.append(el("div", "note", "🗣️ Says they recited it to you in person."));
    if (q.helper) c.append(el("div", "qhelp", "🤝 " + q.helper + " helped – " + q.helper + " gets +" + HELPER_PTS + " when you approve"));
    const note = el("input"); note.placeholder = "Note (optional), e.g. practise verse 5"; note.maxLength = 200; note.setAttribute("aria-label", "Note for " + q.child);
    const ok = el("button", "primary", "✅ Memorized (+" + q.points + ")"), more = el("button", "ghost", "🔁 Practice more");
    ok.onclick = () => act({ action: "quran_decide", id: q.id, status: "approved", note: note.value.trim() }, () => Object.assign(q, { status: "approved", decidedBy: session.user, decided: Date.now(), note: note.value.trim() }), ok, st);
    more.onclick = () => act({ action: "quran_decide", id: q.id, status: "review", note: note.value.trim() }, () => Object.assign(q, { status: "review", points: 0, decidedBy: session.user, decided: Date.now(), note: note.value.trim() }), more, st);
    const b = el("div", "right left"); b.append(ok, more);
    c.append(note, b);
    return c;
  }
  const audioCache = {};
  function playRec(q, st) {
    const pb = el("button", "ghost", "▶ Play the recitation");
    pb.onclick = async () => {
      pb.disabled = true; pb.textContent = "Loading…";
      try {
        const src = audioCache[q.audio] || (audioCache[q.audio] = (await api({ ...auth(), action: "audio", id: q.audio })).audio);   // loaded once per visit
        const a = document.createElement("audio"); a.controls = true; a.src = src; a.className = "aud"; pb.replaceWith(a); a.play().catch(() => {});
      }
      catch (e) { pb.disabled = false; pb.textContent = "▶ Play the recitation"; setMsg(st, e.message, true); }
    };
    return pb;
  }
  async function act(params, apply, btn, st) {
    btn.disabled = true; setMsg(st, "Saving…");
    try { await api({ ...auth(), ...params }); apply(); document.querySelectorAll(".nov").forEach(x => x.remove()); render(); window.renderQuran(true); const s2 = $("qstatus"); if (s2) setMsg(s2, "Saved.");
      load().then(() => window.renderQuran(true)).catch(() => {}); }                // picks up helper (+7) rows made by the script
    catch (e) { btn.disabled = false; setMsg(st, oldScript(e) ? "This needs the updated Google script." : e.message, true); }
  }

  /* ---------- one surah ---------- */
  function openSurah(child, n) {
    document.querySelectorAll(".nov").forEach(x => x.remove());
    const x = info(n), r = recOf(child, n), parent = isParent();
    const ov = el("div", "nov"), card = el("div", "novcard qsheet"), close = el("button", "ghost", "Close"), st = el("div", "status");
    close.onclick = () => { if (rec && rec.state === "recording") rec.stop(); stopPlay(); ov.remove(); };
    const head = el("div", "phhead"); head.append(el("h2", null, x[1]), close);
    card.append(head, el("div", "qbigar", x[2]), el("p", "note", "Surah " + n + " · " + x[3] + " verses · " + ptsFor(x[3]) + " points"));
    // listen normally, or open Memorize mode (repeat, pause to say it back, slower, verse range, verse text)
    const lb = el("button", "ghost", "▶ Listen"), mb = el("button", "primary memob", "🧠 Memorize mode");
    let panel = null;
    lb.onclick = () => { if (job) { stopPlay(); lb.textContent = "▶ Listen"; return; }
      lb.textContent = "■ Stop"; setMsg(lmsg, "");
      startPlay({ n, from: 1, to: x[3], reciter: memo.reciter, repeat: 1, pause: false, speed: memo.speed,
        onUpdate: u => { if (u.state === "done" || u.state === "stopped") { lb.textContent = "▶ Listen"; if (u.msg) setMsg(lmsg, u.msg, true); } } }); };
    mb.onclick = () => { if (panel) { stopPlay(); panel.remove(); panel = null; mb.textContent = "🧠 Memorize mode"; return; }
      stopPlay(); lb.textContent = "▶ Listen"; panel = memoPanel(n, x[3]); lmsg.after(panel); mb.textContent = "Close memorize mode"; };
    const tools = el("div", "right left"), lmsg = el("div", "status"); tools.append(mb, lb); card.append(tools, lmsg);
    if (r) {
      const txt = { approved: "✨ Memorized" + (r.points ? " · +" + r.points + " points" : ""), known: "✓ Already knew it (no points)", pending: "⏳ Waiting for Mom or Dad", review: "🔁 Practice a bit more, then try again" }[r.status];
      card.append(el("p", "qstate q-" + r.status, txt + (r.decidedBy ? " · " + r.decidedBy + (r.decided ? ", " + fmtD(r.decided) : "") : "")));
      if (r.note) card.append(el("p", "reply", "💬 " + r.note));
    }
    const recs = list().filter(q => q.child === child && q.surah === n && q.audio).sort((a, b) => b.created - a.created);
    if (recs.length) {
      const box = el("div", "qrecs"); box.append(el("b", "qrecsh", "🎧 " + (recs.length === 1 ? "Recording" : "Recordings (" + recs.length + ")")));
      recs.forEach(q => {
        const line = el("div", "qrec");
        line.append(el("span", "note", fmtD(q.created) + ", " + fmtT(q.created) + " · " + { approved: "✨ approved", known: "✓ knew it", pending: "⏳ waiting", review: "🔁 practice more", archived: "↩ undone", refresher: "🔁 review +" + REVIEW_PTS }[q.status]), playRec(q, st));
        if (parent && q.status === "refresher") { const rm = el("button", "ghost xs", "✕ Remove the +" + REVIEW_PTS);
          rm.onclick = () => { if (confirm("Remove the review points? The recording is kept.")) act({ action: "quran_delete", id: q.id }, () => Object.assign(q, { status: "archived", points: 0 }), rm, st); }; line.append(rm); }
        box.append(line);
      });
      card.append(box);
    }
    const can = !r || r.status === "review";
    if (!parent && can) {                             // child: record, or "I recited to Dad / Mom"
      const rb = el("button", "recb" + (rec && rec.state === "recording" && recFor === n ? " on" : ""), rec && rec.state === "recording" && recFor === n ? "■ Stop" : "🎤 Record my recitation"); rb.id = "qrecbtn";
      rb.onclick = () => rec && rec.state === "recording" ? rec.stop() : startRec(n, st);
      const row = el("div", "right left"); row.append(rb);
      if (!(rec && rec.state === "recording")) row.append(uploadButton("📁 Upload a recording", blob => { recBlob = blob; recFor = n; openSurah(child, n); }, m => setMsg(st, m, true)));
      if (recBlob && recFor === n) {
        const a = document.createElement("audio"); a.controls = true; a.src = URL.createObjectURL(recBlob); a.className = "aud";
        const del = el("button", "ghost", "Delete recording"); del.onclick = () => { recBlob = null; openSurah(child, n); };
        row.append(a, del);
      }
      const sib = sibling(child); let helper = "";
      const hrow = el("div", "qhelprow"); hrow.append(el("span", "note", "🤝 Did " + sib + " help you memorize it?"));
      const hseg = el("div", "seg"); [["", "No"], [sib, "Yes, " + sib + " helped"]].forEach(([v, t]) => { const bb = el("button", null, t); bb.setAttribute("aria-pressed", String(helper === v));
        bb.onclick = () => { helper = v; [...hseg.children].forEach(c => c.setAttribute("aria-pressed", String(c === bb))); }; hseg.append(bb); });
      hrow.append(hseg, el("span", "note qsmall", sib + " gets +" + HELPER_PTS + " points when Mom or Dad approve it."));
      const send = el("button", "primary", recBlob && recFor === n ? "Send to Mom and Dad" : "I recited it to Mom or Dad");
      send.onclick = async () => {
        send.disabled = true; setMsg(st, "Sending…");
        try {
          let audio = "";
          try { audio = recBlob && recFor === n ? await recToDataUrl(recBlob) : ""; } catch (e) { audio = ""; }
          let withVoice = !!audio;
          if (audio.length > 2700000) { audio = ""; withVoice = false; }              // too long to store: send without the voice
          try { await apiPost({ ...auth(), action: "quran_submit", surah: n, audio, helper }); }
          catch (e) {
            if (!audio || e.code === "net" || e.code === "login" || /already/i.test(e.message)) throw e;
            await apiPost({ ...auth(), action: "quran_submit", surah: n, audio: "", helper });   // voice refused: send it anyway, without the voice
            withVoice = false;
          }
          const hadRec = !!(recBlob && recFor === n);
          recBlob = null; await load(); ov.remove(); window.renderQuran(true);
          const s2 = $("qstatus"); if (s2) setMsg(s2, hadRec && !withVoice ? "Sent to Mom and Dad! 🌟 (The voice recording couldn't be saved, so recite it to them.)" : "Sent! Mom or Dad will listen soon. 🌟");
        } catch (e) { send.disabled = false; setMsg(st, oldScript(e) ? "The Quran tab needs the updated Google script." : e.message, true); }
      };
      card.append(row, hrow, send);
    }
    if (!parent && r && (r.status === "approved" || r.status === "known")) card.append(reviewBlock(child, n, st, ov));
    if (parent) {                                     // parents: award after hearing it, mark "already knew it", or undo
      const b = el("div", "right left");
      if (!r || r.status === "review" || r.status === "pending") {
        if (r && r.status === "pending") {
          const ok = el("button", "primary", "✅ Memorized (+" + ptsFor(x[3]) + ")"), more = el("button", "ghost", "🔁 Practice more");
          ok.onclick = () => act({ action: "quran_decide", id: r.id, status: "approved" }, () => Object.assign(r, { status: "approved", decidedBy: session.user, decided: Date.now() }), ok, st);
          more.onclick = () => act({ action: "quran_decide", id: r.id, status: "review" }, () => Object.assign(r, { status: "review", points: 0, decidedBy: session.user, decided: Date.now() }), more, st);
          b.append(ok, more);
        } else {
          const sib = sibling(child), hl = el("label", "qmark"), hc = document.createElement("input"); hc.type = "checkbox"; hc.id = "qh-" + n;
          hl.htmlFor = hc.id; hl.append(hc, document.createTextNode(" 🤝 " + sib + " helped (+" + HELPER_PTS + " for " + sib + ")")); card.append(hl);
          const ok = el("button", "primary", "✅ " + child + " recited it to me (+" + ptsFor(x[3]) + ")"), kn = el("button", "ghost", "✓ Already knew it (no points)");
          ok.onclick = () => act({ action: "quran_mark", child, surah: n, status: "approved", helper: hc.checked ? sib : "" }, () => window.quran.push({ id: "tmp" + Date.now(), created: Date.now(), child, surah: n, ayahs: x[3], points: ptsFor(x[3]), status: "approved", decidedBy: session.user, decided: Date.now(), audio: "", note: "", mode: "live" }), ok, st);
          kn.onclick = () => act({ action: "quran_mark", child, surah: n, status: "known" }, () => window.quran.push({ id: "tmp" + Date.now(), created: Date.now(), child, surah: n, ayahs: x[3], points: 0, status: "known", decidedBy: session.user, decided: Date.now(), audio: "", note: "", mode: "live" }), kn, st);
          b.append(ok, kn);
        }
      }
      if (r) {                                       // undo whatever is recorded for this surah (memorized, knew it, practice more, waiting)
        const un = el("button", "ghost", r.status === "approved" || r.status === "known" ? "↩ Undo – not memorized" : "↩ Clear this answer");
        un.onclick = async () => {
          if (!confirm("Clear " + x[1] + " for " + child + "? Points from it are removed; recordings are kept.")) return;
          const active = list().filter(q => q.child === child && q.surah === n && MAIN.includes(q.status));   // reviews already earned stay
          un.disabled = true; setMsg(st, "Saving…");
          try {
            for (const q of active) if (!String(q.id).startsWith("tmp")) await api({ ...auth(), action: "quran_delete", id: q.id });
            window.quran = list().map(q => active.includes(q) ? (q.audio ? { ...q, status: "archived", points: 0 } : null) : q).filter(Boolean);
            await load(); document.querySelectorAll(".nov").forEach(x => x.remove()); render(); window.renderQuran(true);
            const s2 = $("qstatus"); if (s2) setMsg(s2, x[1] + " cleared for " + child + ".");
          } catch (e) { un.disabled = false; setMsg(st, oldScript(e) ? "This needs the updated Google script." : e.message, true); }
        };
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
  .qreview{display:flex;flex-direction:column;gap:6px;padding:12px;border-radius:12px;background:#fbf1d8;border:1px solid var(--gold)}
  @media (prefers-color-scheme:dark){.qreview{background:#3d3018}}
  .qrevbtn{width:100%}
  .qextra{display:flex;flex-direction:column;gap:2px;padding:10px 12px;border-radius:12px;background:var(--wait-bg)}
  .qhelp{font-size:13px;font-weight:600;color:var(--accent)}
  .qhelprow{display:flex;flex-direction:column;gap:6px}.qsmall{font-size:12px}
  .qmark{display:flex;flex-direction:row;align-items:center;gap:6px;font-size:14px;color:var(--fg);font-weight:600}.qmark input{width:auto}
  .qrecs{display:flex;flex-direction:column;gap:6px;padding:10px;border-radius:12px;background:var(--wait-bg)}
  .qrecsh{font-size:14px}.qrec{display:flex;flex-direction:column;align-items:flex-start;gap:4px}
  .memob{min-height:40px}
  .upwrap{display:inline-flex}.upbtn{display:inline-flex;flex-direction:row;align-items:center;gap:6px;background:var(--surface);border:1px solid var(--line);color:var(--fg);border-radius:10px;padding:10px 14px;font-size:15px;font-weight:600;cursor:pointer}
  .memo{display:flex;flex-direction:column;gap:8px;padding:12px;border-radius:12px;background:var(--bg);border:1px solid var(--line)}
  .memorow{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
  .memolab{font-size:13px;font-weight:600;color:var(--muted)}
  .memorow select{width:auto;max-width:100%;padding:7px 8px}
  .memorow .seg button{padding:6px 10px;font-size:13px}
  .memorange{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--muted)}.memorange select{width:auto;padding:6px 8px}
  .memonow{display:flex;flex-direction:column;gap:6px}
  .memostate{font-size:14px;font-weight:700;color:var(--accent);min-height:1.3em}.memostate.turn{color:var(--gold)}.memostate.err{color:var(--late)}
  .memotext{font-family:"Amiri","Noto Naskh Arabic","Geeza Pro",serif;font-size:28px;line-height:1.9;text-align:center;min-height:0}
  .memoverses{font-family:"Amiri","Noto Naskh Arabic","Geeza Pro",serif;font-size:20px;line-height:2.1;text-align:justify;max-height:220px;overflow:auto;padding:8px;border-top:1px solid var(--line)}
  .mv{cursor:pointer;border-radius:6px;padding:0 2px}.mv.on{background:#fbf1d8;color:#6b4200}
  @media (prefers-color-scheme:dark){.mv.on{background:#3d3018;color:#f0c870}}
  </style>`);
})();
