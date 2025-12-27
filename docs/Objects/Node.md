# Node
> **Extends** : [`MeshWrapper`](<../Structures/MeshWrapper.md>)

## Constructor
**Node** ( nodeType : `String`, meshes: [`Array.< three.Mesh >`](<ThreeJS References.md#mesh>), animations : [`AnimationsWrapper`](<../Structures/AnimationWrapper.md>) )

Constructs a new [Node](#node) instance.
| | |
| :-- | :-- |
| **nodeType** | The `id` of the Node's type. |
| **meshes** | An array of all Meshes included in the Node's model. |
| **animations** | The animation data tied to the Node's Meshes. |

## userData Properties
### .materials : *[`MaterialTable`](<MaterialTable.md>)*
A material table containing all the materials associated with this Node's meshes.
### .exportData : *Object.<[`exportData`](<#exportdata-properties>)> | `undefined`*
Data to be saved to the server. Node properties from the server with conflicting names override the values set at initalization.\
*This property is optional. It is up to the caller to determine if this field exists before attempting to use it further.*

## exportData Properties
### .level : *`Number`*
The current, zero-indexed level of the Node.
### .maxConnections : *`Number`*
The `Integer` amount of maximum connections this Node supports at it's current level.\
*This value is calculated from the

### .data : *Object.< `null` | [`typeData`](<../Settings/Configuration/Node Type Configuration.md#data>) >*

*This object may have a `null` prototype if no initialization data is defined for the node's type configuration. Developers are advised to implement exclusive, type-specific methods of verifying this property, as null-prototyped objects lack common methods such as `hasOwnProperty` and `hasOwn`.*