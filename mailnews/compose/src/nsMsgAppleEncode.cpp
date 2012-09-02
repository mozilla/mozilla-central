/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 *
 *   apple_double_encode.c
 *	 ---------------------
 *
 *    The routines doing the Apple Double Encoding.
 *		
 *			2aug95	mym	Created.
 *		
 */

#include "nscore.h"
#include "nsStringGlue.h"
#include "nsMimeTypes.h"
#include "prprf.h"
#include "nsServiceManagerUtils.h"
#include "nsMsgAppleDouble.h"
#include "nsMsgAppleCodes.h"
#include "nsILocalFileMac.h"

/*
**	Local Functions prototypes.
*/
static int output64chunk( appledouble_encode_object* p_ap_encode_obj, 
				int c1, int c2, int c3, int pads);
				
static int to64(appledouble_encode_object* p_ap_encode_obj, 
				char	*p, 
				int 	in_size);
 
static int finish64(appledouble_encode_object* p_ap_encode_obj);


#define BUFF_LEFT(p)	((p)->s_outbuff - (p)->pos_outbuff)	

/*
**	write_stream.
*/
int write_stream(
	appledouble_encode_object *p_ap_encode_obj,
	char 	*out_string,
	int	 	len)			
{	
	if (p_ap_encode_obj->pos_outbuff + len < p_ap_encode_obj->s_outbuff)
	{
		memcpy(p_ap_encode_obj->outbuff + p_ap_encode_obj->pos_outbuff, 
		       out_string, 
		       len);
		p_ap_encode_obj->pos_outbuff += len;
		return noErr;
	}
	else
	{
		/*
		**	If the buff doesn't have enough space, use the overflow buffer then.
		*/
		int s_len = p_ap_encode_obj->s_outbuff - p_ap_encode_obj->pos_outbuff;
		
		memcpy(p_ap_encode_obj->outbuff + p_ap_encode_obj->pos_outbuff, 
		       out_string, 
		       s_len);
		memcpy(p_ap_encode_obj->b_overflow + p_ap_encode_obj->s_overflow,
		       out_string + s_len,
		       p_ap_encode_obj->s_overflow += (len - s_len));
		p_ap_encode_obj->pos_outbuff += s_len;
		return errEOB;
	}
}

int fill_apple_mime_header(
	appledouble_encode_object *p_ap_encode_obj)
{
	int  status;
	
	char tmpstr[266];
	
#if 0	
//	strcpy(tmpstr, "Content-Type: multipart/mixed; boundary=\"-\"\n\n---\n");
//	status = write_stream(p_ap_encode_env, 
//						tmpstr,
//						strlen(tmpstr));
//	if (status != noErr)
//		return status;

	PR_snprintf(tmpstr, sizeof(tmpstr),
			"Content-Type: multipart/appledouble; boundary=\"=\"; name=\"");
	status = write_stream(p_ap_encode_obj, 
						tmpstr,
						strlen(tmpstr));
	if (status != noErr)
		return status;
		
	status = write_stream(p_ap_encode_obj,
						p_ap_encode_obj->fname,
						strlen(p_ap_encode_obj->fname));
	if (status != noErr)
		return status;
		
	PR_snprintf(tmpstr, sizeof(tmpstr),
			"\"\r\nContent-Disposition: inline; filename=\"%s\"\r\n\r\n\r\n--=\r\n",
			p_ap_encode_obj->fname);
#endif /* 0 */
	PR_snprintf(tmpstr, sizeof(tmpstr), "--%s" CRLF, p_ap_encode_obj->boundary);
	status = write_stream(p_ap_encode_obj, 
						tmpstr, 
						strlen(tmpstr));
	return status;
} 

