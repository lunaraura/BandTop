-- ReplicatedStorage/Modules/Data/Composites.lua
local solid, liquid, gas, plasma = "solid","liquid","gas","plasma"

return {
	organicMammal = { name="Organic Mammal", matter=solid, physResist=0.10, energyResist=0.05, power=1.00, speed=1.00, density=0.80 },
	metal         = { name="Metal",          matter=solid, physResist=0.25, energyResist=0.00, power=0.95, speed=0.90, density=1.10 },
	slime         = { name="Slime",          matter=solid, physResist=0.05, energyResist=0.10, power=0.95, speed=1.05, density=0.70 },
}
