"""
Quick Supabase upload diagnostic — run on Pi: python3 test_supabase.py
"""
import requests

SUPABASE_URL = 'https://sndfkyyvpvijigrpmgsu.supabase.co'
SUPABASE_KEY = 'sb_publishable_3kddcRnU1ZOrLAEs6bCpRg_YY5gD_UK'
HEADERS = {
    'apikey': SUPABASE_KEY,
    'Authorization': f'Bearer {SUPABASE_KEY}',
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
}

# Test 1: null session_id
print("=== Test 1: null session_id ===")
data1 = {
    'session_id': None,
    'artifact_name': '__pi_test__',
    'era': '現代',
    'ai_result': {},
    'script_prompt': 'test',
}
resp = requests.post(f'{SUPABASE_URL}/rest/v1/history_logs', headers=HEADERS, json=data1, timeout=10)
print(f"Status: {resp.status_code}")
print(f"Response: {resp.text[:500]}")

# Test 2: string session_id (like what main.py sends)
print("\n=== Test 2: string session_id (a1b2c3d4) ===")
data2 = {
    'session_id': 'a1b2c3d4',
    'artifact_name': '__pi_test_2__',
    'era': '現代',
    'ai_result': {},
    'script_prompt': 'test',
}
resp2 = requests.post(f'{SUPABASE_URL}/rest/v1/history_logs', headers=HEADERS, json=data2, timeout=10)
print(f"Status: {resp2.status_code}")
print(f"Response: {resp2.text[:500]}")

print("\nDone. Check which test failed.")
