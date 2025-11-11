-- ServerScriptService/Starters.server.lua
local Players = game:GetService("Players")

local function spawnStarter(p, id)
	local char = p.Character or p.CharacterAdded:Wait()
	local hrp = char:WaitForChild("HumanoidRootPart")
	local pet = Instance.new("Part"); pet.Shape=Enum.PartType.Ball; pet.Size=Vector3.new(2,2,2)
	pet.Color = (id=="Pyro" and Color3.new(1,0.3,0.2)) or (id=="Aqua" and Color3.new(0.2,0.4,1)) or Color3.new(0.2,0.8,0.3)
	pet.Anchored=true; pet.CanCollide=false; pet.Parent=workspace
	task.spawn(function()
		while pet.Parent do
			if hrp.Parent then pet.CFrame = hrp.CFrame * CFrame.new(2,2,-2) end
			task.wait(0.1)
		end
	end)
end

Players.PlayerAdded:Connect(function(p)
	p:GetAttributeChangedSignal("StarterChosen"):Connect(function()
		if p:GetAttribute("StarterChosen") and (p:GetAttribute("StarterId") or "") ~= "" then
			spawnStarter(p, p:GetAttribute("StarterId"))
		end
	end)
end)
