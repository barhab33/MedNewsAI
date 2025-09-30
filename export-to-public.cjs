const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const client = new Client({
  host: 'db.qhyrfjletazbsjsfosdl.supabase.co',
  port: 5432,
  user: 'postgres',
  password: '8ZKt+2D2_2s4fyE',
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
});

async function exportData() {
  try {
    await client.connect();
    console.log('✓ Connected to database');

    const result = await client.query(
      'SELECT * FROM medical_news ORDER BY published_at DESC LIMIT 50'
    );

    console.log(`✓ Found ${result.rows.length} articles`);

    const publicDir = path.join(__dirname, 'public');
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    const filePath = path.join(publicDir, 'news-data.json');
    fs.writeFileSync(filePath, JSON.stringify(result.rows, null, 2));

    console.log(`✓ Exported to ${filePath}`);

    await client.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

exportData();
