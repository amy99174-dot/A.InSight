"""
Supabase Client for A.InSight Native App
Uses requests library (already available) to call Supabase REST API directly.
No additional pip install needed.
"""

import threading
import json
import os

import requests  # Already available on the Pi

# Supabase credentials (same as .env.local)
SUPABASE_URL = os.environ.get(
    'SUPABASE_URL',
    'https://sndfkyyvpvijigrpmgsu.supabase.co'
)
SUPABASE_KEY = os.environ.get(
    'SUPABASE_KEY',
    'sb_publishable_3kddcRnU1ZOrLAEs6bCpRg_YY5gD_UK'
)

# REST API base URL
REST_URL = f"{SUPABASE_URL}/rest/v1"

# Common headers for all Supabase requests
HEADERS = {
    'apikey': SUPABASE_KEY,
    'Authorization': f'Bearer {SUPABASE_KEY}',
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal'
}


def log_history(result: dict, time_scale: int, history_scale: int, 
                session_id: int = None, duration_seconds: int = None,
                completed: bool = False, interaction_count: int = 0):
    """
    Log analysis result to history_logs table (non-blocking).
    Matches the web app's insert schema in app/api/history/route.ts
    """
    def _insert():
        try:
            insert_data = {
                'session_id': session_id,
                'input_settings': {
                    'historyScale': history_scale,
                    'timeScale': time_scale
                },
                'ai_result': result,

                # Core fields
                'artifact_name': result.get('name', 'Unknown'),
                'era': result.get('era', 'Unknown'),
                'category': result.get('category', 'Other'),
                'summary': result.get('summary', ''),

                # Content fields
                'vision_prompt': result.get('visionPrompt', ''),
                'script_prompt': result.get('scriptPrompt', ''),
                'ambience_category': result.get('ambienceCategory', ''),
                'image_strength': result.get('imageStrength', None),
                
                # Analytics fields
                'duration_seconds': duration_seconds,
                'completed': completed,
                'interaction_count': interaction_count,
            }

            resp = requests.post(
                f"{REST_URL}/history_logs",
                headers=HEADERS,
                json=insert_data,
                timeout=10
            )

            if resp.status_code in [200, 201]:
                print(f"✅ Supabase: History logged (artifact: {insert_data['artifact_name']})")
            else:
                print(f"❌ Supabase write failed [{resp.status_code}]: {resp.text}")

        except Exception as e:
            print(f"❌ Supabase log error: {e}")

    # Run in background thread to avoid blocking UI
    thread = threading.Thread(target=_insert, daemon=True)
    thread.start()


def load_scenario_config():
    """
    Load scenario_config from Supabase (for AI brain settings).
    Returns the config dict or None on failure.
    """
    try:
        resp = requests.get(
            f"{REST_URL}/scenario_config",
            headers={**HEADERS, 'Prefer': ''},
            params={'id': 'eq.1', 'select': 'config'},
            timeout=5
        )

        if resp.status_code == 200:
            data = resp.json()
            if data and len(data) > 0 and data[0].get('config'):
                print("✅ Supabase: Loaded scenario config")
                return data[0]['config']
    except Exception as e:
        print(f"⚠️ Supabase config load failed: {e}")

    return None
