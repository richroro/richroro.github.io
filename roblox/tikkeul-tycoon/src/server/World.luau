--!strict
-- 지면, 조명, 로비. 플롯 바깥의 전부.

local Lighting = game:GetService("Lighting")

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("TikkeulTycoon")
local Config = require(Shared:WaitForChild("Config"))
local Build = require(script.Parent.Build)

local P = Config.Palette
local W = Config.World

local World = {}

local function setupLighting()
	Lighting.Ambient = Color3.fromRGB(72, 76, 88)
	Lighting.OutdoorAmbient = Color3.fromRGB(96, 102, 118)
	Lighting.Brightness = 2.4
	Lighting.ClockTime = 15.5
	Lighting.GeographicLatitude = 18
	Lighting.EnvironmentDiffuseScale = 0.5
	Lighting.EnvironmentSpecularScale = 0.4
	Lighting.GlobalShadows = true

	if not Lighting:FindFirstChildOfClass("Atmosphere") then
		local atmosphere = Instance.new("Atmosphere")
		atmosphere.Density = 0.32
		atmosphere.Offset = 0.1
		atmosphere.Haze = 1.4
		atmosphere.Glare = 0.2
		atmosphere.Color = Color3.fromRGB(202, 210, 226)
		atmosphere.Decay = Color3.fromRGB(104, 112, 132)
		atmosphere.Parent = Lighting
	end
end

-- Studio 기본 템플릿이 깔아두는 Baseplate/SpawnLocation 과 겹치면
-- 스폰이 둘로 갈리고 바닥이 z-fighting 한다.
local function clearStudioDefaults()
	if not W.ClearStudioDefaults then
		return
	end
	for _, name in { "Baseplate", "SpawnLocation" } do
		local existing = workspace:FindFirstChild(name)
		if existing then
			existing:Destroy()
			print(`[티끌 타이쿤] workspace.{name} 을 치웠다 (Config.World.ClearStudioDefaults)`)
		end
	end
end

function World.build(): Folder
	clearStudioDefaults()
	setupLighting()

	workspace.FallenPartsDestroyHeight = -200

	local folder = Instance.new("Folder")
	folder.Name = "TikkeulTycoon"

	Build.part({
		Name = "Ground",
		Size = W.GroundSize,
		CFrame = CFrame.new(0, -W.GroundSize.Y / 2 - 0.5, 0),
		Color = Color3.fromRGB(38, 42, 50),
		Material = Enum.Material.Slate,
		Parent = folder,
	})

	Build.part({
		Name = "Lobby",
		Size = W.LobbySize,
		CFrame = CFrame.new(0, -W.LobbySize.Y / 2, W.LobbyZ),
		Color = P.Lobby,
		Material = Enum.Material.Concrete,
		Parent = folder,
	})

	local spawnPad = Instance.new("SpawnLocation")
	spawnPad.Name = "LobbySpawn"
	spawnPad.Size = Vector3.new(16, 1, 16)
	spawnPad.CFrame = CFrame.new(0, 0.5, W.LobbyZ + 14)
	spawnPad.Anchored = true
	spawnPad.Neutral = true
	spawnPad.AllowTeamChangeOnTouch = false
	spawnPad.Color = P.Claim
	spawnPad.Material = Enum.Material.Neon
	spawnPad.TopSurface = Enum.SurfaceType.Smooth
	spawnPad.Parent = folder

	local board = Build.part({
		Name = "HelpBoard",
		Size = Vector3.new(60, 18, 1.5),
		CFrame = CFrame.new(0, 9, W.LobbyZ + 34),
		Color = Color3.fromRGB(30, 34, 42),
		Parent = folder,
	})
	-- 로비 스폰은 판 앞(-Z)쪽에 있으니 Front 면에 글자를 박는다.
	local boardText = Build.surfaceText(board, Enum.NormalId.Front)
	boardText.Text = table.concat({
		"<b>티끌 타이쿤</b>",
		"",
		"1. 비어 있는 공장의 파란 패드를 밟아 차지한다",
		"2. 드로퍼가 떨어뜨린 돈이 컨베이어를 타고 금고로 간다",
		"3. 초록 패드를 밟아 드로퍼와 개조를 산다",
		"4. 전부 사면 환생 패드가 열린다 — 공장을 비우고 수입 배수를 얻는다",
	}, "\n")
	boardText.TextScaled = false
	boardText.TextSize = 34
	boardText.TextWrapped = true
	boardText.Font = Enum.Font.Gotham
	boardText.TextXAlignment = Enum.TextXAlignment.Left

	folder.Parent = workspace
	return folder
end

return World
