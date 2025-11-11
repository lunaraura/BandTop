local M = {}
function M.key(cx, cz) return tostring(cx).."|"..tostring(cz) end
function M.rngFor(cx, cz, seed)
	return Random.new(bit32.band(bit32.bxor(cx*73856093, cz*19349663, seed*9167), 0x7fffffff))
end
return M
