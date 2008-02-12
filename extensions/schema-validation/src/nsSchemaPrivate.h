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

#ifndef __nsSchemaPrivate_h__
#define __nsSchemaPrivate_h__

#include "nsISVSchemaErrorHandler.h"
#include "nsISVSchema.h"

// XPCOM Includes
#include "nsAutoPtr.h"
#include "nsCOMPtr.h"
#include "nsCOMArray.h"
#include "nsHashKeys.h"
#include "nsInterfaceHashtable.h"
#include "nsStringAPI.h"
#include "nsIDOMElement.h"

#define NS_SCHEMA_2001_NAMESPACE "http://www.w3.org/2001/XMLSchema"
#define NS_SCHEMA_1999_NAMESPACE "http://www.w3.org/1999/XMLSchema"
#define NS_SOAP_1_1_ENCODING_NAMESPACE \
   "http://schemas.xmlsoap.org/soap/encoding/"
#define NS_SOAP_1_2_ENCODING_NAMESPACE \
   "http://www.w3.org/2001/09/soap-encoding"

/**
 * Fire error on error handler passed as argument, only to be used
 * in ProcessXXX or Resolve methods.
 */
#define NS_SCHEMALOADER_FIRE_ERROR(status,statusMessage)   \
  PR_BEGIN_MACRO                                           \
  if (aErrorHandler) {                                     \
    aErrorHandler->OnError(status, statusMessage);         \
  }                                                        \
  PR_END_MACRO

class nsSchema : public nsISVSchema
{
public:
  nsSchema(nsISVSchemaCollection* aCollection, nsIDOMElement* aElement);
  virtual ~nsSchema();

  NS_DECL_ISUPPORTS
  NS_DECL_NSISVSCHEMACOMPONENT
  NS_DECL_NSISVSCHEMA

  nsresult Init();

  NS_IMETHOD AddType(nsISVSchemaType* aType);
  NS_IMETHOD AddAttribute(nsISVSchemaAttribute* aAttribute);
  NS_IMETHOD AddElement(nsISVSchemaElement* aElement);
  NS_IMETHOD AddAttributeGroup(nsISVSchemaAttributeGroup* aAttributeGroup);
  NS_IMETHOD AddModelGroup(nsISVSchemaModelGroup* aModelGroup);
  void DropCollectionReference();
  nsresult ResolveTypePlaceholder(nsISVSchemaErrorHandler* aErrorHandler,
                                  nsISVSchemaType* aPlaceholder,
                                  nsISVSchemaType** aType);
  PRBool IsElementFormQualified() { return mElementFormQualified; }
  PRBool IsAttributeFormDefaultQualified() { return mAttributeFormDefaultQualified; }

protected:
  nsString mTargetNamespace;
  nsString mSchemaNamespace;
  nsCOMArray<nsISVSchemaType> mTypes;
  nsInterfaceHashtable<nsStringHashKey, nsISVSchemaType> mTypesHash;
  nsCOMArray<nsISVSchemaAttribute> mAttributes;
  nsInterfaceHashtable<nsStringHashKey, nsISVSchemaAttribute> mAttributesHash;
  nsCOMArray<nsISVSchemaElement> mElements;
  nsInterfaceHashtable<nsStringHashKey, nsISVSchemaElement> mElementsHash;
  nsCOMArray<nsISVSchemaAttributeGroup> mAttributeGroups;
  nsInterfaceHashtable<nsStringHashKey, nsISVSchemaAttributeGroup> mAttributeGroupsHash;
  nsCOMArray<nsISVSchemaModelGroup> mModelGroups;
  nsInterfaceHashtable<nsStringHashKey, nsISVSchemaModelGroup> mModelGroupsHash;
  nsISVSchemaCollection* mCollection;  // [WEAK] it owns me
  PRPackedBool mElementFormQualified;
  PRBool mAttributeFormDefaultQualified;
};

class nsSchemaComponentBase {
public:
  nsSchemaComponentBase(nsSchema* aSchema);
  virtual ~nsSchemaComponentBase();

  NS_IMETHOD GetTargetNamespace(nsAString& aTargetNamespace);

protected:
  nsSchema* mSchema;  // [WEAK] It owns me
  // Used to prevent infinite recursion for cycles in the object graph
  PRPackedBool mIsResolved;
  PRPackedBool mIsCleared;
};

