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

def wait_for_button_press(pin):
    """Block until the specified GPIO button is pressed, then return."""
    try:
        from gpiozero import Button
        btn = Button(pin, pull_up=True, bounce_time=0.1)
        
        # 1. Wait until user RELEASES the button first
        # This prevents immediate restart if user is still holding the button
        # after triggering the 5-second long-press shutdown in main.py.
        if btn.is_pressed:
            print("⏳ Button is currently held. Waiting for release...")
            btn.wait_for_release()
            
        print(f"⏳ Waiting for button press on GPIO {pin} to start A.InSight…")
        
        # 2. Wait for the actual press to restart
        btn.wait_for_press()
        print("✅ Button pressed! Starting...")
        
        time.sleep(0.5)  # slight debounce delay before launching main app
        btn.close()
        return True
    except Exception as e:
        print(f"⚠️  GPIO wait failed: {e}")
        return False

def main():
    while True:
        print("🚀 Launching A.InSight…")
        result = subprocess.run([sys.executable, MAIN_SCRIPT])
        exit_code = result.returncode
        print(f"\n⏻  main.py exited (code {exit_code})")

        # Clean exit (exit_code == 0) means normal long-press shutdown
        # Crash (exit_code != 0) will also wait for button press for safety, 
        # or we could make it auto-restart. Let's make it wait for button press
        # so it doesn't get stuck in a rapid crash loop.
        
        print("💤 App closed. Press confirm button to restart.")
        pressed = wait_for_button_press(CONFIRM_PIN)
        if not pressed:
            # Safety fallback if GPIO fails
            time.sleep(5)

if __name__ == "__main__":
    main()
