local RS      = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")
local plr     = Players.LocalPlayer

local Remotes = RS:WaitForChild("Remotes")
local RequestRoster  = Remotes:WaitForChild("RequestRoster")
local RosterChanged  = Remotes:WaitForChild("RosterChanged")

local SetActive        = Remotes:WaitForChild("SetActiveCreature")
local UseAbility       = Remotes:WaitForChild("UseAbility")
local RunService = game:GetService("RunService")
local buttonConns = {}           -- [i] = RBXScriptConnection
local cooldowns   = {}           -- [abilityId] = unixUntil
local myList, activeId = {}, nil

local function now() return os.clock() end
local function getActive() return activeId and myList[activeId] or nil end

-- UI build
local gui   = Instance.new("ScreenGui"); gui.Name="CreatureUI"; gui.ResetOnSpawn=false; gui.Parent=plr:WaitForChild("PlayerGui")
local panel = Instance.new("Frame", gui)
panel.AnchorPoint = Vector2.new(1,1)
panel.Position    = UDim2.new(1,-16,1,-16)
panel.Size        = UDim2.fromOffset(340, 220)
panel.BackgroundColor3 = Color3.fromRGB(30,30,34)
panel.BorderSizePixel   = 0

local function header(lblTxt)
	local t = Instance.new("TextLabel", panel)
	t.Size = UDim2.new(1, -16, 0, 24)
	t.Position = UDim2.new(0, 8, 0, 8)
	t.Text = lblTxt
	t.TextColor3 = Color3.new(1,1,1)
	t.BackgroundTransparency = 1
	t.TextXAlignment = Enum.TextXAlignment.Left
	t.Font = Enum.Font.GothamBold
	t.TextSize = 18
	return t
end

local title = header("No creature")

-- stat grid
local statsFrame = Instance.new("Frame", panel)
statsFrame.Position = UDim2.new(0, 8, 0, 36)
statsFrame.Size     = UDim2.fromOffset(160, 90)
statsFrame.BackgroundTransparency = 1

local function statRow(parent, y, label)
	local r = Instance.new("Frame", parent)
	r.Size = UDim2.new(1,0,0,20); r.Position = UDim2.new(0,0,0,y); r.BackgroundTransparency=1
	local a = Instance.new("TextLabel", r); a.Size=UDim2.new(0,70,1,0); a.BackgroundTransparency=1
	a.Text = label..":"; a.TextColor3=Color3.fromRGB(200,200,210); a.Font=Enum.Font.Gotham; a.TextSize=14; a.TextXAlignment=Enum.TextXAlignment.Left
	local b = Instance.new("TextLabel", r); b.Name="V"; b.AnchorPoint=Vector2.new(1,0); b.Position=UDim2.new(1,0,0,0)
	b.Size=UDim2.new(0,80,1,0); b.BackgroundTransparency=1; b.TextColor3=Color3.new(1,1,1); b.Font=Enum.Font.Gotham; b.TextSize=14; b.TextXAlignment=Enum.TextXAlignment.Right
	return b
end

local vLvl  = statRow(statsFrame,  0, "Lv")
local vHP   = statRow(statsFrame, 22, "HP")
local vATK  = statRow(statsFrame, 44, "ATK")
local vDEF  = statRow(statsFrame, 66, "DEF")
local vSPD  = statRow(statsFrame, 88, "SPD")

-- HP bar
local bar = Instance.new("Frame", panel)
bar.Position = UDim2.new(0, 8, 0, 132); bar.Size = UDim2.fromOffset(324, 12)
bar.BackgroundColor3 = Color3.fromRGB(60,60,68); bar.BorderSizePixel=0
local fill = Instance.new("Frame", bar); fill.BackgroundColor3 = Color3.fromRGB(60,180,90); fill.BorderSizePixel=0; fill.Size = UDim2.new(0,0,1,0)

