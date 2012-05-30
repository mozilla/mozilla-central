/* -*- Mode: Java; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Default preferences for seamonkey composer. This file
 * was copied from mozilla/modules/libpref/src/init/editor.js
 *
 * If you're looking for the default prefs of standalone
 * composer, see mozilla/composer/app/profile/all.js
 */

pref("editor.author",                       "");

pref("editor.text_color",                   "#000000");
pref("editor.link_color",                   "#0000FF");
pref("editor.active_link_color",            "#000088");
pref("editor.followed_link_color",          "#FF0000");
pref("editor.background_color",             "#FFFFFF");
pref("editor.use_background_image",         false);
pref("editor.default_background_image",     "");
pref("editor.use_custom_default_colors", 1);

pref("editor.hrule.height",                 2);
pref("editor.hrule.width",                  100);
pref("editor.hrule.width_percent",          true);
pref("editor.hrule.shading",                true);
pref("editor.hrule.align",                  1); // center

pref("editor.table.maintain_structure", true);

pref("editor.prettyprint", true);

pref("editor.throbber.url","chrome://editor-region/locale/region.properties");

pref("editor.toolbars.showbutton.new", true);
pref("editor.toolbars.showbutton.open", true);
pref("editor.toolbars.showbutton.save", true);
pref("editor.toolbars.showbutton.publish", true);
pref("editor.toolbars.showbutton.preview", true);
pref("editor.toolbars.showbutton.cut", false);
pref("editor.toolbars.showbutton.copy", false);
pref("editor.toolbars.showbutton.paste", false);
pref("editor.toolbars.showbutton.print", true);
pref("editor.toolbars.showbutton.find", false);
pref("editor.toolbars.showbutton.image", true);
pref("editor.toolbars.showbutton.hline", false);
pref("editor.toolbars.showbutton.table", true);
pref("editor.toolbars.showbutton.link", true);
pref("editor.toolbars.showbutton.namedAnchor", false);

pref("editor.toolbars.showbutton.bold", true);
pref("editor.toolbars.showbutton.italic", true);
pref("editor.toolbars.showbutton.underline", true);
pref("editor.toolbars.showbutton.DecreaseFontSize", true);
pref("editor.toolbars.showbutton.IncreaseFontSize", true);
pref("editor.toolbars.showbutton.ul", true);
pref("editor.toolbars.showbutton.ol", true);
pref("editor.toolbars.showbutton.outdent", true);
pref("editor.toolbars.showbutton.indent", true);

pref("editor.toolbars.showbutton.absolutePosition", true);
pref("editor.toolbars.showbutton.decreaseZIndex", true);
pref("editor.toolbars.showbutton.increaseZIndex", true);

pref("editor.history.url_maximum", 10);

pref("editor.publish.",                      "");
pref("editor.lastFileLocation.image",        "");
pref("editor.lastFileLocation.html",         "");
pref("editor.save_associated_files",         true);
pref("editor.always_show_publish_dialog",    false);

/*
 * What are the entities that you want Mozilla to save using mnemonic
 * names rather than numeric codes? E.g. If set, we'll output &nbsp;
 * otherwise, we may output 0xa0 depending on the charset.
 *
 * "none"   : don't use any entity names; only use numeric codes.
 * "basic"  : use entity names just for &nbsp; &amp; &lt; &gt; &quot; for 
 *            interoperability/exchange with products that don't support more
 *            than that.
 * "latin1" : use entity names for 8bit accented letters and other special
 *            symbols between 128 and 255.
 * "html"   : use entity names for 8bit accented letters, greek letters, and
 *            other special markup symbols as defined in HTML4.
 */
//pref("editor.encode_entity",                 "html");

#ifndef XP_MACOSX
#ifdef XP_UNIX
pref("editor.disable_spell_checker", false);
pref("editor.dont_lock_spell_files", true);
#endif
#endif

pref("editor.CR_creates_new_p",      false);

// Pasting images from the clipboard, order of encoding preference: 
// JPEG-PNG-GIF=0, PNG-JPEG-GIF=1, GIF-JPEG-PNG=2
pref("clipboard.paste_image_type", 1);
