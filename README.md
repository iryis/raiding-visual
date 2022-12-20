# Raiding Visual

For my personal use. If you wanna use it then go ahead, either way im not spending too long on a readme lol

What it does briefly:
- Connects to twitch pubsub
- Listens for a "raid" channel moderation event (yes it works with the dashboard button i checked)
- Triggers a scene change in OBS when a raid starts

why did i make this? quit asking youve asked me every time i make a new repo reeeeeeeeeeeeeee 1984

It does not handle your authentication (lazy, maybe later), you'll have to get and input those yourself into `config.json` and/or `tokens.json`. Google it if you're confused

Config: 
```json
{
    "clientId": "",
    "clientSecret": "",
    "obsHost": "ws://127.0.0.1:4455",
    "obsPassword": "password",
    "obsSceneName": "Raiding for example"
}
```

Tokens:
```json
{
    "accessToken": "",
    "refreshToken": "",
    "expiresIn": 0,
    "obtainmentTimestamp": 0
}
```