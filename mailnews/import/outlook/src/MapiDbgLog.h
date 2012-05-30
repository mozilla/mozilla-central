/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef MapiDbgLog_h___
#define MapiDbgLog_h___

/*
#ifdef NS_DEBUG
#define MAPI_DEBUG  1
#endif
*/

#ifdef MAPI_DEBUG
#include <stdio.h>

#define MAPI_DUMP_STRING(x)    printf("%s", (const char *)x)
#define MAPI_TRACE0(x)        printf(x)
#define MAPI_TRACE1(x, y)      printf(x, y)
#define MAPI_TRACE2(x, y, z)    printf(x, y, z)
#define MAPI_TRACE3(x, y, z, a)  printf(x, y, z, a)
#define MAPI_TRACE4(x, y, z, a, b) printf(x, y, z, a, b)


#else

#define MAPI_DUMP_STRING(x)
#define  MAPI_TRACE0(x)
#define  MAPI_TRACE1(x, y)
#define  MAPI_TRACE2(x, y, z)
#define MAPI_TRACE3(x, y, z, a)
#define MAPI_TRACE4(x, y, z, a, b)

#endif



#endif /* MapiDbgLog_h___ */

