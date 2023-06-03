import {STEAM_ACCOUNTS, TRUSTED_ACCOUNTS, SUSPICIOUS_ACCOUNTS} from './steam-accounts.js';

const corsAnywhereProxyUrl = "https://cors-anywhere.herokuapp.com/"
const allOriginsWinProxyUrl = "https://api.allorigins.win/raw?url="
const proxyUrl = corsAnywhereProxyUrl
const urlApiQuery = "?xml=1&start=0&end=99"


const domes = {
    1: {name: "Laser", icon: "1007374870671282469"},
    2: {name: "Sword", icon: "1007374934965768354"},
    3: {name: "Cannon", icon: "1007374976233517226"},
}

const keepers = {
    1: {name: "Engineer", icon: "1007375038657347637"},
    2: {name: "Assessor", icon: "1007375161596592232"},
}

const gadgets = {
    1: {name: "Orchard", icon: "1007375257037975684"},
    2: {name: "Repellent", icon: "1007375206752452708"},
    3: {name: "Shield", icon: "1007375296640593980"},
}

const winStatuses = {
    false: {name: "Died", icon: "1031570909179429005"},
    true: {name: "Survived", icon: "1031570928083144876"},
}

const modes = {
    0: {name: "Endless", abbreviation: "EM", leaderboardId: 10333603},
    1: {name: "Fixed Cobalt", abbreviation: "FC", leaderboardId: 10333601},
    2: {name: "Countdown", abbreviation: "CD", leaderboardId: 10333379},
    3: {name: "Miner", abbreviation: "MM", leaderboardId: 10333602},
}

const leaderboard = document.getElementById("leaderboard")
const gameModeSelect = document.getElementById("game-mode-select")
const error429 = document.getElementById("error-429")

let useDummyUrl = false
if (location.hostname === "localhost" || location.hostname === "127.0.0.1" || location.hostname === "")
    useDummyUrl = true

gameModeSelect.addEventListener("change", displaySelectedLeaderboard)

clearOldCaches()
displaySelectedLeaderboard()

function clearOldCaches() {
    for (let key of Object.keys(localStorage)) {
        if (key.startsWith("leaderboardData_") && key.endsWith("_expires")) {
            // remove caches older than a month
            const now = new Date()
            const lastMonth = new Date(
                now.getFullYear(),
                now.getMonth() - 1,
                now.getDate(),
                0, 0, 0, 0
            )
            if (new Date(parseInt(localStorage.getItem(key))) < lastMonth) {
                console.log("removing old cache " + key)
                localStorage.removeItem(key)
                let dataCacheKey = key.replace("_expires", "")
                localStorage.removeItem(dataCacheKey)
            }
        }
    }
}

function parseLeaderboardData(xmlString) {
    let data
    try {
        data = new window.DOMParser().parseFromString(xmlString, "text/xml")
    } catch (error) {
        console.error("Threw error parsing response: " + error)
        return null
    }

    let parseError = data.querySelector("parsererror")
    if (parseError) {
        console.log("Error parsing response: " + parseError.textContent)
        return null
    }

    return data
}

async function getLeaderboardData(boardId) {
    const url = getLeaderboardApiUrl(boardId)
    try {
        const cacheKey = `leaderboardData_${url}`
        const cachedData = localStorage.getItem(cacheKey)
        const cacheExpires = localStorage.getItem(`${cacheKey}_expires`)

        let isCacheExpired = false

        if (cachedData && cacheExpires) {
            // Check if the cached data has expired
            const expirationTime = parseInt(cacheExpires)
            if (new Date().getTime() < expirationTime) {
                let data = parseLeaderboardData(cachedData)
                if (data) {
                    console.log("Found cache, returning " + cachedData.slice(0, 100) + "...")
                    return data
                } else {
                    console.log("Found invalid cache")
                    isCacheExpired = true
                }

            } else {
                console.log("Found expired cache")
                isCacheExpired = true
            }
        }

        let options = {
            /*cache: "no-store"*/
        }

        console.log("Fetching new data")
        const response = await fetch(url, options)
        const str = await response.text()
        let data = parseLeaderboardData(str)

        console.log(response.status)

        if (!response.status === 200 || !data) {
            console.error(`Response was not OK. Status Code ${response.status}, response: ${str.slice(0, 100)}...`)
            if (cachedData) {
                const data = parseLeaderboardData(cachedData)
                if (data) {
                    const cacheMessage = document.querySelector(".cache-message")
                    const expirationDate = new Date(parseInt(cacheExpires))
                    document.querySelector(".cache-message-date").innerText = expirationDate.toLocaleString()
                    document.querySelector(".cache-message-url").href = getLeaderboardUrl(boardId)
                    cacheMessage.style.display = "block"
                    console.log("Using old cache, returning " + cachedData.slice(0, 100) + "...")

                    return data
                } else {
                    console.log("Found invalid cache")
                    isCacheExpired = true
                }
            }

            if (response.status === 429) {
                console.log("showing 429")
                error429.style.display = "block"
            }
        }

        if (isCacheExpired) {
            console.log("Removing old or invalid cache " + cacheKey)
            // Remove expired data from localStorage
            localStorage.removeItem(cacheKey)
            localStorage.removeItem(`${cacheKey}_expires`)
        }

        if (!data) {
            return
        }

        console.log("Adding new cache " + str.slice(0, 100) + "...")
        localStorage.setItem(cacheKey, str)
        // Set the expiration time to the next full hour
        const now = new Date()
        const nextHour = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            now.getHours() + 1,
            0,
            0,
            0
        )
        localStorage.setItem(`${cacheKey}_expires`, nextHour.getTime())

        return data
    } catch (error) {
        console.error(error)
    }
}

