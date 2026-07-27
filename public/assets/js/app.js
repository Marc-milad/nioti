let patriarchs = [];
const categories = [
  ['⳨', 'العصر الرسولي', 'من القرن الأول إلى الثالث', 'العصر الرسولي'],
  ['✦', 'عصر المجامع', 'من القرن الرابع إلى السابع', 'العصر الذهبي'],
  ['⌂', 'عصور التحول', 'من القرن السابع إلى الثامن عشر', 'عصر التحولات'],
  ['◌', 'النهضة والعصر الحديث', 'من القرن التاسع عشر حتى اليوم', 'العصر الحديث']
];

const quiz = {
  question: 'من هو البطريرك الذي لُقِّب بـ ?الرسولي? لدفاعه عن الإيمان النيقاوي؟',
  choices: ['البابا أثناسيوس الأول', 'البابا كيرلس الرابع', 'البابا ديسقوروس الأول', 'البابا بنيامين الأول'],
  answer: 0,
  explanation: 'البابا أثناسيوس الأول هو البطريرك العشرون، واشتهر بلقب ?الرسولي? لثباته في الدفاع عن الإيمان النيقاوي.'
};

let activeView = 'home';
let displayedHome = 0;

const EMPTY_ELEMENT = {
  addEventListener() {},
  removeEventListener() {},
  classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
  style: {},
  dataset: {},
  setAttribute() {},
  getAttribute() { return null; },
  getBoundingClientRect() { return { left: 0, right: 0, top: 0, bottom: 0 }; },
  showModal() {},
  close() {},
  click() {}
};
const $ = s => document.querySelector(s) || EMPTY_ELEMENT;
const PAGE_FILES = {
  home: 'index.html',
  patriarchs: 'patriarchs.html',
  timeline: 'timeline.html',
  quiz: 'quiz.html',
  favorites: 'favorites.html',
  gamification: 'gamification.html'
};
const $$ = s => [...document.querySelectorAll(s)];
const escapeHTML = s => String(s).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
const yearsOnly = years => years.replace(' م', '');
const favorites = () => JSON.parse(localStorage.getItem('coptic-favorites') || '[]');

const setFavorites = v => {
  const oldFavs = favorites();
  localStorage.setItem('coptic-favorites', JSON.stringify(v));
  updateFavoriteCount();
  
  if (v.length > oldFavs.length) {
    const addedId = v.find(id => !oldFavs.includes(id));
    trackAction('favorite_add', { key: addedId, description: 'إضافة سيرة إلى المفضلة ❤️' });
  }
};

const importedPatriarchs = () => JSON.parse(localStorage.getItem('coptic-imported-patriarchs') || '[]').filter(p => String(p.source || '').includes('st-takla.org'));
const allPatriarchs = () => [...patriarchs, ...importedPatriarchs()];
const findPatriarch = id => allPatriarchs().find(x => x.id === Number(id));
let lastAutoImport = '';

function normalizeLocalSaints(records) {
  return (Array.isArray(records) ? records : Object.values(records || {})).map((saint, index) => {
    const id = Number(saint.id) || index + 1;
    const name = String(saint.name || `قديس رقم ${id}`).trim();
    const bio = String(saint.bio || '').trim();
    const summary = String(saint.summary || bio).replace(/\s+/g, ' ').trim();
    return {
      id,
      name,
      en: saint.en || name,
      number: Number(saint.number) || id,
      years: saint.years || 'غير محدد',
      century: saint.century || 'غير محدد',
      era: saint.era || 'القديسون والشهداء',
      summary: summary.slice(0, 220),
      bio: bio || summary,
      achievements: saint.achievements || 'راجع السيرة الكاملة للمزيد من التفاصيل.',
      events: saint.events || 'راجع المصدر الأصلي للتفاصيل التاريخية.',
      colors: saint.colors || ['#2f6a6c', '#c5a266'],
      source: saint.url || '',
      sourceLabel: saint.url ? 'المصدر الأصلي' : ''
    };
  });
}

async function loadLocalSaintsFallback() {
  const response = await fetch('./saints_data.json');
  if (!response.ok) throw new Error(`Local saints dataset failed: ${response.status}`);
  patriarchs = normalizeLocalSaints(await response.json());
}

function updateFavoriteCount() {
  const count = favorites().length;
  if ($('#favoriteCount')) $('#favoriteCount').textContent = count;
}

function isFavorite(id) {
  return favorites().includes(id);
}

// Local-first gamification engine. All state remains in this browser's localStorage.
const GAMIFICATION_STORAGE_KEY = 'nioti-gamification-v3';
const LEGACY_GAMIFICATION_STORAGE_KEYS = ['nioti-gamification-v2', 'ethoab-gamification-v2', 'ethoab-gamification'];
const LEVEL_SIZE = 100;
const ACTIVITY_LOG_LIMIT = 50;
const DAILY_HISTORY_LIMIT = 45;

