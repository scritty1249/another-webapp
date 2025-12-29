# Database Docs

## Database Architecture
**Table design restrictions**
- userid should always be on the leftmost side (first column) of every table

Should store the following tables:

> Account

| userid | username | password |
| :-- | :-- | :-: |
|  arbitrary | str | hash |

> AccountInfo

*... TBD*

| userid | ... | ... |
|:--|:-:|:-:|
| arbitrary | ... | ... |

> Game

| userid | scene background | base layout | 
| :-- | :-: | :-: | 
| arbitrary | filepath or b64 payload | obfuscated json |