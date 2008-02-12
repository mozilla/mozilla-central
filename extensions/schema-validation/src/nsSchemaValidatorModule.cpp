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
 * The Original Code is Mozilla Schema Validation.
 *
 * The Initial Developer of the Original Code is
 * IBM Corporation.
 * Portions created by the Initial Developer are Copyright (C) 2004
 * IBM Corporation. All Rights Reserved.
 *
 * Contributor(s):
 *   Doron Rosenberg <doronr@us.ibm.com> (original author)
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

#include "nsIGenericFactory.h"
#include "nsSchemaValidator.h"
#include "nsSchemaDuration.h"
#include "nsSchemaLoader.h"
#include "nsSchemaPrivate.h"

NS_GENERIC_FACTORY_CONSTRUCTOR(nsSchemaValidator)
NS_GENERIC_FACTORY_CONSTRUCTOR_INIT(nsSchemaLoader, Init)
NS_GENERIC_FACTORY_CONSTRUCTOR_INIT(nsBuiltinSchemaCollection, Init)

static const nsModuleComponentInfo components[] = {
  { "SchemaValidator",
    NS_SCHEMAVALIDATOR_CID,
    NS_SCHEMAVALIDATOR_CONTRACTID,
    nsSchemaValidatorConstructor },

  { "SchemaDuration",
    NS_SCHEMADURATION_CID,
    NS_SCHEMADURATION_CONTRACTID,
    nsnull },

  { "SchemaLoader",
    NS_SVSCHEMALOADER_CID,
    NS_SVSCHEMALOADER_CONTRACTID,
    nsSchemaLoaderConstructor,
    nsnull },

  { "Schema",
    NS_SVSCHEMA_CID,
    NS_SVSCHEMA_CONTRACTID,
    nsnull },

  { "SchemaBuiltinType",
    NS_SVSCHEMABUILTINTYPE_CID,
    NS_SVSCHEMABUILTINTYPE_CONTRACTID,
    nsnull },

  { "SchemaListType",
    NS_SVSCHEMALISTTYPE_CID,
    NS_SVSCHEMALISTTYPE_CONTRACTID,
    nsnull },

  { "SchemaUnionType",
    NS_SVSCHEMAUNIONTYPE_CID,
    NS_SVSCHEMAUNIONTYPE_CONTRACTID,
    nsnull },

  { "SchemaRestrictionType",
    NS_SVSCHEMARESTRICTIONTYPE_CID,
    NS_SVSCHEMARESTRICTIONTYPE_CONTRACTID,
    nsnull },

  { "SchemaComplexType",
    NS_SVSCHEMACOMPLEXTYPE_CID,
    NS_SVSCHEMACOMPLEXTYPE_CONTRACTID,
    nsnull },

  { "SchemaTypePlaceholder",
    NS_SVSCHEMATYPEPLACEHOLDER_CID,
    NS_SVSCHEMATYPEPLACEHOLDER_CONTRACTID,
    nsnull },
    
  { "SchemaModelGroup",
    NS_SVSCHEMAMODELGROUP_CID,
    NS_SVSCHEMAMODELGROUP_CONTRACTID,
    nsnull },

  { "SchemaModelGroupRef",
    NS_SVSCHEMAMODELGROUPREF_CID,
    NS_SVSCHEMAMODELGROUPREF_CONTRACTID,
    nsnull },

  { "SchemaAnyParticle",
    NS_SVSCHEMAANYPARTICLE_CID,
    NS_SVSCHEMAANYPARTICLE_CONTRACTID,
    nsnull },

  { "SchemaElement",
    NS_SVSCHEMAELEMENT_CID,
    NS_SVSCHEMAELEMENT_CONTRACTID,
    nsnull },

  { "SchemaElementRef",
    NS_SVSCHEMAELEMENTREF_CID,
    NS_SVSCHEMAELEMENTREF_CONTRACTID,
    nsnull },

  { "SchemaAttribute",
    NS_SVSCHEMAATTRIBUTE_CID,
    NS_SVSCHEMAATTRIBUTE_CONTRACTID,
    nsnull },

  { "SchemaAttributeRef",
    NS_SVSCHEMAATTRIBUTEREF_CID,
    NS_SVSCHEMAATTRIBUTEREF_CONTRACTID,
    nsnull },
    
  { "SchemaAttributeGroup",
    NS_SVSCHEMAATTRIBUTEGROUP_CID,
    NS_SVSCHEMAATTRIBUTEGROUP_CONTRACTID,
    nsnull },

  { "SchemaAttributeGroupRef",
    NS_SVSCHEMAATTRIBUTEGROUPREF_CID,
    NS_SVSCHEMAATTRIBUTEGROUPREF_CONTRACTID,
    nsnull },

  { "SchemaAnyAttribute",
    NS_SVSCHEMAANYATTRIBUTE_CID,
    NS_SVSCHEMAANYATTRIBUTE_CONTRACTID,
    nsnull },
    
  { "SchemaFacet",
    NS_SVSCHEMAFACET_CID,
    NS_SVSCHEMAFACET_CONTRACTID,
    nsnull },

  { "SOAPArray",
    NS_SVSOAPARRAY_CID,
    NS_SVSOAPARRAY_CONTRACTID,
    nsnull },

  { "SOAPArrayType",
    NS_SVSOAPARRAYTYPE_CID,
    NS_SVSOAPARRAYTYPE_CONTRACTID,
    nsnull },

  { "Builtin Schema Collection",
    NS_SVBUILTINSCHEMACOLLECTION_CID,
    NS_SVBUILTINSCHEMACOLLECTION_CONTRACTID,
    nsBuiltinSchemaCollectionConstructor }
};

PR_STATIC_CALLBACK(nsresult)
SchemaValidatorModuleCtor(nsIModule* aSelf)
{
  return nsSchemaAtoms::AddRefAtoms();
}

NS_IMPL_NSGETMODULE_WITH_CTOR(schemavalidation, components, SchemaValidatorModuleCtor)
