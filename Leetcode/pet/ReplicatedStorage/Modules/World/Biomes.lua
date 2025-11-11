-- ReplicatedStorage/Modules/Biomes.lua
return {
	Taiga = {
		ground = Enum.Material.Snow,
		high   = Enum.Material.Ice,
		density = 1.3,
	},
	Meadow = {
		ground = Enum.Material.Grass,
		high   = Enum.Material.Rock,
		density = 1.0,
	},
	Beach = {
		ground = Enum.Material.Sand,
		high   = Enum.Material.Rock,
		density = 0.6,
	},
	Swamp = {
		ground = Enum.Material.Mud,   -- not “Marsh”
		high   = Enum.Material.Ground,
		density = 0.9,
	},
	Mountains = {
		ground = Enum.Material.Ground, 
		high   = Enum.Material.Rock,
		density = 0.7,
	},
	Hills = {
		ground = Enum.Material.Grass,  
		high   = Enum.Material.Grass,
		density = 0.9,
	},
}