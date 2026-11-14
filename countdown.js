/* "Our next meeting" countdown (top right) – after Motion Prompt #164 "Countdown timer":
   digit tiles 34×50, radius 6, 32px digits; only the digits that change animate: over 0.32 s (cubic ease-in-out)
   the old digit slides up and out and the new one slides in from below, clipped to the tile.
   Burgundy instead of orange. Counts down to the next Sunday 3:30 PM (Toronto), every week.
   Shown to Dad and the children. Uses the shared state from index.html: session, PT, zonedMs, parts, store. */
(function () {
  const MEETING = { weekday: 0, hour: 15, minute: 30, lastsHours: 3, title: "Our next meeting", who: ["Dad", "Yousuf", "Eva"] };
  const box = document.getElementById("meetcd"); if (!box) return;
  const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  // next meeting start (ms). While a meeting is on (start … start + lastsHours) this returns that meeting.
  function nextMeeting(now) {
    const t = parts(now);
    for (let k = -7; k <= 14; k++) {
      const d = new Date(Date.UTC(t[0], t[1] - 1, t[2] + k));
      if (d.getUTCDay() !== MEETING.weekday) continue;
      const start = zonedMs(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), MEETING.hour, MEETING.minute);
      if (now < start + MEETING.lastsHours * 3600e3) return start;
    }
  }

  let tiles = {}, built = "";
  function tile(key) {
    const t = document.createElement("span"); t.className = "cdtile";
    const d = document.createElement("span"); d.className = "cddig"; d.textContent = "0"; t.append(d);
    tiles[key] = { el: t, val: "0" }; return t;
  }
  function group(label, keys) {
    const g = document.createElement("span"); g.className = "cdgroup";
    const row = document.createElement("span"); row.className = "cdrow"; keys.forEach(k => row.append(tile(k)));
    const l = document.createElement("span"); l.className = "cdlab"; l.textContent = label;
    g.append(row, l); return g;
  }
  function build(withDays, start) {
    tiles = {}; box.replaceChildren();
    const top = document.createElement("div"); top.className = "cdtop";
    const h = document.createElement("b"); h.textContent = MEETING.title; top.append(h);
    const sh = document.createElement("span"); sh.className = "cdshort";              // phone: time next to the title
    sh.textContent = " · " + new Date(start).toLocaleDateString("en", { timeZone: PT.TZ, weekday: "short" }) + " " + PT.fmt(new Date(start)).replace(/\s?[AP]M$/i, ""); top.append(sh);
    const when = document.createElement("span"); when.className = "cdpill";
    when.textContent = "💛 " + new Date(start).toLocaleDateString("en", { timeZone: PT.TZ, weekday: "long" }) + " · " + PT.fmt(new Date(start));
    const row = document.createElement("div"); row.className = "cdtiles";
    const sep = () => { const s = document.createElement("span"); s.className = "cdsep"; s.textContent = ":"; return s; };
    if (withDays) { const d = sep(); d.classList.add("cdsepd"); row.append(group(withDays === 1 ? "day" : "days", ["d1"]), d); }
    row.append(group("hours", ["h1", "h2"]), sep(), group("min", ["m1", "m2"]), sep(), group("sec", ["s1", "s2"]));
    box.append(top, row, when);
    built = (withDays ? "D" + withDays : "") + start;
  }
  let fresh = false;                            // first values after (re)building: no animation
  function set(key, v) {                       // only a changed digit animates
    const t = tiles[key]; if (!t || t.val === v) return;
    t.val = v;
    const old = t.el.querySelector(".cddig:last-child"), nu = document.createElement("span");
    nu.className = "cddig"; nu.textContent = v;
    if (fresh || reduce || !old || document.hidden) { t.el.replaceChildren(nu); return; }
    nu.classList.add("in"); t.el.append(nu);
    void nu.offsetWidth;                         // start below the tile, then slide in
    nu.classList.remove("in"); old.classList.add("out");
    setTimeout(() => old.remove(), 340);
  }
  function tick() {
    const show = !!(session && MEETING.who.includes(session.user));
    box.hidden = !show; document.querySelector("header").classList.toggle("withcd", show);
    if (!show) return;
    const now = Date.now(), start = nextMeeting(now);
    if (now >= start) {                         // the meeting is on right now
      if (built !== "on" + start) { box.replaceChildren(); const p = document.createElement("div"); p.className = "cdnow";
        p.innerHTML = "<b>Together now 💛</b><span>Enjoy your time!</span>"; box.append(p); built = "on" + start; }
      return;
    }
    let s = Math.floor((start - now) / 1000);
    const days = Math.floor(s / 86400); s -= days * 86400;
    const hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60;
    const key = (days > 0 ? "D" + days : "") + start;
    fresh = built !== key; if (fresh) build(days > 0 ? days : 0, start);
    const p2 = n => String(n).padStart(2, "0");
    if (days > 0) set("d1", String(Math.min(days, 9)));
    set("h1", p2(hh)[0]); set("h2", p2(hh)[1]); set("m1", p2(mm)[0]); set("m2", p2(mm)[1]); set("s1", p2(ss)[0]); set("s2", p2(ss)[1]);
  }

  document.head.insertAdjacentHTML("beforeend", `<style>
  header{position:relative}
  /* compact: about 70% of the original #164 size */
  .meetcd{--burg1:#9e2447;--burg2:#6b1430;background:linear-gradient(135deg,var(--burg1),var(--burg2));color:#fff;border-radius:12px;
    padding:8px 10px;display:flex;flex-direction:column;align-items:center;gap:5px;box-shadow:0 4px 12px rgba(107,20,48,.28);align-self:flex-end;max-width:100%}
  .cdtop{text-align:center}
  .cdtop b{font-weight:700;font-size:12px;letter-spacing:.02em}
  .cdtiles{display:flex;align-items:flex-start;gap:3px}
  .cdgroup{display:flex;flex-direction:column;align-items:center;gap:2px}
  .cdrow{display:flex;gap:3px}
  .cdlab{font-size:9px;font-weight:700;opacity:.9}
  .cdsep{font-size:16px;font-weight:800;line-height:35px;height:35px;padding:0 1px}
  .cdtile{position:relative;width:24px;height:35px;border-radius:4px;background:#1d2235;color:#fff;overflow:hidden;display:block;box-shadow:0 1px 3px rgba(0,0,0,.25)}
  .cddig{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;font-variant-numeric:tabular-nums;
    transition:transform .32s cubic-bezier(.645,.045,.355,1)}
  .cddig.in{transform:translateY(100%)}
  .cddig.out{transform:translateY(-100%)}
  .cdpill{background:#fff;color:var(--burg2);border-radius:999px;padding:3px 10px;font-size:10px;font-weight:700;white-space:nowrap}
  .cdnow{display:flex;flex-direction:column;align-items:center}.cdnow b{font-size:14px}.cdnow span{font-size:11px;opacity:.9}
  header.withcd h1{white-space:nowrap}
  .cdshort{display:none}
  /* phone: a small card on the right, next to the date and next-prayer lines */
  @media (max-width:519px){
    header.withcd{display:grid;grid-template-columns:1fr auto;column-gap:8px;align-items:center}
    header.withcd > *{grid-column:1 / -1}
    header.withcd #datestr,header.withcd #nextline{grid-column:1}
    header.withcd .meetcd{grid-column:2;grid-row:3 / span 2;align-self:center;padding:5px 7px 6px;gap:3px;border-radius:9px}
    .cdtop b{font-size:10px}.cdshort{display:inline;font-size:10px;font-weight:600;opacity:.85}
    .cdlab,.cdpill{display:none}
    .cdtiles,.cdrow{gap:2px}
    .cdtile{width:16px;height:22px;border-radius:3px}.cddig{font-size:15px}
    .cdsep{font-size:12px;line-height:22px;height:22px;padding:0}
    .cdsep.cdsepd{font-size:0;padding:0 2px 0 1px}.cdsep.cdsepd::after{content:"d";font-size:11px;font-weight:700}
    .cdnow b{font-size:11px}.cdnow span{font-size:9px} }
  @media (max-width:419px){
    header.withcd #datestr,header.withcd #nextline{font-size:14px;white-space:nowrap}
    header.withcd .meetcd{padding:4px 6px 5px}
    .cdtile{width:14px;height:20px}.cddig{font-size:13px}.cdsep{line-height:20px;height:20px;font-size:11px}
    .cdtop b,.cdshort{font-size:9px} }
  @media (max-width:340px){ header.withcd h1{font-size:26px} header.withcd #datestr,header.withcd #nextline{font-size:12.5px}
    .cdtile{width:12px;height:18px}.cddig{font-size:11px}.cdsep{line-height:18px;height:18px;font-size:10px}.cdtop b,.cdshort{font-size:8px} }
  @media (min-width:520px){
    header.withcd{display:grid;grid-template-columns:1fr auto;column-gap:12px;align-items:start}
    header.withcd > *{grid-column:1}
    header.withcd .meetcd{grid-column:2;grid-row:1 / span 4}
    header.withcd .wisdom{grid-column:1 / -1} }
  @media (prefers-color-scheme:dark){ .meetcd{--burg1:#9b2a4c;--burg2:#4a0c1f} }
  </style>`);
  tick();
  function loop() { tick(); setTimeout(loop, 1000 - (Date.now() % 1000) + 5); }
  setTimeout(loop, 1000 - (Date.now() % 1000) + 5);
})();
