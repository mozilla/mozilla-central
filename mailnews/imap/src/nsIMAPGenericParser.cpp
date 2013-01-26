/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "msgCore.h"  // for pre-compiled headers

#include "nsImapCore.h"
#include "nsImapProtocol.h"
#include "nsIMAPGenericParser.h"
#include "nsStringGlue.h"

////////////////// nsIMAPGenericParser /////////////////////////


nsIMAPGenericParser::nsIMAPGenericParser() :
fNextToken(nullptr),
fCurrentLine(nullptr),
fLineOfTokens(nullptr),
fStartOfLineOfTokens(nullptr),
fCurrentTokenPlaceHolder(nullptr),
fAtEndOfLine(false),
fParserState(stateOK)
{
}

nsIMAPGenericParser::~nsIMAPGenericParser()
{
  PR_FREEIF( fCurrentLine );
  PR_FREEIF( fStartOfLineOfTokens);
}

void nsIMAPGenericParser::HandleMemoryFailure()
{
  SetConnected(false);
}

void nsIMAPGenericParser::ResetLexAnalyzer()
{
  PR_FREEIF( fCurrentLine );
  PR_FREEIF( fStartOfLineOfTokens );
  
  fNextToken = fCurrentLine = fLineOfTokens = fStartOfLineOfTokens = fCurrentTokenPlaceHolder = nullptr;
  fAtEndOfLine = false;
}

bool nsIMAPGenericParser::LastCommandSuccessful()
{
  return fParserState == stateOK;
}

void nsIMAPGenericParser::SetSyntaxError(bool error, const char *msg)
{
  if (error)
      fParserState |= stateSyntaxErrorFlag;
  else
      fParserState &= ~stateSyntaxErrorFlag;
  NS_ASSERTION(!error, "syntax error in generic parser");	
}

void nsIMAPGenericParser::SetConnected(bool connected)
{
  if (connected)
      fParserState &= ~stateDisconnectedFlag;
  else
      fParserState |= stateDisconnectedFlag;
}

void nsIMAPGenericParser::skip_to_CRLF()
{
  while (Connected() && !fAtEndOfLine)
    AdvanceToNextToken();
}

// fNextToken initially should point to
// a string after the initial open paren ("(")
// After this call, fNextToken points to the
// first character after the matching close
// paren.  Only call AdvanceToNextToken() to get the NEXT
// token after the one returned in fNextToken.
void nsIMAPGenericParser::skip_to_close_paren()
{
  int numberOfCloseParensNeeded = 1;
  while (ContinueParse())
  {
    // go through fNextToken, account for nested parens
    const char *loc;
    for (loc = fNextToken; loc && *loc; loc++)
    {
      if (*loc == '(')
        numberOfCloseParensNeeded++;
      else if (*loc == ')')
      {
        numberOfCloseParensNeeded--;
        if (numberOfCloseParensNeeded == 0)
        {
          fNextToken = loc + 1;
          if (!fNextToken || !*fNextToken)
            AdvanceToNextToken();
          return;
        }
      }
      else if (*loc == '{' || *loc == '"') {
        // quoted or literal  
        fNextToken = loc;
        char *a = CreateString();
        PR_FREEIF(a);
        break; // move to next token
      }
    }
    if (ContinueParse())
      AdvanceToNextToken();
  }
}

void nsIMAPGenericParser::AdvanceToNextToken()
{
  if (!fCurrentLine || fAtEndOfLine)
    AdvanceToNextLine();
  if (Connected())
  {
    if (!fStartOfLineOfTokens)
    {
      // this is the first token of the line; setup tokenizer now
      fStartOfLineOfTokens = PL_strdup(fCurrentLine);
      if (!fStartOfLineOfTokens)
      {
        HandleMemoryFailure();
        return;
      }
      fLineOfTokens = fStartOfLineOfTokens;
      fCurrentTokenPlaceHolder = fStartOfLineOfTokens;
    }
    fNextToken = NS_strtok(WHITESPACE, &fCurrentTokenPlaceHolder);
    if (!fNextToken)
    {
      fAtEndOfLine = true;
      fNextToken = CRLF;
    }
  }
}

