/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// service class to manipulate the junk training.dat file
//  code is adapted from Mnehy Thunderbird Extension

Components.utils.import("resource://gre/modules/Services.jsm");

function TrainingData() {

  // local constants

  const Cc = Components.classes;
  const Ci = Components.interfaces;
  const CC = Components.Constructor;
   
  // public methods
  
  this.read = read;
  
  // public variables
  
  this.mGoodTokens = 0;
  this.mJunkTokens = 0;
  this.mGoodMessages = 0;
  this.mJunkMessages = 0;
  this.mGoodCounts = new Object;
  this.mJunkCounts = new Object;
  
  // helper functions

  function getJunkStatFile() {
    var sBaseDir = Services.dirsvc.get("ProfD", Ci.nsIFile);
    var CFileByFile = new CC("@mozilla.org/file/local;1", "nsILocalFile", "initWithFile");
    var oFile = new CFileByFile(sBaseDir);
    oFile.append("training.dat");
    return oFile;
  }
  
  function getBinStream(oFile) {
  
    if (oFile && oFile.exists())
    { 
      var oUri = Services.io.newFileURI(oFile);
      // open stream (channel)
      var oStream = Services.io.newChannelFromURI(oUri).open();
      // buffer it
      var oBufStream = Cc["@mozilla.org/network/buffered-input-stream;1"].
        createInstance(Ci.nsIBufferedInputStream);
      oBufStream.init(oStream, oFile.fileSize);
      // read as binary
      var oBinStream = Cc["@mozilla.org/binaryinputstream;1"].
        createInstance(Ci.nsIBinaryInputStream);
      oBinStream.setInputStream(oBufStream);
      // return it
      return oBinStream;
    }
    return null;
  }
  
  // method specifications
  
  function read() {
    var file = getJunkStatFile();

    // does the file exist?
    do_check_true(file.exists());

    var fileStream = getBinStream(file);
    
    // check magic number
    var iMagicNumber = fileStream.read32();
    do_check_eq(iMagicNumber, 0xFEEDFACE);
    
    // get ham'n'spam numbers
    this.mGoodMessages = fileStream.read32();
    this.mJunkMessages = fileStream.read32();

    // Read good tokens
    this.mGoodTokens = fileStream.read32();
    var iRefCount, iTokenLen, sToken;
    for (var i = 0; i < this.mGoodTokens; ++i)
    { 
      iRefCount  = fileStream.read32();
      iTokenLen  = fileStream.read32();
      sToken     = fileStream.readBytes(iTokenLen);
      this.mGoodCounts[sToken] = iRefCount;
    }
    
    // we have no further good tokens, so read junk tokens
    this.mJunkTokens = fileStream.read32();
    for (i = 0; i < this.mJunkTokens; i++)
    { // read token data
      iRefCount  = fileStream.read32();
      iTokenLen  = fileStream.read32();
      sToken     = fileStream.readBytes(iTokenLen);
      this.mJunkCounts[sToken] = iRefCount;
    }
  }
}
