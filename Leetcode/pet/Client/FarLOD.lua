-- FarHorizon.client.lua  (client-only skyline ring)
local Players = game:GetService("Players")
local RS      = game:GetService("RunService")

local plr = Players.LocalPlayer
local function HRP()
	local c = plr.Character
	return c and (c:FindFirstChild("HumanoidRootPart") or c:FindFirstChildWhichIsA("BasePart"))
end

-- Tunables
local SEG      = 500  
local R_IN     = 550 
local R_OUT    = 560  
local BASE_Y   = -20
local MAX_H    = 600
local SEED     = 1337
local REBUILD  = 0.1

local Root = workspace:FindFirstChild("ClientRender") or Instance.new("Folder", workspace)
Root.Name = "ClientRender"; Root.Parent = workspace
-- optional cleanup if old wedges remain
for _,p in ipairs(Root:GetChildren()) do if p:IsA("WedgePart") then p:Destroy() end end
local Lighting = game:GetService("Lighting")
local atm = Lighting:FindFirstChildOfClass("Atmosphere") or Instance.new("Atmosphere", Lighting)
atm.Density = 0.0
atm.Offset  = 0
atm.Color   = Color3.fromRGB(180, 200, 210)
atm.Decay   = Color3.fromRGB(70, 85, 95)

-- Noise -> height
local function h(theta, r)
	local nx, nz = math.cos(theta)*0.003*r, math.sin(theta)*0.003*r
	local a = math.noise(nx,     nz,     SEED*0.11)
	local b = math.noise(nx*2.0, nz*2.0, SEED*0.37) * 0.5
	local c = math.noise(nx*4.0, nz*4.0, SEED*0.73) * 0.25
	local n = (a + b + c) * 0.8
	return math.max(0, (n + 0.15) * MAX_H)
end

-- Persistent bands
local Bands = table.create(SEG)
for i = 1, SEG do
	local p = Instance.new("Part")
	p.Anchored = true
	p.CanCollide = false
	p.CastShadow = false
	p.Material = Enum.Material.Ground
	p.Color = Color3.fromRGB(125,155,115)
	p.Parent = Root
	Bands[i] = p
end

local function colorFor(h)
	-- low = greener, high = grayer
	local t = math.clamp(h / MAX_H, 0, 1)
	return Color3.new(0.36 + 0.14*t, 0.55 + 0.10*t, 0.45 + 0.20*t)
end

local function setBand(i, center: Vector3, t0: number, t1: number)
	local m   = 0.5*(t0+t1)
	local dir = Vector3.new(math.cos(m), 0, math.sin(m))      -- radial out
	local tan = Vector3.new(-dir.Z, 0, dir.X)                 -- tangent

	local midR   = 0.5*(R_IN + R_OUT)
	local thick  = math.max(2, R_OUT - R_IN)
	local arcLen = math.max(2, (t1 - t0) * midR)              -- width along ring

	local height = math.max(h(m, R_IN), h(m, R_OUT))

	local p = Bands[i]
	if not p then
		-- safety: recreate if something deleted it
		p = Instance.new("Part")
		p.Anchored = true; p.CanCollide = false; p.CastShadow = false
		p.Material = Enum.Material.Ground
		p.Parent = Root
		Bands[i] = p
	end

	-- fade with distance index
	p.Transparency = 0
	p.Color = Color3.fromRGB(125,155,115)
end

-- Update around player
local lastCenter = Vector3.zero
local accum = 0

local function rebuildNow()
	local hrp = HRP(); if not hrp then return end
	local center = Vector3.new(hrp.Position.X, 0, hrp.Position.Z)
	lastCenter = center; accum = 0
	for i = 0, SEG-1 do
		local t0 = (i/SEG) * math.pi*2
		local t1 = ((i+1)/SEG) * math.pi*2
		setBand(i+1, center, t0+3, t1+3)
		setBand(i, center, t0, t1)
	end
end

-- once at start (if character already exists)
rebuildNow()

-- on spawn
Players.LocalPlayer.CharacterAdded:Connect(function()
	task.wait(5) -- let HRP exist
	rebuildNow()
end)

-- keep ring centered while playing
RS.Heartbeat:Connect(function(dt)
	local hrp = HRP(); if not hrp then return end
	local center = Vector3.new(hrp.Position.X, 0, hrp.Position.Z)

	accum += dt
	if (center - lastCenter).Magnitude < 6 and accum < REBUILD then return end
	rebuildNow()
end)
