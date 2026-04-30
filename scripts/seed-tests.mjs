import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const testsDir = path.join(process.cwd(), 'data', 'tests');
const files = fs.readdirSync(testsDir).filter((f) => f.endsWith('.json'));

for (const file of files) {
  const raw = fs.readFileSync(path.join(testsDir, file), 'utf-8');
  const test = JSON.parse(raw);
  const priceRub = Number(
    test?.price_rub ?? test?.pricing?.take_rub ?? test?.pricing?.interpretation_rub ?? 99
  );
  const row = {
    slug: test.slug,
    title: test.title,
    description: test.description || null,
    type: test.type,
    json: test,
    price_rub: priceRub,
    is_published: true,
  };
  const { error } = await supabase.from('tests').upsert(row, { onConflict: 'slug' });
  if (error) {
    console.error(`Failed to seed ${file}:`, error.message);
    process.exit(1);
  }
  console.log(`Seeded ${row.slug}`);
}

console.log('All tests seeded successfully.');
