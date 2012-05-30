/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include <stack>
#include <map>
#include <sstream>
#include "Windows.h"
#include "rtfDecoder.h"

#define SIZEOF(x) (sizeof(x)/sizeof((x)[0]))
#define IS_DIGIT(i)   ((i) >= '0' && (i) <= '9')
#define IS_ALPHA(VAL) (((VAL) >= 'a' && (VAL) <= 'z') || ((VAL) >= 'A' && (VAL) <= 'Z'))

inline int HexToInt(char ch)
{
  switch (ch) {
  case '0': case '1': case '2': case '3': case '4': case '5': case '6': case '7': case '8': case '9':
    return ch-'0';
  case 'A': case 'B': case 'C': case 'D': case 'E': case 'F':
    return ch-'A'+10;
  case 'a': case 'b': case 'c': case 'd': case 'e': case 'f':
    return ch-'a'+10;
  default:
    return 0;
  }
}

inline int CharsetToCP(int charset)
{
  // We don't know the Code page for the commented out charsets.
  switch (charset) {
  case 0: return 1252; // ANSI
  case 1: return 0;   // Default
//case 2: return 42; // Symbol
  case 2: return 1252; // Symbol
  case 77: return 10000; // Mac Roman
  case 78: return 10001; // Mac Shift Jis
  case 79: return 10003; // Mac Hangul
  case 80: return 10008; // Mac GB2312
  case 81: return 10002; // Mac Big5
//case 82: Mac Johab (old)
  case 83: return 10005; // Mac Hebrew
  case 84: return 10004; // Mac Arabic
  case 85: return 10006; // Mac Greek
  case 86: return 10081; // Mac Turkish
  case 87: return 10021; // Mac Thai
  case 88: return 10029; // Mac East Europe
  case 89: return 10007; // Mac Russian
  case 128: return 932; // Shift JIS
  case 129: return 949; // Hangul
  case 130: return 1361; // Johab
  case 134: return 936; // GB2312
  case 136: return 950; // Big5
  case 161: return 1253; // Greek
  case 162: return 1254; // Turkish
  case 163: return 1258; // Vietnamese
  case 177: return 1255; // Hebrew
  case 178: return 1256; // Arabic
//case 179: Arabic Traditional (old)
//case 180: Arabic user (old)
//case 181: Hebrew user (old)
  case 186: return 1257; // Baltic
  case 204: return 1251; // Russian
  case 222: return 874; // Thai
  case 238: return 1250; // Eastern European
  case 254: return 437; // PC 437
  case 255: return 850; // OEM
  default: return CP_ACP;
  }
}

struct FontInfo {
  enum Options {has_fcharset = 0x0001,
                has_cpg      = 0x0002};
  unsigned int options;
  int fcharset;
  unsigned int cpg;
  FontInfo() : options(0), fcharset(0), cpg(0xFFFFFFFF) {}
  unsigned int Codepage()
  {
    if (options & has_cpg)
      return cpg;
    else if (options & has_fcharset)
      return CharsetToCP(fcharset);
    else return 0xFFFFFFFF;
  }
};
typedef std::map<int, FontInfo> Fonttbl;

struct LocalState {
  bool fonttbl;         // When fonts are being defined
  int f;                // Index of the font being defined/used; defines the codepage if no \cpg
  unsigned int uc;      // ucN keyword value; its default is 1
  unsigned int codepage;// defined by \cpg
};
typedef std::stack<LocalState> StateStack;

struct GlobalState {
  enum Pcdata_state { pcdsno, pcdsin, pcdsfinished };
  std::istream& stream;
  Fonttbl fonttbl;
  StateStack stack;
  unsigned int codepage; // defined by \ansi, \mac, \pc, \pca, and \ansicpgN
  int deff;
  std::stringstream pcdata_a;
  unsigned int pcdata_a_codepage;
  Pcdata_state pcdata_a_state;

  GlobalState(std::istream& s)
    : stream(s), codepage(CP_ACP), deff(-1), pcdata_a_state(pcdsno)
  {
    LocalState st;
    st.fonttbl = false;
    st.f = -1;
    st.uc = 1;
    st.codepage = 0xFFFFFFFF;
    stack.push(st);
  }
  unsigned int GetCurrentCP()
  {
    if (stack.top().codepage != 0xFFFFFFFF) // \cpg in use
      return stack.top().codepage;
    // \cpg not used; use font settings
    int f = (stack.top().f != -1) ? stack.top().f : deff; 
    if (f != -1) {
      Fonttbl::iterator iter = fonttbl.find(f);
      if (iter != fonttbl.end()) {
        unsigned int cp = iter->second.Codepage();
        if (cp != 0xFFFFFFFF)
          return cp;
      }
    }
    return codepage; // No overrides; use the top-level legacy setting
  }
};

