-- ServerScriptService/Game/AbilityService.lua
local Moves = require(RS.Modules.Data.Moves)

local clamp01 = function(x) return math.max(0, math.min(1, x)) end

local function dotProps(props, comp)
	local s = 0
	for k,coef in pairs(props) do s += (comp[k] or 0) * coef end
	return s
end

local function baseFrom(move, caster, cat)
	local b = move.baseAtk or {}
	local m = move.atkMult or {}
	local cs = caster.stats or {}
	if cat == Moves.MoveCat.PHY then
		return (b.pAtk or 0) + (cs.pAtk or 0) * (m.pAtk or 0)
	else
		return (b.eAtk or 0) + (cs.eAtk or 0) * (m.eAtk or 0)
	end
end

local function computeDamage(moveId, atkTypeKey, caster, target)
	local tdef = target.composite or {}
	local moveType = Moves.MoveTypes[atkTypeKey]; if not moveType then return 0 end
	local cat = moveType.cat
	local move = (Moves.Melee[moveId] or Moves.Projectile[moveId])
	if not move then return 0 end

	local base = baseFrom(move, caster, cat)
	local flatBypass = clamp01(dotProps(moveType.flatBypass, tdef))
	local resist     = clamp01(dotProps(moveType.resistedBy, tdef))

	local after = base * (1 - flatBypass) * (1 - resist)
	if cat == Moves.MoveCat.PHY then
		local def = (target.stats and target.stats.def) or 0
		return math.max(1, math.floor(after - 0.3*def + 0.5))
	else
		return math.max(1, math.floor(after + 0.5))
	end
end

return { ComputeDamage = computeDamage }
