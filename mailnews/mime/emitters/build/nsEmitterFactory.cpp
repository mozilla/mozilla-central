/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
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
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 1998
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either of the GNU General Public License Version 2 or later (the "GPL"),
 * or the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
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

#include "nsIFactory.h"
#include "nsISupports.h"
#include "msgCore.h"
#include "nsCOMPtr.h"
#include "pratom.h"
#include "nsServiceManagerUtils.h"
#include "mozilla/ModuleUtils.h"

/* Include all of the interfaces our factory can generate components for */
#include "nsMimeEmitterCID.h"
#include "nsIMimeEmitter.h"
#include "nsMimeHtmlEmitter.h"
#include "nsMimeRawEmitter.h"
#include "nsMimeXmlEmitter.h"
#include "nsMimePlainEmitter.h"

NS_GENERIC_FACTORY_CONSTRUCTOR(nsMimeRawEmitter)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMimeXmlEmitter)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMimePlainEmitter)
NS_GENERIC_FACTORY_CONSTRUCTOR_INIT(nsMimeHtmlDisplayEmitter, Init)

NS_DEFINE_NAMED_CID(NS_HTML_MIME_EMITTER_CID);
NS_DEFINE_NAMED_CID(NS_XML_MIME_EMITTER_CID);
NS_DEFINE_NAMED_CID(NS_PLAIN_MIME_EMITTER_CID);
NS_DEFINE_NAMED_CID(NS_RAW_MIME_EMITTER_CID);

static const mozilla::Module::CategoryEntry kMimeEmitterCategories[] = {
  { "mime-emitter", NS_HTML_MIME_EMITTER_CONTRACTID, NS_HTML_MIME_EMITTER_CONTRACTID },
  { "mime-emitter", NS_XML_MIME_EMITTER_CONTRACTID, NS_XML_MIME_EMITTER_CONTRACTID },
  { "mime-emitter", NS_PLAIN_MIME_EMITTER_CONTRACTID, NS_PLAIN_MIME_EMITTER_CONTRACTID },
  { "mime-emitter", NS_RAW_MIME_EMITTER_CONTRACTID, NS_RAW_MIME_EMITTER_CONTRACTID },
  { NULL }
};

const mozilla::Module::CIDEntry kMimeEmitterCIDs[] = {
  { &kNS_HTML_MIME_EMITTER_CID, false, NULL, nsMimeHtmlDisplayEmitterConstructor },
  { &kNS_XML_MIME_EMITTER_CID, false, NULL, nsMimeXmlEmitterConstructor },
  { &kNS_PLAIN_MIME_EMITTER_CID, false, NULL, nsMimePlainEmitterConstructor },
  { &kNS_RAW_MIME_EMITTER_CID, false, NULL, nsMimeRawEmitterConstructor },
  { NULL }
};

const mozilla::Module::ContractIDEntry kMimeEmitterContracts[] = {
  { NS_HTML_MIME_EMITTER_CONTRACTID, &kNS_HTML_MIME_EMITTER_CID },
  { NS_XML_MIME_EMITTER_CONTRACTID, &kNS_XML_MIME_EMITTER_CID },
  { NS_PLAIN_MIME_EMITTER_CONTRACTID, &kNS_PLAIN_MIME_EMITTER_CID },
  { NS_RAW_MIME_EMITTER_CONTRACTID, &kNS_RAW_MIME_EMITTER_CID },
  { NULL }
};

static const mozilla::Module kMimeEmitterModule = {
    mozilla::Module::kVersion,
    kMimeEmitterCIDs,
    kMimeEmitterContracts,
    kMimeEmitterCategories
};

NSMODULE_DEFN(mimeemitter) = &kMimeEmitterModule;
