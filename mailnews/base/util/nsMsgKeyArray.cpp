/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * ***** BEGIN LICENSE BLOCK *****
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
 * The Original Code is MailNews nsMsgKeyArray
 *
 * The Initial Developer of the Original Code is
 * the Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   David Bienvenu <bienvenu@mozilla.com>
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

#include "nsMsgKeyArray.h"
#include "nsMemory.h"

NS_IMPL_ISUPPORTS1(nsMsgKeyArray, nsIMsgKeyArray)

nsMsgKeyArray::nsMsgKeyArray()
{
}

nsMsgKeyArray::~nsMsgKeyArray()
{
}

NS_IMETHODIMP nsMsgKeyArray::Sort()
{
  m_keys.Sort();
  return NS_OK;
}

NS_IMETHODIMP nsMsgKeyArray::GetKeyAt(PRInt32 aIndex, nsMsgKey *aKey)
{
  NS_ENSURE_ARG_POINTER(aKey);
  *aKey = m_keys[aIndex];
  return NS_OK;
}

NS_IMETHODIMP nsMsgKeyArray::GetLength(PRUint32 *aLength)
{
  NS_ENSURE_ARG_POINTER(aLength);
  *aLength = m_keys.Length();
  return NS_OK;
}

NS_IMETHODIMP nsMsgKeyArray::SetCapacity(PRUint32 aCapacity)
{
  m_keys.SetCapacity(aCapacity);
  return NS_OK;
}

NS_IMETHODIMP nsMsgKeyArray::AppendElement(nsMsgKey aKey)
{
  m_keys.AppendElement(aKey);
  return NS_OK;
}

NS_IMETHODIMP nsMsgKeyArray::GetArray(PRUint32 *aCount, nsMsgKey **aKeys)
{
  NS_ENSURE_ARG_POINTER(aCount);
  NS_ENSURE_ARG_POINTER(aKeys);
  *aCount = m_keys.Length();
  *aKeys =
    (nsMsgKey *) nsMemory::Clone(&m_keys[0],
                                 m_keys.Length() * sizeof(nsMsgKey));
  return (*aKeys) ? NS_OK : NS_ERROR_OUT_OF_MEMORY;
}