#define NS_IMPL_NSISCHEMACOMPONENT_USING_BASE                           \
  NS_IMETHOD GetTargetNamespace(nsAString& aTargetNamespace) {          \
    return nsSchemaComponentBase::GetTargetNamespace(aTargetNamespace); \
  }                                                                     \
  NS_IMETHOD Resolve(nsISVSchemaErrorHandler* aErrorHandler);                                                 \
  NS_IMETHOD Clear();

class nsSchemaBuiltinType : public nsISVSchemaBuiltinType
{
public:
  nsSchemaBuiltinType(PRUint16 aBuiltinType);
  virtual ~nsSchemaBuiltinType();

  NS_DECL_ISUPPORTS
  NS_DECL_NSISVSCHEMACOMPONENT
  NS_DECL_NSISVSCHEMATYPE
  NS_DECL_NSISVSCHEMASIMPLETYPE
  NS_DECL_NSISVSCHEMABUILTINTYPE

protected:
  PRUint16 mBuiltinType;
};

class nsSchemaListType : public nsSchemaComponentBase,
                         public nsISVSchemaListType
{
public:
  nsSchemaListType(nsSchema* aSchema, const nsAString& aName);
  virtual ~nsSchemaListType();

  NS_DECL_ISUPPORTS
  NS_IMPL_NSISCHEMACOMPONENT_USING_BASE
  NS_DECL_NSISVSCHEMATYPE
  NS_DECL_NSISVSCHEMASIMPLETYPE
  NS_DECL_NSISVSCHEMALISTTYPE
  
  NS_IMETHOD SetListType(nsISVSchemaSimpleType* aListType);

protected:
  nsString mName;
  nsCOMPtr<nsISVSchemaSimpleType> mListType;
};

class nsSchemaUnionType : public nsSchemaComponentBase,
                          public nsISVSchemaUnionType
{
public:
  nsSchemaUnionType(nsSchema* aSchema, const nsAString& aName);
  virtual ~nsSchemaUnionType();
  
  NS_DECL_ISUPPORTS
  NS_IMPL_NSISCHEMACOMPONENT_USING_BASE
  NS_DECL_NSISVSCHEMATYPE
  NS_DECL_NSISVSCHEMASIMPLETYPE
  NS_DECL_NSISVSCHEMAUNIONTYPE

  NS_IMETHOD AddUnionType(nsISVSchemaSimpleType* aUnionType);

protected:
  nsString mName;
  nsCOMArray<nsISVSchemaSimpleType> mUnionTypes;
};

class nsSchemaRestrictionType : public nsSchemaComponentBase,
                                public nsISVSchemaRestrictionType
{
public:
  nsSchemaRestrictionType(nsSchema* aSchema, const nsAString& aName);
  virtual ~nsSchemaRestrictionType();

  NS_DECL_ISUPPORTS
  NS_IMPL_NSISCHEMACOMPONENT_USING_BASE
  NS_DECL_NSISVSCHEMATYPE
  NS_DECL_NSISVSCHEMASIMPLETYPE
  NS_DECL_NSISVSCHEMARESTRICTIONTYPE

  NS_IMETHOD SetBaseType(nsISVSchemaSimpleType* aBaseType);
  NS_IMETHOD AddFacet(nsISVSchemaFacet* aFacet);

protected:
  nsString mName;
  nsCOMPtr<nsISVSchemaSimpleType> mBaseType;
  nsCOMArray<nsISVSchemaFacet> mFacets;
};

class nsComplexTypeArrayInfo {
public:
  nsComplexTypeArrayInfo(nsISVSchemaType* aType, PRUint32 aDimension) :
    mType(aType), mDimension(aDimension) {}
  ~nsComplexTypeArrayInfo() {}

  void GetType(nsISVSchemaType** aType) { *aType = mType; NS_ADDREF(*aType); }
  PRUint32 GetDimension() { return mDimension; }

private:
  nsCOMPtr<nsISVSchemaType> mType;
  PRUint32 mDimension;
};

