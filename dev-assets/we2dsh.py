"""we2dsh.py — Wallpaper Engine Workshop 壁纸 → dsh-wallpaper/1 转换工具。

用法:
  python we2dsh.py list              # 扫描并列出全部可转换壁纸（含编码检查）
  python we2dsh.py convert <ID>      # 在该壁纸目录就地生成 manifest.json
  python we2dsh.py convert <ID> ...  # 批量转换多个

说明:
- 只新增 manifest.json，不改动 WE 原有任何文件；
- Steam 校验 Workshop 时可能清掉外来文件，重跑 convert 即可恢复；
- 转换后在 DSH 背景面板"壁纸包"区输入该壁纸目录的完整路径导入
  （导入 = 复制整个目录到插件存储，大视频会占等量磁盘空间）。
"""
import json
import sys
from pathlib import Path

WORKSHOP = Path(r"D:\steam\steamapps\workshop\content\431960")
FORMAT = "dsh-wallpaper/1"
# 只允许纯数字的 Workshop ID 进入路径拼接（ID 来自命令行参数）。
ID_SAFE = str.isdigit


def read_project(wid: str) -> dict | None:
    if not ID_SAFE(wid):
        return None
    pj = WORKSHOP / wid / "project.json"
    if not pj.is_file():
        return None
    try:
        return json.loads(pj.read_text(encoding="utf-8-sig"))
    except Exception:
        return None


def mp4_codec(path: Path) -> str:
    """读 mp4 头部，返回视频编码标记（avc1=H.264 可播；hvc1/hev1=HEVC 不可播）。"""
    try:
        data = path.open("rb").read(8 * 1024 * 1024)
    except OSError:
        return "?"
    for tag in (b"hvc1", b"hev1", b"avc1", b"avc3", b"vp09", b"av01"):
        if tag in data:
            return tag.decode()
    return "?"


def classify(p: dict) -> str | None:
    t = str(p.get("type", "")).lower()
    return t if t in ("video", "web") else None


def list_all() -> None:
    rows = []
    for entry in sorted(WORKSHOP.iterdir(), key=lambda e: e.name):
        wid = entry.name
        p = read_project(wid)
        if not p:
            continue
        t = classify(p)
        if not t:
            continue
        rel = str(p.get("file", ""))
        full = WORKSHOP / wid / rel
        warn = ""
        if t == "video":
            if not full.is_file():
                warn = " [文件缺失]"
            else:
                codec = mp4_codec(full)
                if codec in ("hvc1", "hev1"):
                    warn = f" [警告 {codec}=HEVC，DSH 无法播放，需转码 H.264]"
                elif codec == "?":
                    warn = " [编码未知，导入后实测]"
        rows.append(f"{wid}  {t:<5}  {str(p.get('title', '?'))[:40]:<42} {rel}{warn}")
    print(f"可转换 {len(rows)} 个：\n")
    print("\n".join(rows))


def convert(wid: str) -> bool:
    p = read_project(wid)
    if not p:
        print(f"{wid}: 无 project.json（或 ID 非法）")
        return False
    t = classify(p)
    if not t:
        print(f"{wid}: 类型 {p.get('type')} 暂不支持（仅 video/web）")
        return False
    rel = str(p.get("file", ""))
    entry_file = WORKSHOP / wid / rel
    if not rel or not entry_file.is_file():
        print(f"{wid}: 入口文件缺失 {rel}")
        return False
    manifest = {
        "format": FORMAT,
        "name": str(p.get("title", wid)),
        "description": f"Imported from Wallpaper Engine workshop {wid}",
        "author": str(p.get("author") or "workshop"),
        "type": t,
        "entry": rel,
    }
    out = WORKSHOP / wid / "manifest.json"
    out.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"{wid}: OK")
    print(f"    DSH 面板导入路径: {WORKSHOP / wid}")
    return True


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    cmd = sys.argv[1]
    if cmd == "list":
        list_all()
        return 0
    if cmd == "convert":
        if len(sys.argv) < 3:
            print("用法: python we2dsh.py convert <ID> [ID...]")
            return 2
        ok = all(convert(w) for w in sys.argv[2:])
        return 0 if ok else 1
    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main())
