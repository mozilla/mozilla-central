/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * Test suite for nsMsgCompFields functions.
 * Currently only tests nsIMsgCompFields::SplitRecipients
 */

const splitRecipientsTests =
  [ { recipients: "me@invalid.com",
      emailAddressOnly: false,
      count: 1,
      result: [ "me@invalid.com" ]
    },
    { recipients: "me@invalid.com, me2@invalid.com",
      emailAddressOnly: false,
      count: 2,
      result: [ "me@invalid.com", "me2@invalid.com" ]
    },
    { recipients: '"foo bar" <me@invalid.com>',
      emailAddressOnly: false,
      count: 1,
      result: [ '"foo bar" <me@invalid.com>' ]
    },
    { recipients: '"foo bar" <me@invalid.com>',
      emailAddressOnly: true,
      count: 1,
      result: [ 'me@invalid.com' ]
    },
    { recipients: '"foo bar" <me@invalid.com>, "bar foo" <me2@invalid.com>',
      emailAddressOnly: false,
      count: 2,
      result: [ '"foo bar" <me@invalid.com>', '"bar foo" <me2@invalid.com>' ]
    },
    { recipients: '"foo bar" <me@invalid.com>, "bar foo" <me2@invalid.com>',
      emailAddressOnly: true,
      count: 2,
      result: [ "me@invalid.com", "me2@invalid.com" ]
    },
    { recipients: "",
      emailAddressOnly: false,
      count: 0,
      result: []
    } ];

function run_test() {
  var fields = Cc["@mozilla.org/messengercompose/composefields;1"]
                 .createInstance(Ci.nsIMsgCompFields);

  // As most of SplitRecipients functionality is in the nsIMsgHeaderParser
  // functionality, here (at least initially), we're just interested in checking
  // the basic argument/return combinations.

  for (var part = 0; part < splitRecipientsTests.length; ++part) {
    var count = {};
    print("Test: " + splitRecipientsTests[part].recipients);
    var result = fields.splitRecipients(splitRecipientsTests[part].recipients,
                                        splitRecipientsTests[part].emailAddressOnly,
                                        count);

    do_check_eq(splitRecipientsTests[part].count, count.value);
    do_check_eq(splitRecipientsTests[part].count, result.length);

    for (var item = 0; item < count.value; ++item)
      do_check_eq(splitRecipientsTests[part].result[item], result[item]);
  }
}
