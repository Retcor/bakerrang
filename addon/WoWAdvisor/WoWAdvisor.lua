-- WoW Advisor
-- Collects in-game character data and shows a copy popup so you can paste
-- it into the WoW Advisor page on bakerrang.com for AI-powered advice.
--
-- Usage:
--   /wowadvisor        — collect data and show the copy popup
--   /wowadvisor zones  — print current zone map IDs to chat

local ADDON_NAME = "WoWAdvisor"

-- Zone map IDs to scan for world quests.
-- Midnight (12.0.1) zones — update these once UiMapIDs are confirmed in-game.
-- Use "/wowadvisor zones" to print your current zone ID and add it here.
local SCAN_ZONES = {
  -- Midnight zones (add IDs as they become known)
  -- Eversong Woods, Zul'Aman, Harandar, Voidstorm

  -- War Within zones (legacy world quests may still appear here)
  2248,  -- Isle of Dorn
  2214,  -- Ringing Deeps
  2215,  -- Hallowfall
  2255,  -- Azj-Kahet
  2437,  -- Zul'Aman
  2393,  -- Silvermoon
  2395,  -- Eversong Woods
  2576,  -- The Den, Harandar
  2413,  -- Harandar
  2405,  -- Voidstorm
  2537,  -- Quel'Thalas
}

local ADDON_COLOR = "D4ED31"  -- BakerRang brand yellow (dark mode)

local function print(...)
  DEFAULT_CHAT_FRAME:AddMessage("|cff" .. ADDON_COLOR .. "[WoW Advisor]|r " .. tostring((...)))
end

-- ─── JSON encoder ───────────────────────────────────────────────────────────

