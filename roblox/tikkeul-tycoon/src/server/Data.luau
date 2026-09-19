--!strict
-- DataStore 래퍼.
--
-- Studio 에서 "Enable Studio Access to API Services" 를 안 켜면 DataStore 호출이
-- 예외를 던진다. 그 상태로도 게임은 돌아가야 하므로, 열기에 실패하면 저장 없이
-- 메모리로만 진행하고 경고 한 줄만 남긴다.

local DataStoreService = game:GetService("DataStoreService")

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("TikkeulTycoon")
local Config = require(Shared:WaitForChild("Config"))

export type Profile = {
	cash: number,
	rebirths: number,
	owned: { [string]: boolean },
}

local Data = {}

local RETRIES = 3
local store: DataStore? = nil
local storeBroken = false

local function getStore(): DataStore?
	if store then
		return store
	end
	if storeBroken then
		return nil
	end

	local ok, result = pcall(function()
		return DataStoreService:GetDataStore(Config.DataStoreName)
	end)
	if ok then
		store = result
		return result
	end

	storeBroken = true
	warn(`[티끌 타이쿤] DataStore 를 열지 못했다. 이번 세션은 저장 없이 돌아간다 — {result}`)
	warn("[티끌 타이쿤] Studio 라면 Game Settings > Security > Enable Studio Access to API Services 를 켜면 된다.")
	return nil
end

function Data.default(): Profile
	return {
		cash = Config.StartingCash,
		rebirths = 0,
		owned = {},
	}
end

-- 저장된 값을 그대로 믿지 않는다. 숫자가 아니거나 없는 구매 id 는 버린다.
local function sanitize(raw: any): Profile
	local profile = Data.default()
	if typeof(raw) ~= "table" then
		return profile
	end

	local cash = raw.cash
	if typeof(cash) == "number" and cash == cash and cash >= 0 then
		profile.cash = math.floor(math.min(cash, 1e15))
	end

	local rebirths = raw.rebirths
	if typeof(rebirths) == "number" and rebirths == rebirths and rebirths >= 0 then
		profile.rebirths = math.floor(math.min(rebirths, 1000))
	end

	if typeof(raw.owned) == "table" then
		for id in Config.PurchaseById do
			if raw.owned[id] == true then
				profile.owned[id] = true
			end
		end
	end

	return profile
end

-- 두 번째 반환값이 false 면 "읽기에 실패했다" 는 뜻이다. 그 세션은 저장하면 안 된다.
-- 실패를 기본값으로 간주하고 덮어쓰면 남의 진행도를 통째로 날린다.
function Data.load(userId: number): (Profile, boolean)
	local dataStore = getStore()
	if not dataStore then
		return Data.default(), false
	end

	local key = `player_{userId}`
	for attempt = 1, RETRIES do
		local ok, result = pcall(function()
			return dataStore:GetAsync(key)
		end)
		if ok then
			return sanitize(result), true
		end
		warn(`[티끌 타이쿤] 불러오기 실패 ({attempt}/{RETRIES}) user={userId} — {result}`)
		if attempt < RETRIES then
			task.wait(2 ^ attempt)
		end
	end

	return Data.default(), false
end

function Data.save(userId: number, profile: Profile): boolean
	local dataStore = getStore()
	if not dataStore then
		return false
	end

	local payload = {
		version = 1,
		cash = math.floor(profile.cash),
		rebirths = profile.rebirths,
		owned = profile.owned,
		savedAt = os.time(),
	}

	local key = `player_{userId}`
	for attempt = 1, RETRIES do
		local ok, err = pcall(function()
			dataStore:UpdateAsync(key, function()
				return payload
			end)
		end)
		if ok then
			return true
		end
		warn(`[티끌 타이쿤] 저장 실패 ({attempt}/{RETRIES}) user={userId} — {err}`)
		if attempt < RETRIES then
			task.wait(2 ^ attempt)
		end
	end

	return false
end

return Data
