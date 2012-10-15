/* -*- Mode: C; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* 
*   AppleDouble.h
*	-------------
*
*  	  The header file for a stream based apple single/double encodor/decodor.
*		
*		2aug95	mym		
*		
*/


#ifndef AppleDouble_h
#define AppleDouble_h

#include "msgCore.h"
#include "nsComposeStrings.h"
#include "nsIOutputStream.h"
#include "nsCOMPtr.h"

#include <CoreServices/CoreServices.h>

#define NOERR			0
#define errDone			1
								/* Done with current operation.	*/
#define errEOB			2
								/* 	End of a buffer.			*/
#define errEOP			3	
								/* 	End of a Part.				*/

					
#define errFileOpen		static_cast<uint32_t>(NS_MSG_UNABLE_TO_OPEN_TMP_FILE)
#define errFileWrite	-202 /*Error writing temporary file.*/
#define errUsrCancel	-2  /*MK_INTERRUPTED */
#define errDecoding		-1

/*
** The envirment block data type. 
*/
enum 
{ 
	kInit, 
	kDoingHeaderPortion, 
	kDoneHeaderPortion, 
	kDoingDataPortion, 
	kDoneDataPortion 
};

typedef struct _appledouble_encode_object 
{
    char    fname[256];
    FSIORefNum fileId;				/* the id for the open file (data/resource fork) */

	int 	state;
	int		text_file_type;		/* if the file has a text file type with it.	*/
	char	*boundary;			/* the boundary string.							*/

	int		status;				/* the error code if anyerror happens.			*/
	char 	b_overflow[200];
	int		s_overflow;
	
	int		state64;			/* the left over state of base64 enocding 		*/
	int		ct;					/* the character count of base64 encoding		*/
	int 	c1, c2;				/* the left of the last base64 encoding 		*/		

	char 	*outbuff;			/* the outbuff by the caller.           		*/
	int		s_outbuff;			/* the size of the buffer.						*/
	int		pos_outbuff;		/* the offset in the current buffer.			*/ 

} appledouble_encode_object;

/* The possible content transfer encodings */

enum 
{ 
	kEncodeNone,
	kEncodeQP,
	kEncodeBase64,
	kEncodeUU
};

enum 
{ 
	kGeneralMine,
	kAppleDouble,
	kAppleSingle
};

enum 
{ 
	kInline,
	kDontCare
};

enum 
{ 
	kHeaderPortion,
	kDataPortion
};

/* the decode states.	*/
enum 
{ 
	kBeginParseHeader = 3,
	kParsingHeader,
	kBeginSeekBoundary,
	kSeekingBoundary,
	kBeginHeaderPortion, 
	kProcessingHeaderPortion, 
	kBeginDataPortion, 
	kProcessingDataPortion, 
	kFinishing
};

/* uuencode states */
enum
{
	kWaitingForBegin = (int) 0,
	kBegin,
	kMainBody,
	kEnd
};

typedef struct _appledouble_decode_object 
{
	int		is_binary;
	int		is_apple_single;	/* if the object encoded is in apple single		*/
	int		write_as_binhex;
	
	int		messagetype;
	char*	boundary0;			/* the boundary for the enclosure.				*/
	int		deposition;			/* the deposition.								*/
	int		encoding;			/* the encoding method.							*/
	int		which_part;
	
	char	fname[256];
	// nsIOFileStream *fileSpec;					/* the stream for data fork work.					 */

	int 	state;
	
	int		rksize;				/* the resource fork size count.				*/
	int		dksize;				/* the data fork size count.					*/
	 
	int		status;				/* the error code if anyerror happens.			*/
	char 	b_leftover[256];
	int		s_leftover;
	
	int		encode;				/* the encode type of the message.				*/
	int		state64;			/* the left over state of base64 enocding 		*/
	int		left;				/* the character count of base64 encoding		*/
	int 	c[4];				/* the left of the last base64 encoding 		*/		
	int		uu_starts_line;		/* is decoder at the start of a line? (uuencode)	*/
	int		uu_state;			/* state w/r/t the uuencode body */
	int		uu_bytes_written;	/* bytes written from the current tuple (uuencode) */
	int		uu_line_bytes;		/* encoded bytes remaining in the current line (uuencode) */

	char 	*inbuff;			/* the outbuff by the caller.           		*/
	int		s_inbuff;			/* the size of the buffer.						*/
	int		pos_inbuff;			/* the offset in the current buffer.			*/ 


	nsCOMPtr <nsIFile> tmpFile;		/* the temp file to hold the decode data fork 	*/
								                      /* when doing the binhex exporting.				*/
  nsCOMPtr <nsIOutputStream> tmpFileStream; /* The output File Stream */
	int32_t	            data_size;			/* the size of the data in the tmp file.		*/

} appledouble_decode_object;


/*
**	The protypes.
*/

PR_BEGIN_EXTERN_C

int ap_encode_init(appledouble_encode_object *p_ap_encode_obj, 
					const char* fname,
					char* separator);

int ap_encode_next(appledouble_encode_object* p_ap_encode_obj, 
					char 	*to_buff,
					int32_t 	buff_size,
					int32_t*	real_size);

int ap_encode_end(appledouble_encode_object* p_ap_encode_obj,
					bool	is_aborting);

int ap_decode_init(appledouble_decode_object* p_ap_decode_obj,
					bool	is_apple_single,
					bool	write_as_bin_hex,
					void  	*closure);

int ap_decode_next(appledouble_decode_object* p_ap_decode_obj, 
					char 	*in_buff, 
					int32_t 	buff_size);

int ap_decode_end(appledouble_decode_object* p_ap_decode_obj, 
				 	bool is_aborting);

PR_END_EXTERN_C

#endif
