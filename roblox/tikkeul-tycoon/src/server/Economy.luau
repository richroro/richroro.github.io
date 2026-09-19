--!strict
-- 돈/환생/배수. 플레이어 프로필의 유일한 주인이고, 나머지 모듈은 전부 여기를 거친다.

local Players = game:GetService("Players")

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("TikkeulTycoon")
local Config = require(Shared:WaitForChild("Config"))
local Format = require(Shared:WaitForChild("Format"))
local Data = require(script.Parent.Data)

export type Profile = Data.Profile

type Session = {
	profile: Profile,
	persist: boolean, -- 불러오기에 실패했으면 false. 저장해서 덮어쓰면 안 된다.
	hasPlot: boolean,
	cashValue: IntValue,
	rebirthValue: IntValue,
	dirty: boolean,
}

local CASH_CAP = 1e15
local FLUSH_INTERVAL = 0.1

local Economy = {}
local sessions: { [Player]: Session } = {}

function Economy.get(player: Player): Session?
	return sessions[player]
end

-- 저장소를 다 읽기 전에는 프로필이 없다. 그 사이에 공장을 차지하면 진행도가
-- 세션 없이 흘러가므로, 준비될 때까지 클레임을 막는 데 쓴다.
function Economy.isReady(player: Player): boolean
	return sessions[player] ~= nil
end

local function computeMultiplier(profile: Profile): number
	local multiplier = Config.Rebirth.Multiplier ^ profile.rebirths
	for id in profile.owned do
		local entry = Config.PurchaseById[id]
		if entry and entry.multiplier then
			multiplier *= entry.multiplier
		end
	end
	return multiplier
end

local function computeIncome(session: Session, multiplier: number): number
	if not session.hasPlot then
		return 0
	end
	local perSecond = Config.StarterDropper.value / Config.StarterDropper.interval
	for id in session.profile.owned do
		local entry = Config.PurchaseById[id]
		if entry and entry.dropValue and entry.dropInterval then
			perSecond += entry.dropValue / entry.dropInterval
		end
	end
	return perSecond * multiplier
end

-- 사슬이 선형이라 "아직 안 산 것 중 제일 앞" 이 곧 다음 목표다.
local function nextGoal(profile: Profile): Config.Purchase?
	for _, id in Config.PurchaseOrder do
		if not profile.owned[id] then
			return Config.PurchaseById[id]
		end
	end
	return nil
end

function Economy.rebirthPrice(player: Player): number
	local session = sessions[player]
	if not session then
		return math.huge
	end
	return math.floor(Config.Rebirth.BasePrice * Config.Rebirth.PriceGrowth ^ session.profile.rebirths)
end

-- 환생은 모든 항목을 다 산 뒤에만 열린다.
function Economy.rebirthUnlocked(player: Player): boolean
	local session = sessions[player]
	if not session then
		return false
	end
	return nextGoal(session.profile) == nil
end

-- 클라이언트 HUD 는 전부 이 attribute 들을 읽는다. RemoteEvent 로 밀지 않는 이유는
-- attribute 가 알아서 복제되고 중간에 접속한 클라이언트도 최신값을 받기 때문.
function Economy.refresh(player: Player)
	local session = sessions[player]
	if not session then
		return
	end

	local multiplier = computeMultiplier(session.profile)
	player:SetAttribute("Multiplier", multiplier)
	player:SetAttribute("MultiplierText", Format.multiplier(multiplier))
	player:SetAttribute("Income", computeIncome(session, multiplier))
	player:SetAttribute("HasPlot", session.hasPlot)
	player:SetAttribute("Persist", session.persist)

	local goal = nextGoal(session.profile)
	if goal then
		player:SetAttribute("GoalName", goal.name)
		player:SetAttribute("GoalPrice", goal.price)
	else
		player:SetAttribute("GoalName", "환생")
		player:SetAttribute("GoalPrice", Economy.rebirthPrice(player))
	end
end

function Economy.multiplier(player: Player): number
	local session = sessions[player]
	return if session then computeMultiplier(session.profile) else 1
end

-- 산 것 중 가장 빠른 벨트 속도를 쓴다.
function Economy.beltSpeed(player: Player?): number
	local speed = Config.Belt.BaseSpeed
	if not player then
		return speed
	end
	local session = sessions[player]
	if not session then
		return speed
	end
	for id in session.profile.owned do
		local entry = Config.PurchaseById[id]
		if entry and entry.beltSpeed and entry.beltSpeed > speed then
			speed = entry.beltSpeed
		end
	end
	return speed
