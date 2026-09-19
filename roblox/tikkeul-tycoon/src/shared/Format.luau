--!strict
-- 돈 표기. 만/억/조 단위를 쓴다 (K/M/B 대신 한국식).

local Format = {}

local UNITS: { { value: number, suffix: string } } = {
	{ value = 1e16, suffix = "경" },
	{ value = 1e12, suffix = "조" },
	{ value = 1e8, suffix = "억" },
	{ value = 1e4, suffix = "만" },
}

local function comma(n: number): string
	local s = string.format("%d", n)
	while true do
		local replaced: number
		s, replaced = string.gsub(s, "^(-?%d+)(%d%d%d)", "%1,%2")
		if replaced == 0 then
			break
		end
	end
	return s
end

-- 1234 -> "1,234", 12345 -> "1.2만", 340000000 -> "3.4억"
function Format.cash(n: number): string
	if n < 0 then
		return "-" .. Format.cash(-n)
	end
	for _, unit in UNITS do
		if n >= unit.value then
			local scaled = n / unit.value
			if scaled >= 100 then
				return comma(math.floor(scaled)) .. unit.suffix
			end
			local text = string.format("%.1f", scaled)
			if string.sub(text, -2) == ".0" then
				text = string.sub(text, 1, -3)
			end
			return text .. unit.suffix
		end
	end
	return comma(math.floor(n))
end

-- 배수는 2, 2.5, 13.7 처럼 짧게
function Format.multiplier(n: number): string
	local text = string.format("%.1f", n)
	if string.sub(text, -2) == ".0" then
		text = string.sub(text, 1, -3)
	end
	return text
end

return Format
