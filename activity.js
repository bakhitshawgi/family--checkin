/* Sign-in activity: every sign-in / app open is reported to the sheet; only Dad (admin) can see the Activity tab.
   Uses the shared state from index.html: session, el, api, auth, store, fmtD, fmtT. */
(function () {
  const $ = id => document.getElementById(id);
  const OPEN_EVERY_MS = 30 * 60000;                 // count an "open" at most once every 30 minutes per device
  let range = "7", data = null, fetchedAt = 0, fetchedRange = "";

  function deviceInfo() {
    const ua = navigator.userAgent || "", touch = navigator.maxTouchPoints > 1;
    let device;
    if (/iPad/.test(ua) || (/Macintosh/.test(ua) && touch)) device = "iPad";
    else if (/iPhone|iPod/.test(ua)) device = "iPhone";
    else if (/Android/.test(ua)) device = /Mobile/.test(ua) ? "Android phone" : "Android tablet";
    else if (/Windows/.test(ua)) device = "Computer (Windows)";
    else if (/CrOS/.test(ua)) device = "Computer (Chromebook)";
    else if (/Macintosh|Mac OS X/.test(ua)) device = "Computer (Mac)";
    else if (/Linux/.test(ua)) device = "Computer (Linux)";
    else device = "Other";
    const browser = /Edg\//.test(ua) ? "Edge" : /CriOS|Chrome\//.test(ua) ? "Chrome" : /FxiOS|Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
    const app = (navigator.standalone || (window.matchMedia && matchMedia("(display-mode: standalone)").matches)) ? " (home-screen icon)" : "";
    return { device, browser: browser + app, ua: ua.slice(0, 300) };
  }
  async function getJson(url, ms) {
    const c = new AbortController(), t = setTimeout(() => c.abort(), ms);
    try { const r = await fetch(url, { signal: c.signal }); return await r.json(); } finally { clearTimeout(t); }
  }
  // The Google script can't see the visitor's IP, so the page looks it up (approximate city from the internet provider).
  async function ipInfo() {
    try { const j = await getJson("https://ipwho.is/", 4000); if (j && j.success !== false && j.ip) return { ip: j.ip, city: j.city || "", region: j.region || "", country: j.country || "" }; } catch (e) {}
    try { const j = await getJson("https://api.ipify.org?format=json", 3000); if (j && j.ip) return { ip: j.ip }; } catch (e) {}
    return {};
  }
  window.reportVisit = async function (event) {
    if (!session) return;
    const now = Date.now();
    if (event !== "login" && now - (store.get("lastVisit") || 0) < OPEN_EVERY_MS) return;
    store.set("lastVisit", now);
    try { await api({ ...auth(), action: "visit", event, ...deviceInfo(), ...(await ipInfo()) }); } catch (e) {}
  };

  /* ---------- Activity tab (Dad only) ---------- */
  window.renderActivity = async function (force) {
    const box = $("activitybody"); if (!box || !session || !session.admin) return;
    if (!force && data && fetchedRange === range && Date.now() - fetchedAt < 300000) return draw(box);
    if (!data || fetchedRange !== range) box.replaceChildren(el("p", "note", "Loading…"));
    try {
      const since = range === "all" ? 0 : Date.now() - Number(range) * 86400e3;
      const j = await api({ ...auth(), action: "visits", since });
      data = j.visits.map(([at, user, event, ip, city, region, country, device, browser]) => ({ at, user, event, ip, city, region, country, device, browser }));
      fetchedAt = Date.now(); fetchedRange = range; draw(box);
    } catch (e) {
      box.replaceChildren(el("p", "status err", e.code === "bad" ? e.message : e.code === "net" ? e.message : "Activity needs the updated Google script."));
    }
  };
  const place = v => [v.city, v.country].filter(Boolean).join(", ") || "Unknown place";
  function draw(box) {
    box.replaceChildren();
    const top = el("div", "monthbar"), seg = el("div", "seg");
    [["7", "7 days"], ["30", "30 days"], ["all", "All"]].forEach(([v, t]) => {
      const b = el("button", null, t); b.setAttribute("aria-pressed", String(range === v));
      b.onclick = () => { range = v; window.renderActivity(); }; seg.append(b);
    });
    const ref = el("button", "ghost", "Refresh"); ref.onclick = () => window.renderActivity(true);
    top.append(seg, ref); box.append(top);
    box.append(el("p", "note", "Only you (Dad) can see this. Place is approximate – it comes from the internet provider, not GPS."));

    const users = ["Yousuf", "Eva", "Mom", "Dad"];
    users.forEach(u => {
      const vs = data.filter(v => v.user === u), c = el("div", "acard"), head = el("div", "fhead");
      head.append(window.avatar ? window.avatar(u, "av sm") : el("span"), el("b", "aname", u));
      const nums = el("div", "anums");
      [["Sign-ins", vs.filter(v => v.event === "Sign-in").length], ["App opens", vs.filter(v => v.event !== "Sign-in").length]].forEach(([l, n]) => {
        const d = el("div", "snum"); d.append(el("b", null, String(n)), el("span", null, l)); nums.append(d);
      });
      c.append(head, nums);
      if (vs.length) {
        const last = vs[vs.length - 1];
        c.append(el("div", "note", "Last: " + fmtD(last.at) + ", " + fmtT(last.at) + " · " + last.device + " · " + place(last)));
        const devs = {}; vs.forEach(v => devs[v.device] = (devs[v.device] || 0) + 1);
        const ips = {}; vs.forEach(v => { if (v.ip) ips[v.ip] = (ips[v.ip] || 0) + 1; });
        c.append(el("div", "note", "Devices: " + Object.entries(devs).map(([d, n]) => d + " ×" + n).join(", ")));
        c.append(el("div", "note", "Places / IPs: " + Object.keys(ips).length + " different"));
      } else c.append(el("div", "note", "No activity in this period."));
      box.append(c);
    });

    box.append(el("h3", "fh", "Latest activity"));
    const list = data.slice(-60).reverse();
    if (!list.length) box.append(el("p", "note", "Nothing yet. It starts counting after the script update."));
    list.forEach(v => {
      const it = el("div", "hitem"), w = el("div", "what");
      w.append(el("div", null, v.user + " · " + v.event + " · " + v.device), el("small", null, fmtD(v.at) + ", " + fmtT(v.at) + " · " + place(v) + (v.ip ? " · IP " + v.ip : "") + (v.browser ? " · " + v.browser : "")));
      it.append(w); box.append(it);
    });
  }

  document.head.insertAdjacentHTML("beforeend", `<style>
  .acard{display:flex;flex-direction:column;gap:6px;padding:12px;border-radius:12px;background:var(--wait-bg)}
  .aname{font-family:var(--display);font-weight:400;font-size:18px}
  .anums{display:grid;grid-template-columns:1fr 1fr;gap:6px}
  #activitybody .hitem small{overflow-wrap:anywhere}
  </style>`);
})();
