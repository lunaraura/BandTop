-- StarterPlayerScripts/Router.client.lua
local RS = game:GetService("ReplicatedStorage")
local Rem = RS.Remotes
local Players = game:GetService("Players")
local cam = workspace.CurrentCamera

local function gotoLobby()
	cam.CameraType = Enum.CameraType.Custom
	-- show simple UI: “Tutorial” and “Start Survival”
end

Rem.BeginTutorial.OnClientEvent:Connect(function()
	-- hide lobby UI, show Tutorial HUD
end)

gotoLobby()
