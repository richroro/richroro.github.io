--!nonstrict
-- 가상 시계 + 협조적 스케줄러. task.wait 를 coroutine.yield 로 바꿔서
-- 무한 루프를 한 틱씩 손으로 돌린다.

VCLOCK = 0
WARNINGS = {}

local threads = {}
local delayed = {}
local EPS = 1e-6

local function settle(entry, ok, waited)
	if not ok then
		error(`thread failed at t={VCLOCK}: {waited}`, 0)
	end
	if coroutine.status(entry.co) == "dead" then
		entry.dead = true
	else
		-- task.wait(n) 이 n 을 yield 한다. 그만큼 재워둬야 120초 autosave 가
		-- 0.1초마다 도는 일이 안 생긴다.
		entry.wakeAt = VCLOCK + (tonumber(waited) or 0)
	end
end

local task = {
	spawn = function(fn, ...)
		local entry = { co = coroutine.create(fn), wakeAt = VCLOCK }
		table.insert(threads, entry)
		settle(entry, coroutine.resume(entry.co, ...))
		return entry.co
	end,
	wait = function(seconds)
		coroutine.yield(seconds or 0)
		return seconds or 0
	end,
	delay = function(seconds, fn, ...)
		table.insert(delayed, { at = VCLOCK + seconds, fn = fn, args = table.pack(...) })
	end,
}

local os = {
	clock = function()
		return VCLOCK
	end,
	time = function()
		return 1700000000
	end,
}

local function warn(...)
	table.insert(WARNINGS, table.concat({ ... }, " "))
end

function step(count, dt)
	for _ = 1, count do
		VCLOCK += dt
		for _, entry in table.clone(threads) do
			if not entry.dead
				and coroutine.status(entry.co) == "suspended"
				and VCLOCK + EPS >= entry.wakeAt then
				settle(entry, coroutine.resume(entry.co))
			end
		end
		for i = #delayed, 1, -1 do
			if VCLOCK + EPS >= delayed[i].at then
				local item = table.remove(delayed, i)
				item.fn(table.unpack(item.args, 1, item.args.n))
			end
		end
	end
end

function liveThreads()
	local n = 0
	for _, entry in threads do
		if not entry.dead and coroutine.status(entry.co) == "suspended" then
			n += 1
		end
	end
	return n
end
