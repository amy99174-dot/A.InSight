"""
GPIO Controller for A.InSight Native App
Handles physical button inputs using gpiozero
"""

from gpiozero import Button
from PyQt5.QtCore import QObject, pyqtSignal
import sys


class GPIOController(QObject):
    """Manages GPIO button inputs and emits Qt signals"""
    
    # Qt signals for button events
    confirm_pressed = pyqtSignal()
    left_pressed = pyqtSignal()
    right_pressed = pyqtSignal()
    
    def __init__(self, confirm_pin=5, left_pin=6, right_pin=13):
        """
        Initialize GPIO Controller
        
        Args:
            confirm_pin: GPIO pin for confirm button
            left_pin: GPIO pin for left button
            right_pin: GPIO pin for right button
        """
        super().__init__()
        
        try:
            # Create button objects (default pull-up configuration)
            self.confirm_btn = Button(confirm_pin)
            self.left_btn = Button(left_pin)
            self.right_btn = Button(right_pin)
            
            # Connect button events to handlers
            self.confirm_btn.when_pressed = self._on_confirm_press
            self.left_btn.when_pressed = self._on_left_press
            self.right_btn.when_pressed = self._on_right_press
            
            print(f"🎮 GPIO Controller initialized:")
            print(f"   Confirm: GPIO {confirm_pin}")
            print(f"   Left:    GPIO {left_pin}")
            print(f"   Right:   GPIO {right_pin}")
            
        except Exception as e:
            print(f"❌ GPIO initialization failed: {e}")
            print("   Running without GPIO support")
            self.confirm_btn = None
            self.left_btn = None
            self.right_btn = None
    
    def _on_confirm_press(self):
        """Handle confirm button press"""
        print("🔘 Confirm button pressed")
        self.confirm_pressed.emit()
    
    def _on_left_press(self):
        """Handle left button press"""
        print("⬅️ Left button pressed")
        self.left_pressed.emit()
    
    def _on_right_press(self):
        """Handle right button press"""
        print("➡️ Right button pressed")
        self.right_pressed.emit()
    
    def cleanup(self):
        """Clean up GPIO resources"""
        try:
            if self.confirm_btn:
                self.confirm_btn.close()
            if self.left_btn:
                self.left_btn.close()
            if self.right_btn:
                self.right_btn.close()
            print("🧹 GPIO cleanup completed")
        except Exception as e:
            print(f"⚠️ GPIO cleanup warning: {e}")
