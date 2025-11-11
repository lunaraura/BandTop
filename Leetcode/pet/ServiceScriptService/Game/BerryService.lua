local Players = game:GetService("Players")
local RS = game:GetService("ReplicatedStorage")
local CollectionService = game:GetService("CollectionService")
local Remotes = RS:WaitForChild("Remotes")
local UseBerry: RemoteEvent = Remotes:WaitForChild("UseBerry")
local RS       = game:GetService("ReplicatedStorage")
local Modules  = RS:WaitForChild("Modules")
local Inventory = require(game.ReplicatedStorage.Modules.PlayerInteraction.InventoryService)


-- effect hook
local function applyBerryEffect(p: Player, kind: string)
	-- TODO: call your CreatureService here
	if kind == "red" then
		print(("Heal used by %s"):format(p.Name))
	elseif kind == "yellow" then
		print(("Strength used by %s"):format(p.Name))
	elseif kind == "blue" then
		print(("Revive used by %s"):format(p.Name))
	end
end

-- picking from bush
local function hookBush(bush: BasePart)
	local prompt = bush:FindFirstChildOfClass("ProximityPrompt"); if not prompt then return end
	local busy = false
	prompt.Triggered:Connect(function(plr: Player)
		if busy then return end; busy = true
		local kind = bush:GetAttribute("BerryKind")
		local uses = math.max(0, (bush:GetAttribute("Uses") or 0))
		if (kind == "red" or kind == "yellow" or kind == "blue") and uses > 0 then
			Inventory.Give(plr, kind, 1)
			uses -= 1; bush:SetAttribute("Uses", uses)
			if bush.Size.X > 3 then
				bush.Size -= Vector3.new(0.4,0.4,0.4)
				bush.CFrame += Vector3.new(0, -0.2, 0)
			end
			if uses <= 0 then bush:Destroy() end
		end
		busy = false
	end)
end

for _,inst in ipairs(CollectionService:GetTagged("BerryBush")) do
	if inst:IsA("BasePart") then hookBush(inst) end
end
CollectionService:GetInstanceAddedSignal("BerryBush"):Connect(function(inst)
	if inst:IsA("BasePart") then hookBush(inst) end
end)

-- using a berry from UI
UseBerry.OnServerEvent:Connect(function(p: Player, kind: string)
	if kind ~= "red" and kind ~= "yellow" and kind ~= "blue" then return end
	if Inventory.TryUse(p, kind) then
		applyBerryEffect(p, kind)
	end
end)
