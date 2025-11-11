-- ReplicatedStorage/Modules/World/BiomeNoise.lua
local P = require(script.Parent.WorldParams)
local clamp = math.clamp
local cache = {} -- "ix|iz" -> weights table

local function weightsAtCell(ix, iz, seed)
	local k = ix.."|"..iz
	local hit = cache[k]; if hit then return hit end

	local x = (ix + 0.5) * P.CELL
	local z = (iz + 0.5) * P.CELL
	local T = clamp(0.5 + 0.5*math.noise(x*0.00035, z*0.00035, (seed or 0)*0.11), 0, 1)
	local W = clamp(0.5 + 0.5*math.noise(x*0.00070, z*0.00070, (seed or 0)*0.37), 0, 1)

	local wTaiga  = (1-T)*(1-W)
	local wMeadow = T*(1-W)
	local wSwamp  = (1-T)*W*0.7 + T*W*0.3

	local coast   = 0.5 + 0.5*math.noise(x*0.00090, z*0.00090, (seed or 0)*0.59)
	local nearCoast = clamp(1 - math.abs(coast - 0.5)*8, 0, 1)
	local wBeach = nearCoast * 0.9

	local s = wTaiga + wMeadow + wSwamp + wBeach
	local out = (s<1e-6) and {Meadow=1} or {
		Taiga=wTaiga/s, Meadow=wMeadow/s, Swamp=wSwamp/s, Beach=wBeach/s
	}
	cache[k] = out
	return out
end

local function addScaled(out, t, s)
	for k,v in pairs(t) do out[k]=(out[k] or 0)+v*s end
end

local M = {}
function M.biomeMix(x, z, seed)
	local gx, gz = math.floor(x/P.CELL), math.floor(z/P.CELL)
	local fx, fz = x/P.CELL - gx, z/P.CELL - gz
	local w00 = weightsAtCell(gx+0, gz+0, seed)
	local w10 = weightsAtCell(gx+1, gz+0, seed)
	local w01 = weightsAtCell(gx+0, gz+1, seed)
	local w11 = weightsAtCell(gx+1, gz+1, seed)
	local out = {}
	addScaled(out, w00, (1-fx)*(1-fz))
	addScaled(out, w10, (  fx)*(1-fz))
	addScaled(out, w01, (1-fx)*(  fz))
	addScaled(out, w11, (  fx)*(  fz))
	local s=0 for _,v in pairs(out) do s+=v end
	if s>1e-6 then for k,v in pairs(out) do out[k]=v/s end end
	return out
end
return M
