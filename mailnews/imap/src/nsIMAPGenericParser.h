/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* 
nsIMAPGenericParser is the base parser class used by the server parser and body shell parser
*/ 

#ifndef nsIMAPGenericParser_H
#define nsIMAPGenericParser_H

#include "nsImapCore.h"

#define WHITESPACE " \015\012"     // token delimiter 


class nsIMAPGenericParser 
{

public:
	nsIMAPGenericParser();
	virtual ~nsIMAPGenericParser();

  // Add any specific stuff in the derived class
  virtual bool       LastCommandSuccessful();

  bool SyntaxError() { return (fParserState & stateSyntaxErrorFlag) != 0; }
  bool ContinueParse() { return fParserState == stateOK; }
  bool Connected() { return !(fParserState & stateDisconnectedFlag); }
  void SetConnected(bool error);
    
protected:

	// This is a pure virtual member which must be overridden in the derived class
	// for each different implementation of a nsIMAPGenericParser.
	// For instance, one implementation (the nsIMAPServerState) might get the next line
	// from an open socket, whereas another implementation might just get it from a buffer somewhere.
	// This fills in nextLine with the buffer, and returns true if everything is OK.
	// Returns false if there was some error encountered.  In that case, we reset the parser.
	virtual bool	GetNextLineForParser(char **nextLine) = 0;	

  virtual void	HandleMemoryFailure();
  void skip_to_CRLF();
  void skip_to_close_paren();
  char *CreateString();
  char *CreateAstring();
  char *CreateNilString();
  char *CreateLiteral();
  char *CreateAtom(bool isAstring = false);
  char *CreateQuoted(bool skipToEnd = true);
  char *CreateParenGroup();
  virtual void SetSyntaxError(bool error, const char *msg);

  void AdvanceToNextToken();
  void AdvanceToNextLine();
  void AdvanceTokenizerStartingPoint(int32_t bytesToAdvance);
  void ResetLexAnalyzer();

protected:
	// use with care
  const char     *fNextToken;
  char           *fCurrentLine;
	char					 *fLineOfTokens;
  char           *fStartOfLineOfTokens;
  char           *fCurrentTokenPlaceHolder;
  bool            fAtEndOfLine;

private:
  enum nsIMAPGenericParserState { stateOK = 0,
                                  stateSyntaxErrorFlag = 0x1,
                                  stateDisconnectedFlag = 0x2 };
  uint32_t fParserState;
};

#endif
