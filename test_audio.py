#!/usr/bin/env python3
"""
MAX98357A I2S Amplifier Test Script
====================================
Hardware connections (BCM pin → Physical pin):
    BCK  (Bit Clock)  : GPIO18 → Pin 12  [auto by I2S]
    LRC  (LR Clock)   : GPIO19 → Pin 35
    DIN  (Data In)    : GPIO21 → Pin 40
    VIN               : 5V     → Pin 4
    GND               : GND    → Pin 14

Prerequisites on Pi:
    1. Add to /boot/firmware/config.txt (or /boot/config.txt):
           dtoverlay=hifiberry-dac
       Then reboot.
    2. Install: sudo apt install python3-sounddevice python3-numpy
       or:       pip3 install sounddevice numpy

Usage:
    python3 test_audio.py               # 440Hz tone test
    python3 test_audio.py --list        # list audio devices
    python3 test_audio.py --freq 880    # custom frequency
    python3 test_audio.py --speaker     # use speaker-test (ALSA, no Python deps)
    python3 test_audio.py --temp        # temperature monitor only
"""

import sys
import subprocess
import time

def list_devices():
    try:
        import sounddevice as sd
        print("\n🔊 Available audio devices:")
        print(sd.query_devices())
    except ImportError:
        print("⚠️  sounddevice not installed. Trying ALSA...")
        subprocess.run(["aplay", "-l"], check=False)

def speaker_test_alsa(duration=3):
    print("🔊 Running ALSA speaker-test (1kHz sine, 3 seconds)...")
    print("   If you hear a tone → MAX98357A is working! ✅")
    try:
        subprocess.run(
            ["speaker-test", "-t", "sine", "-f", "1000",
             "-D", "hw:0,0", "-l", "1", "-s", "1"],
            timeout=duration + 2
        )
    except FileNotFoundError:
        print("❌ speaker-test not found. Install: sudo apt install alsa-utils")
    except subprocess.TimeoutExpired:
        print("✅ speaker-test completed.")

def play_sine_tone(freq=440, duration=2.0, volume=0.5):
    try:
        import numpy as np
        import sounddevice as sd
    except ImportError:
        print("❌ sounddevice/numpy not installed.")
        print("   Run: pip3 install sounddevice numpy")
        print("   Or use: python3 test_audio.py --speaker")
        return False

    sample_rate = 44100
    t = np.linspace(0, duration, int(sample_rate * duration), endpoint=False)
    wave = (np.sin(2 * np.pi * freq * t) * volume).astype(np.float32)
    stereo = np.column_stack([wave, wave])

    print(f"🎵 Playing {freq}Hz sine tone for {duration}s...")
    print("   ► Hear a tone → MAX98357A working ✅")
    print("   ► Silent → check dtoverlay or wiring\n")
    try:
        sd.play(stereo, samplerate=sample_rate)
        sd.wait()
        print("✅ Tone playback complete.")
        return True
    except Exception as e:
        print(f"❌ Playback error: {e}")
        print("\n📋 Troubleshooting:")
        print("   1. /boot/firmware/config.txt → add: dtoverlay=hifiberry-dac")
        print("   2. sudo reboot")
        print("   3. python3 test_audio.py --list  (see devices)")
        print("   4. python3 test_audio.py --speaker  (ALSA direct)")
        return False

def check_i2s_overlay():
    print("\n🔍 I2S overlay status:")
    r = subprocess.run(["dtoverlay", "-l"], capture_output=True, text=True)
    if r.returncode == 0:
        if "hifiberry" in r.stdout or "i2s" in r.stdout.lower():
            print(f"  ✅ Active: {r.stdout.strip()}")
        else:
            print("  ⚠️  No I2S overlay! Add to /boot/firmware/config.txt:")
            print("         dtoverlay=hifiberry-dac")
            print("      Then: sudo reboot")
    r2 = subprocess.run(["cat", "/proc/asound/cards"], capture_output=True, text=True)
    if r2.returncode == 0:
        print(f"\n🎛️  ALSA cards:\n{r2.stdout.strip()}")

def temperature_monitor(interval=2, count=5):
    print(f"\n🌡️  CPU Temperature ({count}x, {interval}s interval)")
    print("─" * 40)
    for i in range(count):
        r = subprocess.run(["vcgencmd", "measure_temp"], capture_output=True, text=True)
        if r.returncode == 0:
            print(f"  [{i+1}/{count}] {r.stdout.strip()}")
        else:
            try:
                with open("/sys/class/thermal/thermal_zone0/temp") as f:
                    print(f"  [{i+1}/{count}] {int(f.read().strip())/1000:.1f}°C")
            except Exception:
                print(f"  [{i+1}/{count}] ❌ Cannot read temperature")
        if i < count - 1:
            time.sleep(interval)
    print("─" * 40)

# ── Main ──────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    freq = 440

    if "--list" in sys.argv:
        list_devices(); sys.exit(0)
    if "--speaker" in sys.argv:
        check_i2s_overlay(); speaker_test_alsa(); sys.exit(0)
    if "--temp" in sys.argv:
        temperature_monitor(); sys.exit(0)
    if "--freq" in sys.argv:
        idx = sys.argv.index("--freq")
        try: freq = int(sys.argv[idx + 1])
        except (IndexError, ValueError): print("⚠️  --freq needs a number")

    print("=" * 50)
    print("  MAX98357A I2S Amplifier — Audio Test")
    print("=" * 50)
    check_i2s_overlay()
    print()
    play_sine_tone(freq=freq, duration=2.0, volume=0.5)
    print()
    temperature_monitor(interval=1, count=3)
