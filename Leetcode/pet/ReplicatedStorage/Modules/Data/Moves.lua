-- Data/Moves.lua
local MoveCat = { PHY="physical", ENR="energy" }

local MoveTypes = {
	blunt =      { cat=MoveCat.PHY, flatBypass={hard=0.2},     resistedBy={elastic=0.2} },
	drill =      { cat=MoveCat.PHY, flatBypass={tough=0.2, hard=0.2}, resistedBy={porosity=0.2} },
	pierce =     { cat=MoveCat.PHY, flatBypass={porosity=0.3}, resistedBy={hard=0.3} },
	slice =      { cat=MoveCat.PHY, flatBypass={elastic=0.3},  resistedBy={tough=0.3} },
	smash =      { cat=MoveCat.PHY, flatBypass={hard=0.3},     resistedBy={tough=0.3} },
	corrode =    { cat=MoveCat.PHY, flatBypass={},             resistedBy={chemResist=1.0} },
	fumes =      { cat=MoveCat.ENR, flatBypass={},             resistedBy={chemResist=0.5} },
	frost =      { cat=MoveCat.ENR, flatBypass={},             resistedBy={thermCond=0.3} },
	heat  =      { cat=MoveCat.ENR, flatBypass={},             resistedBy={thermCond=0.3} },
	zap   =      { cat=MoveCat.ENR, flatBypass={},             resistedBy={electroResist=0.3} },
}

local Melee = {
	fang = { name="fang", atkType="pierce",
		baseAtk={pAtk=10, eAtk=0}, atkMult={pAtk=0.2, eAtk=1.0},
		soak=0.8, castTime=1.0, cooldown=0.2, extraRange=100 },
	-- ...
}

local Movement = { dash = { speed=420, time=0.16, cooldown=1.2, iFrames=0.10 } }

local Projectile = {
	spikeThrow = { name="Throw Spike", atkType="pierce",
		speed=260, life=1.2, radius=4,
		baseAtk={pAtk=3, eAtk=4}, atkMult={pAtk=0.15, eAtk=0.35},
		cooldown=0.6 }
}

return { MoveCat=MoveCat, MoveTypes=MoveTypes, Melee=Melee, Movement=Movement, Projectile=Projectile }
