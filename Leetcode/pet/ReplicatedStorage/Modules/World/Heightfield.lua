-- ReplicatedStorage/Modules/World/Heightfield.lua
local Params = require(script.Parent.WorldParams)
local BiomeNoise  = require(script.Parent:WaitForChild("BiomeNoise"))
local Params      = require(script.Parent:WaitForChild("WorldParams"))

local clamp = math.clamp
local SHAPE = {
	Taiga  = { amp=142, freq=0.018, rough=0.55, base= 2, water= 0 },
	Meadow = { amp=118, freq=0.006,  rough=0.30, base= 0, water= 0 },
	Beach  = { amp=106, freq=0.010,  rough=0.25, base=-3, water=-1 },
	Swamp  = { amp=108, freq=0.004,  rough=0.25, base=-1, water= 2 },
}

local function fbm(x,z,seed,f,rough)
	local sum, amp = 0, 1
	rough = clamp(rough,0.15,0.95)
	for i=1,3 do
		sum += math.noise(x*f, z*f, (seed or 0)*i*0.137) * amp
		f   = f*2; amp = amp*rough
	end
	return sum
end

local M = {}
function M.sample(x, z, seed)
	local w   = BiomeNoise.biomeMix(x, z, seed)
	local amp,freq,rough,base,water = 0,0,0,0,0
	for name,wt in pairs(w) do
		local p = SHAPE[name]
		if p then
			amp   += wt*p.amp
			freq  += wt*p.freq
			rough += wt*p.rough
			base  += wt*p.base
			water += wt*p.water
		end
	end
	local n  = fbm(x, z, seed, freq, rough)
	local nh = clamp(0.5 + 0.5*n, 0, 1)
	local yG = base + amp*nh
	local yW = Params.WATER_BASE + water
	return yG, yW, w
end
return M
