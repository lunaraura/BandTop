-- ServerScriptService/WorldService.server.lua
local Players = game:GetService("Players")
local Run     = game:GetService("RunService")
local RS      = game:GetService("ReplicatedStorage")
local Terrain = workspace.Terrain

local WG = require(game.ReplicatedStorage.Modules.WorldGen)
local Util    = require(RS.Modules.Util)
local Modules  = RS:WaitForChild("Modules")
local Flora = require(game.ReplicatedStorage.Modules.World.FloraService)

local CHUNK_SIZE     = 64
local CELLS_PER_EDGE = 4
local CELL_SIZE      = CHUNK_SIZE / CELLS_PER_EDGE
local RADIUS_MIN     = 3
local RADIUS_MAX     = 7
local SEED           = 1335

local function cellIdx(gx,gz) return gz*CELLS_PER_EDGE + gx + 1 end

local function makeGrid(cx, cz)
	local grid = { cells = table.create(CELLS_PER_EDGE*CELLS_PER_EDGE) }
	local x0, z0 = cx*CHUNK_SIZE, cz*CHUNK_SIZE
	for gx=0,CELLS_PER_EDGE-1 do
		for gz=0,CELLS_PER_EDGE-1 do
			local px = x0 + (gx + 0.5)*CELL_SIZE
			local pz = z0 + (gz + 0.5)*CELL_SIZE
			local yG, yW, weights = WG.heightAt(px, pz, SEED)
			grid.cells[cellIdx(gx,gz)] = { x=px, z=pz, yG=yG, yW=yW, weights=weights }
		end
	end
	return grid
end

local function writeTerrain(grid)
	for gx=0,CELLS_PER_EDGE-1 do
		for gz=0,CELLS_PER_EDGE-1 do
			local c = grid.cells[cellIdx(gx,gz)]
			local groundMat, highMat = WG.pickMaterials(c.weights)
			local y = math.max(2, c.yG)
			local mat = (c.yG > 18) and highMat or groundMat
			Terrain:FillBlock(
				CFrame.new(c.x, y*0.5, c.z),
				Vector3.new(CELL_SIZE, y, CELL_SIZE),
				mat
			)
			if c.yG < c.yW then
				local hW = math.max(2, c.yW - c.yG)
				Terrain:FillBlock(
					CFrame.new(c.x, c.yG + hW*0.5, c.z),
					Vector3.new(CELL_SIZE, hW, CELL_SIZE),
					Enum.Material.Water
				)
			end
		end
	end
end

local loaded = {}
local wants  = {}
local last   = {}

local function buildChunk(cx, cz)
	local k = Util.key(cx, cz)
	if loaded[k] then return end
	loaded[k] = true
	local grid = makeGrid(cx, cz)
	writeTerrain(grid)
	Flora.scatterChunk(cx, cz, grid, k)
end

local function unloadChunk(cx, cz)
	local k = Util.key(cx, cz)
	if not loaded[k] then return end
	loaded[k] = nil

	Flora.unloadChunk(k) -- destroy flora parts first

	local x0, z0 = cx*CHUNK_SIZE, cz*CHUNK_SIZE
	local CLEAR_H = 256
	for gx=0,CELLS_PER_EDGE-1 do
		for gz=0,CELLS_PER_EDGE-1 do
			local px = x0 + (gx + 0.5)*CELL_SIZE
			local pz = z0 + (gz + 0.5)*CELL_SIZE
			Terrain:FillBlock(
				CFrame.new(px, CLEAR_H*0.5, pz),
				Vector3.new(CELL_SIZE, CLEAR_H, CELL_SIZE),
				Enum.Material.Air
			)
		end
	end
end

local function setWant(p, k, flag)
	local m = wants[p]; if not m then m = {}; wants[p] = m end
	if flag then m[k] = true else m[k] = nil end
	if not flag then
		local any=false
		for _,mm in pairs(wants) do if mm[k] then any=true break end end
		if not any then
			local cx,cz = k:match("(-?%d+)|(-?%d+)")
			if cx and cz then unloadChunk(tonumber(cx), tonumber(cz)) end
		end
	end
end

local function getRadius(p)
	return math.clamp(p:GetAttribute("RadiusChunks") or 3, RADIUS_MIN, RADIUS_MAX)
end

local function updatePlayer(p)
	local char = p.Character; if not char then return end
	local hrp  = char:FindFirstChild("HumanoidRootPart") or char:FindFirstChildWhichIsA("BasePart"); if not hrp then return end
	local cx = math.floor(hrp.Position.X / CHUNK_SIZE)
	local cz = math.floor(hrp.Position.Z / CHUNK_SIZE)

	local prev = last[p]
	if prev and prev.cx == cx and prev.cz == cz then return end
	last[p] = {cx=cx, cz=cz}
	local r = getRadius(p)
	local wantNow = {}

	for dx = -r, r do
		for dz = -r, r do
			local k = Util.key(cx+dx, cz+dz)
			wantNow[k] = true
			if not loaded[k] then buildChunk(cx+dx, cz+dz) end
			setWant(p, k, true)
		end
	end

	local had = wants[p] or {}
	for k in pairs(had) do
		if not wantNow[k] then setWant(p, k, false) end
	end
end

Players.PlayerAdded:Connect(function(p)
	p.CharacterAdded:Connect(function()
		task.wait(0.25)
		updatePlayer(p)
	end)
end)

Players.PlayerRemoving:Connect(function(p)
	wants[p] = nil
	last[p] = nil
end)

Run.Heartbeat:Connect(function()
	for _,p in ipairs(Players:GetPlayers()) do
		updatePlayer(p)
	end
end)
