# A.InSight Native - 原型测试指南

## 📦 安装依赖（树莓派上执行）

```bash
# 更新系统
sudo apt update

# 安装 PyQt5 和 OpenGL
sudo apt install -y python3-pyqt5 python3-pyqt5.qtopengl python3-opengl

# 安装 picamera2
sudo apt install -y python3-picamera2

# 验证安装
python3 -c "from PyQt5.QtWidgets import QApplication; print('✅ PyQt5 OK')"
python3 -c "from picamera2 import Picamera2; print('✅ picamera2 OK')"
```

## 🚀 运行原型

```bash
# 在树莓派上执行
cd /path/to/A.InSight
python3 prototype.py
```

## 🧪 测试项目

### 1. FPS 测试
- 观察屏幕左上角的 FPS 显示
- **绿色 (≥25fps)**: 性能优秀 ✅
- **黄色 (15-25fps)**: 性能可接受 ⚠️  
- **红色 (<15fps)**: 性能不足 ❌

### 2. 响应时间测试
- 按**空格键**
- 观察终端输出的响应时间
- **<100ms**: 优秀 ✅
- **100-200ms**: 可接受 ⚠️
- **>200ms**: 太慢 ❌

### 3. GPU 加速验证
- 检查启动日志
- 应该看到 "✅ 摄像头 GPU 加速成功启动！"

## 📊 预期结果

### 成功标准
- FPS: **≥ 25**
- 响应时间: **< 100ms**
- 摄像头显示: **流畅，无卡顿**
- 内存占用: **< 200MB**

### 如何检查内存占用
```bash
# 另开一个 SSH 终端
ps aux | grep python3 | grep prototype
# 查看 RSS 列（单位 KB）
```

## ❓ 问题排查

### 问题 1：ImportError: No module named 'PyQt5'
```bash
sudo apt install python3-pyqt5
```

### 问题 2：摄像头无法打开
```bash
# 检查摄像头
libcamera-hello
# 如果正常，检查权限
groups | grep video
```

### 问题 3：黑屏无显示
```bash
# 确保X服务器运行
export DISPLAY=:0
python3 prototype.py
```

## ✅ 测试完成后

**如果性能达标（FPS ≥ 25, 响应 < 100ms）:**
→ 继续开发完整应用 ✅

**如果性能不达标:**
→ 调整技术方案或硬件 ⚠️

按 **ESC** 键退出测试。
