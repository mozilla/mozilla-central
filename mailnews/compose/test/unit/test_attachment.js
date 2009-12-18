/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * Test suite for attachment file name.
 */

const input0 = " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_"+
    "`abcdefghijklmnopqrstuvwxyz{|}~"+
    "\xa0\xa1\xa2\xa3\xa4\xa5\xa6\xa7\xa8\xa9\xaa\xab\xac\xad\xae\xaf"+
    "\xb0\xb1\xb2\xb3\xb4\xb5\xb6\xb7\xb8\xb9\xba\xbb\xbc\xbd\xbe\xbf"+
    "\xc0\xc1\xc2\xc3\xc4\xc5\xc6\xc7\xc8\xc9\xca\xcb\xcc\xcd\xce\xcf"+
    "\xd0\xd1\xd2\xd3\xd4\xd5\xd6\xd7\xd8\xd9\xda\xdb\xdc\xdd\xde\xdf"+
    "\xe0\xe1\xe2\xe3\xe4\xe5\xe6\xe7\xe8\xe9\xea\xeb\xec\xed\xee\xef"+
    "\xf0\xf1\xf2\xf3\xf4\xf5\xf6\xf7\xf8\xf9\xfa\xfb\xfc\xfd\xfe\xff.txt"

// ascii only
const input1 = " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_"+
    "`abcdefghijklmnopqrstuvwxyz{|}~.txt"

const expectedCD0 = "Content-Disposition: attachment;\r\n"+
    " filename*0*=ISO-8859-1''%20%21%22%23%24%25%26%27%28%29%2A%2B%2C%2D%2E%2F;\r\n"+
    " filename*1*=%30%31%32%33%34%35%36%37%38%39%3A%3B%3C%3D%3E%3F%40%41%42%43;\r\n"+
    " filename*2*=%44%45%46%47%48%49%4A%4B%4C%4D%4E%4F%50%51%52%53%54%55%56%57;\r\n"+
    " filename*3*=%58%59%5A%5B%5C%5D%5E%5F%60%61%62%63%64%65%66%67%68%69%6A%6B;\r\n"+
    " filename*4*=%6C%6D%6E%6F%70%71%72%73%74%75%76%77%78%79%7A%7B%7C%7D%7E%A0;\r\n"+
    " filename*5*=%A1%A2%A3%A4%A5%A6%A7%A8%A9%AA%AB%AC%AD%AE%AF%B0%B1%B2%B3%B4;\r\n"+
    " filename*6*=%B5%B6%B7%B8%B9%BA%BB%BC%BD%BE%BF%C0%C1%C2%C3%C4%C5%C6%C7%C8;\r\n"+
    " filename*7*=%C9%CA%CB%CC%CD%CE%CF%D0%D1%D2%D3%D4%D5%D6%D7%D8%D9%DA%DB%DC;\r\n"+
    " filename*8*=%DD%DE%DF%E0%E1%E2%E3%E4%E5%E6%E7%E8%E9%EA%EB%EC%ED%EE%EF%F0;\r\n"+
    " filename*9*=%F1%F2%F3%F4%F5%F6%F7%F8%F9%FA%FB%FC%FD%FE%FF%2E%74%78%74\r\n";

const expectedCD1 = "Content-Disposition: attachment;\r\n"+
    ' filename*0=" !\\"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ";\r\n'+
    ' filename*1="[\\\\]^_`abcdefghijklmnopqrstuvwxyz{|}~.txt"\r\n';

