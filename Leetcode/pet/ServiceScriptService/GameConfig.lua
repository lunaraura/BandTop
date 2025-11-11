local RS = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")

local Remotes      = RS:WaitForChild("Remotes")
local SetRadius    = Remotes:WaitForChild("SetRadius")
local ChooseStarter= Remotes:WaitForChild("ChooseStarter")

local MIN_R, MAX_R = 3, 7
local STARTERS     = { "Pyro", "Aqua", "Terra" }

Players.PlayerAdded:Connect(function(p)
	p:SetAttribute("RadiusChunks", 3)
	p:SetAttribute("StarterChosen", false)
	p:SetAttribute("StarterId", "")
end)

SetRadius.OnServerEvent:Connect(function(p, r)
	if typeof(r) ~= "number" then return end
	r = math.clamp(math.floor(r), MIN_R, MAX_R)
	p:SetAttribute("RadiusChunks", r)
end)

ChooseStarter.OnServerEvent:Connect(function(p, id)
	if p:GetAttribute("StarterChosen") then return end
	if table.find(STARTERS, id) then
		p:SetAttribute("StarterChosen", true)
		p:SetAttribute("StarterId", id)
	end
end)
