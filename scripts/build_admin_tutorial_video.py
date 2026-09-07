from __future__ import annotations

import math
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path('/home/ubuntu/tuns-duty-app')
OUT = ROOT / 'video_assets'
OUT.mkdir(parents=True, exist_ok=True)
W, H = 720, 1280
FONT_BOLD = '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
FONT_MEDIUM = '/usr/share/fonts/opentype/noto/NotoSansCJK-Medium.ttc'
FONT_LIGHT = '/usr/share/fonts/opentype/noto/NotoSansCJKsc-Light.otf'

COLORS = {
    'navy': '#16324F',
    'blue': '#3B82F6',
    'green': '#4CAF50',
    'red': '#EF4444',
    'purple': '#6D5CE7',
    'ink': '#111827',
    'muted': '#667085',
    'bg': '#F4F7FB',
    'card': '#FFFFFF',
    'line': '#DDE5EE',
    'soft_green': '#E8F5E9',
    'soft_blue': '#EAF2FF',
    'soft_red': '#FEECEC',
}


def font(size: int, bold: bool = False):
    return ImageFont.truetype(FONT_BOLD if bold else FONT_MEDIUM, size)


def wrap_text(draw: ImageDraw.ImageDraw, text: str, fnt, max_width: int) -> list[str]:
    lines: list[str] = []
    current = ''
    for char in text:
        candidate = current + char
        if draw.textbbox((0, 0), candidate, font=fnt)[2] <= max_width or not current:
            current = candidate
        else:
            lines.append(current)
            current = char
    if current:
        lines.append(current)
    return lines


def draw_wrapped(draw, xy, text, fnt, fill, max_width, line_gap=8):
    x, y = xy
    lines = wrap_text(draw, text, fnt, max_width)
    line_h = fnt.size + line_gap
    for i, line in enumerate(lines):
        draw.text((x, y + i * line_h), line, font=fnt, fill=fill)
    return y + len(lines) * line_h


