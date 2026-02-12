#!/bin/bash
# MPU6050 设置脚本 - 启用I2C并安装依赖

echo "🔧 MPU6050 陀螺仪设置"
echo "======================================"

# 1. 启用 I2C 接口
echo "1️⃣ 启用 I2C 接口..."
sudo raspi-config nonint do_i2c 0  # 0 = enable
echo "✅ I2C 已启用"

# 2. 安装 I2C 工具
echo ""
echo "2️⃣ 安装 I2C 工具..."
sudo apt-get update -qq
sudo apt-get install -y i2c-tools python3-smbus
echo "✅ I2C 工具已安装"

# 3. 安装 mpu6050 Python 库
echo ""
echo "3️⃣ 安装 mpu6050 库..."
sudo pip3 install --break-system-packages mpu6050-raspberrypi
echo "✅ mpu6050 库已安装"

echo ""
echo "======================================"
echo "⚠️  需要重启以启用 I2C 接口"
echo "======================================"
echo ""
echo "请运行以下命令重启:"
echo "  sudo reboot"
echo ""
echo "重启后，运行以下命令检查设备:"
echo "  i2cdetect -y 1"
echo ""
echo "如果看到 '68'，说明 MPU6050 已连接成功！"