async function displayLeaderboard(boardId) {
    leaderboard.innerHTML = "" // reset board
    const data = await getLeaderboardData(boardId)
    if (!data) return

    const entries = data.querySelectorAll("entry")
    for (const entry of entries) {
        const rank = entry.querySelector("rank").textContent

        const steamId = entry.querySelector("steamid").textContent
        const score = entry.querySelector("score").textContent
        const details = parseDetails(
            entry.querySelector("details").textContent.trim()
        )

        //console.log(JSON.stringify(details))

        const entryElement = createLeaderboardEntry(rank, steamId, score, details)
        leaderboard.appendChild(entryElement)

        //break
    }
}

function createLeaderboardEntry(rank, steamId, score, details) {
    const entry = document.createElement("div")
    entry.classList.add("leaderboard-entry")

    const rankDiv = document.createElement("div")
    rankDiv.classList.add("rank")
    const rankSpan = document.createElement("span")
    rankSpan.textContent = rank
    rankDiv.appendChild(rankSpan)
    entry.appendChild(rankDiv)

    const detailsDiv = document.createElement("div")
    detailsDiv.classList.add("details")
    const runDiv = document.createElement("div")
    runDiv.classList.add("run")

    const scoreSpan = document.createElement("span")
    scoreSpan.classList.add("score")
    scoreSpan.textContent = `Score: ${score}`

    const multipliersSpan = document.createElement("span")
    multipliersSpan.classList.add("multipliers")
    multipliersSpan.textContent = `${details.cobaltMultiplier} × ${details.resourceMultiplier}`

    const winStatusContainer = document.createElement("span")
    winStatusContainer.classList.add("icon-container")
    const winStatusSpan = document.createElement("span")
    winStatusSpan.textContent = "Status"
    winStatusContainer.appendChild(winStatusSpan)
    const winStatusImg = document.createElement("img")
    winStatusImg.classList.add("icon")
    winStatusImg.classList.add("win-status")
    winStatusImg.src = winStatusIconUrl(details.winStatus)
    winStatusImg.alt = winStatusText(details.winStatus)
    winStatusContainer.appendChild(winStatusImg)

    const loadoutSpan = document.createElement("span")
    loadoutSpan.classList.add("icon-contianer")
    const domeImg = document.createElement("img")
    domeImg.classList.add("icon")
    domeImg.classList.add("dome")
    domeImg.src = domeIconUrl(details.dome)
    domeImg.alt = domeText(details.dome)
    loadoutSpan.appendChild(domeImg)

    const keeperImg = document.createElement("img")
    keeperImg.classList.add("icon")
    keeperImg.classList.add("keeper")
    keeperImg.src = keeperIconUrl(details.keeper)
    keeperImg.alt = keeperText(details.keeper)
    loadoutSpan.appendChild(keeperImg)

    const primaryGadgetImg = document.createElement("img")
    primaryGadgetImg.classList.add("icon")
    primaryGadgetImg.classList.add("primary-gadget")
    primaryGadgetImg.src = gadgetIconUrl(details.primaryGadget)
    primaryGadgetImg.alt = gadgetText(details.primaryGadget)
    loadoutSpan.appendChild(primaryGadgetImg)

    const playtimeSpan = document.createElement("span")
    playtimeSpan.classList.add("playtime")
    playtimeSpan.textContent = `Game: ${getTimeString(details.playtime)}`

    const wavesSpan = document.createElement("span")
    wavesSpan.classList.add("waves")
    wavesSpan.textContent = `${details.waves} waves`

    const wavetimeSpan = document.createElement("span")
    wavetimeSpan.classList.add("wavetime")
    wavetimeSpan.textContent = "Battle: " + getTimeString(details.wavetime)

    const monstersKilledSpan = document.createElement("span")
    monstersKilledSpan.classList.add("monsters-killed")
    monstersKilledSpan.textContent = "Monsters: " + details.monstersKilled

    const damageSpan = document.createElement("span")
    damageSpan.classList.add("damage")
    damageSpan.textContent = "Damage: " + details.damage

    const blocksSpan = document.createElement("span")
    blocksSpan.classList.add("blocks")
    blocksSpan.textContent = "Blocks: " + details.blocks

    const distanceSpan = document.createElement("span")
    distanceSpan.classList.add("distance")
    distanceSpan.textContent = `Distance: ${details.distance} km`

    const savesSpan = document.createElement("span")
    savesSpan.classList.add("saves")
    savesSpan.textContent = "Manual Saves: " + details.saves

    const resourcesSpan = document.createElement("span")
    resourcesSpan.classList.add("resources")
    resourcesSpan.textContent = "Resources: " + details.resources

    const gadgetsReturnedSpan = document.createElement("span")
    gadgetsReturnedSpan.classList.add("gadgets-returned")
    gadgetsReturnedSpan.textContent = "Gadgets: " + details.gadgetsReturned

    const gadgetsShreddedSpan = document.createElement("span")
    gadgetsShreddedSpan.classList.add("gadgets-shredded")
    gadgetsShreddedSpan.textContent = "Shredded: " + details.gadgetsShredded

    const userSpan = document.createElement("span")
    const name = lookupName(steamId)
    userSpan.textContent = name ? name : "Unknown User"

    const userLink = document.createElement("a")
    userLink.classList.add("user")
    userLink.textContent = steamId
    userLink.href = `https://steamcommunity.com/profiles/${steamId}`
    userLink.target = "_blank"

    const versionSpan = document.createElement("span")
    versionSpan.classList.add("version")
    versionSpan.textContent = "v" + details.version

    const metaDiv = document.createElement("div")
    metaDiv.classList.add("meta")

    const modeLabel = document.createElement("span")
    modeLabel.classList.add("mode-label")
    modeLabel.textContent = modeAbbreviationText(details.gameMode)

    const copyButton = document.createElement("button")
    copyButton.title = "Copy for Discord"
    copyButton.classList.add("icon")
    copyButton.classList.add("icon-button")
    copyButton.classList.add("copy")

    const trustIcon = document.createElement("div")
    trustIcon.classList.add("icon")
    if (TRUSTED_ACCOUNTS.hasOwnProperty(steamId)) {
        trustIcon.classList.add("trusted")
        trustIcon.title = "Player provided video proof of legitimate runs"
        trustIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="ionicon" viewBox="0 0 512 512"><path fill='currentColor' d="M479.07 111.36a16 16 0 00-13.15-14.74c-86.5-15.52-122.61-26.74-203.33-63.2a16 16 0 00-13.18 0C168.69 69.88 132.58 81.1 46.08 96.62a16 16 0 00-13.15 14.74c-3.85 61.11 4.36 118.05 24.43 169.24A349.47 349.47 0 00129 393.11c53.47 56.73 110.24 81.37 121.07 85.73a16 16 0 0012 0c10.83-4.36 67.6-29 121.07-85.73a349.47 349.47 0 0071.5-112.51c20.07-51.19 28.28-108.13 24.43-169.24zm-131 75.11l-110.8 128a16 16 0 01-11.41 5.53h-.66a16 16 0 01-11.2-4.57l-49.2-48.2a16 16 0 1122.4-22.86l37 36.29 99.7-115.13a16 16 0 0124.2 20.94z"/></svg>`
    } else if (SUSPICIOUS_ACCOUNTS.hasOwnProperty(steamId)) {
        trustIcon.classList.add("suspicious")
        trustIcon.title = "Player suspected of cheating repeatedly"
        trustIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="ionicon" viewBox="0 0 512 512"><path fill="currentColor" d="M449.07 399.08L278.64 82.58c-12.08-22.44-44.26-22.44-56.35 0L51.87 399.08A32 32 0 0080 446.25h340.89a32 32 0 0028.18-47.17zm-198.6-1.83a20 20 0 1120-20 20 20 0 01-20 20zm21.72-201.15l-5.74 122a16 16 0 01-32 0l-5.74-121.95a21.73 21.73 0 0121.5-22.69h.21a21.74 21.74 0 0121.73 22.7z"/></svg>`
    } else {
        trustIcon.classList.add("neutral")
        //trustIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="ionicon" viewBox="0 0 512 512"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="44" d="M102 256h308M102 176h308M102 336h308"/></svg>`
    }

    detailsDiv.appendChild(runDiv)
    runDiv.appendChild(scoreSpan)
    runDiv.appendChild(winStatusContainer)
    runDiv.appendChild(loadoutSpan)
    runDiv.appendChild(multipliersSpan)
    runDiv.appendChild(wavesSpan)
    runDiv.appendChild(playtimeSpan)
    runDiv.appendChild(monstersKilledSpan)
    runDiv.appendChild(damageSpan)
    runDiv.appendChild(wavetimeSpan)
    runDiv.appendChild(blocksSpan)
    runDiv.appendChild(distanceSpan)
    runDiv.appendChild(savesSpan)
    runDiv.appendChild(resourcesSpan)
    runDiv.appendChild(gadgetsReturnedSpan)
    runDiv.appendChild(gadgetsShreddedSpan)
    runDiv.appendChild(versionSpan)
    runDiv.appendChild(userSpan)
    runDiv.appendChild(userLink)

    detailsDiv.appendChild(metaDiv)
    metaDiv.appendChild(copyButton)
    metaDiv.appendChild(modeLabel)
    metaDiv.appendChild(trustIcon)

    // Build the entry container
    const entryContainer = document.createElement("div")
    entryContainer.classList.add("leaderboard-entry")
    entryContainer.appendChild(rankDiv)
    entryContainer.appendChild(detailsDiv)
    leaderboard.appendChild(entryContainer)

    // set up copy action
    const clipboardText = [
        `Rank ${rankSpan?.innerText} ${modeAbbreviationText?.(details.gameMode)}: ${name || steamId}`,
        `Loadout: ${domeText?.(details.dome)} - ${keeperText?.(details.keeper)} - ${gadgetText?.(details.primaryGadget)}`,
        tableRow(scoreSpan.innerText, winStatusText(details.winStatus)),
        tableRow("Run: " + getTimeString(details.playtime), "Fight: " + getTimeString(details.wavetime)),
        tableRow("Multi: " + multipliersSpan.innerText, "Waves: " + details.waves),
        tableRow(resourcesSpan.innerText, "Gadgets: " + details.gadgetsReturned + " | -" + details.gadgetsShredded),
        tableRow(damageSpan.innerText, monstersKilledSpan.innerText),
        tableRow(blocksSpan.innerText, distanceSpan.innerText),
        tableRow(savesSpan.innerText, "Version: " + details.version)
    ];

    copyButton.addEventListener("click", () => createClipboardRepresentation(clipboardText));

    return entryContainer
}

