-- ServerScriptService/Game/BrainService.server.lua
local Ability = require(script.Parent.AbilityService)

local Brain = {}

local function dist2(a, b) return (a.pos - b.pos).Magnitude end

function Brain.MakeBrain(family: string)
	-- trivial FSM by family; expand later
	return {state="idle", t=0, range=25, atkRange=6, speed=10}
end

function Brain.Tick(e, dt, Entity)
	local b = e.brain
	b.t += dt

	-- acquire nearest enemy target (server-only demo)
	if not e.target or not e.target.alive then e.target = nil end
	if not e.target then
		local best, bestD = nil, 1e9
		for _,o in pairs(getfenv(1).ENT or {}) do end -- placeholder if you unify stores later
	end
	-- simple: keep whatever target e.target already has

	if e.target then
		local d = (e.pos - e.target.pos).Magnitude
		if d > b.atkRange then
			-- chase
			local dir = (e.target.pos - e.pos).Unit
			e.vel = dir * b.speed
		else
			e.vel = Vector3.zero
			Ability.Cast(e, "Bite", e.target) -- AI uses ability directly
		end
	else
		e.vel = Vector3.zero
	end
end

return Brain
