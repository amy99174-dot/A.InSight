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
    left_pressed = pyqtSignal()
    right_pressed = pyqtSignal()
    
    # Qt signals for rotary encoder
    encoder_rotated_cw = pyqtSignal()  # Clockwise
    encoder_rotated_ccw = pyqtSignal()  # Counter-clockwise
    
    def __init__(self, confirm_pin=17, left_pin=19, right_pin=26, 
                 encoder_a=20, encoder_b=21):
        """
        Initialize GPIO Controller
        
        Args:
            confirm_pin: GPIO pin for confirm button
            left_pin: GPIO pin for left button
            right_pin: GPIO pin for right button
            encoder_a: GPIO pin for rotary encoder A (CLK)
            encoder_b: GPIO pin for rotary encoder B (DT)
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
