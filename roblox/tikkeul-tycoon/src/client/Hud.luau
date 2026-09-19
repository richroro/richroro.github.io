--!strict
-- 화면 UI 도 전부 코드로 만든다. StarterGui 에 미리 넣어둘 것이 없다.

local TweenService = game:GetService("TweenService")

local Hud = {}

type FrameProps = {
	Name: string?,
	AnchorPoint: Vector2?,
	Position: UDim2?,
	Size: UDim2?,
	Visible: boolean?,
	BackgroundTransparency: number?,
	BackgroundColor3: Color3?,
	ZIndex: number?,
}

type LabelProps = {
	Name: string?,
	LayoutOrder: number?,
	AnchorPoint: Vector2?,
	Position: UDim2?,
	Size: UDim2?,
	Text: string?,
	TextColor3: Color3?,
	TextSize: number?,
	TextWrapped: boolean?,
	TextXAlignment: Enum.TextXAlignment?,
	Font: Enum.Font?,
	ZIndex: number?,
}

export type Handle = {
	setCash: (text: string) -> (),
	setIncome: (text: string) -> (),
	setMultiplier: (text: string) -> (),
	setGoal: (title: string, price: string) -> (),
	setHint: (text: string?) -> (),
	toast: (text: string) -> (),
	askRebirth: (priceText: string, onConfirm: () -> ()) -> (),
}

local INK = Color3.fromRGB(236, 241, 248)
local MUTED = Color3.fromRGB(148, 158, 174)
local CARD = Color3.fromRGB(16, 19, 25)
local ACCENT = Color3.fromRGB(96, 232, 176)
local REBIRTH = Color3.fromRGB(196, 132, 240)
local TOAST_SECONDS = 2.6

local function card(parent: Instance, props: FrameProps): Frame
	local frame = Instance.new("Frame")
	frame.BackgroundColor3 = CARD
	frame.BackgroundTransparency = 0.12
	frame.BorderSizePixel = 0
	for key, value in props :: { [string]: any } do
		(frame :: any)[key] = value
	end

	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0, 12)
	corner.Parent = frame

	local stroke = Instance.new("UIStroke")
	stroke.Color = Color3.fromRGB(70, 80, 96)
	stroke.Transparency = 0.55
	stroke.Thickness = 1
	stroke.Parent = frame

	local padding = Instance.new("UIPadding")
	padding.PaddingTop = UDim.new(0, 10)
	padding.PaddingBottom = UDim.new(0, 10)
	padding.PaddingLeft = UDim.new(0, 14)
	padding.PaddingRight = UDim.new(0, 14)
	padding.Parent = frame

	frame.Parent = parent
	return frame
end

local function text(parent: Instance, props: LabelProps): TextLabel
	local label = Instance.new("TextLabel")
	label.BackgroundTransparency = 1
	label.BorderSizePixel = 0
	label.Font = Enum.Font.GothamMedium
	label.TextColor3 = INK
	label.TextXAlignment = Enum.TextXAlignment.Left
	label.TextSize = 14
	label.RichText = true
	for key, value in props :: { [string]: any } do
		(label :: any)[key] = value
	end
	label.Parent = parent
	return label
end

