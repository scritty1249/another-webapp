*< This page is unfinished >*

# Code Documentation

# Execution flow
Once the page is loaded, the `threejs` library is made importable, and the following instances are created and made accessible globally to all other parts of the program for the rest of runtime.

[`Logger`](Managers/LogManager.md)

[`CookieJar`](Managers/CookieJar.md)

[`Storage`](Managers/StorageManager.md)

The following values are also exposed globally to be referenced, and should not be modified.

[`CONFIG`](<Game Settings.md#game-configuration>)

[`DEFAULT`](<Game Settings.md#default-values>)



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