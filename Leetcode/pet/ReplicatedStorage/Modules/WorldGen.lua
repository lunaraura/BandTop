-- ReplicatedStorage/Modules/WorldGen.lua
local Params     = require(script.Parent.World.WorldParams)
local BiomeNoise = require(script.Parent.World.BiomeNoise)
local RS      = game:GetService("ReplicatedStorage")
local Modules = RS:WaitForChild("Modules")
local World   = Modules:WaitForChild("World")

local Height = require(World:WaitForChild("Heightfield"))
local Materials   = require(World:WaitForChild("Materials"))

local M = {}
function M.biomeMix(x,z,seed) return BiomeNoise.biomeMix(x,z, seed or Params.SEED) end
function M.heightAt(x,z,seed) return Height.sample(x,z, seed or Params.SEED) end
function M.pickMaterials(weights) return Materials.pickMaterials(weights) end
return M