def rounded(draw, box, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def fit_image(src: Image.Image, box: tuple[int, int, int, int], radius=24):
    x1, y1, x2, y2 = box
    bw, bh = x2 - x1, y2 - y1
    im = src.convert('RGB')
    ratio = min(bw / im.width, bh / im.height)
    size = (max(1, int(im.width * ratio)), max(1, int(im.height * ratio)))
    im = im.resize(size, Image.Resampling.LANCZOS)
    layer = Image.new('RGB', (bw, bh), '#E5E7EB')
    layer.paste(im, ((bw - size[0]) // 2, (bh - size[1]) // 2))
    mask = Image.new('L', (bw, bh), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, bw, bh), radius=radius, fill=255)
    layer.putalpha(mask)
    return layer.convert('RGB')


def base(title: str, section: str, subtitle: str) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    im = Image.new('RGB', (W, H), COLORS['bg'])
    d = ImageDraw.Draw(im)
    d.rectangle((0, 0, W, 180), fill=COLORS['navy'])
    d.text((48, 32), 'TUNS DUTY REQUEST', font=font(22, True), fill='#BFD7EA')
    d.text((48, 72), title, font=font(38, True), fill='#FFFFFF')
    d.text((48, 132), section, font=font(20), fill='#DDEAF5')
    if subtitle:
        rounded(d, (42, 1090, 678, 1218), 24, '#FFFFFF', COLORS['line'], 2)
        d.text((66, 1114), subtitle, font=font(23, True), fill=COLORS['navy'])
    return im, d


def add_footer(d, text='Admin 操作教學'):
    d.text((48, 1243), text, font=font(16), fill=COLORS['muted'])


def screenshot(path: str) -> Image.Image:
    return Image.open(path).convert('RGB')


def make_scene_1():
    im, d = base('登入及身份確認', '01  開始使用', '先以 Admin Role 帳戶登入')
    rounded(d, (48, 218, 672, 988), 30, '#FFFFFF', COLORS['line'], 2)
    d.text((82, 260), 'Ward 8S', font=font(38, True), fill=COLORS['ink'])
    d.text((82, 316), 'TUNS Request Duty', font=font(25), fill=COLORS['muted'])
    d.text((82, 412), 'Hospital Email', font=font(19, True), fill=COLORS['ink'])
    rounded(d, (82, 450, 638, 516), 14, '#F6F7F9', COLORS['line'], 1)
    d.text((104, 470), 'admin@ha.org.hk', font=font(20), fill=COLORS['muted'])
    d.text((82, 568), 'Password', font=font(19, True), fill=COLORS['ink'])
    rounded(d, (82, 606, 638, 672), 14, '#F6F7F9', COLORS['line'], 1)
    d.text((104, 626), '••••••••', font=font(22), fill=COLORS['muted'])
    rounded(d, (82, 734, 638, 800), 14, COLORS['green'])
    d.text((284, 753), 'Login', font=font(22, True), fill='#FFFFFF')
    rounded(d, (82, 856, 638, 926), 14, COLORS['soft_blue'])
    d.text((108, 877), '登入後確認見到 Admin Approve 及 Settings', font=font(18, True), fill=COLORS['navy'])
    add_footer(d)
    return im


def make_scene_2():
    im, d = base('Admin Approve 導覽', '02  查看 Pending 申請', 'Pending＝等待管理員處理')
    src = screenshot('/home/ubuntu/upload/IMG_6942.PNG')
    card = fit_image(src, (52, 220, 668, 970), 28)
    im.paste(card, (52, 220))
    rounded(d, (78, 248, 642, 330), 16, COLORS['soft_blue'])
    d.text((104, 272), '先確認月份，再查看 Pending 清單', font=font(21, True), fill=COLORS['navy'])
    d.line((362, 350, 362, 962), fill=COLORS['blue'], width=5)
    d.ellipse((348, 470, 376, 498), fill=COLORS['blue'])
    d.ellipse((348, 730, 376, 758), fill=COLORS['blue'])
    add_footer(d)
    return im


def draw_pending_card(d, y, name, date, duty, color):
    rounded(d, (64, y, 656, y + 126), 18, '#FFFFFF', COLORS['line'], 2)
    d.ellipse((88, y + 26, 148, y + 86), fill='#D9E8F7')
    d.text((103, y + 40), 'CKF', font=font(15, True), fill=COLORS['navy'])
    d.text((170, y + 24), name, font=font(22, True), fill=COLORS['ink'])
    d.text((170, y + 64), date, font=font(17), fill=COLORS['muted'])
    rounded(d, (528, y + 40, 624, y + 86), 12, color)
    d.text((553, y + 51), duty, font=font(17, True), fill='#FFFFFF')


def make_scene_3():
    im, d = base('篩選及單項審批', '03  Approve／Reject', '先核對資料，再執行操作')
    rounded(d, (56, 220, 664, 300), 16, '#FFFFFF', COLORS['line'], 2)
    d.text((82, 244), 'Pending (4)', font=font(22, True), fill=COLORS['ink'])
    rounded(d, (324, 238, 494, 282), 10, COLORS['soft_blue'])
    d.text((348, 249), 'Filter  ⌄', font=font(17, True), fill=COLORS['navy'])
    rounded(d, (506, 238, 638, 282), 10, COLORS['blue'])
    d.text((540, 249), 'Batch', font=font(17, True), fill='#FFFFFF')
    draw_pending_card(d, 330, 'CHAN, KING FUNG', '31/8/2026', 'P', '#3B82F6')
    draw_pending_card(d, 478, 'FUNG, CHUN KIT', '1/9/2026', 'A', '#EF4444')
    rounded(d, (72, 640, 648, 790), 18, COLORS['soft_green'])
    d.text((98, 662), '核對四項資料', font=font(22, True), fill='#1F6B35')
    for i, label in enumerate(['員工姓名', '日期及 duty option', '工時', '是否重複安排']):
        d.text((104, 706 + i * 0), '• ' + label, font=font(18), fill='#245B32')
        if i < 3:
            d.text((104, 738 + i * 0), '', font=font(18), fill='#245B32')
    # Compact two-column reminder.
    d.text((104, 706), '• 員工姓名　　• 日期及 duty option', font=font(18), fill='#245B32')
    d.text((104, 742), '• 工時　　　　• 是否重複安排', font=font(18), fill='#245B32')
    rounded(d, (78, 842, 310, 930), 16, COLORS['green'])
    d.text((126, 870), '✓  Approve', font=font(22, True), fill='#FFFFFF')
    rounded(d, (410, 842, 642, 930), 16, COLORS['red'])
    d.text((454, 870), '✕  Reject', font=font(22, True), fill='#FFFFFF')
    add_footer(d)
    return im


def make_scene_4():
    im, d = base('Batch 批次處理', '04  一次處理多項申請', '批次操作只處理已選取項目')
    rounded(d, (56, 222, 664, 344), 18, '#FFFFFF', COLORS['line'], 2)
    d.text((84, 247), 'Batch mode', font=font(24, True), fill=COLORS['ink'])
    d.text((84, 292), '已選取 2 項申請', font=font(18), fill=COLORS['muted'])
    rounded(d, (512, 250, 636, 306), 12, '#E5E7EB')
    d.text((543, 267), '全選', font=font(17, True), fill=COLORS['ink'])
    for i, (name, date, duty, selected) in enumerate([
        ('CHAN, KING FUNG', '31/8/2026', 'P', True),
        ('FUNG, CHUN KIT', '1/9/2026', 'A', True),
        ('CHAN, TSZ FUNG', '2/9/2026', 'P', False),
    ]):
        y = 390 + i * 148
        fill = '#E8F5E9' if selected else '#FFFFFF'
        rounded(d, (56, y, 664, y + 122), 18, fill, COLORS['line'], 2)
        d.ellipse((84, y + 38, 124, y + 78), fill=COLORS['green'] if selected else '#D9E2EC')
        if selected:
            d.text((94, y + 43), '✓', font=font(22, True), fill='#FFFFFF')
        d.text((148, y + 24), name, font=font(20, True), fill=COLORS['ink'])
        d.text((148, y + 67), date + '  ·  ' + duty, font=font(17), fill=COLORS['muted'])
    rounded(d, (70, 894, 318, 974), 16, COLORS['red'])
    d.text((120, 918), 'Reject (2)', font=font(21, True), fill='#FFFFFF')
    rounded(d, (402, 894, 650, 974), 16, COLORS['green'])
    d.text((442, 918), 'Approve (2)', font=font(21, True), fill='#FFFFFF')
    add_footer(d)
    return im


def make_scene_5():
    im, d = base('Approved Duty 及週工時', '05  核對已批准排班', '點擊同事 row 查看該週工時')
    src = screenshot('/home/ubuntu/upload/IMG_9602.PNG')
    card = fit_image(src, (48, 214, 672, 1008), 28)
    im.paste(card, (48, 214))
    rounded(d, (74, 238, 645, 314), 16, COLORS['soft_green'])
    d.text((102, 260), 'Admin 可查看所有 User Role 已批准 duty', font=font(19, True), fill='#1F6B35')
    rounded(d, (70, 1028, 650, 1080), 12, '#FFF8DD')
    d.text((96, 1043), 'Sunday–Saturday：按所選日期所在週計算', font=font(18, True), fill='#745B00')
    add_footer(d)
    return im


def make_scene_6():
    im, d = base('代 User Role 同事申請', '06  Request Duty', 'Request for → 選擇同事 → Submit')
    rounded(d, (52, 220, 668, 1016), 28, '#FFFFFF', COLORS['line'], 2)
    d.text((82, 252), 'Request Duty', font=font(30, True), fill=COLORS['ink'])
    d.text((82, 330), 'Request for', font=font(19, True), fill=COLORS['ink'])
    rounded(d, (82, 368, 638, 434), 14, COLORS['soft_blue'])
    d.text((108, 388), 'CHAN, KING FUNG                       ⌄', font=font(18, True), fill=COLORS['navy'])
    d.text((82, 492), 'Select Date', font=font(19, True), fill=COLORS['ink'])
    rounded(d, (82, 530, 350, 594), 14, '#F6F7F9', COLORS['line'], 1)
    d.text((108, 550), 'Tomorrow', font=font(18), fill=COLORS['muted'])
    d.text((380, 492), 'Duty option', font=font(19, True), fill=COLORS['ink'])
    rounded(d, (380, 530, 638, 594), 14, '#F6F7F9', COLORS['line'], 1)
    d.text((410, 550), 'P  ·  7h', font=font(18), fill=COLORS['muted'])
    d.text((82, 654), 'Admin note (optional)', font=font(19, True), fill=COLORS['ink'])
    rounded(d, (82, 692, 638, 790), 14, '#F6F7F9', COLORS['line'], 1)
    d.text((108, 718), '臨時調更安排', font=font(18), fill=COLORS['muted'])
    rounded(d, (82, 854, 638, 924), 14, COLORS['green'])
    d.text((286, 876), 'Submit', font=font(22, True), fill='#FFFFFF')
    rounded(d, (78, 1040, 642, 1080), 12, COLORS['soft_green'])
    d.text((100, 1050), '提交後：通知＋Submitted by Admin', font=font(18, True), fill='#1F6B35')
    add_footer(d)
    return im


def make_scene_7():
    im, d = base('Settings 及 User Management', '07  管理系統資料', '完成 User Management 後按 Lock')
    sections = [
        ('Ward Name', 'Ward 8S', COLORS['soft_blue']),
        ('Duty Options', 'A  7h     P  7h     0900-1300  4h', '#F2ECFF'),
        ('User Management', 'Unlock  →  Master Password  →  + Add User', COLORS['soft_green']),
        ('Change Password', '更新個人登入密碼', '#FFF8DD'),
    ]
    for i, (title, detail, fill) in enumerate(sections):
        y = 236 + i * 176
        rounded(d, (56, y, 664, y + 142), 20, '#FFFFFF', COLORS['line'], 2)
        rounded(d, (76, y + 18, 258, y + 62), 12, fill)
        d.text((96, y + 29), title, font=font(19, True), fill=COLORS['navy'])
        d.text((82, y + 86), detail, font=font(17), fill=COLORS['ink'])
    rounded(d, (80, 976, 640, 1050), 16, COLORS['red'])
    d.text((205, 998), '完成後按 Lock', font=font(22, True), fill='#FFFFFF')
    add_footer(d)
    return im


def make_scene_8():
    im, d = base('匯出 XLSX Excel 報表', '08  Export Approved Duties', '先選月份或日期範圍，再匯出')
    rounded(d, (56, 222, 664, 980), 26, '#FFFFFF', COLORS['line'], 2)
    d.text((86, 256), 'Export Approved Duties', font=font(25, True), fill=COLORS['ink'])
    d.text((86, 338), 'Monthly Export', font=font(19, True), fill=COLORS['ink'])
    rounded(d, (86, 382, 634, 446), 14, COLORS['soft_blue'])
    d.text((112, 402), '◀        September 2026        ▶', font=font(18, True), fill=COLORS['navy'])
    rounded(d, (86, 484, 634, 554), 14, COLORS['green'])
    d.text((224, 504), 'Export Selected Month', font=font(19, True), fill='#FFFFFF')
    d.text((86, 640), 'Custom Date Range', font=font(19, True), fill=COLORS['ink'])
    rounded(d, (86, 684, 342, 744), 14, '#F6F7F9', COLORS['line'], 1)
    d.text((110, 703), 'Start date', font=font(17), fill=COLORS['muted'])
    rounded(d, (378, 684, 634, 744), 14, '#F6F7F9', COLORS['line'], 1)
    d.text((412, 703), 'End date', font=font(17), fill=COLORS['muted'])
    rounded(d, (86, 792, 634, 866), 14, COLORS['purple'])
    d.text((264, 815), 'Export as XLSX', font=font(21, True), fill='#FFFFFF')
    rounded(d, (80, 1016, 640, 1080), 14, '#FFF8DD')
    d.text((104, 1036), '明細＋員工期間合計工時＋全體總工時', font=font(18, True), fill='#745B00')
    add_footer(d)
    return im


def make_scene_9():
    im, d = base('完成工作前快速檢查', '09  安全及結語', '核對 → Lock → Logout')
    rounded(d, (56, 230, 664, 930), 28, '#FFFFFF', COLORS['line'], 2)
    d.text((88, 270), 'Admin 快速檢查表', font=font(28, True), fill=COLORS['ink'])
    checks = [
        '批准前核對員工、日期、duty 及工時',
        'Batch 前確認 Filter 及選取數量',
        '代為申請後確認通知及標示',
        '完成 User Management 後按 Lock',
        '匯出後檢查日期範圍及工時',
        '離開前按 Logout',
    ]
    for i, text in enumerate(checks):
        y = 360 + i * 78
        d.ellipse((92, y, 132, y + 40), fill=COLORS['green'])
        d.text((102, y + 3), '✓', font=font(25, True), fill='#FFFFFF')
        d.text((156, y + 3), text, font=font(20, True), fill=COLORS['ink'])
    rounded(d, (82, 1002, 638, 1080), 18, COLORS['navy'])
    d.text((220, 1027), '多謝觀看', font=font(25, True), fill='#FFFFFF')
    add_footer(d, 'TUNS Duty Request App')
    return im


def write_srt(scenes, duration: float):
    raw_weights = [len(s['voice']) for s in scenes]
    total = sum(raw_weights)
    starts = []
    cursor = 0.0
    for weight in raw_weights:
        starts.append(cursor)
        cursor += duration * weight / total
    def ts(seconds):
        millis = int(round((seconds - int(seconds)) * 1000))
        if millis == 1000:
            seconds = int(seconds) + 1
            millis = 0
        seconds = int(seconds)
        return f'{seconds // 3600:02d}:{(seconds % 3600) // 60:02d}:{seconds % 60:02d},{millis:03d}'
    out = []
    for i, scene in enumerate(scenes):
        start = starts[i]
        end = duration if i == len(scenes) - 1 else starts[i + 1]
        lines = wrap_text(ImageDraw.Draw(Image.new('RGB', (1,1))), scene['voice'], font(1), 500)
        # Keep subtitles to at most four readable lines while retaining the full narration.
        chunks = []
        current = ''
        for char in scene['voice']:
            if len(current) >= 22 and char in '，。；！？、 ':
                chunks.append(current)
                current = ''
            else:
                current += char
        if current:
            chunks.append(current)
        # Reflow into lines of about 22 characters.
        sub_lines = []
        for chunk in chunks:
            if not chunk:
                continue
            while len(chunk) > 22:
                sub_lines.append(chunk[:22])
                chunk = chunk[22:]
            if chunk:
                sub_lines.append(chunk)
        text = '\n'.join(sub_lines[:4])
        out.append(f'{i+1}\n{ts(start)} --> {ts(end)}\n{text}\n')
    (OUT / 'admin_tutorial.srt').write_text('\n'.join(out), encoding='utf-8')


def main():
    scenes = [
        {'title': '登入及身份確認', 'voice': '大家好，今條片會介紹 TUNS Duty Request App 管理員嘅完整操作流程，包括批准 duty、批次處理、代同事申請、管理用戶，同埋匯出 Excel 報表。首先，用 Admin Role 嘅 Hospital Email 登入，電郵地址必須以 @ha.org.hk 結尾。登入之後，請確認自己可以見到 Admin Approve、User Management 同埋匯出功能。'},
        {'title': 'Admin Approve 導覽', 'voice': '登入之後，先進入 Admin Approve。頁面上方係月份日曆，有標記嘅日期代表有相關申請；下方 Pending 清單就係所有等待處理嘅 duty request。系統會顯示員工、日期、duty option 同埋申請狀態。需要睇最新資料時，可以下拉重新整理。'},
        {'title': '篩選及單項審批', 'voice': '如果 Pending 申請比較多，可以喺 Pending 標題附近按 Filter，選擇 All pending，或者只睇某一位 User Role 同事。處理單項申請之前，請核對員工姓名、日期、duty option、工時，同埋有冇重複安排。確認無誤之後，按綠色嘅 Approve 批准；如果需要拒絕，就按紅色嘅 Reject。手機亦可以向右滑動顯示 Approve，向左滑動顯示 Reject。'},
        {'title': 'Batch 批次處理', 'voice': '如果要一次處理幾項申請，可以按 Batch 進入批次模式。之後逐項點擊要處理嘅 row，或者使用全選功能。請留意目前有冇套用同事 Filter，並確認選取數量。完成核對後，按 Approve 加數量，或者 Reject 加數量。系統會顯示處理進度；如果唔想繼續，可以按 Cancel 離開批次模式。'},
        {'title': 'Approved Duty 及週工時', 'voice': '批准完成之後，可以去 Approved Duty 檢查結果。你可以切換月份，睇日曆色點同埋下方清單；Admin 亦可以按 User Role 同事姓名篩選。點擊一位同事嘅 duty row，該 row 會變成淺綠色，頁面上方會顯示該申請日期所屬星期嘅總工時。計算範圍係由星期日到星期六，唔係固定計算今日所在嘅星期。'},
        {'title': '代 User Role 同事申請', 'voice': 'Admin 亦可以代 User Role 同事申請 duty。去 Request Duty，喺 Request for 選擇 Myself 或指定同事。揀咗同事之後，可以加入一段 Admin note，例如臨時調更原因。Admin 代申請最早可以揀翌日，最遠係八星期後。選擇日期同 duty option，核對五個申請 slot，然後按 Submit。提交成功後，被代申請嘅同事會收到 App 內通知，而 My Requests 亦會顯示 Submitted by Admin 同提交 Admin 姓名。'},
        {'title': 'Settings 及 User Management', 'voice': '喺 Settings，Admin 可以修改 Ward Name，亦可以管理 Duty Options。新增 duty option 時，輸入名稱、Working Hours 同顏色；刪除選項只會影響日後可選嘅班次，唔會刪除歷史記錄。User Management 預設係鎖定，按 Unlock 後輸入 Master Password，先可以睇到用戶清單。新增用戶時，填寫姓名、Staff Number、Hospital Email、初始密碼同 Role。刪除用戶會移除個人資料及登入帳戶，但過往 duty history 會保留；系統唔容許刪除自己。完成後記得按 Lock。'},
        {'title': '匯出 XLSX Excel 報表', 'voice': '最後係報表匯出。喺 Settings 嘅 Export Approved Duties，可以用 Monthly Export 選擇月份，再按 Export Selected Month；亦可以設定 Start date 同 End date，再按 Export as XLSX。報表會包括所選期間嘅 approved duty 明細、每位員工嘅期間合計工時，同埋全體總工時。匯出後請檢查日期範圍及資料，並按照機構要求安全保存。完成所有管理工作後，去 Settings 按 Logout 登出。'},
        {'title': '完成工作前快速檢查', 'voice': '總結一下，批准之前先核對申請內容；批次處理之前先確認篩選條件同選取數量；代為申請之後確認通知及 Submitted by Admin 標示；完成 User Management 後鎖定清單，最後登出。多謝觀看。'},
    ]
    makers = [make_scene_1, make_scene_2, make_scene_3, make_scene_4, make_scene_5, make_scene_6, make_scene_7, make_scene_8, make_scene_9]
    for idx, maker in enumerate(makers, start=1):
        maker().save(OUT / f'scene_{idx:02d}.png', quality=95)
    write_srt(scenes, 227.48)


if __name__ == '__main__':
    main()
