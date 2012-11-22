/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

Components.utils.import("resource://gre/modules/Services.jsm");
let irc = {};
Services.scriptloader.loadSubScript("resource:///components/irc.js", irc);

const testData = [
  // First off, let's test the messages from RFC 2812.
  "PASS secretpasswordhere",
  "NICK Wiz",
  ":WiZ!jto@tolsun.oulu.fi NICK Kilroy",
  "USER guest 0 * :Ronnie Reagan",
  "USER guest 8 * :Ronnie Reagan",
  "OPER foo bar",
  "MODE WiZ -w",
  "MODE Angel +i",
  "MODE WiZ -o",
  "SERVICE dict * *.fr 0 0 :French Dictionary",
  "QUIT :Gone to have lunch",
  ":syrk!kalt@millennium.stealth.net QUIT :Gone to have lunch",
  "SQUIT tolsun.oulu.fi :Bad Link ?",
  // This fails! But do we really care? It wasn't designed to handle server messages.
  //":Trillian SQUIT cm22.eng.umd.edu :Server out of control",
  "JOIN #foobar",
  "JOIN &foo fubar",
  "JOIN #foo,&bar fubar",
  "JOIN #foo,#bar fubar,foobar",
  "JOIN #foo,#bar",
  "JOIN 0",
  ":WiZ!jto@tolsun.oulu.fi JOIN #Twilight_zone",
  "PART #twilight_zone",
  "PART #oz-ops,&group5",
  ":WiZ!jto@tolsun.oulu.fi PART #playzone :I lost",
  "MODE #Finnish +imI *!*@*.fi",
  "MODE #Finnish +o Kilroy",
  "MODE #Finnish +v Wiz",
  "MODE #Fins -s",
  "MODE #42 +k oulu",
  "MODE #42 -k oulu",
  "MODE #eu-opers +l 10",
  ":WiZ!jto@tolsun.oulu.fi MODE #eu-opers -l",
  "MODE &oulu +b",
  "MODE &oulu +b *!*@*",
  "MODE &oulu +b *!*@*.edu +e *!*@*.bu.edu",
  "MODE #bu +be *!*@*.edu *!*@*.bu.edu",
  "MODE #meditation e",
  "MODE #meditation I",
  "MODE !12345ircd O",
  ":WiZ!jto@tolsun.oulu.fi TOPIC #test :New topic",
  "TOPIC #test :another topic",
  "TOPIC #test :",
  "TOPIC #test",
  "NAMES #twilight_zone,#42",
  "NAMES",
  "LIST",
  "LIST #twilight_zone,#42",
  ":Angel!wings@irc.org INVITE Wiz #Dust",
  "INVITE Wiz #Twilight_Zone",
  "KICK &Melbourne Matthew",
  "KICK #Finnish John :Speaking English",
  ":WiZ!jto@tolsun.oulu.fi KICK #Finnish John",
  ":Angel!wings@irc.org PRIVMSG Wiz :Are you receiving this message ?",
  "PRIVMSG Angel :yes I'm receiving it !",
  "PRIVMSG jto@tolsun.oulu.fi :Hello !",
  "PRIVMSG kalt%millennium.stealth.net@irc.stealth.net :Are you a frog?",
  "PRIVMSG kalt%millennium.stealth.net :Do you like cheese?",
  "PRIVMSG Wiz!jto@tolsun.oulu.fi :Hello !",
  "PRIVMSG $*.fi :Server tolsun.oulu.fi rebooting.",
  "PRIVMSG #*.edu :NSFNet is undergoing work, expect interruptions",
  "VERSION tolsun.oulu.fi",
  "STATS m",
  "LINKS *.au",
  "LINKS *.edu *.bu.edu",
  "TIME tolsun.oulu.fi",
  "CONNECT tolsun.oulu.fi 6667",
  "TRACE *.oulu.fi",
  "ADMIN tolsun.oulu.fi",
  "ADMIN syrk",
  "INFO csd.bu.edu",
  "INFO Angel",
  "SQUERY irchelp :HELP privmsg",
  "SQUERY dict@irc.fr :fr2en blaireau",
  "WHO *.fi",
  "WHO jto* o",
  "WHOIS wiz",
  "WHOIS eff.org trillian",
  "WHOWAS Wiz",
  "WHOWAS Mermaid 9",
  "WHOWAS Trillian 1 *.edu",
  "PING tolsun.oulu.fi",
  "PING WiZ tolsun.oulu.fi",
  // Below fails, we don't use the (unnecessary) colon.
  //"PING :irc.funet.fi",
  "PONG csd.bu.edu tolsun.oulu.fi",
  "ERROR :Server *.fi already exists",
  "NOTICE WiZ :ERROR from csd.bu.edu -- Server *.fi already exists",
  "AWAY :Gone to lunch.  Back in 5",
  "REHASH",
  "DIE",
  "RESTART",
  "SUMMON jto",
  "SUMMON jto tolsun.oulu.fi",
  "USERS eff.org",
  ":csd.bu.edu WALLOPS :Connect '*.uiuc.edu 6667' from Joshua",
  "USERHOST Wiz Michael syrk",
  // Below fails, we don't use the (unnecessary) colon.
  //":ircd.stealth.net 302 yournick :syrk=+syrk@millennium.stealth.net",
  "ISON phone trillian WiZ jarlek Avalon Angel Monstah syrk",

  // Now for the torture test, specially crafted messages that might be
  // "difficult" to handle.
  "PRIVMSG foo ::)", // Test sending a colon as the first character.
  "PRIVMSG foo :This is a test.", // Test sending a space.
  "PRIVMSG foo :", // Empty last parameter.
  "PRIVMSG foo :This is :a test." // A "second" last parameter.
];

