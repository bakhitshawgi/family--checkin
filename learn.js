/* Learn (Maliki school): how many rak'ahs, what to recite, how to pray and how to make wudu (for children).
   Opened from the book button on each prayer: openLearn("Fajr"). */
(function () {
  const INFO = {
    Fajr:    { rakahs: 2, aloud: "Recite out loud in both rak'ahs. In the 2nd rak'ah, say the Qunut quietly before going to ruku' (recommended in the Maliki school).", sunnah: "Before Fajr: 2 rak'ahs called Raghibat al-Fajr." },
    Dhuhr:   { rakahs: 4, aloud: "Everything is said quietly (moving your lips).", sunnah: "Extra (nafl) rak'ahs before and after Dhuhr are recommended." },
    Asr:     { rakahs: 4, aloud: "Everything is said quietly.", sunnah: "Extra (nafl) rak'ahs before Asr are recommended." },
    Maghrib: { rakahs: 3, aloud: "Recite out loud in the first 2 rak'ahs, quietly in the 3rd.", sunnah: "Extra (nafl) rak'ahs after Maghrib are recommended." },
    Isha:    { rakahs: 4, aloud: "Recite out loud in the first 2 rak'ahs, quietly in the 3rd and 4th.", sunnah: "After Isha: Shaf' (2 rak'ahs), then Witr (1 rak'ah), before you sleep." },
  };

  /* ---------- faceless figures (100x100) ---------- */
  const S = 'stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"';
  const ground = '<path d="M8 94h84" stroke="var(--line)" stroke-width="3" stroke-linecap="round"/><rect x="12" y="92" width="76" height="4" rx="2" fill="var(--sel)"/>';
  const head = (x, y, r = 7) => `<circle cx="${x}" cy="${y}" r="${r}" fill="currentColor"/>`;
  const POSES = {
    takbir:   head(50, 14) + `<path ${S} d="M50 23v36M50 59l-6 33M50 59l6 33M50 30l-12 0-1-12M50 30l12 0 1-12"/>`,
    standing: head(50, 14) + `<path ${S} d="M50 23v36M50 59l-6 33M50 59l6 33M50 30l-7 28M50 30l7 28"/>`,
    ruku:     head(22, 52) + `<path ${S} d="M64 92V56M64 56H30M34 56l26 16"/>`,
    rising:   head(50, 14) + `<path ${S} d="M50 23v36M50 59l-6 33M50 59l6 33M50 30l-6 26M50 30l6 26"/>`,
    sujud:    head(22, 87) + `<path ${S} d="M64 66L30 82M30 82l-4 10M64 66l-6 26M58 92h26"/>`,
    sitting:  head(58, 40) + `<path ${S} d="M60 48l2 34M62 82L38 88M38 88l-2 4M40 92h34M60 56l-14 22"/>`,
    tashahhud:head(58, 40) + `<path ${S} d="M60 48l2 34M62 82L38 88M38 88l-2 4M40 92h34M60 56l-14 22M46 78l-6-10"/>`,
    salam:    head(64, 38) + `<path ${S} d="M60 48l2 34M62 82L38 88M38 88l-2 4M40 92h34M60 56l-14 22"/><path d="M74 30l10-4m-4-4 4 4-4 4" stroke="var(--gold)" stroke-width="3" fill="none" stroke-linecap="round"/>`,
  };
  const fig = pose => `<svg viewBox="0 0 100 100" aria-hidden="true" class="fig">${ground}${POSES[pose]}</svg>`;

  /* ---------- wudu pictograms (100x100) ---------- */
  const W = 'stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"';
  const drop = (x, y) => `<path d="M${x} ${y - 9}c4 6 7 9 7 13a7 7 0 0 1-14 0c0-4 3-7 7-13z" fill="var(--moon)"/>`;
  const WUDU_ICONS = {
    intention: `<path ${W} d="M30 70V38a8 8 0 0 1 16 0v14M46 44a8 8 0 0 1 16 0v26M30 70c0 12 10 18 16 18s16-6 16-18"/>`,
    hands:     `<path ${W} d="M22 72c4-18 14-26 24-26M78 72c-4-18-14-26-24-26M30 80h40"/>${drop(50, 26)}`,
    mouth:     `<path ${W} d="M26 58c8-10 40-10 48 0-8 12-40 12-48 0zM26 58h48"/>${drop(50, 28)}`,
    nose:      `<path ${W} d="M50 24v34l-12 8h24"/>${drop(28, 74)}${drop(72, 74)}`,
    face:      `<path ${W} d="M50 18c18 0 28 14 28 32S68 86 50 86 22 68 22 50s10-32 28-32z"/>${drop(50, 50)}`,
    arms:      `<path ${W} d="M18 78h40l22-38M58 78l-8-12"/>${drop(70, 30)}`,
    head:      `<path ${W} d="M24 62a26 26 0 0 1 52 0M34 30c10-8 22-8 32 0"/><path d="M60 22l10 6-10 6" stroke="var(--gold)" stroke-width="4" fill="none" stroke-linecap="round"/>`,
    ears:      `<path ${W} d="M56 22c14 0 20 12 20 22 0 12-10 14-12 22-2 10-8 14-14 14M58 38c6 0 8 6 6 10"/>`,
    feet:      `<path ${W} d="M30 30v34c0 12 6 18 18 18h30c4 0 4-8-2-10l-26-8V30"/>${drop(70, 50)}`,
    dua:       `<path ${W} d="M28 76c-6-16-4-34 8-42M72 76c6-16 4-34-8-42M36 34l14 30 14-30"/>`,
  };
  const wicon = k => `<svg viewBox="0 0 100 100" aria-hidden="true" class="wicon">${WUDU_ICONS[k]}</svg>`;

  /* ---------- texts ---------- */
  const SURAHS = [
    { name: "Al-Fatiha", no: 1, note: "Say it in every rak'ah, then say “Ameen” quietly. Maliki school: in the fard prayer, start from “Al-hamdu lillah” without the Bismillah.",
      ar: ["بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ", "الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ", "الرَّحْمَٰنِ الرَّحِيمِ", "مَالِكِ يَوْمِ الدِّينِ", "إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ", "اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ", "صِرَاطَ الَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ الْمَغْضُوبِ عَلَيْهِمْ وَلَا الضَّالِّينَ"],
      tr: ["Bismillahir-Rahmanir-Raheem", "Al-hamdu lillahi Rabbil-'alameen", "Ar-Rahmanir-Raheem", "Maliki yawmid-deen", "Iyyaka na'budu wa iyyaka nasta'een", "Ihdinas-siratal-mustaqeem", "Siratal-ladheena an'amta 'alayhim, ghayril-maghdubi 'alayhim wa lad-dalleen"],
      en: ["In the name of Allah, the Most Merciful, the Most Kind.", "All praise is for Allah, Lord of all the worlds,", "the Most Merciful, the Most Kind,", "Master of the Day of Judgement.", "You alone we worship, and You alone we ask for help.", "Guide us to the straight path,", "the path of those You have blessed, not of those who earned Your anger, nor of those who went astray."] },
    { name: "Al-Ikhlas", no: 112, note: "A short surah for after Al-Fatiha.",
      ar: ["قُلْ هُوَ اللَّهُ أَحَدٌ", "اللَّهُ الصَّمَدُ", "لَمْ يَلِدْ وَلَمْ يُولَدْ", "وَلَمْ يَكُن لَّهُ كُفُوًا أَحَدٌ"],
      tr: ["Qul huwallahu ahad", "Allahus-samad", "Lam yalid wa lam yulad", "Wa lam yakun lahu kufuwan ahad"],
      en: ["Say: He is Allah, the One.", "Allah, the One everyone needs.", "He has no children and was not born.", "And there is nothing like Him."] },
    { name: "Al-Kawthar", no: 108, note: "The shortest surah.",
      ar: ["إِنَّا أَعْطَيْنَاكَ الْكَوْثَرَ", "فَصَلِّ لِرَبِّكَ وَانْحَرْ", "إِنَّ شَانِئَكَ هُوَ الْأَبْتَرُ"],
      tr: ["Inna a'taynakal-kawthar", "Fasalli li Rabbika wanhar", "Inna shani'aka huwal-abtar"],
      en: ["We have given you Al-Kawthar (abundant good).", "So pray to your Lord and sacrifice.", "The one who hates you is the one cut off."] },
    { name: "Al-'Asr", no: 103, note: "",
      ar: ["وَالْعَصْرِ", "إِنَّ الْإِنسَانَ لَفِي خُسْرٍ", "إِلَّا الَّذِينَ آمَنُوا وَعَمِلُوا الصَّالِحَاتِ وَتَوَاصَوْا بِالْحَقِّ وَتَوَاصَوْا بِالصَّبْرِ"],
      tr: ["Wal-'asr", "Innal-insana lafi khusr", "Illal-ladheena amanu wa 'amilus-salihati wa tawasaw bil-haqqi wa tawasaw bis-sabr"],
      en: ["By time,", "people are surely at a loss,", "except those who believe, do good, encourage each other to the truth, and encourage each other to be patient."] },
    { name: "Al-Falaq", no: 113, note: "",
      ar: ["قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ", "مِن شَرِّ مَا خَلَقَ", "وَمِن شَرِّ غَاسِقٍ إِذَا وَقَبَ", "وَمِن شَرِّ النَّفَّاثَاتِ فِي الْعُقَدِ", "وَمِن شَرِّ حَاسِدٍ إِذَا حَسَدَ"],
      tr: ["Qul a'udhu bi Rabbil-falaq", "Min sharri ma khalaq", "Wa min sharri ghasiqin idha waqab", "Wa min sharrin-naffathati fil-'uqad", "Wa min sharri hasidin idha hasad"],
      en: ["Say: I seek protection with the Lord of the daybreak,", "from the harm of what He created,", "from the harm of the night when it is dark,", "from the harm of those who blow on knots,", "and from the harm of a jealous person when they are jealous."] },
    { name: "An-Nas", no: 114, note: "",
      ar: ["قُلْ أَعُوذُ بِرَبِّ النَّاسِ", "مَلِكِ النَّاسِ", "إِلَٰهِ النَّاسِ", "مِن شَرِّ الْوَسْوَاسِ الْخَنَّاسِ", "الَّذِي يُوَسْوِسُ فِي صُدُورِ النَّاسِ", "مِنَ الْجِنَّةِ وَالنَّاسِ"],
      tr: ["Qul a'udhu bi Rabbin-nas", "Malikin-nas", "Ilahin-nas", "Min sharril-waswasil-khannas", "Alladhi yuwaswisu fi sudurin-nas", "Minal-jinnati wan-nas"],
      en: ["Say: I seek protection with the Lord of people,", "the King of people,", "the God of people,", "from the harm of the whisperer who hides,", "who whispers into people's hearts,", "from among jinn and people."] },
  ];
  const TASHAHHUD = { rec: "tashahhud", // Maliki: the wording taught by Umar ibn al-Khattab (Muwatta of Imam Malik)
    ar: "التَّحِيَّاتُ لِلَّهِ، الزَّاكِيَاتُ لِلَّهِ، الطَّيِّبَاتُ الصَّلَوَاتُ لِلَّهِ، السَّلَامُ عَلَيْكَ أَيُّهَا النَّبِيُّ وَرَحْمَةُ اللَّهِ وَبَرَكَاتُهُ، السَّلَامُ عَلَيْنَا وَعَلَى عِبَادِ اللَّهِ الصَّالِحِينَ، أَشْهَدُ أَنْ لَا إِلَٰهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، وَأَشْهَدُ أَنَّ مُحَمَّدًا عَبْدُهُ وَرَسُولُهُ",
    tr: "At-tahiyyatu lillah, az-zakiyatu lillah, at-tayyibatus-salawatu lillah. As-salamu 'alayka ayyuhan-nabiyyu wa rahmatullahi wa barakatuh. As-salamu 'alayna wa 'ala 'ibadillahis-saliheen. Ash-hadu an la ilaha illallahu wahdahu la sharika lah, wa ash-hadu anna Muhammadan 'abduhu wa rasuluh.",
    en: "All greetings are for Allah, all pure deeds are for Allah, all good words and prayers are for Allah. Peace be upon you, O Prophet, and Allah's mercy and blessings. Peace be upon us and on Allah's good servants. I bear witness that there is no god but Allah, alone with no partner, and that Muhammad is His servant and messenger.",
  };
  const SALAWAT = { rec: "salawat",
    ar: "اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ وَعَلَى آلِ مُحَمَّدٍ كَمَا صَلَّيْتَ عَلَى إِبْرَاهِيمَ وَعَلَى آلِ إِبْرَاهِيمَ إِنَّكَ حَمِيدٌ مَجِيدٌ، اللَّهُمَّ بَارِكْ عَلَى مُحَمَّدٍ وَعَلَى آلِ مُحَمَّدٍ كَمَا بَارَكْتَ عَلَى إِبْرَاهِيمَ وَعَلَى آلِ إِبْرَاهِيمَ إِنَّكَ حَمِيدٌ مَجِيدٌ",
    tr: "Allahumma salli 'ala Muhammadin wa 'ala ali Muhammad, kama sallayta 'ala Ibrahima wa 'ala ali Ibrahim, innaka Hameedun Majeed. Allahumma barik 'ala Muhammadin wa 'ala ali Muhammad, kama barakta 'ala Ibrahima wa 'ala ali Ibrahim, innaka Hameedun Majeed.",
    en: "O Allah, send prayers on Muhammad and his family, as You sent prayers on Ibrahim and his family; You are Praiseworthy, Glorious. O Allah, bless Muhammad and his family, as You blessed Ibrahim and his family; You are Praiseworthy, Glorious.",
  };

  const STEPS = [
    { pose: "takbir", rec: "takbir", sayAr: "اللَّهُ أَكْبَرُ", title: "Start: Takbir", say: "Allahu Akbar", text: "Face the qiblah. Make the intention in your heart for this prayer. Raise your hands to your shoulders and say “Allahu Akbar” (Allah is the Greatest). Hands are raised only at this first takbir." },
    { pose: "standing", playSurah: 1, title: "Stand and recite", say: "Al-Fatiha + a short surah", text: "Stand still with your arms resting at your sides (Maliki way). Recite Al-Fatiha. In the 1st and 2nd rak'ah, add a short surah after it (like Al-Ikhlas). In the 3rd and 4th rak'ah, only Al-Fatiha." },
    { pose: "ruku", rec: "ruku", sayAr: "سُبْحَانَ رَبِّيَ الْعَظِيمِ، سُبْحَانَ رَبِّيَ الْعَظِيمِ، سُبْحَانَ رَبِّيَ الْعَظِيمِ", title: "Bow: Ruku'", say: "Subhana Rabbiyal-'Adheem ×3", text: "Say “Allahu Akbar” and bow. Hands on your knees, back straight." },
    { pose: "rising", rec: "rising", sayAr: "سَمِعَ اللَّهُ لِمَنْ حَمِدَهُ، رَبَّنَا وَلَكَ الْحَمْدُ", title: "Stand up again", say: "Sami'Allahu liman hamidah — Rabbana wa lakal-hamd", text: "Rise up straight while saying “Sami'Allahu liman hamidah” (Allah hears those who praise Him), then “Rabbana wa lakal-hamd” (Our Lord, all praise is Yours). Behind an imam, only say “Rabbana wa lakal-hamd”." },
    { pose: "sujud", rec: "sujud", sayAr: "سُبْحَانَ رَبِّيَ الْأَعْلَى، سُبْحَانَ رَبِّيَ الْأَعْلَى، سُبْحَانَ رَبِّيَ الْأَعْلَى", title: "Prostrate: Sujud", say: "Subhana Rabbiyal-A'la ×3", text: "Say “Allahu Akbar” and go down. Forehead and nose, both palms, both knees and your toes touch the ground." },
    { pose: "sitting", rec: "jalsa", sayAr: "رَبِّ اغْفِرْ لِي", title: "Sit for a moment", say: "Rabbighfir li", text: "Say “Allahu Akbar” and sit up. Say “Rabbighfir li” (My Lord, forgive me)." },
    { pose: "sujud", rec: "sujud", sayAr: "سُبْحَانَ رَبِّيَ الْأَعْلَى، سُبْحَانَ رَبِّيَ الْأَعْلَى، سُبْحَانَ رَبِّيَ الْأَعْلَى", title: "Second sujud", say: "Subhana Rabbiyal-A'la ×3", text: "Say “Allahu Akbar” and prostrate again, the same way. That finishes one rak'ah. Say “Allahu Akbar” and stand up for the next one." },
    { pose: "tashahhud", playText: "tashahhud", title: "Sit for Tashahhud", say: "At-Tahiyyat…", text: "After the 2nd rak'ah, and at the end of the prayer, sit and say At-Tahiyyat. Close your right hand and move your index finger gently from side to side (Maliki way). In the last sitting, add the Salawat on the Prophet ﷺ." },
    { pose: "salam", rec: "salam", sayAr: "السَّلَامُ عَلَيْكُمْ", title: "Finish: Salam", say: "As-salamu 'alaykum", text: "Say “As-salamu 'alaykum” once while turning your head to the right (Maliki way). Your prayer is complete!" },
  ];

  const WUDU = [
    ["intention", "Intention", "Make the intention in your heart and say “Bismillah”."],
    ["hands", "Hands ×3", "Wash both hands up to the wrists, three times."],
    ["mouth", "Mouth ×3", "Take water in your right hand and rinse your mouth, three times."],
    ["nose", "Nose ×3", "Sniff a little water into your nose and blow it out with your left hand, three times."],
    ["face", "Face ×3", "Wash your whole face, from your hairline to your chin and from ear to ear, three times."],
    ["arms", "Arms ×3", "Wash your right arm up to and including the elbow three times, then the left arm three times."],
    ["head", "Whole head ×1", "With wet hands, wipe over your whole head from the front to the back and back again, once. Wiping the whole head is required."],
    ["ears", "Ears ×1", "Wet your fingers with fresh water, then wipe inside your ears with your index fingers and behind them with your thumbs, once."],
    ["feet", "Feet ×3", "Wash your right foot up to and including the ankle three times (between the toes too), then the left foot."],
    ["dua", "After wudu", "Say: “Ash-hadu an la ilaha illallah, wa ash-hadu anna Muhammadan 'abduhu wa rasuluh.”"],
  ];


  /* ---------- audio ---------- */
  // Qur'an: verse-by-verse recordings by Sheikh Abdurrahman Al-Sudais, falling back to Sheikh Mishary Alafasy (everyayah.com).
  // Phrases & Tashahhud: the device's Arabic voice (text-to-speech), not a human reciter.
  const pad3 = n => String(n).padStart(3, "0");
  const RECITERS = ["Abdurrahmaan_As-Sudais_192kbps", "Alafasy_128kbps"];   // Sudais first, Alafasy if a file fails
  const ayahUrl = (sura, ayah, r = 0) => `https://everyayah.com/data/${RECITERS[r]}/${pad3(sura)}${pad3(ayah)}.mp3`;
  // One shared <audio> element: iPhone/iPad only allow sound on an element that a tap has started,
  // so we keep reusing it (change src) instead of creating a new player for every verse.
  const player = new Audio(); player.preload = "auto"; player.setAttribute("playsinline", "");
  let playingBtn = null, queue = [], playToken = 0;
  function stopAll() {
    playToken++; queue = [];
    player.onended = null; player.onerror = null;
    try { player.pause(); } catch (e) {}
    try { if (speechSynthesis.speaking || speechSynthesis.pending) speechSynthesis.cancel(); } catch (e) {}
    if (playingBtn) { playingBtn.textContent = playingBtn.dataset.label; playingBtn.classList.remove("on"); playingBtn = null; }
  }
  function markBtn(btn) { stopAll(); playingBtn = btn; btn.dataset.label = btn.dataset.label || btn.textContent; btn.textContent = "■ Stop"; btn.classList.add("on"); }
  function playAyahs(btn, sura, list) {
    if (playingBtn === btn) { stopAll(); return; }
    markBtn(btn); queue = list.slice(); const token = playToken;
    const next = () => {
      if (token !== playToken) return;
      if (!queue.length) { stopAll(); return; }
      const ayah = queue.shift(); let r = 0;
      player.src = ayahUrl(sura, ayah, r);
      player.onended = next;
      player.onerror = () => {
        if (token !== playToken) return;
        if (r + 1 < RECITERS.length) { r++; player.src = ayahUrl(sura, ayah, r); const q = player.play(); if (q && q.catch) q.catch(() => {}); return; }
        stopAll(); alertNote(btn, "Couldn't load the recitation. Check the internet.");
      };
      const pr = player.play();                       // first call runs inside the tap, which unlocks audio on iOS
      if (pr && pr.catch) pr.catch(err => { if (token === playToken && err && err.name === "NotAllowedError") { stopAll(); alertNote(btn, "Sound was blocked. Turn off silent mode, raise the volume and tap again."); } });
    };
    next();
  }
  // Real human recordings of the prayer phrases (no synthetic voice). Files live in /audio and are
  // listed here once added, e.g. takbir: "audio/takbir.m4a". A Listen button only appears for listed files.
  // Recorded by Dad (Voice Memos), stored in the family Google Drive folder "Prayer recordings".
  // Each recording is tried in order: a file uploaded to this GitHub repo (same site, plays everywhere,
  // including iPhone), then the Google Drive copy as a fallback.
  const drive = (name, id) => [name + ".mp4", "audio/" + name + ".mp4", name + ".m4a", "audio/" + name + ".m4a", `https://drive.google.com/uc?export=download&id=${id}`];
  const RECORDINGS = {
    takbir: drive("takbir", "17KLXK10J4G8MiMbrPzg4KLmJCgGfe9hk"),
    ruku: drive("ruku", "1vxTKWlRAbbDy8-O-1QgfeAgUGrkj3nM4"),
    rising: drive("rising", "1SvejdiIplgHknQfXYR9gu17bBr3e6RqB"),
    sujud: drive("sujud", "1QLXrruVcdTnVuvDmv9EF61GWjxS4NbRn"),
    jalsa: drive("jalsa", "1IMbBtXFOP7wLhMxkNBRZYiTMEeI1D5qP"),
    salam: drive("salam", "16eGIqIMdOIdwOEti3gqbCP5SRpBYzB08"),
    // tashahhud: drive("…"), salawat: drive("…"),   ← add when recorded
  };
  function playFile(btn, urls) {
    if (playingBtn === btn) { stopAll(); return; }
    markBtn(btn); const token = playToken; const list = [].concat(urls); let i = 0;
    const tryNext = () => {
      if (token !== playToken) return;
      if (i >= list.length) { stopAll(); alertNote(btn, "Couldn't play the recording."); return; }
      player.src = list[i++];
      const pr = player.play();
      if (pr && pr.catch) pr.catch(err => { if (token !== playToken) return; if (err && err.name === "NotAllowedError") { stopAll(); alertNote(btn, "Sound was blocked. Turn off silent mode, raise the volume and tap again."); } });
    };
    player.onended = () => { if (token === playToken) stopAll(); };
    player.onerror = tryNext;
    tryNext();
  }
  let arVoice = null;
  function pickVoice() { try { const vs = speechSynthesis.getVoices(); arVoice = vs.find(v => /^ar[-_]?/i.test(v.lang)) || null; } catch (e) {} }
  try { pickVoice(); speechSynthesis.addEventListener ? speechSynthesis.addEventListener("voiceschanged", pickVoice) : (speechSynthesis.onvoiceschanged = pickVoice); } catch (e) {}
  function speak(btn, text) {
    if (playingBtn === btn) { stopAll(); return; }
    if (!("speechSynthesis" in window)) { alertNote(btn, "This device can't read text aloud."); return; }
    markBtn(btn); pickVoice();
    // iPhone/iPad often list no voices to web pages; asking for Arabic by language still uses the built-in Arabic voice.
    const u = new SpeechSynthesisUtterance(text);
    u.lang = arVoice ? arVoice.lang : "ar-SA"; if (arVoice) u.voice = arVoice; u.rate = 0.8;
    let started = false;
    u.onstart = () => { started = true; };
    u.onend = () => { if (playingBtn === btn) stopAll(); };
    u.onerror = () => { if (playingBtn === btn) { stopAll(); alertNote(btn, "Couldn't read this aloud. On iPhone/iPad add an Arabic voice: Settings › Accessibility › Spoken Content › Voices › Arabic."); } };
    try { speechSynthesis.resume(); } catch (e) {}
    speechSynthesis.speak(u);                         // must run directly inside the tap
    setTimeout(() => { if (!started && playingBtn === btn) { stopAll(); alertNote(btn, "No sound? Turn off silent mode, raise the volume, and check an Arabic voice is installed (Settings › Accessibility › Spoken Content › Voices)."); } }, 4000);
  }
  function alertNote(btn, msg) { const n = h("div", "audnote", esc(msg)); btn.insertAdjacentElement("afterend", n); setTimeout(() => n.remove(), 6000); }
  const playBtn = (label, cls) => { const b = h("button", "playb" + (cls ? " " + cls : ""), esc(label)); b.type = "button"; return b; };
  /* ---------- UI ---------- */
  const css = `
  .learnbtn{background:var(--surface);border:1px solid var(--line);color:var(--accent);border-radius:999px;width:36px;height:36px;padding:0;display:inline-flex;align-items:center;justify-content:center;flex:none}
  .learnbtn svg{width:20px;height:20px}
  .lov{position:fixed;inset:0;background:var(--bg);z-index:50;overflow-y:auto;-webkit-overflow-scrolling:touch}
  .lov .lwrap{max-width:560px;margin:0 auto;padding:calc(env(safe-area-inset-top,0px) + 12px) max(16px,env(safe-area-inset-right,0px)) 48px max(16px,env(safe-area-inset-left,0px));display:flex;flex-direction:column;gap:14px}
  .lov .ltop{display:flex;justify-content:space-between;align-items:center;gap:8px;position:sticky;top:0;background:var(--bg);padding-block:8px;z-index:2}
  .lov .tabs{display:flex;gap:6px;overflow-x:auto;padding-bottom:2px}
  .lov .tabs button{background:var(--wait-bg);color:var(--fg);border-radius:999px;padding:8px 14px;white-space:nowrap;font-weight:600}
  .lov .tabs button[aria-selected="true"]{background:var(--accent);color:var(--accent-ink)}
  .lov .close{background:var(--wait-bg);color:var(--fg);border-radius:999px;padding:8px 14px}
  .lov .big{font-family:var(--display);font-size:48px;line-height:1;color:var(--accent)}
  .lov .rk{display:flex;flex-wrap:wrap;gap:8px}
  .lov .rkbox{flex:1 1 140px;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:4px}
  .lov .rkbox b{font-size:15px}.lov .rkbox span{font-size:14px;color:var(--muted)}
  .lov .step{display:grid;grid-template-columns:96px 1fr;gap:12px;align-items:center;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:10px}
  .lov .fig,.lov .wicon{width:96px;height:96px;color:var(--fg);background:var(--wait-bg);border-radius:10px}
  .lov .wicon{color:var(--accent)}
  .lov .step h3{margin:0 0 2px;font-size:16px}.lov .step p{margin:0;font-size:14px;color:var(--muted)}
  .lov .say{display:inline-block;margin-top:6px;font-size:13px;font-weight:600;color:var(--gold)}
  .lov .surah{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:14px;display:flex;flex-direction:column;gap:10px}
  .lov .surah h3{margin:0;font-family:var(--display);font-weight:400;font-size:20px}
  .lov .ayah{display:flex;flex-direction:column;gap:2px;border-top:1px solid var(--line);padding-top:8px}
  .lov .ar{font-family:"Amiri","Noto Naskh Arabic",serif;font-size:24px;line-height:1.9;direction:rtl;text-align:right}
  .lov .tr{font-size:14px;font-style:italic;color:var(--fg)}
  .lov .en{font-size:13px;color:var(--muted)}
  .lov .tip{font-size:13px;color:var(--muted);background:var(--wait-bg);border-radius:10px;padding:10px}
  .lov h2{margin:0}
  .lov .lcol{display:flex;flex-direction:column;gap:12px}
  .lov .playb{align-self:flex-start;background:var(--sel);color:var(--accent);border-radius:999px;padding:6px 12px;font-size:13px;font-weight:700;margin-top:6px}
  .lov .playb.on{background:var(--accent);color:var(--accent-ink)}
  .lov .ayah .playb{padding:4px 10px;font-size:12px}
  .lov .audnote{font-size:12px;color:var(--late);margin-top:4px}
  .lov .shead{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}`;
  document.head.insertAdjacentHTML("beforeend", `<style>${css}</style><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Amiri&display=swap">`);
  const BOOK = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6c-2-1.5-5-2-8-2v14c3 0 6 .5 8 2 2-1.5 5-2 8-2V4c-3 0-6 .5-8 2zM12 6v14"/></svg>';
  window.LEARN_BOOK_ICON = BOOK;

  const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function prayerTab(p) {
    const i = INFO[p], n = i.rakahs, box = h("div", "lcol");
    box.append(h("div", "rkbox", `<span>${esc(p)} has</span><div class="big">${n}</div><b>rak'ahs (fard)</b><span>${esc(i.aloud)}</span><span>${esc(i.sunnah)}</span>`));
    const plan = h("div", "rk");
    for (let r = 1; r <= n; r++) {
      let what = r <= 2 ? "Al-Fatiha + a short surah" : "Al-Fatiha only";
      let after = r === n ? "Sit: Tashahhud + Salawat, then Salam" : r === 2 ? "Sit: Tashahhud, then stand up" : "Stand up for the next rak'ah";
      plan.append(h("div", "rkbox", `<b>Rak'ah ${r}</b><span>${what}</span><span>Ruku' → stand → 2 sujud</span><span>${after}</span>`));
    }
    box.append(h("h2", null, "Rak'ah by rak'ah"), plan,
      h("p", "tip", "Before you pray: make wudu, wear clean clothes, use a clean place and face the qiblah (north-east in Toronto)."));
    return box;
  }
  function howTab() {
    const box = h("div", "lcol");
    box.append(h("p", "tip", "Tap ▶ to hear the Qur'an recited by Sheikh Abdurrahman Al-Sudais. Every rak'ah has the same moves. Follow the pictures from top to bottom. This guide follows the Maliki school."));
    STEPS.forEach((s, k) => {
      const st = h("div", "step");
      st.innerHTML = `${fig(s.pose)}<div><h3>${k + 1}. ${esc(s.title)}</h3><p>${esc(s.text)}</p><span class="say">${esc(s.say)}</span></div>`;
      const col = st.lastElementChild;
      if (s.rec && RECORDINGS[s.rec]) { const b = playBtn("▶ Listen"); b.onclick = () => playFile(b, RECORDINGS[s.rec]); col.append(b); }
      if (s.playSurah) { const b = playBtn("▶ Listen to Al-Fatiha"); b.onclick = () => playAyahs(b, 1, [1, 2, 3, 4, 5, 6, 7]); col.append(b); }
      if (s.playText === "tashahhud") {               // Dad's recording if added, otherwise the device's Arabic voice
        const b = playBtn("▶ Listen"); b.onclick = () => RECORDINGS.tashahhud ? playFile(b, RECORDINGS.tashahhud) : speak(b, TASHAHHUD.ar); col.append(b);
      }
      box.append(st);
    });
    box.append(textBlock("Tashahhud (At-Tahiyyat)", TASHAHHUD), textBlock("Salawat on the Prophet ﷺ (last sitting)", SALAWAT));
    return box;
  }
  function textBlock(title, t) {
    const d = h("div", "surah");
    d.append(h("h3", null, esc(title)));
    const a = h("div", "ayah"); a.innerHTML = `<div class="ar">${t.ar}</div><div class="tr">${esc(t.tr)}</div><div class="en">${esc(t.en)}</div>`;
    if (t.rec && RECORDINGS[t.rec]) { const b = playBtn("▶ Listen"); b.onclick = () => playFile(b, RECORDINGS[t.rec]); a.append(b); }
    else if (t.rec === "tashahhud") { const b = playBtn("▶ Listen (device voice)"); b.onclick = () => speak(b, t.ar); a.append(b); }
    d.append(a); return d;
  }
  function wuduTab() {
    const box = h("div", "lcol");
    box.append(h("p", "tip", "Wudu (washing before prayer). Start with the right side, rub each part with your hand while washing, and do the steps one after the other without a long break. Do not waste water."));
    WUDU.forEach(([k, t, x], i) => {
      const st = h("div", "step");
      st.innerHTML = `${wicon(k)}<div><h3>${i + 1}. ${esc(t)}</h3><p>${esc(x)}</p></div>`;
      box.append(st);
    });
    box.append(h("p", "tip", "Wudu breaks after using the toilet, passing wind, or deep sleep. Then make wudu again."));
    return box;
  }
  function surahTab() {
    const box = h("div", "lcol");
    SURAHS.forEach(s => {
      const d = h("div", "surah");
      const head = h("div", "shead"); head.append(h("h3", null, esc(s.name)));
      const all = playBtn("▶ Play whole surah"); all.onclick = () => playAyahs(all, s.no, s.ar.map((_, i) => i + 1)); head.append(all);
      d.append(head);
      if (s.note) d.append(h("p", "tip", esc(s.note)));
      s.ar.forEach((a, i) => {
        const ay = h("div", "ayah"); ay.innerHTML = `<div class="ar">${a}</div><div class="tr">${esc(s.tr[i])}</div><div class="en">${esc(s.en[i])}</div>`;
        const b = playBtn("▶ Verse " + (i + 1)); b.onclick = () => playAyahs(b, s.no, [i + 1]); ay.append(b); d.append(ay);
      });
      box.append(d);
    });
    return box;
  }

  window.openLearn = function (prayer) {
    const ov = h("div", "lov"); ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true"); ov.setAttribute("aria-label", "Learn " + prayer);
    const wrap = h("div", "lwrap"), top = h("div", "ltop"), tabs = h("div", "tabs"), body = h("div", null);
    const close = h("button", "close", "Close"); close.onclick = () => { stopAll(); ov.remove(); document.body.style.overflow = ""; };
    const T = [[prayer, () => prayerTab(prayer)], ["How to pray", howTab], ["Wudu", wuduTab], ["Surahs", surahTab]];
    const show = idx => { stopAll(); [...tabs.children].forEach((b, j) => b.setAttribute("aria-selected", String(j === idx))); body.replaceChildren(T[idx][1]()); body.style.display = "flex"; body.style.flexDirection = "column"; body.style.gap = "12px"; ov.scrollTop = 0; };
    T.forEach(([name], idx) => { const b = h("button", null, esc(name)); b.setAttribute("role", "tab"); b.onclick = () => show(idx); tabs.append(b); });
    top.append(tabs, close); wrap.append(top, body); ov.append(wrap);
    document.body.append(ov); document.body.style.overflow = "hidden"; show(0); close.focus();
    ov.addEventListener("keydown", e => { if (e.key === "Escape") close.click(); });
  };
})();
