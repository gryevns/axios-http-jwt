# axios-http-jwt

Transmit and refresh JWT authentication tokens without local storage.

This package is heavily inspired by [axios-jwt](https://github.com/jetbridge/axios-jwt).

## What does it do?

On login your server must set a http only cookie for the refresh token and return an access token in the response body.

The access token is stored in memory and applied to future requests using an axios request interceptor.

Before each request the expiration time of the access token is checked to see if it is expired.

If it has expired, a request to refresh and store a new access token is automatically performed before the request proceeds.

On initialisation an attempt is made to fetch a new access token by refreshing the token.

## How do I use it?

1. Define login, logout, refresh, and callback functions
2. Create a client instance
3. Listen for authenticate state changes

```typescript
import axios from 'axios'
import { Client } from './client'

const config = {
    baseURL: process.env.REACT_APP_BASE_URL,
    withCredentials: true,
}

// return access token from login request
const login = async (data: any) => {
    const response = await axios.create(config).post('/login', data)
    return response.data.accessToken
}

// server should delete/overwrite http only refresh token cookie
const logout = (data: any) => axios.create(config).post('/logout')

const refresh = () => axios.create(config).post('/refresh')

const callback = (isAuthenticated: boolean) => console.log(isAuthenticated)

const client = new Client(config, login, logout, refresh, callback)
```

## Caveats

-   Your backend should allow a few seconds of leeway between when the token expires and when it actually becomes unusable.