function tableRow(str1, str2) {
    return str1.padEnd(18, " ") + "| " + str2
}

function createClipboardRepresentation(rows) {
    let clipboardFormat = "```prolog\n" + rows.join("\n") + "\n```\n"

    /*
        .map((column) => column.padEnd(20))
        .replace(/([^,]+,+[^,]+,+[^,]+,+)/g, "$1\n")
        .replace(/\,/g, "    ")
    */

    navigator.clipboard.writeText(clipboardFormat)
}

/*** decoding stuff. thanks shady ***/

function parseDetails(detailString) {
    if (detailString.length === 0) {
        return null
    }

    function getUint32(byteArray, offset) {
        return new DataView(byteArray.slice(offset, offset + 4).buffer).getUint32(
            0,
            true
        )
    }

    function parseUint32(byteArray, offset) {
        return getUint32(byteArray, offset)
    }

    function parseAsSignedInt32(byteArray, offset) {
        const unsignedValue = getUint32(byteArray, offset)
        if (unsignedValue <= 0x7fffffff) {
            // Positive value, no need to apply mask
            return unsignedValue
        } else {
            // Negative value, apply mask to convert back to signed representation
            return -((unsignedValue ^ 0xffffffff) + 1)
        }
    }

    function parseVersion(byteArray, offset) {
        const verB = parseUint32(byteArray, offset)
        const verB2 = verB % 1024
        const verB1 = (verB - verB2) / 1024
        return verB1 + "." + verB2
    }

    function parseGadgets(byteArray, offset) {
        const total = parseUint32(byteArray, offset)
        const returned = Math.floor(total / 100)
        const shredded = total % 100
        return {returned, shredded}
    }

    let byteArray
    try {
        byteArray = new Uint8Array(
            new ArrayBuffer(detailString.length / 2)
        ).map((_, i) => parseInt(detailString.substring(i * 2, i * 2 + 2), 16))
    } catch (err) {
        console.error(`Error decoding steam entry for '${this.SteamUserID}'`, err)
        return null
    }

    const dataSize = 4
    const dome = byteArray[dataSize * 0]
    const keeper = byteArray[dataSize * 1]
    const primaryGadget = byteArray[dataSize * 2]
    const playtime = parseUint32(byteArray, dataSize * 4)
    const resourceMultiplier = parseAsSignedInt32(byteArray, dataSize * 5)
    const cobaltMultiplier = parseAsSignedInt32(byteArray, dataSize * 6)
    const waves = parseUint32(byteArray, dataSize * 7)
    const winStatus = byteArray[dataSize * 8] === 1
    const version =
        byteArray.length > dataSize * 9 ? parseVersion(byteArray, dataSize * 10) : ""
    const gameMode = parseUint32(byteArray, dataSize * 11)
    const blocks = parseUint32(byteArray, dataSize * 12)
    const distance = parseUint32(byteArray, dataSize * 13)
    const monstersKilled = parseUint32(byteArray, dataSize * 14)
    const resources = parseUint32(byteArray, dataSize * 15)
    const wavetime = parseUint32(byteArray, dataSize * 16)

    let saves = parseUint32(byteArray, dataSize * 17)
    // ignore autosave before wave
    saves -= waves
    // ignore autosave after wave (none in minder mode)
    if (gameMode !== 3) saves -= waves
    // offset missing autosave after wave if run was lost
    saves += winStatus === false ? 1 : 0

    const gadgets = parseGadgets(byteArray, dataSize * 19)

    return {
        dome,
        keeper,
        primaryGadget,
        playtime,
        resourceMultiplier,
        cobaltMultiplier,
        waves,
        winStatus,
        version,
        gameMode,
        blocks,
        distance,
        monstersKilled,
        resources,
        wavetime,
        saves,
        damage: parseUint32(byteArray, dataSize * 18),
        gadgetsReturned: gadgets.returned,
        gadgetsShredded: gadgets.shredded
    }
}

