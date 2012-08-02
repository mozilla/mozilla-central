/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsFts3Tokenizer.h"

#include "nsGlodaRankerFunction.h"

#include "nsIFts3Tokenizer.h"
#include "mozIStorageConnection.h"
#include "mozIStorageStatement.h"
#include "nsStringGlue.h"

extern "C" void sqlite3Fts3PorterTokenizerModule(
  sqlite3_tokenizer_module const**ppModule);

extern "C" void glodaRankFunc(sqlite3_context *pCtx,
                              int nVal,
                              sqlite3_value **apVal);

NS_IMPL_ISUPPORTS1(nsFts3Tokenizer,nsIFts3Tokenizer)

nsFts3Tokenizer::nsFts3Tokenizer()
{
}

nsFts3Tokenizer::~nsFts3Tokenizer()
{
}

NS_IMETHODIMP
nsFts3Tokenizer::RegisterTokenizer(mozIStorageConnection *connection)
{
  nsresult rv;
  nsCOMPtr<mozIStorageStatement> selectStatement;

  // -- register the tokenizer
  rv = connection->CreateStatement(NS_LITERAL_CSTRING(
    "SELECT fts3_tokenizer(?1, ?2)"),
    getter_AddRefs(selectStatement));
  NS_ENSURE_SUCCESS(rv, rv);

  const sqlite3_tokenizer_module* module = nullptr;
  sqlite3Fts3PorterTokenizerModule(&module);
  if (!module)
    return NS_ERROR_FAILURE;

  rv = selectStatement->BindUTF8StringParameter(
         0, NS_LITERAL_CSTRING("mozporter"));
  NS_ENSURE_SUCCESS(rv, rv);
  rv = selectStatement->BindBlobParameter(1,
                                          (PRUint8*)&module,
                                          sizeof(module));
  NS_ENSURE_SUCCESS(rv, rv);

  bool hasMore;
  rv = selectStatement->ExecuteStep(&hasMore);
  NS_ENSURE_SUCCESS(rv, rv);

  // -- register the ranking function
  nsCOMPtr<mozIStorageFunction> func = new nsGlodaRankerFunction();
  NS_ENSURE_TRUE(func, NS_ERROR_OUT_OF_MEMORY);
  rv = connection->CreateFunction(
         NS_LITERAL_CSTRING("glodaRank"),
         -1, // variable argument support
         func
       );
  NS_ENSURE_SUCCESS(rv, rv);

  return rv;
}