class nsSchemaComplexType : public nsSchemaComponentBase,
                            public nsISVSchemaComplexType
{
public:
  nsSchemaComplexType(nsSchema* aSchema, const nsAString& aName,
                      PRBool aAbstract);
  virtual ~nsSchemaComplexType();

  NS_DECL_ISUPPORTS
  NS_IMPL_NSISCHEMACOMPONENT_USING_BASE
  NS_DECL_NSISVSCHEMATYPE
  NS_DECL_NSISVSCHEMACOMPLEXTYPE

  nsresult Init()
  {
    return mAttributesHash.Init() ? NS_OK : NS_ERROR_FAILURE;
  }

  nsresult ProcessExtension(nsISVSchemaErrorHandler* aErrorHandler);

  NS_IMETHOD SetContentModel(PRUint16 aContentModel);
  NS_IMETHOD SetDerivation(PRUint16 aDerivation, nsISVSchemaType* aBaseType);
  NS_IMETHOD SetSimpleBaseType(nsISVSchemaSimpleType* aSimpleBaseType);
  NS_IMETHOD SetModelGroup(nsISVSchemaModelGroup* aModelGroup);
  NS_IMETHOD AddAttribute(nsISVSchemaAttributeComponent* aAttribute);
  NS_IMETHOD SetArrayInfo(nsISVSchemaType* aType, PRUint32 aDimension);
  
protected:
  nsString mName;
  PRPackedBool mAbstract;
  PRUint16 mContentModel;
  PRUint16 mDerivation;
  nsCOMPtr<nsISVSchemaType> mBaseType;
  nsCOMPtr<nsISVSchemaSimpleType> mSimpleBaseType;
  nsCOMPtr<nsISVSchemaModelGroup> mModelGroup;
  nsCOMArray<nsISVSchemaAttributeComponent> mAttributes;
  nsInterfaceHashtable<nsStringHashKey, nsISVSchemaAttributeComponent> mAttributesHash;
  nsAutoPtr<nsComplexTypeArrayInfo> mArrayInfo;
};

class nsSchemaTypePlaceholder : public nsSchemaComponentBase,
                                public nsISVSchemaSimpleType
{
public:
  nsSchemaTypePlaceholder(nsSchema* aSchema, const nsAString& aName);
  virtual ~nsSchemaTypePlaceholder();

  NS_DECL_ISUPPORTS
  NS_IMPL_NSISCHEMACOMPONENT_USING_BASE
  NS_DECL_NSISVSCHEMATYPE
  NS_DECL_NSISVSCHEMASIMPLETYPE

protected:
  nsString mName;
};

class nsSchemaParticleBase : public nsSchemaComponentBase
{
public:
  nsSchemaParticleBase(nsSchema* aSchema);
  virtual ~nsSchemaParticleBase();

  NS_IMETHOD GetMinOccurs(PRUint32 *aMinOccurs);
  NS_IMETHOD GetMaxOccurs(PRUint32 *aMaxOccurs);

  NS_IMETHOD SetMinOccurs(PRUint32 aMinOccurs);
  NS_IMETHOD SetMaxOccurs(PRUint32 aMaxOccurs);

protected:
  PRUint32 mMinOccurs;
  PRUint32 mMaxOccurs;
};

#define NS_IMPL_NSISCHEMAPARTICLE_USING_BASE                           \
  NS_IMETHOD GetMinOccurs(PRUint32 *aMinOccurs) {                      \
    return nsSchemaParticleBase::GetMinOccurs(aMinOccurs);             \
  }                                                                    \
  NS_IMETHOD GetMaxOccurs(PRUint32 *aMaxOccurs) {                      \
    return nsSchemaParticleBase::GetMaxOccurs(aMaxOccurs);             \
  }                                                                    \
  NS_IMETHOD SetMinOccurs(PRUint32 aMinOccurs) {                       \
    return nsSchemaParticleBase::SetMinOccurs(aMinOccurs);             \
  }                                                                    \
  NS_IMETHOD SetMaxOccurs(PRUint32 aMaxOccurs) {                       \
    return nsSchemaParticleBase::SetMaxOccurs(aMaxOccurs);             \
  }                                                                    \
  NS_IMETHOD GetParticleType(PRUint16 *aParticleType);                 \
  NS_IMETHOD GetName(nsAString& aName);

