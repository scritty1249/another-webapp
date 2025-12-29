# MaterialTable

Stores, clones, and reapplies [Materials](<../../ThreeJS References.md#material>) on a [Mesh](<../../ThreeJS References.md#mesh>).

> **Extends** : `Object`

## Constructor
new **MaterialTable** ( )

Constructs a new [MaterialTable](#materialtable) instance.

## Properties
### .index : *Object.< `String`, [`indexEntry`](#indexentry--object) >*
The stored registry of all materials, and the [objects](<../../ThreeJS References.md#object3d>) they are assigned to. Entry keys are determined by the `.name` of each [material](<../../ThreeJS References.md#material>).

## Methods
### .clone ( ) : *[`MaterialTable`](#materialtable)*
Returns a new material table with seperate [`three.Material`](<../../ThreeJS References.md#material>) instances.

**Returns**: A clone of this instance.
### .has ( material : [`three.Material`](<../../ThreeJS References.md#material>) ) : *`Boolean`*
Returns `true` if the table index has the given material.\
*Not checked by strict equality, but by matching `.name` property of the given material.*
|||
|:-|:-|
| **material** | The material to lookup. |

**Returns**: Whether the material table contains the given material or not.
### .get ( materialName : `String` ) : *[`three.Material`](<../../ThreeJS References.md#material>) | `undefined`* 
Returns the material for the given name.
|||
|:-|:-|
| **materialName** | The name of the material. |

**Returns**: A material matching the given name, or `undefined` if one is not found.
### .add ( material : [`three.Material`](<../../ThreeJS References.md#material>), ...objectNames : `String` ) 
Adds a clone of the given material with it's assigned objects to the table index.
|||
|:-|:-|
| **material** | The new material to add. |
| **objectNames** | An arbitrary number of [object](<../../ThreeJS References.md#object3d>) names the material is assigned to. |
### .apply ( object : [`three.Object3D`](<../../ThreeJS References.md#object3d>) )
Applies the calling material table to the given object and it's desecendants. Materials are applied based on object name.
|||
|:-|:-|
| **object** | The object to apply the material table to. |

## Structures
### indexEntry : *`Object`*
An value stored in the [`.index`](#index--object) of the material table.

**Structure**
```javascript
{
    "material": <Material>,
    "objects": <Objects>
}
```
|||
|:-|:-|
| **Material** | A unique [`three.Material`](<../../ThreeJS References.md#material>) instance assigned to the objects. |
| **Objects** | A `Set` consisting of the `String` name of each [`three.Object3D`](<../../ThreeJS References.md#object3d>) the material is applied to. |