const ACTIVITY_RULES = {
  biography_read: { points: 10, dailyCap: Infinity, label: 'قراءة سيرة بطريرك', unique: true, qualifiesForStreak: true },
  favorite_add: { points: 5, dailyCap: Infinity, label: 'حفظ سيرة في المفضلة', unique: true, qualifiesForStreak: true },
  share_biography: { points: 5, dailyCap: 3, label: 'مشاركة سيرة', qualifiesForStreak: true },
  search: { points: 3, dailyCap: 3, label: 'البحث في الدليل', qualifiesForStreak: true },
  quiz_correct: { points: 30, dailyCap: 1, label: 'إجابة صحيحة في سؤال اليوم', qualifiesForStreak: true },
  quiz_attempt: { points: 10, dailyCap: 1, label: 'المشاركة في سؤال اليوم', qualifiesForStreak: true },
  import_biography: { points: 20, dailyCap: 2, label: 'اكتشاف سيرة جديدة', unique: true, qualifiesForStreak: true },
  theme_change: { points: 1, dailyCap: 1, label: 'تخصيص مظهر التطبيق', qualifiesForStreak: false },
  collection_browse: { points: 1, dailyCap: 2, label: 'استكشاف السير المميزة', qualifiesForStreak: true }
};

const DAILY_QUESTS = [
  { id: 'quiz', name: 'سؤال اليوم واليقظة الفكرية', reward: 10, desc: 'شارك في سؤال اليوم لتحصل على مكافأة المهمة.', complete: actions => Boolean(actions.quiz_correct || actions.quiz_attempt) },
  { id: 'explorer', name: 'المستكشف التاريخي', reward: 15, desc: 'اقرأ ٣ سير كاملة للبطاركة اليوم لتوسيع آفاقك.', complete: actions => (actions.biography_read || 0) >= 3 },
  { id: 'library', name: 'المكتبة الشخصية', reward: 10, desc: 'احفظ سيرة واحدة اليوم في قائمة المفضلة.', complete: actions => (actions.favorite_add || 0) >= 1 }
];

const emptyGameData = () => ({
  version: 3,
  points: 0,
  streak: 0,
  longestStreak: 0,
  lastActiveDate: '',
  readBiographies: [],
  activities: [],
  dailyActivity: {},
  rewardedKeys: {}
});

let gameData = emptyGameData();

function localDayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateFromDayKey(dayKey) {
  const [year, month, day] = String(dayKey).split('-').map(Number);
  return new Date(year, month - 1, day);
}

function daysBetween(dayA, dayB) {
  return Math.round((dateFromDayKey(dayB) - dateFromDayKey(dayA)) / 86400000);
}

function normalizeGameData(stored = {}) {
  const base = emptyGameData();
  const merged = { ...base, ...stored };
  merged.points = Number.isFinite(Number(merged.points)) ? Number(merged.points) : 0;
  merged.streak = Number.isFinite(Number(merged.streak)) ? Number(merged.streak) : 0;
  merged.longestStreak = Number.isFinite(Number(merged.longestStreak)) ? Number(merged.longestStreak) : 0;
  merged.readBiographies = Array.isArray(merged.readBiographies) ? merged.readBiographies : [];
  merged.activities = Array.isArray(merged.activities) ? merged.activities : [];
  merged.dailyActivity = merged.dailyActivity && typeof merged.dailyActivity === 'object' ? merged.dailyActivity : {};
  merged.rewardedKeys = merged.rewardedKeys && typeof merged.rewardedKeys === 'object' ? merged.rewardedKeys : {};
  return merged;
}

function pruneGamificationData() {
  const keepAfter = new Date();
  keepAfter.setDate(keepAfter.getDate() - DAILY_HISTORY_LIMIT);
  const cutoff = localDayKey(keepAfter);
  Object.keys(gameData.dailyActivity).forEach(day => {
    if (day < cutoff) delete gameData.dailyActivity[day];
  });
  gameData.activities = gameData.activities.slice(0, ACTIVITY_LOG_LIMIT);
}

function refreshExpiredStreak() {
  if (!gameData.lastActiveDate) return;
  if (daysBetween(gameData.lastActiveDate, localDayKey()) > 1) gameData.streak = 0;
}

function loadGamification() {
  try {
    const savedProfile = localStorage.getItem(GAMIFICATION_STORAGE_KEY) || LEGACY_GAMIFICATION_STORAGE_KEYS
      .map(key => localStorage.getItem(key))
      .find(Boolean);
    gameData = normalizeGameData(JSON.parse(savedProfile || '{}'));
  } catch (error) {
    console.warn('Could not load local gamification data. Starting a new local profile.', error);
    gameData = emptyGameData();
  }

  refreshExpiredStreak();
  pruneGamificationData();
  saveGamification();
}

function saveGamification() {
  gameData.version = 3;
  localStorage.setItem(GAMIFICATION_STORAGE_KEY, JSON.stringify(gameData));
  updateHeaderBadge();
}

function getTodayActivity() {
  const today = localDayKey();
  if (!gameData.dailyActivity[today]) gameData.dailyActivity[today] = { actions: {}, rewardedActions: {}, points: 0, hasQualifiedActivity: false };
  if (!gameData.dailyActivity[today].rewardedActions) gameData.dailyActivity[today].rewardedActions = {};
  return gameData.dailyActivity[today];
}

function addActivityLog({ type, points, description, day = localDayKey(), capped = false, bonus = false }) {
  gameData.activities.unshift({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    points,
    description,
    day,
    date: new Date().toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }),
    capped,
    bonus
  });
}

