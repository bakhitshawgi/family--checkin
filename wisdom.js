/* Wisdom under the header: an authentic verse or hadith (with its source), or a short wise saying (not attributed to anyone),
   with a small drawing. A different one each time the page opens; tap ↻ for another. */
(function () {
  const W = [
    ["Indeed, prayer keeps one away from wrongdoing.", "Quran 29:45", "mosque"],
    ["Successful indeed are the believers, those who are humble in their prayers.", "Quran 23:1–2", "mat"],
    ["Seek help through patience and prayer.", "Quran 2:45", "hands"],
    ["Truly, in the remembrance of Allah do hearts find rest.", "Quran 13:28", "heart"],
    ["And be good to your parents.", "Quran 17:23", "family"],
    ["Indeed, Allah is with the patient.", "Quran 2:153", "tree"],
    ["Remember Me, and I will remember you.", "Quran 2:152", "star"],
    ["Indeed, with hardship comes ease.", "Quran 94:6", "sun"],
    ["Allah does not burden a soul beyond what it can bear.", "Quran 2:286", "hands"],
    ["Speak good words to people.", "Quran 2:83", "smile"],
    ["Prayer is prescribed for the believers at fixed times.", "Quran 4:103", "clock"],
    ["My Lord, make me one who keeps up the prayer, and my children too.", "Quran 14:40", "family"],
    ["Do not walk on the earth arrogantly.", "Quran 17:37", "tree"],
    ["Guard your prayers carefully.", "Quran 2:238", "mat"],
    ["The deed most loved by Allah is prayer on time.", "Sahih al-Bukhari", "clock"],
    ["The first thing we will be asked about on the Day of Judgment is our prayer.", "Sunan at-Tirmidhi", "book"],
    ["If a river ran by your door and you bathed in it five times a day, would any dirt remain? That is like the five prayers.", "Bukhari & Muslim", "water"],
    ["Your smile for your brother is charity.", "Sunan at-Tirmidhi", "smile"],
    ["None of you truly believes until he loves for his brother what he loves for himself.", "Bukhari & Muslim", "heart"],
    ["The strong one is the one who controls himself when angry.", "Bukhari & Muslim", "star"],
    ["Whoever believes in Allah and the Last Day, let him say something good or stay quiet.", "Bukhari & Muslim", "smile"],
    ["The best of you are those who are best to their families.", "Sunan at-Tirmidhi", "family"],
    ["Purity is half of faith.", "Sahih Muslim", "water"],
    ["The comfort of my eyes was placed in prayer.", "Sunan an-Nasa'i", "mat"],
    ["Make things easy and do not make them hard.", "Sahih al-Bukhari", "sun"],
    ["Allah does not look at your looks or your wealth, but at your hearts and your deeds.", "Sahih Muslim", "heart"],
    ["The deeds most loved by Allah are those done regularly, even if small.", "Bukhari & Muslim", "tree"],
    ["A good word is charity.", "Bukhari & Muslim", "book"],
    ["Allah is Beautiful and loves beauty.", "Sahih Muslim", "star"],
    ["Read! In the name of your Lord who created.", "Quran 96:1", "book"],
    ["Establish prayer for My remembrance.", "Quran 20:14", "mat"],
    ["O you who believe, bow and prostrate, worship your Lord and do good, so that you may succeed.", "Quran 22:77", "mat"],
    ["Indeed, Allah loves those who do good.", "Quran 2:195", "heart"],
    ["Allah loves those who are patient.", "Quran 3:146", "tree"],
    ["Allah loves those who put their trust in Him.", "Quran 3:159", "hands"],
    ["Whoever is mindful of Allah, He will make a way out for him.", "Quran 65:2", "sun"],
    ["Whoever puts his trust in Allah, He is enough for him.", "Quran 65:3", "hands"],
    ["Call upon Me; I will answer you.", "Quran 40:60", "hands"],
    ["If you are grateful, I will surely give you more.", "Quran 14:7", "star"],
    ["Do not lose hope in the mercy of Allah.", "Quran 39:53", "sun"],
    ["Do not say to your parents even “uff”, and speak to them with kind words.", "Quran 17:23", "family"],
    ["Say: My Lord, have mercy on them as they raised me when I was small.", "Quran 17:24", "family"],
    ["The most noble of you before Allah is the most righteous of you.", "Quran 49:13", "star"],
    ["The believers are brothers.", "Quran 49:10", "family"],
    ["Help one another in goodness and righteousness.", "Quran 5:2", "hands"],
    ["Be just – that is closest to righteousness.", "Quran 5:8", "book"],
    ["Repel evil with what is better.", "Quran 41:34", "smile"],
    ["My Lord, increase me in knowledge.", "Quran 20:114", "book"],
    ["Our Lord, give us good in this world and good in the Hereafter.", "Quran 2:201", "hands"],
    ["So patience is beautiful.", "Quran 12:18", "tree"],
    ["Which of the favours of your Lord will you deny?", "Quran 55:13", "star"],
    ["My success is only through Allah.", "Quran 11:88", "sun"],
    ["Actions are judged by intentions.", "Bukhari & Muslim", "heart"],
    ["Prayer is light.", "Sahih Muslim", "sun"],
    ["Praying in congregation is twenty-seven times better than praying alone.", "Bukhari & Muslim", "mosque"],
    ["Whoever goes to the mosque in the morning or evening, Allah prepares a place for him in Paradise.", "Bukhari & Muslim", "mosque"],
    ["Whoever prays the two cool prayers (Fajr and Asr) will enter Paradise.", "Bukhari & Muslim", "sun"],
    ["Whoever prays Fajr is under the protection of Allah.", "Sahih Muslim", "sun"],
    ["The closest a servant is to his Lord is while in sujood, so make lots of du'a.", "Sahih Muslim", "mat"],
    ["When you enter the mosque, pray two rak'ahs before you sit.", "Bukhari & Muslim", "mosque"],
    ["The du'a between the adhan and the iqamah is not turned away.", "Abu Dawud & Tirmidhi", "hands"],
    ["The best of you are those who learn the Quran and teach it.", "Sahih al-Bukhari", "book"],
    ["A Muslim is the one from whose tongue and hand people are safe.", "Bukhari & Muslim", "smile"],
    ["Allah is gentle and loves gentleness in all things.", "Bukhari & Muslim", "heart"],
    ["Truthfulness leads to goodness, and goodness leads to Paradise.", "Bukhari & Muslim", "star"],
    ["Every act of kindness is charity.", "Bukhari & Muslim", "heart"],
    ["Removing something harmful from the path is charity.", "Sahih Muslim", "tree"],
    ["Modesty is part of faith.", "Bukhari & Muslim", "heart"],
    ["Do not get angry.", "Sahih al-Bukhari", "smile"],
    ["Spread salam among yourselves and you will love one another.", "Sahih Muslim", "smile"],
    ["Whoever does not thank people does not thank Allah.", "Abu Dawud & Tirmidhi", "hands"],
    ["He is not one of us who is not merciful to our young and does not respect our elders.", "Sunan at-Tirmidhi", "family"],
    ["Who deserves my good company most? Your mother, then your mother, then your mother, then your father.", "Bukhari & Muslim", "family"],
    ["The pleasure of Allah is in the pleasure of the parent.", "Sunan at-Tirmidhi", "family"],
    ["Be mindful of Allah and He will protect you.", "Sunan at-Tirmidhi", "star"],
    ["The strong believer is better and more beloved to Allah than the weak believer, and there is good in both.", "Sahih Muslim", "sun"],
    ["Allah does not show mercy to the one who does not show mercy to people.", "Bukhari & Muslim", "heart"],
    ["Religion is sincerity.", "Sahih Muslim", "heart"],
    ["A Muslim is a brother of a Muslim.", "Sahih al-Bukhari", "family"],
    ["Prayer is your meeting with Allah five times a day. Don't miss your appointment!", "Wise saying", "clock"],
    ["When you hear the adhan, put the game down – Allah is calling you.", "Wise saying", "mosque"],
    ["Every prayer is a fresh start.", "Wise saying", "sun"],
    ["Small good deeds every day grow into mountains of reward.", "Wise saying", "tree"],
    ["Be honest even when no one is watching – Allah always sees.", "Wise saying", "star"],
    ["A kind word can open a closed heart.", "Wise saying", "smile"],
    ["Say Bismillah when you start and Alhamdulillah when you finish.", "Wise saying", "book"],
    ["Help at home before anyone asks – that's what heroes do.", "Wise saying", "family"],
    ["Be the first to say sorry. Strong people forgive.", "Wise saying", "heart"],
    ["Share your food, share your smile.", "Wise saying", "smile"],
    ["Read a little Quran every day – your heart will thank you.", "Wise saying", "book"],
    ["Good friends remind you of Allah.", "Wise saying", "family"],
    ["Tell the truth, even when it's hard.", "Wise saying", "star"],
    ["Lower your voice and raise your manners.", "Wise saying", "smile"],
    ["Before you sleep, thank Allah for three things from today.", "Wise saying", "star"],
    ["Clean body, clean clothes, clean heart – ready for prayer.", "Wise saying", "water"],
    ["Pray on time today, and tomorrow will feel lighter.", "Wise saying", "clock"],
    ["Your parents' smile is worth more than any game.", "Wise saying", "family"],
    ["Keep your promise – your word is your honour.", "Wise saying", "hands"],
    ["Make du'a for someone else today. The angels say “and for you too”.", "Sahih Muslim (meaning)", "hands"],
  ];
  const ART = {
    mosque: '<rect x="14" y="30" width="36" height="22" rx="2" fill="var(--accent)"/><path d="M20 30a12 12 0 0 1 24 0z" fill="var(--sun)"/><path d="M32 12v6" stroke="var(--sun)" stroke-width="2.5" stroke-linecap="round"/><rect x="6" y="22" width="6" height="30" rx="1.5" fill="var(--accent)"/><rect x="52" y="22" width="6" height="30" rx="1.5" fill="var(--accent)"/><path d="M28 52v-9a4 4 0 0 1 8 0v9z" fill="var(--surface)"/><path d="M5 22l4-6 4 6M51 22l4-6 4 6" fill="var(--sun)"/>',
    mat: '<rect x="16" y="8" width="32" height="48" rx="4" fill="var(--accent)"/><rect x="20" y="12" width="24" height="40" rx="2" fill="none" stroke="var(--sun)" stroke-width="2"/><path d="M24 26a8 8 0 0 1 16 0v8H24z" fill="var(--sun)"/><path d="M22 46h20M22 50h20" stroke="var(--sun)" stroke-width="1.5"/>',
    hands: '<path d="M22 54V34c0-4-6-6-8-2l-4 10c-1 3 0 6 2 8l6 4zM42 54V34c0-4 6-6 8-2l4 10c1 3 0 6-2 8l-6 4z" fill="var(--skin)"/><path d="M22 34l6-20c1-3 5-3 5 1v20M42 34l-6-20c-1-3-5-3-5 1" fill="var(--skin)" stroke="var(--hair)" stroke-width="1" stroke-opacity=".25"/><circle cx="32" cy="8" r="3" fill="var(--sun)"/>',
    heart: '<path d="M32 54S8 40 8 24a12 12 0 0 1 24-4 12 12 0 0 1 24 4c0 16-24 30-24 30z" fill="var(--late)"/><path d="M20 22a6 6 0 0 1 6-5" stroke="#fff" stroke-width="3" stroke-linecap="round" fill="none" opacity=".7"/>',
    family: '<circle cx="18" cy="18" r="7" fill="var(--skin)"/><path d="M6 54a12 14 0 0 1 24 0z" fill="var(--boy)"/><circle cx="46" cy="18" r="7" fill="var(--skin)"/><path d="M39 17a7 7 0 0 1 14 0v14H39z" fill="var(--hair)"/><circle cx="46" cy="19" r="6" fill="var(--skin)"/><path d="M34 54a12 14 0 0 1 24 0z" fill="var(--girl)"/><circle cx="32" cy="34" r="5" fill="var(--skin)"/><path d="M24 54a8 10 0 0 1 16 0z" fill="var(--accent)"/><path d="M27 46l5 4 5-4" stroke="var(--late)" stroke-width="2" fill="none"/>',
    tree: '<rect x="29" y="34" width="6" height="22" rx="2" fill="var(--hair)"/><circle cx="32" cy="24" r="16" fill="var(--done)"/><circle cx="22" cy="30" r="9" fill="var(--done)"/><circle cx="42" cy="30" r="9" fill="var(--done)"/><circle cx="26" cy="20" r="2.5" fill="var(--sun)"/><circle cx="38" cy="26" r="2.5" fill="var(--sun)"/><path d="M10 56h44" stroke="var(--line)" stroke-width="3" stroke-linecap="round"/>',
    star: '<path d="M38 8a22 22 0 1 0 18 34A17 17 0 1 1 38 8z" fill="var(--moon)"/><path d="M20 14l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="var(--sun)"/><circle cx="14" cy="40" r="1.8" fill="var(--sun)"/><circle cx="26" cy="50" r="1.4" fill="var(--sun)"/>',
    sun: '<circle cx="32" cy="32" r="12" fill="var(--sun)"/><path d="M32 6v8M32 50v8M6 32h8M50 32h8M13.6 13.6l5.6 5.6M44.8 44.8l5.6 5.6M13.6 50.4l5.6-5.6M44.8 19.2l5.6-5.6" stroke="var(--sun)" stroke-width="3.5" stroke-linecap="round"/>',
    smile: '<circle cx="32" cy="32" r="24" fill="var(--sun)"/><circle cx="24" cy="27" r="3" fill="var(--hair)"/><circle cx="40" cy="27" r="3" fill="var(--hair)"/><path d="M21 37a12 12 0 0 0 22 0" stroke="var(--hair)" stroke-width="3.5" stroke-linecap="round" fill="none"/>',
    clock: '<circle cx="32" cy="32" r="24" fill="var(--surface)" stroke="var(--accent)" stroke-width="4"/><path d="M32 18v14l9 6" stroke="var(--accent)" stroke-width="4" stroke-linecap="round" fill="none"/><circle cx="32" cy="32" r="2.5" fill="var(--sun)"/><path d="M32 11v3M53 32h-3M32 53v-3M11 32h3" stroke="var(--muted)" stroke-width="2.5" stroke-linecap="round"/>',
    book: '<path d="M8 16c8-4 16-4 24 2v38c-8-6-16-6-24-2z" fill="var(--accent)"/><path d="M56 16c-8-4-16-4-24 2v38c8-6 16-6 24-2z" fill="var(--accent)" opacity=".8"/><path d="M14 24c4-1 8-1 12 2M14 31c4-1 8-1 12 2M38 26c4-3 8-3 12-2M38 33c4-3 8-3 12-2" stroke="var(--sun)" stroke-width="2" stroke-linecap="round"/><path d="M20 58h24" stroke="var(--hair)" stroke-width="3" stroke-linecap="round"/>',
    water: '<path d="M32 6C24 20 16 28 16 38a16 16 0 0 0 32 0c0-10-8-18-16-32z" fill="var(--boy)"/><path d="M24 40a8 8 0 0 0 8 8" stroke="#fff" stroke-width="3" stroke-linecap="round" fill="none" opacity=".7"/><path d="M6 58c4-3 8-3 12 0s8 3 12 0 8-3 12 0 8 3 12 0" stroke="var(--boy)" stroke-width="2.5" fill="none" stroke-linecap="round"/>',
  };
  // pick a different saying each time the page opens; remember recent ones so they don't come back soon
  const recent = () => { try { return JSON.parse(localStorage.getItem("wisdomSeen")) || []; } catch (e) { return []; } };
  const remember = i => { try { const r = [i, ...recent().filter(x => x !== i)].slice(0, Math.floor(W.length * 0.7)); localStorage.setItem("wisdomSeen", JSON.stringify(r)); } catch (e) {} };
  function pickNew() {
    const seen = new Set(recent()), fresh = W.map((_, i) => i).filter(i => !seen.has(i));
    const pool = fresh.length ? fresh : W.map((_, i) => i);
    const i = pool[Math.floor(Math.random() * pool.length)]; remember(i); return i;
  }
  let cur = pickNew();
  let shownAt = Date.now();
  function show() {
    shownAt = Date.now();
    const box = document.getElementById("wisdom"); if (!box) return;
    const [text, src, art] = W[cur];
    box.innerHTML = '<span class="wart" aria-hidden="true"><svg viewBox="0 0 64 64">' + ART[art] + '</svg></span>';
    const tx = el("div", "wtext"); tx.append(el("q", null, text), el("small", null, "— " + src));
    const nx = el("button", "wnext", "↻"); nx.setAttribute("aria-label", "Show another saying");
    nx.onclick = () => { cur = pickNew(); show(); };
    box.append(tx, nx);
  }
  document.head.insertAdjacentHTML("beforeend", `<style>
  .wisdom{display:flex;align-items:center;gap:12px;margin-top:10px;padding:12px 12px 12px 10px;border-radius:14px;background:var(--surface);border:1px solid var(--line);border-left:4px solid var(--gold)}
  .wart{flex:none;width:52px;height:52px}.wart svg{width:100%;height:100%;display:block}
  .wtext{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
  .wtext q{font-family:var(--display);font-size:16px;line-height:1.35;quotes:"\\201C" "\\201D"}
  .wtext small{font-size:12px;color:var(--muted)}
  .wnext{flex:none;align-self:flex-start;background:none;color:var(--muted);padding:2px 6px;font-size:16px;font-weight:400}
  </style>`);
  show();
  document.addEventListener("visibilitychange", () => { if (!document.hidden && Date.now() - shownAt > 30 * 60000) { cur = pickNew(); show(); } });   // back after a while: a new one
})();
