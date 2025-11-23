# Database Docs

## Database Architecture
**Table design restrictions**
- userid should always be on the leftmost side (first column) of every table

Should store the following tables:

> Login data

| userid | username | password hash |
| :-- | :-- | :-: |
|  arbitrary | could be email | sha256 or somethiing |

> Account info

*... TBD*

| userid | ... | ... |
|:--|:-:|:-:|
| arbitrary | ... | ... |

> Account game data

*intentionally keep currencies separate, so if a transaction fails it doesn't corrupt all currency data*

| userid | scene background | base layout | currency | ...currency |
| :-- | :-: | :-: | --: | --: |
| arbitrary | filepath or b64 payload | obfuscated json | uint | ...uint |