require('dotenv').config();
const { Client } = require('pg');
const https = require('https');
const axios = require('axios');

const client = new Client({
  host: 'db.qhyrfjletazbsjsfosdl.supabase.co',
  port: 5432,
  user: 'postgres',
  password: '8ZKt+2D2_2s4fyE',
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
});

const GOOGLE_NEWS_QUERIES = [
  'artificial intelligence healthcare breakthrough',
  'AI medical diagnosis',
  'machine learning drug discovery',
  'AI radiology imaging',
  'deep learning cancer detection',
  'AI surgical robotics',
  'medical AI FDA approval',
  'AI clinical trials',
  'healthcare AI research',
  'medical AI technology',
];

const AI_PROVIDERS = [
  {
    name: 'Google Gemini',
    id: 'gemini',
    envKey: 'GEMINI_API_KEY',
    requestsPerMinute: 60,
    enabled: false,
    count: 0,
    generate: async (apiKey, title, category, source, type = 'summary') => {
      const summaryPrompt = `You are a medical AI news editor. Based ONLY on this title, write a compelling 2-3 sentence summary.

Title: "${title}"
Category: ${category}
Source: ${source}

Write a natural, specific summary that:
- Sounds concrete and informative (infer details from the title)
- Mentions specific elements from the title
- Avoids generic phrases like "highlights advancement"
- Write ONLY the summary, no preamble.`;

      const contentPrompt = `You are a medical AI news editor. Expand this into a detailed 3-paragraph article.

Title: "${title}"
Category: ${category}
Source: ${source}

Write 3 well-developed paragraphs that sound authoritative and specific. No preamble:`;

      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          contents: [{
            parts: [{ text: type === 'summary' ? summaryPrompt : contentPrompt }]
          }]
        },
        { timeout: 15000 }
      );

      return response.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    }
  },
  {
    name: 'Groq (Mixtral)',
    id: 'groq',
    envKey: 'GROQ_API_KEY',
    requestsPerMinute: 30,
    enabled: false,
    count: 0,
    generate: async (apiKey, title, category, source, type = 'summary') => {
      const summaryPrompt = `Based on this title, write a compelling 2-3 sentence medical news summary. Be specific and concrete, avoid generic phrases.

Title: "${title}"
Category: ${category}

Write ONLY the summary:`;

      const contentPrompt = `Expand this medical news story into 3 detailed paragraphs:

Title: "${title}"
Category: ${category}

Write 3 paragraphs:`;

      const response = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model: 'mixtral-8x7b-32768',
          messages: [{ role: 'user', content: type === 'summary' ? summaryPrompt : contentPrompt }],
          temperature: 0.7,
          max_tokens: type === 'summary' ? 200 : 600
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      );

      return response.data?.choices?.[0]?.message?.content?.trim();
    }
  },
  {
    name: 'Together AI',
    id: 'together',
    envKey: 'TOGETHER_API_KEY',
    requestsPerMinute: 60,
    enabled: false,
    count: 0,
    generate: async (apiKey, title, category, source, type = 'summary') => {
      const summaryPrompt = `Write a 2-3 sentence medical news summary for: "${title}" (${category})`;
      const contentPrompt = `Write 3 detailed paragraphs about: "${title}" (${category})`;

      const response = await axios.post(
        'https://api.together.xyz/v1/chat/completions',
        {
          model: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
          messages: [{ role: 'user', content: type === 'summary' ? summaryPrompt : contentPrompt }],
          temperature: 0.7,
          max_tokens: type === 'summary' ? 200 : 600
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      );

      return response.data?.choices?.[0]?.message?.content?.trim();
    }
  },
  {
    name: 'OpenRouter (Free Models)',
    id: 'openrouter',
    envKey: 'OPENROUTER_API_KEY',
    requestsPerMinute: 20,
    enabled: false,
    count: 0,
    generate: async (apiKey, title, category, source, type = 'summary') => {
      const summaryPrompt = `Write a 2-3 sentence medical news summary for: "${title}" (${category})`;
      const contentPrompt = `Write 3 detailed paragraphs about: "${title}" (${category})`;

      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: 'google/gemini-2.0-flash-exp:free',
          messages: [{ role: 'user', content: type === 'summary' ? summaryPrompt : contentPrompt }]
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://medicalnews.ai',
            'X-Title': 'Medical News AI Crawler'
          },
          timeout: 15000
        }
      );

      return response.data?.choices?.[0]?.message?.content?.trim();
    }
  },
  {
    name: 'Hugging Face',
    id: 'huggingface',
    envKey: 'HUGGINGFACE_API_KEY',
    requestsPerMinute: 30,
    enabled: false,
    count: 0,
    generate: async (apiKey, title, category, source, type = 'summary') => {
      const summaryPrompt = `Write a 2-3 sentence medical news summary for: "${title}"`;
      const contentPrompt = `Write 3 paragraphs about: "${title}"`;

      const response = await axios.post(
        'https://api-inference.huggingface.co/models/mistralai/Mixtral-8x7B-Instruct-v0.1',
        {
          inputs: type === 'summary' ? summaryPrompt : contentPrompt,
          parameters: { max_new_tokens: type === 'summary' ? 150 : 500, temperature: 0.7 }
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 20000
        }
      );

      return response.data?.[0]?.generated_text?.trim();
    }
  }
];

