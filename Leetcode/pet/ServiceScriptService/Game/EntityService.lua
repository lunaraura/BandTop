-- ServerScriptService/Game/EntityService.server.lua
local Players = game:GetService("Players")
local Run     = game:GetService("RunService")
local RS      = game:GetService("ReplicatedStorage")
local Rem     = RS:WaitForChild("Remotes")
local ESpawn  = Rem:WaitForChild("EntitySpawned")
local EDes    = Rem:WaitForChild("EntityDespawned")
local EState  = Rem:WaitForChild("EntityState")
local UseAb   = Rem:WaitForChild("UseAbility")

local Ability = require(script.Parent.AbilityService)
local Brain   = require(script.Parent.BrainService)
local Roster  = require(script.Parent.RosterService)

local EntityService = {}
local ENT     = {}          -- id -> entity
local byOwner = {}          -- userId -> entityId
local NEXT_ID = 0
local function newId() NEXT_ID += 1; return NEXT_ID end

function EntityService.Get(id:number) return ENT[id] end
function EntityService.ForOwner(p: Player) return ENT[byOwner[p.UserId]] end

function EntityService.Spawn(family: string, pos: Vector3, opts)
	local id    = newId()
	local owner = opts and opts.owner
	local e = {
		id=id, family=family, owner=owner,
		pos=pos, vel=Vector3.zero,
		hpMax=(opts and opts.hpMax) or 100,
		hp=(opts and opts.hp) or 100,
		team=(opts and opts.team) or "neutral",
		brain=Brain.MakeBrain(family),
		cooldowns={}, alive=true,
		abilities = opts and opts.abilities or {}, -- ensure list
		stats     = opts and opts.stats     or nil,
		composite = opts and opts.composite or nil,
	}
	ENT[id] = e
	if owner then byOwner[owner.UserId] = id end
	ESpawn:FireAllClients({id=id,family=family,pos=pos,hp=e.hp,hpMax=e.hpMax,team=e.team})
	return e
end

function EntityService.Despawn(id:number)
	local e = ENT[id]; if not e then return end
	if e.owner then byOwner[e.owner.UserId] = nil end
	ENT[id] = nil
	EDes:FireAllClients(id)
end

function EntityService.Damage(id:number, amount:number, sourcePlayer: Player?)
	local e = ENT[id]; if not e or not e.alive then return end
	e.hp = math.max(0, e.hp - amount)
	if e.hp <= 0 then
		e.alive = false
		EntityService.Despawn(id)
	else
		EState:FireAllClients({id=id, hp=e.hp})
	end
end

-- Single source of truth: spawn player’s active loadout
function EntityService.SpawnActiveFor(p: Player, pos: Vector3?)
	-- despawn previous
	local existing = byOwner[p.UserId]
	if existing then EntityService.Despawn(existing) end

	-- server-side loadout (family, stats, composite, abilities)
	local loadout = Roster.GetLoadout(p)
	if not loadout or not loadout.family then return end

	local hrp = p.Character and p.Character:FindFirstChild("HumanoidRootPart")
	pos = pos or (hrp and (hrp.Position + Vector3.new(0,3,0)) or Vector3.new(0,8,0))

	local e = EntityService.Spawn(loadout.family, pos, {
		team="player", owner=p,
		stats=loadout.stats, composite=loadout.composite, abilities=loadout.abilities
	})
	return e
end

-- helpers
local function hasAbility(e, abilityId:string)
	for _,ab in ipairs(e.abilities or {}) do
		if ab.id == abilityId then return true end
	end
	return false
end

local function cdReady(e, key, now) return now >= (e.cooldowns[key] or 0) end
local function setCd(e, key, seconds, now) e.cooldowns[key] = now + (seconds or 1) end

-- client ability requests
UseAb.OnServerEvent:Connect(function(p, payload)
	if type(payload) ~= "table" then return end
	local id, abilityId, targetId = payload.id, payload.ability, payload.targetId
	if type(id) ~= "number" or type(abilityId) ~= "string" then return end

	local e = ENT[id]; if not e then return end
	if e.owner ~= p then return end
	if not hasAbility(e, abilityId) then return end

	local now = os.clock()
	if not cdReady(e, abilityId, now) then return end

	local target = (type(targetId) == "number") and ENT[targetId] or nil
	local ok, cd = Ability.Cast(e, abilityId, target)
	if ok then setCd(e, abilityId, cd, now) end
end)

-- lifecycle hooks
Players.PlayerAdded:Connect(function(p)
	p.CharacterAdded:Connect(function()
		task.defer(EntityService.SpawnActiveFor, p)
	end)
	p.CharacterRemoving:Connect(function()
		local id = byOwner[p.UserId]; if id then EntityService.Despawn(id) end
	end)
end)

Players.PlayerRemoving:Connect(function(p)
	local id = byOwner[p.UserId]; if id then EntityService.Despawn(id) end
end)

-- allow active swap
Rem.SetActiveCreature.OnServerEvent:Connect(function(p)
	EntityService.SpawnActiveFor(p)
end)

-- fixed-step tick with throttled state
local ACC, STEP = 0, 0.1
local LAST_SEND, SEND_EVERY = {}, 0.1
Run.Heartbeat:Connect(function(dt)
	ACC += dt
	while ACC >= STEP do
		local nowSend = os.clock()
		for _, e in pairs(ENT) do
			if e.brain and e.brain.tick then e.brain.tick(e, STEP, EntityService) end
			e.pos += e.vel * STEP
			if (nowSend - (LAST_SEND[e.id] or 0)) >= SEND_EVERY then
				EState:FireAllClients({id=e.id, pos=e.pos, hp=e.hp})
				LAST_SEND[e.id] = nowSend
			end
		end
		ACC -= STEP
	end
end)

return EntityService
