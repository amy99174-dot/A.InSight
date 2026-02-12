#!/usr/bin/env python3
"""
Test script for AudioManager
Tests OpenAI TTS API and pygame audio playback
"""

from audio_manager import AudioManager
import os
import sys

print("🧪 AudioManager Test Script")
print("=" * 50)

# Get OpenAI API Key
openai_key = os.environ.get("OPENAI_KEY")
if not openai_key:
    print("❌ OPENAI_KEY environment variable not set")
    print("   Usage: OPENAI_KEY=sk-xxx python3 test_audio.py")
    sys.exit(1)

print(f"✅ API Key loaded: {openai_key[:10]}...{openai_key[-4:]}")

# Initialize AudioManager
try:
    manager = AudioManager(openai_key)
    print("✅ AudioManager initialized")
except Exception as e:
    print(f"❌ Failed to initialize AudioManager: {e}")
    sys.exit(1)

# Test text (Traditional Chinese)
test_text = """
這件文物來自清代，具有重要的歷史價值。
它不僅展現了當時的工藝水平，也反映了那個時代的文化特色。
透過這件文物，我們可以一窺古人的生活樣貌。
"""

print(f"\n🎙️ Test Text:\n{test_text}")
print("\n" + "=" * 50)
print("▶️ Generating and playing audio...")
print("   (This may take 2-3 seconds)")
print("=" * 50 + "\n")

# Generate and play
success = manager.generate_and_play_audio(test_text)

if success:
    print("✅ Audio generation successful")
    print("🔊 Audio is playing...")
    print("   Press Ctrl+C to stop\n")
    
    # Wait for playback to finish
    try:
        import time
        while manager.is_playing():
            time.sleep(0.1)
        print("\n✅ Playback completed")
    except KeyboardInterrupt:
        print("\n⏹️ Interrupted by user")
else:
    print("❌ Audio generation failed")
    sys.exit(1)

# Cleanup
manager.cleanup()
print("🧹 Cleanup completed")
print("\n" + "=" * 50)
print("✅ Test passed!")
