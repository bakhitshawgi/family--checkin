# Family check-in

A one-page prayer check-in for Yousuf and Eva.

- Each child opens their **personal link** once; the phone remembers them. After that they open the page and tap **Prayed**.
- Buttons stay locked until each prayer time starts (Toronto, ISNA method). After the time ends they turn into **Prayed (late)**.
- Points: on time 1, up to 2 h late 0.5, later 0.25. 1 point = $0.50. Dad's view shows both children and the month total, and can remove a wrong entry.
- Taps are saved to the family Google Sheet (tab **Log**) through a small Google Apps Script (`apps-script/Code.gs`).

## Setup (once)

1. Open the family sheet, then **Extensions > Apps Script**. Replace everything with `apps-script/Code.gs`, change the three passwords at the top, and **Save**.
2. **Deploy > New deployment > Web app**. Execute as: **Me**. Who has access: **Anyone**. Deploy, allow access, and copy the URL that ends in `/exec`.
3. Put that URL in `CONFIG.scriptUrl` at the top of the script in `index.html`.
4. Personal links: `https://bakhitshawgi.github.io/family--checkin/#u=Eva&k=EVA-PASSWORD` (same for Yousuf and Dad).

The page is served with GitHub Pages from the `main` branch root.
