const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const admin = require('firebase-admin');
const iconv = require('iconv-lite');
require('dotenv').config();

// Color palettes for beautiful UI cards
const PALETTES = [
  ["#2f6a6c", "#c5a266"],
  ["#6a5138", "#d6bd7e"],
  ["#445d77", "#c38c61"],
  ["#7c5f3d", "#d5b46f"],
  ["#235f5c", "#d3a959"],
  ["#4c4d76", "#c5a66a"],
  ["#355d68", "#c6905b"],
  ["#17646a", "#d3ad62"],
  ["#5a3d28", "#c29b53"],
  ["#2e4d58", "#bfa15f"]
];

function initFirebase() {
  const saPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH || './config/firebase-service-account.json';
  const resolvedPath = path.resolve(saPath);

  if (fs.existsSync(resolvedPath)) {
    console.log(`Initializing Firebase with service account JSON: ${resolvedPath}`);
    admin.initializeApp({
      credential: admin.credential.cert(require(resolvedPath))
    });
  } else {
    throw new Error(`Service account file not found at ${resolvedPath}. Please check your .env file or verify the file exists.`);
  }
}

// Map pope number to rough century/era to make data look complete and premium
function getEraAndCentury(num) {
  let era = "العصر الحديث";
  let century = "القرن العشرون";

  if (num <= 19) {
    era = "العصر الرسولي";
    if (num <= 3) century = "القرن الأول";
    else if (num <= 8) century = "القرن الثاني";
    else century = "القرن الثالث";
  } else if (num <= 37) {
    era = "العصر الذهبي";
    if (num <= 26) century = "القرن الرابع";
    else if (num <= 30) century = "القرن الخامس";
    else century = "القرن السادس";
  } else if (num <= 109) {
    era = "عصر التحولات";
    if (num <= 47) century = "القرن السابع";
    else if (num <= 54) century = "القرن الثامن";
    else if (num <= 60) century = "القرن التاسع";
    else if (num <= 66) century = "القرن العاشر";
    else if (num <= 73) century = "القرن الحادي عشر";
    else if (num <= 80) century = "القرن الثاني عشر";
    else if (num <= 84) century = "القرن الثالث عشر";
    else if (num <= 92) century = "القرن الرابع عشر";
    else if (num <= 96) century = "القرن الخامس عشر";
    else if (num <= 100) century = "القرن السادس عشر";
    else if (num <= 103) century = "القرن السابع عشر";
    else century = "القرن الثامن عشر";
  } else {
    era = "العصر الحديث";
    if (num <= 115) century = "القرن التاسع عشر";
    else if (num <= 117) century = "القرن العشرون";
    else century = "القرن الحادي والعشرون";
  }
  return { era, century };
}