function awardDailyStreak(day, activity) {
  if (activity.hasQualifiedActivity) return 0;

  const previousDay = gameData.lastActiveDate;
  const difference = previousDay ? daysBetween(previousDay, day) : 0;
  gameData.streak = difference === 1 ? gameData.streak + 1 : 1;
  gameData.longestStreak = Math.max(gameData.longestStreak, gameData.streak);
  gameData.lastActiveDate = day;
  activity.hasQualifiedActivity = true;

  const bonus = Math.min(5 + Math.floor((gameData.streak - 1) / 7) * 2, 15);
  gameData.points += bonus;
  activity.points += bonus;
  addActivityLog({
    type: 'daily_streak',
    points: bonus,
    description: gameData.streak === 1 ? 'بداية يوم نشاط جديد ✨' : `مكافأة سلسلة النشاط: اليوم ${gameData.streak} 🔥`,
    day,
    bonus: true
  });
  return bonus;
}

function getDailyQuestStatus(day = localDayKey()) {
  const actions = gameData.dailyActivity[day]?.rewardedActions || {};
  return DAILY_QUESTS.map(quest => ({ ...quest, completed: quest.complete(actions) }));
}

function awardCompletedDailyQuests(day) {
  const activity = getTodayActivity();
  let total = 0;
  getDailyQuestStatus(day).forEach(quest => {
    const rewardKey = `quest:${day}:${quest.id}`;
    if (!quest.completed || gameData.rewardedKeys[rewardKey]) return;
    gameData.rewardedKeys[rewardKey] = day;
    gameData.points += quest.reward;
    activity.points += quest.reward;
    total += quest.reward;
    addActivityLog({ type: `quest_${quest.id}`, points: quest.reward, description: `إتمام مهمة: ${quest.name} 🎯`, day, bonus: true });
  });
  return total;
}

function trackAction(type, options = {}) {
  const rule = ACTIVITY_RULES[type];
  if (!rule) {
    console.warn(`Unknown gamification action: ${type}`);
    return { awarded: 0, streakBonus: 0, capped: false };
  }

  const day = localDayKey();
  const today = getTodayActivity();
  const actionCount = Number(today.actions[type] || 0);
  const rewardKey = rule.unique && options.key !== undefined && options.key !== null ? `${type}:${options.key}` : '';
  const alreadyRewarded = Boolean(rewardKey && gameData.rewardedKeys[rewardKey]);
  const capped = alreadyRewarded || actionCount >= rule.dailyCap;
  const description = options.description || rule.label;

  today.actions[type] = actionCount + 1;
  let streakBonus = 0;
  if (rule.qualifiesForStreak) streakBonus = awardDailyStreak(day, today);

  const awarded = capped ? 0 : rule.points;
  if (awarded) {
    gameData.points += awarded;
    today.points += awarded;
    today.rewardedActions[type] = Number(today.rewardedActions[type] || 0) + 1;
    if (rewardKey) gameData.rewardedKeys[rewardKey] = day;
  }
  addActivityLog({ type, points: awarded, description, day, capped });
  const questBonus = awardCompletedDailyQuests(day);
  pruneGamificationData();
  saveGamification();

  if (awarded || streakBonus || questBonus) {
    const total = awarded + streakBonus + questBonus;
    toast(`+${total} نقطة ? ${description}`);
    const oldLevel = Math.floor((gameData.points - total) / LEVEL_SIZE) + 1;
    const newLevel = Math.floor(gameData.points / LEVEL_SIZE) + 1;
    if (newLevel > oldLevel) setTimeout(() => toast(`🎉 وصلت إلى المستوى ${newLevel}: ${getLevelTitle(newLevel)}`), 900);
  }
  return { awarded, streakBonus, questBonus, capped };
}

// Compatibility helper for any older integrations that still call trackActivity.
function trackActivity(points, description) {
  const type = `legacy_${String(description).slice(0, 24)}`;
  const day = localDayKey();
  const today = getTodayActivity();
  gameData.points += Number(points) || 0;
  today.points += Number(points) || 0;
  addActivityLog({ type, points: Number(points) || 0, description, day });
  saveGamification();
  toast(`+${points} نقطة ? ${description}`);
}

function getLevelTitle(level) {
  if (level <= 1) return 'المؤرخ المبتدئ';
  if (level <= 3) return 'حارس التراث';
  if (level <= 5) return 'الباحث الأرثوذكسي';
  if (level <= 8) return 'سفير التاريخ المرقسي';
  return 'العلاّمة التاريخي الكنسي';
}

function updateHeaderBadge() {
  const lvl = Math.floor(gameData.points / LEVEL_SIZE) + 1;
  const levelLabel = lvl.toLocaleString('ar-EG');
  const pointsLabel = gameData.points.toLocaleString('ar-EG');
  $$('#userLevel').forEach(el => { el.textContent = levelLabel; });
  $$('#userPoints').forEach(el => { el.textContent = pointsLabel; });
  $$('#gamificationLevelBadge').forEach(el => { el.textContent = levelLabel; });

  const headerBadge = $('#headerBadge');
  if (headerBadge) {
    const summary = `المستوى ${levelLabel} — ${pointsLabel} نقطة`;
    headerBadge.title = summary;
    headerBadge.setAttribute('aria-label', `لوحة الإنجازات: ${summary}`);
  }
}

