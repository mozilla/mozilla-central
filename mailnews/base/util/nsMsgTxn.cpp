/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
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
 *    Prasad Sunkari <prasad@medhas.org>
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

#include "nsMsgTxn.h"
#include "nsIMsgHdr.h"
#include "nsIMsgDatabase.h"
#include "nsCOMArray.h"
#include "nsArrayEnumerator.h"
#include "nsComponentManagerUtils.h"
#include "nsIVariant.h"
#include "nsIProperty.h"
#include "nsMsgMessageFlags.h"

NS_IMPL_THREADSAFE_ADDREF(nsMsgTxn)
NS_IMPL_THREADSAFE_RELEASE(nsMsgTxn)
NS_INTERFACE_MAP_BEGIN(nsMsgTxn)
  NS_INTERFACE_MAP_ENTRY(nsIWritablePropertyBag)
  NS_INTERFACE_MAP_ENTRY_AMBIGUOUS(nsIPropertyBag, nsIWritablePropertyBag)
  NS_INTERFACE_MAP_ENTRY_AMBIGUOUS(nsISupports, nsIWritablePropertyBag)
  NS_INTERFACE_MAP_ENTRY(nsITransaction)
  NS_INTERFACE_MAP_ENTRY(nsIPropertyBag2)
  NS_INTERFACE_MAP_ENTRY(nsIWritablePropertyBag2)
NS_INTERFACE_MAP_END

nsMsgTxn::nsMsgTxn() 
{
  m_txnType = 0;
}

nsMsgTxn::~nsMsgTxn()
{
}

nsresult nsMsgTxn::Init()
{
  return mPropertyHash.Init() ? NS_OK : NS_ERROR_OUT_OF_MEMORY;
}

NS_IMETHODIMP nsMsgTxn::HasKey(const nsAString& name, PRBool *aResult)
{
  *aResult = mPropertyHash.Get(name, nsnull);
  return NS_OK;
}

NS_IMETHODIMP nsMsgTxn::Get(const nsAString& name, nsIVariant* *_retval)
{
  mPropertyHash.Get(name, _retval);
  return NS_OK;
}

NS_IMETHODIMP nsMsgTxn::GetProperty(const nsAString& name, nsIVariant* * _retval)
{
  return mPropertyHash.Get(name, _retval) ? NS_OK : NS_ERROR_FAILURE;
}

NS_IMETHODIMP nsMsgTxn::SetProperty(const nsAString& name, nsIVariant *value)
{
  NS_ENSURE_ARG_POINTER(value);
  return mPropertyHash.Put(name, value) ? NS_OK : NS_ERROR_FAILURE;
}

NS_IMETHODIMP nsMsgTxn::DeleteProperty(const nsAString& name)
{
  if (!mPropertyHash.Get(name, nsnull))
    return NS_ERROR_FAILURE;

  mPropertyHash.Remove(name);
  return mPropertyHash.Get(name, nsnull) ? NS_ERROR_FAILURE : NS_OK;
}

//
// nsSimpleProperty class and impl; used for GetEnumerator
//

class nsSimpleProperty : public nsIProperty 
{
public:
  nsSimpleProperty(const nsAString& aName, nsIVariant* aValue)
      : mName(aName), mValue(aValue)
  {
  }

  NS_DECL_ISUPPORTS
  NS_DECL_NSIPROPERTY
protected:
  nsString mName;
  nsCOMPtr<nsIVariant> mValue;
};

NS_IMPL_ISUPPORTS1(nsSimpleProperty, nsIProperty)

NS_IMETHODIMP nsSimpleProperty::GetName(nsAString& aName)
{
  aName.Assign(mName);
  return NS_OK;
}

NS_IMETHODIMP nsSimpleProperty::GetValue(nsIVariant* *aValue)
{
  NS_IF_ADDREF(*aValue = mValue);
  return NS_OK;
}

// end nsSimpleProperty