int ap_encode_file_infor(
	appledouble_encode_object *p_ap_encode_obj)
{
	ap_header	head;
	ap_entry 	entries[NUM_ENTRIES];
	ap_dates 	dates;
	short 		i;
	long 		comlen;
	char 		comment[256];
	int	 		status;
    
    nsCOMPtr <nsIFile> resFile;
    NS_NewNativeLocalFile(nsDependentCString(p_ap_encode_obj->fname), true,
                          getter_AddRefs(resFile));
    if (!resFile)
        return errFileOpen;

    FSRef ref;
    nsCOMPtr <nsILocalFileMac> macFile = do_QueryInterface(resFile);
    if (NS_FAILED(macFile->GetFSRef(&ref)))
        return errFileOpen;

    FSCatalogInfo catalogInfo;
    if (::FSGetCatalogInfo(&ref, kFSCatInfoFinderInfo, &catalogInfo, nullptr, nullptr, nullptr) != noErr)
	{
		return errFileOpen;
	}

	/* get a file comment, if possible */
#if 1
    // Carbon doesn't support GetWDInfo(). (Bug 555684)

    // not sure why working directories are needed here...
    comlen = 0;
#else
	long 		procID;
	procID = 0;
	GetWDInfo(p_ap_encode_obj->vRefNum, &fpb->ioVRefNum, &fpb->ioDirID, &procID);
	IOParam 	vinfo;
	memset((void *) &vinfo, '\0', sizeof (vinfo));
	GetVolParmsInfoBuffer vp;
	vinfo.ioCompletion  = nil;
	vinfo.ioVRefNum 	= fpb->ioVRefNum;
	vinfo.ioBuffer 		= (Ptr) &vp;
	vinfo.ioReqCount 	= sizeof (vp);
	comlen = 0;
	if (PBHGetVolParmsSync((HParmBlkPtr) &vinfo) == noErr &&
		((vp.vMAttrib >> bHasDesktopMgr) & 1)) 
	{
		DTPBRec 	dtp;
		memset((void *) &dtp, '\0', sizeof (dtp));
		dtp.ioVRefNum = fpb->ioVRefNum;
		if (PBDTGetPath(&dtp) == noErr) 
		{
			dtp.ioCompletion = nil;
			dtp.ioDTBuffer = (Ptr) comment;
			dtp.ioNamePtr  = fpb->ioNamePtr;
			dtp.ioDirID    = fpb->ioFlParID;
			if (PBDTGetCommentSync(&dtp) == noErr) 
				comlen = dtp.ioDTActCount;
		}
	}
#endif /* ! 1 */
	
	/* write header */
//	head.magic = dfork ? APPLESINGLE_MAGIC : APPLEDOUBLE_MAGIC;
	head.magic   = APPLEDOUBLE_MAGIC;		/* always do apple double */
	head.version = VERSION;
	memset(head.fill, '\0', sizeof (head.fill));
	head.entries = NUM_ENTRIES - 1;
	status = to64(p_ap_encode_obj,
					(char *) &head,
					sizeof (head));				
	if (status != noErr)
		return status;

	/* write entry descriptors */
    nsAutoCString leafname;
    macFile->GetNativeLeafName(leafname);
	entries[0].offset = sizeof (head) + sizeof (ap_entry) * head.entries;
	entries[0].id 	= ENT_NAME;
    entries[0].length = leafname.Length();
	entries[1].id 	= ENT_FINFO;
	entries[1].length = sizeof (FInfo) + sizeof (FXInfo);
	entries[2].id 	= ENT_DATES;
	entries[2].length = sizeof (ap_dates);
	entries[3].id 	= ENT_COMMENT;
	entries[3].length = comlen;
	entries[4].id 	= ENT_RFORK;
    entries[4].length = catalogInfo.rsrcLogicalSize;
	entries[5].id 	= ENT_DFORK;
    entries[5].length = catalogInfo.dataLogicalSize;

	/* correct the link in the entries. */
	for (i = 1; i < NUM_ENTRIES; ++i) 
	{
		entries[i].offset = entries[i-1].offset + entries[i-1].length;
	}
	status = to64(p_ap_encode_obj,
					(char *) entries,
					sizeof (ap_entry) * head.entries); 
	if (status != noErr)
		return status;

	/* write name */
	status = to64(p_ap_encode_obj,
					(char *) leafname.get(),
					leafname.Length()); 
	if (status != noErr)
		return status;
	
	/* write finder info */
	status = to64(p_ap_encode_obj,
					(char *) &catalogInfo.finderInfo,
					sizeof (FInfo));
	if (status != noErr)
		return status;
					  
	status = to64(p_ap_encode_obj,
					(char *) &catalogInfo.extFinderInfo,
					sizeof (FXInfo));
	if (status != noErr)
		return status;

	/* write dates */
    dates.create = catalogInfo.createDate.lowSeconds + CONVERT_TIME;
    dates.modify = catalogInfo.contentModDate.lowSeconds + CONVERT_TIME;
    dates.backup = catalogInfo.backupDate.lowSeconds + CONVERT_TIME;
    dates.access = catalogInfo.accessDate.lowSeconds + CONVERT_TIME;
	status = to64(p_ap_encode_obj,
					(char *) &dates,
					sizeof (ap_dates)); 
	if (status != noErr)
		return status;
	
	/* write comment */
	if (comlen)
	{
		status = to64(p_ap_encode_obj,
					comment,
					comlen * sizeof(char));
	}
	/*
	**	Get some help information on deciding the file type.
	*/
    if (((FileInfo*)(&catalogInfo.finderInfo))->fileType == 'TEXT' ||
        ((FileInfo*)(&catalogInfo.finderInfo))->fileType == 'text')
	{
		p_ap_encode_obj->text_file_type = true;
	}
	
	return status;	
}
/*
**	ap_encode_header
**
**		encode the file header and the resource fork.
**
*/
int ap_encode_header(
	appledouble_encode_object* p_ap_encode_obj, 
	bool    firstime)
{
	char   	rd_buff[256];
    FSIORefNum fileId;
	OSErr	retval = noErr;
	int    	status;
    ByteCount inCount;
	
	if (firstime)
	{
    PL_strcpy(rd_buff, 
			"Content-Type: application/applefile\r\nContent-Transfer-Encoding: base64\r\n\r\n");
		status = write_stream(p_ap_encode_obj,
			 				rd_buff, 
			 				strlen(rd_buff)); 
		if (status != noErr)
			return status;
			
		status = ap_encode_file_infor(p_ap_encode_obj); 
		if (status != noErr)
			return status;
		
		/*
		** preparing to encode the resource fork.
		*/
        nsCOMPtr <nsIFile> myFile;
        NS_NewNativeLocalFile(nsDependentCString(p_ap_encode_obj->fname), true, getter_AddRefs(myFile));
        if (!myFile)
            return errFileOpen;

        FSRef ref;
        nsCOMPtr <nsILocalFileMac> macFile = do_QueryInterface(myFile);
        if (NS_FAILED(macFile->GetFSRef(&ref)))
            return errFileOpen;

        HFSUniStr255 forkName;
        ::FSGetResourceForkName(&forkName);
        retval = ::FSOpenFork(&ref, forkName.length, forkName.unicode, fsRdPerm, &p_ap_encode_obj->fileId);
        if (retval != noErr)
            return retval;
	}

	fileId = p_ap_encode_obj->fileId;
	while (retval == noErr)
	{
		if (BUFF_LEFT(p_ap_encode_obj) < 400)
			break;
			
        inCount = 0;
        retval = ::FSReadFork(fileId, fsAtMark, 0, 256, rd_buff, &inCount);
		if (inCount)
		{
			status = to64(p_ap_encode_obj,
							rd_buff,
							inCount);
			if (status != noErr)
				return status;
		}
	}
	
	if (retval == eofErr)
	{
        ::FSCloseFork(fileId);
        p_ap_encode_obj->fileId = 0;

		status = finish64(p_ap_encode_obj);
		if (status != noErr)
			return status;
		
		/*
		** write out the boundary 
		*/
		PR_snprintf(rd_buff, sizeof(rd_buff),
						CRLF "--%s" CRLF, 
						p_ap_encode_obj->boundary);
					
		status = write_stream(p_ap_encode_obj,
						rd_buff,
						strlen(rd_buff));
		if (status == noErr)
			status = errDone;
	}
	return status;
}