function run_test() {
  add_test(testRFC2812Messages);
  add_test(testBrokenUnrealMessages);
  add_test(testNewLinesInMessages);

  run_next_test();
}

function testRFC2812Messages() {
  for each (let expectedStringMessage in testData) {
    let message = irc.ircMessage(expectedStringMessage);

    let stringMessage =
      irc.ircAccount.prototype.buildMessage(message.command, message.params);

    // Let's do a little dance here...we don't rebuild the "source" of the
    // message (the server does that), so when comparing our output message, we
    // need to avoid comparing to that part.
    if (message.servername || message.source) {
      expectedStringMessage =
        expectedStringMessage.slice(expectedStringMessage.indexOf(" ") + 1);
    }

    do_check_eq(stringMessage, expectedStringMessage);
  }

  run_next_test();
}

function isEqual(aObject1, aObject2) {
  let result = true;
  for (let fieldName in aObject1) {
    let field1 = aObject1[fieldName];
    let field2 = aObject2[fieldName];
    if (typeof field1 == "object")
      result &= isEqual(field1, field2);
    else if (Array.isArray(field1))
      result &= field1.every(function(el, idx) el == field2[idx]);
    else
      result &= field1 == field2;
  }
  return result;
}

// Unreal sends a couple of broken messages, see ircMessage in irc.js for a
// description of what's wrong.
function testBrokenUnrealMessages() {
  let messages = {
    ":gravel.mozilla.org 432  #momo :Erroneous Nickname: Illegal characters": {
      rawMessage: ":gravel.mozilla.org 432  #momo :Erroneous Nickname: Illegal characters",
      command: "432",
      params: ["", "#momo", "Erroneous Nickname: Illegal characters"],
      servername: "gravel.mozilla.org"
    },
    ":gravel.mozilla.org MODE #tckk +n ": {
      rawMessage: ":gravel.mozilla.org MODE #tckk +n ",
      command: "MODE",
      params: ["#tckk", "+n"],
      servername: "gravel.mozilla.org"
    },
    ":services.esper.net MODE #foo-bar +o foobar  ": {
      rawMessage: ":services.esper.net MODE #foo-bar +o foobar  ",
      command: "MODE",
      params: ["#foo-bar", "+o", "foobar"],
      servername: "services.esper.net"
    }
  };

  for (let messageStr in messages)
    do_check_true(isEqual(messages[messageStr], irc.ircMessage(messageStr)));

  run_next_test();
}

// After unescaping we can end up with line breaks inside of IRC messages. Test
// this edge case specifically.
function testNewLinesInMessages() {
  let messages = {
    ":test!Instantbir@host PRIVMSG #instantbird :First line\nSecond line": {
      rawMessage: ":test!Instantbir@host PRIVMSG #instantbird :First line\nSecond line",
      command: "PRIVMSG",
      params: ["#instantbird", "First line\nSecond line"],
      nickname: "test",
      user: "Instantbir",
      host: "host",
      source: "Instantbir@host"
    },
    ":test!Instantbir@host PRIVMSG #instantbird :First line\r\nSecond line": {
      rawMessage: ":test!Instantbir@host PRIVMSG #instantbird :First line\r\nSecond line",
      command: "PRIVMSG",
      params: ["#instantbird", "First line\r\nSecond line"],
      nickname: "test",
      user: "Instantbir",
      host: "host",
      source: "Instantbir@host"
    }
  };

  for (let messageStr in messages)
    do_check_true(isEqual(messages[messageStr], irc.ircMessage(messageStr)));

  run_next_test();
}
