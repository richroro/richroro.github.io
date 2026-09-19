--!strict
-- 플롯을 줄지어 세우고, 한 사람이 한 칸만 갖도록 관리한다.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("TikkeulTycoon")
local Config = require(Shared:WaitForChild("Config"))
local Economy = require(script.Parent.Economy)
local Plot = require(script.Parent.Plot)

local PlotService = {}

local plots: { Plot.Handle } = {}
local owned: { [Player]: Plot.Handle } = {}

function PlotService.build(parent: Instance, notify: (Player, string) -> (), rebirthPrompt: (Player, number) -> ())
	local count = Config.Plot.Count
	local spacing = Config.Plot.Spacing

	local deps: Plot.Deps = {
		canClaim = function(player)
			return owned[player] == nil and Economy.isReady(player)
		end,
		onClaimed = function(player, index)
			local handle = plots[index]
			if handle then
				owned[player] = handle
			end
			player:SetAttribute("PlotIndex", index)
			notify(player, `{index}번 공장을 차지했다`)
		end,
		notify = notify,
		rebirthPrompt = rebirthPrompt,
	}

	for index = 1, count do
		local x = (index - (count + 1) / 2) * spacing
		plots[index] = Plot.new(index, CFrame.new(x, 0, 0), parent, deps)
	end
end

function PlotService.forPlayer(player: Player): Plot.Handle?
	return owned[player]
end

function PlotService.release(player: Player)
	local handle = owned[player]
	owned[player] = nil
	if handle then
		handle.release()
	end
	player:SetAttribute("PlotIndex", nil)
end

function PlotService.freeCount(): number
	local free = 0
	for _, handle in plots do
		if handle.getOwner() == nil then
			free += 1
		end
	end
	return free
end

return PlotService
