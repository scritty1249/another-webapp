# AnimationWrapper

A structure used to pass animation data for a all children of a [`Mesh`](<../../ThreeJS References.md#mesh>), grouped by overall action.

> **Extends** : `Object`

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
| **animations** | [`Array.< three.AnimationMixer >`](<../../ThreeJS References.md#animationmixer>) |