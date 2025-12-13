# API Docs

# Objects

## Token
```json
{
    "token": str (generated),
    "expires": uint (utc stamp)
}
```
## GameData
```json
{
    "backdrop": str,
    "layout": str (obfuscated)
}
```
## Currency
```json
{
    "currency-type": uint (amount),
    ...
}
```
## AttackResult
```json
{
    "timestamp": uint (utc stamp),
    "username": str,
    "id": str,
    "processed": bool,
    "losses": [
        ...Currency
    ]
}
```
- [Currency](#currency)
## Error
```json
{
    "code": uint,
    "detail": str (optional)
}
```
## GeoData
As an obfuscated string:
```json
{
    "lat": int,
    "long": int
}
```
## TargetData
```json
{
    "id": str,
    "username": str,
    "geo": GeoData,
    "game": GameData
}
```
- [GeoData](#geodata)
- [GameData](#gamedata)
# Endpoints
Due to design constraint (using google apps script to receive requests), domain paths are not supposed. We *emulate* the functionality with the `path` parameter.\
- All endpoints listed are to be included in the `path` parameter of the request, and `/` characters are to be replaced with `.`.
- Google Apps Script also does not expose cookies when interpreting requests. Cookies should instead be included in the parameters of every request, prefixed with `cookie-`.

Successful requests that do not expect any data will receieve the response
```json
{
    "success": true
}
```
Any rejected request will return a successful HTTP repsonse code with the following error object
```json
{
    "error": Error
}
```
- [Error](#error)

## Create account
>/api/newlogin
#### Expects
**Method**\
POST

**Content**
```json
{
    "username": str,
    "password": str (hash),
    "geo": GeoData
}
```
- [GeoData](#geodata)
#### Returns
**Content**
```json
{
    "token": Token,
}
```
- [Token](#token)

## Login
>/api/login
#### Expects
**Method**\
GET

**Parameter**
- `login`: A base64 enconded concatenation of `username:password hash`
#### Returns
**Content**
```json
{
    "token": Token,
    "id": str
}
```
- [Token](#token)

## Refresh session token *

*To minimize api calls, session tokens are automatically refreshed on any successful one that includes a session token*

>/api/refresh
#### Expects
**Method**\
GET
#### Returns
**Content**\
```json
{
    "token": Token,
}
```
- [Token](#token)

## Get Owner Base *
>/game/load
#### Expects
**Method**\
GET
#### Returns
**Content**
```json
{
    "game": GameData
}
```
- [GameData](#gamedata)
- [Currency](#currency)

## Get Targets *
>/attack/select
#### Expects
**Method**\
GET

**Parameter**
- `limit`: maximum results to return. Must be at least 1.
#### Returns
**Content**
```json
{
    "targets": [...TargetData]
}
```
- [TargetData](#targetdata)

## Finish Attack *
>/attack/result
#### Expects
**Method**\
POST

**Parameter**
- `id`: userid of target base owner

**Content**
```json
{
    "result": AttackResult
}
```
- [AttackResult](#attackresult)

## Save Owner Base *
>/game/save
#### Expects
**Method**\
POST

**Content**
```json
{
    "game": GameData
}
```
- [GameData](#gamedata)

## Get Defense History *
>/attack/history/defense

### Expects
**Method**\
GET

**Parameter**
- `process`: Boolean, whether to mark all entries returned as "processed" in the database. (Optional, enabled by default)
#### Returns
**Content**
```json
{
    "history": [...AttackResult]
}
```
- [AttackResult](#attackresult)

## Update Location *
>/game/save/location
#### Expects
**Method**\
POST

**Content**
```json
{
    "geo": GeoData
}
```
- [GeoData](#geodata)

## Note
**\*** *Endpoint requires a `session` with a valid session token to be included in the request cookie*