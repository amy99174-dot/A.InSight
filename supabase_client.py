"""
Supabase Client for A.InSight Native App
Handles database operations: logging history, loading config
"""

import threading
import os

try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = True
except ImportError:
    print("⚠️ supabase-py not installed. Run: pip3 install supabase")
    SUPABASE_AVAILABLE = False

# Supabase credentials (same as .env.local)
SUPABASE_URL = os.environ.get(
    'SUPABASE_URL',
    'https://sndfkyyvpvijigrpmgsu.supabase.co'
)
SUPABASE_KEY = os.environ.get(
    'SUPABASE_KEY',
    'sb_publishable_3kddcRnU1ZOrLAEs6bCpRg_YY5gD_UK'
)

# Singleton client
_client: 'Client | None' = None


def get_client() -> 'Client | None':
    """Get or create Supabase client singleton"""
    global _client
    if not SUPABASE_AVAILABLE:
        return None
    if _client is None:
        try:
            _client = create_client(SUPABASE_URL, SUPABASE_KEY)
            print(f"✅ Supabase connected: {SUPABASE_URL[:40]}...")
        except Exception as e:
            print(f"❌ Supabase connection failed: {e}")
            return None
    return _client


def log_history(result: dict, time_scale: int, history_scale: int, session_id: int = None):
    """
    Log analysis result to history_logs table (non-blocking).
    Matches the web app's insert schema in app/api/history/route.ts
    
    Args:
        result: The analysis_result dict from GeminiWorker
        time_scale: Current time scale setting (1-5)
        history_scale: Current history scale setting (1-3)
        session_id: Optional session identifier
    """
    def _insert():
        try:
            client = get_client()
            if not client:
                print("⚠️ Supabase not available, skipping log")
                return

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
            }

            response = client.table('history_logs').insert(insert_data).execute()
            print(f"✅ Supabase: History logged (artifact: {insert_data['artifact_name']})")
            
        except Exception as e:
            print(f"❌ Supabase log failed: {e}")

    # Run in background thread to avoid blocking UI
    thread = threading.Thread(target=_insert, daemon=True)
    thread.start()


def load_scenario_config() -> dict | None:
    """
    Load scenario_config from Supabase (for AI brain settings).
    Returns the config dict or None on failure.
    """
    try:
        client = get_client()
        if not client:
            return None
        
        response = client.table('scenario_config').select('config').eq('id', 1).single().execute()
        if response.data and response.data.get('config'):
            print("✅ Supabase: Loaded scenario config")
            return response.data['config']
    except Exception as e:
        print(f"⚠️ Supabase config load failed: {e}")
    
    return None
