Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

const Cc = Components.classes;
const Ci = Components.interfaces;

function TestMailImpoter() {
};

TestMailImpoter.prototype = {
  classID: Components.ID("{a81438ef-aca1-41a5-9b3a-3ccfbbe4f5e1}"),

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIImportModule,
                                         Ci.nsIImportMail]),

  contractID: "@mozilla.org/import/test;1",

  _xpcom_categories: [{
    category: "mailnewsimport",
    entry: "{a81438ef-aca1-41a5-9b3a-3ccfbbe4f5e1}",
    value: "mail"
  }],

  name: "Test mail import module",

  description: "Test module for mail import",

  supports: "mail",

  supportsUpgrade: true,

  GetImportInterface: function(type) {
    if (type != "mail")
      return null;
    let importService = Cc["@mozilla.org/import/import-service;1"]
                        .createInstance(Ci.nsIImportService);
    let genericInterface = importService.CreateNewGenericMail();
    genericInterface.SetData("mailInterface", this);
    let name = Cc["@mozilla.org/supports-string;1"]
               .createInstance(Ci.nsISupportsString);
    name.data = "TestMailImporter";
    genericInterface.SetData("name", name);
    return genericInterface;
  },

  GetDefaultLocation: function(location, found, userVerify) {
    found = false;
    userVerify = false;
  },

  _createMailboxDescriptor: function(path, name, depth) {
    let importService = Cc["@mozilla.org/import/import-service;1"]
                        .createInstance(Ci.nsIImportService);
    let descriptor = importService.CreateNewMailboxDescriptor();
    descriptor.size = 100;
    descriptor.depth = depth;
    descriptor.SetDisplayName(name);
    descriptor.file.initWithPath(path);

    return descriptor;
  },

  _collectMailboxesInDirectory: function(directory, depth, result) {
    let descriptor = this._createMailboxDescriptor(directory.path,
                                                   directory.leafName,
                                                   depth);
    result.AppendElement(descriptor);
    let entries = directory.directoryEntries;
    while (entries.hasMoreElements()) {
      let entry = entries.getNext().QueryInterface(Ci.nsIFile);
      if (entry.isDirectory())
        this._collectMailboxesInDirectory(entry, depth + 1, result);
    }
  },

  FindMailboxes: function(location) {
    let result;
    result = Cc["@mozilla.org/supports-array;1"]
             .createInstance(Ci.nsISupportsArray);
    this._collectMailboxesInDirectory(location, 0, result);

    return result;
  },

  ImportMailbox: function(source,
                          destination,
                          errorLog,
                          successLog,
                          fatalError) {
    this.progress = 0;
    let msgStore = destination.msgStore;

    let entries = directory.directoryEntries;
    while (entries.hasMoreElements()) {
      let entry = entries.getNext().QueryInterface(Ci.nsIFile);
      if (!entry.isFile())
        continue;

      let newMsgHdr = new Object;
      let reusable = new Object;
      let outputStream = msgStore.getNewMsgOutputStream(destination,
                                                        newMsgHdr,
                                                        reusable);

      let inputStream = Cc["@mozilla.org/network/file-input-stream;1"]
                         .createInstance(Ci.nsIFileInputStream);
      inputStream.init(entry, -1, -1, 0);
      let count = inputStream.available();
      while (count > 0) {
        let writtenBytes = outputStream.writeFrom(inputStream, count);
        count -= writtenBytes;
        if (count == 0)
          count = inputStream.available();
      }
      msgStore.finishNewMessage(outputStream, newMsgHdr);
      inputStream.close();
      outputStream.close();
    }
    this.progress = 100;
  },

  GetImportProgress: function() {
    return this.progress;
  },

  translateFolderName: function(folderName) {
    return folderName;
  }

};

const NSGetFactory = XPCOMUtils.generateNSGetFactory([TestMailImpoter]);
