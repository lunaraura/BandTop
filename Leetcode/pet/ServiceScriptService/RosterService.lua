-- ServerScriptService/Game/RosterService.lua
local Players = game:GetService("Players")
local RS      = game:GetService("ReplicatedStorage")
local Rem     = RS:WaitForChild("Remotes")

local RosterChanged  = Rem:WaitForChild("RosterChanged")
local RequestRoster  = Rem:WaitForChild("RequestRoster") :: RemoteFunction
local ChooseStarter  = Rem:WaitForChild("ChooseStarter")
local SetActive      = Rem:WaitForChild("SetActiveCreature")

local STARTERS = require(RS.Modules.Data.Starters)
local Families = require(RS.Modules.Data.Families)

local M = {}

local rosters : {[number]: {list:{[string]: any}, active:string?}} = {}

local function bagFor(p: Player)
	local b = rosters[p.UserId]
	if not b then b = {list={}, active=nil}; rosters[p.UserId] = b end
	return b
end

local function push(p: Player)
	local b = bagFor(p)
	RosterChanged:FireClient(p, b.list, b.active)
end

local function makeCreature(family: string)
	local fdef = Families[family]
	local name = (fdef and (fdef.displayName or family)) or family

	local function rollIV() return math.random(0,3) end
	local stats = {
		pAtk = 8 + rollIV(),
		eAtk = 6 + rollIV(),
		def  = 6 + rollIV(),
		speed= 7 + rollIV(),
		maxHP= 30 + math.random(0,6),
		hp   = 0,
	}
	stats.hp = stats.maxHP

	local abilities = {
		{ id="basic_attack", name="Basic Attack", cd=0.8 },
	}
	local CLASS_OF = {
		felidae="mammal", canidae="mammal", ursidae="mammal",
		urodela="amphibian", anura="amphibian",
		arachnid="arthropod", pterygota="arthropod",
		squamata="reptile", testudine="reptile",
		columbiformes="bird", accipitriformes="bird",
	}
	return {
		id = family,
		name = name,
		family = family,
		element = CLASS_OF[family] or "neutral",
		stats = stats,
		abilities = abilities,
	}

end

function M.ChooseStarter(p: Player, classKey: string, family: string)
	local allowed = STARTERS[classKey]
	if type(allowed) ~= "table" then return end
	local ok = false
	for _, f in ipairs(allowed) do if f == family then ok = true break end end
	if not ok then return end

	local b = bagFor(p)
	if b.list[family] then
		b.active = family
		push(p)
		return
	end

	local creature = makeCreature(family)
	b.list[creature.id] = creature
	b.active = b.active or creature.id
	push(p)
end

function M.SetActive(p: Player, id: string)
	local b = bagFor(p)
	if b.list[id] then b.active = id; push(p); return true end
	return false
end

function M.GetActive(p: Player) : string?
	return bagFor(p).active
end

function M.GetRoster(p: Player)
	local b = bagFor(p); return b.list, b.active
end

Players.PlayerRemoving:Connect(function(p) rosters[p.UserId] = nil end)

-- Remotes
ChooseStarter.OnServerEvent:Connect(function(p, classKey, family)
	-- old clients might send one arg; ignore to avoid nil clone errors
	if type(classKey) == "string" and type(family) == "string" then
		M.ChooseStarter(p, classKey, family)
	end
end)

RequestRoster.OnServerInvoke = function(p) return M.GetRoster(p) end
SetActive.OnServerEvent:Connect(function(p, id) M.SetActive(p, id) end)

return M
