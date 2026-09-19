--!strict
-- 공장 한 칸. 바닥/벨트/금고는 서버가 뜰 때 한 번 짓고, 드로퍼와 장식은
-- 주인이 사는 대로 짓는다. 주인이 나가거나 환생하면 산 것만 싹 지운다.

local Players = game:GetService("Players")

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("TikkeulTycoon")
local Config = require(Shared:WaitForChild("Config"))
local Format = require(Shared:WaitForChild("Format"))
local Build = require(script.Parent.Build)
local Economy = require(script.Parent.Economy)

local L = Config.Layout
local P = Config.Palette

export type Deps = {
	canClaim: (player: Player) -> boolean,
	onClaimed: (player: Player, index: number) -> (),
	notify: (player: Player, text: string) -> (),
	rebirthPrompt: (player: Player, price: number) -> (),
}

export type Handle = {
	index: number,
	getOwner: () -> Player?,
	claim: (player: Player) -> boolean,
	release: () -> (),
	rebuild: () -> (),
	refresh: () -> (),
}

type DropperSpec = {
	value: number,
	interval: number,
	color: Color3,
	nozzle: Part,
	nextDue: number,
}

type PadRecord = {
	entry: Config.Purchase,
	pad: Part,
	gui: BillboardGui,
	priceLabel: TextLabel,
	-- 마지막으로 그린 상태. refresh() 가 0.5초마다 도는데 안 바뀐 걸 다시 쓰지 않으려고 둔다.
	shown: boolean?,
	affordable: boolean?,
}

local Plot = {}

local TICK = 0.1
local PAD_DEBOUNCE = 0.4
local FAIL_NOTICE_COOLDOWN = 4
local DROP_SIZE = Vector3.new(1.7, 1.7, 1.7)

local function playerFromHit(hit: BasePart): Player?
	local model = hit:FindFirstAncestorOfClass("Model")
	if not model or not model:FindFirstChildOfClass("Humanoid") then
		return nil
	end
	return Players:GetPlayerFromCharacter(model)
end

