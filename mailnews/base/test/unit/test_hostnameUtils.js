/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Tests for hostnameUtils.jsm.
 */

Components.utils.import("resource:///modules/hostnameUtils.jsm");

/**
 * Checks if valid and invalid IPs are properly allowed or rejected.
 */
function test_IPaddresses() {
  const kIPsToTest = [
    // isValid,	IP addr.		isIPv6,	isLocal,extend,	result
    // IPv4
    [ true,	"1.2.3.4",		false,	false,	false ],
    [ true,	"123.245.111.222",	false,	false,	false ],
    [ true,	"255.255.255.255",	false,	false,	false ],
    [ true,	"1.2.0.4",		false,	false,	false ],
    [ true,	"1.2.3.4",		false,	false,	false ],
    [ true,	"127.1.2.3",		false,	true,	false ],
    [ true,	"10.1.2.3",		false,	true,	false ],
    [ true,	"192.168.2.3",		false,	true,	false ],

    [ false,	"1.2.3.4.5",		false,	false,	false ],
    [ false,	"1.2.3",		false,	false,	false ],
    [ false,	"1.2.3.",		false,	false,	false ],
    [ false,	".1.2.3",		false,	false,	false ],
    [ false,	"1.2.3.256",		false,	false,	false ],
    [ false,	"1.2.3.12345",		false,	false,	false ],
    [ false,	"1.2..123",		false,	false,	false ],
    [ false,	"1",			false,	false,	false ],
    [ false,	"",			false,	false,	false ],
    [ false,	"0.1.2.3",		false,	false,	false ],
    [ false,	"0.0.2.3",		false,	false,	false ],
    [ false,	"0.0.0.0",		false,	false,	false ],
    [ false,	"1.2.3.d",		false,	false,	false ],
    [ false,	"a.b.c.d",		false,	false,	false ],
    [ false,	"a.b.c.d",		false,	false,	true ],
    // IPv6
    [ true,	"2001:0db8:85a3:0000:0000:8a2e:0370:7334",	true,	false,	false, "2001:0db8:85a3:0000:0000:8a2e:0370:7334" ],
    [ true,	"2001:db8:85a3:0:0:8a2e:370:7334",		true,	false,	false, "2001:0db8:85a3:0000:0000:8a2e:0370:7334" ],
    [ true,	"2001:db8:85a3::8a2e:370:7334",			true,	false,	false, "2001:0db8:85a3:0000:0000:8a2e:0370:7334" ],
    [ true,	"2001:0db8:85a3:0000:0000:8a2e:0370:",		true,	false,	false, "2001:0db8:85a3:0000:0000:8a2e:0370:0000" ],
    [ true,	"::ffff:c000:0280",				true,	false,	false, "0000:0000:0000:0000:0000:ffff:c000:0280" ],
    [ true,	"::ffff:192.0.2.128",				true,	false,	false, "0000:0000:0000:0000:0000:ffff:c000:0280" ],
    [ true,	"2001:db8::1",					true,	false,	false, "2001:0db8:0000:0000:0000:0000:0000:0001" ],
    [ true,	"2001:DB8::1",					true,	false,	false, "2001:0db8:0000:0000:0000:0000:0000:0001" ],
    [ true,	"1:2:3:4:5:6:7:8",				true,	false,	false, "0001:0002:0003:0004:0005:0006:0007:0008" ],

    [ true,	"::1",						true,	true,	false, "0000:0000:0000:0000:0000:0000:0000:0001" ],
    [ true,	"::0000:0000:1",				true,	true,	false, "0000:0000:0000:0000:0000:0000:0000:0001" ],

    [ false,	"::",						true,	false,	false ],
    [ false,	"2001:0db8:85a3:0000:0000:8a2e:0370:73346",	true,	false,	false ],
    [ false,	"2001:0db8:85a3:0000:0000:8a2e:0370:7334:1",	true,	false,	false ],
    [ false,	"2001:0db8:85a3:0000:0000:8a2e:0370:7334x",	true,	false,	false ],
    [ false,	"2001:0db8:85a3:0000:0000:8a2e:03707334",	true,	false,	false ],
    [ false,	"2001:0db8:85a3:0000:0000x8a2e:0370:7334",	true,	false,	false ],
    [ false,	"2001:0db8:85a3:0000:0000:::1",			true,	false,	false ],
    [ false,	"2001:0db8:85a3:0000:0000:0000:some:junk",	true,	false,	false ],
    [ false,	"2001:0db8:85a3:0000:0000:0000::192.0.2.359",	true,	false,	false ],
    [ false,	"some::junk",					true,	false,	false ],
    [ false,	"some_junk",					true,	false,	false ],

    // Extended formats of IPv4, hex, octal, decimal up to DWORD
    [ true,	"0xff.0x12.0x45.0x78",	false,	false,	true,	"255.18.69.120" ],
    [ true,	"01.0123.056.077",	false,	false,	true,	"1.83.46.63" ],
    [ true,	"0xff.2.3.4",		false,	false,	true,	"255.2.3.4" ],
    [ true,	"0xff.2.3.077",		false,	false,	true,	"255.2.3.63" ],
    [ true,	"0x7f.2.3.077",		false,	true,	true,	"127.2.3.63" ],

    [ false,	"0xZZ.1.2.3",		false,	false,	true ],
    [ false,	"0x00.0123.056.077",	false,	false,	true ],
    [ false,	"0x11.0123.056.078",	false,	false,	true ],
    [ false,	"0x11.0123.056.0789",	false,	false,	true ],

    [ true,	"1234566945",		false,	false,	true,	"73.149.255.33" ],
    [ false,	"12345",		false,	false,	true ],
    [ false,	"123456789123456",	false,	false,	true ],

    [ true,	"127.1",		false,	true,	true,	"127.0.0.1" ],
    [ true,	"0x7f.100",		false,	true,	true,	"127.0.0.100" ],
    [ true,	"0x7f.100.1000",	false,	true,	true,	"127.100.3.232" ],
    [ true,	"0xff.100.1024",	false,	false,	true,	"255.100.4.0" ],
    [ true,	"0xC0.0xA8.0x2A48",	false,	true,	true,	"192.168.42.72" ],
    [ true,	"0xC0.0xA82A48",	false,	true,	true,	"192.168.42.72" ],
    [ true,	"0xC0A82A48",		false,	true,	true,	"192.168.42.72" ],
    [ true,	"0324.062477106",	false,	false,	true,	"212.202.126.70" ],

    [ false,	"0.0.1000",		false,	false,	true ],
    [ false,	"0324.06247710677",	false,	false,	true ]
  ];

  for (let item of kIPsToTest) {
    let result = null;
    let [isValid, address, isIPv6, isLocal, isExtended, wantedResult] = item;
    if (!wantedResult)
      wantedResult = isValid ? address : null;

    if (isIPv6) {
      result = isLegalIPv6Address(address);
      do_check_eq(result, wantedResult);
      if (isValid) {
        // If this is valid IPv6, it can't be valid IPv4. The opposite is unknown.
        result = isLegalIPv4Address(address);
        do_check_eq(result, null);
      }
    } else {
      result = isLegalIPv4Address(address, isExtended);
      do_check_eq(result, wantedResult);
      if (isValid) {
        // If this is valid IPv4, it can't be valid IPv6. The opposite is unknown.
        result = isLegalIPv6Address(address);
        do_check_eq(result, null);
      }
    }

    result = isLegalIPAddress(address, isExtended);
    do_check_eq(result, wantedResult);

    if (isValid) {
      // isLegalLocalIPAddress operates on a normalized address,
      // not the original one.
      result = isLegalLocalIPAddress(result);
      do_check_eq(result, isLocal);
    }

    // If something is a valid IP, it also passes isLegalHostNameOrIP.
    // However, an invalid IP string may still be a valid hostname.
    // So only check success if the IP is valid.
    result = isLegalHostNameOrIP(address, isExtended);
    if (isValid)
      do_check_eq(result, wantedResult);
  }
}
/**
 * Checks if valid and invalid host names are properly allowed or rejected.
 */
