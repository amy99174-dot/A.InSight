
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Read .env.local manually
const envPath = path.resolve(__dirname, '../.env.local');
let supabaseUrl = '';
let supabaseKey = '';

try {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
        if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) {
            supabaseUrl = line.split('=')[1].replace(/"/g, '').trim();
        }
        if (line.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) {
            supabaseKey = line.split('=')[1].replace(/"/g, '').trim();
        }
    });
} catch (e) {
    console.error("Could not read .env.local", e);
    process.exit(1);
}

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env.local");
    process.exit(1);
}

console.log("Connecting to Supabase at:", supabaseUrl);
const supabase = createClient(supabaseUrl, supabaseKey);

async function init() {
    // 2. Read scenarios.json
    const configPath = path.resolve(__dirname, '../scenarios.json');
    let config = {};
    try {
        config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        console.log("Read local scenarios.json successfully.");
    } catch (e) {
        console.error("Could not read scenarios.json", e);
        process.exit(1);
    }

    // 3. Check if table exists (by trying to select)
    const { data, error } = await supabase.from('scenario_config').select('*').limit(1);

    if (error) {
        // Table likely doesn't exist
        console.error("\n[ERROR] Table 'scenario_config' does not exist or is not accessible.");
        console.log("\nPlease go to the Supabase SQL Editor and run the following SQL to create the table:\n");
        console.log(`
CREATE TABLE IF NOT EXISTS scenario_config (
    id SERIAL PRIMARY KEY,
    config JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

INSERT INTO scenario_config (id, config)
VALUES (1, '${JSON.stringify(config)}')
ON CONFLICT (id) DO UPDATE
SET config = EXCLUDED.config;

ALTER TABLE scenario_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON scenario_config FOR SELECT USING (true);
CREATE POLICY "Allow public update access" ON scenario_config FOR UPDATE USING (true);
CREATE POLICY "Allow public insert access" ON scenario_config FOR INSERT WITH CHECK (true);
        `);
    } else {
        console.log("Table 'scenario_config' exists.");

        // 4. Upsert Data
        console.log("Updating configuration in database...");
        const { error: upsertError } = await supabase
            .from('scenario_config')
            .upsert({ id: 1, config: config });

        if (upsertError) {
            console.error("Failed to update config:", upsertError);
        } else {
            console.log("✅ Configuration successfully synced to Supabase!");
        }
    }
}

init();
