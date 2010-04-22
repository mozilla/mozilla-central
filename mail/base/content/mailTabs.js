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
 * The Original Code is Mozilla Communicator client code, released
 * March 31, 1998.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 1998-1999
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   timeless
 *   slucy@objectivesw.co.uk
 *   Håkan Waara <hwaara@chello.se>
 *   Jan Varga <varga@nixcorp.com>
 *   Seth Spitzer <sspitzer@netscape.com>
 *   David Bienvenu <bienvenu@nventure.com>
 *   Karsten Düsterloh <mnyromyr@tprac.de>
 *   Christopher Thomas <cst@yecc.com>
 *   Jeremy Morton <bugzilla@game-point.net>
 *   Andrew Sutherland <asutherland@asutherland.org>
 *   Dan Mosedale <dmose@mozilla.org>
 *   Siddharth Agarwal <sid.bugzilla@gmail.com>
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

Components.utils.import("resource:///modules/MsgHdrSyntheticView.js");
Components.utils.import("resource:///modules/errUtils.js");

/**
 * Displays message "folder"s, mail "message"s, and "glodaList" results.  The
 *  commonality is that they all use the "mailContent" panel's folder tree,
 *  thread tree, and message pane objects.  This happens for historical reasons,
 *  likely involving the fact that prior to the introduction of this
 *  abstraction, everything was always stored in global objects.  For the 3.0
 *  release cycle we considered avoiding this 'multiplexed' style of operation
 *  but decided against moving to making each tab be indepdendent because of
 *  presumed complexity.
 *
 * The tab info objects (as tabmail's currentTabInfo/tabInfo fields contain)
 *  have the following attributes specific to our implementation:
 *
 * @property {string} uriToOpen
 * @property {nsIMsgDBView} dbView The database view to use with the thread tree
 *     when this tab is displayed.  The value will be assigned to the global
 *     gDBView in the process.
 * @property {nsIMessenger} messenger Used to preserve "messenger" global value.
 *     The messenger object is the keeper of the 'undo' state and navigation
 *     history, which is why we do this.
 *
 * @property {nsIMsgDBHdr} hdr In "message" mode, the header of the message
 *     being displayed.
 * @property {nsIMsgSearchSession} searchSession Used to preserve gSearchSession
 *     global value.
 *
 */
