/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource:///modules/gloda/log4moz.js");

////////////////////////////////////////////////////////////////////////////////
//// Constants

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;

////////////////////////////////////////////////////////////////////////////////
//// Base class for nsActivityProcess and nsActivityEvent objects

function nsActivity()
{
  this._initLogging();
  this._listeners = [];
  this._subjects = [];
}

nsActivity.prototype = {

  id: -1,
  bindingName: "",
  iconClass: "",
  groupingStyle: Ci.nsIActivity.GROUPING_STYLE_BYCONTEXT,
  facet: "",
  displayText: "",
  initiator: null,
  contextType: "",
  context: "",
  contextObj: null,

  _initLogging: function () {
    this.log = Log4Moz.getConfiguredLogger("nsActivity");
  },

  addListener: function(aListener) {
    this._listeners.push(aListener);
  },

  removeListener: function(aListener) {
    for (let i = 0; i < this._listeners.length; i++) {
      if (this._listeners[i] == aListener) {
        this._listeners.splice(i, 1);
        break;
      }
    }
  },

  addSubject: function(aSubject) {
    this._subjects.push(aSubject);
  },

  getSubjects: function(aCount) {
    let list = [];
    for each (let [, value] in Iterator(this._subjects))
      list.push(value);

    aCount.value = list.length;
    return list;
  },
};

////////////////////////////////////////////////////////////////////////////////
//// nsActivityProcess class

function nsActivityProcess()
{
  nsActivity.call(this);
  this.bindingName = "activity-process";
  this.groupingStyle = Ci.nsIActivity.GROUPING_STYLE_BYCONTEXT;
}

nsActivityProcess.prototype = {
  __proto__: nsActivity.prototype,
  classID: Components.ID("B2C036A3-F7CE-401C-95EE-9C21505167FD"),

  //////////////////////////////////////////////////////////////////////////////
  //// nsIActivityProcess

  percentComplete: -1,
  lastStatusText: "",
  workUnitComplete: 0,
  totalWorkUnits: 0,
  startTime: Date.now(),
  _cancelHandler: null,
  _pauseHandler: null,
  _retryHandler: null,
  _state: Ci.nsIActivityProcess.STATE_INPROGRESS,

  init: function(aDisplayText, aInitiator) {
    this.displayText = aDisplayText;
    this.initiator = aInitiator;
  },

  get state() {
    return this._state;
  },

  set state(val) {
    if (val == this._state)
      return;

    // test validity of the new state
    //
    if (this._state == Ci.nsIActivityProcess.STATE_INPROGRESS &&
        !(val == Ci.nsIActivityProcess.STATE_COMPLETED ||
          val == Ci.nsIActivityProcess.STATE_CANCELED ||
          val == Ci.nsIActivityProcess.STATE_WAITINGFORRETRY ||
          val == Ci.nsIActivityProcess.STATE_WAITINGFORINPUT ||
          val == Ci.nsIActivityProcess.STATE_PAUSED)) {
      throw Cr.NS_ERROR_ILLEGAL_VALUE;
    }

    // we cannot change the state after the activity is completed,
    // or it is canceled.
    if (this._state == Ci.nsIActivityProcess.STATE_COMPLETED ||
        this._state == Ci.nsIActivityProcess.STATE_CANCELED)
      throw Cr.NS_ERROR_ILLEGAL_VALUE;

    if (this._state == Ci.nsIActivityProcess.STATE_PAUSED &&
       !(val == Ci.nsIActivityProcess.STATE_COMPLETED ||
         val == Ci.nsIActivityProcess.STATE_INPROGRESS ||
         val == Ci.nsIActivityProcess.STATE_WAITINGFORRETRY ||
         val == Ci.nsIActivityProcess.STATE_WAITINGFORINPUT ||
         val == Ci.nsIActivityProcess.STATE_CANCELED)) {
      throw Cr.NS_ERROR_ILLEGAL_VALUE;
    }

    if (this._state == Ci.nsIActivityProcess.STATE_WAITINGFORINPUT &&
       !(val == Ci.nsIActivityProcess.STATE_INPROGRESS ||
         val == Ci.nsIActivityProcess.STATE_CANCELED)) {
      throw Cr.NS_ERROR_ILLEGAL_VALUE;
    }

    if (this._state == Ci.nsIActivityProcess.STATE_WAITINGFORRETRY &&
       !(val == Ci.nsIActivityProcess.STATE_INPROGRESS ||
         val == Ci.nsIActivityProcess.STATE_CANCELED)) {
      throw Cr.NS_ERROR_ILLEGAL_VALUE;
    }

    let oldState = this._state;
    this._state = val;

    // let the listeners know about the change
    this.log.debug("Notifying onStateChanged listeners");
    for each (let [, value] in Iterator(this._listeners)) {
      try {
        value.onStateChanged(this, oldState);
      }
      catch(e) {
        this.log.error("Exception thrown by onStateChanged listener: "+ e);
      }
    }
  },

  setProgress: function(aStatusText, aWorkUnitsComplete, aTotalWorkUnits) {
    if (aTotalWorkUnits == 0) {
      this.percentComplete = -1;
      this.workUnitComplete = 0;
      this.totalWorkUnits = 0;
    }
    else {
      this.percentComplete = parseInt(100.0 * aWorkUnitsComplete / aTotalWorkUnits);
      this.workUnitComplete = aWorkUnitsComplete;
      this.totalWorkUnits = aTotalWorkUnits;
    }
    this.lastStatusText = aStatusText;

    // notify listeners
    for each (let [, value] in Iterator(this._listeners)) {
      try {
        value.onProgressChanged(this, aStatusText, aWorkUnitsComplete,
                                aTotalWorkUnits);
      }
      catch(e) {
        this.log.error("Exception thrown by onProgressChanged listener: " + e);
      }
    }
  },

  get cancelHandler() {
    return this._cancelHandler;
  },

  set cancelHandler(val) {
    this._cancelHandler = val;

    // let the listeners know about the change
    this.log.debug("Notifying onHandlerChanged listeners");
    for each (let [, value] in Iterator(this._listeners)) {
      try {
        value.onHandlerChanged(this);
      }
      catch(e) {
        this.log.error("Exception thrown by onHandlerChanged listener: " + e);
      }
    }
  },

  get pauseHandler() {
    return this._pauseHandler;
  },

  set pauseHandler(val) {
    this._pauseHandler = val;

    // let the listeners know about the change
    this.log.debug("Notifying onHandlerChanged listeners");
    for each (let [, value] in Iterator(this._listeners)) {
      value.onHandlerChanged(this);
    }
  },

  get retryHandler() {
    return this._retryHandler;
  },

  set retryHandler(val) {
    this._retryHandler = val;

    // let the listeners know about the change
    this.log.debug("Notifying onHandlerChanged listeners");
    for each (let [, value] in Iterator(this._listeners)) {
      value.onHandlerChanged(this);
    }
  },

  //////////////////////////////////////////////////////////////////////////////
  //// nsISupports

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIActivityProcess, Ci.nsIActivity])
};

