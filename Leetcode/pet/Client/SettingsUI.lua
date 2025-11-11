local RS = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")
local plr = Players.LocalPlayer

local Remotes   = RS:WaitForChild("Remotes")
local SetRadius = Remotes:WaitForChild("SetRadius")

local MIN_R, MAX_R = 3, 7
-- ... build GUI like you had ...


local gui = Instance.new("ScreenGui"); gui.Name = "SettingsUI"; gui.ResetOnSpawn = false; gui.Parent = plr:WaitForChild("PlayerGui")
local frame = Instance.new("Frame", gui); frame.Size = UDim2.fromOffset(260, 100); frame.Position = UDim2.fromScale(0,0)
local title = Instance.new("TextLabel", frame); title.Size = UDim2.new(1,0,0,24); title.Text = "Chunk Radius"; title.TextScaled = true
local val = Instance.new("TextLabel", frame); val.Position = UDim2.new(0,0,0,28); val.Size = UDim2.fromOffset(260,36); val.TextScaled = true

local minus = Instance.new("TextButton", frame); minus.Text="-"; minus.Size=UDim2.fromOffset(60,30); minus.Position=UDim2.new(0,10,0,68)
local plus  = Instance.new("TextButton", frame); plus.Text="+";  plus.Size =UDim2.fromOffset(60,30); plus.Position =UDim2.new(0,190,0,68)

local current = MIN_R
local function apply()
	val.Text = tostring(current)
	SetRadius:FireServer(current) -- use the RemoteEvent, not the folder
end
-- minus/plus handlers unchanged

minus.MouseButton1Click:Connect(function() current = math.max(MIN_R, current-1); apply() end)
plus.MouseButton1Click:Connect(function() current = math.min(MAX_R, current+1); apply() end)
apply()
