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
 * The Original Code is Mozilla.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications.
 * Portions created by the Initial Developer are Copyright (C) 2001
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Vidur Apparao <vidur@netscape.com> (original author)
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

#ifndef __nsSchemaLoader_h__
#define __nsSchemaLoader_h__

#include "nsISVSchemaErrorHandler.h"
#include "nsISVSchemaLoader.h"
#include "nsSchemaPrivate.h"
#include "nsDOMUtils.h"

// DOM includes
#include "nsIDOMElement.h"
#include "nsIDOMNodeList.h"
#include "nsIDOMNode.h"

// XPCOM Includes
#include "nsCOMPtr.h"
#include "nsVoidArray.h"
#include "nsIAtom.h"
#include "nsInterfaceHashtable.h"

// Loading includes
#include "nsIURI.h"

class nsSchemaAtoms
{
public:
  static nsresult AddRefAtoms();

#define SCHEMA_ATOM(_name, _value) static nsIAtom* _name;
#include "nsSchemaAtomList.h"
#undef SCHEMA_ATOM
};

class nsBuiltinSchemaCollection : public nsISVSchemaCollection
{
public:
  nsBuiltinSchemaCollection();
  nsresult Init();

  NS_DECL_ISUPPORTS
  NS_DECL_NSISVSCHEMACOLLECTION

protected:
  nsresult GetBuiltinType(const nsAString& aName,
                          const nsAString& aNamespace,
                          nsISVSchemaType** aType);
  nsresult GetSOAPType(const nsAString& aName,
                       const nsAString& aNamespace,
                       nsISVSchemaType** aType);

protected:
  nsInterfaceHashtable<nsStringHashKey, nsISVSchemaType> mBuiltinTypesHash;
  nsInterfaceHashtable<nsStringHashKey, nsISVSchemaType> mSOAPTypeHash;
};