end

function Economy.cash(player: Player): number
	local session = sessions[player]
	return if session then session.profile.cash else 0
end

function Economy.addCash(player: Player, amount: number)
	local session = sessions[player]
	if not session or amount <= 0 then
		return
	end
	session.profile.cash = math.min(session.profile.cash + amount, CASH_CAP)
	session.dirty = true
end

function Economy.trySpend(player: Player, amount: number): boolean
	local session = sessions[player]
	if not session or session.profile.cash < amount then
		return false
	end
	session.profile.cash -= amount
	session.dirty = true
	return true
end

function Economy.owns(player: Player, id: string): boolean
	local session = sessions[player]
	return session ~= nil and session.profile.owned[id] == true
end

function Economy.ownedIds(player: Player): { [string]: boolean }
	local session = sessions[player]
	return if session then session.profile.owned else {}
end

function Economy.markOwned(player: Player, id: string)
	local session = sessions[player]
	if not session then
		return
	end
	session.profile.owned[id] = true
	session.dirty = true
end

function Economy.setHasPlot(player: Player, hasPlot: boolean)
	local session = sessions[player]
	if session then
		session.hasPlot = hasPlot
		Economy.refresh(player)
	end
end

function Economy.rebirths(player: Player): number
	local session = sessions[player]
	return if session then session.profile.rebirths else 0
end

-- 공장을 통째로 반납하고 배수를 올린다. 실제 철거는 Plot 쪽에서 한다.
function Economy.rebirth(player: Player): boolean
	local session = sessions[player]
	if not session or not Economy.rebirthUnlocked(player) then
		return false
	end
	local price = Economy.rebirthPrice(player)
	if session.profile.cash < price then
		return false
	end

	session.profile.cash = Config.StartingCash
	session.profile.rebirths += 1
	session.profile.owned = {}
	session.dirty = true
	session.rebirthValue.Value = session.profile.rebirths
	session.cashValue.Value = session.profile.cash
	Economy.refresh(player)
	return true
end

function Economy.onJoin(player: Player)
	local profile, persist = Data.load(player.UserId)

	-- 불러오는 동안 나갔을 수 있다.
	if player.Parent == nil then
		return
	end

	local leaderstats = Instance.new("Folder")
	leaderstats.Name = "leaderstats"

	-- Roblox 의 IntValue 는 64비트라 1e15 까지 그냥 담긴다.
	local cashValue = Instance.new("IntValue")
	cashValue.Name = "돈"
	cashValue.Value = math.floor(profile.cash)
	cashValue.Parent = leaderstats

	local rebirthValue = Instance.new("IntValue")
	rebirthValue.Name = "환생"
	rebirthValue.Value = profile.rebirths
	rebirthValue.Parent = leaderstats

	leaderstats.Parent = player

	sessions[player] = {
		profile = profile,
		persist = persist,
		hasPlot = false,
		cashValue = cashValue,
		rebirthValue = rebirthValue,
		dirty = false,
	}

	Economy.refresh(player)
end

function Economy.save(player: Player): boolean
	local session = sessions[player]
	if not session or not session.persist then
		return false
	end
	return Data.save(player.UserId, session.profile)
end

function Economy.onLeave(player: Player)
	Economy.save(player)
	sessions[player] = nil
end

function Economy.saveAll()
	for _, player in Players:GetPlayers() do
		task.spawn(Economy.save, player)
	end
end

-- 서버가 닫힐 때 쓴다. saveAll 은 던져놓고 끝나지만 이건 끝날 때까지 기다린다.
function Economy.flushAll(timeout: number)
	local pending = 0
	for _, player in Players:GetPlayers() do
		pending += 1
		task.spawn(function()
			Economy.save(player)
			pending -= 1
		end)
	end

	local deadline = os.clock() + timeout
	while pending > 0 and os.clock() < deadline do
		task.wait(0.1)
	end
end

function Economy.start()
	-- leaderstats 를 낙하물마다 갱신하면 초당 수십 번 복제된다. 0.1초에 한 번만 민다.
	task.spawn(function()
		while true do
			task.wait(FLUSH_INTERVAL)
			for _, player in Players:GetPlayers() do
				local session = sessions[player]
				if session and session.dirty then
					session.dirty = false
					session.cashValue.Value = math.floor(session.profile.cash)
				end
			end
		end
	end)

	task.spawn(function()
		while true do
			task.wait(Config.AutoSaveSeconds)
			Economy.saveAll()
		end
	end)
end

return Economy