void nsIMAPGenericParser::AdvanceToNextLine()
{
  PR_FREEIF( fCurrentLine );
  PR_FREEIF( fStartOfLineOfTokens);
  
  bool ok = GetNextLineForParser(&fCurrentLine);
  if (!ok)
  {
    SetConnected(false);
    fStartOfLineOfTokens = nullptr;
    fLineOfTokens = nullptr;
    fCurrentTokenPlaceHolder = nullptr;
    fAtEndOfLine = true;
    fNextToken = CRLF;
  }
  else if (!fCurrentLine)
  {
    HandleMemoryFailure();
  }
  else
  {
     fNextToken = nullptr;
     // determine if there are any tokens (without calling AdvanceToNextToken);
     // otherwise we are already at end of line
     NS_ASSERTION(strlen(WHITESPACE) == 3, "assume 3 chars of whitespace");
     char *firstToken = fCurrentLine;
     while (*firstToken && (*firstToken == WHITESPACE[0] ||
            *firstToken == WHITESPACE[1] || *firstToken == WHITESPACE[2]))
       firstToken++;
     fAtEndOfLine = (*firstToken == '\0');
  }
}

// advances |fLineOfTokens| by |bytesToAdvance| bytes
void nsIMAPGenericParser::AdvanceTokenizerStartingPoint(int32_t bytesToAdvance)
{
  NS_PRECONDITION(bytesToAdvance>=0, "bytesToAdvance must not be negative");
  if (!fStartOfLineOfTokens)
  {
    AdvanceToNextToken();  // the tokenizer was not yet initialized, do it now
    if (!fStartOfLineOfTokens)
      return;
  }
    
  if(!fStartOfLineOfTokens)
      return;
  // The last call to AdvanceToNextToken() cleared the token separator to '\0'
  // iff |fCurrentTokenPlaceHolder|.  We must recover this token separator now.
  if (fCurrentTokenPlaceHolder)
  {
    int endTokenOffset = fCurrentTokenPlaceHolder - fStartOfLineOfTokens - 1;
    if (endTokenOffset >= 0)
      fStartOfLineOfTokens[endTokenOffset] = fCurrentLine[endTokenOffset];
  }

  NS_ASSERTION(bytesToAdvance + (fLineOfTokens-fStartOfLineOfTokens) <=
    (int32_t)strlen(fCurrentLine), "cannot advance beyond end of fLineOfTokens");
  fLineOfTokens += bytesToAdvance;
  fCurrentTokenPlaceHolder = fLineOfTokens;
}

// RFC3501:  astring = 1*ASTRING-CHAR / string
//           string  = quoted / literal
// This function leaves us off with fCurrentTokenPlaceHolder immediately after
// the end of the Astring.  Call AdvanceToNextToken() to get the token after it.
char *nsIMAPGenericParser::CreateAstring()
{
  if (*fNextToken == '{')
    return CreateLiteral();		// literal
  else if (*fNextToken == '"')
    return CreateQuoted();		// quoted
  else
    return CreateAtom(true); // atom
}

// Create an atom
// This function does not advance the parser.
// Call AdvanceToNextToken() to get the next token after the atom.
// RFC3501:  atom            = 1*ATOM-CHAR
//           ASTRING-CHAR    = ATOM-CHAR / resp-specials
//           ATOM-CHAR       = <any CHAR except atom-specials>
//           atom-specials   = "(" / ")" / "{" / SP / CTL / list-wildcards /
//                             quoted-specials / resp-specials
//           list-wildcards  = "%" / "*"
//           quoted-specials = DQUOTE / "\"
//           resp-specials   = "]"
// "Characters are 7-bit US-ASCII unless otherwise specified." [RFC3501, 1.2.]
char *nsIMAPGenericParser::CreateAtom(bool isAstring)
{
  char *rv = PL_strdup(fNextToken);
  if (!rv)
  {
    HandleMemoryFailure();
    return nullptr;
  }
  // We wish to stop at the following characters (in decimal ascii)
  // 1-31 (CTL), 32 (SP), 34 '"', 37 '%', 40-42 "()*", 92 '\\', 123 '{'
  // also, ']' is only allowed in astrings
  char *last = rv;
  char c = *last;
  while ((c > 42 || c == 33 || c == 35 || c == 36 || c == 38 || c == 39)
         && c != '\\' && c != '{' && (isAstring || c != ']'))
     c = *++last;
  if (rv == last) {
     SetSyntaxError(true, "no atom characters found");
     PL_strfree(rv);
     return nullptr;
  }
  if (*last)
  {
    // not the whole token was consumed  
    *last = '\0';
    AdvanceTokenizerStartingPoint((fNextToken - fLineOfTokens) + (last-rv));
  }
  return rv;
}