struct Keyword {
  char name[33];
  bool hasVal;
  int val;
};

class Lexem {
public:
  enum Type {ltGroupBegin, ltGroupEnd, ltKeyword, ltPCDATA_A, ltPCDATA_W,
             ltBDATA, ltEOF, ltError};
  Lexem(Type t=ltError) : m_type(t) {}
  Lexem(Lexem& from) // Move pointers when copying
  {
    switch (m_type = from.m_type) {
    case ltKeyword:
      m_keyword = from.m_keyword;
      break;
    case ltPCDATA_A:
      m_pcdata_a = from.m_pcdata_a;
      break;
    case ltPCDATA_W:
      m_pcdata_w = from.m_pcdata_w;
      break;
    case ltBDATA:
      m_bdata = from.m_bdata;
      from.m_type = ltError;
      break;
    }
  }
  ~Lexem() { Clear(); }
  Lexem& operator = (Lexem& from)
  {
    if (&from != this) {
      Clear();
      switch (m_type = from.m_type) {
      case ltKeyword:
        m_keyword = from.m_keyword;
        break;
      case ltPCDATA_A:
        m_pcdata_a = from.m_pcdata_a;
        break;
      case ltPCDATA_W:
        m_pcdata_w = from.m_pcdata_w;
        break;
      case ltBDATA:
        m_bdata = from.m_bdata;
        from.m_type = ltError;
        break;
      }
    }
    return *this;
  }
  Type type() const { return m_type; }
  void SetPCDATA_A(char chdata)
  {
    Clear();
    m_pcdata_a = chdata;
    m_type = ltPCDATA_A;
  }
  void SetPCDATA_W(wchar_t chdata)
  {
    Clear();
    m_pcdata_w = chdata;
    m_type = ltPCDATA_W;
  }
  void SetBDATA(const char* data, int sz)
  {
    char* tmp = new char[sz]; // to allow getting the data from itself
    if (tmp) {
      memcpy(tmp, data, sz);
      Clear();
      m_bdata.data = tmp;
      m_bdata.sz = sz;
      m_type = ltBDATA;
    }
    else m_type = ltError;
  }
  void SetKeyword(const Keyword& src)
  {
    Clear();
    m_type = ltKeyword;
    m_keyword = src;
  }
  void SetKeyword(const char* name, bool hasVal=false, int val=0)
  {
    char tmp[SIZEOF(m_keyword.name)];
    strncpy(tmp, name, SIZEOF(m_keyword.name)-1); // to allow copy drom itself
    tmp[SIZEOF(m_keyword.name)-1]=0;
    Clear();
    m_type = ltKeyword;
    memcpy(m_keyword.name, tmp, SIZEOF(m_keyword.name));
    m_keyword.hasVal=hasVal;
    m_keyword.val=val;
  }
  const char* KeywordName() const {
    return (m_type == ltKeyword) ? m_keyword.name : 0; }
  const int* KeywordVal() const {
    return ((m_type == ltKeyword) && m_keyword.hasVal) ? &m_keyword.val : 0; }
  char pcdata_a() const { return (m_type == ltPCDATA_A) ? m_pcdata_a : 0; }
  wchar_t pcdata_w() const { return (m_type == ltPCDATA_W) ? m_pcdata_w : 0; }
  const char* bdata() const { return (m_type == ltBDATA) ? m_bdata.data : 0; }
  int bdata_sz() const { return (m_type == ltBDATA) ? m_bdata.sz : 0; }
  static Lexem eof;
  static Lexem groupBegin;
  static Lexem groupEnd;
  static Lexem error;
private:
  struct BDATA {
    size_t sz;
    char* data;
  };

  Type m_type;
  union {
    Keyword m_keyword;
    char m_pcdata_a;
    wchar_t m_pcdata_w;
    BDATA m_bdata;
  };
  // This function leaves the object in the broken state. Must be followed
  // by a correct initialization.
  void Clear() 
  {
    switch (m_type) {
    case ltBDATA:
      delete[] m_bdata.data;
      break;
    }
//  m_type = ltError;
  }
};

Lexem Lexem::eof(ltEOF);
Lexem Lexem::groupBegin(ltGroupBegin);
Lexem Lexem::groupEnd(ltGroupEnd);
Lexem Lexem::error(ltError);

