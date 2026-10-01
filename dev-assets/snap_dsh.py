"""截图 DeepSeek Harness 桌面版窗口客户区（仅该窗口区域），用于验证亚克力效果。

用法: python snap_dsh.py 输出.png
"""
import ctypes
import sys
from ctypes import wintypes
from PIL import ImageGrab

user32 = ctypes.windll.user32


def find_dsh_window():
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
    out = sys.argv[1] if len(sys.argv) > 1 else "dsh_snap.png"
    hwnd = find_dsh_window()
    if not hwnd:
        print("window not found")
        return 1
    rect = wintypes.RECT()
    user32.GetWindowRect(hwnd, ctypes.byref(rect))
    # DWM 扩展边框下 GetWindowRect 可能偏大，用 DwmGetWindowAttribute 拿真实框
    try:
        box = wintypes.RECT()
        ctypes.windll.dwmapi.DwmGetWindowAttribute(
            hwnd, 9, ctypes.byref(box), ctypes.sizeof(box)
        )
        rect = box
    except Exception:
        pass
    img = ImageGrab.grab(
        bbox=(rect.left, rect.top, rect.right, rect.bottom), all_screens=True
    )
    img.save(out)
    print(f"saved {out} {img.size}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
