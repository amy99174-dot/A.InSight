"""
A.InSight - 状态管理系统
"""

from enum import Enum
from typing import Optional, Callable
from PyQt5.QtCore import QObject, pyqtSignal


class AppState(Enum):
    """应用状态枚举"""
    BOOT = "boot"           # 启动检测
    PROXIMITY = "proximity" # 接近检测
    LOCKED = "locked"       # 锁定目标
    TUNING = "tuning"       # 调整参数
    ANALYZING = "analyzing" # 拍照中
    FOCUSING = "focusing"   # 对焦调整
    LISTEN = "listen"       # AI 分析中
    REVEAL = "reveal"       # 显示结果


class StateMachine(QObject):
    """状态机"""
    
    # 状态变化信号
    state_changed = pyqtSignal(AppState, AppState)  # (old_state, new_state)
    
    def __init__(self):
        super().__init__()
        self.current_state = AppState.BOOT
        self._state_data = {}  # 存储每个状态的数据
        
        # 定义状态转换规则
        self.transitions = {
            AppState.BOOT: AppState.PROXIMITY,
            AppState.PROXIMITY: AppState.LOCKED,
            AppState.LOCKED: AppState.TUNING,
            AppState.TUNING: AppState.ANALYZING,
            AppState.ANALYZING: AppState.FOCUSING,
            AppState.FOCUSING: AppState.LISTEN,
            AppState.LISTEN: AppState.REVEAL,
            # REVEAL 可以回到 BOOT 重新开始
            AppState.REVEAL: AppState.BOOT,
        }
    
    @property
    def state(self) -> AppState:
        """获取当前状态"""
        return self.current_state
    
    def next(self) -> bool:
        """转换到下一个状态"""
        if self.current_state in self.transitions:
            old_state = self.current_state
            self.current_state = self.transitions[self.current_state]
            self.state_changed.emit(old_state, self.current_state)
            print(f"状态转换: {old_state.value} → {self.current_state.value}")
            return True
        return False
    
    def set_state(self, state: AppState):
        """直接设置状态"""
        if state != self.current_state:
            old_state = self.current_state
            self.current_state = state
            self.state_changed.emit(old_state, self.current_state)
            print(f"状态设置: {old_state.value} → {self.current_state.value}")
    
    def set_data(self, key: str, value):
        """存储状态数据"""
        self._state_data[key] = value
    
    def get_data(self, key: str, default=None):
        """获取状态数据"""
        return self._state_data.get(key, default)
    
    def reset(self):
        """重置到初始状态"""
        self.set_state(AppState.BOOT)
        self._state_data.clear()