function getBadges() {
  const level = Math.floor(gameData.points / LEVEL_SIZE) + 1;
  const badges = [
    { id: 'b1', name: 'البداية الطيبة', desc: 'الانضمام للموسوعة', unlocked: true, icon: '📜' },
    { id: 'b2', name: 'قارئ السير', desc: 'قراءة أول سيرة بطريرك', unlocked: gameData.readBiographies.length >= 1, icon: '⛪' },
    { id: 'b3', name: 'العمق التاريخي', desc: 'قراءة 5 سير بطاركة', unlocked: gameData.readBiographies.length >= 5, icon: '🏛️' },
    { id: 'b4', name: 'حافظ الأمانة', desc: 'حفظ 3 سير في المفضلة', unlocked: favorites().length >= 3, icon: '❤️' },
    { id: 'b5', name: 'الاستمرار اليومي', desc: 'الحفاظ على سلسلة نشاط 3 أيام', unlocked: gameData.longestStreak >= 3, icon: '🔥' },
    { id: 'b6', name: 'العلاّمة الكنسي', desc: 'الوصول للمستوى 5', unlocked: level >= 5, icon: '👑' }
  ];
  return badges;
}

function renderStreakCalendar() {
  const calendar = $('#streakCalendar');
  if (!calendar) return;

  const formatter = new Intl.DateTimeFormat('ar-EG', { weekday: 'short', day: 'numeric' });
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const day = localDayKey(date);
    return {
      day,
      label: formatter.format(date),
      active: Boolean(gameData.dailyActivity[day]?.hasQualifiedActivity),
      today: day === localDayKey()
    };
  });

  calendar.innerHTML = days.map(item => `
    <span class="streak-day ${item.active ? 'is-active' : ''} ${item.today ? 'is-today' : ''}" title="${item.active ? 'يوم نشاط مكتمل' : 'لا يوجد نشاط مكتمل'}">
      <i>${item.active ? '🔥' : '?'}</i><small>${item.label}</small>
    </span>
  `).join('');
}

function renderGamificationDashboard() {
  refreshExpiredStreak();
  const level = Math.floor(gameData.points / LEVEL_SIZE) + 1;
  const pointsInCurrentLevel = gameData.points % LEVEL_SIZE;
  const progressPercent = Math.min(100, (pointsInCurrentLevel / LEVEL_SIZE) * 100);
  
  if ($('#dashLevel')) $('#dashLevel').textContent = level;
  if ($('#levelTitle')) $('#levelTitle').textContent = getLevelTitle(level);
  if ($('#levelProgress')) $('#levelProgress').style.width = `${progressPercent}%`;
  if ($('#currentPointsProgress')) $('#currentPointsProgress').textContent = `${pointsInCurrentLevel} / ${LEVEL_SIZE} نقطة`;
  if ($('#nextLevelPointsProgress')) $('#nextLevelPointsProgress').textContent = `${LEVEL_SIZE - pointsInCurrentLevel} نقطة للمستوى التالي`;
  
  if ($('#statStreak')) $('#statStreak').textContent = gameData.streak;
  if ($('#statTotalPoints')) $('#statTotalPoints').textContent = gameData.points;
  if ($('#statBiographiesCount')) $('#statBiographiesCount').textContent = gameData.readBiographies.length;
  if ($('#statFavoritesCount')) $('#statFavoritesCount').textContent = favorites().length;
  renderStreakCalendar();

  // Render Quests
  const today = localDayKey();
  const quests = getDailyQuestStatus(today);
  
  if ($('#questsList')) {
    $('#questsList').innerHTML = quests.map(q => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;background:${q.completed ? 'var(--teal-light)' : 'var(--gold-pale)'};border-radius:10px;border:1px solid ${q.completed ? 'var(--teal)' : 'var(--line)'};opacity:${q.completed ? 0.75 : 1};">
        <div>
          <strong style="display:block;font-size:12px;color:var(--ink);">${q.name} ${q.completed ? '✓' : ''}</strong>
          <small style="font-size:10px;color:var(--ink-soft);">${q.desc}</small>
        </div>
        <span style="font-weight:700;font-size:11px;color:${q.completed ? 'var(--teal)' : 'var(--gold)'};white-space:nowrap;">+${q.reward} ن</span>
      </div>
    `).join('');
  }

  // Render Badges
  if ($('#badgesGrid')) {
    $('#badgesGrid').innerHTML = getBadges().map(b => `
      <div style="text-align:center;padding:15px;background:var(--paper);border:1px solid ${b.unlocked ? 'var(--gold)' : 'var(--line)'};border-radius:12px;opacity:${b.unlocked ? 1 : 0.4};">
        <div style="font-size:32px;margin-bottom:8px;">${b.icon}</div>
        <strong style="display:block;font-size:11px;color:var(--ink);">${b.name}</strong>
        <small style="font-size:9px;color:var(--ink-soft);">${b.desc}</small>
      </div>
    `).join('');
  }

  // Render Activity Log
  if ($('#logsList')) {
    $('#logsList').innerHTML = gameData.activities.length ? gameData.activities.map(a => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:var(--cream);border-radius:8px;font-size:11px;">
        <span style="color:var(--ink);font-weight:500;">${escapeHTML(a.description)}${a.capped ? ' <small style="color:var(--ink-soft);">(تم التسجيل، وصلت للحد اليومي)</small>' : ''}</span>
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="color:${a.points ? 'var(--teal)' : 'var(--ink-soft)'};font-weight:700;">${a.points ? `+${a.points}` : '—'} ن</span>
          <small style="color:var(--ink-soft);font-size:8px;">${a.date}</small>
        </div>
      </div>
    `).join('') : '<p style="text-align:center;font-size:11px;color:var(--ink-soft);">لا توجد أنشطة مسجلة بعد.</p>';
  }
}

