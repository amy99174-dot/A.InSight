"""
Gyroscope Controller for A.InSight Native App
Uses MPU6050 accelerometer to control image panning in REVEAL state
"""

from PyQt5.QtCore import QObject, QTimer, pyqtSignal
import sys


class GyroController(QObject):
    """Reads MPU6050 accelerometer data and emits pan offset signals"""
    
    # Signal: (delta_x, delta_y) for panning
    pan_update = pyqtSignal(float, float)
    
    def __init__(self, address=0x68, sensitivity=8.0, dead_zone=0.15, poll_ms=50):
        """
        Initialize Gyroscope Controller
        
        Args:
            address: I2C address of MPU6050 (default 0x68)
            sensitivity: Movement multiplier (higher = faster panning)
            dead_zone: Minimum tilt to register (prevents drift)
            poll_ms: Polling interval in milliseconds
        """
        super().__init__()

        self.sensitivity = sensitivity
        self.dead_zone = dead_zone
        self.sensor = None
        # Fixed zero offsets — device is permanently installed horizontally.
        # X and Y start near 0g when flat, so no runtime calibration needed.
        self.x_offset = 0.0
        self.y_offset = 0.0

        try:
            from mpu6050 import mpu6050
            self.sensor = mpu6050(address)

            # Start polling timer immediately (no calibration step)
            self.timer = QTimer(self)
            self.timer.timeout.connect(self._read_sensor)
            self.timer.start(poll_ms)

            print(f"🔄 GyroController initialized (addr=0x{address:02x}, sens={sensitivity}, fixed offsets)")

        except ImportError:
            print("⚠️ mpu6050 library not available, gyroscope disabled")
        except Exception as e:
            print(f"❌ Gyroscope init failed: {e}")

    def _calibrate(self):
        """Calibrate sensor by reading current position as zero.

        Physical axis layout (face-up, flat on bottom of device):
            X axis → left / right  (linear when tilting L/R  → dx)
            Y axis → front / back  (linear when tilting U/D  → dy) ← USE THIS
            Z axis → up / down     (starts at 1g when flat, cosθ change = WEAK, unused)

        Root cause of weak Z: flat sensor has Z=1g already.
        Small tilts change Z by cos(θ)-1 ≈ -θ²/2 (second order).
        Y changes by sin(θ) ≈ θ (first order, 10× stronger at 10°).
        """
        if not self.sensor:
            return
        try:
            accel = self.sensor.get_accel_data()
            self.x_offset = accel['x']  # horizontal zero  (X = left/right)
            self.y_offset = accel['y']  # vertical zero    (Y = front/back = pitch)
            print(f"✅ Gyro calibrated (X={self.x_offset:.2f}, Y={self.y_offset:.2f})")
        except Exception as e:
            print(f"⚠️ Gyro calibration failed: {e}")

    def _read_sensor(self):
        """Read sensor data and emit pan signal.

        Axis remap (face-up, flat install):
            dx (horizontal) ← accel['x']  (left/right tilt  = sinθ, linear)
            dy (vertical)   ← accel['y']  (forward/back tilt = sinθ, linear)

        NOTE: accel['z'] (up/down axis) is NOT used for vertical pan because
        it starts at 1g when flat, and changes only as cos(θ) for small tilts
        — extremely weak signal (~100× weaker than Y at small angles).
        """
        if not self.sensor:
            return
        try:
            accel = self.sensor.get_accel_data()

            x_tilt = accel['x'] - self.x_offset   # left/right
            y_tilt = accel['y'] - self.y_offset   # up/down tilt (pitch via Y)

            if abs(x_tilt) < self.dead_zone:
                x_tilt = 0
            if abs(y_tilt) < self.dead_zone:
                y_tilt = 0

            if x_tilt != 0 or y_tilt != 0:
                dx = -x_tilt * self.sensitivity
                dy = y_tilt * self.sensitivity
                self.pan_update.emit(dx, dy)

        except Exception:
            pass
    
    def set_active(self, active):
        """Enable/disable sensor polling (calibration only happens at startup)."""
        if not self.sensor:
            return
        if active:
            if not self.timer.isActive():
                self.timer.start()
                print("🔄 Gyro active")
        else:
            self.timer.stop()
    
    def cleanup(self):
        """Stop polling"""
        if hasattr(self, 'timer') and self.timer.isActive():
            self.timer.stop()
        print("🧹 Gyro cleanup completed")
