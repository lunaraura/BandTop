--!strict
local Abilities = {}

export type CastCtx = {
	caster: any,
	target: any?,
	point: Vector3?, 
	byPlayer: Player?,
}

local RS = game:GetService("ReplicatedStorage")
local Remotes = RS:WaitForChild("Remotes")
local AbilityToast: RemoteEvent = Remotes:FindFirstChild("AbilityToast")
	or Instance.new("RemoteEvent", Remotes)
AbilityToast.Name = "AbilityToast"

local function toastAt(part: BasePart?, text: string, color: Color3?)
	if part then
		AbilityToast:FireAllClients({ part = part, text = text, color = color })
	end
end

local function clamp(v:number, a:number, b:number): number
	if v < a then return a elseif v > b then return b else return v end
end


local function closestEnemy(ofPet:any, radius:number?, pool:{[any]:any}?): any?
	local best, bestD = nil, radius or 40
	local op = ofPet.HRP.Position
	if pool then
		for _, other in pairs(pool) do
			if other ~= ofPet and other.State ~= "Dead" and other.Team ~= ofPet.Team then
				local d = (other.HRP.Position - op).Magnitude
				if d < bestD then best, bestD = other, d end
			end
		end
	else
		for _, other in ipairs(_G.AllCreatures or {}) do
			if other ~= ofPet and other.State ~= "Dead" and other.Team ~= ofPet.Team then
				local d = (other.HRP.Position - op).Magnitude
				if d < bestD then best, bestD = other, d end
			end
		end
	end
	return best
end

local function approachAndDo(pet:any, tgt:any, range:number, maxTime:number, fn: () -> ())
	range   = range or 6
	maxTime = maxTime or 3.0
	local my = (pet._actionId or 0) + 1
	pet._actionId = my
	pet.State = "Manual"

	task.spawn(function()
		local t0 = os.clock()
		while os.clock() - t0 < maxTime do
			if pet._actionId ~= my then return end
			if not tgt or tgt.State == "Dead" or not tgt.Model.Parent then break end

			local d = (tgt.HRP.Position - pet.HRP.Position).Magnitude
			if d <= range then break end
			pet.Hum:MoveTo(tgt.HRP.Position)
			for _ = 1, 6 do
				if pet._actionId ~= my then return end
				task.wait(0.05)
			end
		end
		if pet._actionId ~= my then return end
		if tgt and tgt.State ~= "Dead" then
			pet.HRP.CFrame = CFrame.lookAt(pet.HRP.Position, tgt.HRP.Position)
			fn()
		end
		if pet._actionId == my then pet.State = "Idle" end
	end)
end

local function beginCD(caster:any, id:string, seconds:number)
	caster:SetCD(id, seconds)
end

-- ===== Ability registry: read-only defs =====
-- Each ability is pure: all state is on the caster (pet).
local REGISTRY:{[string]:{
	id:string, key:string?, icon:string?, cd:number,
	label:string,
	cast:(ctx:CastCtx)->(),
}} = {}

local function def(a)
	REGISTRY[a.id] = a
	return a
end-- Bite
def({
	id = "Bite", key = "Q", label = "Bite", cd = 0.6,
	cast = function(ctx:CastCtx)
		local c = ctx.caster
		local tgt = ctx.target
		if not (tgt and tgt.HRP and tgt.State ~= "Dead" and tgt.Model.Parent) then
			tgt = closestEnemy(c, 40)
			if not tgt then print("[Bite] no target"); return end
		end
		approachAndDo(c, tgt, 6, 3.0, function()
			tgt:Damage(c, { dtype = "slice", base = 8 })
			beginCD(c, "Bite", 0.6)
			toastAt(tgt.HRP, "BITE!", Color3.fromRGB(255, 210, 120))
		end)
	end
})

-- Dash
def({
	id = "Dash", key = "E", label = "Dash", cd = 3.0,
	cast = function(ctx:CastCtx)
		local c = ctx.caster
		local look = c.HRP.CFrame.LookVector
		local bv = Instance.new("BodyVelocity")
		bv.MaxForce = Vector3.new(1e6, 1e6, 1e6)
		bv.Velocity = look * 60
		bv.Parent = c.HRP
		game:GetService("Debris"):AddItem(bv, 0.2)
		beginCD(c, "Dash", 3.0)
		toastAt(c.HRP, "DASH!", Color3.fromRGB(180, 220, 255))
	end
})

-- Stomp
def({
	id = "Stomp", key = "R", label = "Stomp", cd = 5.0,
	cast = function(ctx:CastCtx)
		local c = ctx.caster
		local center = ctx.point or (c.HRP.Position + c.HRP.CFrame.LookVector * 6)
		local r = 8
		for _, other in ipairs(_G.AllCreatures or {}) do
			if other ~= c and other.Team ~= c.Team and other.State ~= "Dead" and other.HRP then
				if (other.HRP.Position - center).Magnitude <= r then
					other:Damage(c, { dtype = "heat", base = 10 })
				end
			end
		end
		beginCD(c, "Stomp", 5.0)
		toastAt(c.HRP, "STOMP!", Color3.fromRGB(255, 180, 120))
	end
})

-- Bolt
def({
	id = "Bolt", key = "F", label = "Bolt", cd = 1.2,
	cast = function(ctx:CastCtx)
		local c = ctx.caster
		local tgt = (ctx.target and ctx.target.HRP) and ctx.target or closestEnemy(c, 60)
		if not tgt then return end
		tgt:Damage(c, { dtype = "zap", base = 7 })
		beginCD(c, "Bolt", 1.2)
		toastAt(tgt.HRP, "BOLT!", Color3.fromRGB(200, 200, 255))
	end
})

function Abilities.Get(id:string)
	return REGISTRY[id]
end

function Abilities.All()
	return REGISTRY
end

function Abilities.GiveDefaults(pet:any, list:{string}?): {[string]:any}
	local chosen = list or {"Bite","Dash"}
	pet.Abilities = pet.Abilities or {}
	for _, id in ipairs(chosen) do
		local defn = REGISTRY[id]
		if defn then
			pet.Abilities[id] = {
				id = id, key = defn.key, label = defn.label, cd = defn.cd,
				cast = function(caster:any, ctxOverride: CastCtx?)
					local ctx: CastCtx = { caster = caster }
					if ctxOverride then
						for k, v in pairs((ctxOverride :: any) :: {[string]: any}) do
							(ctx :: any)[k] = v
						end
					end
					defn.cast(ctx)
				end
			}
		end
	end
	return pet.Abilities
end


return Abilities