static PLDHashOperator
PropertyHashToArrayFunc (const nsAString &aKey,
                         nsIVariant* aData,
                         void *userArg)
{
  nsCOMArray<nsIProperty> *propertyArray =
      static_cast<nsCOMArray<nsIProperty> *>(userArg);
  nsSimpleProperty *sprop = new nsSimpleProperty(aKey, aData);
  propertyArray->AppendObject(sprop);
  return PL_DHASH_NEXT;
}

NS_IMETHODIMP nsMsgTxn::GetEnumerator(nsISimpleEnumerator* *_retval)
{
  nsCOMArray<nsIProperty> propertyArray;
  mPropertyHash.EnumerateRead(PropertyHashToArrayFunc, &propertyArray);
  return NS_NewArrayEnumerator(_retval, propertyArray);
}

#define IMPL_GETSETPROPERTY_AS(Name, Type) \
NS_IMETHODIMP \
nsMsgTxn::GetPropertyAs ## Name (const nsAString & prop, Type *_retval) \
{ \
    nsIVariant* v = mPropertyHash.GetWeak(prop); \
    if (!v) \
        return NS_ERROR_NOT_AVAILABLE; \
    return v->GetAs ## Name(_retval); \
} \
\
NS_IMETHODIMP \
nsMsgTxn::SetPropertyAs ## Name (const nsAString & prop, Type value) \
{ \
    nsresult rv; \
    nsCOMPtr<nsIWritableVariant> var = do_CreateInstance(NS_VARIANT_CONTRACTID, &rv); \
    NS_ENSURE_SUCCESS(rv, rv); \
    var->SetAs ## Name(value); \
    return SetProperty(prop, var); \
}

IMPL_GETSETPROPERTY_AS(Int32, PRInt32)
IMPL_GETSETPROPERTY_AS(Uint32, PRUint32)
IMPL_GETSETPROPERTY_AS(Int64, PRInt64)
IMPL_GETSETPROPERTY_AS(Uint64, PRUint64)
IMPL_GETSETPROPERTY_AS(Double, double)
IMPL_GETSETPROPERTY_AS(Bool, PRBool)

NS_IMETHODIMP nsMsgTxn::GetPropertyAsAString(const nsAString & prop, 
                                             nsAString & _retval)
{
  nsIVariant* v = mPropertyHash.GetWeak(prop);
  if (!v)
    return NS_ERROR_NOT_AVAILABLE;
  return v->GetAsAString(_retval);
}

NS_IMETHODIMP nsMsgTxn::GetPropertyAsACString(const nsAString & prop, 
                                              nsACString & _retval)
{
  nsIVariant* v = mPropertyHash.GetWeak(prop);
  if (!v)
    return NS_ERROR_NOT_AVAILABLE;
  return v->GetAsACString(_retval);
}

NS_IMETHODIMP nsMsgTxn::GetPropertyAsAUTF8String(const nsAString & prop, 
                                                 nsACString & _retval)
{
  nsIVariant* v = mPropertyHash.GetWeak(prop);
  if (!v)
    return NS_ERROR_NOT_AVAILABLE;
  return v->GetAsAUTF8String(_retval);
}

NS_IMETHODIMP nsMsgTxn::GetPropertyAsInterface(const nsAString & prop,
                                               const nsIID & aIID,
                                               void** _retval)
{
  nsIVariant* v = mPropertyHash.GetWeak(prop);
  if (!v)
    return NS_ERROR_NOT_AVAILABLE;
  nsCOMPtr<nsISupports> val;
  nsresult rv = v->GetAsISupports(getter_AddRefs(val));
  if (NS_FAILED(rv))
    return rv;
  if (!val) {
    // We have a value, but it's null
    *_retval = nsnull;
    return NS_OK;
  }
  return val->QueryInterface(aIID, _retval);
}

