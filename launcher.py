#!/usr/bin/env python3
"""
A.InSight Launcher
==================
Starts main.py, and after it exits waits for a button press to restart it.

Usage:
    python3 launcher.py        (inside run_with_compositor.sh)
"""
import subprocess
import sys
import time

MAIN_SCRIPT = "/home/yeeeecheeeen/A.InSight/main.py"
CONFIRM_PIN = 4   # GPIO4 → Pin 7 (current confirm button)

def wait_for_button_press(pin, timeout=None):
    """Block until the specified GPIO button is pressed, then return."""
    try:
        from gpiozero import Button as GZButton
        btn = GZButton(pin, bounce_time=0.3)
        print(f"⏳ Waiting for button press on GPIO{pin} to restart…")
        start = time.time()
        while True:
            if btn.is_pressed:
                btn.close()
                return True
            if timeout and (time.time() - start) > timeout:
                btn.close()
                return False
            time.sleep(0.05)
    except Exception as e:
        print(f"⚠️  GPIO wait failed: {e}")
        return False

def main():
    while True:
        print("🚀 Launching A.InSight…")
        result = subprocess.run([sys.executable, MAIN_SCRIPT])
        exit_code = result.returncode
        print(f"\n⏻  main.py exited (code {exit_code})")

        # If crashed unexpectedly (not clean exit), restart immediately
        if exit_code != 0:
            print("⚠️  Crash detected — restarting in 3s…")
            time.sleep(3)
            continue

        # Clean exit (long-press shutdown) → wait for button press to restart
        print("💤 App closed. Press confirm button to restart.")
        pressed = wait_for_button_press(CONFIRM_PIN)
        if pressed:
            print("✅ Button pressed — restarting…")
            time.sleep(0.5)
        else:
            # Safety fallback: just restart if something goes wrong
            time.sleep(5)

if __name__ == "__main__":
    main()