let currentProviderIndex = 0;
let lastResetTime = Date.now();

function initializeProviders() {
  AI_PROVIDERS.forEach(provider => {
    const apiKey = process.env[provider.envKey];
    if (apiKey && apiKey.length > 10) {
      provider.enabled = true;
      provider.apiKey = apiKey;
      console.log(`✓ ${provider.name} enabled`);
    }
  });

  const enabledCount = AI_PROVIDERS.filter(p => p.enabled).length;
  if (enabledCount === 0) {
    console.log('⚠️  No AI providers configured - will use fallback summaries\n');
  } else {
    console.log(`\n✓ ${enabledCount} AI provider(s) ready\n`);
  }
}

async function generateWithAI(title, category, source, type = 'summary') {
  const enabledProviders = AI_PROVIDERS.filter(p => p.enabled);

  if (enabledProviders.length === 0) {
    return null;
  }

  if (Date.now() - lastResetTime > 60000) {
    AI_PROVIDERS.forEach(p => p.count = 0);
    lastResetTime = Date.now();
  }

  const maxAttempts = enabledProviders.length;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const provider = enabledProviders[currentProviderIndex % enabledProviders.length];

    if (provider.count >= provider.requestsPerMinute) {
      console.log(`    ⏭️  ${provider.name} rate limit, trying next...`);
      currentProviderIndex++;
      continue;
    }

    try {
      console.log(`    🤖 Using ${provider.name}...`);
      const result = await provider.generate(provider.apiKey, title, category, source, type);

      if (result && result.length > 50) {
        provider.count++;
        currentProviderIndex = (currentProviderIndex + 1) % enabledProviders.length;
        console.log(`    ✓ Generated with ${provider.name}`);
        return result;
      }
    } catch (error) {
      console.log(`    ❌ ${provider.name} failed: ${error.message}`);
    }

    currentProviderIndex++;
  }

  return null;
}

function createSmartFallback(title, category, source, type = 'summary') {
  const cleanedTitle = cleanTitle(title);

  if (type === 'summary') {
    return `${cleanedTitle} ${source} reports on this development in AI-assisted ${category.toLowerCase()}.`;
  } else {
    return `${cleanedTitle} ${source} reports on this development in AI-assisted ${category.toLowerCase()}.`;
  }
}

