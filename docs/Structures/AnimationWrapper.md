# AnimationWrapper
> **Extends** : `Object`

A structure used to pass animation data for a all children of a [`Mesh`](<../Objects/ThreeJS References.md#mesh>), grouped by overall action.

**Structure**
```javascript
{
    "<action>": <animations>,
    ...,
}
```
|||
|:-|:-|
| **action** | The name of the action to associate animations with. |
| **animations** | [`Array.< three.AnimationMixer >`](<../Objects/ThreeJS References.md#animationmixer>) |