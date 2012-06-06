/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _MsgSendPart_H_
#define _MsgSendPart_H_

#include "msgCore.h"
#include "prprf.h" /* should be defined into msgCore.h? */
#include "nsMsgSend.h"

typedef int (*MSG_SendPartWriteFunc)(const char* line, PRInt32 size,
									                   bool isheader, void* closure);

class nsMsgSendPart {
public:
    nsMsgSendPart(nsIMsgSend* state, const char *part_charset = NULL);
    virtual ~nsMsgSendPart();	  // Note that the destructor also destroys
								                // any children that were added.

    virtual int       Write();

    virtual nsresult    SetFile(nsIFile *filename);
    const nsIFile  *GetFile() {return m_file;}

    virtual int       SetBuffer(const char* buffer);
    const char        *GetBuffer() {return m_buffer;}

    virtual int       SetType(const char* type);
    const char        *GetType() {return m_type;}
    
    const char        *GetCharsetName() {return m_charset_name;}

    virtual int       SetOtherHeaders(const char* other);
    const char        *SetOtherHeaders() {return m_other;}
	  virtual int       AppendOtherHeaders(const char* moreother);

	  virtual int       SetMimeDeliveryState(nsIMsgSend* state);

	// Note that the nsMsgSendPart class will take over ownership of the
	// MimeEncoderData* object, deleting it when it chooses.  (This is
	// necessary because deleting these objects is the only current way to
	// flush out the data in them.)
	int                 SetEncoderData(MimeEncoderData* data);
	MimeEncoderData     *GetEncoderData() {return m_encoder_data;}

	int                 SetStripSensitiveHeaders(bool value) 
                      {
		                    m_strip_sensitive_headers = value;
		                    return 0;
	                    }
	bool                GetStripSensitiveHeaders() {return m_strip_sensitive_headers;}

  virtual int         AddChild(nsMsgSendPart* child);

	PRInt32             GetNumChildren() {return m_numchildren;}
	nsMsgSendPart       *GetChild(PRInt32 which);
	nsMsgSendPart       *DetachChild(PRInt32 which);

	virtual int         SetMainPart(bool value);
	bool                IsMainPart() 
                      {
                        return m_mainpart;
                      }
  nsCString           m_partNum;
protected:
	int                 CopyString(char** dest, const char* src);
	int                 PushBody(const char* buffer, PRInt32 length);

	nsCOMPtr<nsIMsgSend> m_state;
	nsMsgSendPart       *m_parent;
  nsCOMPtr <nsIFile>   m_file;
	char                *m_buffer;
  char                *m_type;
  char                *m_other;
  char                m_charset_name[64+1];        // charset name associated with this part
	bool                m_strip_sensitive_headers;
	MimeEncoderData     *m_encoder_data;  /* Opaque state for base64/qp encoder. */

	nsMsgSendPart       **m_children;
	PRInt32             m_numchildren;

	// Data used while actually writing.
  bool                m_firstBlock;
  bool                m_needIntlConversion;

	bool                m_mainpart;

	bool                m_just_hit_CR;

	static PRInt32      M_counter;
};

#endif /* _MsgSendPart_H_ */
