Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource:///modules/mailServices.js");

load("resources/mock_windows_reg_factory.js");

function POP3Account() {}

POP3Account.prototype = {
  'Account Name': 'POP3 Account Name',
  'POP3 Server': 'pop.host.invalid',
  'POP3 User Name': 'pop3user',
  'Leave Mail On Server': 1,
  'SMTP Server': 'smtp.host.invalid',
  'SMTP Display Name': 'SMTP Display Name',
  'SMTP Email Address': 'pop3user@host.invalid',
  'SMTP Reply To Email Address': 'pop3user@host.invalid',
  'SMTP Organization Name': 'SMTP Organization Name',
  'SMTP User Name': 'smtpuser'
};

function IMAPAccount() {}

IMAPAccount.prototype = {
  'Account Name': 'IMAP Account Name',
  'IMAP Server': 'imap.host.invalid',
  'IMAP User Name': 'imapuser',
  'SMTP Server': 'smtp.host.invalid',
  'SMTP Display Name': 'SMTP Display Name',
  'SMTP Email Address': 'imapuser@host.invalid',
  'SMTP Reply To Email Address': 'imapuser@host.invalid',
  'SMTP Organization Name': 'SMTP Organization Name',
  'SMTP User Name': 'smtpuser'
};

/* Outlook 98 */
function Outlook98Registry(defaultAccount) {
  this._defaultAccount = defaultAccount;
}

Outlook98Registry.prototype = {
  get 'Software\\Microsoft\\Office\\8.0\\Outlook\\OMI Account Manager'() {
    return {
      'Default Mail Account': '00000001',
      '00000001': this._defaultAccount
    };
  }
};

/* Outlook 2003 - */
function Outlook2003Registry(defaultAccount) {
  this._defaultAccount = defaultAccount;
}

Outlook2003Registry.prototype = {
  get 'Software\\Microsoft\\Office\\Outlook\\OMI Account Manager'() {
    return {
      'Default Mail Account': '00000001',
      '00000001': this._defaultAccount
    };
  }
};

let expectedPop3Account = {
  incomingServer: {
    type: 'pop3',
    hostName: 'pop.invalid.host',
    username: 'pop3user',
    leaveMessagesOnServer: true
  },
  identity: {
    fullName: 'SMTP Display Name',
    email: 'pop3user@host.invalid',
    replyTo: 'pop3user@host.invalid',
    organization: 'SMTP Organization Name'
  },
  smtpServer: {
    hostname: 'smtp.invalid.host',
    username: 'smtpuser'
  }
};

let expectedImapAccount = {
  incomingServer: {
    type: 'imap',
    hostName: 'imap.invalid.host',
    username: 'imapuser'
  },
  identity: {
    fullName: 'SMTP Display Name',
    email: 'imapuser@host.invalid',
    replyTo: 'imapuser@host.invalid',
    organization: 'SMTP Organization Name'
  },
  smtpServer: {
    hostname: 'smtp.invalid.host',
    username: 'smtpuser'
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
    new SettingsImportHelper(null, "Outlook", [expectedAccount]).beginImport();
  } catch(e) {
    teardown();
    do_throw(e);
  }
  teardown();
}

function run_test() {
  _test(new Outlook2003Registry(new POP3Account()), expectedPop3Account);
  _test(new Outlook2003Registry(new IMAPAccount()), expectedImapAccount);

  _test(new Outlook98Registry(new POP3Account()), expectedPop3Account);
  _test(new Outlook98Registry(new IMAPAccount()), expectedImapAccount);
}

