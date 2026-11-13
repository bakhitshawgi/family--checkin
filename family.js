/* Tasks, Requests and profile photos – for everyone (kids and parents).
   Uses the shared state from index.html: session, CONFIG, KIDS, ICONS, el, api, auth, store, render, fmtD, fmtT, kidKind, parts, dayKey. */
(function () {
  const $ = id => document.getElementById(id);
  const STATUS = [["todo", "Not done"], ["partial", "Partly done"], ["done", "Done"]];
  const MAX_REC_SECONDS = 45;
  let taskFilter = "all", reqFilter = "pending", showTaskForm = false;
  let taskDraft = { child: "", type: "", title: "", due: "" }, reqDraft = "";
  let rec = null, recBlob = null, recStart = 0, recTimer = null;
  const isParent = () => !!(session && (session.viewAll || session.admin));
  const isKid = () => !!(session && KIDS.some(k => k.id === session.user));

  /* POST for bigger things (photos, voice recordings). text/plain keeps it a simple request (no CORS preflight). */
  async function apiPost(params) {
    let j;
    try { const r = await fetch(CONFIG.scriptUrl, { method: "POST", body: JSON.stringify(params), redirect: "follow" }); j = await r.json(); }
    catch (e) { const err = new Error("Couldn't send. Check the internet and try again."); err.code = "net"; throw err; }
    if (!j.ok) { const err = new Error(j.message || "Something went wrong"); err.code = j.error; throw err; }
    return j;
  }
  const setMsg = (st, m, err) => { st.className = "status" + (err ? " err" : ""); st.textContent = m; };
  const oldScript = e => e && e.code !== "net" && e.code !== "bad" && e.code !== "login";
  const fmtDay = ymd => new Date(ymd + "T12:00:00Z").toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

  /* ---------- profile photos ---------- */
  let photos = store.get("photos") || {};
  window.avatar = function (user, cls) {
    const s = document.createElement("span"); s.className = (cls || "av") + " avatar";
    if (photos[user]) { const img = new Image(); img.src = photos[user]; img.alt = ""; s.append(img); }
    else if (KIDS.some(k => k.id === user)) s.innerHTML = ICONS[kidKind(user)];
    else { s.classList.add("initial"); s.textContent = (user || "?")[0]; }
    return s;
  };
  window.syncPhotos = async function (at) {
    if (!at || at === store.get("photosAt")) return;
    try { const j = await api({ ...auth(), action: "photos" }); photos = j.photos || {}; store.set("photos", photos); store.set("photosAt", at); render(); } catch (e) {}
  };
  /* Crop: after picking a picture, drag to move it, pinch / slider / mouse wheel to zoom, rotate; the circle shows the avatar.
     Resolves with a small square JPEG (data URL), or null if cancelled. */
  function cropPhoto(file, who) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("Couldn't read that picture. Try another one.")); };
      img.onload = () => {
        const V = Math.max(200, Math.min(300, window.innerWidth - 72)), dpr = Math.min(2, window.devicePixelRatio || 1);
        const iw = img.naturalWidth, ih = img.naturalHeight;
        let r = 0, z = 1, px = 0, py = 0;
        const dims = () => (r % 2 ? [ih, iw] : [iw, ih]);
        const base = () => { const [W, H] = dims(); return V / Math.min(W, H); };
        const clamp = () => { const [W, H] = dims(), sc = base() * z, mx = Math.max(0, (W * sc - V) / 2), my = Math.max(0, (H * sc - V) / 2);
          px = Math.max(-mx, Math.min(mx, px)); py = Math.max(-my, Math.min(my, py)); };
        function paint(ctx, size) {               // draw the current view into a size×size square
          const k = size / V, sc = base() * z * k;
          ctx.save(); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, size, size);
          ctx.translate(size / 2 + px * k, size / 2 + py * k); ctx.rotate(r * Math.PI / 2); ctx.scale(sc, sc);
          ctx.drawImage(img, -iw / 2, -ih / 2); ctx.restore();
        }
        const cv = document.createElement("canvas"); cv.width = cv.height = Math.round(V * dpr); cv.style.width = cv.style.height = V + "px";
        const ctx = cv.getContext("2d");
        const draw = () => { clamp(); paint(ctx, cv.width); };

        const ov = el("div", "nov cropov"), card = el("div", "novcard");
        const box = el("div", "cropbox"); box.style.width = box.style.height = V + "px"; box.append(cv, el("div", "cropmask"));
        const zoom = document.createElement("input"); zoom.type = "range"; zoom.min = "1"; zoom.max = "5"; zoom.step = "0.01"; zoom.value = "1"; zoom.className = "cropzoom"; zoom.setAttribute("aria-label", "Zoom");
        const setZoom = nz => { nz = Math.max(1, Math.min(5, nz)); px *= nz / z; py *= nz / z; z = nz; zoom.value = String(z); draw(); };
        zoom.oninput = () => setZoom(Number(zoom.value));
        const rot = el("button", "ghost", "⟳ Rotate"); rot.onclick = () => { r = (r + 1) % 4; px = py = 0; draw(); };
        const reset = el("button", "ghost", "Reset"); reset.onclick = () => { r = 0; px = py = 0; setZoom(1); };
        const ok = el("button", "primary", "Use photo"), cancel = el("button", "ghost", "Cancel");
        const done = v => { URL.revokeObjectURL(url); ov.remove(); res(v); };
        cancel.onclick = () => done(null);
        ok.onclick = () => {
          let out = "";
          for (const [S, q] of [[240, .85], [220, .75], [200, .65], [160, .6]]) {
            const c = document.createElement("canvas"); c.width = c.height = S; paint(c.getContext("2d"), S);
            out = c.toDataURL("image/jpeg", q); if (out.length < 40000) break;
          }
          done(out);
        };
        // drag to move, two fingers to zoom, mouse wheel to zoom
        const pts = new Map(); let pinch = 0;
        box.addEventListener("pointerdown", e => { box.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); pinch = 0; });
        box.addEventListener("pointermove", e => {
          if (!pts.has(e.pointerId)) return;
          const prev = pts.get(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
          if (pts.size === 1) { px += e.clientX - prev[0]; py += e.clientY - prev[1]; draw(); }
          else if (pts.size === 2) { const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch) setZoom(z * d / pinch); pinch = d; }
        });
        const up = e => { pts.delete(e.pointerId); pinch = 0; };
        box.addEventListener("pointerup", up); box.addEventListener("pointercancel", up);
        box.addEventListener("wheel", e => { e.preventDefault(); setZoom(z * Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
        box.tabIndex = 0; box.setAttribute("aria-label", "Photo position. Arrow keys move, plus and minus zoom.");
        box.addEventListener("keydown", e => {
          const m = { ArrowLeft: [-8, 0], ArrowRight: [8, 0], ArrowUp: [0, -8], ArrowDown: [0, 8] }[e.key];
          if (m) { px += m[0]; py += m[1]; draw(); e.preventDefault(); }
          if (e.key === "+" || e.key === "=") setZoom(z * 1.1); if (e.key === "-") setZoom(z / 1.1);
        });
        const zl = el("div", "zoomrow"); zl.append(el("span", "note", "−"), zoom, el("span", "note", "+"));
        const tools = el("div", "right left"); tools.append(rot, reset);
        const btns = el("div", "right"); btns.append(cancel, ok);
        card.append(el("h2", null, who ? (who === session.user ? "Your photo" : who + "'s photo") : "Crop photo"),
          el("p", "note", "Drag to move. Pinch or use the slider to zoom. The circle is what everyone will see."), box, zl, tools, btns);
        ov.append(card); document.body.append(ov); draw();
      };
      img.src = url;
    });
  }
  window.canEditPhoto = id => !!session && (id === session.user || (isParent() && KIDS.some(k => k.id === id)));
  window.openPhotos = function (only) {
    document.querySelectorAll(".nov").forEach(x => x.remove());
    const who = only ? [only] : isParent() ? [session.user, ...KIDS.map(k => k.id)] : [session.user];
    const ov = el("div", "nov"), card = el("div", "novcard"), close = el("button", "ghost", "Close");
    close.onclick = () => ov.remove();
    const head = el("div", "phhead"); head.append(el("h2", null, only ? (only === session.user ? "My photo" : only + "'s photo") : "Profile photo"), close);
    card.append(head);
    if (who.length > 1) card.append(el("p", "note", "You can set your own photo and the children's photos."));
    who.forEach(u => {
      const row = el("div", "phrow"), st = el("div", "status"), name = el("b", null, u === session.user ? u + " (you)" : u);
      const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*"; inp.id = "ph-" + u; inp.className = "phfile";
      const pick = el("label", "phpick", photos[u] ? "📷 Change photo" : "📷 Add photo"); pick.htmlFor = inp.id;
      const btns = el("div", "right"); btns.append(pick, inp);
      if (photos[u]) { const rm = el("button", "ghost", "Remove"); rm.onclick = () => savePhoto(u, "", st); btns.append(rm); }
      inp.onchange = async () => {
        const f = inp.files && inp.files[0]; if (!f) return;
        try {
          const data = await cropPhoto(f, u); inp.value = "";
          if (data) savePhoto(u, data, st); else setMsg(st, "");
        } catch (e) { setMsg(st, e.message, true); }
      };
      const line = el("div", "phline"); line.append(window.avatar(u, "av big"), name, btns);
      row.append(line, st); card.append(row);
    });
    ov.append(card); document.body.append(ov);
    ov.addEventListener("click", e => { if (e.target === ov) ov.remove(); });
  };
  async function savePhoto(u, data, st) {
    setMsg(st, data ? "Uploading…" : "Removing…");
    try {
      await apiPost({ ...auth(), action: "photo_set", who: u, photo: data });
      if (data) photos[u] = data; else delete photos[u];
      store.set("photos", photos); render(); document.querySelectorAll(".nov").forEach(x => x.remove());
    } catch (e) { setMsg(st, oldScript(e) ? "Photos need the updated Google script." : e.message, true); }
  }

  /* ---------- badges on the tabs ---------- */
  window.famBadge = function (tab) {
    if (tab === "requests" && isParent()) return (window.requests || []).filter(r => r.status === "pending").length;
    if (tab === "tasks" && isKid()) return (window.tasks || []).filter(t => t.status !== "done").length;
    return 0;
  };

  // Don't redraw a tab while someone is typing or recording in it (the page refreshes itself every 30 s).
  function editing(box) {
    const a = document.activeElement;
    return (rec && rec.state === "recording") || (a && box.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName));
  }
  window.renderFamily = function (tab, force) {
    const box = $(tab + "body"); if (!box) return;
    if (!force && editing(box)) return;
    if (tab === "tasks") renderTasks(box); else renderRequests(box);
  };
  const redraw = tab => { render(); window.renderFamily(tab, true); };

  /* ---------- Tasks ---------- */
  function renderTasks(box) {
    box.replaceChildren();
    if (!window.tasks) { box.append(el("p", "note", "Tasks need the updated Google script (ask Dad).")); return; }
    const parent = isParent(), st = el("div", "status"); st.id = "taskstatus";
    if (parent) {
      const add = el("button", showTaskForm ? "ghost" : "primary", showTaskForm ? "Close" : "+ New task");
      add.onclick = () => { showTaskForm = !showTaskForm; renderTasks(box); };
      box.append(add);
      if (showTaskForm) box.append(taskForm(box));
      const seg = el("div", "seg");
      [["all", "Both"], ...KIDS.map(k => [k.id, k.id])].forEach(([v, t]) => {
        const b = el("button", null, t); b.setAttribute("aria-pressed", String(taskFilter === v));
        b.onclick = () => { taskFilter = v; renderTasks(box); }; seg.append(b);
      });
      box.append(seg);
    } else box.append(el("p", "note", "Tasks from Mom and Dad. Tap how far you got."));
    box.append(st);
    const list = window.tasks.filter(t => !parent || taskFilter === "all" || t.child === taskFilter);
    const open = list.filter(t => t.status !== "done").sort((a, b) => (a.due || "9") < (b.due || "9") ? -1 : (a.due || "9") > (b.due || "9") ? 1 : a.created - b.created);
    const done = list.filter(t => t.status === "done").sort((a, b) => b.updated - a.updated);
    box.append(el("h3", "fh", "To do (" + open.length + ")"));
    if (!open.length) box.append(el("p", "note", parent ? "No open tasks." : "Nothing to do right now. 🎉"));
    open.forEach(t => box.append(taskCard(t, box, st)));
    if (done.length) { box.append(el("h3", "fh", "Done (" + done.length + ")")); done.forEach(t => box.append(taskCard(t, box, st))); }
  }
  function taskForm(box) {
    const f = el("div", "famform"), types = window.taskTypes || ["Other"], st = el("div", "status");
    if (!taskDraft.child) taskDraft.child = taskFilter !== "all" ? taskFilter : KIDS[0].id;
    if (!taskDraft.type) taskDraft.type = types[0];
    const mkSel = (id, label, opts, key) => {
      const l = el("label", null, label), s = document.createElement("select"); s.id = id;
      opts.forEach(o => { const op = el("option", null, o); op.value = o; s.append(op); });
      s.value = taskDraft[key]; s.onchange = () => taskDraft[key] = s.value; l.htmlFor = id; l.append(s); return l;
    };
    const two = el("div", "two"); two.append(mkSel("tk-child", "For", KIDS.map(k => k.id), "child"), mkSel("tk-type", "Type", types, "type"));
    const tl = el("label", null, "Task"), ti = el("input"); ti.id = "tk-title"; ti.maxLength = 200; ti.placeholder = "e.g. Memorize Surat Al-Asr"; ti.value = taskDraft.title;
    ti.oninput = () => taskDraft.title = ti.value; tl.htmlFor = ti.id; tl.append(ti);
    const dl = el("label", null, "Due (optional)"), di = el("input"); di.type = "date"; di.id = "tk-due"; di.value = taskDraft.due;
    di.oninput = () => taskDraft.due = di.value; dl.htmlFor = di.id; dl.append(di);
    const save = el("button", "primary", "Save task");
    save.onclick = async () => {
      if (!taskDraft.title.trim()) { setMsg(st, "Write what the task is.", true); ti.focus(); return; }
      save.disabled = true; setMsg(st, "Saving…");
      try {
        const d = { ...taskDraft, title: taskDraft.title.trim() };
        const j = await api({ ...auth(), action: "task_save", ...d });
        window.tasks.push({ id: j.id, created: Date.now(), by: session.user, ...d, status: "todo", rating: 0, updated: Date.now(), childNote: "" });
        taskDraft = { child: d.child, type: d.type, title: "", due: "" }; showTaskForm = false; redraw("tasks");
        const s2 = $("taskstatus"); if (s2) setMsg(s2, "Task saved for " + d.child + ".");
      } catch (e) { save.disabled = false; setMsg(st, oldScript(e) ? "Tasks need the updated Google script." : e.message, true); }
    };
    f.append(two, tl, dl, save, st);
    return f;
  }
  function taskCard(t, box, st) {
    const parent = isParent(), today = dayKey(parts(Date.now()));
    const c = el("div", "fcard task-" + t.status), top = el("div", "fhead"), tx = el("div", "fmain");
    top.append(window.avatar(t.child, "av sm"));
    tx.append(el("b", null, t.title));
    const overdue = t.due && t.due < today && t.status !== "done";
    const meta = el("div", "note");
    meta.textContent = [t.type, parent ? "for " + t.child : "", "from " + t.by].filter(Boolean).join(" · ");
    if (t.due) meta.append(el("span", overdue ? "due late" : "due", " · due " + fmtDay(t.due) + (overdue ? " (late)" : "")));
    tx.append(meta); top.append(tx);
    if (parent) {
      const del = el("button", "ghost xs", "Delete"); del.setAttribute("aria-label", "Delete task " + t.title);
      del.onclick = () => { if (confirm("Delete this task?\n" + t.title)) act({ action: "task_delete", id: t.id }, () => window.tasks = window.tasks.filter(x => x.id !== t.id), del, st, "tasks"); };
      top.append(del);
    }
    c.append(top);
    const locked = !parent && !!t.rating;
    const seg = el("div", "seg st"); seg.setAttribute("role", "group"); seg.setAttribute("aria-label", "How far is it done");
    STATUS.forEach(([v, lab]) => {
      const b = el("button", "s-" + v, lab); b.setAttribute("aria-pressed", String(t.status === v)); b.disabled = locked;
      b.onclick = () => { if (t.status !== v) act({ action: "task_status", id: t.id, status: v }, () => { t.status = v; t.updated = Date.now(); if (v === "todo") t.rating = 0; }, b, st, "tasks"); };
      seg.append(b);
    });
    c.append(seg);
    if (t.status !== "todo") {
      const sr = el("div", "stars");
      sr.append(el("span", "note", parent ? (t.rating ? "Rating:" : "Rate it:") : (t.rating ? "Rating:" : "Waiting for a rating from Mom or Dad")));
      if (parent || t.rating) for (let i = 1; i <= 5; i++) {
        const s = el(parent ? "button" : "span", "star" + (i <= t.rating ? " on" : ""), "★");
        s.setAttribute("aria-label", i + (i === 1 ? " star" : " stars"));
        if (parent) s.onclick = () => { const n = i === t.rating ? 0 : i; act({ action: "task_rate", id: t.id, stars: n }, () => t.rating = n, s, st, "tasks"); };
        sr.append(s);
      }
      c.append(sr);
    }
    return c;
  }
  async function act(params, apply, btn, st, tab) {
    btn.disabled = true; setMsg(st, "Saving…");
    try { await api({ ...auth(), ...params }); apply(); redraw(tab); const s2 = $(tab === "tasks" ? "taskstatus" : "reqstatus"); if (s2) setMsg(s2, "Saved."); }
    catch (e) { btn.disabled = false; setMsg(st, oldScript(e) ? "This needs the updated Google script." : e.message, true); }
  }

  /* ---------- Requests ---------- */
  function renderRequests(box) {
    box.replaceChildren();
    if (!window.requests) { box.append(el("p", "note", "Requests need the updated Google script (ask Dad).")); return; }
    const parent = isParent(), st = el("div", "status"); st.id = "reqstatus";
    if (isKid()) box.append(requestForm(box));
    if (parent) {
      const seg = el("div", "seg");
      [["pending", "Waiting"], ["all", "All"]].forEach(([v, t]) => {
        const b = el("button", null, t); b.setAttribute("aria-pressed", String(reqFilter === v));
        b.onclick = () => { reqFilter = v; renderRequests(box); }; seg.append(b);
      });
      box.append(seg);
    }
    box.append(st);
    const list = window.requests.filter(r => !parent || reqFilter === "all" || r.status === "pending").sort((a, b) => b.created - a.created);
    if (isKid()) box.append(el("h3", "fh", "My requests"));
    if (!list.length) box.append(el("p", "note", parent ? (reqFilter === "pending" ? "No requests waiting." : "No requests yet.") : "You haven't asked for anything yet."));
    list.forEach(r => box.append(requestCard(r, box, st)));
  }
  function requestForm(box) {
    const f = el("div", "famform"), st = el("div", "status");
    const l = el("label", null, "What would you like to ask Mom or Dad?"), ta = document.createElement("textarea");
    ta.id = "rq-text"; ta.maxLength = 500; ta.rows = 3; ta.value = reqDraft; ta.placeholder = "Write here, or record your voice";
    ta.oninput = () => reqDraft = ta.value; l.htmlFor = ta.id; l.append(ta);
    const recRow = el("div", "right left");
    const rb = el("button", "recb" + (rec && rec.state === "recording" ? " on" : ""), rec && rec.state === "recording" ? "■ Stop" : "🎤 Record voice"); rb.id = "recbtn";
    rb.onclick = () => rec && rec.state === "recording" ? rec.stop() : startRec(st);
    recRow.append(rb);
    if (recBlob) {
      const a = document.createElement("audio"); a.controls = true; a.src = URL.createObjectURL(recBlob); a.className = "aud";
      const del = el("button", "ghost", "Delete recording"); del.onclick = () => { recBlob = null; renderRequests(box); };
      recRow.append(a, del);
    }
    const send = el("button", "primary", "Send request");
    send.onclick = async () => {
      if (!reqDraft.trim() && !recBlob) { setMsg(st, "Write or record your request first.", true); return; }
      send.disabled = true; setMsg(st, "Sending…");
      try {
        const audio = recBlob ? await toDataUrl(recBlob) : "";
        if (audio.length > 540000) throw new Error("The recording is too long. Record a shorter one.");
        await apiPost({ ...auth(), action: "request_add", text: reqDraft.trim(), audio });
        reqDraft = ""; recBlob = null; await load(); window.renderFamily("requests", true);
        const s2 = $("reqstatus"); if (s2) setMsg(s2, "Sent! Mom and Dad will answer soon.");
      } catch (e) { send.disabled = false; setMsg(st, oldScript(e) ? "Requests need the updated Google script." : e.message, true); }
    };
    f.append(l, recRow, send, st);
    return f;
  }
  async function startRec(st) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) { setMsg(st, "This device can't record here. Please write your request.", true); return; }
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch (e) { setMsg(st, "The microphone is blocked. Allow it in the browser settings, or write instead.", true); return; }
    const mime = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"].find(m => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) || "";
    const opts = { audioBitsPerSecond: 32000 }; if (mime) opts.mimeType = mime;
    try { rec = new MediaRecorder(stream, opts); } catch (e) { rec = new MediaRecorder(stream); }
    const chunks = [];
    rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = () => {
      stream.getTracks().forEach(t => t.stop()); clearInterval(recTimer);
      recBlob = chunks.length ? new Blob(chunks, { type: (rec.mimeType || mime || "audio/mp4") }) : null;
      window.renderFamily("requests", true);
    };
    rec.start(1000); recStart = Date.now(); setMsg(st, "");
    window.renderFamily("requests", true);
    recTimer = setInterval(() => {
      const s = Math.floor((Date.now() - recStart) / 1000), b = $("recbtn");
      if (b) b.textContent = "■ Stop (0:" + String(s).padStart(2, "0") + " / 0:" + MAX_REC_SECONDS + ")";
      if (s >= MAX_REC_SECONDS && rec.state === "recording") rec.stop();
    }, 250);
  }
  const toDataUrl = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(new Error("Couldn't read the recording.")); r.readAsDataURL(blob); });

  function requestCard(r, box, st) {
    const parent = isParent(), c = el("div", "fcard req-" + r.status), top = el("div", "fhead"), tx = el("div", "fmain");
    top.append(window.avatar(r.child, "av sm"));
    tx.append(el("b", null, parent ? r.child : "You asked"), el("div", "note", fmtD(r.created) + ", " + fmtT(r.created)));
    top.append(tx);
    const chip = { pending: ["chip", "Waiting"], approved: ["chip ok", "✓ Approved"], declined: ["chip late", "✕ Declined"] }[r.status] || ["chip", r.status];
    top.append(el("span", chip[0], chip[1]));
    c.append(top);
    if (r.text) c.append(el("p", "rtext", r.text));
    if (r.audio) {
      const pb = el("button", "ghost", "▶ Play voice message");
      pb.onclick = async () => {
        pb.disabled = true; pb.textContent = "Loading…";
        try {
          const j = await api({ ...auth(), action: "audio", id: r.audio });
          const a = document.createElement("audio"); a.controls = true; a.src = j.audio; a.className = "aud";
          pb.replaceWith(a); a.play().catch(() => {});
        } catch (e) { pb.disabled = false; pb.textContent = "▶ Play voice message"; setMsg(st, e.message, true); }
      };
      c.append(pb);
    }
    if (r.status !== "pending") {
      const who = r.decidedBy ? (r.status === "approved" ? "Approved by " : "Declined by ") + r.decidedBy : "";
      c.append(el("div", "note", who + (r.decided ? " · " + fmtD(r.decided) : "")));
      if (r.reply) c.append(el("p", "reply", "💬 " + r.reply));
    }
    const btns = el("div", "right left");
    if (parent && r.status === "pending") {
      const ri = el("input"); ri.id = "rp-" + r.id; ri.maxLength = 300; ri.placeholder = "Reply (optional)"; ri.setAttribute("aria-label", "Reply to " + r.child);
      const ok = el("button", "primary", "Approve"), no = el("button", "primary lateb", "Decline");
      const decide = (status, b) => act({ action: "request_decide", id: r.id, status, reply: ri.value.trim() },
        () => Object.assign(r, { status, decidedBy: session.user, decided: Date.now(), reply: ri.value.trim() }), b, st, "requests");
      ok.onclick = () => decide("approved", ok); no.onclick = () => decide("declined", no);
      c.append(ri); btns.append(ok, no);
    } else if (parent) {
      const back = el("button", "ghost", "Change answer");
      back.onclick = () => act({ action: "request_decide", id: r.id, status: "pending" }, () => Object.assign(r, { status: "pending", decidedBy: "", decided: 0, reply: "" }), back, st, "requests");
      btns.append(back);
    }
    if (parent || r.status === "pending") {
      const del = el("button", "ghost", "Delete");
      del.onclick = () => { if (confirm("Delete this request?")) act({ action: "request_delete", id: r.id }, () => window.requests = window.requests.filter(x => x.id !== r.id), del, st, "requests"); };
      btns.append(del);
    }
    if (btns.children.length) c.append(btns);
    return c;
  }

  document.head.insertAdjacentHTML("beforeend", `<style>
  .avatar{border-radius:50%;overflow:hidden;display:block;flex:none}
  .avatar img{width:100%;height:100%;object-fit:cover;display:block}
  .avatar.initial{background:var(--sel);color:var(--accent);display:flex;align-items:center;justify-content:center;font-family:var(--display);font-size:22px}
  .av.sm{width:36px;height:36px}.av.sm.initial{font-size:16px}
  .av.big{width:56px;height:56px}
  .fambody{display:flex;flex-direction:column;gap:10px}
  .fh{font-size:14px;color:var(--muted);margin:6px 0 0;font-weight:600}
  .famform{display:flex;flex-direction:column;gap:10px;padding:12px;border:1px solid var(--line);border-radius:12px;background:var(--bg)}
  .famform textarea{font:inherit;color:var(--fg);background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:10px;width:100%;resize:vertical}
  .famform input,.famform select{background:var(--surface)}
  .two{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .fcard{display:flex;flex-direction:column;gap:8px;padding:12px;border-radius:12px;background:var(--wait-bg)}
  .fcard.task-done,.fcard.req-approved{background:var(--done-bg)}.fcard.req-declined{background:var(--late-bg)}
  .fhead{display:flex;align-items:center;gap:10px}.fmain{flex:1;min-width:0}.fmain b{display:block;overflow-wrap:anywhere}
  .due.late{color:var(--late);font-weight:600}
  .seg.st{display:grid;grid-template-columns:repeat(3,1fr)}
  .seg.st button{padding:8px 4px;font-size:13px}
  .seg.st button.s-done[aria-pressed="true"]{color:var(--done);box-shadow:inset 0 0 0 2px var(--done)}
  .seg.st button.s-partial[aria-pressed="true"]{color:var(--gold);box-shadow:inset 0 0 0 2px var(--gold)}
  .seg.st button.s-todo[aria-pressed="true"]{color:var(--late);box-shadow:inset 0 0 0 2px var(--late)}
  .seg button:disabled{opacity:.6;cursor:default}
  .stars{display:flex;align-items:center;gap:2px;flex-wrap:wrap}.stars .note{margin-right:6px}
  .star{background:none;border:0;padding:2px 3px;font-size:26px;line-height:1;color:var(--line)}.star.on{color:var(--gold)}
  span.star{font-size:22px}
  .xs{padding:4px 8px;font-size:12px}
  .rtext{margin:0;white-space:pre-wrap;overflow-wrap:anywhere}
  .reply{margin:0;font-size:14px;color:var(--accent);overflow-wrap:anywhere}
  .right.left{justify-content:flex-start}
  .recb{background:var(--surface);border:1px solid var(--line);color:var(--fg)}.recb.on{background:var(--late);color:#fff;border-color:var(--late)}
  .aud{width:100%;max-width:320px;height:40px}
  .phhead{display:flex;justify-content:space-between;align-items:center}
  .cropov{z-index:60;align-items:center}
  .cropov .novcard{align-items:center;max-width:380px}
  .cropov .novcard > .note,.cropov .novcard > h2{align-self:stretch}
  .cropbox{position:relative;border-radius:12px;overflow:hidden;touch-action:none;cursor:grab;background:#222;flex:none}
  .cropbox:active{cursor:grabbing}.cropbox canvas{display:block}
  .cropmask{position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle closest-side,transparent 99%,rgba(0,0,0,.5) 100%);box-shadow:inset 0 0 0 1px rgba(255,255,255,.25)}
  .cropmask::after{content:"";position:absolute;inset:0;border-radius:50%;box-shadow:inset 0 0 0 2px rgba(255,255,255,.9)}
  .zoomrow{display:flex;align-items:center;gap:8px;align-self:stretch}.cropzoom{flex:1;padding:0;border:0;background:none;accent-color:var(--accent)}
  .cropov .right{align-self:stretch}
  .phrow{display:flex;flex-direction:column;gap:4px;padding:8px 0;border-top:1px solid var(--line)}
  .phline{display:flex;align-items:center;gap:12px}.phline b{flex:1;min-width:0}
  .phpick{display:inline-flex;flex-direction:row;align-items:center;background:var(--accent);color:var(--accent-ink);border-radius:10px;padding:8px 14px;font-size:14px;font-weight:600;cursor:pointer}
  .phfile{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}
  .ptabs{overflow-x:auto;scrollbar-width:none}.ptabs::-webkit-scrollbar{display:none}
  .ptabs button{white-space:nowrap;font-size:14px;padding:9px 8px;position:relative}
  .badge{display:inline-block;min-width:18px;height:18px;line-height:18px;border-radius:9px;background:var(--late);color:#fff;font-size:11px;margin-left:4px;padding:0 5px;vertical-align:1px}
  .avatar.editable{cursor:pointer;position:relative;overflow:visible}
  .avatar.editable img,.avatar.editable svg{border-radius:50%}
  .avatar.editable::after{content:"📷";position:absolute;right:-4px;bottom:-4px;width:20px;height:20px;border-radius:50%;background:var(--surface);border:1px solid var(--line);font-size:11px;line-height:18px;text-align:center}
  </style>`);
})();
