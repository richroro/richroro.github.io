--!strict
-- RemoteEvent 을 코드로 만든다. Studio 에서 손으로 넣어둘 것이 없게 하려는 것.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local FOLDER_NAME = "TikkeulNet"
local EVENT_NAMES = { "Notify", "RebirthPrompt", "RebirthConfirm" }
local WAIT_TIMEOUT = 20

local Net = {}

-- 서버에서만 호출한다. 여러 번 불러도 한 번만 만든다.
function Net.build(): Folder
	local existing = ReplicatedStorage:FindFirstChild(FOLDER_NAME)
	if existing and existing:IsA("Folder") then
		return existing
	end

	local folder = Instance.new("Folder")
	folder.Name = FOLDER_NAME
	for _, name in EVENT_NAMES do
		local event = Instance.new("RemoteEvent")
		event.Name = name
		event.Parent = folder
	end
	folder.Parent = ReplicatedStorage
	return folder
end

function Net.event(name: string): RemoteEvent
	local folder: Instance?
	if RunService:IsServer() then
		folder = Net.build()
	else
		folder = ReplicatedStorage:WaitForChild(FOLDER_NAME, WAIT_TIMEOUT)
	end
	assert(folder, `{FOLDER_NAME} 폴더를 찾지 못했다 — 서버 스크립트가 켜져 있는지 확인`)

	local event = folder:WaitForChild(name, WAIT_TIMEOUT)
	assert(event and event:IsA("RemoteEvent"), `RemoteEvent '{name}' 을 찾지 못했다`)
	return event
end

return Net