// This function moves pos. When calling the function, pos must be next to the
// backslash; pos must be in the same sequence and before end!
Keyword GetKeyword(std::istream& stream)
{
  Keyword keyword = {"", false, 0};
  char ch;
  if (stream.get(ch).eof())
    return keyword;
  // Control word; maybe delimiter and value
  if (IS_ALPHA(ch)) { 
    int i = 0;
    do {
      // We take up to 32 characters into account, skipping over extra
      // characters (allowing for some non-conformant implementation).
      if (i < 32)
        keyword.name[i++] = ch;
    } while (!stream.get(ch).eof() && IS_ALPHA(ch));
    keyword.name[i] = 0; // NULL-terminating
    if (!stream.eof() && (IS_DIGIT(ch) || (ch == '-'))) { // Value begin
      keyword.hasVal = true;
      bool negative = (ch == '-');
      if (negative) stream.get(ch);
      i = 0;
      while (!stream.eof() && IS_DIGIT(ch)) {
        // We take into account only 10 digits, skip other. Older specs stated
        // that we must be ready for an arbitrary number of digits.
        if (i++ < 10) 
          keyword.val = keyword.val*10 + (ch - '0');
        stream.get(ch);
      }
      if (negative) keyword.val = -keyword.val;
    }
     // End of control word; the space is just a delimiter - skip it
    if (!stream.eof() && !(ch == ' '))
      stream.unget();
  }
  else { // Control symbol
    keyword.name[0] = ch, keyword.name[1] = 0;
  }
  return keyword;
}

Lexem GetLexem(std::istream& stream)
{
  Lexem result;
  // We always stay at the beginning of the next lexem or a crlf
  // If it's a brace then it's group begin/end
  // If it's a backslash -> Preprocess
  // - if it's a \u or \' -> make UTF16 character
  // - else it's a keyword -> Process (e.g., remember the codepage)
  // - (if the keyword is \bin then the following is #BDATA)
  // If it's some other character -> Preprocess
  // - if it's 0x09 -> it's the keyword \tab
  // - else it's a PCDATA
  char ch;
  while (!stream.get(ch).eof() && ((ch == '\n') || (ch == '\r'))); // Skip crlf
  if (stream.eof())
    result = Lexem::eof;
  else {
    switch (ch) {
    case '{': // Group begin
    case '}': // Group end
      result = (ch == '{') ? Lexem::groupBegin : Lexem::groupEnd;
      break;
    case '\\': // Keyword
      result.SetKeyword(GetKeyword(stream));
      break;
    case '\t': // tab
      result.SetKeyword("tab");
      break;
    default: // PSDATA?
      result.SetPCDATA_A(ch);
      break;
    }
  }
  return result;
}

void PreprocessLexem(/*inout*/Lexem& lexem, std::istream& stream, int uc)
{
  if (lexem.type() == Lexem::ltKeyword) {
    if (lexem.KeywordName()[0] == 0) // Empty keyword - maybe eof?
      lexem = Lexem::error;
    else if (eq(lexem.KeywordName(), "u")) {
       // Unicode character - get the UTF16 and skip the uc characters
      if (const int* val = lexem.KeywordVal()) {
        lexem.SetPCDATA_W(*val);
        stream.ignore(uc);
      }
      else lexem = Lexem::error;
    }
    else if (eq(lexem.KeywordName(), "'")) {
       // 8-bit character (\'hh) -> use current codepage
      char ch, ch1;
      if (!stream.get(ch).eof()) ch1 = HexToInt(ch);
      if (!stream.get(ch).eof()) (ch1 <<= 4) += HexToInt(ch);
      lexem.SetPCDATA_A(ch1);
    }
    else if (eq(lexem.KeywordName(), "\\") || eq(lexem.KeywordName(), "{") ||
             eq(lexem.KeywordName(), "}")) // escaped characters
      lexem.SetPCDATA_A(lexem.KeywordName()[0]);
    else if (eq(lexem.KeywordName(), "bin")) {
      if (const int* i = lexem.KeywordVal()) {
        char* data = new char[*i];
        if (data) {
          stream.read(data, *i);
          if (stream.fail())
            lexem = Lexem::error;
          else
            lexem.SetBDATA(data, *i);
          delete[] data;
        }
        else lexem = Lexem::error;
      }
      else lexem = Lexem::error;
    }
    else if (eq(lexem.KeywordName(), "\n") || eq(lexem.KeywordName(), "\r")) {
      // escaped cr or lf
      lexem.SetKeyword("par");
    }
  }
}