function trackBiographyRead(id) {
  if (!gameData.readBiographies.includes(id)) {
    gameData.readBiographies.push(id);
    const p = findPatriarch(id);
    trackAction('biography_read', { key: id, description: `قراءة سيرة: ${p ? p.name : 'البطريرك'}` });
  }
}

// Card rendering HTML helper
function card(p) {
  return `<article class="patriarch-card"><div class="card-art" style="--card-bg:${p.colors[0]};--avatar-bg:${p.colors[1]}"><span class="card-number">البطريرك ${p.number}</span><span class="card-avatar" aria-hidden="true">⳨</span></div><div class="card-body"><h3>${p.name}</h3><p class="meta">${yearsOnly(p.years)} ? ${p.century}</p><p class="summary">${p.summary}</p><div class="card-footer"><button class="read-btn" data-read="${p.id}">اقرأ السيرة ←</button><button class="favorite-btn ${isFavorite(p.id) ? 'saved' : ''}" data-favorite="${p.id}" aria-label="${isFavorite(p.id) ? 'إزالة من' : 'إضافة إلى'} المفضلة">${isFavorite(p.id) ? '♥' : '♡'}</button></div></div></article>`;
}

function feature(p) {
  return `<div class="featured-image"><span class="number">${p.number}</span><div class="portrait"></div><span class="caption">${p.era}</span></div><div class="featured-copy"><span class="pill">البطريرك رقم ${p.number}</span><h3>${p.name}</h3><p class="english-name">${p.en}</p><p>${p.summary}</p><button class="secondary-button" data-read="${p.id}">اقرأ السيرة الكاملة <span>←</span></button></div>`;
}

function renderHome() {
  if (!patriarchs.length) return;
  const picks = [patriarchs[0], patriarchs[1] || patriarchs[0], patriarchs[4] || patriarchs[0], patriarchs[7] || patriarchs[0]];
  $('#featuredCard').innerHTML = feature(patriarchs[displayedHome % patriarchs.length]);
  $('#homePatriarchs').innerHTML = picks.map(card).join('');
  $('#categoryGrid').innerHTML = categories.map(c => `<button class="category" data-era="${c[3]}"><span class="category-icon">${c[0]}</span><h3>${c[1]}</h3><small>${c[2]}</small></button>`).join('');
}

function normalize(s) {
  return s.replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').toLowerCase();
}

function filteredPatriarchs() {
  const q = normalize($('#directorySearch').value.trim());
  const century = $('#centuryFilter').value, era = $('#eraFilter').value, sort = $('#sortSelect').value;
  let list = allPatriarchs().filter(p => !q || normalize([p.name, p.en, p.number, p.century, p.era, p.summary, p.bio, p.achievements, p.events, p.keywords || ''].join(' ')).includes(q)).filter(p => !century || p.century === century).filter(p => !era || p.era === era);
  
  const alpha = (a, b) => a.name.localeCompare(b.name, 'ar');
  if (sort === 'reverse') list.reverse();
  if (sort === 'number') list.sort((a, b) => (Number(a.number) || 9999) - (Number(b.number) || 9999));
  if (sort === 'arabic') list.sort(alpha);
  if (sort === 'english') list.sort((a, b) => a.en.localeCompare(b.en));
  if (sort === 'enthronement') list.sort((a, b) => a.years.localeCompare(b.years));
  if (sort === 'departure') list.sort((a, b) => b.years.localeCompare(a.years));
  return list;
}

function renderDirectory() {
  let list = filteredPatriarchs();
  const query = $('#directorySearch').value.trim(), normalQuery = normalize(query), noFilters = !$('#centuryFilter').value && !$('#eraFilter').value;
  if (!list.length && normalQuery === lastAutoImport) {
    const latestImported = importedPatriarchs().filter(p => p.imported).slice(-1);
    if (latestImported.length) list = latestImported;
  }
  $('#patriarchsGrid').innerHTML = list.map(card).join('');
  $('#resultsCount').textContent = list.length;
  
  const f = [];
  if ($('#centuryFilter').value) f.push($('#centuryFilter').value);
  if ($('#eraFilter').value) f.push($('#eraFilter').value);
  $('#activeFilters').textContent = f.length ? `— ${f.join('، ')}` : '';
  
  const missing = list.length === 0 && query.length > 2 && noFilters;
  $('#emptyState').hidden = !missing;
  $('#autoImportPanel').hidden = !missing;
  
  if (missing && lastAutoImport !== normalQuery) {
    lastAutoImport = normalQuery;
    importMissingPatriarch(query);
  }
}

function renderTimeline(era = 'all') {
  const list = era === 'all' ? allPatriarchs() : allPatriarchs().filter(p => p.era === era);
  $('#timeline').innerHTML = list.map(p => `<div class="timeline-item"><article data-read="${p.id}"><span class="timeline-date">${p.years} ? ${p.century}</span><h3>${p.name}</h3><p>${p.events}</p></article></div>`).join('') || '<p>لا توجد محطات ضمن هذه الفترة في النسخة التجريبية.</p>';
}

