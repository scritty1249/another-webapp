# Currency
This callable object stores currency data that can be converted to a displayable representation.

> **Extends** : `Function`

## Constructor
**Currency** ( currencyType: `String`, currencyAmount: `Number` )

Constructs a new [Currency](#currency) instance.
|||
|:-|:-|
|**currencyType**|The `id` of the currency's type.|
|**currencyAmount**|The total amount of currency. This value is floored, and can be positive, negative, or zero.|
## Properties
### .isCurrency : *`Boolean`*
This flag is used for type testing.

Defaults to `true`.
### .type : *`String`*
The id of the currency's type.

### .amount : *`Number`*
The amount of currency.
## Methods
### ( ) : *[`JSONObject`](#json-representation) | `undefined`*
This method can be used for type and amount validation.

**Returns**: An object representation of the Currency, or `undefined` if the currency has a type of `undefined` or amount of zero.

### .toJSON ( ) : *[`JSONObject`](#json-representation)*
Overrides the object's JSON representation when calling `JSON.stringify` or outputting to `console`.

**Returns**: An object representation of the Currency.

### .toString ( ) : *`String`*
Overrides the object's String representation for display. This method converts the currency type id to it's corrosponding display name if one exists.

*The display name returned for the currency type is adjusted to consider plural and singular amounts.*

**Returns**: A string representing the currency type and amount.

## Structures
### JSON Representation
The JSON Object representation of the Currency.
```json
{
    "type": <currencyType>,
    "amount": <currencyAmount>
}
```
|||
|:-|:-|
| **currencyType** | The [`id`](#type--string) of the currency's type. |
| **currencyAmount** | The [`amount`](#amount--number) of currency. |