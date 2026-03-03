"""
GPIO Controller for A.InSight Native App
Handles physical button inputs and rotary encoder using gpiozero
"""

from gpiozero import Button, RotaryEncoder
from PyQt5.QtCore import QObject, pyqtSignal
import sys


class GPIOController(QObject):
    """Manages GPIO button inputs and rotary encoder, emits Qt signals"""
    
    # Qt signals for button events
    confirm_pressed = pyqtSignal()
    confirm_held = pyqtSignal()   # Long-press 5s → shutdown
    left_pressed = pyqtSignal()
    right_pressed = pyqtSignal()
    
    # Qt signals for rotary encoder
    encoder_rotated_cw = pyqtSignal()  # Clockwise
    encoder_rotated_ccw = pyqtSignal()  # Counter-clockwise
    
    def __init__(self, confirm_pin=4, left_pin=26, right_pin=17,
                 encoder_a=20, encoder_b=27):
        """
        Initialize GPIO Controller

        Pin assignments (Physical → BCM):
            confirm_pin : GPIO17  → Pin 11
            left_pin    : GPIO4   → Pin 7  (was Pin 35/GPIO19, freed for I2S LRC)
            right_pin   : GPIO26  → Pin 37
            encoder_a   : GPIO20  → Pin 38
            encoder_b   : GPIO27  → Pin 13 (was Pin 40/GPIO21, freed for I2S DIN)

        MAX98357A I2S audio (do NOT use these as GPIO):
            BCK  → GPIO18 / Pin 12
            LRC  → GPIO19 / Pin 35
            DIN  → GPIO21 / Pin 40
        """
        super().__init__()
        
        try:
            # Confirm button: short press + 5s long press
            self.confirm_btn = Button(confirm_pin, bounce_time=0.3, hold_time=5)
            self.confirm_btn.when_pressed = self._on_confirm_press
            self.confirm_btn.when_held   = self._on_confirm_held
            self.left_btn = Button(left_pin, bounce_time=0.2)
            self.right_btn = Button(right_pin, bounce_time=0.2)
            
            # Connect button events to handlers
            self.confirm_btn.when_pressed = self._on_confirm_press
            self.left_btn.when_pressed = self._on_left_press
            self.right_btn.when_pressed = self._on_right_press
            
            print(f"🎮 GPIO Controller initialized:")
            print(f"   Confirm: GPIO {confirm_pin}")
            print(f"   Left:    GPIO {left_pin}")
            print(f"   Right:   GPIO {right_pin}")
            
            # Initialize rotary encoder
            try:
                self.encoder = RotaryEncoder(
                    a=encoder_a,
                    b=encoder_b,
                    wrap=False,
                    max_steps=100
                )
                self.encoder.when_rotated = self._on_encoder_rotated
                self._last_encoder_value = self.encoder.value
                print(f"   Encoder: GPIO {encoder_a}/{encoder_b}")
                
            except Exception as e:
                print(f"⚠️ Encoder init failed: {e}")
                self.encoder = None
            
        except Exception as e:
            print(f"❌ GPIO initialization failed: {e}")
            print("   Running without GPIO support")
            self.confirm_btn = None
            self.left_btn = None
            self.right_btn = None
            self.encoder = None
    
    def _on_confirm_press(self):
        """Short press: normal confirm"""
        print("🔘 Confirm button pressed")
        self.confirm_pressed.emit()

    def _on_confirm_held(self):
        """Long press 5s: shutdown signal"""
        print("⏳ Confirm button held 5s → shutdown")
        self.confirm_held.emit()
    
    def _on_left_press(self):
        """Handle left button press"""
        print("⬅️ Left button pressed")
        self.left_pressed.emit()
    
    def _on_right_press(self):
        """Handle right button press"""
        print("➡️ Right button pressed")
        self.right_pressed.emit()
    
    def _on_encoder_rotated(self):
        """Handle rotary encoder rotation"""
        if not self.encoder:
            return
        
        current_value = self.encoder.value
        
        # Detect direction
        if current_value > self._last_encoder_value:
            # Clockwise rotation
            print(f"🔄 Encoder CW: {current_value}")
            self.encoder_rotated_cw.emit()
        elif current_value < self._last_encoder_value:
            # Counter-clockwise rotation
            print(f"🔄 Encoder CCW: {current_value}")
            self.encoder_rotated_ccw.emit()
        
        self._last_encoder_value = current_value
    
    def cleanup(self):
        """Clean up GPIO resources"""
        try:
            if self.confirm_btn:
                self.confirm_btn.close()
            if self.left_btn:
                self.left_btn.close()
            if self.right_btn:
                self.right_btn.close()
            if self.encoder:
                self.encoder.close()
            print("🧹 GPIO cleanup completed")
        except Exception as e:
            print(f"⚠️ GPIO cleanup warning: {e}")