const expectedCTList0 = [
    'Content-Type: text/plain; charset=US-ASCII;\r\n'+
    ' name=" =?ISO-8859-1?Q?!=22=23=24=25=26=27=28=29*+=2C-=2E/0123456789=3A=3B=3C=3D?='+
    '=?ISO-8859-1?Q?=3E=3F=40ABCDEFGHIJKLMNOPQRSTUVWXYZ=5B=5C=5D=5E=5F=60abcd?='+
    '=?ISO-8859-1?Q?efghijklmnopqrstuvwxyz=7B=7C=7D=7E=A0=A1=A2=A3=A4=A5=A6=A7?='+
    '=?ISO-8859-1?Q?=A8=A9=AA=AB=AC=AD=AE=AF=B0=B1=B2=B3=B4=B5=B6=B7=B8=B9=BA?='+
    '=?ISO-8859-1?Q?=BB=BC=BD=BE=BF=C0=C1=C2=C3=C4=C5=C6=C7=C8=C9=CA=CB=CC=CD?='+
    '=?ISO-8859-1?Q?=CE=CF=D0=D1=D2=D3=D4=D5=D6=D7=D8=D9=DA=DB=DC=DD=DE=DF=E0?='+
    '=?ISO-8859-1?Q?=E1=E2=E3=E4=E5=E6=E7=E8=E9=EA=EB=EC=ED=EE=EF=F0=F1=F2=F3?='+
    '=?ISO-8859-1?Q?=F4=F5=F6=F7=F8=F9=FA=FB=FC=FD=FE=FF=2Etxt?="\r\n',

    'Content-Type: text/plain; charset=US-ASCII;\r\n'+
    ' name=" =?ISO-8859-1?Q?!=22=23=24=25=26=27=28=29*+=2C-=2E/0123456789=3A=3B=3C=3D?=\r\n'+
    ' =?ISO-8859-1?Q?=3E=3F=40ABCDEFGHIJKLMNOPQRSTUVWXYZ=5B=5C=5D=5E=5F=60abcd?=\r\n'+
    ' =?ISO-8859-1?Q?efghijklmnopqrstuvwxyz=7B=7C=7D=7E=A0=A1=A2=A3=A4=A5=A6=A7?=\r\n'+
    ' =?ISO-8859-1?Q?=A8=A9=AA=AB=AC=AD=AE=AF=B0=B1=B2=B3=B4=B5=B6=B7=B8=B9=BA?=\r\n'+
    ' =?ISO-8859-1?Q?=BB=BC=BD=BE=BF=C0=C1=C2=C3=C4=C5=C6=C7=C8=C9=CA=CB=CC=CD?=\r\n'+
    ' =?ISO-8859-1?Q?=CE=CF=D0=D1=D2=D3=D4=D5=D6=D7=D8=D9=DA=DB=DC=DD=DE=DF=E0?=\r\n'+
    ' =?ISO-8859-1?Q?=E1=E2=E3=E4=E5=E6=E7=E8=E9=EA=EB=EC=ED=EE=EF=F0=F1=F2=F3?=\r\n'+
    ' =?ISO-8859-1?Q?=F4=F5=F6=F7=F8=F9=FA=FB=FC=FD=FE=FF=2Etxt?="\r\n',

    'Content-Type: text/plain; charset=US-ASCII\r\n'
];

const expectedCTList1 = [
    'Content-Type: text/plain; charset=US-ASCII;\r\n'+
    ' name=" !\\"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\\\]^_`abcdefghijklmnopqrstuvwxyz{|}~.txt"\r\n',

    'Content-Type: text/plain; charset=US-ASCII;\r\n'+
    ' name=" !\\"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\\\]^_`abcdefghijklmnopqrstuvwxyz{|}~.txt"\r\n',

    'Content-Type: text/plain; charset=US-ASCII\r\n'
];

var gSmtpServer;
var gDraftFolder;
var gCurTestNum = 0;

var progressListener = {
  onStateChange: function(aWebProgress, aRequest, aStateFlags, aStatus) {
    if (aStateFlags & Ci.nsIWebProgressListener.STATE_STOP){
      do_timeout(0, function(){doTest(++gCurTestNum);});
    }
  },

  onProgressChange: function(aWebProgress, aRequest, aCurSelfProgress, aMaxSelfProgress, aCurTotalProgress, aMaxTotalProgress) {},
  onLocationChange: function(aWebProgress, aRequest, aLocation) {},
  onStatusChange: function(aWebProgress, aRequest, aStatus, aMessage) {},
  onSecurityChange: function(aWebProgress, aRequest, state) {},

  QueryInterface : function(iid) {
    if (iid.equals(Ci.nsIWebProgressListener) ||
        iid.equals(Ci.nsISupportsWeakReference) ||
        iid.equals(Ci.nsISupports))
      return this;

    throw Components.results.NS_NOINTERFACE;
  }
};