function renderFavorites() {
  const list = allPatriarchs().filter(p => isFavorite(p.id));
  $('#favoritesGrid').innerHTML = list.map(card).join('');
  $('#favoritesEmpty').hidden = list.length !== 0;
}

function showDetails(id) {
  const p = findPatriarch(id);
  if (!p) return;
  
  // Track biography read in gamification engine
  trackBiographyRead(p.id);

  const source = p.source ? `<h3>المصدر الأولي</h3><p><a class="source-link" href="${p.source}" target="_blank" rel="noopener">${p.sourceLabel || 'فتح المصدر'}</a>${p.review ? ' — هذه البطاقة تحتاج مراجعة تاريخية قبل اعتمادها.' : ''}</p>` : '';
  $('#modalContent').innerHTML = `<header class="detail-head"><span class="detail-no">البطريرك رقم ${p.number}</span><h2>${p.name}</h2><p>${p.en}</p></header><div class="detail-body"><div class="detail-facts"><span>${p.years}</span><span>${p.century}</span><span>${p.era}</span></div><h3>نبذة</h3><p>${p.bio}</p><h3>أبرز الإسهامات</h3><p>${p.achievements}</p><h3>أحداث بارزة</h3><p>${p.events}</p>${source}<div class="detail-actions"><button class="primary-button" data-favorite="${p.id}">${isFavorite(p.id) ? '♥ محفوظ في المفضلة' : '♡ أضف إلى المفضلة'}</button><button class="secondary-button" data-share="${p.id}">مشاركة السيرة</button></div></div>`;
  $('#detailsModal').showModal();
}

const API_URL = 'http://localhost:5000/api';

function setImportStatus(title, status, complete = false) {
  $('#importTitle').textContent = title;
  $('#importStatus').textContent = status;
  $('#autoImportPanel').classList.toggle('is-complete', complete);
}

async function importMissingPatriarch(query) {
  setImportStatus('جارٍ البحث وجلب البيانات من موقع الأنبا تكلا&', 'يتم البحث وجلب البيانات وتخزينها في قاعدة بيانات Firebase.');
  try {
    const res = await fetch(`${API_URL}/patriarchs/search?q=${encodeURIComponent(query)}`);
    if (res.ok) {
      const result = await res.json();
      const newPatriarch = result.data;
      if (!patriarchs.some(p => p.id === newPatriarch.id)) {
        patriarchs.push(newPatriarch);
      }
      setImportStatus('تم العثور على السيرة وتخزينها بنجاح!', 'تم حفظ البيانات في Firebase Firestore وجلبها للعرض.', true);
      
      trackAction('import_biography', { key: newPatriarch.id, description: `اكتشاف واستيراد سيرة البطريرك: ${newPatriarch.name} ✦` });

      setTimeout(() => {
        renderDirectory();
        toast('تم تحديث البيانات وجلب السيرة من Firebase.');
      }, 250);
    } else {
      setImportStatus('لم نجد سيرة مطابقة في موقع الأنبا تكلا', 'تأكد من كتابة الاسم بشكل صحيح أو راجع فهرس الموقع.', true);
    }
  } catch (err) {
    setImportStatus('حدث خطأ أثناء الاتصال بالخادم', 'تأكد من تشغيل خادم Backend Firebase.', true);
  }
}

function toast(message) {
  const t = $('#toast');
  if (t) {
    t.textContent = message;
    t.classList.add('show');
    clearTimeout(window.toastTimer);
    window.toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }
}

function renderQuiz() {
  const today = localDayKey();
  const answer = JSON.parse(localStorage.getItem('coptic-quiz') || 'null');
  const done = answer?.date === today;
  
  $('#quizCard').innerHTML = `<div class="quiz-label"><span>السؤال رقم ٠١</span><span>صعوبة: متوسطة</span></div><h2>${quiz.question}</h2><div class="quiz-options">${quiz.choices.map((c, i) => `<button class="quiz-option ${done ? (i === quiz.answer ? 'correct' : i === answer.choice ? 'wrong' : '') : ''}" ${done ? 'disabled' : ''} data-answer="${i}">${['أ', 'ب', 'ج', 'د'][i]}. ${c}</button>`).join('')}</div>${done ? `<div class="quiz-result"><strong>${answer.correct ? 'إجابة صحيحة ✦' : 'إجابة غير صحيحة'}</strong><br>${quiz.explanation}</div>` : ''}`;
  
  const all = JSON.parse(localStorage.getItem('coptic-quiz-history') || '[]');
  $('#streakValue').textContent = all.filter(x => x.correct).length;
  $('#quizHistory').innerHTML = all.length ? `<h2>إجاباتك السابقة</h2><div class="history-list">${all.slice(-7).reverse().map(x => `<span class="history-item ${x.correct ? 'good' : 'bad'}">${x.date} ? ${x.correct ? '✓ إجابة صحيحة' : '? تحتاج إلى مراجعة'}</span>`).join('')}</div>` : '';
}