class nsSchemaModelGroup : public nsSchemaParticleBase,
                           public nsISVSchemaModelGroup
{
public:
  nsSchemaModelGroup(nsSchema* aSchema,
                     const nsAString& aName);
  virtual ~nsSchemaModelGroup();

  NS_DECL_ISUPPORTS
  NS_IMPL_NSISCHEMACOMPONENT_USING_BASE
  NS_IMPL_NSISCHEMAPARTICLE_USING_BASE
  NS_DECL_NSISVSCHEMAMODELGROUP

  NS_IMETHOD SetCompositor(PRUint16 aCompositor);
  NS_IMETHOD AddParticle(nsISVSchemaParticle* aParticle);

protected:
  nsString mName;
  PRUint16 mCompositor;
  nsCOMArray<nsISVSchemaParticle> mParticles;
};

class nsSchemaModelGroupRef : public nsSchemaParticleBase,
                              public nsISVSchemaModelGroup
{
public:
  nsSchemaModelGroupRef(nsSchema* aSchema,
                        const nsAString& aRef,
                        const nsAString& aRefNS);
  virtual ~nsSchemaModelGroupRef();

  NS_DECL_ISUPPORTS
  NS_IMPL_NSISCHEMACOMPONENT_USING_BASE
  NS_IMPL_NSISCHEMAPARTICLE_USING_BASE
  NS_DECL_NSISVSCHEMAMODELGROUP

protected:
  nsString mRef, mRefNS;
  nsCOMPtr<nsISVSchemaModelGroup> mModelGroup;
};

class nsSchemaAnyParticle : public nsSchemaParticleBase,
                            public nsISVSchemaAnyParticle
{
public:
  nsSchemaAnyParticle(nsSchema* aSchema);
  virtual ~nsSchemaAnyParticle();

  NS_DECL_ISUPPORTS
  NS_IMPL_NSISCHEMACOMPONENT_USING_BASE
  NS_IMPL_NSISCHEMAPARTICLE_USING_BASE
  NS_DECL_NSISVSCHEMAANYPARTICLE

  NS_IMETHOD SetProcess(PRUint16 aProcess);
  NS_IMETHOD SetNamespace(const nsAString& aNamespace);

protected:
  PRUint16 mProcess;
  nsString mNamespace;
};

class nsSchemaElement : public nsSchemaParticleBase,
                        public nsISVSchemaElement
{
public:
  enum { NILLABLE       = 1 << 1 };
  enum { ABSTRACT       = 1 << 2 };
  enum { FORM_QUALIFIED = 1 << 3 };

  nsSchemaElement(nsSchema* aSchema, const nsAString& aName);
  virtual ~nsSchemaElement();

  NS_DECL_ISUPPORTS
  NS_IMPL_NSISCHEMAPARTICLE_USING_BASE
  NS_DECL_NSISVSCHEMAELEMENT

  NS_IMETHOD GetTargetNamespace(nsAString& aTargetNamespace);
  NS_IMETHOD Resolve(nsISVSchemaErrorHandler* aErrorHandler);
  NS_IMETHOD Clear();
  NS_IMETHOD SetType(nsISVSchemaType* aType);
  NS_IMETHOD SetConstraints(const nsAString& aDefaultValue,
                            const nsAString& aFixedValue);
  NS_IMETHOD SetFlags(PRInt32 aFlags);

protected:
  nsString mName;
  nsCOMPtr<nsISVSchemaType> mType;
  nsString mDefaultValue;
  nsString mFixedValue;
  PRUint8 mFlags;
};

class nsSchemaElementRef : public nsSchemaParticleBase,
                           public nsISVSchemaElement
{
public:
  nsSchemaElementRef(nsSchema* aSchema, const nsAString& aRef, const nsAString& aRefNS);
  virtual ~nsSchemaElementRef();

  NS_DECL_ISUPPORTS
  NS_IMPL_NSISCHEMACOMPONENT_USING_BASE
  NS_IMPL_NSISCHEMAPARTICLE_USING_BASE
  NS_DECL_NSISVSCHEMAELEMENT

protected:
  nsString mRef;
  nsString mRefNS;
  nsCOMPtr<nsISVSchemaElement> mElement;
};

