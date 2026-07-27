const axios = require('axios');
const iconv = require('iconv-lite');
const cheerio = require('cheerio');

async function test() {
  const url = 'https://st-takla.org/Saints/Coptic-Saint-Hagiography-Kediseen-02-Beh.html';
  try {
    const res = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    
    // Decode windows-1256 to UTF-8
    const decodedHtml = iconv.decode(res.data, 'windows-1256');
    const $ = cheerio.load(decodedHtml);
    
    const links = [];
    $('a').each((i, el) => {
      const text = $(el).text().trim();
      const href = $(el).attr('href');
      if (href && href.includes('Coptic-Saints-Story')) {
        links.push({ text, href });
      }
    });
    
    console.log(`Found ${links.length} saints:`);
    console.log(JSON.stringify(links.slice(0, 5), null, 2));
  } catch (err) {
    console.error(err);
  }
}

test();
