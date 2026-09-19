--!strict
-- 클라이언트는 보여주기만 한다. 서버로 보내는 건 환생 확인 하나뿐.
-- 돈/배수/목표는 leaderstats 와 Player attribute 를 그대로 읽는다.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("TikkeulTycoon")
local Format = require(Shared:WaitForChild("Format"))
local Net = require(Shared:WaitForChild("Net"))
local Hud = require(script.Hud)

local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui")
local hud = Hud.create(playerGui)

local NO_PLOT_HINT = "로비 앞 파란 패드를 밟아 빈 공장을 차지하세요"

local function refreshGoal()
	local name = player:GetAttribute("GoalName")
	local price = player:GetAttribute("GoalPrice")
	if typeof(name) == "string" and typeof(price) == "number" then
		hud.setGoal(name, Format.cash(price))
	else
		hud.setGoal("-", "-")
	end
end

local function refreshIncome()
	local income = player:GetAttribute("Income")
	hud.setIncome(if typeof(income) == "number" then `초당 {Format.cash(income)}` else "초당 0")
end

local function refreshMultiplier()
	local shown = player:GetAttribute("MultiplierText")
	hud.setMultiplier(if typeof(shown) == "string" then `x{shown}` else "x1")
end

local function refreshHint()
	hud.setHint(if player:GetAttribute("HasPlot") == true then nil else NO_PLOT_HINT)
end

player:GetAttributeChangedSignal("GoalName"):Connect(refreshGoal)
player:GetAttributeChangedSignal("GoalPrice"):Connect(refreshGoal)
player:GetAttributeChangedSignal("Income"):Connect(refreshIncome)
player:GetAttributeChangedSignal("MultiplierText"):Connect(refreshMultiplier)
player:GetAttributeChangedSignal("HasPlot"):Connect(refreshHint)

refreshGoal()
refreshIncome()
refreshMultiplier()
refreshHint()

-- leaderstats 는 서버가 저장소를 읽은 뒤에 생긴다. 못 기다리면 그냥 HUD 만 띄운다.
task.spawn(function()
	local leaderstats = player:WaitForChild("leaderstats", 30)
	if not leaderstats then
		warn("[티끌 타이쿤] leaderstats 가 오지 않았다 — 서버 스크립트를 확인")
		return
	end
	local cash = leaderstats:WaitForChild("돈", 10)
	if not cash or not cash:IsA("IntValue") then
		return
	end
	local function push()
		hud.setCash(Format.cash(cash.Value))
	end
	cash.Changed:Connect(push)
	push()
end)

Net.event("Notify").OnClientEvent:Connect(function(message)
	if typeof(message) == "string" then
		hud.toast(message)
	end
end)

local rebirthConfirm = Net.event("RebirthConfirm")
Net.event("RebirthPrompt").OnClientEvent:Connect(function(price)
	if typeof(price) ~= "number" then
		return
	end
	hud.askRebirth(Format.cash(price), function()
		rebirthConfirm:FireServer()
	end)
end)

-- 저장이 꺼진 세션(Studio API 미허용 등)이면 한 번만 알려준다.
task.delay(3, function()
	if player:GetAttribute("Persist") == false then
		hud.toast("이 세션은 저장이 꺼져 있다")
	end
end)
