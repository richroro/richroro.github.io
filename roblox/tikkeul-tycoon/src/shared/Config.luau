--!strict
-- 게임 전체의 숫자와 좌표는 전부 여기 있다. 밸런스를 고치려면 이 파일만 건드린다.

export type Purchase = {
	id: string,
	name: string,
	price: number,
	requires: string?,
	row: "Dropper" | "Upgrade",
	slot: number,
	color: Color3,
	-- kind = "Dropper"
	dropValue: number?,
	dropInterval: number?,
	-- kind = "Upgrade"
	multiplier: number?,
	beltSpeed: number?,
	decor: string?,
	blurb: string,
}

local Config = {}

Config.DataStoreName = "TikkeulTycoon_v1"
Config.AutoSaveSeconds = 120
Config.StartingCash = 0

-- 클레임 즉시 공짜로 지어주는 첫 드로퍼. 이게 없으면 돈이 0인 채로 아무것도 못 산다.
Config.StarterDropper = {
	id = "dropper_1",
	name = "티끌 드로퍼",
	value = 5,
	interval = 1.0,
	slot = 1,
	color = Color3.fromRGB(150, 160, 172),
}

Config.Belt = {
	BaseSpeed = 14,
	Lifetime = 15, -- 이 시간이 지난 낙하물은 벨트에 끼었다고 보고 자동 정산한다
	MaxAlive = 90, -- 플롯당 살아있는 낙하물 상한
}

Config.Rebirth = {
	BasePrice = 1000000,
	PriceGrowth = 3.0, -- 가격 = BasePrice * PriceGrowth^환생횟수
	Multiplier = 2, -- 수입 배수 = Multiplier^환생횟수
}

Config.World = {
	LobbyZ = 150,
	LobbySize = Vector3.new(176, 2, 72),
	GroundSize = Vector3.new(2400, 4, 2400),
	-- Studio 기본 템플릿에 딸려오는 Baseplate/SpawnLocation 을 치운다.
	-- 직접 지은 맵에 얹을 거라면 false 로 둔다.
	ClearStudioDefaults = true,
}

Config.Plot = {
	Count = 6,
	Spacing = 128,
}

Config.Layout = {
	FloorSize = Vector3.new(96, 2, 96),
	BeltZ = -18,
	BeltWidth = 10,
	BeltTop = 3,
	BeltMinX = -38,
	BeltMaxX = 30,
	CollectorX = 38,
	CollectorTop = 2,
	DropperY = 11,
	-- 금고 흡입구(x = CollectorX - 12)에서 멀어지는 순서. 1번이 제일 가깝다.
	DropperSlotsX = { 16, 6, -4, -14, -24, -34 },
	DropperPadZ = 0,
	UpgradeSlotsX = { -28, -14, 0, 14, 28 },
	UpgradePadZ = 14,
	RebirthPadZ = 26,
	ClaimPadZ = 40,
	SignZ = 46,
	PadSize = Vector3.new(8, 1, 8),
}

Config.Palette = {
	Floor = Color3.fromRGB(58, 64, 74),
	FloorClaimed = Color3.fromRGB(44, 58, 78),
	Belt = Color3.fromRGB(38, 42, 50),
	Rail = Color3.fromRGB(70, 78, 90),
	Collector = Color3.fromRGB(32, 120, 96),
	CollectorGlow = Color3.fromRGB(96, 232, 176),
	PadLocked = Color3.fromRGB(78, 84, 94),
	PadAffordable = Color3.fromRGB(64, 196, 124),
	PadTooPricey = Color3.fromRGB(196, 84, 76),
	Claim = Color3.fromRGB(88, 144, 232),
	Rebirth = Color3.fromRGB(196, 132, 240),
	Lobby = Color3.fromRGB(46, 52, 62),
	Cash = Color3.fromRGB(120, 220, 160),
}

-- 진행 순서는 requires 사슬로만 정해진다. 중간에 하나 끼워 넣으려면
-- 그 다음 항목의 requires 를 새 id 로 바꾸면 된다.
Config.Purchases = {
	{
		id = "dropper_2",
		name = "동전 드로퍼",
		price = 100,
		requires = nil,
		row = "Dropper" :: "Dropper",
		slot = 2,
		color = Color3.fromRGB(198, 160, 88),
		dropValue = 12,
		dropInterval = 1.0,
		blurb = "초당 12",
	},
	{
		id = "belt_1",
		name = "컨베이어 개조 I",
		price = 350,
		requires = "dropper_2",
		row = "Upgrade" :: "Upgrade",
		slot = 1,
		color = Color3.fromRGB(96, 168, 228),
		multiplier = 1.3,
		beltSpeed = 20,
		blurb = "수입 x1.3",
	},
	{
		id = "dropper_3",
		name = "지폐 드로퍼",
		price = 900,
		requires = "belt_1",
		row = "Dropper" :: "Dropper",
		slot = 3,
		color = Color3.fromRGB(122, 196, 140),
		dropValue = 35,
		dropInterval = 1.1,
		blurb = "초당 32",
	},
	{
		id = "wall_1",
		name = "공장 벽",
		price = 2500,
		requires = "dropper_3",
		row = "Upgrade" :: "Upgrade",
		slot = 2,
		color = Color3.fromRGB(150, 156, 168),
		multiplier = 1.1,
		decor = "Walls",
		blurb = "분실 방지 x1.1",
	},
	{
		id = "dropper_4",
		name = "금고 드로퍼",
		price = 4500,
		requires = "wall_1",
		row = "Dropper" :: "Dropper",
		slot = 4,
		color = Color3.fromRGB(92, 176, 208),
		dropValue = 110,
		dropInterval = 1.0,
		blurb = "초당 110",
	},
	{
		id = "belt_2",
		name = "컨베이어 개조 II",
		price = 15000,
		requires = "dropper_4",
		row = "Upgrade" :: "Upgrade",
		slot = 3,
		color = Color3.fromRGB(96, 168, 228),
		multiplier = 1.4,
		beltSpeed = 28,
		blurb = "수입 x1.4",
	},
	{
		id = "dropper_5",
		name = "골드 드로퍼",
		price = 25000,
		requires = "belt_2",
		row = "Dropper" :: "Dropper",
		slot = 5,
		color = Color3.fromRGB(232, 188, 76),
		dropValue = 400,
		dropInterval = 1.0,
		blurb = "초당 400",
	},
	{
		id = "roof",
		name = "지붕",
		price = 70000,
		requires = "dropper_5",
		row = "Upgrade" :: "Upgrade",
		slot = 4,
		color = Color3.fromRGB(118, 124, 138),
		multiplier = 1.15,
		decor = "Roof",
		blurb = "수입 x1.15",
	},
	{
		id = "dropper_6",
		name = "케이던스 코어",
		price = 120000,
		requires = "roof",
		row = "Dropper" :: "Dropper",
		slot = 6,
		color = Color3.fromRGB(190, 120, 240),
		dropValue = 1500,
		dropInterval = 1.0,
		blurb = "초당 1500",
	},
	{
		id = "vault",
		name = "금고 확장",
		price = 400000,
		requires = "dropper_6",
		row = "Upgrade" :: "Upgrade",
		slot = 5,
		color = Color3.fromRGB(64, 212, 168),
		multiplier = 2.0,
		blurb = "수입 x2",
	},
} :: { Purchase }

local byId: { [string]: Purchase } = {}
local order: { string } = {}
for _, entry in Config.Purchases do
	byId[entry.id] = entry
	table.insert(order, entry.id)
end

Config.PurchaseById = byId
Config.PurchaseOrder = order

return Config