class nsSchemaAttribute : public nsSchemaComponentBase,
                          public nsISVSchemaAttribute
{
public:
  nsSchemaAttribute(nsSchema* aSchema, const nsAString& aName);
  virtual ~nsSchemaAttribute();

  NS_DECL_ISUPPORTS
  NS_IMPL_NSISCHEMACOMPONENT_USING_BASE
  NS_DECL_NSISVSCHEMAATTRIBUTECOMPONENT
  NS_DECL_NSISVSCHEMAATTRIBUTE

  NS_IMETHOD SetType(nsISVSchemaSimpleType* aType);
  NS_IMETHOD SetConstraints(const nsAString& aDefaultValue,
                            const nsAString& aFixedValue);
  NS_IMETHOD SetUse(PRUint16 aUse);
  nsresult SetAttributeFormQualified(PRBool aAttributeFormQualified);

protected:
  nsString mName;
  nsCOMPtr<nsISVSchemaSimpleType> mType;
  nsString mDefaultValue;
  nsString mFixedValue;
  PRUint16 mUse;
  PRBool mAttributeFormQualified;
};

class nsSchemaAttributeRef : public nsSchemaComponentBase,
                             public nsISVSchemaAttribute
{
public:
  nsSchemaAttributeRef(nsSchema* aSchema, const nsAString& aRef,
                       const nsAString& aRefNS);
  virtual ~nsSchemaAttributeRef();
  
  NS_DECL_ISUPPORTS
  NS_IMPL_NSISCHEMACOMPONENT_USING_BASE
  NS_DECL_NSISVSCHEMAATTRIBUTECOMPONENT
  NS_DECL_NSISVSCHEMAATTRIBUTE

  NS_IMETHOD SetConstraints(const nsAString& aDefaultValue,
                            const nsAString& aFixedValue);
  NS_IMETHOD SetUse(PRUint16 aUse);
  nsresult SetAttributeFormQualified(PRBool aAttributeFormQualified);

protected:
  nsString mRef, mRefNS;
  nsCOMPtr<nsISVSchemaAttribute> mAttribute;
  nsString mDefaultValue;
  nsString mFixedValue;
  PRUint16 mUse;
  PRBool mAttributeFormQualified;
};

class nsSchemaAttributeGroup : public nsSchemaComponentBase,
                               public nsISVSchemaAttributeGroup
{
public:
  nsSchemaAttributeGroup(nsSchema* aSchema, const nsAString& aName);
  virtual ~nsSchemaAttributeGroup();
  
  NS_DECL_ISUPPORTS
  NS_IMPL_NSISCHEMACOMPONENT_USING_BASE
  NS_DECL_NSISVSCHEMAATTRIBUTECOMPONENT
  NS_DECL_NSISVSCHEMAATTRIBUTEGROUP

  nsresult Init()
  {
    return mAttributesHash.Init() ? NS_OK : NS_ERROR_FAILURE;
  }

  NS_IMETHOD AddAttribute(nsISVSchemaAttributeComponent* aAttribute);

protected:
  nsString mName;
  nsCOMArray<nsISVSchemaAttributeComponent> mAttributes;
  nsInterfaceHashtable<nsStringHashKey, nsISVSchemaAttributeComponent> mAttributesHash;
};

class nsSchemaAttributeGroupRef : public nsSchemaComponentBase,
                                  public nsISVSchemaAttributeGroup
{
public:
  nsSchemaAttributeGroupRef(nsSchema* aSchema, const nsAString& aRef,
                            const nsAString& aRefNS);
  virtual ~nsSchemaAttributeGroupRef();
  
  NS_DECL_ISUPPORTS
  NS_IMPL_NSISCHEMACOMPONENT_USING_BASE
  NS_DECL_NSISVSCHEMAATTRIBUTECOMPONENT
  NS_DECL_NSISVSCHEMAATTRIBUTEGROUP

protected:
  nsString mRef, mRefNS;
  nsCOMPtr<nsISVSchemaAttributeGroup> mAttributeGroup;
};

