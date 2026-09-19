--!nonstrict
local failures = 0
local function check(ok, label, detail)
	if ok then
		print(`  ok   {label}`)
	else
		failures += 1
		print(`  FAIL {label}{if detail then "  <- " .. tostring(detail) else ""}`)
	end
end

local notifications = {}
local rebirthPrompted = nil

print("== 월드 생성 ==")
local world = World.build()
Net.build()
PlotService.build(world, function(_, message)
	table.insert(notifications, message)
end, function(_, price)
	rebirthPrompted = price
end)
Economy.start()

local plot1 = world:FindFirstChild("Plot1")
check(plot1 ~= nil, "Plot1 이 만들어졌다")
check(#partsUnder(world) > 60, `월드 파트 {#partsUnder(world)}개`)
check(workspace:FindFirstChild("Baseplate") == nil, "Studio 기본 Baseplate 제거")

local function padOf(id)
	return plot1:FindFirstChild(`Pad_{id}`)
end
local claimPad = plot1:FindFirstChild("ClaimPad")
local rebirthPad = plot1:FindFirstChild("RebirthPad")
local intake = plot1:FindFirstChild("Intake")
local built = plot1:FindFirstChild("Built")
local drops = plot1:FindFirstChild("Drops")

print("")
print("== 입장과 클레임 ==")
local player, root = makePlayer("테스터", 1234)
Economy.onJoin(player)
check(player:FindFirstChild("leaderstats") ~= nil, "leaderstats 생성")
check(player:GetAttribute("Persist") == false, "DataStore 실패를 Persist=false 로 알림")
check(claimPad.CanTouch == true, "빈 공장은 클레임 패드가 켜져 있다")

claimPad.Touched:Fire(root)
local handle = PlotService.forPlayer(player)
check(handle ~= nil and handle.getOwner() == player, "클레임 패드를 밟아 주인이 됐다")
check(player:GetAttribute("HasPlot") == true, "HasPlot 속성")
check(claimPad.CanTouch == false, "차지한 뒤 클레임 패드는 꺼진다")
check(#built:GetChildren() > 0, "기본 드로퍼가 공짜로 지어졌다")
check(padOf("dropper_2").CanTouch == true, "첫 구매 패드가 열렸다")
check(padOf("belt_1").CanTouch == false, "선행 조건이 없는 패드는 잠겨 있다")

print("")
print("== 수입 ==")
-- 물리가 없으니 낙하물을 직접 금고에 넣어준다.
local delivered = 0
local function runSeconds(seconds)
	for _ = 1, math.floor(seconds / 0.1) do
		step(1, 0.1)
		for _, drop in drops:GetChildren() do
			intake.Touched:Fire(drop)
			delivered += 1
		end
	end
end

runSeconds(10)
local earned = Economy.cash(player)
check(delivered > 0, `낙하물 {delivered}개가 금고에 도착`)
check(earned >= 40 and earned <= 60, `10초에 {earned}원 (기본 드로퍼 5/초 기대)`, earned)

print("")
print("== 구매 사슬 ==")
Economy.addCash(player, 2000000)
for _, entry in Config.Purchases do
	local pad = padOf(entry.id)
	check(pad.CanTouch == true, `{entry.name} 패드가 순서대로 열린다`)
	step(6, 0.1) -- 디바운스 해제
	pad.Touched:Fire(root)
	if not Economy.owns(player, entry.id) then
		check(false, `{entry.name} 구매`, "소유로 안 넘어감")
		break
	end
end
check(Economy.owns(player, "vault"), "마지막 항목까지 구매 완료")
check(padOf("dropper_2").CanTouch == false, "산 패드는 사라진다")
check(math.abs(Economy.multiplier(player) - 4.6046) < 0.001, `구매 배수 {Economy.multiplier(player)} (1.3*1.1*1.4*1.15*2 기대)`)

print("")
print("== 배치 (전부 지어진 상태) ==")
local function box(part)
	local p, size = part.CFrame.Position, part.Size
	return {
		name = part.Name,
		minX = p.X - size.X / 2, maxX = p.X + size.X / 2,
		minY = p.Y - size.Y / 2, maxY = p.Y + size.Y / 2,
		minZ = p.Z - size.Z / 2, maxZ = p.Z + size.Z / 2,
	}
end

local function overlaps(a, b)
	local eps = 0.01
	return a.minX < b.maxX - eps and b.minX < a.maxX - eps
		and a.minY < b.maxY - eps and b.minY < a.maxY - eps
		and a.minZ < b.maxZ - eps and b.minZ < a.maxZ - eps
end

local floorPart = plot1:FindFirstChild("Floor")
local floorBox = box(floorPart)

-- 밟는 패드끼리 겹치면 한 번에 두 개가 눌리거나 z-fighting 이 난다.
local padBoxes = {}
for _, part in partsUnder(plot1) do
	local name = part.Name
	if name == "ClaimPad" or name == "RebirthPad" or string.sub(name, 1, 4) == "Pad_" then
		table.insert(padBoxes, box(part))
	end
end
check(#padBoxes == #Config.Purchases + 2, `밟는 패드 {#padBoxes}개`)

local padClashes = {}
for i = 1, #padBoxes do
	for j = i + 1, #padBoxes do
		if overlaps(padBoxes[i], padBoxes[j]) then
			table.insert(padClashes, `{padBoxes[i].name} x {padBoxes[j].name}`)
		end
	end
end
check(#padClashes == 0, "패드끼리 겹치지 않는다", table.concat(padClashes, ", "))

-- 바닥 밖으로 삐져나온 구조물 찾기
local outside = {}
for _, part in partsUnder(plot1) do
	if part.Parent ~= drops then
		local b = box(part)
		if b.minX < floorBox.minX - 0.01 or b.maxX > floorBox.maxX + 0.01
			or b.minZ < floorBox.minZ - 0.01 or b.maxZ > floorBox.maxZ + 0.01 then
			table.insert(outside, `{b.name}`)
		end
	end
end
check(#outside == 0, "모든 구조물이 바닥 안에 있다", table.concat(outside, ", "))

-- 낙하물이 실제로 벨트 위로 떨어지는지 (x,z 가 벨트 범위 안인지)
local beltBox = box(plot1:FindFirstChild("Belt"))
local offBelt = {}
for _, spec in { Config.StarterDropper, table.unpack(Config.Purchases) } do
	if spec.slot and (spec.value or spec.dropValue) then
		local x = floorBox.minX + (floorBox.maxX - floorBox.minX) / 2 + Config.Layout.DropperSlotsX[spec.slot]
		if x < beltBox.minX or x > beltBox.maxX then
			table.insert(offBelt, spec.name)
		end
	end
end
check(#offBelt == 0, "모든 드로퍼가 벨트 위에 있다", table.concat(offBelt, ", "))

-- 1번 드로퍼가 흡입구 안에서 생성되면 벨트를 안 타고 즉시 먹힌다
local intakeBox = box(intake)
local nearestX = floorBox.minX + (floorBox.maxX - floorBox.minX) / 2 + Config.Layout.DropperSlotsX[1]
check(nearestX < intakeBox.minX - 1,
	`제일 가까운 드로퍼(x={nearestX})가 흡입구(x>={intakeBox.minX}) 밖에 있다`)

print("")
print("== 환생 ==")
check(Economy.rebirthUnlocked(player), "전부 사면 환생이 열린다")
check(rebirthPad.CanTouch == true, "환생 패드가 켜진다")
step(6, 0.1)
rebirthPad.Touched:Fire(root)
check(rebirthPrompted ~= nil, `환생 확인창 요청 (비용 {tostring(rebirthPrompted)})`)

Economy.addCash(player, Economy.rebirthPrice(player))
check(Economy.rebirth(player), "환생 실행")
handle.rebuild()
check(Economy.rebirths(player) == 1, "환생 횟수 1")
check(Economy.multiplier(player) == 2, `환생 후 배수 {Economy.multiplier(player)}`)
check(not Economy.owns(player, "vault"), "구매 내역 초기화")
check(padOf("dropper_2").CanTouch == true, "처음 패드가 다시 열린다")

local beforeRebirthCash = Economy.cash(player)
runSeconds(10)
local afterRebirth = Economy.cash(player) - beforeRebirthCash
check(afterRebirth >= 80 and afterRebirth <= 120, `환생 후 10초에 {afterRebirth}원 (2배 기대)`, afterRebirth)

print("")
print("== 퇴장 ==")
local threadsBefore = liveThreads()
PlotService.release(player)
removePlayer(player)
check(handle.getOwner() == nil, "플롯이 비었다")
check(#built:GetChildren() == 0, "산 물건이 철거됐다")
check(#drops:GetChildren() == 0, "남은 낙하물이 정리됐다")
check(claimPad.CanTouch == true, "클레임 패드가 다시 켜진다")
step(20, 0.1)
check(liveThreads() <= threadsBefore, `공장 루프가 종료됐다 ({threadsBefore} -> {liveThreads()})`)

print("")
print("== 재사용 ==")
local player2, root2 = makePlayer("두번째", 5678)
Economy.onJoin(player2)
claimPad.Touched:Fire(root2)
check(handle.getOwner() == player2, "다른 플레이어가 같은 공장을 차지한다")
runSeconds(5)
check(Economy.cash(player2) > 0, `새 주인이 수입을 받는다 ({Economy.cash(player2)}원)`)

print("")
print("== 한 사람 한 칸 ==")
local plot2 = world:FindFirstChild("Plot2")
plot2:FindFirstChild("ClaimPad").Touched:Fire(root2)
check(plot2:FindFirstChild("ClaimPad").CanTouch == true, "이미 가진 사람은 두 번째 공장을 못 가진다")

print("")
print("== 종료 저장 ==")
local ok = pcall(function()
	Economy.flushAll(1)
end)
check(ok, "DataStore 가 죽어 있어도 종료 저장이 예외를 안 낸다")

print("")
print(`== 경고 {#WARNINGS}건 ==`)
for _, message in WARNINGS do
	print(`  {message}`)
end

print("")
print(if failures == 0 then "모든 검사 통과" else `실패 {failures}건`)
print(`RESULT {failures}`)