function test_hostnames() {
  const kHostsToTest = [
    // isValid,	hostname
    [ true,	"localhost" ],
    [ true,	"some-server" ],
    [ true,	"server.company.invalid" ],
    [ true,	"server.comp-any.invalid" ],
    [ true,	"server.123.invalid" ],
    [ true,	"1server.123.invalid" ],
    [ true,	"1.2.3.4.5" ],
    [ true,	"very.log.sub.domain.name.invalid" ],
    [ true,	"1234567890" ],
    [ true,	"1234567890." ], // FQDN
    [ true,	"server.company.invalid." ], // FQDN

    [ false,	"" ],
    [ false,	"server.badcompany!.invalid" ],
    [ false,	"server._badcompany.invalid" ],
    [ false,	"server.bad_company.invalid" ],
    [ false,	"server.badcompany-.invalid" ],
    [ false,	"server.bad company.invalid" ],
    [ false,	"server.b…dcompany.invalid" ],
    [ false,	".server.badcompany.invalid" ],
    [ false,	"make-this-a-long-host-name-component-that-is-over-63-characters-long.invalid" ],
    [ false,	"append-strings-to-make-this-a-too-long-host-name.that-is-really-over-255-characters-long.invalid." +
                "append-strings-to-make-this-a-too-long-host-name.that-is-really-over-255-characters-long.invalid." +
                "append-strings-to-make-this-a-too-long-host-name.that-is-really-over-255-characters-long.invalid." +
                "append-strings-to-make-this-a-too-long-host-name.that-is-really-over-255-characters-long.invalid" ]
  ];

  for (let item of kHostsToTest) {
    let result = null;
    let [wantedResult, hostname] = item;
    wantedResult = wantedResult ? hostname : null;

    result = isLegalHostName(hostname);
    do_check_eq(result, wantedResult);

    result = isLegalHostNameOrIP(hostname, false);
    do_check_eq(result, wantedResult);
  }
}

var gTests = [
  test_IPaddresses,
  test_hostnames,
];

function run_test() {
  for (let test of gTests)
    test();
}
