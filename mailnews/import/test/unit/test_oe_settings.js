/**
 * Basic tests for importing accounts of Outlook Express 4.0/5.0.
 */

load("resources/mock_windows_reg_factory.js");

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource:///modules/mailServices.js");

function POP3Account() {}

POP3Account.prototype = {
  'Account Name': 'POP3 Account Name',
  'POP3 Server': 'pop.host.invalid',
  'POP3 User Name': 'pop3user',
  'POP3 Secure Connection': 0,
  'POP3 Port': 1100,
  'POP3 Use Sicily': 1,
  'POP3 Skip Account': 0,
  'Leave Mail On Server': 1,
  'Remove When Deleted': 1,
  'Remove When Expired': 1,
  'Expire Days': 9,
  'SMTP Server': 'smtp.host.invalid',
  'SMTP Port': 250,
  'SMTP Secure Connection': 0,
  'SMTP Display Name': 'SMTP Display Name',
  'SMTP Email Address': 'pop3user@host.invalid',
  'SMTP Reply To Email Address': 'pop3user@host.invalid',
  'SMTP Organization Name': 'SMTP Organization Name',
  'SMTP Use Sicily': 1,
  'SMTP User Name': 'smtpuser'
};

function IMAPAccount() {}

IMAPAccount.prototype = {
  'Account Name': 'IMAP Account Name',
  'IMAP Server': 'imap.host.invalid',
  'IMAP User Name': 'imapuser',
  'IMAP Secure Connection': 1,
  'IMAP Port': 1340,
  'IMAP Use Sicily': 1,
  'IMAP Root Folder': 'Root Folder',
  'SMTP Server': 'smtp.host.invalid',
  'SMTP Port': 465,
  'SMTP Secure Connection': 1,
  'SMTP Display Name': 'SMTP Display Name',
  'SMTP Email Address': 'imapuser@host.invalid',
  'SMTP Reply To Email Address': 'imapuser@host.invalid',
  'SMTP Organization Name': 'SMTP Organization Name',
  'SMTP Use Sicily': 2,
  'SMTP User Name': 'smtpuser'
};

function NNTPAccount() {}

NNTPAccount.prototype = {
  'Account Name': 'NNTP Account Name',
  'NNTP Server': 'nntp.host.invalid',
  'NNTP User Name': 'nntpuser',
  'NNTP Port': 1190,
  'NNTP Display Name': 'NNTP Display Name',
  'NNTP Email Address': 'nntpuser@host.invalid',
  'NNTP Reply To Email Address': 'nntpuser@host.invalid',
  'NNTP Organization Name': 'NNTP Organization Name',
};

/* Outlook Express 4.0 */
function OE4Registry(defaultAccount) {
  this._defaultAccount = defaultAccount;
}

OE4Registry.prototype = {
  'Identities': {
    'Default User ID': '{DEFAULT_ID}'
  },
  'Software\\Microsoft\\Outlook Express': {
    'Default Mail Account': 'defaulAccount',
    'Mail': {
      'Poll For Mail': 1234 * 60000
    },
  },
  get 'Identities\\{DEFAULT_ID}\\Software\\Microsoft\\Internet Account Manager\\Accounts'() {
    return { 'defaultAccount': this._defaultAccount };
  }
};

/* Outlook Express 5.0 */
function OE5Registry(defaultAccount) {
  this._defaultAccount = defaultAccount;
}

OE5Registry.prototype = {
  'Identities': {
    'Default User ID': '{DEFAULT_ID}'
  },
  'Identities\\{DEFAULT_ID}\\Software\\Microsoft\\Outlook Express\\5.0': {
    'Mail': {
      'Poll For Mail': 1234 * 60000
    },
  },
  'Identities\\{DEFAULT_ID}\\Software\\Microsoft\\Internet Account Manager': {
    'Default Mail Account': 'defaultAccount'
  },
  get 'Software\\Microsoft\\Internet Account Manager\\Accounts'() {
    return { 'defaultAccount': this._defaultAccount };
  }
};

let expectedPop3Account = {
  incomingServer: {
    type: 'pop3',
    hostName: 'pop.invalid.host',
    port: 1100,
    username: 'pop3user',
    isSecure: false,
    authMethod: Ci.nsMsgAuthMethod.secure,
    socketType: 0,
    doBiff: true,
    biffMinutes: 1234,
    leaveMessagesOnServer: true,
    deleteMailLeftOnServer: true,
    deleteByAgeFromServer: true,
    numDaysToLeaveOnServer: 9,
  },
  identity: {
    fullName: 'SMTP Display Name',
    email: 'pop3user@host.invalid',
    replyTo: 'pop3user@host.invalid',
    organization: 'SMTP Organization Name'
  },
  smtpServer: {
    hostname: 'smtp.invalid.host',
    port: 250,
    username: 'smtpuser',
    authMethod: Ci.nsMsgAuthMethod.secure,
    socketType: 0,
  }
};

let expectedImapAccount = {
  incomingServer: {
    type: 'imap',
    hostName: 'imap.invalid.host',
    port: 1340,
    username: 'imapuser',
    isSecure: true,
    authMethod: Ci.nsMsgAuthMethod.secure,
    socketType: Ci.nsMsgSocketType.SSL,
    doBiff: true,
    biffMinutes: 1234,
  },
  identity: {
    fullName: 'SMTP Display Name',
    email: 'imapuser@host.invalid',
    replyTo: 'imapuser@host.invalid',
    organization: 'SMTP Organization Name'
  },
  smtpServer: {
    hostname: 'smtp.invalid.host',
    port: 465,
    username: 'imapuser', // use incoming server's username if Sicily is 2.
    authMethod: Ci.nsMsgAuthMethod.secure,
    socketType: Ci.nsMsgSocketType.SSL,
  }
};

let expectedNntpAccount = {
  incomingServer: {
    type: 'nntp',
    hostName: 'nntp.invalid.host',
    port: 1190,
    username: 'nntpuser',
    isSecure: false,
    authMethod: Ci.nsMsgAuthMethod.passwordCleartext,
    socketType: 0,
    doBiff: false,
    biffMinutes: 10, // Default preference value
  },
  identity: {
    fullName: 'NNTP Display Name',
    email: 'nntpuser@host.invalid',
    replyTo: 'nntpuser@host.invalid',
    organization: 'NNTP Organization Name'
  }
};

function teardown() {
  let smtpServers = MailServices.smtp.servers;

  while (smtpServers.hasMoreElements()) {
    let server = smtpServers.getNext().QueryInterface(Ci.nsISmtpServer);
    MailServices.smtp.deleteServer(server);
  }

  teardown_mock_registry();
}

function _test(registry, expectedAccount) {
  try {
    setup_mock_registry(registry);
    new SettingsImportHelper(null, "Outlook Express", [expectedAccount]).beginImport();
  } catch(e) {
    teardown();
    do_throw(e);
  }
  teardown();
}

function run_test() {
  _test(new OE5Registry(new POP3Account()), expectedPop3Account);
  _test(new OE5Registry(new IMAPAccount()), expectedImapAccount);
  _test(new OE5Registry(new NNTPAccount()), expectedNntpAccount);

  _test(new OE4Registry(new POP3Account()), expectedPop3Account);
  _test(new OE4Registry(new IMAPAccount()), expectedImapAccount);
  _test(new OE4Registry(new NNTPAccount()), expectedNntpAccount);
}