class nsSchemaAnyAttribute : public nsSchemaComponentBase,
                             public nsISVSchemaAnyAttribute
{
public:
  nsSchemaAnyAttribute(nsSchema* aSchema);
  virtual ~nsSchemaAnyAttribute();

  NS_DECL_ISUPPORTS
  NS_IMPL_NSISCHEMACOMPONENT_USING_BASE
  NS_DECL_NSISVSCHEMAATTRIBUTECOMPONENT
  NS_DECL_NSISVSCHEMAANYATTRIBUTE
  
  NS_IMETHOD SetProcess(PRUint16 aProcess);
  NS_IMETHOD SetNamespace(const nsAString& aNamespace);

protected:
  PRUint16 mProcess;
  nsString mNamespace;
};

class nsSchemaFacet : public nsSchemaComponentBase,
                      public nsISVSchemaFacet
{
public:
  nsSchemaFacet(nsSchema* aSchema);
  virtual ~nsSchemaFacet();

  NS_DECL_ISUPPORTS
  NS_IMPL_NSISCHEMACOMPONENT_USING_BASE
  NS_DECL_NSISVSCHEMAFACET

  NS_IMETHOD SetFacetType(PRUint16 aFacetType);
  NS_IMETHOD SetIsFixed(PRBool aIsFixed);
  NS_IMETHOD SetValue(const nsAString& aStrValue);
  NS_IMETHOD SetUintValue(PRUint32 aUintValue);
  NS_IMETHOD SetWhitespaceValue(PRUint16 aWhitespaceValue);

protected:
  PRUint16 mFacetType;
  PRPackedBool mIsFixed;
  nsString mStrValue;
  PRUint32 mUintValue;
  PRUint16 mWhitespaceValue;
};

class nsSOAPArray : public nsISVSchemaComplexType
{
public:
  nsSOAPArray(nsISVSchemaType* aAnyType);
  virtual ~nsSOAPArray();

  NS_DECL_ISUPPORTS
  NS_DECL_NSISVSCHEMACOMPONENT
  NS_DECL_NSISVSCHEMATYPE
  NS_DECL_NSISVSCHEMACOMPLEXTYPE

protected:
  nsCOMPtr<nsISVSchemaType> mAnyType;
};

class nsSOAPArrayType : public nsISVSchemaRestrictionType
{
public:
  nsSOAPArrayType();
  virtual ~nsSOAPArrayType();

  NS_DECL_ISUPPORTS
  NS_DECL_NSISVSCHEMACOMPONENT
  NS_DECL_NSISVSCHEMATYPE
  NS_DECL_NSISVSCHEMASIMPLETYPE
  NS_DECL_NSISVSCHEMARESTRICTIONTYPE
};

#define NS_SVSCHEMA_CID                            \
{ /* 77adcbc1-fa38-4b67-a091-06042031132d */       \
 0x77adcbc1, 0xfa38, 0x4b67,                       \
 {0xa0, 0x91, 0x06, 0x04, 0x20, 0x31, 0x13, 0x2d}}

#define NS_SVSCHEMA_CONTRACTID    \
"@mozilla.org/schemavalidator/schema;1"

#define NS_SVSCHEMABUILTINTYPE_CID                 \
{ /* 45c28fed-b8d3-4fba-8105-e9659f138c0f */       \
 0x45c28fed, 0xb8d3, 0x4fba,                       \
 {0x81, 0x05, 0xe9, 0x65, 0x9f, 0x13, 0x8c, 0x0f}}

#define NS_SVSCHEMABUILTINTYPE_CONTRACTID    \
"@mozilla.org/schemavalidator/schemabuiltintype;1"

#define NS_SVSCHEMALISTTYPE_CID                    \
{ /* aa098f14-4c24-41bc-ac4c-6cd03a9a8c20 */       \
 0xaa098f14, 0x4c24, 0x41bc,                       \
 {0xac, 0x4c, 0x6c, 0xd0, 0x3a, 0x9a, 0x8c, 0x20}}

#define NS_SVSCHEMALISTTYPE_CONTRACTID    \
"@mozilla.org/schemavalidator/schemalisttype;1"

