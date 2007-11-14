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
 * The Original Code is the PKIX-C library.
 *
 * The Initial Developer of the Original Code is
 * Sun Microsystems, Inc.
 * Portions created by the Initial Developer are
 * Copyright 2004-2007 Sun Microsystems, Inc.  All Rights Reserved.
 *
 * Contributor(s):
 *   Sun Microsystems, Inc.
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
/*
 * pkix_error.c
 *
 * Error Object Functions
 *
 */

#define PKIX_STDVARS_POINTER
#include "pkix_error.h"

const PKIX_StdVars zeroStdVars;

PKIX_Error *
PKIX_DoThrow(PKIX_StdVars * stdVars, PKIX_ERRORCLASS errClass, 
             PKIX_ERRORCODE errCode, void *plContext)
{
    pkixTempResult = (PKIX_Error*)pkix_Throw(errClass, myFuncName, errCode,
	                 pkixErrorResult, &pkixReturnResult, plContext);
    if (pkixErrorResult != PKIX_ALLOC_ERROR())
	PKIX_DECREF(pkixErrorResult);
    if (pkixTempResult)
	return pkixTempResult;
    return pkixReturnResult;
}

PKIX_Error *
PKIX_DoReturn(PKIX_StdVars * stdVars, PKIX_ERRORCLASS errClass,
              PKIX_Boolean doLogger, void *plContext)
{
    PKIX_OBJECT_UNLOCK(lockedObject);
    if ((pkixErrorReceived) || (pkixErrorResult))
	return PKIX_DoThrow(stdVars, errClass, pkixErrorCode, plContext);
    /* PKIX_DEBUG_EXIT(type); */
    if (doLogger)
	_PKIX_DEBUG_TRACE(pkixLoggersDebugTrace, "<<<", PKIX_LOGGER_LEVEL_TRACE);
    return NULL;
}

PKIX_Error *
PKIX_DoCheck(PKIX_StdVars * stdVars, PKIX_ERRORCODE errCode, void *plContext)
{
    pkixTempResult = 
	PKIX_Error_GetErrorClass(pkixErrorResult, &pkixErrorClass, plContext);
    if (pkixTempResult)
	return pkixTempResult;
    pkixErrorMsg = PKIX_ErrorText[errCode];
    if (pkixErrorClass == PKIX_FATAL_ERROR)
	return PKIX_DoReturn(stdVars, pkixErrorClass, PKIX_TRUE, plContext);
    return NULL;
}
