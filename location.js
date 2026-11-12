/* Prayer-time location for this device: GPS ("Use my location") or a city from the list.
   The exact GPS point is never saved or sent: it is snapped to the nearest city (or rounded to ~5 km).
   Uses the shared state from index.html: LOC, TORONTO, store, el, render, tcache. Times stay in Toronto's time zone (Eastern). */
(function () {
  const $ = id => document.getElementById(id);
  const CITIES = [
    ["Toronto", 43.6532, -79.3832], ["North York", 43.7615, -79.4111], ["Scarborough", 43.7764, -79.2318], ["Etobicoke", 43.6205, -79.5132],
    ["Mississauga", 43.5890, -79.6441], ["Brampton", 43.7315, -79.7624], ["Vaughan", 43.8361, -79.4983], ["Markham", 43.8561, -79.3370],
    ["Richmond Hill", 43.8828, -79.4403], ["Oakville", 43.4675, -79.6877], ["Milton", 43.5183, -79.8774], ["Burlington", 43.3255, -79.7990],
    ["Hamilton", 43.2557, -79.8711], ["Pickering", 43.8384, -79.0868], ["Ajax", 43.8509, -79.0204], ["Whitby", 43.8975, -78.9429],
    ["Oshawa", 43.8971, -78.8658], ["Aurora", 44.0065, -79.4504], ["Newmarket", 44.0592, -79.4613], ["Barrie", 44.3894, -79.6903],
    ["Guelph", 43.5448, -80.2482], ["Kitchener", 43.4516, -80.4925], ["Waterloo", 43.4643, -80.5204], ["Cambridge", 43.3616, -80.3144],
    ["St. Catharines", 43.1594, -79.2469], ["Niagara Falls", 43.0896, -79.0849], ["London", 42.9849, -81.2453], ["Windsor", 42.3149, -83.0364],
    ["Kingston", 44.2312, -76.4860], ["Ottawa", 45.4215, -75.6972], ["Montreal", 45.5017, -73.5673],
  ];
  const km = (a, b, c, d) => { const r = x => x * Math.PI / 180, dl = r(c - a), dg = r(d - b);
    const h = Math.sin(dl / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(dg / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); };
  function snap(lat, lng) {
    let best = null, bd = 1e9;
    CITIES.forEach(c => { const d = km(lat, lng, c[1], c[2]); if (d < bd) { bd = d; best = c; } });
    if (bd <= 12) return { name: best[0], lat: best[1], lng: best[2] };
    const r1 = x => Math.round(x * 20) / 20;           // ~5 km grid: about ±15 seconds of prayer time
    return { name: bd <= 80 ? "Near " + best[0] : "My location", lat: r1(lat), lng: r1(lng) };
  }
  function setLoc(loc, mode) {
    window.LOC_SET({ name: loc.name, lat: loc.lat, lng: loc.lng, mode });
  }
  window.LOC_SET = function (loc) {
    LOC = loc; store.set("loc", loc); render();
  };
  function gps(quiet) {
    return new Promise(res => {
      if (!navigator.geolocation) return res(quiet ? null : "This device can't share its location. Choose your city instead.");
      navigator.geolocation.getCurrentPosition(
        p => { setLoc(snap(p.coords.latitude, p.coords.longitude), "gps"); res(null); },
        e => res(quiet ? null : e.code === 1 ? "Location is blocked. Allow it for this site in the browser settings, or choose your city." : "Couldn't find the location. Try again or choose your city."),
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 30 * 60000 });
    });
  }
  // GPS mode: refresh quietly when the app opens, but only if permission was already given (no pop-up).
  async function refresh() {
    if (LOC.mode !== "gps" || !navigator.permissions || !navigator.geolocation) return;
    try { const st = await navigator.permissions.query({ name: "geolocation" }); if (st.state === "granted") gps(true); } catch (e) {}
  }

  function openPicker() {
    document.querySelectorAll(".nov").forEach(x => x.remove());
    const ov = el("div", "nov"), card = el("div", "novcard"), close = el("button", "ghost", "Close");
    close.onclick = () => ov.remove();
    const head = el("div", "phhead"); head.append(el("h2", null, "Prayer times for"), close);
    const st = el("div", "status");
    const now = el("p", "note", "Now: " + LOC.name + (LOC.mode === "gps" ? " (from this device's location)" : ""));
    const use = el("button", "primary", "📍 Use my location");
    use.onclick = async () => { use.disabled = true; st.className = "status"; st.textContent = "Finding your location…";
      const err = await gps(false); use.disabled = false;
      if (err) { st.className = "status err"; st.textContent = err; } else ov.remove(); };
    const lab = el("label", null, "Or choose a city"), sel = document.createElement("select"); sel.id = "citysel";
    CITIES.slice().sort((a, b) => a[0].localeCompare(b[0])).forEach(c => { const o = el("option", null, c[0]); o.value = c[0]; sel.append(o); });
    sel.value = CITIES.some(c => c[0] === LOC.name) ? LOC.name : "Toronto"; lab.htmlFor = sel.id; lab.append(sel);
    const save = el("button", "ghost", "Use this city");
    save.onclick = () => { const c = CITIES.find(x => x[0] === sel.value); setLoc({ name: c[0], lat: c[1], lng: c[2] }, "city"); ov.remove(); };
    card.append(head, now, use, st, lab, save,
      el("p", "note", "Each device keeps its own setting. Every prayer is saved with the place it was prayed at, so points are counted with that place's times. Your exact position is never saved – only the nearest city."));
    ov.append(card); document.body.append(ov);
    ov.addEventListener("click", e => { if (e.target === ov) ov.remove(); });
  }

  $("locbtn").onclick = openPicker;
  refresh();
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
})();
