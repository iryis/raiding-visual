import { RefreshingAuthProvider } from "@twurple/auth";
import { ApiClient } from "@twurple/api";
import { promises as fs } from "fs";
import { request } from "undici";
import OBSWebSocket from "obs-websocket-js";
import { clientId, clientSecret, obsHost, obsPassword, obsSceneName } from "../config.json";
import tokens from "../tokens.json";
import { PubSubClient } from "@twurple/pubsub";

const obs = new OBSWebSocket();

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
    obs.once('ExitStarted', () => stop());
    obs.once('Identified', () => console.log("Connected to OBS"));
    obs.once('ConnectionError', (err) => {
        console.log("Connection to OBS failed", err);
        stop();
    })
    obs.once('ConnectionClosed', () => {
        console.log("Connection to OBS lost");
        stop();
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
        console.log(ma.action, ma.args, ma.type)
        if (ma.type != "chat_channel_moderation") return;
        if (ma.action == "unraid") {
            isRaiding = false;
        }
        if (ma.action != "raid" || isRaiding) return;
        const rUser = ma.args[0];
        console.log(`Raid detected! Raiding ${rUser}`)
        isRaiding = true;

        let raiding = await client.users.getUserByName(rUser);
        if (raiding == null) return;
        let rStream = await raiding.getStream()

        await fs.writeFile('./raiding.txt', `${raiding.displayName ?? raiding.name} ${rStream ? `playing ${rStream.gameName}` : ""}`, 'utf8')
        let rPfp = await request(raiding.profilePictureUrl).then(r => r.body.arrayBuffer());
        await fs.writeFile('./raiding_pfp.png', Buffer.from(rPfp), 'utf8');

        await switchScenes();
    });


    function stop() {
        console.log("Shutting down and exiting");
        obs.disconnect();
        process.exit();
    }
}

async function switchScenes() {
    console.log("Switching scenes")
    let currentScene = await obs.call("GetCurrentProgramScene");
    if (currentScene.currentProgramSceneName === obsSceneName) return;
    await obs.call("SetCurrentProgramScene", { sceneName: obsSceneName })
}
start();