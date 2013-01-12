/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://calendar/modules/calItipUtils.jsm");

function calTransactionManager() {
    if (!this.transactionManager) {
        this.transactionManager =
            Components.classes["@mozilla.org/transactionmanager;1"]
                      .createInstance(Components.interfaces.nsITransactionManager);
    }
}

calTransactionManager.prototype = {
    // nsIClassInfo:
    getInterfaces: function getInterfaces(count) {
        const ifaces = [Components.interfaces.nsISupports,
                        Components.interfaces.nsIClassInfo,
                        Components.interfaces.calITransactionManager];
        count.value = ifaces.length;
        return ifaces;
    },
    classDescription: "Calendar Transaction Manager",
    contractID: "mozilla.org/calendar/transactionmanager;1",
    classID: Components.ID("{40a1ccf4-5f54-4815-b842-abf06f84dbfd}"),

    getHelperForLanguage: function getHelperForLanguage(language) {
        return null;
    },
    implementationLanguage: Components.interfaces.nsIProgrammingLanguage.JAVASCRIPT,
    flags: Components.interfaces.nsIClassInfo.SINGLETON,

    QueryInterface: function cTM_QueryInterface(aIID) {
        return cal.doQueryInterface(this, calTransactionManager.prototype, aIID, null, this);
    },

    transactionManager: null,

    createAndCommitTxn: function cTM_createAndCommitTxn(aAction,
                                                        aItem,
                                                        aCalendar,
                                                        aOldItem,
                                                        aListener) {
        var txn = new calTransaction(aAction,
                                     aItem,
                                     aCalendar,
                                     aOldItem,
                                     aListener);
        this.transactionManager.doTransaction(txn);
    },

    beginBatch: function cTM_beginBatch() {
        this.transactionManager.beginBatch(null);
    },

    endBatch: function cTM_endBatch() {
        this.transactionManager.endBatch(false);
    },

    checkWritable: function cTM_checkWritable(transaction) {
        if (transaction) {
            transaction = transaction.wrappedJSObject;
            if (transaction) {
                function checkItem(item) {
                    if (item) {
                        var calendar = item.calendar;
                        if (calendar && (!isCalendarWritable(calendar) || !userCanAddItemsToCalendar(calendar))) {
                            return false;
                        }
                    }
                    return true;
                }

                if (!checkItem(transaction.mItem) ||
                    !checkItem(transaction.mOldItem)) {
                    return false;
                }
            }
        }
        return true;
    },

    undo: function cTM_undo() {
        this.transactionManager.undoTransaction();
    },

    canUndo: function cTM_canUndo() {
        return ((this.transactionManager.numberOfUndoItems > 0) &&
                this.checkWritable(this.transactionManager.peekUndoStack()));
    },

    redo: function cTM_redo() {
        this.transactionManager.redoTransaction();
    },

    canRedo: function cTM_canRedo() {
        return ((this.transactionManager.numberOfRedoItems > 0) &&
                this.checkWritable(this.transactionManager.peekRedoStack()));
    }
};

function calTransaction(aAction, aItem, aCalendar, aOldItem, aListener) {
    this.wrappedJSObject = this;
    this.mAction = aAction;
    this.mItem = aItem;
    this.mCalendar = aCalendar;
    this.mOldItem = aOldItem;
    this.mListener = aListener;
}

