import { RefreshingAuthProvider } from "@twurple/auth";
import { ApiClient } from "@twurple/api";
import { promises as fs } from "fs";
import { request } from "undici";
import OBSWebSocket from "obs-websocket-js";
import {
    clientId, clientSecret,
    obsHost, obsPassword,
    obsSceneName, showGame,
    separateGame, nested // cope about this formatting :trolley:
} from "../config.json";
import tokens from "../tokens.json";
import { PubSubClient } from "@twurple/pubsub";

const obs = new OBSWebSocket();

let cachedId: number;
let cachedScene: string;

async function start() {
    console.log("Starting..")
    try {
        console.log("Connecting to OBS")
        await obs.connect(obsHost, obsPassword);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }

    process.on("SIGINT", () => stop());
    obs.once('ExitStarted', async () => {
        await hideNested();
        stop();
    });
    obs.once('Identified', () => console.log("Connected to OBS"));
    obs.once('ConnectionError', (err) => {
        console.log("Connection to OBS failed", err);
        stop(1);
    })
    obs.once('ConnectionClosed', () => {
        console.log("Connection to OBS lost");
        stop();
    });
    obs.once('StreamStateChanged', async (ss) => {
        if (!ss.outputActive) await hideNested();
    });

    const authProvider = new RefreshingAuthProvider(
        {
            clientId,
            clientSecret,
            onRefresh: async td => await fs.writeFile('tokens.json', JSON.stringify(td, null, 4), 'utf8')
        },
        tokens
    );

    const client = new ApiClient({ authProvider });

    const ws = new PubSubClient()
    const userId = await ws.registerUserListener(authProvider)

    let isRaiding = false;

    await ws.onModAction(userId, userId, async (ma) => {
        console.log('Mod action received:', ma.action, ma.args, ma.type)
        if (ma.type != "chat_channel_moderation") return;
        if (ma.action == "unraid") {
            console.log("Raid cancelled")
            isRaiding = false;
        }
        if (ma.action != "raid" || isRaiding) return;
        const rUser = ma.args[0];
        console.log(`Raid detected! Raiding ${rUser}`)
        isRaiding = true;

        let raiding = await client.users.getUserByName(rUser);
        if (raiding == null) return;
        let rStream = await raiding.getStream()

        let raidName = raiding.displayName ?? raiding.name
        let raidGame = ""
        if (showGame) {
            if (separateGame) raidGame = rStream ? rStream.gameName : ""
            else raidName += ` ${rStream ? `playing ${rStream.gameName}` : ""}`
        }

        await fs.writeFile('./raid.txt', raidName, 'utf8')
        await fs.writeFile('./raid_game.txt', raidGame, 'utf8')
        let rPfp = await request(raiding.profilePictureUrl).then(r => r.body.arrayBuffer());
        await fs.writeFile('./raid_pfp.png', Buffer.from(rPfp), 'utf8');

        await switchScenes();
    });


    function stop(code = 0) {
        console.log("Shutting down and exiting");
        obs.disconnect();
        process.exit(code);
    }
}

async function switchScenes() {
    await delay(2000)
    console.log("Switching scenes")
    let currentScene = (await obs.call("GetCurrentProgramScene")).currentProgramSceneName;
    cachedScene = currentScene;
    if (nested) {
        try {
            let id = await obs.call("GetSceneItemId", { sceneName: currentScene, sourceName: obsSceneName })
            cachedId = id.sceneItemId;
            await obs.call("SetSceneItemEnabled", { sceneName: currentScene, sceneItemId: id.sceneItemId, sceneItemEnabled: true })
        } catch {
            // ignore
        }
        return
    }
    if (currentScene === obsSceneName) return;
    await obs.call("SetCurrentProgramScene", { sceneName: obsSceneName })
}

async function hideNested() {
    if (nested) {
        try {
            await obs.call("SetSceneItemEnabled", { sceneName: cachedScene, sceneItemId: cachedId, sceneItemEnabled: false })
        } catch {
            // ignore
        }
    }
}

function delay(time) {
    return new Promise(resolve => setTimeout(resolve, time));
}
start();