import jwtDecode from 'jwt-decode'
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios'

type Token = string

type TokenRefreshRequest = () => Promise<Token>

type RequestsQueue = {
    resolve: (value?: unknown) => void
    reject: (reason?: unknown) => void
}[]

export type Authenticated = boolean | undefined

const EXPIRE_FUDGE = 10

const getTimestampFromToken = (token: Token): number | undefined => {
    const decoded = jwtDecode<{ [key: string]: number }>(token)
    return decoded?.exp
}

const getExpiresIn = (token: Token): number => {
    const expiration = getTimestampFromToken(token)
    if (!expiration) return -1
    return expiration - Date.now() / 1000
}

export const isTokenExpired = (token?: Token): boolean => {
    if (!token) return true
    const expiresIn = getExpiresIn(token)
    return !expiresIn || expiresIn <= EXPIRE_FUDGE
}

export class Client {
    accessToken?: string
    axios: AxiosInstance
    onLogin: (data: any) => Promise<Token>
    onLogout: () => Promise<void>
    onRefresh: TokenRefreshRequest
    onChange: (isAuthenticated: boolean) => void
    header = 'Authorization'
    headerFormat = (value: string) => `Bearer ${value}`
    isRefreshing = false
    queue: RequestsQueue = []

    constructor(
        config: AxiosRequestConfig,
        onLogin: (data: any) => Promise<Token>,
        onLogout: () => Promise<void>,
        onRefresh: TokenRefreshRequest,
        onChange: (isAuthenticated: boolean) => void,
        header?: string,
        headerFormat?: (token: string) => string
    ) {
        this.axios = axios.create(config)
        this.axios.defaults.withCredentials = true
        this.onLogin = onLogin
        this.onLogout = onLogout
        this.onRefresh = onRefresh
        this.header = header || this.header
        this.headerFormat = headerFormat || this.headerFormat
        this.onChange = onChange
        this.setup()
    }

    setup = async () => {
        try {
            const token = await this.refreshTokenIfNeeded()
            this.accessToken = token
            this.axios.defaults.headers.common[this.header] = this.headerFormat(token)
        } catch (error) {
            // pass - fail silently
        } finally {
            this.onChange(!!this.accessToken)
            this.axios.interceptors.request.use(this.authTokenInterceptor())
        }
    }

    login = async (data: any) => {
        const accessToken = await this.onLogin(data)
        this.axios.defaults.headers.common[this.header] = this.headerFormat(accessToken)
        this.accessToken = accessToken
        this.onChange(true)
    }

    logout = async () => {
        await this.onLogout()
        this.accessToken = undefined
        delete this.axios.defaults.headers.common['Authorization']
        this.onChange(false)
    }

    authTokenInterceptor =
        () =>
        async (requestConfig: AxiosRequestConfig): Promise<AxiosRequestConfig> => {
            // Queue the request if another refresh request is currently happening
            if (this.isRefreshing) {
                return new Promise((resolve, reject) => {
                    this.queue.push({ resolve, reject })
                })
                    .then((token) => {
                        if (requestConfig.headers) {
                            requestConfig.headers[this.header] = this.headerFormat(token as string)
                        }
                        return requestConfig
                    })
                    .catch(Promise.reject)
            }

            // Do refresh if needed
            let token
            try {
                token = await this.refreshTokenIfNeeded()
                this.accessToken = token
                this.resolveQueue(token)
            } catch (error: unknown) {
                if (error instanceof Error) {
                    this.declineQueue(error)
                    throw new Error(
                        `Unable to refresh access token for request due to token refresh error: ${error.message}`
                    )
                }
            }
            // add token to headers
            if (token && requestConfig.headers) {
                requestConfig.headers[this.header] = this.headerFormat(token)
            }
            return requestConfig
        }

    refreshToken = async (): Promise<Token> => {
        try {
            this.isRefreshing = true
            return await this.onRefresh()
        } catch (error: any) {
            // Failed to refresh token
            const status = error?.response?.status
            if (status === 401 || status === 422) {
                throw new Error(`Got ${status} on token refresh`)
            } else {
                throw new Error(`Failed to refresh auth token: ${error.message}`)
            }
        } finally {
            this.isRefreshing = false
        }
    }

    refreshTokenIfNeeded = async (): Promise<Token> => {
        if (!this.accessToken || isTokenExpired(this.accessToken)) {
            this.accessToken = await this.refreshToken()
        }
        return this.accessToken
    }

    resolveQueue = (token?: Token) => {
        this.queue.forEach((p) => {
            p.resolve(token)
        })
        this.queue = []
    }

    declineQueue = (error: Error) => {
        this.queue.forEach((p) => {
            p.reject(error)
        })
        this.queue = []
    }
}

export default Client
