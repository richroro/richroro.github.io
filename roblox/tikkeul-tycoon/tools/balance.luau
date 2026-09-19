--!nonstrict
-- Config 의 가격/수입만 떼어내서 진행 속도를 계산한다. Roblox 없이 돈다.
--
--   python3 tools/balance.py
--
-- 이 파일은 단독 실행되지 않는다. balance.py 가 Config/Format 원본을 앞에 붙여
-- 하나의 청크로 만든 다음 luau 에 먹인다. 숫자를 따로 베껴두지 않으려는 것.

local function multiplierOf(owned, rebirths)
	local multiplier = Config.Rebirth.Multiplier ^ rebirths
	for id in owned do
		local entry = Config.PurchaseById[id]
		if entry and entry.multiplier then
			multiplier *= entry.multiplier
		end
	end
	return multiplier
end

local function incomeOf(owned, rebirths)
	local starter = Config.StarterDropper
	local perSecond = starter.value / starter.interval
	for id in owned do
		local entry = Config.PurchaseById[id]
		if entry and entry.dropValue and entry.dropInterval then
			perSecond += entry.dropValue / entry.dropInterval
		end
	end
	return perSecond * multiplierOf(owned, rebirths)
end

local function clock(seconds)
	return string.format("%d분 %02d초", math.floor(seconds / 60), math.floor(seconds % 60))
end

-- 한 판: 살 수 있게 되는 즉시 순서대로 산다. 환생 비용까지 모으면 끝.
local function simulate(rebirths, verbose)
	local owned = {}
	local cash = Config.StartingCash
	local elapsed = 0

	local function advanceTo(price)
		local income = incomeOf(owned, rebirths)
		if cash < price then
			local waited = (price - cash) / income
			elapsed += waited
			cash = price
			return waited, income
		end
		return 0, income
	end

	for _, id in Config.PurchaseOrder do
		local entry = Config.PurchaseById[id]
		local waited, income = advanceTo(entry.price)
		cash -= entry.price
		owned[id] = true
		if verbose then
			print(string.format(
				"  %-16s %9s   대기 %6.1f초   누적 %-10s 이후 수입 %s/초",
				entry.name,
				Format.cash(entry.price),
				waited,
				clock(elapsed),
				Format.cash(incomeOf(owned, rebirths))
			))
		end
		local _ = income
	end

	local price = math.floor(Config.Rebirth.BasePrice * Config.Rebirth.PriceGrowth ^ rebirths)
	local waited = advanceTo(price)
	if verbose then
		print(string.format(
			"  %-16s %9s   대기 %6.1f초   누적 %s",
			"환생",
			Format.cash(price),
			waited,
			clock(elapsed)
		))
	end
	return elapsed
end

print("== 1회차 상세 ==")
local first = simulate(0, true)

print("")
print("== 환생별 한 판 소요 ==")
local total = 0
for rebirths = 0, 5 do
	local seconds = simulate(rebirths, false)
	total += seconds
	print(string.format(
		"  환생 %d회 시작 · 수입 배수 x%-6s · 환생 비용 %-8s · 한 판 %s · 누적 %s",
		rebirths,
		Format.multiplier(Config.Rebirth.Multiplier ^ rebirths),
		Format.cash(math.floor(Config.Rebirth.BasePrice * Config.Rebirth.PriceGrowth ^ rebirths)),
		clock(seconds),
		clock(total)
	))
end

print("")
print("== 벨트 부하 (플롯당 동시 낙하물) ==")
local L = Config.Layout
local intakeX = L.CollectorX - 12
for _, speed in { Config.Belt.BaseSpeed, 20, 28 } do
	local alive = (intakeX - L.DropperSlotsX[Config.StarterDropper.slot]) / speed / Config.StarterDropper.interval
	for _, entry in Config.Purchases do
		if entry.dropValue and entry.dropInterval then
			alive += (intakeX - L.DropperSlotsX[entry.slot]) / speed / entry.dropInterval
		end
	end
	print(string.format(
		"  벨트 속도 %2d · 평균 %5.1f개 · 상한 %d개",
		speed,
		alive,
		Config.Belt.MaxAlive
	))
end