static void replace(char *p, int len, char frm, char to)
{
	for (; len > 0; len--, p++)
		if (*p == frm)	*p = to;
}

/* Description of the various file formats and their magic numbers 		*/
struct magic 
{
    char 	*name;			/* Name of the file format 					*/
    char 	*num;			/* The magic number 						*/
    int 	len;			/* Length (0 means strlen(magicnum)) 		*/
};

/* The magic numbers of the file formats we know about */
static struct magic magic[] = 
{
    { "image/gif", 	"GIF", 			  0 },
    { "image/jpeg", "\377\330\377",   0 },
    { "video/mpeg", "\0\0\001\263",	  4 },
    { "application/postscript", "%!", 0 },
};
static int 	num_magic = (sizeof(magic)/sizeof(magic[0]));

static char *text_type    = TEXT_PLAIN;					/* the text file type.	*/		
static char *default_type = APPLICATION_OCTET_STREAM;


/*
 * Determins the format of the file "inputf".  The name
 * of the file format (or NULL on error) is returned.
 */
static char *magic_look(char *inbuff, int numread)
{
    int i, j;

	for (i=0; i<num_magic; i++) 
	{
	   	if (magic[i].len == 0) 
	   		magic[i].len = strlen(magic[i].num);
	}

    for (i=0; i<num_magic; i++) 
    {
		if (numread >= magic[i].len) 
		{
	    	for (j=0; j<magic[i].len; j++) 
	    	{
				if (inbuff[j] != magic[i].num[j]) break;
	    	}
	    	
	    	if (j == magic[i].len) 
	    		return magic[i].name;
		}
    }

    return default_type;
}
/*
**	ap_encode_data
**
**	---------------
**
**		encode on the data fork.
**
*/
int ap_encode_data(
	appledouble_encode_object* p_ap_encode_obj, 
	bool firstime)
{
	char   		rd_buff[256];
    FSIORefNum fileId;
	OSErr		retval = noErr;
    ByteCount in_count;
	int			status;
	
	if (firstime)
	{	
		char* magic_type;
			
		/*
		** preparing to encode the data fork.
		*/
        nsCOMPtr <nsIFile> resFile;
        NS_NewNativeLocalFile(nsDependentCString(p_ap_encode_obj->fname), true,
                              getter_AddRefs(resFile));
        if (!resFile)
            return errFileOpen;

        FSRef ref;
        nsCOMPtr <nsILocalFileMac> macFile = do_QueryInterface(resFile);
        if (NS_FAILED(macFile->GetFSRef(&ref)))
            return errFileOpen;

        HFSUniStr255 forkName;
        ::FSGetDataForkName(&forkName);
        retval = ::FSOpenFork(&ref, forkName.length, forkName.unicode, fsRdPerm, &fileId);
        if (retval != noErr)
            return retval;

		p_ap_encode_obj->fileId = fileId;
			
		
		if (!p_ap_encode_obj->text_file_type)
		{	
      /*
      **	do a smart check for the file type.
      */
      in_count = 0;
      retval = ::FSReadFork(fileId, fsFromStart, 0, 256, rd_buff, &in_count);
      magic_type = magic_look(rd_buff, in_count);
      
      /* don't forget to rewind the index to start point. */ 
      ::FSSetForkPosition(fileId, fsFromStart, 0);
      /* and reset retVal just in case... */
      if (retval == eofErr)
        retval = noErr;
		}
		else
		{
			magic_type = text_type;		/* we already know it is a text type.	*/
		}

		/*
		**	the data portion header information.
		*/
        nsAutoCString leafName;
        resFile->GetNativeLeafName(leafName);
		PR_snprintf(rd_buff, sizeof(rd_buff),
			"Content-Type: %s; name=\"%s\"" CRLF "Content-Transfer-Encoding: base64" CRLF "Content-Disposition: inline; filename=\"%s\"" CRLF CRLF,
			magic_type,
			leafName.get(),
			leafName.get());
			
		status = write_stream(p_ap_encode_obj, 
					rd_buff, 
					strlen(rd_buff)); 
		if (status != noErr)
			return status;
	}
	
	while (retval == noErr)
	{
		if (BUFF_LEFT(p_ap_encode_obj) < 400)
			break;
			
        in_count = 0;
        retval = ::FSReadFork(p_ap_encode_obj->fileId, fsAtMark, 0, 256, rd_buff, &in_count);
		if (in_count)
		{
/*			replace(rd_buff, in_count, '\r', '\n');	 						*/
/* ** may be need to do character set conversion here for localization.	**  */		
			status = to64(p_ap_encode_obj,
						rd_buff,
						in_count);
			if (status != noErr)
				return status;
		}
	}
	
	if (retval == eofErr)
	{
        ::FSCloseFork(p_ap_encode_obj->fileId);
        p_ap_encode_obj->fileId = 0;

		status = finish64(p_ap_encode_obj);
		if (status != noErr)
			return status;
		
		/* write out the boundary 	*/
		
		PR_snprintf(rd_buff, sizeof(rd_buff),
						CRLF "--%s--" CRLF CRLF, 
						p_ap_encode_obj->boundary);
	
		status = write_stream(p_ap_encode_obj,
						rd_buff,
						strlen(rd_buff));
	
		if (status == noErr)				
			status = errDone;
	}
	return status;
}

