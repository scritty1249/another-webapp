*< This page is unfinished >*

# Code Documentation

# Execution flow
Once the page is loaded, the `threejs` library is made importable, and the following instances are created and made accessible globally to all other parts of the program for the rest of runtime.

[`Logger`](Modules/Logger/LogManager.md)

[`CookieJar`](Modules/Cookies/CookieJar.md)

[`Storage`](Modules/Storage/StorageManager.md)

The following values are also exposed globally to be referenced, and should not be modified.

[`CONFIG`](<Game Settings.md#game-configuration>)

[`DEFAULT`](<Game Settings.md#default-values>)

# Game Mode Phases
Gameplay can be divided into three distinct Phases. Players start in the Build Phase, where they can perform actions within that Phase or transition to the Select Phase. Players able to proceed to the Attack Phase from there, or return to the Build Phase.
## Attack Phase

[More](<Game Phases/Attack.md>)

## Build Phase

[More](<Game Phases/Build.md>)

## Select Phase

[More](<Game Phases/Select.md>)

# Modifiying Game Constants

# Adding new Node Types
> New Node Types must have the following assets created:
- [3D model]()
    - To [specification]()
    - [animations]()
        - idle
        - clicked (optional)
        - ...
- ...
> And the following fields populated:
- [Type configuration](<Settings/Configuration/Node Type Configuration.md>)
- ...
# Adding new Attack Types
> New Attack Types must have the following assets created:
- Spritesheet
    - [animation]()
        - [specifications]()
    - [mask]()
        - [specifications]()
- Sound effect (optional)
    - on install
    - on start
    - on remove
    - on hit
- ...
> And the following fields populated:
- [Type configuration]()
- ...