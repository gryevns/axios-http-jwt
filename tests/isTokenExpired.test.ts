import jwt from 'jsonwebtoken'
import { isTokenExpired } from '../src'

const sign = (exp: number) => jwt.sign({ exp }, 'secret')

describe('isTokenExpired', () => {
    it('returns true when no token provided', () => {
        expect(isTokenExpired(undefined)).toBeTruthy()
    })

    it('returns true when token is expired', () => {
        const token = sign(Math.floor(Date.now() / 1000) - 60 * 60)
        expect(isTokenExpired(token)).toBeTruthy()
    })

    it('returns false when token is valid', () => {
        const token = sign(Math.floor(Date.now() / 1000) + 60 * 60)
        expect(isTokenExpired(token)).toBeFalsy()
    })
})
