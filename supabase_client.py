"""
Supabase Client for A.InSight Native App
Routes through the Mac's Next.js /api/log endpoint to avoid direct external HTTPS from Pi.
"""

import threading
import os
import requests

# API host (same as ConfigManager - Mac's local IP)
API_HOST = os.environ.get('API_HOST', '10.130.205.184')
LOG_URL = f"http://{API_HOST}:3000/api/log"


def log_history(result: dict, time_scale: int, history_scale: int,
                session_id=None, duration_seconds: int = None,
                completed: bool = False, interaction_count: int = 0):
    """
    Log analysis result via Mac's /api/log proxy (non-blocking).
    The Mac then writes to Supabase, avoiding direct external HTTPS from Pi.
    """
    def _insert():
        try:
            # Strip large binary fields to keep payload small
            log_result = {k: v for k, v in result.items() if k != 'generated_image'}

            payload = {
                'result': log_result,
                'session_id': None,  # FK constraint: only valid session IDs allowed; null is safe
                'time_scale': time_scale,
                'history_scale': history_scale,
            }
            resp = requests.post(LOG_URL, json=payload, timeout=10)

            if resp.status_code == 200:
                print(f"✅ Supabase: History logged via proxy (artifact: {result.get('name', '?')})")
            else:
                print(f"❌ Supabase proxy error [{resp.status_code}]: {resp.text[:200]}")

        except Exception as e:
            print(f"❌ Supabase log error: {e}")

    thread = threading.Thread(target=_insert, daemon=True)
    thread.start()


def load_scenario_config():
    """
    Load scenario_config from Supabase via Mac's /api/config endpoint.
    """
    try:
        resp = requests.get(
            f"http://{API_HOST}:3000/api/config",
            timeout=5
        )
        if resp.status_code == 200:
            data = resp.json()
            print("✅ Config loaded via proxy")
            return data
    except Exception as e:
        print(f"⚠️ Config load failed: {e}")
    return None
