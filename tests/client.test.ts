import jwt from 'jsonwebtoken'
import axios from 'axios'
import MockAdapter from 'axios-mock-adapter'
import { Client } from '../src'

const sign = (exp: number) => jwt.sign({ exp }, 'secret')
const mock = new MockAdapter(axios)

describe('client', () => {
    let onLogin: jest.Mock
    let onLogout: jest.Mock
    let onRefresh: jest.Mock
    let onChange: jest.Mock

    beforeEach(() => {
        onLogin = jest.fn()
        onLogout = jest.fn()
        onRefresh = jest.fn()
        onChange = jest.fn()
    })

    it('sets expected axios config', () => {
        const config = { baseURL: 'https://www.example.com', withCredentials: false }
        const client = new Client(config, onLogin, onLogout, onRefresh.mockResolvedValue('token'), onChange)

        expect(client.axios.defaults.baseURL).toEqual('https://www.example.com')
        expect(client.axios.defaults.withCredentials).toBeTruthy()
    })

    it('refreshes token successfully on init', async () => {
        const client = new Client({}, onLogin, onLogout, onRefresh.mockResolvedValue('token'), onChange)
        await new Promise(process.nextTick)

        expect(onRefresh).toBeCalledTimes(1)
        expect(client.accessToken).toEqual('token')
        expect(client.axios.defaults.headers.common['Authorization']).toEqual('Bearer token')
        expect(onChange).toHaveBeenCalledWith(true)
    })

    it('refreshes token unsuccessfully on init', async () => {
        const client = new Client({}, onLogin, onLogout, onRefresh.mockRejectedValue(new Error('test')), onChange)
        await new Promise(process.nextTick)

        expect(onRefresh).toBeCalledTimes(1)
        expect(client.accessToken).toEqual(undefined)
        expect(client.axios.defaults.headers.common['Authorization']).toEqual(undefined)
        expect(onChange).toHaveBeenCalledWith(false)
    })

    it('sets access token on successful login', async () => {
        const client = new Client({}, onLogin.mockResolvedValue('token'), onLogout, onRefresh, onChange)
        await client.login({ user: 'test', password: 'password' })

        expect(client.accessToken).toEqual('token')
        expect(client.axios.defaults.headers.common['Authorization']).toEqual('Bearer token')
        expect(onChange).toHaveBeenCalledWith(true)
    })

    it('revokes access token on successful logout', async () => {
        const client = new Client({}, onLogin.mockResolvedValue('token'), onLogout, onRefresh, onChange)
        await client.login({ user: 'test', password: 'password' })
        await client.logout()

        expect(client.accessToken).toEqual(undefined)
        expect(client.axios.defaults.headers.common['Authorization']).toEqual(undefined)
        expect(onChange).toHaveBeenCalledWith(false)
    })

    it('makes request when access token is valid', async () => {
        const url = 'http://www.example.com'
        const token = sign(Math.floor(Date.now() / 1000) + 60 * 60)
        const client = new Client({}, onLogin.mockResolvedValue(token), onLogout, onRefresh, onChange)
        await client.login({ user: 'test', password: 'password' })

        mock.onGet(url).reply((config) => {
            expect(config.headers!['Authorization']).toEqual(`Bearer ${token}`)
            return [200, {}]
        })
        await client.axios.get(url)
    })

    it('refreshes access token when expired then makes request', async () => {
        const url = 'http://www.example.com'
        const validToken = sign(Math.floor(Date.now() / 1000) + 60 * 60)
        const client = new Client({}, onLogin, onLogout, onRefresh.mockResolvedValue(validToken), onChange)
        await new Promise(process.nextTick)

        mock.onGet(url).reply((config) => {
            expect(config.headers!['Authorization']).toEqual(`Bearer ${validToken}`)
            return [200, {}]
        })
        await client.axios.get(url)
    })
})