function Plot.new(index: number, origin: CFrame, parent: Instance, deps: Deps): Handle
	local model = Instance.new("Model")
	model.Name = `Plot{index}`

	-- 산 물건들만 여기 담는다. 철거는 이 폴더를 비우는 것으로 끝난다.
	local dynamic = Instance.new("Folder")
	dynamic.Name = "Built"
	dynamic.Parent = model

	local drops = Instance.new("Folder")
	drops.Name = "Drops"
	drops.Parent = model

	local function at(x: number, y: number, z: number): CFrame
		return origin * CFrame.new(x, y, z)
	end

	local owner: Player? = nil
	local generation = 0
	local activeDroppers: { DropperSpec } = {}
	local pads: { PadRecord } = {}
	local aliveDrops = 0
	local lastTouch: { [Player]: number } = {}
	local lastFailNotice: { [Player]: number } = {}

	-------------------------------------------------------------------------
	-- 항상 있는 것들
	-------------------------------------------------------------------------

	local floor = Build.part({
		Name = "Floor",
		Size = L.FloorSize,
		CFrame = at(0, -L.FloorSize.Y / 2, 0),
		Color = P.Floor,
		Material = Enum.Material.Concrete,
		Parent = model,
	})

	local beltLength = L.BeltMaxX - L.BeltMinX
	local beltCenterX = (L.BeltMinX + L.BeltMaxX) / 2
	local belt = Build.part({
		Name = "Belt",
		Size = Vector3.new(beltLength, 1, L.BeltWidth),
		CFrame = at(beltCenterX, L.BeltTop - 0.5, L.BeltZ),
		Color = P.Belt,
		Material = Enum.Material.DiamondPlate,
		Parent = model,
	})

	for _, side in { -1, 1 } do
		Build.part({
			Name = "Rail",
			Size = Vector3.new(beltLength, 3, 1),
			CFrame = at(beltCenterX, L.BeltTop + 1, L.BeltZ + side * (L.BeltWidth / 2 + 0.5)),
			Color = P.Rail,
			Parent = model,
		})
	end

	-- 드로퍼를 매다는 골조. 살 수 있는 자리를 미리 보여주는 역할도 한다.
	Build.part({
		Name = "Gantry",
		Size = Vector3.new(beltLength, 1, 1),
		CFrame = at(beltCenterX, L.DropperY + 2.5, L.BeltZ),
		Color = P.Rail,
		Parent = model,
	})
	for _, x in { L.BeltMinX, L.BeltMaxX } do
		Build.part({
			Name = "GantryLeg",
			Size = Vector3.new(1, L.DropperY + 3, 1),
			CFrame = at(x, (L.DropperY + 3) / 2, L.BeltZ - L.BeltWidth / 2 - 1.5),
			Color = P.Rail,
			Parent = model,
		})
	end

	Build.part({
		Name = "Vault",
		Size = Vector3.new(16, 6, 16),
		CFrame = at(L.CollectorX, 3, L.BeltZ),
		Color = P.Collector,
		Material = Enum.Material.Metal,
		Parent = model,
	})

	local vaultGlow = Build.part({
		Name = "VaultMouth",
		Size = Vector3.new(0.6, 4.5, L.BeltWidth),
		CFrame = at(L.CollectorX - 8, 3.4, L.BeltZ),
		Color = P.CollectorGlow,
		Material = Enum.Material.Neon,
		CanCollide = false,
		Parent = model,
	})
	Build.light(vaultGlow, P.CollectorGlow, 1.4, 22)

	-- 벽에 부딪히기 전에 잡는다. 튕겨 나가는 낙하물까지 확실히 먹으려고
	-- 눈에 안 보이는 통과 가능한 상자를 하나 더 둔다.
	local intake = Build.part({
		Name = "Intake",
		Size = Vector3.new(9, 9, L.BeltWidth),
		CFrame = at(L.CollectorX - 12, 4.5, L.BeltZ),
		Transparency = 1,
		CanCollide = false,
		CanTouch = true,
		Parent = model,
	})

	local signBoard = Build.part({
		Name = "Sign",
		Size = Vector3.new(26, 9, 1),
		CFrame = at(0, 6, L.SignZ),
		Color = P.Lobby,
		Parent = model,
	})
	-- NormalId.Front 는 -Z 다. 로비는 +Z 쪽이라 Back 을 쓴다.
	local signText = Build.surfaceText(signBoard, Enum.NormalId.Back)
	signText.Text = `<b>{index}번 공장</b>\n비어 있음`

	local claimPad = Build.part({
		Name = "ClaimPad",
		Size = Vector3.new(12, 1, 12),
		CFrame = at(0, 0.5, L.ClaimPadZ),
		Color = P.Claim,
		Material = Enum.Material.Neon,
		Parent = model,
	})
	local claimGui = Build.billboard(claimPad, 9, 3, 5)
	Build.label(claimGui, {
		Size = UDim2.fromScale(1, 1),
		Text = "밟아서 이 공장 차지하기",
		TextColor3 = Color3.fromRGB(235, 244, 255),
	})

	local rebirthPad = Build.part({
		Name = "RebirthPad",
		Size = Vector3.new(14, 1, 14),
		CFrame = at(0, 0.5, L.RebirthPadZ),
		Color = P.Rebirth,
		Material = Enum.Material.Neon,
		Transparency = 1,
		CanCollide = false,
		CanTouch = false,
		Parent = model,
	})
	local rebirthGui = Build.billboard(rebirthPad, 9, 3, 5)
	rebirthGui.Enabled = false
	local rebirthLabel = Build.label(rebirthGui, {
		Size = UDim2.fromScale(1, 1),
		Text = "환생",
		TextColor3 = Color3.fromRGB(248, 236, 255),
	})

	model.Parent = parent

	-------------------------------------------------------------------------
	-- 구매 패드
	-------------------------------------------------------------------------

	local function padPosition(entry: Config.Purchase): CFrame
		if entry.row == "Dropper" then
			return at(L.DropperSlotsX[entry.slot], 0.5, L.DropperPadZ)
		end
		return at(L.UpgradeSlotsX[entry.slot], 0.5, L.UpgradePadZ)
	end

	local function makePad(entry: Config.Purchase): PadRecord
		local pad = Build.part({
			Name = `Pad_{entry.id}`,
			Size = L.PadSize,
			CFrame = padPosition(entry),
			Color = P.PadLocked,
			Material = Enum.Material.Neon,
			Transparency = 1,
			CanCollide = false,
			CanTouch = false,
			Parent = model,
		})

		local gui = Build.billboard(pad, 8.5, 4.2, 5.5)
		gui.Enabled = false

		local frame = Instance.new("Frame")
		frame.Size = UDim2.fromScale(1, 1)
		frame.BackgroundTransparency = 1
		frame.Parent = gui

		local layout = Instance.new("UIListLayout")
		layout.FillDirection = Enum.FillDirection.Vertical
		layout.HorizontalAlignment = Enum.HorizontalAlignment.Center
		layout.SortOrder = Enum.SortOrder.LayoutOrder
		layout.Parent = frame

		Build.label(frame, {
			LayoutOrder = 1,
			Size = UDim2.fromScale(1, 0.34),
			Text = entry.name,
			TextColor3 = Color3.fromRGB(240, 245, 252),
		})
		local priceLabel = Build.label(frame, {
			LayoutOrder = 2,
			Size = UDim2.fromScale(1, 0.4),
			Text = Format.cash(entry.price),
			Font = Enum.Font.GothamBlack,
			TextColor3 = P.Cash,
		})
		Build.label(frame, {
			LayoutOrder = 3,
			Size = UDim2.fromScale(1, 0.26),
			Text = entry.blurb,
			Font = Enum.Font.Gotham,
			TextColor3 = Color3.fromRGB(184, 194, 208),
		})

		return { entry = entry, pad = pad, gui = gui, priceLabel = priceLabel }
	end

	for _, entry in Config.Purchases do
		table.insert(pads, makePad(entry))
	end

	-------------------------------------------------------------------------
	-- 산 물건 짓기
	-------------------------------------------------------------------------

	local function beltSpeed(): number
		return Economy.beltSpeed(owner)
	end

	local function applyBeltSpeed()
		-- 고정된 파트의 AssemblyLinearVelocity 가 컨베이어 표면 속도가 된다.
		belt.AssemblyLinearVelocity = if owner then belt.CFrame.RightVector * beltSpeed() else Vector3.zero
	end

	local function addDropper(id: string, name: string, slot: number, color: Color3, value: number, interval: number)
		local x = L.DropperSlotsX[slot]
		local body = Build.part({
			Name = `Dropper_{id}`,
			Size = Vector3.new(6, 3.4, 8),
			CFrame = at(x, L.DropperY, L.BeltZ),
			Color = color,
			Material = Enum.Material.Metal,
			Parent = dynamic,
		})
		local nozzle = Build.part({
			Name = "Nozzle",
			Size = Vector3.new(2.4, 1.2, 2.4),
			CFrame = at(x, L.DropperY - 2.2, L.BeltZ),
			Color = color,
			Material = Enum.Material.Neon,
			CanCollide = false,
			Parent = dynamic,
		})
		Build.light(nozzle, color, 1.1, 14)

		local plate = Build.billboard(body, 7, 1.8, 3.4)
		Build.label(plate, {
			Size = UDim2.fromScale(1, 1),
			Text = name,
			Font = Enum.Font.Gotham,
			TextColor3 = Color3.fromRGB(226, 232, 242),
		})

		table.insert(activeDroppers, {
			value = value,
			interval = interval,
			color = color,
			nozzle = nozzle,
			nextDue = os.clock() + interval * math.random(),
		})
	end

	local function buildWalls()
		local wallColor = Config.PurchaseById["wall_1"].color
		Build.part({
			Name = "WallBack",
			Size = Vector3.new(94, 14, 1),
			CFrame = at(1, 7, L.BeltZ - 14),
			Color = wallColor,
			Material = Enum.Material.Concrete,
			Parent = dynamic,
		})
		Build.part({
			Name = "WallLeft",
			Size = Vector3.new(1, 14, 28),
			CFrame = at(-46, 7, L.BeltZ),
			Color = wallColor,
			Material = Enum.Material.Concrete,
			Parent = dynamic,
		})
		Build.part({
			Name = "WallRight",
			Size = Vector3.new(1, 14, 28),
			CFrame = at(47, 7, L.BeltZ),
			Color = wallColor,
			Material = Enum.Material.Concrete,
			Parent = dynamic,
		})
	end

	local function buildRoof()
		Build.part({
			Name = "Roof",
			Size = Vector3.new(94, 1, 30),
			CFrame = at(1, 14.5, L.BeltZ),
			Color = Config.PurchaseById["roof"].color,
			Material = Enum.Material.Metal,
			Transparency = 0.15,
			Parent = dynamic,
		})
	end

	local function buildPurchase(entry: Config.Purchase)
		if entry.dropValue and entry.dropInterval then
			addDropper(entry.id, entry.name, entry.slot, entry.color, entry.dropValue, entry.dropInterval)
		elseif entry.decor == "Walls" then
			buildWalls()
		elseif entry.decor == "Roof" then
			buildRoof()
		end
		applyBeltSpeed()
	end

	-------------------------------------------------------------------------
	-- 표시 갱신
	-------------------------------------------------------------------------

	local function setPadShown(record: PadRecord, shown: boolean)
		if record.shown == shown then
			return
		end
		record.shown = shown
		record.pad.Transparency = if shown then 0.25 else 1
		record.pad.CanCollide = false
		record.pad.CanTouch = shown
		record.gui.Enabled = shown
	end

	local function refresh()
		local player = owner

		claimPad.Transparency = if player then 1 else 0.2
		claimPad.CanTouch = player == nil
		claimGui.Enabled = player == nil
		floor.Color = if player then P.FloorClaimed else P.Floor

		local wantedSign = if player
			then `<b>{player.DisplayName}</b>\n{index}번 공장 · 환생 {Economy.rebirths(player)}`
			else `<b>{index}번 공장</b>\n비어 있음`
		if signText.Text ~= wantedSign then
			signText.Text = wantedSign
		end

		local cash = if player then Economy.cash(player) else 0
		for _, record in pads do
			local entry = record.entry
			local shown = false
			if player and not Economy.owns(player, entry.id) then
				local requires = entry.requires
				shown = requires == nil or Economy.owns(player, requires)
			end
			setPadShown(record, shown)
			if shown then
				local affordable = cash >= entry.price
				if record.affordable ~= affordable then
					record.affordable = affordable
					record.pad.Color = if affordable then P.PadAffordable else P.PadTooPricey
					record.priceLabel.TextColor3 = if affordable then P.Cash else Color3.fromRGB(246, 176, 168)
				end
			end
		end

		local canRebirth = player ~= nil and Economy.rebirthUnlocked(player)
		rebirthPad.Transparency = if canRebirth then 0.15 else 1
		rebirthPad.CanTouch = canRebirth
		rebirthGui.Enabled = canRebirth
		if canRebirth and player then
			local price = Economy.rebirthPrice(player)
			local nextMultiplier = Config.Rebirth.Multiplier ^ (Economy.rebirths(player) + 1)
			rebirthLabel.Text =
				`<b>환생</b>  {Format.cash(price)}\n공장을 비우고 수입 x{Format.multiplier(nextMultiplier)}`
		end
	end

	-------------------------------------------------------------------------
	-- 낙하물
	-------------------------------------------------------------------------

	local function collect(part: BasePart)
		if part:GetAttribute("Collected") then
			return
		end
		part:SetAttribute("Collected", true)
		local value = part:GetAttribute("Value")
		part:Destroy()

		local player = owner
		if player and typeof(value) == "number" then
			Economy.addCash(player, value * Economy.multiplier(player))
		end
	end

	local function spawnDrop(spec: DropperSpec)
		if aliveDrops >= Config.Belt.MaxAlive then
			return
		end
		aliveDrops += 1

		local drop = Build.part({
			Name = "Drop",
			Size = DROP_SIZE,
			CFrame = spec.nozzle.CFrame * CFrame.new(0, -1.4, 0),
			Color = spec.color,
			Material = Enum.Material.Neon,
			Anchored = false,
			CanCollide = true,
			Parent = drops,
		})
		drop:SetAttribute("Value", spec.value)
		drop:SetAttribute("Born", os.clock())

		-- 낙하물을 벨트 표면 마찰에 맡기지 않는다. 고정 파트의
		-- AssemblyLinearVelocity 를 컨베이어로 쓰는 건 엔진 버전을 타는 동작이고,
		-- 안 먹히면 돈이 벨트 위에 그대로 쌓인다. Line 모드 LinearVelocity 로
		-- x축 속도만 직접 고정하면 y(중력)/z 는 그대로 두면서 반드시 금고로 간다.
		local mount = Instance.new("Attachment")
		mount.Parent = drop

		local mover = Instance.new("LinearVelocity")
		mover.Attachment0 = mount
		mover.RelativeTo = Enum.ActuatorRelativeTo.World
		mover.VelocityConstraintMode = Enum.VelocityConstraintMode.Line
		mover.LineDirection = belt.CFrame.RightVector
		mover.LineVelocity = beltSpeed()
		mover.MaxForce = math.huge
		mover.Parent = drop

		drop.Destroying:Connect(function()
			aliveDrops -= 1
		end)
	end

	-- 물리에 끼거나 맵 밖으로 떨어진 낙하물 회수. 플레이어 돈을 잃게 두지 않는다.
	local function sweepDrops()
		local now = os.clock()
		local floorY = origin.Position.Y
		for _, child in drops:GetChildren() do
			if child:IsA("BasePart") then
				local born = child:GetAttribute("Born")
				local tooOld = typeof(born) == "number" and now - born > Config.Belt.Lifetime
				if tooOld or child.Position.Y < floorY - 50 then
					collect(child)
				end
			end
		end
	end

	intake.Touched:Connect(function(hit)
		if hit.Name == "Drop" and hit.Parent == drops then
			collect(hit)
		end
	end)

	-------------------------------------------------------------------------
	-- 입력
	-------------------------------------------------------------------------

	local function debounced(player: Player): boolean
		local now = os.clock()
		local last = lastTouch[player]
		if last and now - last < PAD_DEBOUNCE then
			return true
		end
		lastTouch[player] = now
		return false
	end

	local function attemptPurchase(player: Player, entry: Config.Purchase)
		if Economy.owns(player, entry.id) then
			return
		end
		local requires = entry.requires
		if requires and not Economy.owns(player, requires) then
			return
		end
		if not Economy.trySpend(player, entry.price) then
			-- 패드 위에서 캐릭터가 덜컹거리면 Touched 가 반복해서 뜬다. 토스트까지
			-- 같이 반복되면 화면이 가려지므로 실패 알림만 따로 묶어둔다.
			local now = os.clock()
			local last = lastFailNotice[player]
			if not last or now - last > FAIL_NOTICE_COOLDOWN then
				lastFailNotice[player] = now
				deps.notify(player, `{entry.name} — {Format.cash(entry.price)} 필요`)
			end
			refresh()
			return
		end

		Economy.markOwned(player, entry.id)
		buildPurchase(entry)
		Economy.refresh(player)
		refresh()
		deps.notify(player, `{entry.name} 설치 완료`)
		task.spawn(Economy.save, player)
	end

	for _, record in pads do
		record.pad.Touched:Connect(function(hit)
			local player = playerFromHit(hit)
			if player == nil or player ~= owner or debounced(player) then
				return
			end
			attemptPurchase(player, record.entry)
		end)
	end

	rebirthPad.Touched:Connect(function(hit)
		local player = playerFromHit(hit)
		if player == nil or player ~= owner or debounced(player) then
			return
		end
		if Economy.rebirthUnlocked(player) then
			deps.rebirthPrompt(player, Economy.rebirthPrice(player))
		end
	end)

	-------------------------------------------------------------------------
	-- 공개 동작
	-------------------------------------------------------------------------

	local function clearBuilt()
		generation += 1
		table.clear(activeDroppers)
		dynamic:ClearAllChildren()
		drops:ClearAllChildren()
		aliveDrops = 0
	end

	local function startFactory()
		generation += 1
		local myGeneration = generation
		task.spawn(function()
			local ticks = 0
			while myGeneration == generation do
				task.wait(TICK)
				if myGeneration ~= generation then
					break
				end
				local now = os.clock()
				if owner then
					for _, spec in activeDroppers do
						if now >= spec.nextDue then
							spec.nextDue = now + spec.interval
							spawnDrop(spec)
						end
					end
				end
				ticks += 1
				if ticks % 5 == 0 then
					refresh() -- 살 수 있는지 여부를 색으로 보여줘야 해서 주기적으로 갱신
				end
				if ticks % 20 == 0 then
					sweepDrops()
				end
			end
		end)
	end

	-- 저장된 구매 내역을 그대로 다시 짓는다.
	local function applyOwned()
		local player = owner
		if not player then
			return
		end
		local starter = Config.StarterDropper
		addDropper(starter.id, starter.name, starter.slot, starter.color, starter.value, starter.interval)
		for _, id in Config.PurchaseOrder do
			if Economy.owns(player, id) then
				buildPurchase(Config.PurchaseById[id])
			end
		end
		applyBeltSpeed()
	end

	local function rebuild()
		clearBuilt()
		applyOwned()
		refresh()
		startFactory()
	end

	local function claim(player: Player): boolean
		if owner ~= nil or not deps.canClaim(player) then
			return false
		end
		owner = player
		Economy.setHasPlot(player, true)
		rebuild()
		deps.onClaimed(player, index)
		return true
	end

	claimPad.Touched:Connect(function(hit)
		local player = playerFromHit(hit)
		if player == nil or owner ~= nil or debounced(player) then
			return
		end
		claim(player)
	end)

	local function release()
		local previous = owner
		owner = nil
		clearBuilt()
		applyBeltSpeed()
		table.clear(lastTouch)
		table.clear(lastFailNotice)
		refresh()
		if previous then
			Economy.setHasPlot(previous, false)
		end
	end

	-- 공장 루프는 주인이 생길 때(claim -> rebuild) 켜고, release 가 끈다.
	refresh()
	applyBeltSpeed()

	return {
		index = index,
		getOwner = function()
			return owner
		end,
		claim = claim,
		release = release,
		rebuild = rebuild,
		refresh = refresh,
	}
end

return Plot
