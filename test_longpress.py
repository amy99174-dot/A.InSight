#!/usr/bin/env python3
"""
長按按鈕測試腳本
測試 GPIO4 (Pin 7) 確認鍵的長按感應
按住 5 秒 → 印出成功訊息
按 Ctrl+C 結束
"""
import time
from gpiozero import Button

CONFIRM_PIN = 4   # GPIO4 → Pin 7

print("=" * 45)
print("  長按按鈕測試 (GPIO4 / Pin 7)")
print("=" * 45)
print("  短按 → 短按偵測")
print("  長按 5 秒 → 長按偵測")  
print("  Ctrl+C → 結束")
print("=" * 45 + "\n")

btn = Button(CONFIRM_PIN, bounce_time=0.05, hold_time=5)

press_time = None

def on_press():
    global press_time
    press_time = time.time()
    print("🔽 按下...")

def on_release():
    global press_time
    if press_time:
        duration = time.time() - press_time
        if duration < 5:
            print(f"🔼 放開（{duration:.1f}s 短按）")
        press_time = None

def on_held():
    print("✅ 長按 5 秒偵測成功！ → 可以執行關機")

btn.when_pressed  = on_press
btn.when_released = on_release
btn.when_held     = on_held

try:
    while True:
        time.sleep(0.1)
except KeyboardInterrupt:
    print("\n👋 測試結束")
    btn.close()
