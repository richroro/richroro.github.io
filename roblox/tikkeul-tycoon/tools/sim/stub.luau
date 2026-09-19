--!nonstrict
-- Roblox 흉내내기. Plot/World/Economy 를 실제로 실행해보기 위한 최소 구현.

local PROPS, CHILDREN, EVENTS_OF, ATTRS = {}, {}, {}, {}
ALL_INSTANCES = {}

local EVENT_KEYS = {
	Touched = true, Destroying = true, Changed = true, ChildAdded = true,
	OnServerEvent = true, OnClientEvent = true, Activated = true,
}
local BASEPARTS = { Part = true, SpawnLocation = true }

local function newEvent()
	local handlers = {}
	local event = { _handlers = handlers }
	function event:Connect(fn)
		table.insert(handlers, fn)
		return { Disconnect = function() end, Connected = true }
	end
	event.Once = event.Connect
	function event:Fire(...)
		for _, fn in table.clone(handlers) do
			fn(...)
		end
	end
	return event
end

local methods = {}

local function eventOf(obj, key)
	local bag = EVENTS_OF[obj]
	if not bag[key] then
		bag[key] = newEvent()
	end
	return bag[key]
end

local function detach(obj)
	local parent = PROPS[obj].Parent
	if parent and CHILDREN[parent] then
		local list = CHILDREN[parent]
		for i, child in list do
			if child == obj then
				table.remove(list, i)
				break
			end
		end
	end
end

function methods.Destroy(self)
	detach(self)
	PROPS[self].Parent = nil
	local bag = EVENTS_OF[self]
	if bag.Destroying then
		bag.Destroying:Fire()
	end
	for _, child in table.clone(CHILDREN[self]) do
		child:Destroy()
	end
	PROPS[self]._destroyed = true
end

function methods.ClearAllChildren(self)
	for _, child in table.clone(CHILDREN[self]) do
		child:Destroy()
	end
end

function methods.GetChildren(self)
	return table.clone(CHILDREN[self])
end

function methods.FindFirstChild(self, name)
	for _, child in CHILDREN[self] do
		if PROPS[child].Name == name then
			return child
		end
	end
	return nil
end

function methods.FindFirstChildOfClass(self, className)
	for _, child in CHILDREN[self] do
		if PROPS[child].ClassName == className then
			return child
		end
	end
	return nil
end

function methods.FindFirstAncestorOfClass(self, className)
	local node = PROPS[self].Parent
	while node do
		if PROPS[node] and PROPS[node].ClassName == className then
			return node
		end
		node = PROPS[node] and PROPS[node].Parent
	end
	return nil
end

function methods.WaitForChild(self, name)
	return methods.FindFirstChild(self, name)
end

function methods.IsA(self, className)
	local own = PROPS[self].ClassName
	if own == className or className == "Instance" then
		return true
	end
	if className == "BasePart" then
		return BASEPARTS[own] == true
	end
	return false
end

function methods.SetAttribute(self, name, value)
	ATTRS[self][name] = value
end

function methods.GetAttribute(self, name)
	return ATTRS[self][name]
end

function methods.GetAttributeChangedSignal(self, name)
	return eventOf(self, "Attr_" .. name)
end

-- RemoteEvent
function methods.FireClient(self, player, ...)
	FIRED_TO_CLIENT = (FIRED_TO_CLIENT or 0) + 1
	LAST_NOTIFY = ...
end
function methods.FireServer(self, ...) end

Instance = {}

function Instance.new(className, parent)
	-- 빈 테이블에 메타테이블만 건다. rawset 을 절대 안 하므로
	-- __index/__newindex 가 모든 키에서 돈다.
	local obj = {}
	local meta = {}

	PROPS[obj] = { ClassName = className, Name = className, Parent = nil }
	CHILDREN[obj] = {}
	EVENTS_OF[obj] = {}
	ATTRS[obj] = {}
	table.insert(ALL_INSTANCES, obj)

	meta.__index = function(_, key)
		if methods[key] then
			return methods[key]
		end
		if EVENT_KEYS[key] then
			return eventOf(obj, key)
		end
		-- 실제 BasePart 는 Position 을 CFrame 에서 파생시킨다.
		if key == "Position" and PROPS[obj].CFrame and PROPS[obj].Position == nil then
			return PROPS[obj].CFrame.Position
		end
		return PROPS[obj][key]
	end
	meta.__newindex = function(_, key, value)
		if key == "Parent" then
			detach(obj)
			PROPS[obj].Parent = value
			if value ~= nil then
				table.insert(CHILDREN[value], obj)
			end
			return
		end
		PROPS[obj][key] = value
	end
	meta.__tostring = function()
		return `{PROPS[obj].ClassName}({PROPS[obj].Name})`
	end
	setmetatable(obj, meta)

	if parent then
		obj.Parent = parent
	end
	return obj
end

---------------------------------------------------------------- 값 타입
local vectorMeta = {}
vectorMeta.__index = vectorMeta
vectorMeta.__add = function(a, b)
	return Vector3.new(a.X + b.X, a.Y + b.Y, a.Z + b.Z)
