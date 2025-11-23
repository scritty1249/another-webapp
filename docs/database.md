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

*intentionally keep currencies separate, so if a transaction fails it doesn't corrupt all currency data*

| userid | scene background | base layout | currency | ...currency |
| :-- | :-: | :-: | --: | --: |
| arbitrary | filepath or b64 payload | obfuscated json | uint | ...uint |