void UpdateState(const Lexem& lexem, /*inout*/GlobalState& globalState)
{
  switch (globalState.pcdata_a_state) {
  case GlobalState::pcdsfinished: // Last time we finished the pcdata
    globalState.pcdata_a_state = GlobalState::pcdsno;
    break;
  case GlobalState::pcdsin:
     // to be reset later if still in the pcdata
    globalState.pcdata_a_state = GlobalState::pcdsfinished;
    break;
  }

  switch (lexem.type()) {
  case Lexem::ltGroupBegin:
    globalState.stack.push(globalState.stack.top());
    break;
  case Lexem::ltGroupEnd:
    globalState.stack.pop();
    break;
  case Lexem::ltKeyword:
    {
      const int* val = lexem.KeywordVal();
      if (eq(lexem.KeywordName(), "ansi")) globalState.codepage = CP_ACP;
      else if (eq(lexem.KeywordName(), "mac")) globalState.codepage = CP_MACCP;
      else if (eq(lexem.KeywordName(), "pc")) globalState.codepage = 437;
      else if (eq(lexem.KeywordName(), "pca")) globalState.codepage = 850;
      else if (eq(lexem.KeywordName(), "ansicpg") && val)
        globalState.codepage = static_cast<unsigned int>(*val);
      else if (eq(lexem.KeywordName(), "deff") && val)
        globalState.deff = *val;
      else if (eq(lexem.KeywordName(), "fonttbl")) globalState.stack.top().fonttbl = true;
      else if (eq(lexem.KeywordName(), "f") && val) {
        globalState.stack.top().f = *val;
      }
      else if (eq(lexem.KeywordName(), "fcharset") &&
               globalState.stack.top().fonttbl &&
               (globalState.stack.top().f != -1) && val) {
        FontInfo& f = globalState.fonttbl[globalState.stack.top().f];
        f.options |= FontInfo::has_fcharset;
        f.fcharset = *val;
      }
      else if (eq(lexem.KeywordName(), "cpg") && val) {
        if (globalState.stack.top().fonttbl && (globalState.stack.top().f != -1)) { // Defining a font
          FontInfo& f = globalState.fonttbl[globalState.stack.top().f];
          f.options |= FontInfo::has_cpg;
          f.cpg = *val;
        }
        else { // Overriding the codepage for the block - may be in filenames
          globalState.stack.top().codepage = *val;
        }
      }
      else if (eq(lexem.KeywordName(), "plain"))
        globalState.stack.top().f = -1;
      else if (eq(lexem.KeywordName(), "uc") && val)
        globalState.stack.top().uc = *val;
    }
    break;
  case Lexem::ltPCDATA_A:
    if (globalState.pcdata_a_state == GlobalState::pcdsno) // Beginning of the pcdata
      globalState.pcdata_a_codepage = globalState.GetCurrentCP(); // to use later to convert to utf16
    globalState.pcdata_a_state = GlobalState::pcdsin;
    globalState.pcdata_a << lexem.pcdata_a();
    break;
  }
}

void DecodeRTF(std::istream& rtf, CRTFDecoder& decoder)
{
  // Check if this is the rtf
  Lexem lexem = GetLexem(rtf);
  if (lexem.type() != Lexem::ltGroupBegin)
    return;
  decoder.BeginGroup();
  lexem = GetLexem(rtf);
  if ((lexem.type() != Lexem::ltKeyword) || !eq(lexem.KeywordName(), "rtf") ||
      !lexem.KeywordVal() || (*lexem.KeywordVal() != 1))
    return;
  decoder.Keyword(lexem.KeywordName(), lexem.KeywordVal());

  GlobalState state(rtf);
  // Level is the count of elements in the stack

  while (!state.stream.eof() && (state.stack.size()>0)) { // Don't go past the global group
    lexem = GetLexem(state.stream);
    PreprocessLexem(lexem, state.stream, state.stack.top().uc);
    UpdateState(lexem, state);

    if (state.pcdata_a_state == GlobalState::pcdsfinished) {
      std::string s = state.pcdata_a.str();
      int sz = ::MultiByteToWideChar(state.pcdata_a_codepage, 0, s.c_str(), s.size(), 0, 0);
      if (sz) {
        wchar_t* data = new wchar_t[sz];
        ::MultiByteToWideChar(state.pcdata_a_codepage, 0, s.c_str(), s.size(), data, sz);
        decoder.PCDATA(data, sz);
        delete[] data;
      }
      state.pcdata_a.str(""); // reset
    }

    switch (lexem.type()) {
    case Lexem::ltGroupBegin:
      decoder.BeginGroup();
      break;
    case Lexem::ltGroupEnd:
      decoder.EndGroup();
      break;
    case Lexem::ltKeyword:
      decoder.Keyword(lexem.KeywordName(), lexem.KeywordVal());
      break;
    case Lexem::ltPCDATA_W:
      {
        wchar_t ch = lexem.pcdata_w();
        decoder.PCDATA(&ch, 1);
      }
      break;
    case Lexem::ltBDATA:
      decoder.BDATA(lexem.bdata(), lexem.bdata_sz());
      break;
    case Lexem::ltError:
      break; // Just silently skip the erroneous data - basic error recovery
    }
  } // while
} // DecodeRTF
