local RS  = game:GetService("ReplicatedStorage")
local CS  = game:GetService("CollectionService")
local WG = require(game.ReplicatedStorage.Modules.WorldGen)
local Util= require(RS.Modules.Util)

local CHUNK_SIZE     = 64
local CELLS_PER_EDGE = 4
local CELL_SIZE      = CHUNK_SIZE / CELLS_PER_EDGE
local SEED           = 1335

local FloraFolder = workspace:FindFirstChild("Flora") or Instance.new("Folder", workspace)
FloraFolder.Name = "Flora"

local floraInChunk = {} -- key -> {Instance}

-- --- builders (unchanged) ----------------------------------------------------
local function mkTrunk(x,y,z,h,rad,color)
	local p = Instance.new("Part")
	p.Anchored, p.CanCollide = true, false
	p.Material = Enum.Material.Wood
	p.Color = color
	p.Size  = Vector3.new(rad*2, h, rad*2)
	p.CFrame = CFrame.new(x, y + h*0.5, z)
	p.Parent = FloraFolder
	return p
end
local function mkBall(x,y,z,r,color,mat)
	local p = Instance.new("Part")
	p.Shape = Enum.PartType.Ball
	p.Anchored, p.CanCollide = true, false
	p.Material = mat or Enum.Material.Grass
	p.Color = color
	p.Size  = Vector3.new(r*2, r*2, r*2)
	p.CFrame = CFrame.new(x, y + r, z)
	p.Parent = FloraFolder
	return p
end

local function build_pine(x,yTop,z,r)
	local h  = r:NextNumber(14, 22)
	local tr = r:NextNumber(0.6, 1.0)
	local trunk = mkTrunk(x, yTop, z, h, tr, Color3.fromRGB(90,70,50))
	local parts = {trunk}
	-- stacked cones via wedges
	for i=1,3 do
		local w = 7 - i*1.6
		local leaf = Instance.new("WedgePart")
		leaf.Anchored, leaf.CanCollide = true, false
		leaf.Material = Enum.Material.Grass
		leaf.Color = Color3.fromRGB(40, 100, 60)
		leaf.Size = Vector3.new(w, w*0.9, w)
		leaf.CFrame = CFrame.new(x, yTop + (h*0.45) + i*w*0.6, z) * CFrame.Angles(math.rad(90), 0, 0)
		leaf.Parent = FloraFolder
		table.insert(parts, leaf)
	end
	return parts
end

local function build_fir(x,yTop,z,r)   return build_pine(x,yTop,z,r) end
local function build_spruce(x,yTop,z,r) return build_pine(x,yTop,z,r) end

local function build_oak(x,yTop,z,r)
	local h  = r:NextNumber(10, 16)
	local tr = r:NextNumber(0.9, 1.4)
	local trunk = mkTrunk(x, yTop, z, h, tr, Color3.fromRGB(110,85,60))
	local parts = {trunk}
	for _,s in ipairs{1.0, 0.8, 0.6} do
		table.insert(parts, mkBall(
			x + r:NextNumber(-1.0,1.0),
			yTop + h + r:NextNumber(0.6,2.0),
			z + r:NextNumber(-1.0,1.0),
			6*s,
			Color3.fromRGB(70,120,60)
			))
	end
	return parts
end

local function build_birch(x,yTop,z,r)
	local h  = r:NextNumber(10, 14)
	local trunk = mkTrunk(x, yTop, z, h, 0.8, Color3.fromRGB(235,235,235))
	trunk.Material = Enum.Material.Sand -- pale look
	local parts = {trunk}
	table.insert(parts, mkBall(x, yTop + h, z, 5.5, Color3.fromRGB(90,160,90)))
	return parts
end

local function build_palm(x,yTop,z,r)
	local segs = r:NextInteger(6, 9)
	local segH = r:NextNumber(2.0, 2.6)
	local parts = {}
	for i=1,segs do
		table.insert(parts, mkTrunk(x, yTop + (i-1)*segH, z, segH, 0.7, Color3.fromRGB(140,110,80)))
	end
	table.insert(parts, mkBall(x, yTop + segs*segH, z, r:NextNumber(4,6), Color3.fromRGB(60,110,80)))
	return parts