static char basis_64[] =
   "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/* 
**	convert the stream in the inbuff to 64 format and put it in the out buff.
**  To make the life easier, the caller will responcable of the cheking of the outbuff's bundary.
*/
static int 
to64(appledouble_encode_object* p_ap_encode_obj, 
	char	*p, 
	int 	in_size) 
{
	int 	status;
    int c1, c2, c3, ct;
    unsigned char *inbuff = (unsigned char*)p;
    
	ct = p_ap_encode_obj->ct;			/* the char count left last time. */
	
	/*
	**	 resume the left state of the last conversion.
	*/
	switch (p_ap_encode_obj->state64)
	{
		case 0:
			p_ap_encode_obj->c1 = c1 = *inbuff ++;
			if (--in_size <= 0)
			{
				p_ap_encode_obj->state64 = 1;
				return noErr;
			}
			p_ap_encode_obj->c2 = c2 = *inbuff ++;
			if (--in_size <= 0)
			{
				p_ap_encode_obj->state64 = 2;
				return noErr;
			}
			c3 = *inbuff ++;		--in_size;
			break;
		case 1:
			c1 = p_ap_encode_obj->c1;
			p_ap_encode_obj->c2 = c2 = *inbuff ++;
			if (--in_size <= 0)
			{
				p_ap_encode_obj->state64 = 2;
				return noErr;
			}
			c3 = *inbuff ++;		--in_size;
			break;
		case 2:
			c1 = p_ap_encode_obj->c1;
			c2 = p_ap_encode_obj->c2;
			c3 = *inbuff ++;		--in_size;
			break;
	}
	
    while (in_size >= 0) 
    {
    	status = output64chunk(p_ap_encode_obj, 
    							c1, 
    							c2, 
    							c3, 
    							0);
    	if (status != noErr)
    		return status;
    		
    	ct += 4;
        if (ct > 71) 
        { 
        	status = write_stream(p_ap_encode_obj, 
        						CRLF, 
        						2);
        	if (status != noErr)
        		return status;
        		
            ct = 0;
        }

		if (in_size <= 0)
		{
			p_ap_encode_obj->state64 = 0;
			break;
		}
		
		c1 = (int)*inbuff++;
		if (--in_size <= 0)
		{
			p_ap_encode_obj->c1 = c1;
			p_ap_encode_obj->state64 = 1;
			break;
		}
		c2 = *inbuff++;
		if (--in_size <= 0)
		{
			p_ap_encode_obj->c1 	 = c1;
			p_ap_encode_obj->c2 	 = c2;
			p_ap_encode_obj->state64 = 2;
			break;
		}
		c3 = *inbuff++;
		in_size--;
    }
    p_ap_encode_obj->ct = ct;
    return status;
}

