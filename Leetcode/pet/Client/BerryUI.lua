-- StarterPlayerScripts/BerryUI.client.lua
local RS = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")
local Remotes = RS:WaitForChild("Remotes")
local InventoryChanged = Remotes:WaitForChild("InventoryChanged")
local UseBerry = Remotes:WaitForChild("UseBerry")

local plr = Players.LocalPlayer
local gui = Instance.new("ScreenGui"); gui.Name="BerryUI"; gui.ResetOnSpawn=false; gui.Parent = plr:WaitForChild("PlayerGui")

local frame = Instance.new("Frame", gui)
frame.Position = UDim2.new(0, 16, 1, -120)
frame.Size = UDim2.fromOffset(220, 104)
frame.BackgroundColor3 = Color3.fromRGB(25,25,28)
frame.BorderSizePixel = 0

local function mkBtn(x, label, kind)
	local b = Instance.new("TextButton", frame)
	b.Position = UDim2.new(0, x, 0, 8)
	b.Size = UDim2.fromOffset(64, 40)
	b.Text = label.."\n0"
	b.AutoButtonColor = true
	b.BackgroundColor3 = (kind=="red" and Color3.fromRGB(200,40,40))
		or (kind=="yellow" and Color3.fromRGB(240,200,60))
		or Color3.fromRGB(60,140,230)
	b.TextColor3 = Color3.new(1,1,1); b.Font = Enum.Font.GothamBold; b.TextSize = 14

	b.MouseButton1Click:Connect(function()
		UseBerry:FireServer(kind)
	end)
	return b
end

local btnR = mkBtn(8,  "Heal",    "red")
local btnY = mkBtn(76, "Strength","yellow")
local btnB = mkBtn(144,"Revive",  "blue")

InventoryChanged.OnClientEvent:Connect(function(t)
	btnR.Text = ("Heal\n%d"):format(t.red or 0)
	btnY.Text = ("Strength\n%d"):format(t.yellow or 0)
	btnB.Text = ("Revive\n%d"):format(t.blue or 0)
end)