NS_IMETHODIMP nsMsgTxn::SetPropertyAsAString(const nsAString & prop, 
                                             const nsAString & value)
{
  nsresult rv;
  nsCOMPtr<nsIWritableVariant> var = do_CreateInstance(NS_VARIANT_CONTRACTID, &rv); 
  NS_ENSURE_SUCCESS(rv, rv); 
  var->SetAsAString(value);
  return SetProperty(prop, var);
}

NS_IMETHODIMP nsMsgTxn::SetPropertyAsACString(const nsAString & prop, 
                                              const nsACString & value)
{
  nsresult rv;
  nsCOMPtr<nsIWritableVariant> var = do_CreateInstance(NS_VARIANT_CONTRACTID, &rv); 
  NS_ENSURE_SUCCESS(rv, rv); 
  var->SetAsACString(value);
  return SetProperty(prop, var);
}

NS_IMETHODIMP nsMsgTxn::SetPropertyAsAUTF8String(const nsAString & prop, 
                                                 const nsACString & value)
{
  nsresult rv;
  nsCOMPtr<nsIWritableVariant> var = do_CreateInstance(NS_VARIANT_CONTRACTID, &rv); 
  NS_ENSURE_SUCCESS(rv, rv); 
  var->SetAsAUTF8String(value);
  return SetProperty(prop, var);
}

NS_IMETHODIMP nsMsgTxn::SetPropertyAsInterface(const nsAString & prop, 
                                               nsISupports* value)
{
  nsresult rv;
  nsCOMPtr<nsIWritableVariant> var = do_CreateInstance(NS_VARIANT_CONTRACTID, &rv); 
  NS_ENSURE_SUCCESS(rv, rv); 
  var->SetAsISupports(value);
  return SetProperty(prop, var);
}

/////////////////////// Transaction Stuff //////////////////
NS_IMETHODIMP nsMsgTxn::DoTransaction(void)
{
  return NS_OK;
}

NS_IMETHODIMP nsMsgTxn::GetIsTransient(PRBool *aIsTransient)
{
  if (nsnull!=aIsTransient)
    *aIsTransient = PR_FALSE;
  else
    return NS_ERROR_NULL_POINTER;
  return NS_OK;
}

NS_IMETHODIMP nsMsgTxn::Merge(nsITransaction *aTransaction, PRBool *aDidMerge)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


nsresult nsMsgTxn::GetMsgWindow(nsIMsgWindow **msgWindow)
{
    if (!msgWindow || !m_msgWindow)
        return NS_ERROR_NULL_POINTER;
    *msgWindow = m_msgWindow;
    NS_ADDREF (*msgWindow);
    return NS_OK;
}

nsresult nsMsgTxn::SetMsgWindow(nsIMsgWindow *msgWindow)
{
    m_msgWindow = msgWindow;
    return NS_OK;
}


nsresult
nsMsgTxn::SetTransactionType(PRUint32 txnType)
{
  return SetPropertyAsUint32(NS_LITERAL_STRING("type"), txnType);
}

/*none of the callers pass null aFolder, 
  we always initialize aResult (before we pass in) for the case where the key is not in the db*/
nsresult 
nsMsgTxn::CheckForToggleDelete(nsIMsgFolder *aFolder, const nsMsgKey &aMsgKey, PRBool *aResult)
{
  NS_ENSURE_ARG(aResult);
  nsCOMPtr<nsIMsgDBHdr> message;
  nsCOMPtr<nsIMsgDatabase> db;
  nsresult rv = aFolder->GetMsgDatabase(nsnull,getter_AddRefs(db));
  if (db)
  {
    PRBool containsKey;
    rv = db->ContainsKey(aMsgKey, &containsKey);
    if (NS_FAILED(rv) || !containsKey)   // the message has been deleted from db, so we cannot do toggle here
      return NS_OK;
    rv = db->GetMsgHdrForKey(aMsgKey, getter_AddRefs(message));
    PRUint32 flags;
    if (NS_SUCCEEDED(rv) && message)
    {
      message->GetFlags(&flags);
      *aResult = (flags & MSG_FLAG_IMAP_DELETED) != 0;
    }
  }
  return rv;
}
