import { IncomingMessage, ServerResponse as Response } from 'http'
import * as cookie from '@tinyhttp/cookie'
import * as signature from '@tinyhttp/cookie-signature'

export interface CookieParserRequest extends IncomingMessage {
  cookies?: any
  secret?: string | string[]
  signedCookies?: any
}

/**
 * Parse JSON cookie string.
 */
export function JSONCookie(str?: string | unknown) {
  if (typeof str !== 'string' || str.substr(0, 2) !== 'j:') {
    return undefined
  }

  try {
    return JSON.parse(str.slice(2))
  } catch (err) {
    return undefined
  }
}

/**
 * Parse JSON cookies.
 */
function JSONCookies(obj: any) {
  const cookies = Object.keys(obj)

  for (const key of cookies) {
    const val = JSONCookie(obj[key])

    if (val) obj[key] = val
  }

  return obj
}

/**
 * Parse a signed cookie string, return the decoded value.
 */
export function signedCookie(str: string | unknown, secret: string | string[]): string | boolean | undefined {
  if (typeof str !== 'string') return undefined

  if (str.substr(0, 2) !== 's:') return str

  const secrets = !secret || Array.isArray(secret) ? secret || [] : [secret]

  for (const secret of secrets) {
    const val = signature.unsign(str.slice(2), secret)

    if (val !== false) return val
  }

  return false
}

/**
 * Parse signed cookies, returning an object containing the decoded key/value
 * pairs, while removing the signed key from obj.
 */
export function signedCookies(obj: any, secret: string | string[]): Record<string, string | boolean | undefined> {
  const cookies = Object.keys(obj)
  const ret: Record<string, string | boolean | undefined> = Object.create(null)

  for (const key of cookies) {
    const val = obj[key]
    const dec = signedCookie(val, secret)

    if (val !== dec) {
      ret[key] = dec
      delete obj[key]
    }
  }

  return ret
}

/**
 * Parse Cookie header and populate `req.cookies`
 * with an object keyed by the cookie names.
 */
export const cookieParser = (secret?: string | string[]) => {
  const secrets = !secret || Array.isArray(secret) ? secret || [] : [secret]

  return function cookieParser(req: CookieParserRequest, _res: Response, next?: () => void): void {
    if (req.cookies) {
      next?.()
      return
    }

    const cookies = req.headers.cookie

    req.secret = secrets[0]
    req.cookies = Object.create(null)
    req.signedCookies = Object.create(null)

    if (!cookies) {
      next?.()
      return
    }

    req.cookies = cookie.parse(cookies)

    // parse signed cookies
    if (secrets.length !== 0) {
      req.signedCookies = signedCookies(req.cookies, secrets)
      req.signedCookies = JSONCookies(req.signedCookies)
    }

    // parse JSON cookies
    req.cookies = JSONCookies(req.cookies)

    next?.()
  }
}