local function jsonEncode(val)
  local t = type(val)
  if t == "nil" then
    return "null"
  elseif t == "boolean" then
    return tostring(val)
  elseif t == "number" then
    return tostring(val)
  elseif t == "string" then
    val = val:gsub('\\', '\\\\')
    val = val:gsub('"', '\\"')
    val = val:gsub('\n', '\\n')
    val = val:gsub('\r', '\\r')
    val = val:gsub('\t', '\\t')
    return '"' .. val .. '"'
  elseif t == "table" then
    local isArray = (#val > 0)
    if isArray then
      local parts = {}
      for _, v in ipairs(val) do
        table.insert(parts, jsonEncode(v))
      end
      return "[" .. table.concat(parts, ",") .. "]"
    else
      local parts = {}
      for k, v in pairs(val) do
        table.insert(parts, jsonEncode(tostring(k)) .. ":" .. jsonEncode(v))
      end
      return "{" .. table.concat(parts, ",") .. "}"
    end
  end
  return "null"
end


-- ─── Data collection ────────────────────────────────────────────────────────

-- Currency IDs (War Within / Midnight)
local CURRENCY_IDS = {
  { id = 2245, name = "Resonance Crystals" },
  { id = 1191, name = "Valor" },
  { id = 1792, name = "Honor" },
  { id = 1602, name = "Conquest" },
}

local function getCurrencies()
  local result = {}
  for _, c in ipairs(CURRENCY_IDS) do
    local info = C_CurrencyInfo.GetCurrencyInfo(c.id)
    if info and (info.quantity or 0) > 0 then
      table.insert(result, { name = c.name, amount = info.quantity })
    end
  end
  return result
end

local function getVault()
  local result = {}
  local ok, activities = pcall(C_WeeklyRewards.GetActivities)
  if ok and activities then
    local typeNames = { [1] = "Raid", [2] = "Mythic+", [3] = "PvP" }
    for _, act in ipairs(activities) do
      table.insert(result, {
        type = typeNames[act.type] or "Unknown",
        progress = act.progress or 0,
        threshold = act.threshold or 0,
        rewardIlvl = act.rewardIlvl or 0,
      })
    end
  end
  return result
end

local function getAffixes()
  local result = {}
  local ok, affixes = pcall(C_MythicPlus.GetCurrentAffixes)
  if ok and affixes then
    for _, a in ipairs(affixes) do
      local aok, info = pcall(C_MythicPlus.GetAffixInfo, a.id)
      local aName = (aok and info and info.name) or ("Affix " .. a.id)
      local aDesc = (aok and info and info.description) or ""
      table.insert(result, { name = aName, description = aDesc })
    end
  end
  return result
end

local function getSecondaryStats()
  -- Rating IDs: 9=spell crit, 20=ranged haste (generic proxy), 28=mastery, 40=avoidance/versatility
  local function rating(id)
    local ok, val = pcall(GetCombatRatingBonus, id)
    if ok and val then return math.floor(val * 100) / 100 end
    return 0
  end
  return {
    crit = rating(9),
    haste = rating(20),
    mastery = rating(28),
    versatility = rating(40),
  }
end

local function getMountCount()
  local ok, collected, total = pcall(C_MountJournal.GetNumMounts)
  if ok then
    return { collected = collected or 0, total = total or 0 }
  end
  return nil
end

-- ─── Inventory / bank collection ─────────────────────────────────────────────

local QUALITY_NAMES = {
  [0] = "Poor", [1] = "Common", [2] = "Uncommon",
  [3] = "Rare", [4] = "Epic", [5] = "Legendary",
}

local BAG_IDS      = {0, 1, 2, 3, 4}            -- backpack + 4 bag slots
local BANK_BAG_IDS = {-1, 5, 6, 7, 8, 9, 10, 11} -- main bank + 7 bank bag slots

local bankItemsCache = {}
local bankDataAvailable = false

local function getItems(bagIDs)
  local items = {}
  for _, bagID in ipairs(bagIDs) do
    local ok, numSlots = pcall(C_Container.GetContainerNumSlots, bagID)
    if ok and numSlots and numSlots > 0 then
      for slot = 1, numSlots do
        local ok2, info = pcall(C_Container.GetContainerItemInfo, bagID, slot)
        if ok2 and info and info.hyperlink then
          local name, _, quality, itemLevel, _, itemType, itemSubType = GetItemInfo(info.hyperlink)
          if name and quality and quality > 0 then  -- skip grey (Poor) items
            local itemID = info.hyperlink:match("item:(%d+)") or ""
            table.insert(items, {
              id = itemID,
              name = name,
              quality = QUALITY_NAMES[quality] or "Unknown",
              ilvl = itemLevel or 0,
              type = itemType or "",
              subtype = itemSubType or "",
              count = info.stackCount or 1,
            })
          end
        end
      end
    end
  end
  return items
end

local function getCharacterData()
  local name = UnitName("player") or "Unknown"
  local realm = GetRealmName() or "Unknown"
  local className = UnitClass("player") or "Unknown"
  local level = UnitLevel("player") or 0

  local avgIlvl, equippedIlvl = GetAverageItemLevel()
  avgIlvl = math.floor(avgIlvl or 0)
  equippedIlvl = math.floor(equippedIlvl or avgIlvl or 0)

  local specName = "Unknown"
  local specIndex = GetSpecialization()
  if specIndex and specIndex > 0 then
    local _, sName = GetSpecializationInfo(specIndex)
    specName = sName or "Unknown"
  end

  return {
    name = name,
    realm = realm,
    level = level,
    class = className,
    spec = specName,
    equippedIlvl = equippedIlvl,
    avgIlvl = avgIlvl,
  }
end

local function getWorldQuests()
  local quests = {}
  local seen = {}

  local currentMapID = C_Map.GetBestMapForUnit("player")
  local zonesToScan = {}
  for _, id in ipairs(SCAN_ZONES) do zonesToScan[id] = true end
  if currentMapID then
    zonesToScan[currentMapID] = true
    local mapInfo = C_Map.GetMapInfo(currentMapID)
    if mapInfo and mapInfo.parentMapID and mapInfo.parentMapID > 0 then
      zonesToScan[mapInfo.parentMapID] = true
    end
  end

  for mapID in pairs(zonesToScan) do
    local taskPOIs = C_TaskQuest.GetQuestsOnMap(mapID)
    if taskPOIs then
      for _, poi in ipairs(taskPOIs) do
        local questID = poi.questID
        if questID and not seen[questID] then
          seen[questID] = true
          local title = C_QuestLog.GetTitleForQuestID(questID)
          if title and title ~= "" then
            table.insert(quests, {
              id = questID,
              name = title,
              mapID = mapID,
              isDaily = poi.isDaily and true or false,
            })
          end
        end
      end
    end
  end

  return quests
end

-- ─── Copy popup frame ───────────────────────────────────────────────────────
-- CopyToClipboard is a protected function in Midnight and causes taint.
-- Instead, we show an EditBox with the data auto-selected so the user
-- can press Ctrl+C themselves — keyboard copy from an EditBox is not protected.

local copyFrame

local function buildCopyFrame()
  local f = CreateFrame("Frame", "WoWAdvisorCopyFrame", UIParent, "BackdropTemplate")
  f:SetSize(540, 200)
  f:SetPoint("CENTER")
  f:SetFrameStrata("DIALOG")
  f:SetMovable(true)
  f:EnableMouse(true)
  f:RegisterForDrag("LeftButton")
  f:SetScript("OnDragStart", f.StartMoving)
  f:SetScript("OnDragStop", f.StopMovingOrSizing)
  f:SetBackdrop({
    bgFile   = "Interface/DialogFrame/UI-DialogBox-Background",
    edgeFile = "Interface/DialogFrame/UI-DialogBox-Border",
    tile = true, tileSize = 32, edgeSize = 32,
    insets = { left=11, right=12, top=12, bottom=11 },
  })
  f:Hide()

  -- Title bar
  local title = f:CreateFontString(nil, "OVERLAY", "GameFontHighlightLarge")
  title:SetPoint("TOP", f, "TOP", 0, -16)
  title:SetText("WoW Advisor — Addon Data")

  -- Instructions
  local info = f:CreateFontString(nil, "OVERLAY", "GameFontNormal")
  info:SetPoint("TOP", title, "BOTTOM", 0, -6)
  info:SetWidth(500)
  info:SetWordWrap(true)
  info:SetJustifyH("CENTER")
  info:SetText("Press Ctrl+A then Ctrl+C to copy, then visit bakerrang.com > WoW Advisor and click 'Paste Addon Data'.")
  info:SetTextColor(0.8, 0.8, 0.8)

  -- Scroll frame + EditBox
  local scroll = CreateFrame("ScrollFrame", nil, f, "UIPanelScrollFrameTemplate")
  scroll:SetPoint("TOPLEFT", f, "TOPLEFT", 14, -80)
  scroll:SetPoint("BOTTOMRIGHT", f, "BOTTOMRIGHT", -30, 40)

  local eb = CreateFrame("EditBox", nil, scroll)
  eb:SetMultiLine(true)
  eb:SetMaxLetters(0)
  eb:SetFontObject(GameFontNormalSmall)
  eb:SetWidth(scroll:GetWidth())
  eb:SetAutoFocus(false)
  eb:SetScript("OnEscapePressed", function() f:Hide() end)
  scroll:SetScrollChild(eb)

  -- Close button
  local closeBtn = CreateFrame("Button", nil, f, "UIPanelCloseButton")
  closeBtn:SetPoint("TOPRIGHT", f, "TOPRIGHT", -4, -4)
  closeBtn:SetScript("OnClick", function() f:Hide() end)

  -- Select All button
  local selBtn = CreateFrame("Button", nil, f, "UIPanelButtonTemplate")
  selBtn:SetSize(100, 22)
  selBtn:SetPoint("BOTTOM", f, "BOTTOM", 0, 12)
  selBtn:SetText("Select All")
  selBtn:SetScript("OnClick", function()
    eb:SetFocus()
    eb:HighlightText()
  end)

  f.editBox = eb
  return f
end

local function showCopyPopup(text)
  if not copyFrame then
    copyFrame = buildCopyFrame()
  end
  copyFrame.editBox:SetText(text)
  copyFrame:Show()
  -- Auto-select so user only needs to press Ctrl+C
  copyFrame.editBox:SetFocus()
  copyFrame.editBox:HighlightText()
end

-- ─── Tier set scanner ───────────────────────────────────────────────────────

-- Reads tooltip lines from the rendered GameTooltip for an item ID.
-- Returns a list of {left, right} strings, or nil if not available.
local function getRenderedTooltipLines(itemID)
  GameTooltip:SetOwner(UIParent, "ANCHOR_NONE")
  GameTooltip:SetItemByID(itemID)
  local lines = {}
  for i = 1, GameTooltip:NumLines() do
    local left  = _G["GameTooltipTextLeft"  .. i]
    local right = _G["GameTooltipTextRight" .. i]
    local lt = left  and left:GetText()  or ""
    local rt = right and right:GetText() or ""
    table.insert(lines, { leftText = lt, rightText = rt })
  end
  GameTooltip:Hide()
  return lines
end

-- Extracts set bonus information from a list of tooltip line objects.
-- Each line is {leftText, rightText}. Tries multiple line formats.
local function extractSetBonuses(lines)
  if not lines or #lines == 0 then return nil end
  local setName = nil
  local bonuses = {}
  local inSet = false
  for _, line in ipairs(lines) do
    local text = line.leftText
    if not text or text == "" then
      inSet = false
    else
      -- Strip color codes: |cXXXXXXXX...|r
      text = text:gsub("|c%x%x%x%x%x%x%x%x", ""):gsub("|r", "")
      -- Set name line: "Name (N/M)" or "Name (N)"
      local name = text:match("^(.+) %(%d+/%d+%)$") or text:match("^(.+) %(%d+%)$")
      if name then
        setName = name
        inSet = true
      elseif inSet then
        -- "(N) Set: desc" or "(N) Set Bonus: desc" or "Set (N): desc"
        local pieces, desc =
          text:match("^%((%d+)%) Set: (.+)$") or
          text:match("^%((%d+)%) Set Bonus: (.+)$") or
          (function() local p,d = text:match("^Set %((%d+)%): (.+)$"); return p,d end)()
        if pieces and desc then
          table.insert(bonuses, { pieces = tonumber(pieces), description = desc })
        end
      end
    end
  end
  if setName and #bonuses > 0 then
    return { name = setName, bonuses = bonuses }
  end
  return nil
end

-- Formats collected sets as markdown
local function buildMarkdownFromSets(sets, setOrder)
  local lines = {
    "# WoW Tier Set Bonuses",
    "",
    "<!-- Generated by /wowadvisor tiersets — paste into server/data/wow-tier-sets.md -->",
    "<!-- Update after each patch: node scripts/populateWowGameData.js --customTierSets -->",
    "",
  }
  for _, name in ipairs(setOrder) do
    table.insert(lines, "## " .. name)
    table.insert(lines, "")
    for _, b in ipairs(sets[name]) do
      table.insert(lines, "**" .. b.pieces .. "-piece:** " .. b.description)
      table.insert(lines, "")
    end
  end
  return table.concat(lines, "\n")
end

-- Async tier set scan state
local tierScan = {
  active   = false,
  pending  = {},   -- itemID -> true, waiting for GET_ITEM_INFO_RECEIVED
  sets     = {},
  setOrder = {},
  total    = 0,
}

-- Event frame to receive item data load notifications
local tierScanFrame = CreateFrame("Frame")
tierScanFrame:SetScript("OnEvent", function(self, event, itemID)
  if event ~= "GET_ITEM_INFO_RECEIVED" then return end
  if not tierScan.active or not tierScan.pending[itemID] then return end
  tierScan.pending[itemID] = nil

  local lines = getRenderedTooltipLines(itemID)
  if lines then
    local setInfo = extractSetBonuses(lines)
    if setInfo and not tierScan.sets[setInfo.name] then
      tierScan.sets[setInfo.name] = setInfo.bonuses
      table.insert(tierScan.setOrder, setInfo.name)
    end
  end

  -- All pending items resolved — finalizeScan is defined in startTierSetScan's closure,
  -- so we just clear active here and let the timer/sync path handle output.
  -- (finalizeScan will no-op if already called by timeout)
  if not next(tierScan.pending) then
    tierScan.active = false
    tierScanFrame:UnregisterEvent("GET_ITEM_INFO_RECEIVED")
    if #tierScan.setOrder == 0 then
      print("Scan complete (" .. tierScan.total .. " items checked) — no set bonus lines found.")
      print("Tip: try /wowadvisor debug to inspect raw tooltip lines for a journal item.")
    else
      showCopyPopup(buildMarkdownFromSets(tierScan.sets, tierScan.setOrder))
      print("Done! Found " .. #tierScan.setOrder .. " tier set(s). Copy the popup and paste into server/data/wow-tier-sets.md")
    end
  end
end)

-- Collects all item IDs from the current expansion's encounter journal.
-- Returns a flat table of itemIDs.
local function collectJournalItemIDs()
  if not EJ_GetNumTiers then return nil, "EJ_GetNumTiers not available" end
  local numTiers = EJ_GetNumTiers()
  if not numTiers or numTiers == 0 then
    return nil, "No tiers found — open the Adventure Guide (Shift-J) first"
  end
  EJ_SelectTier(numTiers)

  local itemIDs = {}
  local seen = {}

  local function collectLoot()
    local numLoot = EJ_GetNumLoot()
    for l = 1, (numLoot or 0) do
      local info = C_EncounterJournal.GetLootInfoByIndex(l)
      if info and info.itemID and info.itemID > 0 and not seen[info.itemID] then
        seen[info.itemID] = true
        itemIDs[#itemIDs + 1] = info.itemID
      end
    end
  end

  local function scanInstanceLoot(instanceID)
    EJ_SelectInstance(instanceID)
    collectLoot()  -- instance-level loot

    -- Also collect per-encounter loot (3rd return value is the actual encounter ID)
    local e = 1
    while true do
      local encName, _, encounterID = EJ_GetEncounterInfoByIndex(e)
      if not encName then break end
      if encounterID and encounterID > 0 then
        local ok = pcall(EJ_SelectEncounter, encounterID)
        if ok then collectLoot() end
      end
      e = e + 1
    end
  end

  for _, isRaid in ipairs({ true, false }) do
    local idx = 1
    while true do
      local instanceID = EJ_GetInstanceByIndex(idx, isRaid)
      if not instanceID then break end
      scanInstanceLoot(instanceID)
      idx = idx + 1
    end
  end

  return itemIDs, nil
end

-- Starts an async tier set scan. Shows popup when all item data is loaded.
local function startTierSetScan()
  if tierScan.active then
    print("Scan already in progress, please wait...")
    return
  end

  local itemIDs, err = collectJournalItemIDs()
  if not itemIDs then
    print("Error: " .. (err or "unknown"))
    return
  end
  if #itemIDs == 0 then
    print("No loot items found in the encounter journal for the current tier.")
    return
  end

  print("Found " .. #itemIDs .. " journal items — scanning for set bonuses...")

  -- Reset state
  tierScan.active  = true
  tierScan.pending = {}
  tierScan.sets    = {}
  tierScan.setOrder = {}
  tierScan.total   = #itemIDs

  for _, itemID in ipairs(itemIDs) do
    -- Try synchronous scan via rendered tooltip (richer than data API)
    local lines = getRenderedTooltipLines(itemID)
    local firstLine = lines and lines[1] and lines[1].leftText or ""
    if firstLine ~= "" and firstLine ~= "Retrieving item information" then
      local setInfo = extractSetBonuses(lines)
      if setInfo and not tierScan.sets[setInfo.name] then
        tierScan.sets[setInfo.name] = setInfo.bonuses
        table.insert(tierScan.setOrder, setInfo.name)
      end
    else
      -- Item not cached yet — request async load
      if C_Item.RequestLoadItemDataByID then
        C_Item.RequestLoadItemDataByID(itemID)
      end
      tierScan.pending[itemID] = true
    end
  end

  local function finalizeScan(timedOut)
    tierScanFrame:UnregisterEvent("GET_ITEM_INFO_RECEIVED")
    tierScan.active = false
    local suffix = timedOut and " (timed out)" or ""
    if #tierScan.setOrder == 0 then
      print("Scan complete (" .. tierScan.total .. " items checked" .. suffix .. ") — no set bonus lines found.")
      print("Tip: use /wowadvisor debug to see raw tooltip lines for journal items.")
    else
      showCopyPopup(buildMarkdownFromSets(tierScan.sets, tierScan.setOrder))
      print("Done! Found " .. #tierScan.setOrder .. " tier set(s)" .. suffix .. ". Copy the popup and paste into server/data/wow-tier-sets.md")
    end
  end

  if not next(tierScan.pending) then
    -- Everything was already cached — done synchronously
    finalizeScan(false)
  else
    local n = 0
    for _ in pairs(tierScan.pending) do n = n + 1 end
    print("Waiting for " .. n .. " item(s) to load (15s timeout)...")
    tierScanFrame:RegisterEvent("GET_ITEM_INFO_RECEIVED")
    C_Timer.After(15, function()
      if tierScan.active then finalizeScan(true) end
    end)
  end
end

-- Debug command: API discovery + journal state diagnostic
local function debugFirstJournalItem()
  local out = {}
  local function w(s) table.insert(out, tostring(s)) end

  -- Section 1: list all available EJ_ functions
  w("=== EJ_ FUNCTIONS AVAILABLE ===")
  local ejFuncs = {}
  for k, v in pairs(_G) do
    if type(k) == "string" and k:sub(1, 3) == "EJ_" and type(v) == "function" then
      table.insert(ejFuncs, k)
    end
  end
  table.sort(ejFuncs)
  for _, fn in ipairs(ejFuncs) do w(fn) end

  -- Section 2: C_EncounterJournal namespace if it exists
  w("")
  w("=== C_EncounterJournal FUNCTIONS ===")
  if C_EncounterJournal then
    local cejFuncs = {}
    for k, v in pairs(C_EncounterJournal) do
      if type(v) == "function" then table.insert(cejFuncs, k) end
    end
    table.sort(cejFuncs)
    for _, fn in ipairs(cejFuncs) do w("C_EncounterJournal." .. fn) end
  else
    w("C_EncounterJournal = nil")
  end

  -- Section 3: tier / instance state
  w("")
  w("=== JOURNAL STATE ===")
  if not EJ_GetNumTiers then
    w("EJ_GetNumTiers = nil")
    showCopyPopup(table.concat(out, "\n"))
    return
  end
  local numTiers = EJ_GetNumTiers()
  w("EJ_GetNumTiers() = " .. tostring(numTiers))
  if not numTiers or numTiers == 0 then
    showCopyPopup(table.concat(out, "\n"))
    return
  end
  EJ_SelectTier(numTiers)
  w("EJ_SelectTier(" .. numTiers .. ") called")

  -- Section 4: select first raid instance, enumerate encounters and loot
  w("")
  w("=== FIRST RAID INSTANCE SCAN ===")
  local firstInstanceID = EJ_GetInstanceByIndex(1, true)
  w("EJ_GetInstanceByIndex(1, true) = " .. tostring(firstInstanceID))
  if firstInstanceID then
    local instName = EJ_GetInstanceInfo(firstInstanceID)
    w("Instance name: " .. tostring(instName))
    EJ_SelectInstance(firstInstanceID)

    -- Instance-level loot via correct APIs
    local numLoot = EJ_GetNumLoot()
    w("EJ_GetNumLoot() at instance level = " .. tostring(numLoot))
    local firstItemID = nil
    for l = 1, (numLoot or 0) do
      local info = C_EncounterJournal.GetLootInfoByIndex(l)
      if info then
        w("  loot[" .. l .. "] itemID=" .. tostring(info.itemID) .. " name=" .. tostring(info.name))
        if not firstItemID and info.itemID and info.itemID > 0 then firstItemID = info.itemID end
      end
    end

    -- Raw return values from EJ_GetEncounterInfoByIndex
    w("")
    w("EJ_GetEncounterInfoByIndex raw returns (index 0-2):")
    for idx = 0, 2 do
      local r1, r2, r3, r4, r5 = EJ_GetEncounterInfoByIndex(idx)
      w("  [" .. idx .. "] " .. tostring(r1) .. " | " .. tostring(r2):sub(1,30) ..
        " | " .. tostring(r3):sub(1,20) .. " | r4=" .. tostring(r4) .. " | r5=" .. tostring(r5))
    end

    -- Encounters via corrected API
    w("")
    w("Encounters (EJ_GetEncounterInfoByIndex, starting at 1):")
    local e = 1
    while true do
      local encounterID = (EJ_GetEncounterInfoByIndex(e))
      if not encounterID or encounterID == 0 then break end
      w("  enc[" .. e .. "] id=" .. encounterID)
      local selOk, selErr = pcall(EJ_SelectEncounter, encounterID)
      if selOk then
        local encLoot = EJ_GetNumLoot()
        w("    EJ_GetNumLoot() = " .. tostring(encLoot))
        for l = 1, (encLoot or 0) do
          local info = C_EncounterJournal.GetLootInfoByIndex(l)
          if info then
            w("    loot[" .. l .. "] itemID=" .. tostring(info.itemID) .. " name=" .. tostring(info.name))
            if not firstItemID and info.itemID and info.itemID > 0 then firstItemID = info.itemID end
          end
          if l >= 5 then w("    ... (showing first 5)") break end
        end
      else
        w("    EJ_SelectEncounter failed: " .. tostring(selErr))
      end
      e = e + 1
    end

    -- Tooltip dump — try a few items until we find one that's cached
    w("")
    local dumpID = nil
    local dumpLines = nil
    -- prefer armor slots (likely tier pieces) — check first 17 items
    local checkIDs = {}
    local numCheck = EJ_GetNumLoot()
    for l = 1, (numCheck or 0) do
      local info = C_EncounterJournal.GetLootInfoByIndex(l)
      if info and info.itemID and info.itemID > 0 then
        table.insert(checkIDs, info.itemID)
      end
    end
    -- also add firstItemID as fallback
    if firstItemID then table.insert(checkIDs, firstItemID) end

    for _, checkID in ipairs(checkIDs) do
      local lines = getRenderedTooltipLines(checkID)
      local first = lines and lines[1] and lines[1].leftText or ""
      if first ~= "" and first ~= "Retrieving item information" then
        dumpID = checkID
        dumpLines = lines
        break
      end
    end

    if dumpID then
      w("=== GameTooltip for itemID=" .. dumpID .. " ===")
      for i, line in ipairs(dumpLines) do
        local left  = line.leftText  or ""
        local right = line.rightText or ""
        local entry = "  [" .. i .. "] " .. left
        if right ~= "" then entry = entry .. "  |  " .. right end
        w(entry)
        if i >= 40 then w("  ... (truncated at 40)") break end
      end
    else
      w("All items show 'Retrieving item information' — none are cached yet.")
      w("Open the encounter journal loot tab in-game, then /wowadvisor debug again.")
    end
  end

  showCopyPopup(table.concat(out, "\n"))
  print("Debug info ready — press Ctrl+A, Ctrl+C to copy.")
end

-- ─── Open advisor ───────────────────────────────────────────────────────────

local function openAdvisor()
  local char = getCharacterData()
  local worldQuests = getWorldQuests()
  local currencies = getCurrencies()
  local vault = getVault()
  local affixes = getAffixes()
  local stats = getSecondaryStats()
  local mountCount = getMountCount()
  local inventory = getItems(BAG_IDS)
  local bank = bankDataAvailable and bankItemsCache or nil

  -- Build the full payload and show the copy popup
  local payload = jsonEncode({
    character = char,
    worldQuests = worldQuests,
    currencies = currencies,
    vault = vault,
    affixes = affixes,
    stats = stats,
    mountCount = mountCount,
    inventory = inventory,
    bank = bank,
    bankAvailable = bankDataAvailable,
  })

  local bankNote = bankDataAvailable and (", " .. #bankItemsCache .. " bank item(s)") or " (visit bank to include bank data)"
  print("Opening WoW Advisor for " .. char.name .. "-" .. char.realm ..
        " (" .. #inventory .. " bag item(s)" .. bankNote .. ").")
  print("A popup will appear — press Ctrl+A, Ctrl+C, then click 'Paste Addon Data' on the web page.")
  showCopyPopup(payload)
end

-- ─── Slash commands ─────────────────────────────────────────────────────────

SLASH_WOWADVISOR1 = "/wowadvisor"
SLASH_WOWADVISOR2 = "/wow"

SlashCmdList["WOWADVISOR"] = function(msg)
  local cmd = (msg or ""):lower():match("^%s*(.-)%s*$")

  if cmd == "zones" then
    local mapID = C_Map.GetBestMapForUnit("player")
    if mapID then
      local mapInfo = C_Map.GetMapInfo(mapID)
      local zoneName = mapInfo and mapInfo.name or "Unknown"
      print("Current zone: " .. zoneName .. " (mapID=" .. mapID .. ")")
      if mapInfo and mapInfo.parentMapID and mapInfo.parentMapID > 0 then
        local parentInfo = C_Map.GetMapInfo(mapInfo.parentMapID)
        local parentName = parentInfo and parentInfo.name or "Unknown"
        print("Parent zone: " .. parentName .. " (mapID=" .. mapInfo.parentMapID .. ")")
      end
      print("Add these IDs to SCAN_ZONES in WoWAdvisor.lua to include this area.")
    else
      print("Could not determine current zone.")
    end
  elseif cmd == "tiersets" then
    local ok, err = pcall(startTierSetScan)
    if not ok then
      print("Error: " .. tostring(err))
      print("Try opening the Adventure Guide (Shift-J) first, then retry /wowadvisor tiersets")
    end
  elseif cmd == "debug" then
    local ok, err = pcall(debugFirstJournalItem)
    if not ok then
      print("Debug error: " .. tostring(err))
    end
  else
    openAdvisor()
  end
end

-- ─── Addon loaded ───────────────────────────────────────────────────────────

local frame = CreateFrame("Frame")
frame:RegisterEvent("ADDON_LOADED")
frame:RegisterEvent("BANKFRAME_OPENED")
frame:SetScript("OnEvent", function(self, event, arg1)
  if event == "ADDON_LOADED" and arg1 == ADDON_NAME then
    print("Loaded! Type /wowadvisor to open the advisor.")
  elseif event == "BANKFRAME_OPENED" then
    bankItemsCache = getItems(BANK_BAG_IDS)
    bankDataAvailable = true
    print("Bank data captured (" .. #bankItemsCache .. " items). Run /wowadvisor to include it.")
  end
end)
