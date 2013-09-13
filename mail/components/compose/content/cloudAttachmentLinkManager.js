/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

var gCloudAttachmentLinkManager = {
  init: function() {
    this.cloudAttachments = [];

    let bucket = document.getElementById("attachmentBucket");
    bucket.addEventListener("attachment-uploaded", this, false);
    bucket.addEventListener("attachments-removed", this, false);
    bucket.addEventListener("attachments-converted", this, false);

    // If we're restoring a draft that has some attachments,
    // check to see if any of them are marked to be sent via
    // cloud, and if so, add them to our list.
    for (let i = 0; i < bucket.getRowCount(); ++i) {
      let attachment = bucket.getItemAtIndex(i).attachment;
      if (attachment && attachment.sendViaCloud)
        this.cloudAttachments.push(attachment);
    }

    gMsgCompose.RegisterStateListener(this);
  },

  uninit: function() {
    let bucket = document.getElementById("attachmentBucket");
    bucket.removeEventListener("attachment-uploaded", this, false);
    bucket.removeEventListener("attachments-removed", this, false);
    bucket.removeEventListener("attachments-converted", this, false);

    gMsgCompose.UnregisterStateListener(this);
  },

  NotifyComposeFieldsReady: function() {},

  NotifyComposeBodyReady: function() {
    // If we're doing an inline-forward, let's take all of the current
    // message text, and wrap it up into its own DIV.
    if (gComposeType != Components.interfaces.nsIMsgCompType.ForwardInline)
      return;

    let mailDoc = document.getElementById("content-frame").contentDocument;
    let mailBody = mailDoc.querySelector("body");
    let editor = GetCurrentEditor();
    let selection = editor.selection;

    let container = editor.createElementWithDefaults("div");
    container.setAttribute("class", "moz-forward-container");

    editor.enableUndo(false);

    if (mailBody.hasChildNodes()) {
      while (mailBody.childNodes.length > 0) {
        let removedChild = mailBody.removeChild(mailBody.firstChild);
        container.appendChild(removedChild);
      }
    }
    editor.insertLineBreak();
    selection.collapse(mailBody, 1);
    editor.insertElementAtSelection(container, false);
    editor.insertLineBreak();
    editor.beginningOfDocument();

    editor.enableUndo(true);
    editor.resetModificationCount();
  },
  ComposeProcessDone: function() {},
  SaveInFolderDone: function() {},

  handleEvent: function(event) {
    let mailDoc = document.getElementById("content-frame").contentDocument;

    if (event.type == "attachment-uploaded") {
      if (this.cloudAttachments.length == 0)
        this._insertHeader(mailDoc);

      let attachment = event.target.attachment;
      let provider = event.target.cloudProvider;
      this.cloudAttachments.push(attachment);
      this._insertItem(mailDoc, attachment, provider);
    }
    else if (event.type == "attachments-removed" ||
             event.type == "attachments-converted") {
      let items = [];
      let list = mailDoc.getElementById("cloudAttachmentList");
      if (list)
        items = list.getElementsByClassName("cloudAttachmentItem");

      for (let attachment in fixIterator(
           event.detail, Components.interfaces.nsIMsgAttachment)) {
        // Remove the attachment from the message body.
        if (list)
          for (let i = 0; i < items.length; i++)
            if (items[i].contentLocation == attachment.contentLocation)
              list.removeChild(items[i]);

        // Now, remove the attachment from our internal list.
        let index = this.cloudAttachments.indexOf(attachment);
        if (index != -1)
          this.cloudAttachments.splice(index, 1);
      }

      this._updateAttachmentCount(mailDoc);

      if (items.length == 0) {
        if (list)
          list.parentNode.removeChild(list);
        this._removeRoot(mailDoc);
      }
    }
  },

  /**
   * Removes the root node for an attachment list in an HTML email.
   *
   * @param aDocument the document to remove the root node from.
   */
  _removeRoot: function(aDocument) {
    let header = aDocument.getElementById("cloudAttachmentListRoot");
    if (header)
      header.parentNode.removeChild(header);
  },

  /**
   * Given some node, returns the textual HTML representation for the node
   * and its children.
   *
   * @param aDocument the document that the node is embedded in
   * @param aNode the node to get the textual representation from
   */
  _getHTMLRepresentation: function(aDocument, aNode) {
    let tmp = aDocument.createElement("p");
    tmp.appendChild(aNode);
    return tmp.innerHTML;
  },

  /**
   * Generates an appropriately styled link.
   *
   * @param aDocument the document to append the link to - doesn't actually
   *                  get appended, but is used to generate the anchor node.
   * @param aContent the textual content of the link
   * @param aHref the HREF attribute for the generated link
   */
  _generateLink: function(aDocument, aContent, aHref) {
    const LINK_COLOR = "#0F7EDB";
    let link = aDocument.createElement("a");
    link.href = aHref;
    link.textContent = aContent;
    link.style.cssText = "color: " + LINK_COLOR + " !important";
    return link;
  },

  _findInsertionPoint: function(aDocument) {
    let mailBody = aDocument.querySelector("body");
    let editor = GetCurrentEditor();
    let selection = editor.selection;

    let childNodes = mailBody.childNodes;
    let childToInsertAfter, childIndex;

    // First, search for any text nodes that are immediate children of
    // the body.  If we find any, we'll insert after those.
    for (childIndex = childNodes.length - 1; childIndex >= 0; childIndex--) {
      if (childNodes[childIndex].nodeType == Node.TEXT_NODE) {
        childToInsertAfter = childNodes[childIndex];
        break;
      }
    }

    if (childIndex != -1) {
      selection.collapse(childToInsertAfter,
                         childToInsertAfter.nodeValue ?
                         childToInsertAfter.nodeValue.length : 0);
      if (childToInsertAfter.nodeValue &&
          childToInsertAfter.nodeValue.length > 0)
        editor.insertLineBreak();
      editor.insertLineBreak();
      return;
    }

    // If there's a signature, let's get a hold of it now.
    let signature = mailBody.querySelector(".moz-signature");

    // Are we replying?
    let replyCitation = mailBody.querySelector(".moz-cite-prefix");
    if (replyCitation) {
      if (gCurrentIdentity && gCurrentIdentity.replyOnTop == 0) {
        // Replying below quote - we'll select the point right before
        // the signature.  If there's no signature, we'll just use the
        // last node.
        if (signature && signature.previousSibling)
          selection.collapse(mailBody,
                             Array.indexOf(childNodes,
                                           signature.previousSibling));
        else {
          selection.collapse(mailBody, childNodes.length - 1);
          editor.insertLineBreak();

          if (!gMsgCompose.composeHTML)
            editor.insertLineBreak();

          selection.collapse(mailBody, childNodes.length - 2);
        }
      } else {
        // Replying above quote
        if (replyCitation.previousSibling) {
          let nodeIndex = Array.indexOf(childNodes, replyCitation.previousSibling);
          if (nodeIndex <= 0) {
            editor.insertLineBreak();
            nodeIndex = 1;
          }
          selection.collapse(mailBody, nodeIndex);
        } else {
          editor.beginningOfDocument();
          editor.insertLineBreak();
        }
      }
      return;
    }

    // Are we forwarding?
    let forwardBody = mailBody.querySelector(".moz-forward-container");
    if (forwardBody) {
      if (forwardBody.previousSibling) {
        let nodeIndex = Array.indexOf(childNodes,
                                      forwardBody.previousSibling);
        if (nodeIndex <= 0) {
          editor.insertLineBreak();
          nodeIndex = 1;
        }
        // If we're forwarding, insert just before the forward body.
        selection.collapse(mailBody, nodeIndex);
      } else {
        // Just insert after a linebreak at the top.
        editor.beginningOfDocument();
        editor.insertLineBreak();
        selection.collapse(mailBody, 1);
      }
      return;
    }

    // If we haven't figured it out at this point, let's see if there's a
    // signature, and just insert before it.
    if (signature && signature.previousSibling) {
      let nodeIndex = Array.indexOf(childNodes, signature.previousSibling);
      if (nodeIndex <= 0) {
        editor.insertLineBreak();
        nodeIndex = 1;
      }
      selection.collapse(mailBody, nodeIndex);
      return;
    }

    // If we haven't figured it out at this point, let's just put it
    // at the bottom of the message body.  If the "bottom" is also the top,
    // then we'll insert a linebreak just above it.
    let nodeIndex = childNodes.length - 1;
    if (nodeIndex <= 0) {
      editor.insertLineBreak();
      nodeIndex = 1;
    }
    selection.collapse(mailBody, nodeIndex);
  },

  /**
   * Attempts to find any elements with an id in aIDs, and sets those elements
   * id attribute to the empty string, freeing up the ids for later use.
   *
   * @param aDocument the document to search for the elements.
   * @param aIDs an array of id strings.
   */
  _resetNodeIDs: function(aDocument, aIDs) {
    for each (let [, id] in Iterator(aIDs)) {
      let node = aDocument.getElementById(id);
      if (node)
        node.id = "";
    }
  },

  /**
   * Insert the header for the cloud attachment list, which we'll use to
   * as an insertion point for the individual cloud attachments.
   *
   * @param aDocument the document to insert the header into.
   */
  _insertHeader: function(aDocument) {
    // If there already exists a cloudAttachmentListRoot,
    // cloudAttachmentListHeader or cloudAttachmentList in the document,
    // strip them of their IDs so that we don't conflict with them.
    this._resetNodeIDs(aDocument, ["cloudAttachmentListRoot",
                                    "cloudAttachmentListHeader",
                                    "cloudAttachmentList"]);

    let brandBundle = Services.strings.createBundle("chrome://branding/locale/brand.properties");
    let editor = GetCurrentEditor();
    let selection = editor.selection;
    let originalAnchor = selection.anchorNode;
    let originalOffset = selection.anchorOffset;

    // Save off the selection ranges so we can restore them later.
    let ranges = [];
    for (let i = 0; i < selection.rangeCount; i++)
      ranges.push(selection.getRangeAt(i));

    this._findInsertionPoint(aDocument);

    if (gMsgCompose.composeHTML) {
      // It's really quite strange, but if we don't set
      // the innerHTML of each element to be non-empty, then
      // the nodes fail to be added to the compose window.
      let root = editor.createElementWithDefaults("div");
      root.id = "cloudAttachmentListRoot";
      root.style.padding = "15px";
      root.style.backgroundColor = "#D9EDFF";
      root.innerHTML = " ";

      let header = editor.createElementWithDefaults("div");
      header.id = "cloudAttachmentListHeader";
      header.style.marginBottom = "15px";
      header.innerHTML = " ";
      root.appendChild(header);

      let list = editor.createElementWithDefaults("div");
      list.id = "cloudAttachmentList";
      list.style.backgroundColor = "#FFFFFF";
      list.style.padding = "15px";
      list.display = "inline-block";
      list.innerHTML = " ";
      root.appendChild(list);

      let footer = editor.createElementWithDefaults("div");
      let appLinkUrl = Services.prefs
                               .getCharPref("mail.cloud_files.inserted_urls.footer.link");
      let appname = this._generateLink(aDocument,
                                       brandBundle.GetStringFromName("brandFullName"),
                                       appLinkUrl);

      let applink = this._getHTMLRepresentation(aDocument, appname);
      let footerMessage = getComposeBundle().getFormattedString("cloudAttachmentListFooter", [applink], 1);

      footer.innerHTML = footerMessage;
      footer.style.color = "#444444";
      footer.style.fontSize = "small";
      footer.style.marginTop = "15px";
      root.appendChild(footer);

      editor.insertElementAtSelection(root, false);
    }
    else {
      let root = editor.createElementWithDefaults("div");
      root.id = "cloudAttachmentListRoot";

      let header = editor.createElementWithDefaults("div");
      header.id = "cloudAttachmentListHeader";
      header.innerHTML = " ";
      root.appendChild(header);

      let list = editor.createElementWithDefaults("span");
      list.id = "cloudAttachmentList";
      root.appendChild(list);

      editor.insertElementAtSelection(root, false);
    }

    selection.collapse(originalAnchor, originalOffset);

    // Restore the selection ranges.
    for (let [,range] in Iterator(ranges))
      selection.addRange(range);
  },

  /**
   * Updates the count of how many attachments have been added
   * in HTML emails.
   *
   * @aDocument the document that contains the cloudAttachmentListHeader node.
   */
  _updateAttachmentCount: function(aDocument) {
    let header = aDocument.getElementById("cloudAttachmentListHeader");
    if (!header)
      return;

    let count = PluralForm.get(this.cloudAttachments.length,
                               getComposeBundle().getString("cloudAttachmentCountHeader"));

    header.textContent = count.replace("#1", this.cloudAttachments.length);
  },

  /**
   * Insert the information for a cloud attachment.
   *
   * @param aDocument the document to insert the item into
   * @param aAttachment the nsIMsgAttachment to insert
   * @param aProviderType the cloud storage provider
   */
  _insertItem: function(aDocument, aAttachment, aProvider) {
    let list = aDocument.getElementById("cloudAttachmentList");

    if (!list) {
      this._insertHeader(aDocument);
      list = aDocument.getElementById("cloudAttachmentList");
    }

    let node = aDocument.createElement("div");
    node.className = "cloudAttachmentItem";
    node.contentLocation = aAttachment.contentLocation;

    if (gMsgCompose.composeHTML) {
      node.style.border = "1px solid #CDCDCD";
      node.style.borderRadius = "5px";
      node.style.marginTop = "10px";
      node.style.marginBottom = "10px";
      node.style.padding = "15px";

      let paperclip = aDocument.createElement("img");
      paperclip.style.marginRight = "5px";
      paperclip.style.cssFloat = "left";
      paperclip.style.width = "24px";
      paperclip.style.height = "24px";
      paperclip.src = "chrome://messenger/content/cloudfile/attachment-24.png";
      node.appendChild(paperclip);

      let link = this._generateLink(aDocument, aAttachment.name,
                                    aAttachment.contentLocation);
      link.setAttribute("moz-do-not-send", "true");
      node.appendChild(link);

      let size = aDocument.createElement("span");
      size.textContent = "(" + gMessenger.formatFileSize(aAttachment.size)
                         + ")";
      size.style.marginLeft = "5px";
      size.style.fontSize = "small";
      size.style.color = "grey";
      node.appendChild(size);

      let providerIdentity = aDocument.createElement("span");
      providerIdentity.style.cssFloat = "right";

      if (aProvider.iconClass) {
        let providerIcon = aDocument.createElement("img");
        providerIcon.src = aProvider.iconClass;
        providerIcon.style.marginRight = "5px";
        providerIdentity.appendChild(providerIcon);
      }

      if (aProvider.serviceURL) {
        let providerLink = this._generateLink(aDocument, aProvider.displayName,
                                              aProvider.serviceURL);
        providerIdentity.appendChild(providerLink);
      } else {
        let providerName = aDocument.createElement("span");
        providerName.textContent = aProvider.displayName;
        providerIdentity.appendChild(providerName);
      }

      node.appendChild(providerIdentity);

      let downloadUrl = this._generateLink(aDocument,
                                           aAttachment.contentLocation,
                                           aAttachment.contentLocation);
      downloadUrl.style.fontSize = "small";
      downloadUrl.style.display = "block";

      node.appendChild(downloadUrl);
    }
    else {
      node.textContent = getComposeBundle().getFormattedString(
        "cloudAttachmentListItem",
        [aAttachment.name, gMessenger.formatFileSize(aAttachment.size),
         aProvider.displayName,
         aAttachment.contentLocation]);
    }

    this._updateAttachmentCount(aDocument);
    list.appendChild(node);
  },

  /**
   * Event handler for when mail is sent.  For mail that is being sent
   * (and not saved!), find any cloudAttachmentList* nodes that we've created,
   * and strip their IDs out.  That way, if the receiving user replies by
   * sending some BigFiles, we don't run into ID conflicts.
   */
  send: function(aEvent) {
    const Ci = Components.interfaces;

    let msgType = parseInt(aEvent.target.getAttribute("msgtype"));

    if (msgType == Ci.nsIMsgCompDeliverMode.Now ||
        msgType == Ci.nsIMsgCompDeliverMode.Later ||
        msgType == Ci.nsIMsgCompDeliverMode.Background) {

      const kIDs = ["cloudAttachmentList", "cloudAttachmentListRoot",
                    "cloudAttachmentListHeader"];
      let mailDoc = document.getElementById("content-frame").contentDocument;

      for each (let [, id] in Iterator(kIDs)) {
        let element = mailDoc.getElementById(id);
        if (element)
          element.removeAttribute("id");
      }
    }
  },
};

window.addEventListener("compose-window-init",
  gCloudAttachmentLinkManager.init.bind(gCloudAttachmentLinkManager), true);
window.addEventListener("compose-window-close",
  gCloudAttachmentLinkManager.uninit.bind(gCloudAttachmentLinkManager), true);
window.addEventListener("compose-send-message",
  gCloudAttachmentLinkManager.send.bind(gCloudAttachmentLinkManager), true);
