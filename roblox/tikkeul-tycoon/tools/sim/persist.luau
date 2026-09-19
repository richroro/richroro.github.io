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

DATASTORE_OK = true

local world = World.build()
Net.build()
PlotService.build(world, function() end, function() end)
Economy.start()

local plot1 = world:FindFirstChild("Plot1")
local claimPad = plot1:FindFirstChild("ClaimPad")
local intake = plot1:FindFirstChild("Intake")
local built = plot1:FindFirstChild("Built")
local drops = plot1:FindFirstChild("Drops")

local function runSeconds(seconds, deliver)
	for _ = 1, math.floor(seconds / 0.1) do
		step(1, 0.1)
		if deliver then
			for _, drop in drops:GetChildren() do
				intake.Touched:Fire(drop)
			end
		end
	end
end

print("== 1회차 접속 ==")
local player, root = makePlayer("저장테스터", 9001)
Economy.onJoin(player)
check(player:GetAttribute("Persist") == true, "DataStore 가 살아 있으면 Persist=true")
claimPad.Touched:Fire(root)

Economy.addCash(player, 50000)
for _, id in { "dropper_2", "belt_1", "dropper_3" } do
	step(6, 0.1)
	plot1:FindFirstChild(`Pad_{id}`).Touched:Fire(root)
end
check(Economy.owns(player, "dropper_3"), "세 개 구매")
local cashBefore = Economy.cash(player)
local droppersBefore = #built:GetChildren()

print("")
print("== 끼인 낙하물 회수 ==")
-- 물리가 멈춰서 금고에 못 닿는 상황. Lifetime 이 지나면 자동 정산돼야 한다.
local stuckStart = Economy.cash(player)
runSeconds(Config.Belt.Lifetime + 4, false)
check(Economy.cash(player) > stuckStart,
	`금고에 안 닿아도 {math.floor(Economy.cash(player) - stuckStart)}원이 회수됐다`)
check(#drops:GetChildren() < Config.Belt.MaxAlive, `벨트에 {#drops:GetChildren()}개만 남았다 (상한 {Config.Belt.MaxAlive})`)

print("")
print("== 퇴장과 저장 ==")
local saved = Economy.save(player)
check(saved, "저장 성공")
PlotService.release(player)
Economy.onLeave(player)
removePlayer(player)
check(DATASTORE_MEMORY["player_9001"] ~= nil, "저장소에 기록이 남았다")

print("")
print("== 재접속 ==")
local again, root2 = makePlayer("저장테스터", 9001)
Economy.onJoin(again)
check(Economy.rebirths(again) == 0, "환생 횟수 복원")
check(math.abs(Economy.cash(again) - math.floor(cashBefore)) < 2000,
	`돈 복원 ({math.floor(Economy.cash(again))} vs 저장 시점 {math.floor(cashBefore)})`)
check(Economy.owns(again, "dropper_3") and Economy.owns(again, "belt_1"), "구매 내역 복원")

claimPad.Touched:Fire(root2)
check(#built:GetChildren() == droppersBefore, `공장이 저장된 그대로 다시 지어졌다 ({#built:GetChildren()}개)`)
check(math.abs(Economy.multiplier(again) - 1.3) < 0.001, `배수 복원 {Economy.multiplier(again)}`)

print("")
print("== 저장값 검증 ==")
DATASTORE_MEMORY["player_9002"] = {
	cash = "삼천원",
	rebirths = -5,
	owned = { dropper_3 = true, ["없는_아이템"] = true, belt_1 = "yes" },
}
local bad = makePlayer("깨진저장", 9002)
Economy.onJoin(bad)
check(Economy.cash(bad) == 0, `숫자가 아닌 돈은 버린다 ({Economy.cash(bad)})`)
check(Economy.rebirths(bad) == 0, `음수 환생은 버린다 ({Economy.rebirths(bad)})`)
check(Economy.owns(bad, "dropper_3"), "정상 항목은 살린다")
check(not Economy.owns(bad, "없는_아이템"), "모르는 항목은 버린다")
check(not Economy.owns(bad, "belt_1"), "true 가 아닌 값은 버린다")

print("")
print("== 불러오기 실패 시 덮어쓰지 않는다 ==")
-- 읽기에 실패했는데 기본값으로 저장해버리면 남의 진행도를 통째로 날린다.
DATASTORE_MEMORY["player_9003"] = { cash = 777777, rebirths = 2, owned = { dropper_2 = true } }
DATASTORE_GET_FAILS = true
local unlucky = makePlayer("읽기실패", 9003)
-- load 는 재시도 사이에 task.wait 로 양보한다. 실제로도 PlayerAdded 코루틴
-- 안에서 도는 코드라, 테스트에서도 코루틴으로 돌리고 시간을 흘려준다.
task.spawn(function()
	Economy.onJoin(unlucky)
end)
step(100, 0.1) -- 2초 + 4초 백오프
DATASTORE_GET_FAILS = false
check(DATASTORE_CALLS.get >= 3, `재시도 3회를 다 돌았다 (GetAsync 누적 {DATASTORE_CALLS.get}회)`)

check(Economy.cash(unlucky) == 0, "읽기에 실패하면 빈 프로필로 시작한다")
check(unlucky:GetAttribute("Persist") == false, "그 세션은 Persist=false 로 표시된다")
check(Economy.save(unlucky) == false, "저장 요청을 거부한다")
check(DATASTORE_MEMORY["player_9003"].cash == 777777, "저장소의 원래 진행도가 그대로다")

Economy.onLeave(unlucky)
removePlayer(unlucky)
check(DATASTORE_MEMORY["player_9003"].cash == 777777, "퇴장 저장도 덮어쓰지 않는다")

local recovered = makePlayer("복구", 9003)
Economy.onJoin(recovered)
check(Economy.cash(recovered) == 777777 and Economy.rebirths(recovered) == 2,
	"저장소가 살아나면 원래 진행도를 그대로 읽는다")

print("")
print(`저장소 호출: GetAsync {DATASTORE_CALLS.get}회, UpdateAsync {DATASTORE_CALLS.update}회`)
print(`경고 {#WARNINGS}건`)
for _, message in WARNINGS do
	print(`  {message}`)
end

print("")
print(if failures == 0 then "모든 검사 통과" else `실패 {failures}건`)
print(`RESULT {failures}`)
