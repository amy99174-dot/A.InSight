"""
A.InSight - 摄像头管理模块
"""

from picamera2 import Picamera2
from picamera2.previews.qt import QGlPicamera2
from PIL import Image
import io


class CameraManager:
    """摄像头管理器"""
    
    def __init__(self):
        self.camera = None
        self.preview_widget = None
        self.is_running = False
        
    def init_camera(self, resolution=(640, 480)):
        """初始化摄像头"""
        try:
            print(f"📷 初始化摄像头 ({resolution[0]}x{resolution[1]})...")
            
            self.camera = Picamera2()
            
            # 配置摄像头
            config = self.camera.create_preview_configuration(
                main={"size": resolution, "format": "XRGB8888"}
            )
            self.camera.configure(config)
            
            print("✅ 摄像头初始化成功")
            return True
            
        except Exception as e:
            print(f"❌ 摄像头初始化失败: {e}")
            return False
    
    def create_preview_widget(self, width=800, height=600):
        """创建预览窗口"""
        if not self.camera:
            print("❌ 摄像头未初始化")
            return None
        
        try:
            self.preview_widget = QGlPicamera2(
                self.camera,
                width=width,
                height=height,
                keep_ar=False  # 填充整个窗口
            )
            print("✅ 预览窗口创建成功")
            return self.preview_widget
            
        except Exception as e:
            print(f"❌ 预览窗口创建失败: {e}")
            return None
    
    def start(self):
        """启动摄像头"""
        if self.camera and not self.is_running:
            try:
                self.camera.start()
                self.is_running = True
                print("✅ 摄像头已启动")
                return True
            except Exception as e:
                print(f"❌ 摄像头启动失败: {e}")
                return False
        return False
    
    def stop(self):
        """停止摄像头"""
        if self.camera and self.is_running:
            try:
                self.camera.stop()
                self.is_running = False
                print("✅ 摄像头已停止")
                return True
            except Exception as e:
                print(f"❌ 摄像头停止失败: {e}")
                return False
        return False
    
    def capture_image(self) -> Image.Image:
        """拍照"""
        if not self.camera or not self.is_running:
            print("❌ 摄像头未运行")
            return None
        
        try:
            # 捕获图像数组
            array = self.camera.capture_array()
            
            # 转换为 PIL Image
            image = Image.fromarray(array)
            
            print("✅ 拍照成功")
            return image
            
        except Exception as e:
            print(f"❌ 拍照失败: {e}")
            return None
    
    def get_current_frame(self):
        """获取当前帧（用于软件渲染）"""
        if not self.camera or not self.is_running:
            return None
        
        try:
            # 捕获当前帧为numpy数组 (RGB格式)
            array = self.camera.capture_array("main")
            
            # 转换为RGB (如果是RGBA)
            if array.shape[2] == 4:
                import cv2
                array = cv2.cvtColor(array, cv2.COLOR_RGBA2RGB)
            
            return array
            
        except Exception as e:
            # 静默失败，避免日志噪音
            return None
    
    def cleanup(self):
        """清理资源"""
        self.stop()
        if self.camera:
            try:
                self.camera.close()
                print("✅ 摄像头资源已清理")
            except:
                pass