end
vectorMeta.__mul = function(a, k)
	if type(k) == "number" then
		return Vector3.new(a.X * k, a.Y * k, a.Z * k)
	end
	return Vector3.new(a.X * k.X, a.Y * k.Y, a.Z * k.Z)
end
vectorMeta.__tostring = function(v)
	return string.format("(%.1f, %.1f, %.1f)", v.X, v.Y, v.Z)
end

Vector3 = {}
function Vector3.new(x, y, z)
	return setmetatable({ X = x or 0, Y = y or 0, Z = z or 0 }, vectorMeta)
end
Vector3.zero = Vector3.new(0, 0, 0)

Vector2 = {}
function Vector2.new(x, y)
	return { X = x or 0, Y = y or 0 }
end

-- 이 게임은 회전을 안 쓴다. 평행이동만 맞으면 충분하다.
local cframeMeta = {}
cframeMeta.__index = cframeMeta
cframeMeta.__mul = function(a, b)
	return CFrame.new(a.Position.X + b.Position.X, a.Position.Y + b.Position.Y, a.Position.Z + b.Position.Z)
end

CFrame = {}
function CFrame.new(x, y, z)
	return setmetatable({
		Position = Vector3.new(x, y, z),
		RightVector = Vector3.new(1, 0, 0),
		LookVector = Vector3.new(0, 0, -1),
	}, cframeMeta)
end

Color3 = {}
function Color3.fromRGB(r, g, b)
	return { R = r / 255, G = g / 255, B = b / 255 }
end

UDim = { new = function(s, o) return { Scale = s, Offset = o } end }
UDim2 = {
	new = function(xs, xo, ys, yo) return { xs = xs, xo = xo, ys = ys, yo = yo } end,
	fromScale = function(x, y) return { xs = x, xo = 0, ys = y, yo = 0 } end,
}
TweenInfo = { new = function(...) return { ... } end }

-- Enum.<Category>.<Item> 를 아무거나 받아준다.
Enum = setmetatable({}, {
	__index = function(self, category)
		local bucket = setmetatable({}, {
			__index = function(inner, item)
				local value = { EnumType = category, Name = item }
				rawset(inner, item, value)
				return value
			end,
		})
		rawset(self, category, bucket)
		return bucket
	end,
})

---------------------------------------------------------------- 서비스
local function makeService(className)
	local service = Instance.new(className)
	service.Name = className
	return service
end

workspace = makeService("Workspace")

local services = {
	ReplicatedStorage = makeService("ReplicatedStorage"),
	Lighting = makeService("Lighting"),
	Workspace = workspace,
}

local playersService = makeService("Players")
local playerList = {}
function playersService:GetPlayers()
	return table.clone(playerList)
end
function playersService:GetPlayerFromCharacter(character)
	for _, player in playerList do
		if player.Character == character then
			return player
		end
	end
	return nil
end
services.Players = playersService

local runService = makeService("RunService")
function runService:IsServer()
	return true
end
services.RunService = runService

-- 기본은 실패. DATASTORE_OK = true 로 켜면 메모리 저장소가 된다.
DATASTORE_OK = false
DATASTORE_GET_FAILS = false
DATASTORE_MEMORY = {}
DATASTORE_CALLS = { get = 0, update = 0 }

local dataStoreService = makeService("DataStoreService")
function dataStoreService:GetDataStore(_name)
	if not DATASTORE_OK then
		error("API services are not enabled (stub)")
	end
	local store = {}
	function store:GetAsync(key)
		DATASTORE_CALLS.get += 1
		if DATASTORE_GET_FAILS then
			error("DataStoreService: GetAsync request dropped (stub)")
		end
		return DATASTORE_MEMORY[key]
	end
	function store:UpdateAsync(key, transform)
		DATASTORE_CALLS.update += 1
		DATASTORE_MEMORY[key] = transform(DATASTORE_MEMORY[key])
		return DATASTORE_MEMORY[key]
	end
	return store
end
services.DataStoreService = dataStoreService

game = {
	GetService = function(_, name)
		assert(services[name], `stub: 서비스 {name} 없음`)
		return services[name]
	end,
	BindToClose = function(_, fn)
		SHUTDOWN_HOOK = fn
	end,
}

---------------------------------------------------------------- 테스트용 도우미
function makePlayer(name, userId)
	local player = Instance.new("Player")
	player.Name = name
	player.DisplayName = name
	player.UserId = userId
	player.Parent = playersService

	local character = Instance.new("Model")
	character.Name = name
	Instance.new("Humanoid", character)
	local root = Instance.new("Part", character)
	root.Name = "HumanoidRootPart"
	player.Character = character

	table.insert(playerList, player)
	return player, root
end

function removePlayer(player)
	for i, p in playerList do
		if p == player then
			table.remove(playerList, i)
			break
		end
	end
	player.Parent = nil
end

function partsUnder(root, out)
	out = out or {}
	for _, child in CHILDREN[root] do
		if BASEPARTS[PROPS[child].ClassName] then
			table.insert(out, child)
		end
		partsUnder(child, out)
	end
	return out
end