// CreateNilString return either NULL (for "NIL") or a string
// Call with fNextToken pointing to the thing which we think is the nilstring.
// This function leaves us off with fCurrentTokenPlaceHolder immediately after
// the end of the string.
// Regardless of type, call AdvanceToNextToken() to get the token after it.
// RFC3501:   nstring  = string / nil
//            nil      = "NIL"
char *nsIMAPGenericParser::CreateNilString()
{
  if (!PL_strncasecmp(fNextToken, "NIL", 3))
  {
    // check if there is text after "NIL" in fNextToken,
    // equivalent handling as in CreateQuoted
    if (fNextToken[3])
      AdvanceTokenizerStartingPoint((fNextToken - fLineOfTokens) + 3);
    return NULL;
  }
  else
    return CreateString();
}


// Create a string, which can either be quoted or literal,
// but not an atom.
// This function leaves us off with fCurrentTokenPlaceHolder immediately after
// the end of the String.  Call AdvanceToNextToken() to get the token after it.
char *nsIMAPGenericParser::CreateString()
{
  if (*fNextToken == '{')
  {
    char *rv = CreateLiteral();		// literal
    return (rv);
  }
  else if (*fNextToken == '"')
  {
    char *rv = CreateQuoted();		// quoted
    return (rv);
  }
  else
  {
    SetSyntaxError(true, "string does not start with '{' or '\"'");
    return NULL;
  }
}

// This function sets fCurrentTokenPlaceHolder immediately after the end of the
// closing quote.  Call AdvanceToNextToken() to get the token after it.
// QUOTED_CHAR     ::= <any TEXT_CHAR except quoted_specials> /
//                     "\" quoted_specials
// TEXT_CHAR       ::= <any CHAR except CR and LF>
// quoted_specials ::= <"> / "\"
// Note that according to RFC 1064 and RFC 2060, CRs and LFs are not allowed 
// inside a quoted string.  It is sufficient to read from the current line only.
char *nsIMAPGenericParser::CreateQuoted(bool /*skipToEnd*/)
{
  // one char past opening '"'
  char *currentChar = fCurrentLine + (fNextToken - fStartOfLineOfTokens) + 1;
  
  int escapeCharsCut = 0;
  nsCString returnString(currentChar);
  int charIndex;
  for (charIndex = 0; returnString.CharAt(charIndex) != '"'; charIndex++)
  {
    if (!returnString.CharAt(charIndex))
    {
      SetSyntaxError(true, "no closing '\"' found in quoted");
      return nullptr;
    }
    else if (returnString.CharAt(charIndex) == '\\')
    {
      // eat the escape character, but keep the escaped character
      returnString.Cut(charIndex, 1);
      escapeCharsCut++;
    }
  }
  // +2 because of the start and end quotes
  AdvanceTokenizerStartingPoint((fNextToken - fLineOfTokens) +
                                charIndex + escapeCharsCut + 2);

  returnString.SetLength(charIndex);
  return ToNewCString(returnString);
}


