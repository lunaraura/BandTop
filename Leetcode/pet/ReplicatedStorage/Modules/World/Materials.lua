-- ReplicatedStorage/Modules/World/Materials.lua
local Biomes = require(script.Parent:WaitForChild("Biomes"))

local M = {}

function M.pickMaterials(weights)
	local best, bestW = "Meadow", -1
	for k,w in pairs(weights) do if w > bestW then best, bestW = k, w end end
	local b = Biomes[best] or Biomes.Meadow
	return b.ground, b.high, best
end

return M

