# Cost
This callable object stores multiple types of currency data that can be converted to a displayable representation, and evaluate comparisons against other Cost objects. 

> **Extends** : `Function`

## Constructor
**Cost** ( ...currencies : < currencyType: [`String`](<Currency.md#type--string>), currencyAmount: [`Number`](<Currency.md#amount--number>) > | [`Currency`](<Currency.md#currency>) )

Constructs a new [Cost](#cost) instance. Duplicate currency types are permitted and will be stored individually for calculation, but represented as a sum when returned.
|||
|:-|:-|
| **currencies** | An abritrary amount of currencies, or <currencyType, currencyAmount> parameter pairs. |
## Properties
### .isCost : *`Boolean`*
This flag is used for type testing.

Defaults to `true`.
### .isFree : *`Boolean`* (readonly)
Evalutes whether every stored currency returns `undefined` when [`validated`](<Currency.md#---jsonobject--undefined>).

**Returns**: `true` if every stored currency validates, and `false` otherwise.

### .total : *[`JSONObject`](#total-cost)* (readonly)
Returns a newly created object of the Cost's total.

*Changes made to the object or Cost after returning are not reflected in the other.*

**Returns**: An object representation of the total.
## Methods
### ( ) : *[`JSONObject`](#total-cost) | `undefined`*
This method can be used for type and amount validation.

**Returns**: An object representation of the Cost, or `undefined` if [`.total`](#total--jsonobject-readonly) is `undefined`.

### .canAfford ( other : [`Currency`](<Currency.md#currency>) | [`Cost`](<#cost>) ) : *`Boolean`*
Evaluates whether the calling cost holds is more of all currencies in the given compared object.

*This method defaults to `false` if the given value is not a [Cost](<#cost>) or [Currency](<Currency.md#currency>) object.*
|||
|:-|:-|
| **other** | The cost or currency to compare with. |

**Returns**: `true` if the calling Cost has all currency types in the given object, and if all currency amounts are positive after deduction, or `false` otherwise.

### .deduct ( other : [`Currency`](<Currency.md#currency>) | [`Cost`](<#cost>) ) : *[`Cost`](#cost)*
Deducts all currencies in the given compared object from the currencies held in the calling Cost. This method will create new currency types from the given value in the calling Cost if it does not already exist. Currency amounts in the Cost can become negative after calling this method.

*This method passes silently if the given value is not a [Cost](<#cost>) or [Currency](<Currency.md#currency>) object.*
|||
|:-|:-|
| **other** | The cost or currency to deduct. |

**Returns**: A reference to this Cost.
### .fromObj ( obj : [`JSONObject`](#total-cost) ) : *[`Cost`](#cost)*
Overrwrites the currencies held in the calling Cost with values from the given object.
|||
|:-|:-|
| **obj** | An object representing the Cost's total. |

**Returns**: A reference to this Cost.
### .multiplyScalar ( scalar : `Number` ) : *[`Cost`](#cost)*
Multiplies the amount for all stored currencies by the given value.

**Returns**: A reference to this Cost.
### .toJSON ( ) : *[`JSONObject`](#total-cost)*
Overrides the object's JSON representation when calling `JSON.stringify` or outputting to `console`.

**Returns**: An object representation of the Cost's [`total`](#total--jsonobject-readonly).

### .toString ( ) : *`String`*
Overrides the object's String representation for display. This method converts the total of all [`currencies`](<Currency.md#currency>) into a comma-seperated string by [`type`](<Currency.md#type--string>).

*The display name returned for the currency type is adjusted to consider plural and singular amounts.*

**Returns**: A string representing the currency type and amount.

## Structures
### Total Cost
An Object representing the total cost, seperated by currency type.
```json
{
    "<currencyType>": <currencyAmount>,
    ...
}
```
|||
|:-|:-|
| **currencyType** | The [`id`](<Currency.md#type--string>) of the currency's type. |
| **currencyAmount** | The [`amount`](<Currency.md#amount--number>) of currency. |