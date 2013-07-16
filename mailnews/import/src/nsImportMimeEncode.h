/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
#ifndef nsImportMimeEncode_h__
#define nsImportMimeEncode_h__

#include "mozilla/Attributes.h"
#include "nsImportScanFile.h"
#include "ImportOutFile.h"
#include "nsImportEncodeScan.h"
#include "nsStringGlue.h"
#include "nsIImportMimeEncode.h"


// Content-Type: image/gif; name="blah.xyz"
// Content-Transfer-Encoding: base64
// Content-Disposition: attachment; filename="blah.xyz"

class nsImportMimeEncode : public nsImportEncodeScan {
public:
	nsImportMimeEncode();
	~nsImportMimeEncode();
	
	void	EncodeFile(nsIFile *pInFile, ImportOutFile *pOut, const char *pFileName, const char *pMimeType);

	bool	DoWork(bool *pDone);
	
	long	NumBytesProcessed(void) { long val = m_bytesProcessed; m_bytesProcessed = 0; return val;}

protected:
	void	CleanUp(void);
	bool	SetUpEncode(void);
	bool	WriteFileName(nsCString& fName, bool wasTrans, const char *pTag);
	bool	TranslateFileName(nsCString& inFile, nsCString& outFile);


	virtual bool	ScanBuffer(bool *pDone) MOZ_OVERRIDE;


protected:
	nsCString             m_fileName;
	nsCOMPtr <nsIFile>    m_pMimeFile;
	ImportOutFile *		m_pOut;
	nsCString			m_mimeType;

	int				m_state;
	long			m_bytesProcessed;
	uint8_t *		m_pInputBuf;
	bool			m_appleSingle;
	
	// Actual encoding variables
	int			m_lineLen;
};


class nsIImportMimeEncodeImpl : public nsIImportMimeEncode {
public:
	NS_DECL_ISUPPORTS

	NS_DECL_NSIIMPORTMIMEENCODE

	nsIImportMimeEncodeImpl();
	virtual ~nsIImportMimeEncodeImpl();

private:
	ImportOutFile *			m_pOut;
	nsImportMimeEncode *	m_pEncode;
};


#endif /* nsImportMimeEncode_h__ */

