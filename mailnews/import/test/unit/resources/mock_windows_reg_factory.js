function MockWindowsRegKey(registryData) {
  this._registryData = registryData;
}

MockWindowsRegKey.prototype = {
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIWindowsRegKey]),

  open: function(aRootKey, aRelPath, aMode) {
    if (!this._registryData[aRelPath])
      throw Cr.NS_ERROR_FAILURE;
    this._keyPath = aRelPath;
  },

  close: function() {
  },

  openChild: function(aRelPath, aMode) {
    if (!this._registryData[this._keyPath] ||
        !this._registryData[this._keyPath][aRelPath])
      throw Cr.NS_ERROR_FAILURE;

    child = new MockWindowsRegKey({});
    let newKeyPath = this._keyPath + "\\" + aRelPath;
    child._keyPath = newKeyPath;
    child._registryData[newKeyPath] =
      this._registryData[this._keyPath][aRelPath];
    return child;
  },

  get childCount() {
    return Object.keys(this._registryData[this._keyPath]).length;
  },

  getChildName: function(aIndex) {
    let keys = Object.keys(this._registryData[this._keyPath]);
    let keyAtIndex = keys[aIndex];
    if (!keyAtIndex)
      throw Cr.NS_ERROR_FAILURE;

    return keyAtIndex;
  },

  _readValue: function(aName) {
    if (!this._registryData[this._keyPath] ||
        !this._registryData[this._keyPath][aName])
      throw Cr.NS_ERROR_FAILURE;

    return this._registryData[this._keyPath][aName];
  },

  readIntValue: function(aName) {
    return this._readValue(aName);
  },

  readStringValue: function(aName) {
    return this._readValue(aName);
  }
};

function MockWindowsRegFactory(registryData) {
  this._registryData = registryData;
}

MockWindowsRegFactory.prototype = {
  createInstance: function(aOuter, aIid) {
    if (aOuter)
      do_throw(Cr.NS_ERROR_NO_AGGREGATION);

    let key = new MockWindowsRegKey(this._registryData);
    return key.QueryInterface(aIid);
  },
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIFactory])
};
