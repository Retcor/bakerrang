-- BakerRang Advisor
-- Collects in-game character data and shows a copy popup so you can paste
-- it into the BakerRang WoW Advisor page for AI-powered advice.
--
-- Usage:
--   /bakergpt        — collect data and show the copy popup
--   /bakergpt zones  — print current zone map IDs to chat

local ADDON_NAME = "BakerRangAdvisor"

-- Zone map IDs to scan for world quests.
-- Midnight (12.0.1) zones — update these once UiMapIDs are confirmed in-game.
-- Use "/bakergpt zones" to print your current zone ID and add it here.
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
  DEFAULT_CHAT_FRAME:AddMessage("|cff" .. ADDON_COLOR .. "[BakerRang]|r " .. tostring((...)))
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
            table.insert(items, {
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
  local f = CreateFrame("Frame", "BakerRangCopyFrame", UIParent, "BackdropTemplate")
  f:SetSize(540, 180)
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
  title:SetText("BakerRang — Addon Data")

  -- Instructions
  local info = f:CreateFontString(nil, "OVERLAY", "GameFontNormal")
  info:SetPoint("TOP", title, "BOTTOM", 0, -6)
  info:SetText("Press Ctrl+A then Ctrl+C to copy, then click 'Paste Addon Data' on the web page.")
  info:SetTextColor(0.8, 0.8, 0.8)

  -- Scroll frame + EditBox
  local scroll = CreateFrame("ScrollFrame", nil, f, "UIPanelScrollFrameTemplate")
  scroll:SetPoint("TOPLEFT", f, "TOPLEFT", 14, -70)
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

SLASH_BAKERRANG1 = "/bakergpt"
SLASH_BAKERRANG2 = "/wowadvisor"

SlashCmdList["BAKERRANG"] = function(msg)
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
      print("Add these IDs to SCAN_ZONES in BakerRangAdvisor.lua to include this area.")
    else
      print("Could not determine current zone.")
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
    print("Loaded! Type /bakergpt to open the advisor.")
  elseif event == "BANKFRAME_OPENED" then
    bankItemsCache = getItems(BANK_BAG_IDS)
    bankDataAvailable = true
    print("Bank data captured (" .. #bankItemsCache .. " items). Run /bakergpt to include it.")
  end
end)
