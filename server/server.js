const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const iconv = require('iconv-lite');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

// Initialize Firebase Admin SDK
try {
  let credential;
  const saPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH;

  if (saPath && fs.existsSync(path.resolve(saPath))) {
    credential = admin.credential.cert(require(path.resolve(saPath)));
    console.log('Firebase initialized using Service Account JSON file.');
  } else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
    credential = admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    });
    console.log('Firebase initialized using environment variables.');
  } else {
    // Fallback/Placeholder initialization for local development without credentials
    console.warn('WARNING: Firebase credentials not found. Firestore operations will run in mockup/fallback mode.');
  }

  if (credential) {
    admin.initializeApp({ credential });
  }
} catch (error) {
  console.error('Firebase initialization error:', error);
}

// Check if Firebase is running in mock mode
const isMockFirebase = !admin.apps.length;
const db = isMockFirebase ? null : admin.firestore();

// Seed data
const initialPatriarchs = [
  {id:1,name:'القديس مرقس الرسول',en:'Saint Mark the Apostle',number:1,years:'43 – 68 م',century:'القرن الأول',era:'العصر الرسولي',summary:'كاروز الديار المصرية ومؤسس كرسي الإسكندرية، حمل بشارة الإنجيل إلى أرض مصر.',bio:'أسس القديس مرقس الرسول كنيسة الإسكندرية، ووضع بذرة الكرسي المرقسي الذي صار منارة للإيمان والتعليم عبر العصور.',achievements:'تأسيس الكنيسة في مصر، رسامة أول أسقف للإسكندرية، وتقديم تقليد ليتورجي حي.',events:'بداية البشارة المسيحية في الإسكندرية.',colors:['#2f6a6c','#c5a266']},
  {id:20,name:'البابا أثناسيوس الرسولي',en:'Pope Athanasius I',number:20,years:'328 – 373 م',century:'القرن الرابع',era:'العصر الذهبي',summary:'حارس الإيمان النيقاوي والمدافع الشجاع عن ألوهية السيد المسيح.',bio:'قاد البابا أثناسيوس الكنيسة في واحدة من أدق مراحل تاريخها، وثبت في الدفاع عن الإيمان المستقيم رغم النفي والاضطهاد.',achievements:'الدفاع عن قانون الإيمان النيقاوي، وكتابة مؤلفات لاهوتية مؤثرة.',events:'مجمع نيقية وما تبعه من صراعات لاهوتية.',colors:['#6a5138','#d6bd7e']},
  {id:24,name:'البابا ديسقوروس الأول',en:'Pope Dioscorus I',number:24,years:'444 – 454 م',century:'القرن الخامس',era:'عصر المجامع',summary:'أحد آباء الكنيسة البارزين في الدفاع عن الإيمان الأرثوذكسي.',bio:'شهدت فترة البابا ديسقوروس أحداثًا كنسية مفصلية؛ وبقي اسمه مرتبطًا بالأمانة للتقليد الإسكندري.',achievements:'حماية التراث اللاهوتي للإسكندرية، ورعاية الكنيسة في زمن المجامع.',events:'مجمع أفسس الثاني سنة 449 م.',colors:['#445d77','#c38c61']},
  {id:38,name:'البابا بنيامين الأول',en:'Pope Benjamin I',number:38,years:'622 – 661 م',century:'القرن السابع',era:'عصر التحولات',summary:'راعٍ حكيم عبر بالكنيسة زمن تغيرات عميقة في تاريخ مصر.',bio:'قاد البابا بنيامين الكنيسة بحكمة وصبر في ظروف تاريخية صعبة، وظل رمزًا للرعاية والثبات.',achievements:'حفظ وحدة الكنيسة وتنظيم الحياة الرعوية.',events:'تحولات مصر السياسية في القرن السابع.',colors:['#7c5f3d','#d5b46f']},
  {id:67,name:'البابا كيرلس الرابع',en:'Pope Cyril IV',number:110,years:'1854 – 1861 م',century:'القرن التاسع عشر',era:'عصر النهضة',summary:'أبو الإصلاح القبطي الحديث، اهتم بالتعليم والطباعة والتجديد.',bio:'كان البابا كيرلس الرابع صاحب رؤية إصلاحية واسعة؛ جعل التعليم في قلب نهضته وفتح آفاقًا جديدة أمام المجتمع القبطي.',achievements:'إنشاء المدارس، الاهتمام بالمطبعة، وتشجيع تعليم البنات.',events:'بدايات النهضة التعليمية الحديثة.',colors:['#235f5c','#d3a959']},
  {id:82,name:'البابا كيرلس السادس',en:'Pope Cyril VI',number:116,years:'1959 – 1971 م',century:'القرن العشرون',era:'العصر الحديث',summary:'رجل صلاة عميقة شهد عصره نهضة روحية وبناء الكاتدرائية المرقسية.',bio:'اتسمت خدمته بالبساطة والصلاة، وارتبطت بتطورات كنسية مهمة في القرن العشرين.',achievements:'وضع حجر أساس الكاتدرائية المرقسية بالعباسية ورعاية نهضة روحية واسعة.',events:'ظهورات السيدة العذراء بالزيتون وبناء الكاتدرائية.',colors:['#4c4d76','#c5a66a']},
  {id:89,name:'البابا شنودة الثالث',en:'Pope Shenouda III',number:117,years:'1971 – 2012 م',century:'القرن العشرون',era:'العصر الحديث',summary:'راعٍ ومعلم وشاعر، وسّع دوائر التعليم والخدمة القبطية حول العالم.',bio:'جمع البابا شنودة الثالث بين عمق التعليم وقرب الرعاية، وتكلم إلى أجيال عديدة في الداخل والمهجر.',achievements:'توسيع الإيبارشيات العالمية ومدارس الأحد والاجتماعات التعليمية.',events:'امتداد الخدمة القبطية إلى قارات العالم.',colors:['#355d68','#c6905b']},
  {id:96,name:'البابا تواضروس الثاني',en:'Pope Tawadros II',number:118,years:'2012 م – حتى الآن',century:'القرن الحادي والعشرون',era:'العصر الحديث',summary:'البابا الحالي للكنيسة القبطية الأرثوذكسية، يواصل مسيرة الرعاية والخدمة.',bio:'يقود البابا تواضروس الثاني الكنيسة في زمن التواصل العالمي، مع اهتمام بالرعاية المجتمعية والشباب والمهجر.',achievements:'تعزيز العمل المؤسسي والرعاية في الداخل والمهجر.',events:'توسّع المبادرات الرعوية والخدمية في العصر الرقمي.',colors:['#17646a','#d3ad62']}
];

