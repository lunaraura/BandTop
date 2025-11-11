-- ReplicatedStorage/Modules/Stats.lua
local Families  = require(script.Parent.Data.Families)
local Comps     = require(script.Parent.Data.Composites)

local M = {}

local function rollIV(r, lo, hi)
	return lo + r:NextInteger(0, hi - lo)
end

function M.RollIVs(rng, familyKey)
	local f = Families[familyKey]; if not f then return nil end
	local iv, R = {}, f.ivRange
	iv.hp   = rollIV(rng, R.hp[1],   R.hp[2])
	iv.pAtk = rollIV(rng, R.pAtk[1], R.pAtk[2])
	iv.eAtk = rollIV(rng, R.eAtk[1], R.eAtk[2])
	iv.def  = rollIV(rng, R.def[1],  R.def[2])
	iv.spd  = rollIV(rng, R.spd[1],  R.spd[2])
	iv.cast = rollIV(rng, R.cast[1], R.cast[2])
	return iv
end

local function levelGain(growth, lvl)
	-- linear growth; replace with curve if needed
	return {
		hp   = math.floor(growth.hp   * (lvl-1)),
		pAtk = math.floor(growth.pAtk * (lvl-1)),
		eAtk = math.floor(growth.eAtk * (lvl-1)),
		def  = math.floor(growth.def  * (lvl-1)),
		spd  = math.floor(growth.spd  * (lvl-1)),
		cast = math.floor(growth.cast * (lvl-1)),
	}
end

function M.ComputeFinal(familyKey, level, iv, innerKey, outerKey)
	local f = Families[familyKey]; if not f then return nil end
	local base, growth = f.base, f.growth
	local lv = levelGain(growth, math.max(level,1))
	local inner = Comps[innerKey] or {power=1,speed=1,physResist=0,energyResist=0,density=1}
	local outer = Comps[outerKey] or inner

	local powerMul = (inner.power + outer.power) * 0.5
	local speedMul = (inner.speed + outer.speed) * 0.5

	local s = {}
	s.maxHP = math.max(1, base.hp + iv.hp + lv.hp)
	s.pAtk  = math.max(1, math.floor((base.pAtk + iv.pAtk + lv.pAtk) * powerMul))
	s.eAtk  = math.max(1, math.floor((base.eAtk + iv.eAtk + lv.eAtk) * powerMul))
	s.def   = math.max(0, base.def + iv.def + lv.def)
	s.spd   = math.max(1, math.floor((base.spd + iv.spd + lv.spd) * speedMul))
	s.cast  = math.max(1, base.cast + iv.cast + lv.cast)

	s.physResist   = math.clamp((inner.physResist + outer.physResist) * 0.5, 0, 0.9)
	s.energyResist = math.clamp((inner.energyResist + outer.energyResist) * 0.5, 0, 0.9)
	s.density      = (inner.density + outer.density) * 0.5
	return s
end

return M
