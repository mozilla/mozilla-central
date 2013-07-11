/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
#ifndef _nsMsgLineBuffer_H
#define _nsMsgLineBuffer_H

#include "msgCore.h"    // precompiled header...

// I can't believe I have to have this stupid class, but I can't find
// anything suitable (nsStrImpl might be, when it's done). nsIByteBuffer
// would do, if I had a stream for input, which I don't.

class NS_MSG_BASE nsByteArray 
{
public:
  nsByteArray();
  virtual ~nsByteArray();
  uint32_t  GetSize() {return m_bufferSize;}
  uint32_t  GetBufferPos() {return m_bufferPos;}
  nsresult  GrowBuffer(uint32_t desired_size, uint32_t quantum = 1024);
  nsresult  AppendString(const char *string);
  nsresult  AppendBuffer(const char *buffer, uint32_t length);
  void    ResetWritePos() {m_bufferPos = 0;}
  char    *GetBuffer() {return m_buffer;}
protected:
  char    *m_buffer;
  uint32_t  m_bufferSize;
  uint32_t  m_bufferPos;  // write Pos in m_buffer - where the next byte should go.
};


class NS_MSG_BASE nsMsgLineBufferHandler : public nsByteArray
{
public:
  virtual nsresult HandleLine(const char *line, uint32_t line_length) = 0;
};

class NS_MSG_BASE nsMsgLineBuffer : public nsMsgLineBufferHandler
{
public:
  nsMsgLineBuffer(nsMsgLineBufferHandler *handler, bool convertNewlinesP);
  
  virtual    ~nsMsgLineBuffer();
  nsresult    BufferInput(const char *net_buffer, int32_t net_buffer_size);
  // Not sure why anyone cares, by NNTPHost seems to want to know the buf pos.
  uint32_t    GetBufferPos() {return m_bufferPos;}
  
  virtual nsresult HandleLine(const char *line, uint32_t line_length);
  // flush last line, though it won't be CRLF terminated.
  virtual nsresult FlushLastLine();
protected:
  nsMsgLineBuffer(bool convertNewlinesP);
  
  nsresult ConvertAndSendBuffer();
  void SetLookingForCRLF(bool b);
  
  nsMsgLineBufferHandler *m_handler;
  bool        m_convertNewlinesP;
  bool        m_lookingForCRLF; 
};

// I'm adding this utility class here for lack of a better place. This utility class is similar to nsMsgLineBuffer
// except it works from an input stream. It is geared towards efficiently parsing new lines out of a stream by storing
// read but unprocessed bytes in a buffer. I envision the primary use of this to be our mail protocols such as imap, news and
// pop which need to process line by line data being returned in the form of a proxied stream from the server.

class nsIInputStream;

class NS_MSG_BASE nsMsgLineStreamBuffer
{
public:
  // aBufferSize -- size of the buffer you want us to use for buffering stream data
  // aEndOfLinetoken -- The delimiter string to be used for determining the end of line. This 
  //              allows us to parse platform specific end of line endings by making it
  //            a parameter.
  // aAllocateNewLines -- true if you want calls to ReadNextLine to allocate new memory for the line. 
  //            if false, the char * returned is just a ptr into the buffer. Subsequent calls to
  //            ReadNextLine will alter the data so your ptr only has a life time of a per call.
  // aEatCRLFs  -- true if you don't want to see the CRLFs on the lines returned by ReadNextLine. 
  //         false if you do want to see them.
  // aLineToken -- Specify the line token to look for, by default is LF ('\n') which cover as well CRLF. If
  //            lines are terminated with a CR only, you need to set aLineToken to CR ('\r')
  nsMsgLineStreamBuffer(uint32_t aBufferSize, bool aAllocateNewLines, 
                        bool aEatCRLFs = true, char aLineToken = '\n'); // specify the size of the buffer you want the class to use....
  virtual ~nsMsgLineStreamBuffer();
  
  // Caller must free the line returned using PR_Free
  // aEndOfLinetoken -- delimiter used to denote the end of a line.
  // aNumBytesInLine -- The number of bytes in the line returned
  // aPauseForMoreData -- There is not enough data in the stream to make a line at this time...
  char * ReadNextLine(nsIInputStream * aInputStream, uint32_t &anumBytesInLine, bool &aPauseForMoreData, nsresult *rv = nullptr, bool addLineTerminator = false);
  nsresult GrowBuffer(int32_t desiredSize);
  void ClearBuffer();
  bool NextLineAvailable();
protected:
  bool m_eatCRLFs;
  bool m_allocateNewLines;
  char * m_dataBuffer;
  uint32_t m_dataBufferSize;
  uint32_t m_startPos;
  uint32_t m_numBytesInBuffer;
  char m_lineToken;
};


#endif
