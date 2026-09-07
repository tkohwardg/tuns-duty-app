from pathlib import Path

root = Path('/home/ubuntu/tuns-duty-app')
out = root / 'video_assets'
weights = [
    len('大家好，今條片會介紹 TUNS Duty Request App 管理員嘅完整操作流程，包括批准 duty、批次處理、代同事申請、管理用戶，同埋匯出 Excel 報表。首先，用 Admin Role 嘅 Hospital Email 登入，電郵地址必須以 @ha.org.hk 結尾。登入之後，請確認自己可以見到 Admin Approve、User Management 同埋匯出功能。'),
    len('登入之後，先進入 Admin Approve。頁面上方係月份日曆，有標記嘅日期代表有相關申請；下方 Pending 清單就係所有等待處理嘅 duty request。系統會顯示員工、日期、duty option 同埋申請狀態。需要睇最新資料時，可以下拉重新整理。'),
    len('如果 Pending 申請比較多，可以喺 Pending 標題附近按 Filter，選擇 All pending，或者只睇某一位 User Role 同事。處理單項申請之前，請核對員工姓名、日期、duty option、工時，同埋有冇重複安排。確認無誤之後，按綠色嘅 Approve 批准；如果需要拒絕，就按紅色嘅 Reject。手機亦可以向右滑動顯示 Approve，向左滑動顯示 Reject。'),
    len('如果要一次處理幾項申請，可以按 Batch 進入批次模式。之後逐項點擊要處理嘅 row，或者使用全選功能。請留意目前有冇套用同事 Filter，並確認選取數量。完成核對後，按 Approve 加數量，或者 Reject 加數量。系統會顯示處理進度；如果唔想繼續，可以按 Cancel 離開批次模式。'),
    len('批准完成之後，可以去 Approved Duty 檢查結果。你可以切換月份，睇日曆色點同埋下方清單；Admin 亦可以按 User Role 同事姓名篩選。點擊一位同事嘅 duty row，該 row 會變成淺綠色，頁面上方會顯示該申請日期所屬星期嘅總工時。計算範圍係由星期日到星期六，唔係固定計算今日所在嘅星期。'),
    len('Admin 亦可以代 User Role 同事申請 duty。去 Request Duty，喺 Request for 選擇 Myself 或指定同事。揀咗同事之後，可以加入一段 Admin note，例如臨時調更原因。Admin 代申請最早可以揀翌日，最遠係八星期後。選擇日期同 duty option，核對五個申請 slot，然後按 Submit。提交成功後，被代申請嘅同事會收到 App 內通知，而 My Requests 亦會顯示 Submitted by Admin 同提交 Admin 姓名。'),
    len('喺 Settings，Admin 可以修改 Ward Name，亦可以管理 Duty Options。新增 duty option 時，輸入名稱、Working Hours 同顏色；刪除選項只會影響日後可選嘅班次，唔會刪除歷史記錄。User Management 預設係鎖定，按 Unlock 後輸入 Master Password，先可以睇到用戶清單。新增用戶時，填寫姓名、Staff Number、Hospital Email、初始密碼同 Role。刪除用戶會移除個人資料及登入帳戶，但過往 duty history 會保留；系統唔容許刪除自己。完成後記得按 Lock。'),
    len('最後係報表匯出。喺 Settings 嘅 Export Approved Duties，可以用 Monthly Export 選擇月份，再按 Export Selected Month；亦可以設定 Start date 同 End date，再按 Export as XLSX。報表會包括所選期間嘅 approved duty 明細、每位員工嘅期間合計工時，同埋全體總工時。匯出後請檢查日期範圍及資料，並按照機構要求安全保存。完成所有管理工作後，去 Settings 按 Logout 登出。'),
    len('總結一下，批准之前先核對申請內容；批次處理之前先確認篩選條件同選取數量；代為申請之後確認通知及 Submitted by Admin 標示；完成 User Management 後鎖定清單，最後登出。多謝觀看。'),
]
total = sum(weights)
duration = 227.48
concat = out / 'scenes.concat.txt'
lines = []
for i, weight in enumerate(weights, start=1):
    lines.append(f"file '{(out / f'scene_{i:02d}.png').as_posix()}'")
    lines.append(f'duration {duration * weight / total:.6f}')
# Repeat the last file line as required by ffmpeg concat demuxer.
lines.append(f"file '{(out / 'scene_09.png').as_posix()}'")
concat.write_text('\n'.join(lines) + '\n', encoding='utf-8')
print(concat)
