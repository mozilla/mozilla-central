/* -*- Mode: JavaScript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/Services.jsm");

const kDefaultFontType          = "font.default.%LANG%";
const kFontNameFmtSerif         = "font.name.serif.%LANG%";
const kFontNameFmtSansSerif     = "font.name.sans-serif.%LANG%";
const kFontNameFmtMonospace     = "font.name.monospace.%LANG%";
const kFontNameListFmtSerif     = "font.name-list.serif.%LANG%";
const kFontNameListFmtSansSerif = "font.name-list.sans-serif.%LANG%";
const kFontNameListFmtMonospace = "font.name-list.monospace.%LANG%";
const kFontSizeFmtVariable      = "font.size.variable.%LANG%";
const kFontSizeFmtFixed         = "font.size.fixed.%LANG%";
const kFontMinSizeFmt           = "font.minimum-size.%LANG%";

var gFontsDialog = {
  _init: function()
  {
    // build the charset menu list. We do this by hand instead of using the xul template
    // builder because of Bug #285076,
    this.createCharsetMenus(document.getElementById("viewDefaultCharset-menupopup"), "NC:DecodersRoot",
                            document.getElementById('mailnews.view_default_charset').value);
  },

  _selectLanguageGroup: function (aLanguageGroup)
  {
    var prefs = [{ format: kDefaultFontType,          type: "string",   element: "defaultFontType", fonttype: null},
                 { format: kFontNameFmtSerif,         type: "fontname", element: "serif",      fonttype: "serif"       },
                 { format: kFontNameFmtSansSerif,     type: "fontname", element: "sans-serif", fonttype: "sans-serif"  },
                 { format: kFontNameFmtMonospace,     type: "fontname", element: "monospace",  fonttype: "monospace"   },
                 { format: kFontNameListFmtSerif,     type: "unichar",  element: null,         fonttype: "serif"       },
                 { format: kFontNameListFmtSansSerif, type: "unichar",  element: null,         fonttype: "sans-serif"  },
                 { format: kFontNameListFmtMonospace, type: "unichar",  element: null,         fonttype: "monospace"   },
                 { format: kFontSizeFmtVariable,      type: "int",      element: "sizeVar",    fonttype: null          },
                 { format: kFontSizeFmtFixed,         type: "int",      element: "sizeMono",   fonttype: null          },
                 { format: kFontMinSizeFmt,           type: "int",      element: "minSize",    fonttype: null          }];
    var preferences = document.getElementById("fontPreferences");
    for (var i = 0; i < prefs.length; ++i) {
      var preference = document.getElementById(prefs[i].format.replace(/%LANG%/, aLanguageGroup));
      if (!preference) {
        preference = document.createElement("preference");
        var name = prefs[i].format.replace(/%LANG%/, aLanguageGroup);
        preference.id = name;
        preference.setAttribute("name", name);
        preference.setAttribute("type", prefs[i].type);
        preferences.appendChild(preference);
      }

      if (!prefs[i].element)
        continue;

      var element = document.getElementById(prefs[i].element);
      if (element) {
        element.setAttribute("preference", preference.id);

        if (prefs[i].fonttype)
          FontBuilder.buildFontList(aLanguageGroup, prefs[i].fonttype, element);

        preference.setElementValue(element);
      }
    }
  },

  readFontLanguageGroup: function ()
  {
    var languagePref = document.getElementById("font.language.group");
    this._selectLanguageGroup(languagePref.value);
    return undefined;
  },

  readFontSelection: function (aElement)
  {
    // Determine the appropriate value to select, for the following cases:
    // - there is no setting
    // - the font selected by the user is no longer present (e.g. deleted from
    //   fonts folder)
    let preference = document.getElementById(aElement.getAttribute("preference"));
    let fontItem;
    if (preference.value) {
      fontItem = aElement.querySelector('[value="' + preference.value + '"]');

      // There is a setting that actually is in the list. Respect it.
      if (fontItem)
        return undefined;
    }

    let defaultValue = aElement.firstChild.firstChild.getAttribute("value");
    let languagePref = document.getElementById("font.language.group");
    preference = document.getElementById("font.name-list." + aElement.id + "." + languagePref.value);
    if (!preference)
      return defaultValue;

    let fontNames = preference.value.split(",");

    for (let i = 0; i < fontNames.length; ++i) {
      let fontName = fontNames[i].trim();
      fontItem = aElement.querySelector('[value="' + fontName + '"]');
      if (fontItem)
        break;
    }
    if (fontItem)
      return fontItem.getAttribute("value");
    return defaultValue;
  },

  readUseDocumentFonts: function ()
  {
    var preference = document.getElementById("browser.display.use_document_fonts");
    return preference.value == 1;
  },

  writeUseDocumentFonts: function ()
  {
    var useDocumentFonts = document.getElementById("useDocumentFonts");
    return useDocumentFonts.checked;
  },

  readFixedWidthForPlainText: function ()
  {
    var preference = document.getElementById("mail.fixed_width_messages");
    return preference.value == 1;
  },

  writeFixedWidthForPlainText: function ()
  {
    var mailFixedWidthMessages = document.getElementById("mailFixedWidthMessages");
    return mailFixedWidthMessages.checked;
  },

  addMenuItem: function(aMenuPopup, aLabel, aValue)
  {
    var menuItem = document.createElement('menuitem');
    menuItem.setAttribute('label', aLabel);
    menuItem.setAttribute('value', aValue);
    aMenuPopup.appendChild(menuItem);
  },

  readRDFString: function(aDS, aRes, aProp)
  {
    var n = aDS.GetTarget(aRes, aProp, true);
    return (n) ? n.QueryInterface(Components.interfaces.nsIRDFLiteral).Value : "";
  },

  createCharsetMenus: function(aMenuPopup, aRoot, aPreferenceValue)
  {
    var rdfService = Components.classes["@mozilla.org/rdf/rdf-service;1"]
                     .getService(Components.interfaces.nsIRDFService);
    var kNC_Root = rdfService.GetResource(aRoot);
    var kNC_Name = rdfService.GetResource("http://home.netscape.com/NC-rdf#Name");

    var rdfDataSource = rdfService.GetDataSource("rdf:charset-menu");
    var rdfContainer =
      Components.classes["@mozilla.org/rdf/container;1"]
                .createInstance(Components.interfaces.nsIRDFContainer);
    rdfContainer.Init(rdfDataSource, kNC_Root);

    var charset;
    var availableCharsets = rdfContainer.GetElements();

    for (var i = 0; i < rdfContainer.GetCount(); i++)
    {
      charset = availableCharsets.getNext().QueryInterface(Components.interfaces.nsIRDFResource);

      this.addMenuItem(aMenuPopup, this.readRDFString(rdfDataSource, charset, kNC_Name), charset.Value);
      if (charset.Value == aPreferenceValue)
        aMenuPopup.parentNode.value = charset.Value;
    }
  },

  mCharsetMenuInitialized: false,
  readDefaultCharset: function()
  {
    if (!this.mCharsetMenuInitialized)
    {
      Services.obs.notifyObservers(null, "charsetmenu-selected", "mailedit");
      // build the charset menu list. We do this by hand instead of using the xul template
      // builder because of Bug #285076,
      this.createCharsetMenus(document.getElementById("sendDefaultCharset-menupopup"), "NC:MaileditCharsetMenuRoot",
                              document.getElementById('mailnews.send_default_charset').value);
      this.mCharsetMenuInitialized = true;
    }
    return undefined;
  },
};
