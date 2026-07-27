const axios = require('axios');
const cheerio = require('cheerio');

async function test() {
  const url = 'https://st-takla.org/Saints/Coptic-Orthodox-Saints-Biography/Coptic-Saints-Story_486.html';
  try {
    const { data } = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const $ = cheerio.load(data);
    console.log('Title:', $('h1').text().trim());
    const paragraphs = [];
    $('p, font').each((i, el) => {
      const text = $(el).text().trim();
      if (text.length > 50 && !text.includes('st-takla') && !text.includes('St-Takla') && paragraphs.length < 5) {
        paragraphs.push(text.substring(0, 150) + '...');
      }
    });
    console.log('Paragraphs:', paragraphs);
  } catch (err) {
    console.error(err);
  }
}

test();