function Hud.create(playerGui: Instance): Handle
	local screen = Instance.new("ScreenGui")
	screen.Name = "TikkeulHud"
	screen.ResetOnSpawn = false
	screen.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
	screen.DisplayOrder = 10

	---------------------------------------------------------------- 돈 패널
	local stats = card(screen, {
		Name = "Stats",
		AnchorPoint = Vector2.new(0, 0),
		Position = UDim2.new(0, 16, 0, 16),
		Size = UDim2.new(0, 248, 0, 96),
	})

	text(stats, {
		Size = UDim2.new(1, 0, 0, 14),
		Text = "돈",
		TextColor3 = MUTED,
		TextSize = 12,
	})
	local cashLabel = text(stats, {
		Position = UDim2.new(0, 0, 0, 16),
		Size = UDim2.new(1, 0, 0, 34),
		Text = "0",
		Font = Enum.Font.GothamBlack,
		TextSize = 30,
		TextColor3 = ACCENT,
	})
	local incomeLabel = text(stats, {
		Position = UDim2.new(0, 0, 0, 54),
		Size = UDim2.new(1, 0, 0, 16),
		Text = "초당 0",
		TextColor3 = MUTED,
		TextSize = 13,
	})
	local multiplierLabel = text(stats, {
		Position = UDim2.new(0, 0, 0, 54),
		Size = UDim2.new(1, 0, 0, 16),
		Text = "x1",
		TextXAlignment = Enum.TextXAlignment.Right,
		TextColor3 = REBIRTH,
		TextSize = 13,
	})

	---------------------------------------------------------------- 다음 목표
	local goal = card(screen, {
		Name = "Goal",
		AnchorPoint = Vector2.new(1, 0),
		Position = UDim2.new(1, -16, 0, 16),
		Size = UDim2.new(0, 220, 0, 62),
	})
	text(goal, {
		Size = UDim2.new(1, 0, 0, 14),
		Text = "다음 목표",
		TextColor3 = MUTED,
		TextSize = 12,
		TextXAlignment = Enum.TextXAlignment.Right,
	})
	local goalName = text(goal, {
		Position = UDim2.new(0, 0, 0, 16),
		Size = UDim2.new(1, 0, 0, 18),
		Text = "-",
		Font = Enum.Font.GothamBold,
		TextSize = 16,
		TextXAlignment = Enum.TextXAlignment.Right,
	})
	local goalPrice = text(goal, {
		Position = UDim2.new(0, 0, 0, 34),
		Size = UDim2.new(1, 0, 0, 16),
		Text = "-",
		TextColor3 = ACCENT,
		TextSize = 14,
		TextXAlignment = Enum.TextXAlignment.Right,
	})

	---------------------------------------------------------------- 안내 줄
	local hint = card(screen, {
		Name = "Hint",
		AnchorPoint = Vector2.new(0.5, 1),
		Position = UDim2.new(0.5, 0, 1, -18),
		Size = UDim2.new(0, 400, 0, 40),
		Visible = false,
	})
	local hintLabel = text(hint, {
		Size = UDim2.fromScale(1, 1),
		Text = "",
		TextXAlignment = Enum.TextXAlignment.Center,
		TextSize = 15,
	})

	---------------------------------------------------------------- 토스트
	local toasts = Instance.new("Frame")
	toasts.Name = "Toasts"
	toasts.BackgroundTransparency = 1
	toasts.AnchorPoint = Vector2.new(0.5, 1)
	toasts.Position = UDim2.new(0.5, 0, 1, -70)
	toasts.Size = UDim2.new(0, 420, 0, 160)
	toasts.Parent = screen

	local toastLayout = Instance.new("UIListLayout")
	toastLayout.FillDirection = Enum.FillDirection.Vertical
	toastLayout.HorizontalAlignment = Enum.HorizontalAlignment.Center
	toastLayout.VerticalAlignment = Enum.VerticalAlignment.Bottom
	toastLayout.Padding = UDim.new(0, 6)
	toastLayout.Parent = toasts

	---------------------------------------------------------------- 환생 확인
	local shade = Instance.new("Frame")
	shade.Name = "RebirthModal"
	shade.BackgroundColor3 = Color3.fromRGB(0, 0, 0)
	shade.BackgroundTransparency = 0.45
	shade.BorderSizePixel = 0
	shade.Size = UDim2.fromScale(1, 1)
	shade.Visible = false
	shade.ZIndex = 20
	shade.Parent = screen

	local dialog = card(shade, {
		Name = "Dialog",
		AnchorPoint = Vector2.new(0.5, 0.5),
		Position = UDim2.fromScale(0.5, 0.5),
		Size = UDim2.new(0, 320, 0, 188),
		BackgroundTransparency = 0,
		ZIndex = 21,
	})

	text(dialog, {
		Size = UDim2.new(1, 0, 0, 24),
		Text = "환생",
		Font = Enum.Font.GothamBlack,
		TextSize = 20,
		TextColor3 = REBIRTH,
		TextXAlignment = Enum.TextXAlignment.Center,
		ZIndex = 22,
	})
	local dialogBody = text(dialog, {
		Position = UDim2.new(0, 0, 0, 32),
		Size = UDim2.new(1, 0, 0, 74),
		Text = "",
		TextSize = 14,
		TextWrapped = true,
		TextColor3 = MUTED,
		TextXAlignment = Enum.TextXAlignment.Center,
		ZIndex = 22,
	})

	local function button(label: string, xScale: number, color: Color3): TextButton
		local btn = Instance.new("TextButton")
		btn.AnchorPoint = Vector2.new(xScale, 1)
		btn.Position = UDim2.new(xScale, 0, 1, 0)
		btn.Size = UDim2.new(0.47, 0, 0, 40)
		btn.BackgroundColor3 = color
		btn.BorderSizePixel = 0
		btn.Font = Enum.Font.GothamBold
		btn.TextSize = 15
		btn.TextColor3 = Color3.fromRGB(14, 16, 20)
		btn.Text = label
		btn.AutoButtonColor = true
		btn.ZIndex = 22
		local corner = Instance.new("UICorner")
		corner.CornerRadius = UDim.new(0, 9)
		corner.Parent = btn
		btn.Parent = dialog
		return btn
	end

	local cancelButton = button("취소", 0, Color3.fromRGB(78, 86, 100))
	cancelButton.TextColor3 = INK
	local confirmButton = button("환생하기", 1, REBIRTH)

	local pendingConfirm: (() -> ())? = nil

	cancelButton.Activated:Connect(function()
		pendingConfirm = nil
		shade.Visible = false
	end)
	confirmButton.Activated:Connect(function()
		local callback = pendingConfirm
		pendingConfirm = nil
		shade.Visible = false
		if callback then
			callback()
		end
	end)

	screen.Parent = playerGui

	---------------------------------------------------------------- API
	local toastOrder = 0

	local function toast(message: string)
		toastOrder += 1
		local item = Instance.new("TextLabel")
		item.Name = "Toast"
		item.LayoutOrder = toastOrder
		item.Size = UDim2.new(1, 0, 0, 32)
		item.BackgroundColor3 = CARD
		item.BackgroundTransparency = 0.1
		item.BorderSizePixel = 0
		item.Font = Enum.Font.GothamMedium
		item.TextSize = 14
		item.TextColor3 = INK
		item.Text = message

		local corner = Instance.new("UICorner")
		corner.CornerRadius = UDim.new(0, 9)
		corner.Parent = item

		local stroke = Instance.new("UIStroke")
		stroke.Color = ACCENT
		stroke.Transparency = 0.7
		stroke.Parent = item

		item.Parent = toasts

		task.delay(TOAST_SECONDS, function()
			if not item.Parent then
				return
			end
			local info = TweenInfo.new(0.35, Enum.EasingStyle.Quad, Enum.EasingDirection.In)
			TweenService:Create(item, info, { BackgroundTransparency = 1, TextTransparency = 1 }):Play()
			TweenService:Create(stroke, info, { Transparency = 1 }):Play()
			task.delay(0.4, function()
				item:Destroy()
			end)
		end)
	end

	return {
		setCash = function(value: string)
			cashLabel.Text = value
		end,
		setIncome = function(value: string)
			incomeLabel.Text = value
		end,
		setMultiplier = function(value: string)
			multiplierLabel.Text = value
		end,
		setGoal = function(title: string, price: string)
			goalName.Text = title
			goalPrice.Text = price
		end,
		setHint = function(value: string?)
			hint.Visible = value ~= nil
			hintLabel.Text = value or ""
		end,
		toast = toast,
		askRebirth = function(priceText: string, onConfirm: () -> ())
			dialogBody.Text = `공장을 전부 비우고 돈이 0이 된다.\n대신 수입 배수가 영구히 올라간다.\n\n비용 {priceText}`
			pendingConfirm = onConfirm
			shade.Visible = true
		end,
	}
end

return Hud
