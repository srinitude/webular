// SSRF guard: IPv6 transition forms that carry or reach a private IPv4 (RFC 3056 6to4,
// RFC 8215 local-use NAT64, RFC 7915 SIIT ::ffff:0:0/96) count as private.
import { describe, expect, test } from 'bun:test'
import { isPrivateIp } from '../../src/core/address-guard.ts'

const PRIVATE = [
  '2002:7f00:1::', // 6to4 of 127.0.0.1
  '[2002:a9fe:a9fe::1]', // 6to4 of 169.254.169.254, bracketed as URL.hostname gives it
  '2002:c0a8:101:5::1', // 6to4 of 192.168.1.1
  '64:ff9b:1::a9fe:a9fe', // local-use NAT64 prefix
  '64:ff9b:1:ffff::1',
  '::ffff:0:7f00:1', // SIIT form of 127.0.0.1
  '::ffff:0:a9fe:a9fe',
]
const PUBLIC = ['2002:808:808::1', '2002:101:101::', '::ffff:0:808:808', '64:ff9b::808:808']

describe('isPrivateIp: embedded IPv4 transition forms', () => {
  for (const ip of PRIVATE) test(`private: ${ip}`, () => expect(isPrivateIp(ip)).toBe(true))
  for (const ip of PUBLIC) test(`public: ${ip}`, () => expect(isPrivateIp(ip)).toBe(false))
})