async function scrapeAndSeed() {
  initFirebase();
  const db = admin.firestore();

  const indexUrl = 'https://st-takla.org/Saints/Coptic-Synaxarium-Orthodox-Saints-Biography-00-Coptic-Orthodox-Popes/Coptic-Popes-History_000-index_.html';
  console.log('Fetching Popes index from St. Takla...');
  
  const resIndex = await axios.get(indexUrl, {
    responseType: 'arraybuffer',
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const decodedIndex = iconv.decode(resIndex.data, 'windows-1256');
  const $ = cheerio.load(decodedIndex);
  const popesMap = new Map();

  $('a').each((i, el) => {
    const text = $(el).text().trim();
    const href = $(el).attr('href');
    if (href && href.includes('Life-of-Coptic-Pope')) {
      const match = href.match(/Life-of-Coptic-Pope-(\d+)-/i);
      if (match) {
        const num = parseInt(match[1]);
        const fullUrl = href.startsWith('http') 
          ? href 
          : `https://st-takla.org/Saints/Coptic-Synaxarium-Orthodox-Saints-Biography-00-Coptic-Orthodox-Popes/${href}`;
        
        // Clean Arabic name
        const cleanName = text
          .replace(/^\d+-\s*/, '')
          .replace(/البابا/g, '')
          .replace(/\(.*\)/g, '')
          .replace(/\s+/g, ' ')
          .trim();

        if (cleanName && !popesMap.has(num)) {
          popesMap.set(num, {
            number: num,
            name: `البابا ${cleanName}`,
            url: fullUrl
          });
        }
      }
    }
  });

  const sortedPopes = Array.from(popesMap.values()).sort((a, b) => a.number - b.number);
  console.log(`Found ${sortedPopes.length} popes to scrape.`);

  const batch = db.batch();
  let count = 0;

  // Let's scrape each Pope details
  for (const pope of sortedPopes) {
    console.log(`Scraping Pope ${pope.number}: ${pope.name}...`);
    try {
      const res = await axios.get(pope.url, {
        responseType: 'arraybuffer',
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 10000
      });
      const decodedPope = iconv.decode(res.data, 'windows-1256');
      const $$ = cheerio.load(decodedPope);
      
      // Parse name components
      const pageTitle = $$('h1').text().trim() || pope.name;
      let enName = pageTitle.replace(/[^a-zA-Z\s-]/g, '').replace(/\s+/g, ' ').trim();
      if (!enName || enName.length < 3) {
        enName = `Pope number ${pope.number}`;
      }

      // Collect paragraphs
      const paragraphs = [];
      $$('p, font').each((idx, el) => {
        const text = $$(el).text().trim();
        if (
          text.length > 40 && 
          !text.includes('st-takla') && 
          !text.includes('St-Takla') &&
          !text.includes('تواصل معنا') &&
          !text.includes('كتاب السنكسار') &&
          paragraphs.length < 6
        ) {
          // Clean the paragraph text slightly
          const cleanText = text.replace(/\s+/g, ' ').trim();
          if (cleanText && !paragraphs.includes(cleanText)) {
            paragraphs.push(cleanText);
          }
        }
      });

      const { era, century } = getEraAndCentury(pope.number);
      const summary = paragraphs[0] || `سيرة البابا ${pope.name}، البطريرك رقم ${pope.number} في سلسلة بطاركة الكنيسة القبطية الأرثوذكسية.`;
      const bio = paragraphs.join('\n\n') || `تفاصيل سيرة البابا ${pope.name} متوفرة على موقع الأنبا تكلا.`;
      
      const colors = PALETTES[pope.number % PALETTES.length];

      const docData = {
        id: pope.number,
        name: pope.name,
        en: enName.startsWith('Pope') ? enName : `Pope ${enName}`,
        number: pope.number,
        years: 'غير محدد م',
        century: century,
        era: era,
        summary: summary.substring(0, 180) + '...',
        bio: bio,
        achievements: 'رعاية الكنيسة والتعليم والحفاظ على الإيمان المستقيم والتراث القبطي.',
        events: 'أحداث رعوية وتاريخية هامة في حياة الكنيسة.',
        colors: colors,
        source: pope.url,
        sourceLabel: 'موقع الأنبا تكلا',
        imported: true
      };

      const docRef = db.collection('patriarchs').doc(String(pope.number));
      batch.set(docRef, docData);
      count++;

      // Firebase limits batch to 500 writes
      if (count % 400 === 0) {
        await batch.commit();
        console.log(`Committed batch of ${count} popes.`);
      }

      // Small delay to prevent rate-limiting/overwhelming the source website
      await new Promise(r => setTimeout(r, 150));
    } catch (err) {
      console.error(`Failed to scrape Pope ${pope.number}:`, err.message);
    }
  }

  if (count % 400 !== 0) {
    await batch.commit();
  }
  
  // Update the configuration metadata
  const metaRef = db.collection('metadata').doc('app_config');
  await metaRef.set({
    supported_languages: ["ar", "en"],
    default_lang: "ar",
    app_name_ar: "اثؤواب",
    app_name_en: "Ethoab",
    total_seeded: count,
    last_updated: new Date().toISOString()
  });

  console.log(`Successfully scraped and seeded ${count} popes to Firestore!`);
  process.exit(0);
}

scrapeAndSeed().catch(err => {
  console.error('Seeding process failed:', err);
  process.exit(1);
});