// Load the local UTF-8 dataset for development/offline use. The source file
// contains Arabic text directly; reading it as UTF-8 prevents mojibake such
// as double-encoded text from reaching the browser.
function loadLocalSaints() {
  try {
    const filePath = path.join(__dirname, '..', 'public', 'saints_data.json');
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const records = Array.isArray(parsed) ? parsed : Object.values(parsed);

    return records.map((saint, index) => {
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
  } catch (error) {
    console.error('Could not load saints_data.json:', error.message);
    return [];
  }
}

const localSaints = loadLocalSaints();
// Fallback in-memory DB if Firebase is not connected. If the local file is
// available, serve only its correctly encoded records so old mojibake seed
// entries cannot leak into the UI.
let mockDatabase = localSaints.length ? [...localSaints] : [...initialPatriarchs];

// Helper to seed Firestore if empty
async function seedDatabase() {
  if (isMockFirebase) return;
  try {
    const snapshot = await db.collection('patriarchs').limit(1).get();
    if (snapshot.empty) {
      console.log('Seeding initial patriarchs to Firestore...');
      const batch = db.batch();
      initialPatriarchs.forEach(p => {
        const ref = db.collection('patriarchs').doc(String(p.id));
        batch.set(ref, p);
      });
      await batch.commit();
      console.log('Database seeded successfully.');
    }
  } catch (error) {
    console.error('Error seeding database:', error);
  }
}
seedDatabase();

// Text normalization helper
function normalize(s) {
  if (!s) return '';
  return s.replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').toLowerCase().trim();
}

// Scraper function for St. Takla
async function scrapeStTakla(query) {
  const normalizedQuery = normalize(query);
  const indexUrl = 'https://st-takla.org/Saints/Coptic-Synaxarium-Orthodox-Saints-Biography-00-Coptic-Orthodox-Popes/Coptic-Popes-History_000-index_.html';
  
  try {
    const resIndex = await axios.get(indexUrl, {
      responseType: 'arraybuffer',
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const decodedIndex = iconv.decode(resIndex.data, 'windows-1256');
    const $ = cheerio.load(decodedIndex);
    let targetLink = null;
    
    // Search links matching the query
    $('a').each((i, el) => {
      const text = $(el).text();
      const href = $(el).attr('href');
      if (href && href.includes('Life-of-Coptic-Pope') && normalize(text).includes(normalizedQuery)) {
        targetLink = {
          text: text.trim(),
          url: href.startsWith('http') ? href : `https://st-takla.org/Saints/Coptic-Synaxarium-Orthodox-Saints-Biography-00-Coptic-Orthodox-Popes/${href}`
        };
        return false; // break loop
      }
    });

    if (!targetLink) {
      return null;
    }

    // Fetch details
    const detailRes = await axios.get(targetLink.url, {
      responseType: 'arraybuffer',
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const decodedDetail = iconv.decode(detailRes.data, 'windows-1256');
    const $$ = cheerio.load(decodedDetail);
    
    // Parse name and number
    const pageTitle = $$('h1').text() || targetLink.text;
    const numberMatch = pageTitle.match(/(\d+)/);
    const number = numberMatch ? parseInt(numberMatch[1]) : mockDatabase.length + 100;
    
    // Basic heuristics to extract biography details from the page content
    const paragraphs = [];
    $$('p, div').each((i, el) => {
      const t = $$(el).text().trim();
      if (t.length > 50 && !t.includes('st-takla') && paragraphs.length < 5) {
        paragraphs.push(t);
      }
    });

    const parsedData = {
      id: number,
      name: pageTitle.replace(/البابا/g, '').trim(),
      en: `Pope ${pageTitle.replace(/[^a-zA-Z ]/g, '').trim() || 'Imported ' + number}`,
      number: number,
      years: 'غير محدد م',
      century: 'غير محدد',
      era: 'عصر غير مصنف',
      summary: paragraphs[0] || 'سيرة مستوردة من موقع الأنبا تكلا.',
      bio: paragraphs.join('\n\n') || 'لا يوجد تفاصيل إضافية حالياً.',
      achievements: 'يرجى مراجعة المصدر للتفاصيل الكاملة.',
      events: 'يرجى مراجعة المصدر للتفاصيل الكاملة.',
      colors: ['#4a5568', '#a0aec0'],
      source: targetLink.url,
      sourceLabel: 'موقع الأنبا تكلا — ' + pageTitle,
      imported: true
    };

    return parsedData;
  } catch (error) {
    console.error('Error scraping St. Takla:', error);
    return null;
  }
}

// API Endpoints

// Send JSON using ASCII escape sequences for non-ASCII characters. JSON.parse
// in the browser reconstructs the original Arabic code points, avoiding any
// intermediary Windows code-page conversion.
function sendUnicodeSafeJson(res, payload) {
  const body = JSON.stringify(payload).replace(/[^\x00-\x7F]/g, char => {
    const codePoint = char.codePointAt(0);
    if (codePoint <= 0xffff) return `\\u${codePoint.toString(16).padStart(4, '0')}`;
    const offset = codePoint - 0x10000;
    const high = 0xd800 + (offset >> 10);
    const low = 0xdc00 + (offset & 0x3ff);
    return `\\u${high.toString(16)}\\u${low.toString(16)}`;
  });
  return res.type('application/json').send(body);
}

// 1. Get all patriarchs
app.get('/api/patriarchs', async (req, res) => {
  try {
    if (isMockFirebase || process.env.NODE_ENV !== 'production') {
      return sendUnicodeSafeJson(res, mockDatabase);
    }
    const snapshot = await db.collection('patriarchs').get();
    const list = [];
    snapshot.forEach(doc => list.push(doc.data()));
    // Sort by number ascending
    list.sort((a, b) => (a.number || 0) - (b.number || 0));
    sendUnicodeSafeJson(res, list);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Search & scrape on demand
app.get('/api/patriarchs/search', async (req, res) => {
  const query = req.query.q;
  if (!query) {
    return res.status(400).json({ error: 'Query parameter "q" is required' });
  }

  const normalizedQuery = normalize(query);

  try {
    let match = null;

    if (isMockFirebase || process.env.NODE_ENV !== 'production') {
      match = mockDatabase.find(p => 
        normalize(p.name).includes(normalizedQuery) || 
        normalize(p.en).includes(normalizedQuery)
      );
    } else {
      const snapshot = await db.collection('patriarchs').get();
      snapshot.forEach(doc => {
        const data = doc.data();
        if (normalize(data.name).includes(normalizedQuery) || normalize(data.en).includes(normalizedQuery)) {
          match = data;
        }
      });
    }

    if (match) {
      return sendUnicodeSafeJson(res, { source: 'database', data: match });
    }

    // Scrape from St. Takla if not found locally
    console.log(`Query "${query}" not found in database. Scraping St. Takla...`);
    const scraped = await scrapeStTakla(query);

    if (scraped) {
      if (isMockFirebase) {
        mockDatabase.push(scraped);
      } else {
        await db.collection('patriarchs').doc(String(scraped.id)).set(scraped);
      }
      return sendUnicodeSafeJson(res, { source: 'scraper', data: scraped });
    }

    res.status(404).json({ error: 'No matching biography found' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve the frontend in both development and production.
// This keeps `npm run dev` usable at http://localhost:5000 while the API
// routes above continue to handle requests under /api.
const publicDirectory = path.join(__dirname, '..', 'public');
app.use(express.static(publicDirectory));
app.get('*', (req, res) => {
  res.sendFile(path.join(publicDirectory, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
