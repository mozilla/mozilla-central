/* -*- Mode: C; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
**	AD_Codes.h
**
**	---------------
**
**		Head file for Apple Decode/Encode essential codes.
**
**
*/

#ifndef ad_codes_h
#define ad_codes_h

/*
** applefile definitions used 
*/
#if PRAGMA_STRUCT_ALIGN
  #pragma options align=mac68k
#endif

#define APPLESINGLE_MAGIC	0x00051600L
#define APPLEDOUBLE_MAGIC 	0x00051607L
#define VERSION 			0x00020000

#define NUM_ENTRIES 		6

#define ENT_DFORK   		1L
#define ENT_RFORK   		2L
#define ENT_NAME    		3L
#define ENT_COMMENT 		4L
#define ENT_DATES   		8L
#define ENT_FINFO   		9L
#define CONVERT_TIME 		1265437696L

/*
** data type used in the encoder/decoder.
*/
typedef struct ap_header 
{
	int32_t 	magic;
	int32_t	version;
	char 	fill[16];
	int16_t 	entries;

} ap_header;

typedef struct ap_entry 
{
	int32_t  id;
	int32_t	offset;
	int32_t	length;
	
} ap_entry;

typedef struct ap_dates 
{
	int32_t create, modify, backup, access;

} ap_dates;

typedef struct myFInfo			/* the mac FInfo structure for the cross platform. */
{	
	int32_t	fdType, fdCreator;
	int16_t	fdFlags;
	int32_t	fdLocation;			/* it really should  be a pointer, but just a place-holder  */
	int16_t	fdFldr;	

}	myFInfo;

PR_BEGIN_EXTERN_C
/*
**	string utils.
*/
int write_stream(appledouble_encode_object *p_ap_encode_obj,char *s,int	 len);

int fill_apple_mime_header(appledouble_encode_object *p_ap_encode_obj);
int ap_encode_file_infor(appledouble_encode_object *p_ap_encode_obj);
int ap_encode_header(appledouble_encode_object* p_ap_encode_obj, bool firstTime);
int ap_encode_data(  appledouble_encode_object* p_ap_encode_obj, bool firstTime);

/*
**	the prototypes for the ap_decoder.
*/
int  fetch_a_line(appledouble_decode_object* p_ap_decode_obj, char *buff);
int  ParseFileHeader(appledouble_decode_object* p_ap_decode_obj);
int  ap_seek_part_start(appledouble_decode_object* p_ap_decode_obj);
void parse_param(char *p, char **param, char**define, char **np);
int  ap_seek_to_boundary(appledouble_decode_object* p_ap_decode_obj, bool firstime);
int  ap_parse_header(appledouble_decode_object* p_ap_decode_obj,bool firstime);
int  ap_decode_file_infor(appledouble_decode_object* p_ap_decode_obj);
int  ap_decode_process_header(appledouble_decode_object* p_ap_decode_obj, bool firstime);
int  ap_decode_process_data(  appledouble_decode_object* p_ap_decode_obj, bool firstime);

PR_END_EXTERN_C
 
#if PRAGMA_STRUCT_ALIGN
  #pragma options align=reset
#endif

#endif /* ad_codes_h */
