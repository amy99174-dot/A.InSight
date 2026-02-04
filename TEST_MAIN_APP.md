# 测试主应用

## 在树莓派上测试

```bash
# SSH 到树莓派
ssh yeeeecheeeen@antigravity17.local

# 切换到项目目录
cd ~/A.InSight

# 拉取最新代码
git pull

# 运行主应用
export DISPLAY=:0
python3 main.py
```

## 预期效果

1. **全屏显示** - 黑色背景
2. **圆形扫描界面** - 紫色圆圈，扫描线旋转
3. **状态自动转换**：
   - BOOT（3秒）→ PROXIMITY
   - 点击 → LOCKED
   - 点击 → TUNING
   - 点击 → ANALYZING（2秒）→ FOCUSING
   - 点击 → LISTEN（5秒）→ REVEAL
   - 点击 → 重新开始

## 操作说明

- **鼠标点击** - 进入下一状态
- **空格键** - 进入下一状态
- **R 键** - 重置到初始状态
- **ESC** - 退出应用

## 性能预期

- **FPS**: 应保持 60 FPS（动画流畅）
- **响应**: 即时（<50ms）
- **CPU占用**: 应低于原型版本

## 如果遇到问题

### 问题 1：ImportError: No module named 'OpenGL'
```bash
sudo apt install python3-opengl
```

### 问题 2：显示器连接错误
```bash
export DISPLAY=:0
xhost +local:
python3 main.py
```

### 问题 3：通过 VNC 测试
连接 VNC → 打开终端 → 运行 `python3 main.py`