function answerQuiz(choice) {
  const today = localDayKey();
  if (JSON.parse(localStorage.getItem('coptic-quiz') || 'null')?.date === today) return;
  
  const correct = Number(choice) === quiz.answer;
  const entry = { date: today, choice: Number(choice), correct };
  
  localStorage.setItem('coptic-quiz', JSON.stringify(entry));
  const history = JSON.parse(localStorage.getItem('coptic-quiz-history') || '[]');
  history.push(entry);
  localStorage.setItem('coptic-quiz-history', JSON.stringify(history));
  
  renderQuiz();
  
  trackAction(correct ? 'quiz_correct' : 'quiz_attempt', {
    key: today,
    description: correct ? 'إجابة سؤال اليوم كنسي بشكل صحيح! 🎯' : 'المشاركة اليومية في سؤال اليوم 💡'
  });
}

function switchView(view) {
  activeView = view;
  $$('.view').forEach(v => v.classList.toggle('active', v.id === `${view}View`));
  syncNavigation(view);
  
  const mainNav = $('.main-nav');
  if (mainNav) mainNav.classList.remove('open');
  
  const menuToggle = $('#menuToggle');
  if (menuToggle) menuToggle.setAttribute('aria-expanded', 'false');
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
  
  if (view === 'patriarchs') renderDirectory();
  if (view === 'timeline') renderTimeline();
  if (view === 'quiz') renderQuiz();
  if (view === 'favorites') renderFavorites();
  if (view === 'gamification') renderGamificationDashboard();
}

