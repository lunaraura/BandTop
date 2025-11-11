-- StarterPlayerScripts/StarterPicker.client.lua
local Players = game:GetService("Players")
local RS      = game:GetService("ReplicatedStorage")
local Rem     = RS:WaitForChild("Remotes")

local ChooseStarter   = Rem:WaitForChild("ChooseStarter")
local RequestRoster   = Rem:WaitForChild("RequestRoster") :: RemoteFunction
local RosterChanged   = Rem:WaitForChild("RosterChanged")

-- data in ReplicatedStorage so the client can render options
local STARTERS = require(RS.Modules.Data.Starters)         -- classKey -> {families}
local FAMILIES = require(RS.Modules.Data.Families)         -- for display names if needed

local plr   = Players.LocalPlayer
local pgui  = plr:WaitForChild("PlayerGui")

-- If already picked, do nothing
local _, active = RequestRoster:InvokeServer()
if active then return end

-- UI
local gui   = Instance.new("ScreenGui"); gui.Name = "StarterPicker"; gui.ResetOnSpawn = false; gui.IgnoreGuiInset = true; gui.Parent = pgui
local frame = Instance.new("Frame"); frame.Size = UDim2.fromOffset(520, 300); frame.Position = UDim2.fromScale(0.5, 0.5); frame.AnchorPoint = Vector2.new(0.5,0.5); frame.Parent = gui
frame.BackgroundColor3 = Color3.fromRGB(25,25,25)

local title = Instance.new("TextLabel"); title.Size = UDim2.new(1,0,0,32); title.TextScaled = true; title.TextColor3 = Color3.new(1,1,1); title.BackgroundTransparency = 1; title.Text = "Choose your starter"; title.Parent = frame

local classRow = Instance.new("Frame"); classRow.Size = UDim2.new(1, -20, 0, 48); classRow.Position = UDim2.fromOffset(10, 42); classRow.BackgroundTransparency = 1; classRow.Parent = frame
local famGrid  = Instance.new("Frame"); famGrid.Size = UDim2.new(1, -20, 1, -110); famGrid.Position = UDim2.fromOffset(10, 96); famGrid.BackgroundTransparency = 1; famGrid.Parent = frame

local classLayout = Instance.new("UIListLayout"); classLayout.FillDirection = Enum.FillDirection.Horizontal; classLayout.Padding = UDim.new(0,8); classLayout.Parent = classRow
local gridLayout  = Instance.new("UIGridLayout"); gridLayout.CellSize = UDim2.fromOffset(120, 48); gridLayout.CellPadding = UDim2.fromOffset(8,8); gridLayout.Parent = famGrid

local selectedClass : string? = nil
local chosen = false

local function mkButton(parent, text)
	local b = Instance.new("TextButton")
	b.Size = UDim2.fromOffset(120,48)
	b.Text = text
	b.BackgroundColor3 = Color3.fromRGB(40,40,40)
	b.TextColor3 = Color3.new(1,1,1)
	b.AutoButtonColor = true
	b.Parent = parent
	return b
end

-- populate class buttons
for classKey, famList in pairs(STARTERS) do
	if #famList > 0 then
		local cb = mkButton(classRow, classKey)
		cb.MouseButton1Click:Connect(function()
			if chosen then return end
			selectedClass = classKey

			-- rebuild grid layout fresh
			famGrid:ClearAllChildren()
			local gridLayout = Instance.new("UIGridLayout")
			gridLayout.CellSize = UDim2.fromOffset(120, 48)
			gridLayout.CellPadding = UDim2.fromOffset(8, 8)
			gridLayout.Parent = famGrid

			for _, fam in ipairs(STARTERS[classKey]) do
				local label = FAMILIES[fam] and (FAMILIES[fam].displayName or fam) or fam
				local fb = mkButton(famGrid, label)
				fb.MouseButton1Click:Connect(function()
					if chosen or not selectedClass then return end
					chosen = true
					ChooseStarter:FireServer(selectedClass, fam)
				end)
			end
		end)

	end
end

-- hide picker after server confirms
local function onRosterChanged(_, activeFamily)
	if activeFamily and gui.Parent then
		gui.Enabled = false
		gui.Parent = nil
	end
end
RosterChanged.OnClientEvent:Connect(onRosterChanged)
