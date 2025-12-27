# Node Type Configuration

## Properties
### .id : *`String`*
The identifer, or internal name for this Node Type.

Defaults to the entry's key in the global `CONFIG` object.
### .catagory : *`String`*
The catagory for this Node Type. This determines what submenu in the Node Shop the Node Type is under.

*Value must be one of: "econ", "def", "base"*

### .name : *`String`*
The display name for this Node Type.

### .unlock : *`Number`*
The minimum Core level required for the player to purchase this Node. This value overrides [`freeCount`](#freecount--number).

### .data : *Object.< [`data`](#data) > | `null`*
Assigned to the Node's [exported `data`](<../../Objects/Node.md#data--object-null--typedata->) object at initalization. 

Defaults to `null`.
### .settings : *Object.< [`settings`](#settings) >*
Contains methods for initalizing and upgrading the Node Type. May contain other properties related to these operations if needed.

### .build : *Object.< [`build`](#build) >*
Node Type data intended to only be used in the Build Phase.
### .attack : *Object.< [`attack`](#attack) >*
Node Type data intended to only be used in the Attack Phase.

# Structures
## .data
If the object is not null, the properties within the `data` object are abritrary, and specific to each Node Type.

*Data structures with nested objects must remain undefined at the start Node initialization and be assigned specifically within the Node Type's own [`initialization function`](#init--nodedata--exportdata-)- as [Nodes](<../../Objects/Node.md>) only assign a shallow copy by default.*
## .settings
### .init ( nodeData : [`exportData`](<../../Objects/Node.md#exportdata--objectexportdata--undefined>) )
This method is called at the end of [Node](<../../Objects/Node.md>) creation, and can be used to set up any custom behavior for a Node Type's [`data`](#data--object-data---null).

|||
|:-|:-|
| **nodeData** | The newly created Node's exportData object, passed in for modification. |

Defaults to `()`.
### .upgrade ( nodeData : [`exportData`](<../../Objects/Node.md#exportdata--objectexportdata--undefined>) )
This method is called when after upgrading a Node of the corrosponding type, and can be used to modify the Node's [`data`](#data--object-data---null) that may be type-specific.

*This method should extrapolate the Node's current level to use for upgrade-related calculations independently. This method should not modify [`level`](<../../Objects/Node.md#level--number>) or [`maxConnections`](<../../Objects/Node.md#maxconnections--number>), as these values are updated before calling.*

|||
|:-|:-|
| **nodeData** | The upgraded Node's exportData object, passed in for modification. |

Defaults to `()`.
## .build
### .description : *`String`*

### .highlightSteps : *`Number`*
The number of steps to highlight from the Node when clicked in Build Phase. Intended to represent effective range for Nodes with ranged effects.

*This value must be floored, and cannot be negative.*

Defaults to `0`.
### .freeCount : *`Number`*
The number of this Node Type that the player can purchase for free. Intended to facilitate gameplay for new accounts.

*This value must be floored, and cannot be negative.*

Defaults to `0`.
### .connections : *Object.< [`Scaling Value`](#scaling-value) >*
The maximum number of connections to other Nodes this Node Type supports.

*This value is technically limited by the number of assets made for the connections HUD. Values beyond what there are assets for will throw an error when initializing the Node's Overlay.*

*Scales linearly with Node level*
### .limit : *Object.< [`Scaling Value`](#scaling-value) >*
The maximum quantity of this Node Type a player can have on their Network.

*Scales linearly with (`Core level - Required Core Level to unlock Node`)*
### .buy : *[`Cost`](<../../Objects/Cost.md#cost>)*

### .upgrade : *Object.< `Number`, [`upgrade requirements`](#upgrade-requirements) > | Object*
An object with entries that contain the levels available for the Node Type to upgrade to. The number of available upgrades for each Node Type may vary and should be appendable without corrupting existing Node data on the server in future updates.

Each key is a number corrosponding to the zero-indexed level starting from one, in a consecutive sequence.
Each value should contain the details to get the upgrade. 

Defaults to `{}`.
## .attack
### .regen : *`Number`*
The percentage of maximum health to heal this Node Type after a delay, applied per tick.

*This number must be a float between zero and one, inclusively.*

Defaults to an abritrary percentage multiplied by tickspeed, to spread a human-readable value over one second.
### .slots : *Object.< [`Scaling Value`](#scaling-value) >*
The maximum number of Attacks this Node supports.

*Scales linearly with Node level*
### .health : *Object.< [`Scaling Value`](#scaling-value) >*
The amount of maximum health this Node has.

*Scales linearly with Node level*
## Scaling Value
Represents a zero or positive value that scales arbitrarily. Factors calculated may be floating-point numbers. The final result is always floored.

**Structure**
```javascript
{
    base: <starting>,
    increase: <scaling>
}
```
|||
|:-|:-|
| **starting** | A `Number` to start scaling from. This value cannot be negative or a float.|
| **scaling** | A `Number` to increase. This number cannot be negative, and may be a float.|
## Upgrade Requirements
Represents the prequisites to meet and cost of upgrading a Node Type to a specific level.
**Structure**
```javascript
{
    level: <coreLevel>,
    cost: <upgradeCost>
}
```
|||
|:-|:-|
| **coreLevel** | A `Number` representing the minimum Core level required to unlock the upgrade.|
| **upgradeCost** | The [`Cost`](<../../Objects/Cost.md#cost>) required to upgrade the Node.|