function syncNavigation(view) {
  $$('.main-nav [data-view-link]').forEach(link => {
    const isActive = link.dataset.viewLink === view;
    link.classList.toggle('active', isActive);
    if (isActive) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

function initFilters() {
  const centuries = [...new Set(allPatriarchs().map(p => p.century))];
  const eras = [...new Set(allPatriarchs().map(p => p.era))];
  
  $('#centuryFilter').innerHTML = '<option value="">كل القرون</option>' + centuries.map(v => `<option>${v}</option>`).join('');
  $('#eraFilter').innerHTML = '<option value="">كل العصور</option>' + eras.map(v => `<option>${v}</option>`).join('');
}

function runSearch(query) {
  $('#directorySearch').value = query;
  
  if (String(query).trim()) trackAction('search', { description: 'البحث والاستكشاف في الدليل الموسوعي 🔍' });
  
  switchView('patriarchs');
  renderDirectory();
}

document.addEventListener('click', e => {
  const view = e.target.closest('[data-view-link]');
  if (view) {
    e.preventDefault();
    const page = document.body.dataset.page;
    const target = view.dataset.viewLink;
    if (page && page !== target) {
      window.location.href = PAGE_FILES[target] || 'index.html';
      return;
    }
    switchView(target);
  }
  
  const read = e.target.closest('[data-read]');
  if (read) showDetails(read.dataset.read);
  
  const fav = e.target.closest('[data-favorite]');
  if (fav) {
    const id = Number(fav.dataset.favorite);
    const v = favorites();
    setFavorites(v.includes(id) ? v.filter(x => x !== id) : [...v, id]);
    
    renderHome();
    renderDirectory();
    renderFavorites();
    
    if ($('#detailsModal').open) showDetails(id);
    toast(v.includes(id) ? 'أُزيلت السيرة من المفضلة' : 'أُضيفت السيرة إلى المفضلة');
  }
  
  const share = e.target.closest('[data-share]');
  if (share) {
    const p = findPatriarch(share.dataset.share);
    if (p) {
      navigator.clipboard?.writeText(`${p.name} — ${APP_NAME}`);
      toast('تم نسخ رابط السيرة للمشاركة');
      trackAction('share_biography', { key: p.id, description: `مشاركة سيرة: ${p.name} 🔗` });
    }
  }
  
  const era = e.target.closest('[data-era]');
  if (era) {
    $('#eraFilter').value = era.dataset.era;
    switchView('patriarchs');
    renderDirectory();
  }
  
  const timeline = e.target.closest('[data-timeline-era]');
  if (timeline) {
    $$('[data-timeline-era]').forEach(b => b.classList.toggle('active', b === timeline));
    renderTimeline(timeline.dataset.timelineEra);
  }
  
  const q = e.target.closest('[data-query]');
  if (q) {
    $('#heroSearch').value = q.dataset.query;
    runSearch(q.dataset.query);
  }
  
  const answer = e.target.closest('[data-answer]');
  if (answer) answerQuiz(answer.dataset.answer);
});

$('#themeToggle').addEventListener('click', () => {
  document.body.classList.toggle('dark');
  const dark = document.body.classList.contains('dark');
  localStorage.setItem('coptic-theme', dark ? 'dark' : 'light');
  $('#themeToggle').textContent = dark ? '☀' : '☾';
  $('#themeToggle').setAttribute('aria-label', dark ? 'تبديل الوضع النهاري' : 'تبديل الوضع الليلي');
  trackAction('theme_change', { description: 'تخصيص مظهر التطبيق' });
});

$('#menuToggle').addEventListener('click', () => {
  const n = $('.main-nav');
  n.classList.toggle('open');
  $('#menuToggle').setAttribute('aria-expanded', n.classList.contains('open'));
});

$('#heroSearchButton').addEventListener('click', () => runSearch($('#heroSearch').value));
$('#heroSearch').addEventListener('keydown', e => {
  if (e.key === 'Enter') runSearch(e.target.value);
});

$('#heroSearch').addEventListener('input', e => {
  const q = normalize(e.target.value);
  const suggestions = $('#searchSuggestions');
  const found = q ? patriarchs.filter(p => normalize(p.name + ' ' + p.en).includes(q)).slice(0, 4) : [];
  suggestions.hidden = !found.length;
  suggestions.innerHTML = found.map(p => `<button data-search-result="${p.id}">${p.name} <small>— البطريرك ${p.number}</small></button>`).join('');
});

$('#searchSuggestions').addEventListener('click', e => {
  const r = e.target.closest('[data-search-result]');
  if (r) {
    const p = patriarchs.find(x => x.id === Number(r.dataset.searchResult));
    if (p) {
      runSearch(p.name);
      $('#searchSuggestions').hidden = true;
    }
  }
});

['directorySearch', 'sortSelect', 'centuryFilter', 'eraFilter'].forEach(id => {
  const el = $('#' + id);
  if (el) el.addEventListener(id === 'directorySearch' ? 'input' : 'change', renderDirectory);
});

$('#resetFilters').addEventListener('click', () => {
  $('#directorySearch').value = '';
  $('#sortSelect').value = 'chronological';
  $('#centuryFilter').value = '';
  $('#eraFilter').value = '';
  renderDirectory();
});

$('#clearSearch').addEventListener('click', () => {
  $('#resetFilters').click();
});

$('#nextFeatured').addEventListener('click', () => {
  if (!patriarchs.length) return;
  displayedHome = (displayedHome + 1) % patriarchs.length;
  $('#featuredCard').innerHTML = feature(patriarchs[displayedHome]);
  trackAction('collection_browse', { description: 'استكشاف سيرة مميزة جديدة' });
});

$('#prevFeatured').addEventListener('click', () => {
  if (!patriarchs.length) return;
  displayedHome = (displayedHome - 1 + patriarchs.length) % patriarchs.length;
  $('#featuredCard').innerHTML = feature(patriarchs[displayedHome]);
  trackAction('collection_browse', { description: 'استكشاف سيرة مميزة جديدة' });
});

$('#modalClose').addEventListener('click', () => $('#detailsModal').close());
$('#detailsModal').addEventListener('click', e => {
  const r = $('#detailsModal').getBoundingClientRect();
  if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) $('#detailsModal').close();
});

window.addEventListener('scroll', () => {
  const h = document.documentElement;
  $('#scrollProgress').style.width = `${(h.scrollTop / (h.scrollHeight - h.clientHeight)) * 100}%`;
  $('#siteHeader').classList.toggle('scrolled', scrollY > 8);
});

function animateCounters() {
  const observer = new IntersectionObserver(entries => entries.forEach(e => {
    if (!e.isIntersecting) return;
    const el = e.target, end = Number(el.dataset.count), duration = 900, start = performance.now();
    function step(t) {
      el.textContent = Math.floor(Math.min(1, (t - start) / duration) * end).toLocaleString('ar-EG');
      if (t - start < duration) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
    observer.unobserve(el);
  }), { threshold: .5 });
  $$('.counter').forEach(e => observer.observe(e));
}

const APP_NAME = document.documentElement.lang === 'en' ? 'Nioti' : 'نيوتي';
function updateAppName() {
  document.title = document.title.replace(/ذاكرة الكرسي المرقسي|اثؤواب|نيوتي/g, APP_NAME);
  document.querySelectorAll('.app-title-brand').forEach(el => el.textContent = APP_NAME);
  const mainBrandLink = document.getElementById('mainBrandLink');
  if (mainBrandLink) {
    const brandLabel = document.documentElement.lang === 'en' ? 'Nioti - Home' : 'نيوتي - الرئيسية';
    mainBrandLink.setAttribute('aria-label', brandLabel);
  }
}

async function startApp() {
  if (localStorage.getItem('coptic-theme') === 'dark') {
    $('body').classList.add('dark');
    $('#themeToggle').textContent = '☀';
  }
  $('#year').textContent = new Date().getFullYear();
  updateAppName();
  
  // Load local-first gamification engine
  loadGamification();
  
  // Fetch dynamic patriarchs database from Backend Node server
  try {
    const res = await fetch(`${API_URL}/patriarchs`);
    if (res.ok) {
      patriarchs = await res.json();
    }
    if (!patriarchs.length) await loadLocalSaintsFallback();
  } catch (err) {
    console.warn('Backend unavailable. Loading the local UTF-8 saints dataset.', err);
    try {
      await loadLocalSaintsFallback();
    } catch (localError) {
      console.error('Could not load the local saints dataset.', localError);
    }
  }

  const page = document.body.dataset.page || 'all';
  activeView = page;
  syncNavigation(page);
  if (page === 'all' || page === 'patriarchs') initFilters();
  if (page === 'all' || page === 'home') renderHome();
  if (page === 'all' || page === 'patriarchs') renderDirectory();
  if (page === 'all' || page === 'timeline') renderTimeline();
  if (page === 'all' || page === 'quiz') renderQuiz();
  if (page === 'all' || page === 'favorites') renderFavorites();
  if (page === 'all' || page === 'gamification') renderGamificationDashboard();
  updateFavoriteCount();
  animateCounters();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}

startApp();
