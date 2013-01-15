/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _MsgSendPart_H_
#define _MsgSendPart_H_

#include "msgCore.h"
#include "prprf.h" /* should be defined into msgCore.h? */
#include "nsMsgSend.h"

namespace mozilla {
namespace mailnews {
class MimeEncoder;
}
}

typedef int (*MSG_SendPartWriteFunc)(const char* line, int32_t size,
									                   bool isheader, void* closure);

class nsMsgSendPart {
  typedef mozilla::mailnews::MimeEncoder MimeEncoder;
public:
    nsMsgSendPart(nsIMsgSend* state, const char *part_charset = NULL);
    virtual ~nsMsgSendPart();	  // Note that the destructor also destroys
								                // any children that were added.

    virtual nsresult  Write();

    virtual nsresult    SetFile(nsIFile *filename);
    const nsIFile  *GetFile() {return m_file;}

    virtual nsresult  SetBuffer(const char* buffer);
    const char        *GetBuffer() {return m_buffer;}

    virtual nsresult  SetType(const char* type);
    const char        *GetType() {return m_type;}
    
    const char        *GetCharsetName() {return m_charset_name;}

    virtual nsresult  SetOtherHeaders(const char* other);
    const char        *SetOtherHeaders() {return m_other;}
	  virtual nsresult  AppendOtherHeaders(const char* moreother);

	  virtual nsresult  SetMimeDeliveryState(nsIMsgSend* state);

  // Note that the nsMsgSendPart class will take over ownership of the
  // MimeEncoderData* object, deleting it when it chooses.  (This is
  // necessary because deleting these objects is the only current way to
  // flush out the data in them.)
  void                SetEncoder(MimeEncoder* encoder) {m_encoder = encoder;}
  MimeEncoder         *GetEncoder() {return m_encoder;}

	void                SetStripSensitiveHeaders(bool value)
                      {
		                    m_strip_sensitive_headers = value;
	                    }
	bool                GetStripSensitiveHeaders() {return m_strip_sensitive_headers;}

  virtual nsresult    AddChild(nsMsgSendPart* child);

	int32_t             GetNumChildren() {return m_numchildren;}
	nsMsgSendPart       *GetChild(int32_t which);
	nsMsgSendPart       *DetachChild(int32_t which);

	virtual nsresult    SetMainPart(bool value);
	bool                IsMainPart() 
                      {
                        return m_mainpart;
                      }
  nsCString           m_partNum;
protected:
	nsresult            CopyString(char** dest, const char* src);
	nsresult            PushBody(const char* buffer, int32_t length);

	nsCOMPtr<nsIMsgSend> m_state;
	nsMsgSendPart       *m_parent;
  nsCOMPtr <nsIFile>   m_file;
	char                *m_buffer;
  char                *m_type;
  char                *m_other;
  char                m_charset_name[64+1];        // charset name associated with this part
	bool                m_strip_sensitive_headers;
  nsAutoPtr<MimeEncoder> m_encoder;

	nsMsgSendPart       **m_children;
	int32_t             m_numchildren;

	// Data used while actually writing.
  bool                m_firstBlock;
  bool                m_needIntlConversion;

	bool                m_mainpart;

	bool                m_just_hit_CR;

	static int32_t      M_counter;
};

#endif /* _MsgSendPart_H_ */