/*
** clear the left base64 encodes.
*/
static int 
finish64(appledouble_encode_object* p_ap_encode_obj)
{
	int status;
	
	switch (p_ap_encode_obj->state64)
	{
		case 0:
			break;
		case 1:
			status = output64chunk(p_ap_encode_obj, 
									p_ap_encode_obj->c1, 
									0, 
									0, 
									2);
			break;
		case 2:
			status = output64chunk(p_ap_encode_obj, 
									p_ap_encode_obj->c1, 
									p_ap_encode_obj->c2, 
									0, 
									1);
			break;
	}
	status = write_stream(p_ap_encode_obj, CRLF, 2);
	p_ap_encode_obj->state64 = 0;
	p_ap_encode_obj->ct	  	 = 0;
	return status;
}

static int output64chunk(
	appledouble_encode_object* p_ap_encode_obj, 
	int c1, int c2, int c3, int pads)
{
	char tmpstr[32];
	char *p = tmpstr;
	
    *p++ = basis_64[c1>>2];
    *p++ = basis_64[((c1 & 0x3)<< 4) | ((c2 & 0xF0) >> 4)];
    if (pads == 2) 
    {
        *p++ = '=';
        *p++ = '=';
    } 
    else if (pads) 
    {
        *p++ = basis_64[((c2 & 0xF) << 2) | ((c3 & 0xC0) >>6)];
        *p++ = '=';
    } 
    else 
    {
        *p++ = basis_64[((c2 & 0xF) << 2) | ((c3 & 0xC0) >>6)];
        *p++ = basis_64[c3 & 0x3F];
    }
	return write_stream(p_ap_encode_obj,
						tmpstr,
						p-tmpstr);
}