let mailTabType = {
  name: "mail",
  panelId: "mailContent",
  modes: {
    /**
     * The folder view displays the contents of an nsIMsgDBFolder, with the
     *  folder pane (potentially), thread pane (always), and message pane
     *  (potentially) displayed.
     *
     * The actual nsMsgDBView can be any of the following types of things:
     *  - A single folder.
     *    - A quicksearch on a single folder.
     *  - A virtual folder potentially containing messages from multiple
     *    folders. (eShowVirtualFolderResults)
     */
    folder: {
      isDefault: true,
      type: "folder",
      /// The set of panes that are legal to be displayed in this mode
      legalPanes: {
        folder: true,
        thread: true,
        message: true
      },
      /// The set of panes that are legal when we are showing account central
      accountCentralLegalPanes: {
        folder: true,
        accountCentral: true,
        message: false
      },
      openFirstTab: function(aTab) {
        this.openTab(aTab, true, new MessagePaneDisplayWidget(), true);
        // persistence and restoreTab wants to know if we are the magic first tab
        aTab.firstTab = true;
        // Inherit the search mode from a window
        let windowToInheritFrom = null;
        if (window.opener &&
            (window.opener.document.documentElement.getAttribute("windowtype") ==
             "mail:3pane"))
          windowToInheritFrom = window.opener;
        else
          windowToInheritFrom = FindOther3PaneWindow();

        aTab.folderDisplay.makeActive();
      },
      /**
       * @param aArgs.folder The nsIMsgFolder to display.
       * @param [aArgs.msgHdr] Optional message header to display.
       * @param [aArgs.folderPaneVisible] Whether the folder pane should be
       *            visible. If this isn't specified, the current or first tab's
       *            current state is used.
       * @param [aArgs.messagePaneVisible] Whether the message pane should be
       *            visible. If this isn't specified, the current or first tab's
       *            current state is used.
       * @param [aArgs.forceSelectMessage] Whether we should consider dropping
       *            filters to select the message. This has no effect if
       *            aArgs.msgHdr isn't specified. Defaults to false.
       */
      openTab: function(aTab, aArgs) {
        // persistence and restoreTab wants to know if we are the magic first tab
        aTab.firstTab = false;

        // Get a tab that we can initialize our user preferences from.
        // (We don't want to assume that our immediate predecessor was a
        //  "folder" tab.)
        let modelTab = document.getElementById("tabmail")
                         .getTabInfoForCurrentOrFirstModeInstance(aTab.mode);

        // - figure out whether to show the folder pane
        let folderPaneShouldBeVisible;
        // explicitly told to us?
        if ("folderPaneVisible" in aArgs)
          folderPaneShouldBeVisible = aArgs.folderPaneVisible;
        // inherit from the previous tab (if we've got one)
        else if (modelTab)
          folderPaneShouldBeVisible = modelTab.folderDisplay.folderPaneVisible;
        // who doesn't love a folder pane?
        else
          folderPaneShouldBeVisible = true;

        // - figure out whether to show the message pane
        let messagePaneShouldBeVisible;
        // explicitly told to us?
        if ("messagePaneVisible" in aArgs)
          messagePaneShouldBeVisible = aArgs.messagePaneVisible;
        // inherit from the previous tab (if we've got one)
        else if (modelTab)
          messagePaneShouldBeVisible = modelTab.messageDisplay.visible;
        // who does't love a message pane?
        else
          messagePaneShouldBeVisible = true;

        this.openTab(aTab, false,
                     new MessagePaneDisplayWidget(messagePaneShouldBeVisible),
                     folderPaneShouldBeVisible);

        let background = ("background" in aArgs) && aArgs.background;
        let msgHdr = ("msgHdr" in aArgs) && aArgs.msgHdr;
        let forceSelectMessage = ("forceSelectMessage" in aArgs) &&
                                     aArgs.forceSelectMessage;

        if (msgHdr)
          // Tell the folder display that a selectMessage is coming up, so that
          // we don't generate double message loads
          aTab.folderDisplay.selectMessageComingUp();

        if (!background) {
          // Activate the folder display
          aTab.folderDisplay.makeActive();

          // HACK: Since we've switched away from the tab, we need to bring
          // back the real selection before selecting the folder, so do that
          RestoreSelectionWithoutContentLoad(document.getElementById(
                                                 "folderTree"));
        }

        aTab.folderDisplay.show(aArgs.folder);
        if (msgHdr)
          aTab.folderDisplay.selectMessage(msgHdr, forceSelectMessage);

        if (!background) {
          // This only makes sure the selection in the folder pane is correct --
          // the actual displaying is handled by the show() call above. This
          // also means that we don't have to bother about making
          // gFolderTreeView believe that a selection change has happened.
          gFolderTreeView.selectFolder(aArgs.folder);
        }

        aTab.mode.onTitleChanged.call(this, aTab, aTab.tabNode);
      },
      persistTab: function(aTab) {
        try {
          if (!aTab.folderDisplay.displayedFolder)
            return null;
          let retval = {
            folderURI: aTab.folderDisplay.displayedFolder.URI,
            // if the folder pane is active, then we need to look at
            // whether the box is collapsed
            folderPaneVisible: aTab.folderDisplay.folderPaneVisible,
            messagePaneVisible: aTab.messageDisplay.visible,
            firstTab: aTab.firstTab
          };
          return retval;
        } catch (e) {
          logException(e);
          return null;
        }
      },
      restoreTab: function(aTabmail, aPersistedState) {
      try {
        let rdfService = Components.classes['@mozilla.org/rdf/rdf-service;1']
                           .getService(Components.interfaces.nsIRDFService);
        let folder = rdfService.GetResource(aPersistedState.folderURI)
                       .QueryInterface(Components.interfaces.nsIMsgFolder);
        // if the folder no longer exists, we can't restore the tab
        if (folder) {
          let folderPaneVisible = ("folderPaneVisible" in aPersistedState) ?
                                    aPersistedState.folderPaneVisible :
                                    true;
          // If we are talking about the first tab, it already exists and we
          //  should poke it.  We are assuming it is the currently displayed
          //  tab because we are privvy to the implementation details and know
          //  it to be true.
          if (aPersistedState.firstTab) {
            // Poke the folder pane box and splitter
            document.getElementById("folderPaneBox").collapsed =
              !folderPaneVisible;
            document.getElementById("folderpane_splitter").setAttribute("state",
              (folderPaneVisible ? "open" : "collapsed"));

            if (gMessageDisplay.visible != aPersistedState.messagePaneVisible) {
              MsgToggleMessagePane();
              // For reasons that are not immediately obvious, sometimes the
              //  message display is not active at this time.  In that case, we
              //  need to explicitly set the _visible value because otherwise it
              //  misses out on the toggle event.
              if (!gMessageDisplay._active)
                gMessageDisplay._visible = aPersistedState.messagePaneVisible;
            }

            if (!("dontRestoreFirstTab" in aPersistedState &&
                  aPersistedState.dontRestoreFirstTab))
              gFolderTreeView.selectFolder(folder);

            // We need to manually trigger the tab monitor restore trigger
            // for this tab.  In theory this should be in tabmail, but the
            // special nature of the first tab will last exactly long as this
            // implementation right here so it does not particularly matter
            // and is a bit more honest, if ugly, to do it here.
            let tabmail = document.getElementById("tabmail");
            let restoreState = tabmail._restoringTabState;
            let tab = tabmail.tabInfo[0];
            for each (let [, tabMonitor] in Iterator(tabmail.tabMonitors)) {
              if (("onTabRestored" in tabMonitor) &&
                  (tabMonitor.monitorName in restoreState.ext)) {
                tabMonitor.onTabRestored(tab,
                                         restoreState.ext[tabMonitor.monitorName],
                                         true);
              }
            }
          }
          else {
            let tabArgs = {
              folder: folder,
              folderPaneVisible: folderPaneVisible,
              messagePaneVisible: aPersistedState.messagePaneVisible,
              background: true
            };
            aTabmail.openTab("folder", tabArgs);
          }
        }
      } catch (e) {
        logException(e);
      }
      },
      onTitleChanged: function(aTab, aTabNode) {
        if (!aTab.folderDisplay || !aTab.folderDisplay.displayedFolder) {
          // Don't show "undefined" as title when there is no account.
          aTab.title = " ";
          return;
        }
        // The user may have changed folders, triggering our onTitleChanged
        // callback.
        let folder = aTab.folderDisplay.displayedFolder;
        aTab.title = folder.prettyName;
        if (!folder.isServer && this._getNumberOfRealAccounts() > 1)
          aTab.title += " - " + folder.server.prettyName;

        // Update the appropriate attributes on the tab
        aTabNode.setAttribute('SpecialFolder',
                              getSpecialFolderString(folder));
        aTabNode.setAttribute('ServerType', folder.server.type);
        aTabNode.setAttribute('IsServer', folder.isServer);
        aTabNode.setAttribute('IsSecure', folder.server.isSecure);
      },
      getBrowser: function(aTab) {
        // If we are currently a thread summary, we want to select the multi
        // message browser rather than the message pane.
        return gMessageDisplay.singleMessageDisplay ?
               document.getElementById("messagepane") :
               document.getElementById("multimessage");
      }
    },
    /**
     * The message view displays a single message.  In this view, the folder
     *  pane and thread pane are forced hidden and only the message pane is
     *  displayed.
     */
    message: {
      type: "message",
      /// The set of panes that are legal to be displayed in this mode
      legalPanes: {
        folder: false,
        thread: false,
        message: true
      },
      openTab: function(aTab, aArgs) {
        this.openTab(aTab, false, new MessageTabDisplayWidget(), false);

        let viewWrapperToClone = ("viewWrapperToClone" in aArgs) &&
                                 aArgs.viewWrapperToClone;
        let background = ("background" in aArgs) && aArgs.background;

        if (viewWrapperToClone) {
          aTab.folderDisplay.cloneView(viewWrapperToClone);
        }
        else {
          // Create a synthetic message view for the header
          let synView = new MsgHdrSyntheticView(aArgs.msgHdr);
          aTab.folderDisplay.show(synView);
        }

        // folderDisplay.show is going to try to set the title itself, but we
        // wouldn't have selected a message at that point, so set the title
        // here
        aTab.mode.onTitleChanged.call(this, aTab, null, aArgs.msgHdr);

        aTab.folderDisplay.selectMessage(aArgs.msgHdr);

        // Once we're brought into the foreground, the message pane should
        // get focus
        aTab._focusedElement = document.getElementById("messagepane");

        // we only want to make it active after setting up the view and the message
        //  to avoid generating bogus summarization events.
        if (!background) {
          aTab.folderDisplay.makeActive();
          this.restoreFocus(aTab);
        }
        else {
          // We don't want to null out the real tree box view, as that
          // corresponds to the _current_ tab, not the new one
          aTab.folderDisplay.hookUpFakeTreeBox(false);
        }
      },
      persistTab: function(aTab) {
        let msgHdr = aTab.folderDisplay.selectedMessage;
        return {
          messageURI: msgHdr.folder.getUriForMsg(msgHdr)
        };
      },
      restoreTab: function(aTabmail, aPersistedState) {
        let msgHdr = messenger.msgHdrFromURI(aPersistedState.messageURI);
        // if the message no longer exists, we can't restore the tab
        if (msgHdr)
          aTabmail.openTab("message", {msgHdr: msgHdr, background: true});
      },
      onTitleChanged: function(aTab, aTabNode, aMsgHdr) {
        // Try and figure out the selected message if one was not provided.
        // It is possible that the folder has yet to load, so it may still be
        //  null.
        if (aMsgHdr == null)
          aMsgHdr = aTab.folderDisplay.selectedMessage;
        aTab.title = "";
        if (aMsgHdr == null)
          return;
        if (aMsgHdr.flags & Components.interfaces.nsMsgMessageFlags.HasRe)
          aTab.title = "Re: ";
        if (aMsgHdr.mime2DecodedSubject)
          aTab.title += aMsgHdr.mime2DecodedSubject;

        aTab.title += " - " + aMsgHdr.folder.prettyName;
        if (this._getNumberOfRealAccounts() > 1)
          aTab.title += " - " + aMsgHdr.folder.server.prettyName;
      },
      getBrowser: function(aTab) {
        // Message tabs always use the messagepane browser.
        return document.getElementById("messagepane");
      }
    },
    /**
     * The glodaList view displays a gloda-backed nsMsgDBView with only the
     *  thread pane and (potentially) the message pane displayed; the folder
     *  pane is forced hidden.
     */
    glodaList: {
      type: "glodaSearch",
      /// The set of panes that are legal to be displayed in this mode
      legalPanes: {
        folder: false,
        thread: true,
        message: true,
      },
      /**
       * The default set of columns to show.  This really should just be for
       *  boot-strapping and should be persisted after that...
       */
      desiredColumnStates: {
        threadCol: {
          visible: true,
        },
        flaggedCol: {
          visible: true,
        },
        subjectCol: {
          visible: true,
        },
        senderCol: {
          visible: true,
        },
        dateCol: {
          visible: true,
        },
      },
      /**
       * Open a new folder-display-style tab showing the contents of a gloda
       *  query/collection.  You must pass one of 'query'/'collection'/
       *  'conversation'
       *
       * @param {GlodaQuery} [aArgs.query] An un-triggered gloda query to use.
       *     Alternatively, if you already have a collection, you can pass that
       *     instead as 'collection'.
       * @param {GlodaCollection} [aArgs.collection] A gloda collection to
       *     display.
       * @param {GlodaConversation} [aArgs.conversation] A conversation whose
       *     messages you want to display.
       * @param {GlodaMessage} [aArgs.message] The message to select in the
       *     conversation, if provided.
       * @param aArgs.title The title to give to the tab.  If this is not user
       *     content (a search string, a message subject, etc.), make sure you
       *     are using a localized string.
       *
       * XXX This needs to handle opening in the background
       */
      openTab: function(aTab, aArgs) {
        aTab.glodaSynView = new GlodaSyntheticView(aArgs);
        aTab.title = aArgs.title;

        this.openTab(aTab, false, new MessagePaneDisplayWidget(), false);
        aTab.folderDisplay.show(aTab.glodaSynView);
        // XXX persist column states in preferences or session store or other
        aTab.folderDisplay.setColumnStates(aTab.mode.desiredColumnStates);
        aTab.folderDisplay.view.showThreaded = true;

        let background = ("background" in aArgs) && aArgs.background;
        if (!background)
          aTab.folderDisplay.makeActive();
        if ("message" in aArgs) {
          let hdr = aArgs.message.folderMessage;
          if (hdr)
            aTab.folderDisplay.selectMessage(hdr);
        }
      },
      getBrowser: function(aTab) {
        // If we are currently a thread summary, we want to select the multi
        // message browser rather than the message pane.
        return gMessageDisplay.singleMessageDisplay ?
               document.getElementById("messagepane") :
               document.getElementById("multimessage");
      }
    },
  },

  _getNumberOfRealAccounts : function() {
    let mgr = Components.classes["@mozilla.org/messenger/account-manager;1"]
                        .getService(Components.interfaces.nsIMsgAccountManager);
    let accountCount = mgr.accounts.Count();
    // If we have an account, we also always have a "Local Folders" account.
    return accountCount > 0 ? (accountCount - 1) : 0;
  },

  /**
   * Common tab opening code shared by the various tab modes.
   */
  openTab: function(aTab, aIsFirstTab, aMessageDisplay, aFolderPaneVisible) {
    // Set the messagepane as the primary browser for content.
    document.getElementById("messagepane").setAttribute("type",
                                                        "content-primary");

    aTab.messageDisplay = aMessageDisplay;
    aTab.folderDisplay = new FolderDisplayWidget(aTab, aTab.messageDisplay);
    aTab.folderDisplay.msgWindow = msgWindow;
    aTab.folderDisplay.tree = document.getElementById("threadTree");
    aTab.folderDisplay.treeBox = aTab.folderDisplay.tree.boxObject.QueryInterface(
                                   Components.interfaces.nsITreeBoxObject);
    aTab.folderDisplay.folderPaneVisible = aFolderPaneVisible;

    if (aIsFirstTab) {
      aTab.folderDisplay.messenger = messenger;
    }
    else {
      // Each tab gets its own messenger instance; this provides each tab with
      // its own undo/redo stack and back/forward navigation history.
      // If this is a foreground tab, folderDisplay.makeActive() is going to
      // set it as the global messenger, so there's no need to do it here
      let tabMessenger = Components.classes["@mozilla.org/messenger;1"]
                                   .createInstance(Components.interfaces.nsIMessenger);
      tabMessenger.setWindow(window, msgWindow);
      aTab.folderDisplay.messenger = tabMessenger;
    }
  },

  closeTab: function(aTab) {
    aTab.folderDisplay.close();
  },

  /**
   * Save off the tab's currently focused element or window.
   * - If the message pane or summary is currently focused, save the
   *   corresponding browser element as the focused element.
   * - If the thread tree or folder tree is focused, save that as the focused
   *   element.
   */
  saveFocus: function mailTabType_saveFocus(aTab) {
    let focusedWindow = document.commandDispatcher.focusedWindow.top;

    let messagepane = document.getElementById("messagepane");
    let multimessage = document.getElementById("multimessage");
    if (focusedWindow == messagepane.contentWindow) {
      aTab._focusedElement = messagepane;
    }
    else if (focusedWindow == multimessage.contentWindow) {
      aTab._focusedElement = multimessage;
    }
    else {
      // Look for children as well. This logic is copied from the mail 3pane
      // version of WhichPaneHasFocus().
      let focusedElement = document.commandDispatcher.focusedElement;
      let threadTree = document.getElementById("threadTree");
      let folderTree = document.getElementById("folderTree");
      while (focusedElement && focusedElement != threadTree &&
             focusedElement != folderTree)
        focusedElement = focusedElement.parentNode;

      // If we still have focusedElement at this point, it's either the thread
      // tree or the folder tree, so we want to persist it.
      aTab._focusedElement = focusedElement;
    }
  },

  /**
   * Restore the tab's focused element or window.
   */
  restoreFocus: function mailTabType_restoreFocus(aTab) {
    // There seem to be issues with opening multiple messages at once, so allow
    // things to stabilize a bit before proceeding
    let reallyRestoreFocus = function mailTabType_reallyRestoreFocus(aTab) {
      if ("_focusedElement" in aTab && aTab._focusedElement)
        aTab._focusedElement.focus();
      aTab._focusedElement = null;
    };

    window.setTimeout(reallyRestoreFocus, 0, aTab);
  },

  saveTabState: function(aTab) {
    // Now let other tabs have a primary browser if they want.
    document.getElementById("messagepane").setAttribute("type",
                                                        "content-targetable");

    this.saveFocus(aTab);
    aTab.folderDisplay.makeInactive();
  },

  /**
   * Some panes simply are illegal in certain views, and some panes are legal
   *  but the user may have collapsed/hidden them.  If that was not enough, we
   *  have three different layouts that are possible, each of which requires a
   *  slightly different DOM configuration, and accordingly for us to poke at
   *  different DOM nodes.  Things are made somewhat simpler by our decision
   *  that all tabs share the same layout.
   * This method takes the legal states and current display states and attempts
   *  to apply the appropriate logic to make it all work out.  This method is
   *  not in charge of figuring out or preserving display states.
   *
   * A brief primer on splitters and friends:
   * - A collapsed splitter is not visible (and otherwise it is visible).
   * - A collapsed node is not visible (and otherwise it is visible).
   * - A splitter whose "state" is "collapsed" collapses the widget implied by
   *    the value of the "collapse" attribute.  The splitter itself will be
   *    visible unless "collapsed".
   *
   * @param aLegalStates A dictionary where each key and value indicates whether
   *     the pane in question (key) is legal to be displayed in this mode.  If
   *     the value is true, then the pane is legal.  Omitted pane keys imply
   *     that the pane is illegal.  Keys are:
   *     - folder: The folder (tree) pane.
   *     - thread: The thread pane.
   *     - accountCentral: While it's in a deck with the thread pane, this
   *        is distinct from the thread pane because some other things depend
   *        on whether it's actually the thread pane we are showing.
   *     - message: The message pane.  Required/assumed to be true for now.
   * @param aVisibleStates A dictionary where each value indicates whether the
   *     pane should be 'visible' (not collapsed).  Only panes that are governed
   *     by splitters are options here.  Keys are:
   *     - folder: The folder (tree) pane.
   *     - message: The message pane.
   */
  _setPaneStates: function mailTabType_setPaneStates(aLegalStates,
                                                     aVisibleStates) {
    // The display deck hosts both the thread pane and account central.
    let displayDeckLegal = aLegalStates.thread ||
                           aLegalStates.accountCentral;

    let layout = pref.getIntPref("mail.pane_config.dynamic");
    if (layout == kWidePaneConfig)
    {
      // in the "wide" configuration, the #messengerBox is left holding the
      //  folder pane and thread pane, and the message pane has migrated to be
      //  its sibling (under #mailContent).
      // Accordingly, if both the folder and thread panes are illegal, we
      //  want to collapse the #messengerBox and make sure the #messagepanebox
      //  fills up the screen.  (For example, when in "message" mode.)
      let collapseMessengerBox = !aLegalStates.folder && !displayDeckLegal;
      document.getElementById("messengerBox").collapsed = collapseMessengerBox;
      if (collapseMessengerBox)
        document.getElementById("messagepanebox").flex = 1;
    }

    // -- folder pane
    // collapse the splitter when not legal
    document.getElementById("folderpane_splitter").collapsed =
      !aLegalStates.folder;
    // collapse the folder pane when not visible
    document.getElementById("folderPaneBox").collapsed =
     !aLegalStates.folder || !aVisibleStates.folder;
    // let the splitter know as well
    document.getElementById("folderpane_splitter").setAttribute("state",
     (!aLegalStates.folder || !aVisibleStates.folder) ? "collapsed" : "open");
    try {
      // The folder-location-toolbar should be hidden if the folder
      // pane is illegal. Otherwise we shouldn't touch it
      document.getElementById("folder-location-container").collapsed =
        !aLegalStates.folder;
    } catch (ex) {}

    // -- display deck (thread pane / account central)
    // in a vertical view, the threadContentArea sits in the #threadPaneBox
    //  next to the message pane and its splitter.
    if (layout == kVerticalMailLayout)
      document.getElementById("threadContentArea").collapsed =
        !displayDeckLegal;
    // whereas in the default view, the displayDeck is the one next to the
    //  message pane and its splitter
    else
      document.getElementById("displayDeck").collapsed =
        !displayDeckLegal;

    // -- thread pane
    // the threadpane-splitter collapses the message pane (arguably a misnomer),
    //  but it only needs to exist when the thread-pane is legal
    document.getElementById("threadpane-splitter").collapsed =
      !aLegalStates.thread;
    if (aLegalStates.thread && aLegalStates.message)
      document.getElementById("threadpane-splitter").setAttribute("state",
        aVisibleStates.message ? "open" : "collapsed");

    // Some things do not make sense if the thread pane is not legal.
    // (This is likely an example of something that should be using the command
    //  mechanism to update the UI elements as to the state of what the user
    //  is looking at, rather than home-brewing it in here.)
    try {
      // you can't quick-search if you don't have a collection of messages
      document.getElementById("search-container").collapsed =
        !aLegalStates.thread;
    } catch (ex) {}
    try {
      // views only work on the thread pane; no thread pane, no views
      document.getElementById("mailviews-container").collapsed =
        !aLegalStates.thread;
    } catch (ex) {}

    // -- thread pane status bar helpers
    document.getElementById("unreadMessageCount").hidden = !aLegalStates.thread;
    document.getElementById("totalMessageCount").hidden = !aLegalStates.thread;

    // -- message pane
    document.getElementById("messagepanebox").collapsed =
      !aLegalStates.message || !aVisibleStates.message;

    // we are responsible for updating the keybinding; view_init takes care of
    //  updating the menu item (on demand)
    let messagePaneToggleKey = document.getElementById("key_toggleMessagePane");
    if (aLegalStates.thread)
      messagePaneToggleKey.removeAttribute("disabled");
    else
      messagePaneToggleKey.setAttribute("disabled", "true");
  },

  showTab: function(aTab) {
    // Set the messagepane as the primary browser for content.
    document.getElementById("messagepane").setAttribute("type",
                                                        "content-primary");

    aTab.folderDisplay.makeActive();

    // - restore folder pane/tree selection
    if (aTab.folderDisplay.displayedFolder) {
      // but don't generate any events while doing so!
      gFolderTreeView.selection.selectEventsSuppressed = true;
      try {
        gFolderTreeView.selectFolder(aTab.folderDisplay.displayedFolder);
      }
      finally {
        gIgnoreSyntheticFolderPaneSelectionChange = true;
        gFolderTreeView.selection.selectEventsSuppressed = false;
      }
    }

    // restore focus
    this.restoreFocus(aTab);
  },

  // nsIController implementation

  supportsCommand: function mailTabType_supportsCommand(aCommand, aTab) {
    switch (aCommand) {
      case "cmd_viewClassicMailLayout":
      case "cmd_viewWideMailLayout":
      case "cmd_viewVerticalMailLayout":
      case "cmd_toggleMessagePane":
        return true;

      default:
        return DefaultController.supportsCommand(aCommand);
    }
  },

  // We only depend on what's illegal
  isCommandEnabled: function mailTabType_isCommandEnabled(aCommand, aTab) {
    switch (aCommand) {
      case "cmd_viewClassicMailLayout":
      case "cmd_viewWideMailLayout":
      case "cmd_viewVerticalMailLayout":
      case "cmd_toggleMessagePane":
        // If the thread pane is illegal, these are all disabled
        if (!aTab.mode.legalPanes.thread)
          return false;
        // else fall through

      default:
        return DefaultController.isCommandEnabled(aCommand);
    }
  },

  doCommand: function mailTabType_doCommand(aCommand, aTab) {
    if (!this.isCommandEnabled(aCommand, aTab))
      return;

    // DefaultController knows how to handle this
    DefaultController.doCommand(aCommand, aTab);
  }
};
