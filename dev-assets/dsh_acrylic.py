"""给 DeepSeek Harness 桌面版窗口挂 Win11 亚克力效果（外部注入，不改应用）。

用法:
  python dsh_acrylic.py on [AABBGGRR]   # 挂亚克力(默认着色 01000000)
  python dsh_acrylic.py off             # 恢复默认
"""
import ctypes
import sys
from ctypes import wintypes

ACCENT_DISABLED = 0
ACCENT_ENABLE_ACRYLICBLURBEHIND = 4
WCA_ACCENT_POLICY = 19


class ACCENT_POLICY(ctypes.Structure):
    _fields_ = [
        ("AccentState", ctypes.c_uint),
        ("AccentFlags", ctypes.c_uint),
        ("GradientColor", ctypes.c_uint),
        ("AnimationId", ctypes.c_uint),
    ]


class WINDOWCOMPOSITIONATTRIBDATA(ctypes.Structure):
    _fields_ = [
        ("Attribute", ctypes.c_int),
        ("Data", ctypes.c_void_p),
        ("SizeOfData", ctypes.c_int),
    ]


def find_dsh_window():
    user32 = ctypes.windll.user32
    result = []

    def callback(hwnd, _):
        if user32.IsWindowVisible(hwnd):
            buf = ctypes.create_unicode_buffer(256)
            user32.GetWindowTextW(hwnd, buf, 256)
            if buf.value == "DeepSeek Harness":
                result.append(hwnd)
        return True

    WNDENUMPROC = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
    user32.EnumWindows(WNDENUMPROC(callback), 0)
    return result[0] if result else None


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "on"
    if mode not in ("on", "off"):
        print("usage: python dsh_acrylic.py on [AABBGGRR] | off")
        return 2
    hwnd = find_dsh_window()
    if not hwnd:
        print("DeepSeek Harness window not found (is the desktop app running?)")
        return 1
    if mode == "on":
        color = int(sys.argv[2], 16) if len(sys.argv) > 2 else 0x01000000
        policy = ACCENT_POLICY(ACCENT_ENABLE_ACRYLICBLURBEHIND, 0, color, 0)
    else:
        policy = ACCENT_POLICY(ACCENT_DISABLED, 0, 0, 0)
    data = WINDOWCOMPOSITIONATTRIBDATA(
        WCA_ACCENT_POLICY,
        ctypes.cast(ctypes.byref(policy), ctypes.c_void_p),
        ctypes.sizeof(policy),
    )
    ok = ctypes.windll.user32.SetWindowCompositionAttribute(hwnd, ctypes.byref(data))
    print("applied" if ok else "call failed", f"hwnd={hex(hwnd)} mode={mode}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
