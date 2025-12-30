
const fs = require('fs');
const path = require('path');

const envPath = path.join(process.cwd(), '.env.local');

try {
    if (!fs.existsSync(envPath)) {
        console.log("ERROR: .env.local does not exist!");
        process.exit(1);
    }

    const content = fs.readFileSync(envPath, 'utf8');
    console.log("--- .env.local DEBUG REPORT ---");
    console.log(`File size: ${content.length} bytes`);

    // Check for specific keys
    const lines = content.split('\n');
    let urlFound = false;
    let keyFound = false;

    lines.forEach((line, index) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;

        if (trimmed.includes('NEXT_PUBLIC_SUPABASE_URL')) {
            console.log(`Line ${index + 1}: Found NEXT_PUBLIC_SUPABASE_URL`);
            if (trimmed.includes('=')) {
                const val = trimmed.split('=')[1].trim();
                console.log(`   -> Has value? ${val.length > 0 ? "YES" : "NO"} (Length: ${val.length})`);
                if (val.length > 10) urlFound = true;
            } else {
                console.log("   -> ERROR: No '=' sign found!");
            }
        }

        if (trimmed.includes('NEXT_PUBLIC_SUPABASE_ANON_KEY')) {
            console.log(`Line ${index + 1}: Found NEXT_PUBLIC_SUPABASE_ANON_KEY`);
            if (trimmed.includes('=')) {
                const val = trimmed.split('=')[1].trim();
                console.log(`   -> Has value? ${val.length > 0 ? "YES" : "NO"} (Length: ${val.length})`);
                if (val.length > 10) keyFound = true;
            } else {
                console.log("   -> ERROR: No '=' sign found!");
            }
        }
    });

    if (urlFound && keyFound) {
        console.log("SUCCESS: Both keys appear to be present and have values.");
    } else {
        console.log("FAILURE: One or more keys are missing or empty.");
    }

} catch (e) {
    console.error("Error reading file:", e);
}