// This function leaves us off with fCurrentTokenPlaceHolder immediately after
// the end of the literal string.  Call AdvanceToNextToken() to get the token
// after the literal string.
// RFC3501:  literal = "{" number "}" CRLF *CHAR8
//                       ; Number represents the number of CHAR8s
//           CHAR8   = %x01-ff
//                       ; any OCTET except NUL, %x00
char *nsIMAPGenericParser::CreateLiteral()
{
  int32_t numberOfCharsInMessage = atoi(fNextToken + 1);
  uint32_t numBytes = numberOfCharsInMessage + 1;
  NS_ASSERTION(numBytes, "overflow!");
  if (!numBytes)
    return nullptr;
  char *returnString = (char *)PR_Malloc(numBytes);
  if (!returnString)
  {
    HandleMemoryFailure();
    return nullptr;
  }

  int32_t currentLineLength = 0;
  int32_t charsReadSoFar = 0;
  int32_t bytesToCopy = 0;
  while (charsReadSoFar < numberOfCharsInMessage)
  {
    AdvanceToNextLine();
    if (!ContinueParse())
      break;
    
    currentLineLength = strlen(fCurrentLine);
    bytesToCopy = (currentLineLength > numberOfCharsInMessage - charsReadSoFar ?
                   numberOfCharsInMessage - charsReadSoFar : currentLineLength);
    NS_ASSERTION(bytesToCopy, "zero-length line?");
    memcpy(returnString + charsReadSoFar, fCurrentLine, bytesToCopy); 
    charsReadSoFar += bytesToCopy;
  }
  
  if (ContinueParse())
  {
    if (currentLineLength == bytesToCopy)
    {
      // We have consumed the entire line.
      // Consider the input  "{4}\r\n"  "L1\r\n"  " A2\r\n"  which is read
      // line-by-line.  Reading an Astring, this should result in "L1\r\n".
      // Note that the second line is "L1\r\n", where the "\r\n" is part of
      // the literal.  Hence, we now read the next line to ensure that the
      // next call to AdvanceToNextToken() leads to fNextToken=="A2" in our
      // example.
      AdvanceToNextLine();
    }
    else
      AdvanceTokenizerStartingPoint(bytesToCopy);
  }
  
  returnString[charsReadSoFar] = 0;
  return returnString;
}


// Call this to create a buffer containing all characters within
// a given set of parentheses.
// Call this with fNextToken[0]=='(', that is, the open paren
// of the group.
// It will allocate and return all characters up to and including the corresponding
// closing paren, and leave the parser in the right place afterwards.
char *nsIMAPGenericParser::CreateParenGroup()
{
  NS_ASSERTION(fNextToken[0] == '(', "we don't have a paren group!");
  
  int numOpenParens = 0;
  AdvanceTokenizerStartingPoint(fNextToken - fLineOfTokens);
  
  // Build up a buffer containing the paren group.
  nsCString returnString;
  char *parenGroupStart = fCurrentTokenPlaceHolder;
  NS_ASSERTION(parenGroupStart[0] == '(', "we don't have a paren group (2)!");
  while (*fCurrentTokenPlaceHolder)
  {
    if (*fCurrentTokenPlaceHolder == '{')  // literal
    {
      // Ensure it is a properly formatted literal.
      NS_ASSERTION(!strcmp("}\r\n", fCurrentTokenPlaceHolder + strlen(fCurrentTokenPlaceHolder) - 3), "not a literal");
      
      // Append previous characters and the "{xx}\r\n" to buffer.
      returnString.Append(parenGroupStart);
      
      // Append literal itself.
      AdvanceToNextToken();
      if (!ContinueParse())
        break;
      char *lit = CreateLiteral();
      NS_ASSERTION(lit, "syntax error or out of memory");
      if (!lit)
        break;
      returnString.Append(lit);
      PR_Free(lit);
      if (!ContinueParse())
        break;
      parenGroupStart = fCurrentTokenPlaceHolder;
    }
    else if (*fCurrentTokenPlaceHolder == '"')  // quoted
    {
      // Append the _escaped_ version of the quoted string:
      // just skip it (because the quoted string must be on the same line).
      AdvanceToNextToken();
      if (!ContinueParse())
        break;
      char *q = CreateQuoted();
      if (!q)
        break;
      PR_Free(q);
      if (!ContinueParse())
        break;
    }
    else
    {
      // Append this character to the buffer.
      char c = *fCurrentTokenPlaceHolder++;
      if (c == '(')
        numOpenParens++;
      else if (c == ')')
      {
        numOpenParens--;
        if (numOpenParens == 0)
          break;
      }
    }
  }
  
  if (numOpenParens != 0 || !ContinueParse())
  {
    SetSyntaxError(true, "closing ')' not found in paren group");
    return nullptr;
  }

  returnString.Append(parenGroupStart, fCurrentTokenPlaceHolder - parenGroupStart);
  AdvanceToNextToken();  
  return ToNewCString(returnString);
}