end

local function build_willow(x,yTop,z,r)
	local h  = r:NextNumber(12, 16)
	local trunk = mkTrunk(x, yTop, z, h, 1.0, Color3.fromRGB(70,60,50))
	local parts = {trunk}
	local topY = yTop + h + 0.8
	local pad = Instance.new("Part")
	pad.Anchored, pad.CanCollide = true, false
	pad.Material = Enum.Material.Grass
	pad.Color = Color3.fromRGB(60,110,80)
	pad.Size = Vector3.new(11, 1.4, 11)
	pad.CFrame = CFrame.new(x, topY, z)
	pad.Parent = FloraFolder
	table.insert(parts, pad)
	return parts
end

local function build_cypress(x,yTop,z,r)
	local h  = r:NextNumber(12, 18)
	local trunk = mkTrunk(x, yTop, z, h, 0.8, Color3.fromRGB(70,60,50))
	local parts = {trunk}
	-- tall thin crown
	table.insert(parts, mkBall(x, yTop + h*0.9, z, 4.5, Color3.fromRGB(50,90,60)))
	return parts
end

local function build_mangrove(x,yTop,z,r)
	local h  = r:NextNumber(10, 14)
	local trunk = mkTrunk(x, yTop, z, h, 0.9, Color3.fromRGB(80,65,55))
	local parts = {trunk}
	-- stubby canopy
	table.insert(parts, mkBall(x, yTop + h, z, 5.0, Color3.fromRGB(60,100,70)))
	return parts
end

local BUILDERS = {
	pine=build_pine,fir=build_fir,spruce=build_spruce,
	oak=build_oak,birch=build_birch,palm=build_palm,
	willow=build_willow,cypress=build_cypress,mangrove=build_mangrove,
}

local BIOME_TREES = {
	Taiga   = { base=10, styles={"pine","fir","spruce"} },
	Meadow  = { base= 8, styles={"oak","birch"} },
	Beach   = { base= 6, styles={"palm"} },
	Swamp   = { base= 7, styles={"willow","cypress","mangrove"} },
}

local BERRIES = {
	red    = {color = Color3.fromRGB(200, 40, 40)},
	yellow = {color = Color3.fromRGB(240,200, 60)},
	blue   = {color = Color3.fromRGB( 60,140,230)},
}

local function mkBerryBush(x,yTop,z,kind)
	local bush = Instance.new("Part")
	bush.Name = "BerryBush_"..kind
	bush.Shape = Enum.PartType.Ball
	bush.Material = Enum.Material.Grass
	bush.Color = BERRIES[kind].color
	bush.Size  = Vector3.new(5,5,5)
	bush.Anchored, bush.CanCollide = true, false
	bush.CFrame = CFrame.new(x, yTop + 2.5, z)
	bush.Parent = FloraFolder
	local prompt = Instance.new("ProximityPrompt")
	prompt.ActionText, prompt.ObjectText = "Pick "..kind.." berry", "Bush"
	prompt.HoldDuration, prompt.MaxActivationDistance, prompt.RequiresLineOfSight = 0.2, 10, false
	prompt.Parent = bush
	bush:SetAttribute("BerryKind", kind)
	bush:SetAttribute("Uses", 3)
	CS:AddTag(bush, "BerryBush")
	return bush
end

