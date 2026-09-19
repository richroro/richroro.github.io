--!strict
-- 티끌 타이쿤 — 서버 진입점.
-- 맵도 GUI 도 전부 코드로 만든다. Studio 에서 손으로 배치해둘 것은 없다.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("TikkeulTycoon")
local Format = require(Shared:WaitForChild("Format"))
local Net = require(Shared:WaitForChild("Net"))

local Economy = require(script.Economy)
local PlotService = require(script.PlotService)
local World = require(script.World)

local REBIRTH_COOLDOWN = 1
local SHUTDOWN_SAVE_TIMEOUT = 20

local notifyEvent = Net.event("Notify")
local rebirthPromptEvent = Net.event("RebirthPrompt")
local rebirthConfirmEvent = Net.event("RebirthConfirm")

local function notify(player: Player, text: string)
	notifyEvent:FireClient(player, text)
end

local function rebirthPrompt(player: Player, price: number)
	rebirthPromptEvent:FireClient(player, price)
end

local world = World.build()
Economy.start()
PlotService.build(world, notify, rebirthPrompt)

local lastRebirth: { [Player]: number } = {}

-- 클라이언트가 보낼 수 있는 건 이 이벤트 하나뿐이고, 여기서도 조건을 전부 다시 본다.
rebirthConfirmEvent.OnServerEvent:Connect(function(player)
	local now = os.clock()
	local last = lastRebirth[player]
	if last and now - last < REBIRTH_COOLDOWN then
		return
	end
	lastRebirth[player] = now

	local plot = PlotService.forPlayer(player)
	if not plot then
		return
	end
	if not Economy.rebirthUnlocked(player) then
		notify(player, "아직 다 사지 않았다")
		return
	end

	local price = Economy.rebirthPrice(player)
	if Economy.cash(player) < price then
		notify(player, `환생 비용 {Format.cash(price)} 이 모자란다`)
		return
	end
	if not Economy.rebirth(player) then
		return
	end

	plot.rebuild()
	notify(player, `환생 {Economy.rebirths(player)}회 — 수입 배수가 올랐다`)
	task.spawn(Economy.save, player)
end)

local function onPlayerAdded(player: Player)
	Economy.onJoin(player)
end

local function onPlayerRemoving(player: Player)
	PlotService.release(player)
	lastRebirth[player] = nil
	Economy.onLeave(player)
end

Players.PlayerAdded:Connect(onPlayerAdded)
Players.PlayerRemoving:Connect(onPlayerRemoving)

-- Studio 에서 혼자 플레이하면 PlayerAdded 가 이 스크립트보다 먼저 지나갈 수 있다.
for _, player in Players:GetPlayers() do
	task.spawn(onPlayerAdded, player)
end

game:BindToClose(function()
	Economy.flushAll(SHUTDOWN_SAVE_TIMEOUT)
end)

print(`[티끌 타이쿤] 준비 완료 — 공장 {PlotService.freeCount()}칸`)