///////////////////////////////////////////////////////////////////////////////
//// nsActivityEvent class

function nsActivityEvent()
{
  nsActivity.call(this);
  this.bindingName = "activity-event";
  this.groupingStyle = Ci.nsIActivity.GROUPING_STYLE_STANDALONE;
}

nsActivityEvent.prototype = {
  __proto__: nsActivity.prototype,
  classID: Components.ID("87AAEB20-89D9-4B95-9542-3BF72405CAB2"),

  //////////////////////////////////////////////////////////////////////////////
  //// nsIActivityEvent

  statusText: "",
  startTime: 0,
  completionTime: 0,
  _undoHandler: null,

  init: function(aDisplayText, aInitiator, aStatusText, aStartTime,
                 aCompletionTime) {
    this.displayText = aDisplayText;
    this.statusText = aStatusText;
    this.startTime = aStartTime;
    if (aCompletionTime)
      this.completionTime = aCompletionTime;
    else
      this.completionTime = Date.now()
    this.initiator = aInitiator;
    this._completionTime = aCompletionTime;
  },

  get undoHandler() {
    return this._undoHandler;
  },

  set undoHandler(val) {
    this._undoHandler = val;

    // let the listeners know about the change
    this.log.debug("Notifying onHandlerChanged listeners");
    for each (let [, value] in Iterator(this._listeners)) {
      value.onHandlerChanged(this);
    }
  },

  //////////////////////////////////////////////////////////////////////////////
  //// nsISupports

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIActivityEvent, Ci.nsIActivity])
};

///////////////////////////////////////////////////////////////////////////////
//// nsActivityWarning class

function nsActivityWarning()
{
  nsActivity.call(this);
  this.bindingName = "activity-warning";
  this.groupingStyle = Ci.nsIActivity.GROUPING_STYLE_BYCONTEXT;
}

nsActivityWarning.prototype = {
  __proto__: nsActivity.prototype,
  classID: Components.ID("968BAC9E-798B-4952-B384-86B21B8CC71E"),

  //////////////////////////////////////////////////////////////////////////////
  //// nsIActivityWarning
  
  recoveryTipText: "",
  _time: 0,
  _recoveryHandler: null,
  
  init: function(aWarningText, aInitiator, aRecoveryTipText) {
    this.displayText = aWarningText;
    this.initiator = aInitiator;
    this.recoveryTipText = aRecoveryTipText;
    this._time = Date.now();
  },

  get recoveryHandler() {
    return this._recoveryHandler;
  },

  set recoveryHandler(val) {
    this._recoveryHandler = val;

    // let the listeners know about the change
    this.log.debug("Notifying onHandlerChanged listeners");
    for each (let [, value] in Iterator(this._listeners)) {
      value.onHandlerChanged(this);
    }
  },

  get time() {
    return this._time;
  },

  //////////////////////////////////////////////////////////////////////////////
  //// nsISupports

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIActivityWarning, Ci.nsIActivity])
};

///////////////////////////////////////////////////////////////////////////////
//// Module

let components = [nsActivityProcess, nsActivityEvent, nsActivityWarning];
const NSGetFactory = XPCOMUtils.generateNSGetFactory(components);