local function addRef(k, inst)
	if not inst then return end
	local t = floraInChunk[k]; if not t then t = {}; floraInChunk[k] = t end
	t[#t+1] = inst
end

local function dominantBiome(cx, cz, seed)
	local x = (cx + 0.5)*CHUNK_SIZE
	local z = (cz + 0.5)*CHUNK_SIZE
	local mix = WG.biomeMix(x, z, seed)
	local bestName, bestW = "Meadow", -1
	for name,w in pairs(mix) do if w>bestW then bestName, bestW = name, w end end
	return bestName
end

-- Public: scatter trees + shrubs + berry bushes using the terrain grid
local M = {}

function M.scatterChunk(cx, cz, grid, keyStr)
	local r = Util.rngFor(cx, cz, SEED)
	local baseX, baseZ = cx*CHUNK_SIZE, cz*CHUNK_SIZE

	local bName = dominantBiome(cx, cz, SEED)
	local spec  = BIOME_TREES[bName] or BIOME_TREES.Meadow
	local biomeDef = require(RS.Modules.World.Biomes)[bName] or require(RS.Modules.World.Biomes).Meadow
	local densityScale = biomeDef.density or 1.0
	local nTrees  = math.max(0, math.floor(spec.base * densityScale))
	local nShrubs = math.max(0, math.floor(spec.base * 1.2 * densityScale))

	local function surfaceAt(x,z)
		local gx = math.clamp(math.floor((x - baseX)/CELL_SIZE), 0, CELLS_PER_EDGE-1)
		local gz = math.clamp(math.floor((z - baseZ)/CELL_SIZE), 0, CELLS_PER_EDGE-1)
		local c  = grid.cells[gz*CELLS_PER_EDGE + gx + 1]
		return c, gx, gz
	end
	local function slopeAt(gx,gz)
		local i  = gz*CELLS_PER_EDGE + gx + 1
		local ix = gz*CELLS_PER_EDGE + math.min(gx+1, CELLS_PER_EDGE-1) + 1
		local iz = math.min(gz+1, CELLS_PER_EDGE-1)*CELLS_PER_EDGE + gx + 1
		local y, yx, yz = grid.cells[i].yG, grid.cells[ix].yG, grid.cells[iz].yG
		return math.max(math.abs(yx-y), math.abs(yz-y))
	end

	local SLOPE_MAX, MIN2 = 16, 10*10
	local placed = {}
	local function farFrom(x,z,min2)
		for _,p in ipairs(placed) do
			local dx, dz = x-p.x, z-p.z
			if dx*dx + dz*dz < min2 then return false end
		end
		return true
	end

	-- Trees
	for i=1,nTrees do
		local x = baseX + r:NextNumber()*CHUNK_SIZE
		local z = baseZ + r:NextNumber()*CHUNK_SIZE
		local c, gx, gz = surfaceAt(x, z)
		if c and c.yG >= c.yW and slopeAt(gx,gz) <= SLOPE_MAX and farFrom(x,z,MIN2) then
			local styles = spec.styles
			local style = styles[r:NextInteger(1, #styles)]
			local builder = BUILDERS[style]
			if builder then
				for _,inst in ipairs(builder(x, c.yG, z, r)) do addRef(keyStr, inst) end
				table.insert(placed, {x=x, z=z})
			end
		end
	end

	-- Shrubs
	for i=1,nShrubs do
		local x = baseX + r:NextNumber()*CHUNK_SIZE
		local z = baseZ + r:NextNumber()*CHUNK_SIZE
		local c = surfaceAt(x, z)
		if c and c.yG >= c.yW and farFrom(x,z, 6*6) then
			local s = r:NextNumber(1.8, 3.2)
			addRef(keyStr, mkBall(x, c.yG, z, s*0.5, Color3.fromRGB(70,140,80)))
		end
	end

	-- Berry bushes
	local nBushes = r:NextInteger(2, 5)
	for i=1,nBushes do
		local x = baseX + r:NextNumber()*CHUNK_SIZE
		local z = baseZ + r:NextNumber()*CHUNK_SIZE
		local c = surfaceAt(x, z)
		if c and c.yG >= c.yW then
			local pickIdx = r:NextInteger(1,3)
			local kind = (pickIdx==1 and "red") or (pickIdx==2 and "yellow") or "blue"
			addRef(keyStr, mkBerryBush(x, c.yG, z, kind))
		end
	end
end

function M.unloadChunk(keyStr)
	local list = floraInChunk[keyStr]
	if list then
		for _,inst in ipairs(list) do
			if inst and inst.Parent then inst:Destroy() end
		end
	end
	floraInChunk[keyStr] = nil
end

return M
