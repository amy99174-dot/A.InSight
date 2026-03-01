#!/usr/bin/env python3
"""
GPIO Button & Encoder Test Script
===================================
Pin assignments (BCM → Physical):
    Confirm button : GPIO17 → Pin 11
    Left button    : GPIO4  → Pin 7
    Right button   : GPIO26 → Pin 37
    Encoder A(CLK) : GPIO20 → Pin 38
    Encoder B(DT)  : GPIO27 → Pin 13

Usage:
    python3 test_gpio.py
Press Ctrl+C to exit.
"""

import time
from gpiozero import Button, RotaryEncoder

# ── Pin definitions ────────────────────────────────────────────────────────
CONFIRM_PIN = 17   # Pin 11
LEFT_PIN    = 4    # Pin 7  (was Pin 35)
RIGHT_PIN   = 26   # Pin 37
ENCODER_A   = 20   # Pin 38
ENCODER_B   = 27   # Pin 13 (was Pin 40)

print("=" * 45)
print("  GPIO Button & Encoder Test")
print("=" * 45)
print(f"  Confirm : GPIO{CONFIRM_PIN} (Pin 11)")
print(f"  Left    : GPIO{LEFT_PIN}  (Pin 7)")
print(f"  Right   : GPIO{RIGHT_PIN} (Pin 37)")
print(f"  Encoder : GPIO{ENCODER_A}/{ENCODER_B} (Pin 38/13)")
print("=" * 45)
print("  Press buttons or turn encoder...")
print("  Ctrl+C to exit\n")

# ── Button setup ──────────────────────────────────────────────────────────
try:
    confirm = Button(CONFIRM_PIN, bounce_time=0.3)
    left    = Button(LEFT_PIN,    bounce_time=0.2)
    right   = Button(RIGHT_PIN,   bounce_time=0.2)
    print(f"✅ Buttons initialized")
except Exception as e:
    print(f"❌ Button init failed: {e}")
    confirm = left = right = None

# ── Encoder setup ─────────────────────────────────────────────────────────
try:
    encoder = RotaryEncoder(a=ENCODER_A, b=ENCODER_B, wrap=False, max_steps=100)
    last_val = encoder.value
    print(f"✅ Encoder initialized")
except Exception as e:
    print(f"❌ Encoder init failed: {e}")
    encoder = None
    last_val = 0

print()

# ── Callbacks ────────────────────────────────────────────────────────────
if confirm:
    confirm.when_pressed = lambda: print("🔘 CONFIRM button pressed  (GPIO17 / Pin 11)")
if left:
    left.when_pressed    = lambda: print("⬅️  LEFT button pressed     (GPIO4  / Pin 7)")
if right:
    right.when_pressed   = lambda: print("➡️  RIGHT button pressed    (GPIO26 / Pin 37)")

# ── Main loop (encoder polling) ──────────────────────────────────────────
try:
    while True:
        if encoder:
            val = encoder.value
            if val > last_val:
                print(f"🔄 Encoder CW  ↑  (value: {val})")
            elif val < last_val:
                print(f"🔄 Encoder CCW ↓  (value: {val})")
            last_val = val
        time.sleep(0.05)

except KeyboardInterrupt:
    print("\n\n👋 Test ended.")
finally:
    for dev in [confirm, left, right, encoder]:
        if dev:
            try: dev.close()
            except: pass
    print("🧹 GPIO cleaned up.")