#define NS_SVSCHEMAUNIONTYPE_CID                   \
{ /* 9d26656c-7186-4536-99f0-1d8cd9312be2 */       \
 0x9d26656c, 0x7186, 0x4536,                       \
 {0x99, 0xf0, 0x1d, 0x8c, 0xd9, 0x31, 0x2b, 0xe2}}

#define NS_SVSCHEMAUNIONTYPE_CONTRACTID    \
"@mozilla.org/schemavalidator/schemauniontype;1"

#define NS_SVSCHEMARESTRICTIONTYPE_CID             \
{ /* 54df2e0d-34be-4182-bc52-e37f8eceed2c */       \
 0x54df2e0d, 0x34be, 0x4182,                       \
 {0xbc, 0x52, 0xe3, 0x7f, 0x8e, 0xce, 0xed, 0x2c}}

#define NS_SVSCHEMARESTRICTIONTYPE_CONTRACTID    \
"@mozilla.org/schemavalidator/schemarestrictiontype;1"

#define NS_SVSCHEMACOMPLEXTYPE_CID                 \
{ /* ba842a40-de17-43e9-aefc-bd2a2a5c47a1 */       \
 0xba842a40, 0xde17, 0x43e9,                       \
 {0xae, 0xfc, 0xbd, 0x2a, 0x2a, 0x5c, 0x47, 0xa1}}

#define NS_SVSCHEMACOMPLEXTYPE_CONTRACTID    \
"@mozilla.org/schemavalidator/schemacomplextype;1"

#define NS_SVSCHEMATYPEPLACEHOLDER_CID             \
{ /* 4fc0c97d-66dc-4804-935f-ebe2a257917c */       \
 0x4fc0c97d, 0x66dc, 0x4804,                       \
 {0x93, 0x5f, 0xeb, 0xe2, 0xa2, 0x57, 0x91, 0x7c}}

#define NS_SVSCHEMATYPEPLACEHOLDER_CONTRACTID    \
"@mozilla.org/schemavalidator/schematypeplaceholder;1"

#define NS_SVSCHEMAMODELGROUP_CID                  \
{ /* 3a6100f7-3129-47de-a709-8c74acfea5ce */       \
 0x3a6100f7, 0x3129, 0x47de,                       \
 {0xa7, 0x09, 0x8c, 0x74, 0xac, 0xfe, 0xa5, 0xce}}

#define NS_SVSCHEMAMODELGROUP_CONTRACTID    \
"@mozilla.org/schemavalidator/schemamodelgroup;1"

#define NS_SVSCHEMAMODELGROUPREF_CID               \
{ /* 623a3972-ddaf-419f-ad6f-bbeb1c42abc2 */       \
 0x623a3972, 0xddaf, 0x419f,                       \
 {0xad, 0x6f, 0xbb, 0xeb, 0x1c, 0x42, 0xab, 0xc2}}

#define NS_SVSCHEMAMODELGROUPREF_CONTRACTID    \
"@mozilla.org/schemavalidator/schemamodelgroupref;1"

#define NS_SVSCHEMAANYPARTICLE_CID                 \
{ /* 7a77a867-8aa4-4da5-84e0-bef46d728f3e */       \
 0x7a77a867, 0x8aa4, 0x4da5,                       \
 {0x84, 0xe0, 0xbe, 0xf4, 0x6d, 0x72, 0x8f, 0x3e}}

#define NS_SVSCHEMAANYPARTICLE_CONTRACTID    \
"@mozilla.org/schemavalidator/schemaanyparticle;1"

#define NS_SVSCHEMAELEMENT_CID                     \
{ /* 7c761d4b-013b-4310-b9e1-8e8a1d033ab3 */       \
 0x7c761d4b, 0x013b, 0x4310,                       \
 {0xb9, 0xe1, 0x8e, 0x8a, 0x1d, 0x03, 0x3a, 0xb3}}

#define NS_SVSCHEMAELEMENT_CONTRACTID    \
"@mozilla.org/schemavalidator/schemaelement;1"

#define NS_SVSCHEMAELEMENTREF_CID                  \
{ /* a19125d0-315e-49d5-bf34-1a8a8936c457 */       \
 0xa19125d0, 0x315e, 0x49d5,                       \
 {0xbf, 0x34, 0x1a, 0x8a, 0x89, 0x36, 0xc4, 0x57}}

