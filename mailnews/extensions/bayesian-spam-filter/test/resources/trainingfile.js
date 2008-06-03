/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is mozilla.org code
 *
 * The Initial Developer of the Original Code is
 * Kent James <kent@caspia.com>
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

// service class to manipulate the junk training.dat file
//  code is adapted from Mnehy Thunderbird Extension

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
    var nsIProperties = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties);
    var sBaseDir = nsIProperties.get("ProfD", Ci.nsIFile);
    var CFileByFile = new CC("@mozilla.org/file/local;1", "nsILocalFile", "initWithFile");
    var oFile = new CFileByFile(sBaseDir);
    oFile.append("training.dat");
    return oFile;
  }
  
  function getBinStream(oFile) {
  
    var nsIIOService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);

    if (oFile && oFile.exists())
    { 
      var oUri = nsIIOService.newFileURI(oFile);
      // open stream (channel)
      var oStream    = nsIIOService.newChannelFromURI(oUri).open();
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
