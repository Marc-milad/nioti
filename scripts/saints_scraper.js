const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const iconv = require('iconv-lite');
require('dotenv').config();

// Option to seed to Firebase Firestore if credentials are found
let admin = null;
let db = null;
try {
  const saPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH || './config/firebase-service-account.json';
  const resolvedPath = path.resolve(saPath);
  if (fs.existsSync(resolvedPath)) {
    admin = require('firebase-admin');
    admin.initializeApp({
      credential: admin.credential.cert(require(resolvedPath))
    });
    db = admin.firestore();
    console.log('Firebase initialized. Scraped saints will also be seeded to your Firestore!');
  } else {
    console.log('Firebase credentials not found. Scraped data will be saved locally to saints_data.json only.');
  }
} catch (err) {
  console.log('Firebase initialization skipped. Saving locally to saints_data.json only.');
}

const BASE_URL = 'https://st-takla.org/Saints';
const INDEX_URL = `${BASE_URL}/Coptic-Saint-Hagiography-Kediseen-00-index.html`;

async function scrapeSaints() {
  console.log(`Starting St. Takla Coptic Saints Scraper...`);
  console.log(`Fetching main alphabet index from: ${INDEX_URL}`);
  
  const resIndex = await axios.get(INDEX_URL, {
    responseType: 'arraybuffer',
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const indexHtml = iconv.decode(resIndex.data, 'windows-1256');
  const $ = cheerio.load(indexHtml);
  
  // Extract all letter links
  const alphabetLinks = [];
  $('a').each((i, el) => {
    const href = $(el).attr('href');
    const text = $(el).text().trim();
    if (href && href.includes('Coptic-Saint-Hagiography-Kediseen-') && !href.includes('-00-')) {
      const fullUrl = href.startsWith('http') ? href : `${BASE_URL}/${href}`;
      if (!alphabetLinks.some(link => link.url === fullUrl)) {
        alphabetLinks.push({ text, url: fullUrl });
      }
    }
  });

  console.log(`Found ${alphabetLinks.length} alphabet index pages.`);
  const allSaints = [];
  const visitedSaintUrls = new Set();

  // Loop through alphabetical letters
  for (const letter of alphabetLinks) {
    console.log(`\n--- Fetching saints for letter: "${letter.text}" (${letter.url}) ---`);
    try {
      const resLetter = await axios.get(letter.url, {
        responseType: 'arraybuffer',
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      const letterHtml = iconv.decode(resLetter.data, 'windows-1256');
      const $$ = cheerio.load(letterHtml);
      
      const letterSaints = [];
      $$('a').each((idx, el) => {
        const href = $$(el).attr('href');
        const text = $$(el).text().trim();
        if (href && href.includes('Coptic-Saints-Story')) {
          const fullUrl = href.startsWith('http') 
            ? href 
            : `${BASE_URL}/${href.startsWith('/') ? href.slice(1) : 'Coptic-Orthodox-Saints-Biography/' + href.split('/').pop()}`;
          
          if (!visitedSaintUrls.has(fullUrl)) {
            visitedSaintUrls.add(fullUrl);
            letterSaints.push({
              name: text.replace(/\s+/g, ' ').trim(),
              url: fullUrl
            });
          }
        }
      });

      console.log(`Found ${letterSaints.length} saints under this letter.`);
      
      // Let's scrape each saint details
      for (const saint of letterSaints) {
        console.log(`Scraping details for: ${saint.name}...`);
        try {
          const resDetail = await axios.get(saint.url, {
            responseType: 'arraybuffer',
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 8000
          });
          const detailHtml = iconv.decode(resDetail.data, 'windows-1256');
          const $$$ = cheerio.load(detailHtml);
          
          // Get the raw page title
          const title = $$$('h1').text().trim() || saint.name;
          const cleanTitle = title
            .replace(/\*/g, '')
            .replace(/\s+/g, ' ')
            .trim();
          
          // Extract biography paragraphs
          const paragraphs = [];
          $$$('p, font').each((pidx, pel) => {
            const text = $$$(pel).text().trim();
            if (
              text.length > 40 &&
              !text.includes('st-takla') &&
              !text.includes('St-Takla') &&
              !text.includes('تواصل معنا') &&
              !text.includes('حقوق الطبع')
            ) {
              const cleanP = text.replace(/\s+/g, ' ').trim();
              if (cleanP && !paragraphs.includes(cleanP)) {
                paragraphs.push(cleanP);
              }
            }
          });

          const saintId = saint.url.match(/_(\d+)\.html/)?.[1] || Math.floor(Math.random() * 100000);

          const saintData = {
            id: String(saintId),
            name: cleanTitle,
            bio: paragraphs.join('\n\n') || 'التفاصيل الكاملة للسيرة متوفرة على الرابط الأصلي.',
            summary: paragraphs[0]?.substring(0, 150) + '...' || `سيرة القديس ${cleanTitle}.`,
            url: saint.url,
            scrapedAt: new Date().toISOString()
          };

          allSaints.push(saintData);

          // If Firebase is available, save/upload to Firestore
          if (db) {
            await db.collection('saints').doc(String(saintId)).set(saintData);
          }

          // Delay to be polite to the host website
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (err) {
          console.error(`Failed to scrape individual details for ${saint.name}:`, err.message);
        }
      }

      // Save intermediate progress
      fs.writeFileSync(path.join(__dirname, '..', 'public', 'saints_data.json'), JSON.stringify(allSaints, null, 2));
      console.log(`Saved progress: ${allSaints.length} total saints written to local file.`);
    } catch (err) {
      console.error(`Failed to fetch alphabet page ${letter.text}:`, err.message);
    }
  }

  console.log(`\nScraping complete! Total saints scraped: ${allSaints.length}`);
  console.log(`All data saved to: ${path.resolve(__dirname, '..', 'public', 'saints_data.json')}`);
  if (db) {
    console.log('All saints successfully synchronized to Firebase Firestore!');
  }
}

scrapeSaints().catch(err => {
  console.error('Scraper error:', err);
});