-- ability buttons
local buttons = {}
local btnArea = Instance.new("Frame", panel); btnArea.Position=UDim2.new(0, 8, 0, 154); btnArea.Size=UDim2.fromOffset(324, 58); btnArea.BackgroundTransparency=1
for i=1,4 do
	local b = Instance.new("TextButton", btnArea)
	b.Size = UDim2.new(0.24, 0, 1, 0)
	b.Position = UDim2.new((i-1)*0.25, (i-1)*4, 0, 0)
	b.BackgroundColor3 = Color3.fromRGB(50,120,200); b.BorderSizePixel=0
	b.AutoButtonColor = true; b.TextWrapped = true; b.Font = Enum.Font.GothamMedium; b.TextSize = 14; b.TextColor3 = Color3.new(1,1,1)
	local cd = Instance.new("TextLabel", b); cd.Name="CD"; cd.BackgroundTransparency=1; cd.Size=UDim2.new(1,0,1,0)
	cd.Text=""; cd.TextColor3=Color3.new(1,1,1); cd.Font=Enum.Font.GothamBold; cd.TextSize=14
	buttons[i] = b
end

-- local state + render
local cooldowns = {} -- [abilityId] = unixUntil

local function setVisibleByRoster()
	panel.Visible = next(myList) ~= nil
end

local function now() return os.clock() end

local function setHP(cur, max)
	cur = math.clamp(cur, 0, max)
	fill.Size = UDim2.new(max>0 and (cur/max) or 0, 0, 1, 0)
	vHP.Text  = ("%d / %d"):format(cur, max)
end
local function nilsafe(v, d) if v == nil then return d end return v end

local function safe(s, fallback)  -- nil -> fallback
	if s == nil then return fallback end
	return s
end

local function wipeButtons()
	-- disconnect old listeners and reset visuals
	for i,conn in ipairs(buttonConns) do
		if conn then conn:Disconnect() end
		buttonConns[i] = nil
	end
	for i,b in ipairs(buttons) do
		b.Text = ""
		b.AutoButtonColor = false
		b.BackgroundTransparency = 0.4
		local cd = b:FindFirstChild("CD"); if cd then cd.Text = "" end
	end
	table.clear(cooldowns)
end

local function bindButtonsFor(c)
	wipeButtons()
	if not c or not c.abilities then return end
	for i,ab in ipairs(c.abilities) do
		local b = buttons[i]; if not b then break end
		b.Text = ab.name or ab.id or ("Ability "..i)
		b.AutoButtonColor = true
		b.BackgroundTransparency = 0
		buttonConns[i] = b.MouseButton1Click:Connect(function()
			-- local cooldown guard on client
			local left = (cooldowns[ab.id] or 0) - now()
			if left > 0 then return end
			UseAbility:FireServer({ id = c.id, ability = ab.id })
			-- optimistic client-side CD if server uses same numbers
			local cd = tonumber(ab.cooldown) or 1
			cooldowns[ab.id] = now() + cd
		end)
	end
end

local function render()
	local c = getActive()
	panel.Visible = c ~= nil
	if not c then
		title.Text = "No creature"
		wipeButtons()
		return
	end

	local stats = c.stats or {}
	local displayName = tostring(nilsafe(c.name, c.family or "Unknown"))
	local tag         = c.element or c.family
	title.Text = tag and string.format("%s  [%s]", displayName, tostring(tag)) or displayName

	vLvl.Text = tostring(nilsafe(c.level, 1))
	vATK.Text = tostring(stats.pAtk or stats.atk or 0)
	vDEF.Text = tostring(stats.def or 0)
	vSPD.Text = tostring(stats.speed or stats.spd or 0)

	local hp  = tonumber(stats.hp)    or 1
	local max = tonumber(stats.maxHP) or math.max(1, hp)
	setHP(hp, max)

	bindButtonsFor(c)
end

-- initial pull
task.spawn(function()
	local list, active = RequestRoster:InvokeServer()
	myList, activeId = list or {}, active
	render()
end)

-- on roster change, rebuild UI and bindings
RosterChanged.OnClientEvent:Connect(function(newList, newActive)
	local oldActive = activeId
	myList, activeId = newList or {}, newActive
	if oldActive ~= activeId then
		-- new creature selected; clear CDs and rebind
		table.clear(cooldowns)
	end
	render()
end)
RunService.RenderStepped:Connect(function()
	local c = getActive(); if not c then return end
	for i,ab in ipairs(c.abilities or {}) do
		local b = buttons[i]; if not b then break end
		local left = (cooldowns[ab.id] or 0) - now()
		if left > 0 then
			b.AutoButtonColor=false
			b.BackgroundTransparency=0.3
			b.CD.Text = ("%d"):format(math.ceil(left))
		else
			b.AutoButtonColor=true
			b.BackgroundTransparency=0
			b.CD.Text = ""
		end
	end
end)
