/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
*
*   apple-double.c
*	--------------
*
*  	  The codes to do apple double encoding/decoding.
*		
*		02aug95		mym		created.
*		
*/
#include "nsID.h"
#include "nscore.h"
#include "nsStringGlue.h"
#include "nsMsgAppleDouble.h"
#include "nsMsgAppleCodes.h"
#include "nsMsgCompUtils.h"
#include "nsCExternalHandlerService.h"
#include "nsIMIMEService.h"
#include "nsMimeTypes.h"
#include "prmem.h"
#include "nsNetUtil.h"


void	
MacGetFileType(nsIFile   *fs, 
               bool         *useDefault, 
               char         **fileType, 
               char         **encoding)
{
	if ((fs == NULL) || (fileType == NULL) || (encoding == NULL))
		return;

  bool exists = false;
  fs->Exists(&exists);
  if (!exists)
    return;

	*useDefault = TRUE;
	*fileType = NULL;
	*encoding = NULL;

  nsCOMPtr<nsILocalFileMac> macFile = do_QueryInterface(fs);
  FSRef fsRef;
  FSCatalogInfo catalogInfo;
  OSErr err = errFileOpen;
  if (NS_SUCCEEDED(macFile->GetFSRef(&fsRef)))
    err = ::FSGetCatalogInfo(&fsRef, kFSCatInfoFinderInfo, &catalogInfo, nullptr, nullptr, nullptr);

  if ( (err != noErr) || (((FileInfo*)(&catalogInfo.finderInfo))->fileType == 'TEXT') )
    *fileType = strdup(APPLICATION_OCTET_STREAM);
  else
  {
    // At this point, we should call the mime service and
    // see what we can find out?
    nsresult      rv;
    nsCOMPtr <nsIURI> tURI;
    if (NS_SUCCEEDED(NS_NewFileURI(getter_AddRefs(tURI), fs)) && tURI)
    {
      nsCOMPtr<nsIMIMEService> mimeFinder (do_GetService(NS_MIMESERVICE_CONTRACTID, &rv));
      if (NS_SUCCEEDED(rv) && mimeFinder) 
      {
        nsAutoCString mimeType;
        rv = mimeFinder->GetTypeFromURI(tURI, mimeType);
        if (NS_SUCCEEDED(rv)) 
        {
          *fileType = ToNewCString(mimeType);
          return;
        }        
      }
    }

    // If we hit here, return something...default to this...
    *fileType = strdup(APPLICATION_OCTET_STREAM);
  }
}

#pragma cplusplus reset

/*
*	ap_encode_init
*	--------------
*	
*	Setup the encode envirment
*/

int ap_encode_init( appledouble_encode_object *p_ap_encode_obj,
                    const char                *fname,
                    char                      *separator)
{
  nsCOMPtr <nsIFile> myFile;
  NS_NewNativeLocalFile(nsDependentCString(fname), true, getter_AddRefs(myFile));
  bool exists;
  if (myFile && NS_SUCCEEDED(myFile->Exists(&exists)) && !exists)
    return -1;

  nsCOMPtr<nsILocalFileMac> macFile = do_QueryInterface(myFile);
  nsAutoCString path;
  macFile->GetNativePath(path);

	memset(p_ap_encode_obj, 0, sizeof(appledouble_encode_object));
	
	/*
	**	Fill out the source file inforamtion.
	*/	
  memcpy(p_ap_encode_obj->fname, path.get(), path.Length());
  p_ap_encode_obj->fname[path.Length()] = '\0';
	
	p_ap_encode_obj->boundary = strdup(separator);
	return noErr;
}

/*
**	ap_encode_next
**	--------------
**		
**		return :
**			noErr	:	everything is ok
**			errDone	:	when encoding is done.
**			errors	:	otherwise.
*/
int ap_encode_next(
	appledouble_encode_object* p_ap_encode_obj, 
	char 	*to_buff, 
	int32_t 	buff_size, 
	int32_t* 	real_size)
{
	int status;
	
	/*
	** 	install the out buff now.
	*/
	p_ap_encode_obj->outbuff     = to_buff;
	p_ap_encode_obj->s_outbuff 	 = buff_size;
	p_ap_encode_obj->pos_outbuff = 0;
	
	/*
	**	first copy the outstandind data in the overflow buff to the out buffer. 
	*/
	if (p_ap_encode_obj->s_overflow)
	{
		status = write_stream(p_ap_encode_obj, 
								p_ap_encode_obj->b_overflow,
								p_ap_encode_obj->s_overflow);
		if (status != noErr)
			return status;
				
		p_ap_encode_obj->s_overflow = 0;
	}

	/*
	** go the next processing stage based on the current state. 
	*/
	switch (p_ap_encode_obj->state)
	{
		case kInit:
			/*
			** We are in the  starting position, fill out the header.
			*/
			status = fill_apple_mime_header(p_ap_encode_obj); 
			if (status != noErr)
				break;					/* some error happens */
				
			p_ap_encode_obj->state = kDoingHeaderPortion;
			status = ap_encode_header(p_ap_encode_obj, true); 
										/* it is the first time to calling 		*/							
			if (status == errDone)
			{
				p_ap_encode_obj->state = kDoneHeaderPortion;
			}
			else
			{
				break;					/* we need more work on header portion.	*/
			}			
				
			/*
			** we are done with the header, so let's go to the data port.
			*/
			p_ap_encode_obj->state = kDoingDataPortion;
			status = ap_encode_data(p_ap_encode_obj, true);		 	
										/* it is first time call do data portion */
							
			if (status == errDone)
			{
				p_ap_encode_obj->state  = kDoneDataPortion;
				status = noErr;
			}
			break;

		case kDoingHeaderPortion:
		
			status = ap_encode_header(p_ap_encode_obj, false); 			
										/* continue with the header portion.	*/
			if (status == errDone)
			{
				p_ap_encode_obj->state = kDoneHeaderPortion;
			}
			else
			{
				break;					/* we need more work on header portion.	*/				
			}
			
			/*
			** start the data portion.
			*/
			p_ap_encode_obj->state = kDoingDataPortion;
			status = ap_encode_data(p_ap_encode_obj, true); 					
										/* it is the first time calling 		*/
			if (status == errDone)
			{
				p_ap_encode_obj->state  = kDoneDataPortion;
				status = noErr;
			}
			break;

		case kDoingDataPortion:
		
			status = ap_encode_data(p_ap_encode_obj, false); 				
										/* it is not the first time				*/
													
			if (status == errDone)
			{
				p_ap_encode_obj->state = kDoneDataPortion;
				status = noErr;
			}
			break;

		case kDoneDataPortion:
				status = errDone;		/* we are really done.					*/

			break;
	}
	
	*real_size = p_ap_encode_obj->pos_outbuff;
	return status;
}

/*
**	ap_encode_end
**	-------------
**
**	clear the apple encoding.
*/

int ap_encode_end(
	appledouble_encode_object *p_ap_encode_obj, 
	bool is_aborting)
{
	/*
	** clear up the apple doubler.
	*/
	if (p_ap_encode_obj == NULL)
		return noErr;

	if (p_ap_encode_obj->fileId)			/* close the file if it is open.	*/
    ::FSCloseFork(p_ap_encode_obj->fileId);

	PR_FREEIF(p_ap_encode_obj->boundary);		/* the boundary string.				*/
	
	return noErr;
}