calTransaction.prototype = {

    mAction: null,
    mCalendar: null,
    mItem: null,
    mOldItem: null,
    mOldCalendar: null,
    mListener: null,
    mIsDoTransaction: false,

    // nsIClassInfo:
    getInterfaces: function getInterfaces(count) {
        const ifaces = [Components.interfaces.nsISupports,
                        Components.interfaces.nsIClassInfo,
                        Components.interfaces.nsITransaction,
                        Components.interfaces.calIOperationListener];
        count.value = ifaces.length;
        return ifaces;
    },
    classDescription: "Calendar Transaction",
    contractID: "mozilla.org/calendar/transaction;1",
    classID: Components.ID("{fcb54c82-2fb9-42cb-bf44-1e197a55e520}"),

    getHelperForLanguage: function getHelperForLanguage(language) {
        return null;
    },
    implementationLanguage: Components.interfaces.nsIProgrammingLanguage.JAVASCRIPT,
    flags: 0,

    QueryInterface: function cTM_QueryInterface(aIID) {
        return cal.doQueryInterface(this, calTransaction.prototype, aIID, null, this);
    },

    onOperationComplete: function cT_onOperationComplete(aCalendar,
                                                         aStatus,
                                                         aOperationType,
                                                         aId,
                                                         aDetail) {
        if (Components.isSuccessCode(aStatus)) {

            cal.itip.checkAndSend(aOperationType,
                                  aDetail,
                                  this.mIsDoTransaction ? this.mOldItem : this.mItem);

            if (aOperationType == Components.interfaces.calIOperationListener.ADD ||
                aOperationType == Components.interfaces.calIOperationListener.MODIFY) {
                if (this.mIsDoTransaction) {
                    this.mItem = aDetail;
                } else {
                    this.mOldItem = aDetail;
                }
            }
        }
        if (this.mListener) {
            this.mListener.onOperationComplete(aCalendar,
                                               aStatus,
                                               aOperationType,
                                               aId,
                                               aDetail);
        }
    },

    onGetResult: function cT_onGetResult(aCalendar,
                                         aStatus,
                                         aItemType,
                                         aDetail,
                                         aCount,
                                         aItems) {
        if (this.mListener) {
            this.mListener.onGetResult(aCalendar,
                                       aStatus,
                                       aItemType,
                                       aDetail,
                                       aCount,
                                       aItems);
        }
    },

    doTransaction: function cT_doTransaction() {
        this.mIsDoTransaction = true;
        switch (this.mAction) {
            case 'add':
                this.mCalendar.addItem(this.mItem, this);
                break;
            case 'modify':
                if (this.mItem.calendar.id != this.mOldItem.calendar.id) {
                    let self = this;
                    let addListener = {
                        onOperationComplete: function cT_onOperationComplete(aCalendar,
                                                                             aStatus,
                                                                             aOperationType,
                                                                             aId,
                                                                             aDetail) {
                            self.onOperationComplete.apply(self, arguments);
                            if (Components.isSuccessCode(aStatus)) {
                                self.mOldItem.calendar.deleteItem(self.mOldItem, self);
                            }
                        }
                    };

                    this.mOldCalendar = this.mOldItem.calendar;
                    this.mCalendar.addItem(this.mItem, addListener);
                } else {
                    this.mCalendar.modifyItem(cal.itip.prepareSequence(this.mItem, this.mOldItem),
                                              this.mOldItem,
                                              this);
                }
                break;
            case 'delete':
                this.mCalendar.deleteItem(this.mItem, this);
                break;
            default:
                throw new Components.Exception("Invalid action specified",
                                               Components.results.NS_ERROR_ILLEGAL_VALUE);
                break;
        }
    },

    undoTransaction: function cT_undoTransaction() {
        this.mIsDoTransaction = false;
        switch (this.mAction) {
            case 'add':
                this.mCalendar.deleteItem(this.mItem, this);
                break;
            case 'modify':
                if (this.mOldItem.calendar.id != this.mItem.calendar.id) {
                    this.mCalendar.deleteItem(this.mItem, this);
                    this.mOldCalendar.addItem(this.mOldItem, this);
                } else {
                    this.mCalendar.modifyItem(cal.itip.prepareSequence(this.mOldItem, this.mItem),
                                              this.mItem, this);
                }
                break;
            case 'delete':
                this.mCalendar.addItem(this.mItem, this);
                break;
            default:
                throw new Components.Exception("Invalid action specified",
                                               Components.results.NS_ERROR_ILLEGAL_VALUE);
                break;
        }
    },

    redoTransaction: function cT_redoTransaction() {
        this.doTransaction();
    },

    isTransient: false,

    merge: function cT_merge(aTransaction) {
        // No support for merging
        return false;
    }
};