function fetchURL(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function parseRSS(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1];

    const title = (item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ||
                   item.match(/<title>(.*?)<\/title>/))?.[1] || '';

    const link = (item.match(/<link>(.*?)<\/link>/) ||
                  item.match(/<guid[^>]*>(.*?)<\/guid>/))?.[1] || '';

    const pubDate = (item.match(/<pubDate>(.*?)<\/pubDate>/))?.[1] || new Date().toISOString();

    const imageUrl = (
      item.match(/<media:content[^>]*url=["']([^"']+)["']/)?.[1] ||
      item.match(/<media:thumbnail[^>]*url=["']([^"']+)["']/)?.[1] ||
      item.match(/<enclosure[^>]*url=["']([^"']+)["'][^>]*type=["']image/)?.[1] ||
      item.match(/<image><url>(.*?)<\/url><\/image>/)?.[1] ||
      null
    );

    if (title && link) {
      items.push({
        title: title.trim(),
        link: link.trim(),
        pubDate,
        imageUrl: imageUrl ? imageUrl.trim() : null
      });
    }
  }

  return items;
}

function extractSourceFromTitle(title) {
  const match = title.match(/ - ([^-]+)$/);
  if (match) {
    const source = match[1].trim();
    if (source && source.length < 50 && !source.includes('http')) {
      return source;
    }
  }

  const sources = ['Nature', 'Science', 'MIT News', 'Stanford', 'NIH', 'FDA', 'Google', 'DeepMind',
                   'JAMA', 'Lancet', 'NEJM', 'Forbes', 'Reuters', 'BBC', 'CNN Health', 'Harvard',
                   'Johns Hopkins', 'Mayo Clinic', 'Cleveland Clinic', 'Wired', 'TechCrunch'];
  for (const source of sources) {
    if (title.toLowerCase().includes(source.toLowerCase())) {
      return source;
    }
  }

  return 'Medical News Network';
}

function cleanTitle(title) {
  const match = title.match(/^(.*?)\s*-\s*[^-]+$/);
  if (match && match[1].length > 20) {
    return match[1].trim();
  }
  return title;
}

function categorizeArticle(title) {
  const text = title.toLowerCase();

  if (text.match(/diagnos|detect|screen|identif/)) return 'Diagnostics';
  if (text.match(/imag|scan|x-ray|mri|ct|radiolog/)) return 'Medical Imaging';
  if (text.match(/surg|operat|robot/)) return 'Surgery';
  if (text.match(/drug|pharmac|compound|molecul|discover/)) return 'Drug Discovery';
  if (text.match(/genom|dna|gene|sequenc/)) return 'Genomics';
  if (text.match(/patient|care|treatment|therap/)) return 'Patient Care';
  if (text.match(/trial|clinic|study/)) return 'Clinical Trials';
  if (text.match(/telemed|remote|virtual|digital health/)) return 'Telemedicine';

  return 'Research';
}

async function crawlGoogleNews() {
  const articles = [];
  const seenTitles = new Set();

  for (const query of GOOGLE_NEWS_QUERIES) {
    try {
      const encodedQuery = encodeURIComponent(query);
      const url = `https://news.google.com/rss/search?q=${encodedQuery}&hl=en-US&gl=US&ceid=US:en`;

      console.log(`\n🔍 Searching: "${query}"...`);
      const xml = await fetchURL(url);
      const items = parseRSS(xml);

      console.log(`  Found ${items.length} articles`);

      for (const item of items.slice(0, 5)) {
        const cleanedTitle = cleanTitle(item.title);

        if (seenTitles.has(cleanedTitle) || cleanedTitle.length < 20) {
          continue;
        }

        seenTitles.add(cleanedTitle);

        const source = extractSourceFromTitle(item.title);
        const category = categorizeArticle(cleanedTitle);

        console.log(`\n  📰 ${cleanedTitle.substring(0, 60)}...`);
        console.log(`     Category: ${category} | Source: ${source}`);

        let summary = await generateWithAI(cleanedTitle, category, source, 'summary');
        if (!summary) {
          summary = createSmartFallback(cleanedTitle, category, source, 'summary');
        }
        await new Promise(resolve => setTimeout(resolve, 1000));

        let content = await generateWithAI(cleanedTitle, category, source, 'content');
        if (!content) {
          content = createSmartFallback(cleanedTitle, category, source, 'content');
        }
        await new Promise(resolve => setTimeout(resolve, 1000));

        const imagePool = {
          'Diagnostics': [
            'https://images.pexels.com/photos/356040/pexels-photo-356040.jpeg',
            'https://images.pexels.com/photos/433267/pexels-photo-433267.jpeg'
          ],
          'Medical Imaging': [
            'https://images.pexels.com/photos/40568/medical-appointment-doctor-healthcare-40568.jpeg',
            'https://images.pexels.com/photos/236380/pexels-photo-236380.jpeg'
          ],
          'Surgery': [
            'https://images.pexels.com/photos/1250655/pexels-photo-1250655.jpeg',
            'https://images.pexels.com/photos/2324837/pexels-photo-2324837.jpeg'
          ],
          'Drug Discovery': [
            'https://images.pexels.com/photos/3683055/pexels-photo-3683055.jpeg',
            'https://images.pexels.com/photos/3825527/pexels-photo-3825527.jpeg'
          ],
          'Genomics': [
            'https://images.pexels.com/photos/3825527/pexels-photo-3825527.jpeg',
            'https://images.pexels.com/photos/3912979/pexels-photo-3912979.jpeg'
          ],
          'Patient Care': [
            'https://images.pexels.com/photos/40568/medical-appointment-doctor-healthcare-40568.jpeg',
            'https://images.pexels.com/photos/127873/pexels-photo-127873.jpeg'
          ],
          'Clinical Trials': [
            'https://images.pexels.com/photos/3683055/pexels-photo-3683055.jpeg',
            'https://images.pexels.com/photos/3825586/pexels-photo-3825586.jpeg'
          ],
          'Telemedicine': [
            'https://images.pexels.com/photos/4386467/pexels-photo-4386467.jpeg',
            'https://images.pexels.com/photos/5699456/pexels-photo-5699456.jpeg'
          ],
          'Research': [
            'https://images.pexels.com/photos/356040/pexels-photo-356040.jpeg',
            'https://images.pexels.com/photos/532803/pexels-photo-532803.jpeg'
          ]
        };

        const categoryImages = imagePool[category] || imagePool['Research'];
        const randomImage = categoryImages[Math.floor(Math.random() * categoryImages.length)];
        const imageUrl = item.imageUrl || randomImage;

        articles.push({
          title: cleanedTitle,
          summary,
          content,
          source: 'MedNewsAI Editorial Team',
          sourceUrl: item.link,
          originalSource: source,
          category,
          publishedAt: new Date(item.pubDate),
          imageUrl
        });

        if (articles.length >= 40) break;
      }

      if (articles.length >= 40) break;

      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`  ❌ Error: ${error.message}`);
    }
  }

  return articles;
}

