-- StarterPlayerScripts/EntityClient.client.lua
local RS     = game:GetService("ReplicatedStorage")
local Rem    = RS:WaitForChild("Remotes")
local ESpawn = Rem:WaitForChild("EntitySpawned")
local EDes   = Rem:WaitForChild("EntityDespawned")
local EState = Rem:WaitForChild("EntityState")

local folder = workspace:FindFirstChild("Entities") or Instance.new("Folder", workspace)
folder.Name = "Entities"

local G = {} -- id -> {model, pos}

local function makeModel(family)
	local p = Instance.new("Part")
	p.Anchored = true; p.Size = Vector3.new(2,2,2); p.Color = Color3.fromRGB(200,200,255)
	return p
end

ESpawn.OnClientEvent:Connect(function(s)
	local m = makeModel(s.family)
	m.CFrame = CFrame.new(s.pos)
	m.Parent = folder
	G[s.id] = {model=m, pos=s.pos}
end)

EDes.OnClientEvent:Connect(function(id)
	local g = G[id]; if not g then return end
	if g.model then g.model:Destroy() end
	G[id] = nil
end)

EState.OnClientEvent:Connect(function(upd)
	local g = G[upd.id]; if not g then return end
	if upd.pos then
		g.pos = upd.pos
		g.model.CFrame = CFrame.new(upd.pos)
	end
	-- hp/anim handling omitted for brevity
end)