#define NS_SVSCHEMAELEMENTREF_CONTRACTID    \
"@mozilla.org/schemavalidator/schemaelementref;1"

#define NS_SVSCHEMAATTRIBUTE_CID                   \
{ /* a8369191-93e3-4695-8962-b20bcc53f40a */       \
 0xa8369191, 0x93e3, 0x4695,                       \
 {0x89, 0x62, 0xb2, 0x0b, 0xcc, 0x53, 0xf4, 0x0a}}

#define NS_SVSCHEMAATTRIBUTE_CONTRACTID    \
"@mozilla.org/schemavalidator/schemaattribute;1"

#define NS_SVSCHEMAATTRIBUTEREF_CID                \
{ /* 61d81b5d-ba48-44ae-874e-f387d97eff35 */       \
 0x61d81b5d, 0xba48, 0x44ae,                       \
 {0x87, 0x4e, 0xf3, 0x87, 0xd9, 0x7e, 0xff, 0x35}}

#define NS_SVSCHEMAATTRIBUTEREF_CONTRACTID    \
"@mozilla.org/schemavalidator/schemaattributeref;1"

#define NS_SVSCHEMAATTRIBUTEGROUP_CID              \
{ /* 14c45524-04ec-4205-9cc9-17ad9acb4588 */       \
 0x14c45524, 0x04ec, 0x4205,                       \
 {0x9c, 0xc9, 0x17, 0xad, 0x9a, 0xcb, 0x45, 0x88}}

#define NS_SVSCHEMAATTRIBUTEGROUP_CONTRACTID    \
"@mozilla.org/schemavalidator/schemaattributegroup;1"

#define NS_SVSCHEMAATTRIBUTEGROUPREF_CID           \
{ /* b7a6da36-e6e5-4db4-aae1-3e75bf417075 */       \
 0xb7a6da36, 0xe6e5, 0x4db4,                       \
 {0xaa, 0xe1, 0x3e, 0x75, 0xbf, 0x41, 0x70, 0x75}}

#define NS_SVSCHEMAATTRIBUTEGROUPREF_CONTRACTID    \
"@mozilla.org/schemavalidator/schemaattributegroupref;1"

#define NS_SVSCHEMAANYATTRIBUTE_CID                \
{ /* a617fe8f-69af-4901-81fa-22070cdae873 */       \
 0xa617fe8f, 0x69af, 0x4901,                       \
 {0x81, 0xfa, 0x22, 0x07, 0x0c, 0xda, 0xe8, 0x73}}

#define NS_SVSCHEMAANYATTRIBUTE_CONTRACTID    \
"@mozilla.org/schemavalidator/schemaanyattribute;1"

#define NS_SVSCHEMAFACET_CID                       \
{ /* 591bf748-d91d-400c-86c3-317d5c834a4b */       \
 0x591bf748, 0xd91d, 0x400c,                       \
 {0x86, 0xc3, 0x31, 0x7d, 0x5c, 0x83, 0x4a, 0x4b}}

#define NS_SVSCHEMAFACET_CONTRACTID    \
"@mozilla.org/schemavalidator/schemafacet;1"

#define NS_SVSOAPARRAY_CID                         \
{ /* b3dc3c15-e4cc-4a5d-99aa-0b9ccca81664 */       \
 0xb3dc3c15, 0xe4cc, 0x4a5d,                       \
 {0x99, 0xaa, 0x0b, 0x9c, 0xcc, 0xa8, 0x16, 0x64}}

#define NS_SVSOAPARRAY_CONTRACTID    \
"@mozilla.org/schemavalidator/soaparray;1"

#define NS_SVSOAPARRAYTYPE_CID                     \
{ /* a3ecae90-09e3-449d-90d4-9f0f0b5e2c5a */       \
 0xa3ecae90, 0x09e3, 0x449d,                       \
 {0x90, 0xd4, 0x9f, 0x0f, 0x0b, 0x5e, 0x2c, 0x5a}}

#define NS_SVSOAPARRAYTYPE_CONTRACTID    \
"@mozilla.org/schemavalidator/soaparraytype;1"

#endif // __nsSchemaPrivate_h__