function displaySelectedLeaderboard() {
    const selectedValue = gameModeSelect.value;
    const mode = modes[selectedValue] || modes[0];
    const boardId = mode.leaderboardId;

    displayLeaderboard(boardId);
}


function getLeaderboardUrl(boardId) {
    return "https://steamcommunity.com/stats/1637320/leaderboards/" + boardId
}

function getLeaderboardApiUrl(boardId) {
    if (useDummyUrl) {
        console.warn("Using dummy url. Actual leaderboard id: " + boardId)
        return "https://gist.githubusercontent.com/Qubus0/d6352145ee518c9f396073ee36f338ba/raw/66fe25ec64bc38b9b72ce6a9da74d19cdc3941c7/leaderboard.xml"
    }

    return proxyUrl + getLeaderboardUrl(boardId) + urlApiQuery
}

function getTimeString(time) {
    let hours = Math.floor(time / 3600)
    let minutes = Math.floor((time - hours * 3600) / 60)
    let seconds = time - hours * 3600 - minutes * 60
    return hours + "h " + minutes + "m " + seconds + "s"
}

function lookupName(steamId) {
    const name = STEAM_ACCOUNTS[steamId]
    return name ? name : null
}


function discordEmoteIconUrl(iconId) {
    return `https://cdn.discordapp.com/emojis/${iconId}.webp?size=240&quality=lossless`
}

function domeIconUrl(dome) {
    return domes[dome]?.icon ? discordEmoteIconUrl(domes[dome].icon) : "";
}

function domeText(dome) {
    return domes[dome]?.name || "";
}

function keeperIconUrl(keeper) {
    return keepers[keeper]?.icon ? discordEmoteIconUrl(keepers[keeper].icon) : "";
}

function keeperText(keeper) {
    return keepers[keeper]?.name || "";
}

function gadgetIconUrl(gadget) {
    return gadgets[gadget]?.icon ? discordEmoteIconUrl(gadgets[gadget].icon) : "";
}

function gadgetText(gadget) {
    return gadgets[gadget]?.name || "";
}

function winStatusIconUrl(status) {
    return winStatuses[status]?.icon ? discordEmoteIconUrl(winStatuses[status].icon) : "";
}

function winStatusText(status) {
    return winStatuses[status]?.name || "";
}

function modeAbbreviationText(mode) {
    return modes[mode]?.abbreviation || "";
}


