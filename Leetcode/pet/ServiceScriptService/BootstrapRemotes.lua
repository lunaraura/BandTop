-- ServerScriptService/BootstrapRemotes.server.lua
local RS = game:GetService("ReplicatedStorage")

local Remotes = RS:FindFirstChild("Remotes")
if not Remotes then
	Remotes = Instance.new("Folder")
	Remotes.Name = "Remotes"
	Remotes.Parent = RS
end
local function ensureEvent(name)
	local r = Remotes:FindFirstChild(name)
	if not (r and r:IsA("RemoteEvent")) then
		if r then r:Destroy() end
		r = Instance.new("RemoteEvent")
		r.Name = name
		r.Parent = Remotes
	end
	return r
end

local function ensureFunction(name)
	local r = Remotes:FindFirstChild(name)
	if not (r and r:IsA("RemoteFunction")) then
		if r then r:Destroy() end
		r = Instance.new("RemoteFunction")
		r.Name = name
		r.Parent = Remotes
	end
	return r
end

-- create all remotes
ensureEvent("BeginTutorial")
ensureEvent("StartGame")
ensureEvent("RequestWorld")
ensureEvent("AbilityToast")

ensureEvent("RosterChanged")
ensureFunction("RequestRoster")
ensureEvent("SetActiveCreature")
ensureEvent("UseAbility")
ensureEvent("ChooseStarter")
ensureEvent("SetRadius")

ensureEvent("InventoryChanged") 
ensureEvent("UseBerry")
