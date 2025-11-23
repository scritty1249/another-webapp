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
    ...
}
```
## Error
```json
{
    "code": uint,
    "detail": str (optional)
}
```

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
    "password": str (hash)
}
```
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
}
```
- [Token](#token)

## Get Owner Base
>/game/load
#### Expects
**Method**\
GET
#### Returns
**Content**
```json
{
    "game": GameData,
    "bank": Currency
}
```
- [GameData](#gamedata)
- [Currency](#currency)

## Start Attack
>/attack/start
#### Expects
**Method**\
GET

**Parameter**
- `id`: userid of target base owner
#### Returns
**Content**
```json
{
    "instance": Token,
    "game": GameData
}
```
- [Token](#token)
- [GameData](#gamedata)

## Finish Attack
>/attack/result
#### Expects
**Method**\
POST

**Parameter**
- `id`: userid of target base owner

**Content**
```json
{
    "instance": str (instanceid),
    "result": AttackResult
}
```
- instance id taken from the `token` portion of previously given [Token](#token)
- [AttackResult](#attackresult)

## Save Owner Base
>/game/save
#### Expects
**Method**\
POST

**Content**
```json
{
    "game": GameData,
    "bank": Currency
}
```
- [GameData](#gamedata)
- [Currency](#currency)