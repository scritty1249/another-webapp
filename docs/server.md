# Server docs
Due to design constraint, server and database are essentially hosted on the same machine. Because of that, server architecture will also be represented in tables- however these tables are not subject to the same design restrictions that database tables are.

Should keep track of the following data:

> LiveTokens

| token | userid | expires |
| :-- | :-: | --: |
| arbitrary | arbitrary | uint (seconds) |