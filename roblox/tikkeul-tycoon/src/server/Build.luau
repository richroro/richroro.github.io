--!strict
-- 파트/표지판 만드는 잡일. 맵을 전부 코드로 짓기 때문에 이 파일이 제일 많이 불린다.

local Build = {}

-- 속성 가방을 { [string]: any } 로 두면 오타가 런타임까지 살아남는다.
-- 실제로 쓰는 키만 적어두면 타입 검사기가 이름과 값 타입을 둘 다 잡아준다.
export type PartProps = {
	Name: string?,
	Size: Vector3?,
	CFrame: CFrame?,
	Color: Color3?,
	Material: Enum.Material?,
	Anchored: boolean?,
	CanCollide: boolean?,
	CanTouch: boolean?,
	CanQuery: boolean?,
	Transparency: number?,
	Massless: boolean?,
	Parent: Instance?,
}

export type LabelProps = {
	Name: string?,
	LayoutOrder: number?,
	Size: UDim2?,
	Position: UDim2?,
	AnchorPoint: Vector2?,
	Text: string?,
	TextColor3: Color3?,
	TextSize: number?,
	TextScaled: boolean?,
	TextWrapped: boolean?,
	TextXAlignment: Enum.TextXAlignment?,
	TextYAlignment: Enum.TextYAlignment?,
	Font: Enum.Font?,
	RichText: boolean?,
	BackgroundTransparency: number?,
	ZIndex: number?,
}

-- Parent 는 항상 마지막에 세팅한다. 먼저 붙이면 속성 하나 바꿀 때마다
-- 복제가 일어나서 맵 생성이 눈에 띄게 느려진다.
function Build.part(props: PartProps): Part
	local part = Instance.new("Part")
	part.Anchored = true
	part.Material = Enum.Material.SmoothPlastic
	part.TopSurface = Enum.SurfaceType.Smooth
	part.BottomSurface = Enum.SurfaceType.Smooth

	local parent = props.Parent
	for key, value in props :: { [string]: any } do
		if key ~= "Parent" then
			(part :: any)[key] = value
		end
	end
	part.Parent = parent
	return part
end

-- 카메라를 항상 바라보는 라벨. 구매 패드 위에 띄우는 용도.
function Build.billboard(adornee: BasePart, width: number, height: number, studsOffsetY: number): BillboardGui
	local gui = Instance.new("BillboardGui")
	gui.Name = "Label"
	gui.Adornee = adornee
	gui.Size = UDim2.fromScale(width, height)
	gui.SizeOffset = Vector2.new(0, 0)
	gui.StudsOffsetWorldSpace = Vector3.new(0, studsOffsetY, 0)
	gui.AlwaysOnTop = false
	gui.MaxDistance = 180
	gui.LightInfluence = 0
	gui.Parent = adornee
	return gui
end

function Build.label(parent: Instance, props: LabelProps): TextLabel
	local label = Instance.new("TextLabel")
	label.BackgroundTransparency = 1
	label.BorderSizePixel = 0
	label.Font = Enum.Font.GothamBold
	label.TextColor3 = Color3.fromRGB(255, 255, 255)
	label.TextScaled = true
	label.TextStrokeTransparency = 0.55
	label.RichText = true
	for key, value in props :: { [string]: any } do
		(label :: any)[key] = value
	end
	label.Parent = parent
	return label
end

-- 판때기에 글자를 박는다. 플롯 주인 간판처럼 고정 방향일 때 쓴다.
function Build.surfaceText(part: BasePart, face: Enum.NormalId): TextLabel
	local gui = Instance.new("SurfaceGui")
	gui.Face = face
	gui.CanvasSize = Vector2.new(400, 160)
	gui.LightInfluence = 0
	gui.Parent = part

	return Build.label(gui, {
		Size = UDim2.fromScale(1, 1),
		Text = "",
	})
end

function Build.light(parent: BasePart, color: Color3, brightness: number, range: number)
	local light = Instance.new("PointLight")
	light.Color = color
	light.Brightness = brightness
	light.Range = range
	light.Shadows = false
	light.Parent = parent
end

return Build