function createMessage(folding, input) {
  const prefs = Cc["@mozilla.org/preferences-service;1"]
                  .getService(Ci.nsIPrefBranch);
  prefs.setIntPref("mail.strictly_mime.parm_folding", folding);

  var msgCompose = Cc["@mozilla.org/messengercompose/compose;1"]
                     .createInstance(Ci.nsIMsgCompose);
  var fields = Cc["@mozilla.org/messengercompose/composefields;1"]
                 .createInstance(Ci.nsIMsgCompFields);
  var params = Cc["@mozilla.org/messengercompose/composeparams;1"]
                 .createInstance(Ci.nsIMsgComposeParams);
  params.composeFields = fields;
  msgCompose.Initialize(null, params);
  var identity = getSmtpIdentity(null, gSmtpServer);

  var rootFolder = gLocalIncomingServer.rootMsgFolder;
  gDraftFolder = null;
  // Make sure the drafts folder is empty
  try {
    gDraftFolder = rootFolder.getChildNamed("Drafts");
    // try to delete
    rootFolder.propagateDelete(gDraftFolder, true, null);
  } catch (e) {
    // we don't have to remove the folder because it doen't exist yet
  }
  // Create a new, empty drafts folder
  gDraftFolder = rootFolder.addSubfolder("Drafts");

  var attachment = Cc["@mozilla.org/messengercompose/attachment;1"]
                     .createInstance(Ci.nsIMsgAttachment);
  attachment.url = "data:,";
  attachment.name = input;
  fields.addAttachment(attachment);

  var progress = Cc["@mozilla.org/messenger/progress;1"]
                   .createInstance(Ci.nsIMsgProgress);
  progress.registerListener(progressListener);
  msgCompose.SendMsg(Ci.nsIMsgSend.nsMsgSaveAsDraft, identity, "", null,
                     progress);
}

function checkAttachment(expectedCD, expectedCT) {
  var fileData = loadFileToString(gDraftFolder.filePath);
  var pos = fileData.indexOf("Content-Disposition:");
  do_check_neq(pos, -1);
  var contentDisposition = fileData.substr(pos);
  pos = 0;
  do {
    pos = contentDisposition.indexOf("\n", pos);
    do_check_neq(pos, -1);
    pos++;
  } while (contentDisposition.substr(pos, 1) == " ");
  contentDisposition = contentDisposition.substr(0, pos);
  do_check_eq(contentDisposition, expectedCD);

  pos = fileData.indexOf("Content-Type:"); // multipart
  do_check_neq(pos, -1);
  fileData = fileData.substr(pos + 13);
  pos = fileData.indexOf("Content-Type:"); // body
  do_check_neq(pos, -1);
  fileData = fileData.substr(pos + 13);
  pos = fileData.indexOf("Content-Type:"); // first attachment
  do_check_neq(pos, -1);
  var contentType = fileData.substr(pos);
  pos = 0;
  do {
    pos = contentType.indexOf("\n", pos);
    do_check_neq(pos, -1);
    pos++;
  } while (contentType.substr(pos, 1) == " ");
  contentType = contentType.substr(0, pos);
  do_check_eq(contentType, expectedCT);
  do_timeout(0, function(){doTest(++gCurTestNum);});
}

const gTestArray =
[
  function createMessage1() { createMessage(0, input0); },
  function checkAttachment1() { checkAttachment(expectedCD0, expectedCTList0[0]); },

  function createMessage2() { createMessage(1, input0); },
  function checkAttachment2() { checkAttachment(expectedCD0, expectedCTList0[1]); },

  function createMessage3() { createMessage(2, input0); },
  function checkAttachment3() { checkAttachment(expectedCD0, expectedCTList0[2]); },

  function createMessage4() { createMessage(0, input1); },
  function checkAttachment4() { checkAttachment(expectedCD1, expectedCTList1[0]); },

  function createMessage5() { createMessage(1, input1); },
  function checkAttachment5() { checkAttachment(expectedCD1, expectedCTList1[1]); },

  function createMessage6() { createMessage(2, input1); },
  function checkAttachment6() { checkAttachment(expectedCD1, expectedCTList1[2]); }
]

function run_test() {
  // Ensure we have at least one mail account
  loadLocalMailAccount();

  gSmtpServer = getBasicSmtpServer();

  do_test_pending();

  doTest(1);
}

function doTest(test)
{
  dump("doTest " + test + "\n");
  if (test <= gTestArray.length) {
    gCurTestNum = test;
 
    var testFn = gTestArray[test-1];

    // Set a limit in case the notifications haven't arrived (i.e. a problem)
    do_timeout(10000, function() {
        if(gCurTestNum == test)
	  do_throw("Notifications not received in 10000 ms for operation " + testFn.name +
            ", current status is " + gCurrStatus);
        }
      );
    try {
      testFn();
    } catch(ex) {
      dump(ex);
      do_throw(ex);
    }
  }
  else {
    do_test_finished(); // for the one in run_test()
  }
}