class nsSchemaLoader : public nsISVSchemaLoader,
                       public nsISVSchemaCollection
{
public:
  nsSchemaLoader();
  nsresult Init();

  NS_DECL_ISUPPORTS
  NS_DECL_NSISVSCHEMALOADER
  NS_DECL_NSISVSCHEMACOLLECTION

protected:
  nsresult ProcessElement(nsISVSchemaErrorHandler* aErrorHandler,
                          nsSchema* aSchema,
                          nsIDOMElement* aElement,
                          nsISVSchemaElement** aSchemaElement);
  nsresult ProcessComplexType(nsISVSchemaErrorHandler* aErrorHandler,
                              nsSchema* aSchema,
                              nsIDOMElement* aElement,
                              nsISVSchemaComplexType** aComplexType);
  nsresult ProcessComplexTypeBody(nsISVSchemaErrorHandler* aErrorHandler,
                                  nsSchema* aSchema,
                                  nsIDOMElement* aElement,
                                  nsSchemaComplexType* aComplexType,
                                  nsSchemaModelGroup* aSequence,
                                  PRUint16* aContentModel);
  nsresult ProcessSimpleContent(nsISVSchemaErrorHandler* aErrorHandler,
                                nsSchema* aSchema,
                                nsIDOMElement* aElement,
                                nsSchemaComplexType* aComplexType,
                                PRUint16* aDerivation,
                                nsISVSchemaType** aBaseType);
  nsresult ProcessSimpleContentRestriction(nsISVSchemaErrorHandler* aErrorHandler,
                                           nsSchema* aSchema,
                                           nsIDOMElement* aElement,
                                           nsSchemaComplexType* aComplexType,
                                           nsISVSchemaType* aBaseType,
                                           nsISVSchemaSimpleType** aSimpleBaseType);
  nsresult ProcessSimpleContentExtension(nsISVSchemaErrorHandler* aErrorHandler,
                                         nsSchema* aSchema,
                                         nsIDOMElement* aElement,
                                         nsSchemaComplexType* aComplexType,
                                         nsISVSchemaType* aBaseType,
                                         nsISVSchemaSimpleType** aSimpleBaseType);
  nsresult ProcessComplexContent(nsISVSchemaErrorHandler* aErrorHandler,
                                 nsSchema* aSchema,
                                 nsIDOMElement* aElement,
                                 nsSchemaComplexType* aComplexType,
                                 PRUint16* aContentModel,
                                 PRUint16* aDerivation,
                                 nsISVSchemaType** aBaseType);
  nsresult ProcessSimpleType(nsISVSchemaErrorHandler* aErrorHandler,
                             nsSchema* aSchema,
                             nsIDOMElement* aElement,
                             nsISVSchemaSimpleType** aSimpleType);
  nsresult ProcessSimpleTypeRestriction(nsISVSchemaErrorHandler* aErrorHandler,
                                        nsSchema* aSchema,
                                        nsIDOMElement* aElement,
                                        const nsAString& aName,
                                        nsISVSchemaSimpleType** aSimpleType);
  nsresult ProcessSimpleTypeList(nsISVSchemaErrorHandler* aErrorHandler,
                                 nsSchema* aSchema,
                                 nsIDOMElement* aElement,
                                 const nsAString& aName,
                                 nsISVSchemaSimpleType** aSimpleType);
  nsresult ProcessSimpleTypeUnion(nsISVSchemaErrorHandler* aErrorHandler,
                                  nsSchema* aSchema,
                                  nsIDOMElement* aElement,
                                  const nsAString& aName,
                                  nsISVSchemaSimpleType** aSimpleType);
  nsresult ProcessAttribute(nsISVSchemaErrorHandler* aErrorHandler,
                            nsSchema* aSchema,
                            nsIDOMElement* aElement,
                            nsISVSchemaAttribute** aAttribute);
  nsresult ProcessAttributeGroup(nsISVSchemaErrorHandler* aErrorHandler,
                                 nsSchema* aSchema,
                                 nsIDOMElement* aElement,
                                 nsISVSchemaAttributeGroup** aAttributeGroup);
  nsresult ProcessAttributeComponent(nsISVSchemaErrorHandler* aErrorHandler,
                                     nsSchema* aSchema,
                                     nsIDOMElement* aElement,
                                     nsIAtom* aTagName,
                                     nsISVSchemaAttributeComponent** aAttribute);
  nsresult ProcessModelGroup(nsISVSchemaErrorHandler* aErrorHandler,
                             nsSchema* aSchema,
                             nsIDOMElement* aElement,
                             nsIAtom* aTagName,
                             nsSchemaModelGroup* aParentSequence,
                             nsISVSchemaModelGroup** aModelGroup);
  nsresult ProcessParticle(nsISVSchemaErrorHandler* aErrorHandler,
                           nsSchema* aSchema,
                           nsIDOMElement* aElement,
                           nsIAtom* aTagName,
                           nsISVSchemaParticle** aModelGroup);
  nsresult ProcessFacet(nsISVSchemaErrorHandler* aErrorHandler,
                        nsSchema* aSchema,
                        nsIDOMElement* aElement,
                        nsIAtom* aTagName,
                        nsISVSchemaFacet** aFacet);

  nsresult GetNewOrUsedType(nsSchema* aSchema,
                            nsIDOMElement* aContext,
                            const nsAString& aTypeName,
                            nsISVSchemaType** aType);

  void GetUse(nsIDOMElement* aElement,
              PRUint16* aUse);
  void GetProcess(nsIDOMElement* aElement,
                  PRUint16* aProcess);
  void GetMinAndMax(nsIDOMElement* aElement,
                    PRUint32* aMinOccurs,
                    PRUint32* aMaxOccurs);

  nsresult GetResolvedURI(const nsAString& aSchemaURI,
                          const char* aMethod, nsIURI** aURI);

  nsresult ParseArrayType(nsSchema* aSchema,
                          nsIDOMElement* aAttrElement,
                          const nsAString& aStr,
                          nsISVSchemaType** aType,
                          PRUint32* aDimension);
  nsresult ParseDimensions(nsSchema* aSchema,
                           nsIDOMElement* aAttrElement,
                           const nsAString& aStr,
                           nsISVSchemaType* aBaseType,
                           nsISVSchemaType** aArrayType,
                           PRUint32* aDimension);
  void ConstructArrayName(nsISVSchemaType* aType,
                          nsAString& aName);

  nsresult ParseNameAndNS(const nsAString& aName, nsIDOMElement* aElement,
                          nsAString& aTypeName, nsAString& aTypeNS);

  nsresult GetDocumentFromURI(const nsAString& aUri,
                              nsIDOMDocument** aDocument);

protected:
  nsInterfaceHashtable<nsStringHashKey, nsISVSchema> mSchemas;
  nsCOMPtr<nsISVSchemaCollection> mBuiltinCollection;
};

#endif // __nsSchemaLoader_h__