async function saveToDatabase(articles) {
  console.log(`\n💾 Saving ${articles.length} articles to database...`);

  let saved = 0;
  let duplicates = 0;

  for (const article of articles) {
    try {
      const existing = await client.query(
        'SELECT id FROM medical_news WHERE source_url = $1',
        [article.sourceUrl]
      );

      if (existing.rows.length > 0) {
        duplicates++;
        continue;
      }

      await client.query(
        `INSERT INTO medical_news
        (title, summary, content, source, source_url, original_source, category, published_at, image_url)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          article.title,
          article.summary,
          article.content,
          article.source,
          article.sourceUrl,
          article.originalSource,
          article.category,
          article.publishedAt,
          article.imageUrl
        ]
      );

      saved++;
      console.log(`  ✓ [${article.category}] ${article.title.substring(0, 55)}...`);
    } catch (error) {
      console.error(`  ❌ Error saving article:`, error.message);
    }
  }

  console.log(`\n✅ Saved ${saved} new articles (${duplicates} duplicates skipped)`);

  const total = await client.query('SELECT COUNT(*) FROM medical_news');
  console.log(`📊 Total articles in database: ${total.rows[0].count}`);
}

async function main() {
  console.log('🚀 Starting Multi-AI Medical News Crawler\n');
  
  initializeProviders();

  await client.connect();
  console.log('✓ Connected to database\n');

  await client.query("DELETE FROM medical_news");
  console.log('✓ Cleared old articles\n');

  const articles = await crawlGoogleNews();

  if (articles.length > 0) {
    await saveToDatabase(articles);
  }

  await client.end();

  console.log('\n✅ Crawl complete!');
}

main().catch(console.error);
