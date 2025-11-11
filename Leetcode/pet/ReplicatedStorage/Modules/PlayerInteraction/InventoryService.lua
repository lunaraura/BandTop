-- Module: InventoryService
local InventoryService = {}
local Players = game:GetService("Players")
local RS = game:GetService("ReplicatedStorage")
local Remotes = RS:WaitForChild("Remotes")
local InventoryChanged: RemoteEvent = Remotes:WaitForChild("InventoryChanged")

local INV: {[number]: {red:number,yellow:number,blue:number}} = {}

local function ensure(p: Player)
	local t = INV[p.UserId]
	if not t then t = {red=0,yellow=0,blue=0}; INV[p.UserId] = t end
	return t
end

function InventoryService.Snapshot(p: Player)
	local t = ensure(p)
	return {red=t.red, yellow=t.yellow, blue=t.blue}
end

function InventoryService.Give(p: Player, kind: "red"|"yellow"|"blue", amt: number?)
	local t = ensure(p); amt = amt or 1
	t[kind] = (t[kind] or 0) + amt
	InventoryChanged:FireClient(p, InventoryService.Snapshot(p))
end

function InventoryService.TryUse(p: Player, kind: "red"|"yellow"|"blue"): boolean
	local t = ensure(p)
	if (t[kind] or 0) <= 0 then return false end
	t[kind] -= 1
	InventoryChanged:FireClient(p, InventoryService.Snapshot(p))
	return true
end

Players.PlayerRemoving:Connect(function(p) INV[p.UserId] = nil end)

return InventoryService
