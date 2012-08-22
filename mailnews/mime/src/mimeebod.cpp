/* -*- Mode: C; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
#include "nsCOMPtr.h"
#include "nsIURL.h"
#include "mimeebod.h"
#include "prmem.h"
#include "plstr.h"
#include "prlog.h"
#include "prio.h"
#include "msgCore.h"
#include "nsMimeStringResources.h"
#include "mimemoz2.h"
#include "nsComponentManagerUtils.h"
#include "nsMsgUtils.h"
#include "nsINetUtil.h"
#include <ctype.h>

#define MIME_SUPERCLASS mimeObjectClass
MimeDefClass(MimeExternalBody, MimeExternalBodyClass,
       mimeExternalBodyClass, &MIME_SUPERCLASS);

#ifdef XP_MACOSX
extern MimeObjectClass mimeMultipartAppleDoubleClass;
#endif

static int MimeExternalBody_initialize (MimeObject *);
static void MimeExternalBody_finalize (MimeObject *);
static int MimeExternalBody_parse_line (const char *, int32_t, MimeObject *);
static int MimeExternalBody_parse_eof (MimeObject *, bool);
static bool MimeExternalBody_displayable_inline_p (MimeObjectClass *clazz,
                            MimeHeaders *hdrs);

#if 0
#if defined(DEBUG) && defined(XP_UNIX)
static int MimeExternalBody_debug_print (MimeObject *, PRFileDesc *, int32_t);
#endif
#endif /* 0 */

static int
MimeExternalBodyClassInitialize(MimeExternalBodyClass *clazz)
{
  MimeObjectClass *oclass = (MimeObjectClass *) clazz;

  NS_ASSERTION(!oclass->class_initialized, "1.1 <rhp@netscape.com> 19 Mar 1999 12:00");
  oclass->initialize  = MimeExternalBody_initialize;
  oclass->finalize    = MimeExternalBody_finalize;
  oclass->parse_line  = MimeExternalBody_parse_line;
  oclass->parse_eof  = MimeExternalBody_parse_eof;
  oclass->displayable_inline_p = MimeExternalBody_displayable_inline_p;

#if 0
#if defined(DEBUG) && defined(XP_UNIX)
  oclass->debug_print = MimeExternalBody_debug_print;
#endif
#endif /* 0 */

  return 0;
}


static int
MimeExternalBody_initialize (MimeObject *object)
{
  return ((MimeObjectClass*)&MIME_SUPERCLASS)->initialize(object);
}

static void
MimeExternalBody_finalize (MimeObject *object)
{
  MimeExternalBody *bod = (MimeExternalBody *) object;
  if (bod->hdrs)
  {
    MimeHeaders_free(bod->hdrs);
    bod->hdrs = 0;
  }
  PR_FREEIF(bod->body);

  ((MimeObjectClass*)&MIME_SUPERCLASS)->finalize(object);
}

static int
MimeExternalBody_parse_line (const char *line, int32_t length, MimeObject *obj)
{
  MimeExternalBody *bod = (MimeExternalBody *) obj;
  int status = 0;

  NS_ASSERTION(line && *line, "1.1 <rhp@netscape.com> 19 Mar 1999 12:00");
  if (!line || !*line) return -1;

  if (!obj->output_p) return 0;

  /* If we're supposed to write this object, but aren't supposed to convert
   it to HTML, simply pass it through unaltered. */
  if (obj->options &&
    !obj->options->write_html_p &&
    obj->options->output_fn)
  return MimeObject_write(obj, line, length, true);


  /* If we already have a `body' then we're done parsing headers, and all
   subsequent lines get tacked onto the body. */
  if (bod->body)
  {
    int L = strlen(bod->body);
    char *new_str = (char *)PR_Realloc(bod->body, L + length + 1);
    if (!new_str) return MIME_OUT_OF_MEMORY;
    bod->body = new_str;
    memcpy(bod->body + L, line, length);
    bod->body[L + length] = 0;
    return 0;
  }

  /* Otherwise we don't yet have a body, which means we're not done parsing
   our headers.
   */
  if (!bod->hdrs)
  {
    bod->hdrs = MimeHeaders_new();
    if (!bod->hdrs) return MIME_OUT_OF_MEMORY;
  }

  status = MimeHeaders_parse_line(line, length, bod->hdrs);
  if (status < 0) return status;

  /* If this line is blank, we're now done parsing headers, and should
   create a dummy body to show that.  Gag.
   */
  if (*line == '\r' || *line == '\n')
  {
    bod->body = strdup("");
    if (!bod->body) return MIME_OUT_OF_MEMORY;
  }

  return 0;
}


char *
MimeExternalBody_make_url(const char *ct,
              const char *at, const char *lexp, const char *size,
              const char *perm, const char *dir, const char *mode,
              const char *name, const char *url, const char *site,
              const char *svr, const char *subj, const char *body)
{
  char *s;
  uint32_t slen;
  if (!at)
  {
    return 0;
  }
  else if (!PL_strcasecmp(at, "ftp") || !PL_strcasecmp(at, "anon-ftp"))
  {
    if (!site || !name)
      return 0;
	  
    slen = strlen(name) + strlen(site) + (dir ? strlen(dir) : 0) + 20;
    s = (char *) PR_MALLOC(slen);

    if (!s) return 0;
    PL_strncpyz(s, "ftp://", slen);
    PL_strcatn(s, slen, site);
    PL_strcatn(s, slen, "/");
    if (dir) PL_strcatn(s, slen, (dir[0] == '/' ? dir+1 : dir));
    if (s[strlen(s)-1] != '/')
      PL_strcatn(s, slen, "/");
    PL_strcatn(s, slen, name);
    return s;
  }
  else if (!PL_strcasecmp(at, "local-file") || !PL_strcasecmp(at, "afs"))
  {
    if (!name)
      return 0;

#ifdef XP_UNIX
    if (!PL_strcasecmp(at, "afs"))   /* only if there is a /afs/ directory */
    {
      nsCOMPtr <nsIFile> fs = do_CreateInstance(NS_LOCAL_FILE_CONTRACTID);
      bool exists = false;
      if (fs)
      {
        fs->InitWithNativePath(NS_LITERAL_CSTRING("/afs/."));
        fs->Exists(&exists);
      }
      if  (!exists)
        return 0;
    }
#else  /* !XP_UNIX */
    return 0;            /* never, if not Unix. */
#endif /* !XP_UNIX */

    slen = (strlen(name) * 3 + 20);
    s = (char *) PR_MALLOC(slen);
    if (!s) return 0;
    PL_strncpyz(s, "file:", slen);

    nsCString s2;
    MsgEscapeString(nsDependentCString(name), nsINetUtil::ESCAPE_URL_PATH, s2);
    PL_strcatn(s, slen, s2.get());
    return s;
  }
else if (!PL_strcasecmp(at, "mail-server"))
{
  if (!svr)
    return 0;
	
  slen =  (strlen(svr)*4 + (subj ? strlen(subj)*4 : 0) +
                         (body ? strlen(body)*4 : 0) + 25); // dpv xxx: why 4x? %xx escaping should be 3x
  s = (char *) PR_MALLOC(slen);
  if (!s) return 0;
  PL_strncpyz(s, "mailto:", slen);

  nsCString s2;
  MsgEscapeString(nsDependentCString(svr), nsINetUtil::ESCAPE_XALPHAS, s2);
  PL_strcatn(s, slen, s2.get());

  if (subj)
    {
      MsgEscapeString(nsDependentCString(subj), nsINetUtil::ESCAPE_XALPHAS, s2);
      PL_strcatn(s, slen, "?subject=");
      PL_strcatn(s, slen, s2.get());
    }
  if (body)
    {
      MsgEscapeString(nsDependentCString(body), nsINetUtil::ESCAPE_XALPHAS, s2);
      PL_strcatn(s, slen, (subj ? "&body=" : "?body="));
      PL_strcatn(s, slen, s2.get());
    }
  return s;
}
else if (!PL_strcasecmp(at, "url"))      /* RFC 2017 */
                            {
  if (url)
    return strdup(url);       /* it's already quoted and everything */
  else
    return 0;
                            }
                            else
                            return 0;
}

static int
MimeExternalBody_parse_eof (MimeObject *obj, bool abort_p)
{
  int status = 0;
  MimeExternalBody *bod = (MimeExternalBody *) obj;

  if (obj->closed_p) return 0;

  /* Run parent method first, to flush out any buffered data. */
  status = ((MimeObjectClass*)&MIME_SUPERCLASS)->parse_eof(obj, abort_p);
  if (status < 0) return status;

#ifdef XP_MACOSX
  if (obj->parent && mime_typep(obj->parent,
                                (MimeObjectClass*) &mimeMultipartAppleDoubleClass))
    goto done;
#endif /* XP_MACOSX */

  if (!abort_p &&
      obj->output_p &&
      obj->options &&
      obj->options->write_html_p)
  {
    bool all_headers_p = obj->options->headers == MimeHeadersAll;
    MimeDisplayOptions *newopt = obj->options;  /* copy it */

    char *ct = MimeHeaders_get(obj->headers, HEADER_CONTENT_TYPE,
                               false, false);
    char *at, *lexp, *size, *perm;
    char *url, *dir, *mode, *name, *site, *svr, *subj;
    char *h = 0, *lname = 0, *lurl = 0, *body = 0;
    MimeHeaders *hdrs = 0;

    if (!ct) return MIME_OUT_OF_MEMORY;

    at   = MimeHeaders_get_parameter(ct, "access-type", NULL, NULL);
    lexp  = MimeHeaders_get_parameter(ct, "expiration", NULL, NULL);
    size = MimeHeaders_get_parameter(ct, "size", NULL, NULL);
    perm = MimeHeaders_get_parameter(ct, "permission", NULL, NULL);
    dir  = MimeHeaders_get_parameter(ct, "directory", NULL, NULL);
    mode = MimeHeaders_get_parameter(ct, "mode", NULL, NULL);
    name = MimeHeaders_get_parameter(ct, "name", NULL, NULL);
    site = MimeHeaders_get_parameter(ct, "site", NULL, NULL);
    svr  = MimeHeaders_get_parameter(ct, "server", NULL, NULL);
    subj = MimeHeaders_get_parameter(ct, "subject", NULL, NULL);
    url  = MimeHeaders_get_parameter(ct, "url", NULL, NULL);
    PR_FREEIF(ct);

    /* the *internal* content-type */
    ct = MimeHeaders_get(bod->hdrs, HEADER_CONTENT_TYPE,
                         true, false);
						 
    uint32_t hlen = ((at ? strlen(at) : 0) +
                    (lexp ? strlen(lexp) : 0) +
                    (size ? strlen(size) : 0) +
                    (perm ? strlen(perm) : 0) +
                    (dir ? strlen(dir) : 0) +
                    (mode ? strlen(mode) : 0) +
                    (name ? strlen(name) : 0) +
                    (site ? strlen(site) : 0) +
                    (svr ? strlen(svr) : 0) +
                    (subj ? strlen(subj) : 0) +
                    (ct ? strlen(ct) : 0) +
                    (url ? strlen(url) : 0) + 100);
					
	h = (char *) PR_MALLOC(hlen);
    if (!h)
    {
      status = MIME_OUT_OF_MEMORY;
      goto FAIL;
    }

    /* If there's a URL parameter, remove all whitespace from it.
      (The URL parameter to one of these headers is stored with
       lines broken every 40 characters or less; it's assumed that
       all significant whitespace was URL-hex-encoded, and all the
       rest of it was inserted just to keep the lines short.)
      */
    if (url)
    {
      char *in, *out;
      for (in = url, out = url; *in; in++)
        if (!IS_SPACE(*in))
          *out++ = *in;
      *out = 0;
    }

    hdrs = MimeHeaders_new();
    if (!hdrs)
    {
      status = MIME_OUT_OF_MEMORY;
      goto FAIL;
    }

# define FROB(STR,VAR) \
    if (VAR) \
    { \
      PL_strncpyz(h, STR ": ", hlen); \
        PL_strcatn(h, hlen, VAR); \
          PL_strcatn(h, hlen, MSG_LINEBREAK); \
            status = MimeHeaders_parse_line(h, strlen(h), hdrs); \
              if (status < 0) goto FAIL; \
    }
    FROB("Access-Type",  at);
    FROB("URL",      url);
    FROB("Site",      site);
    FROB("Server",    svr);
    FROB("Directory",    dir);
    FROB("Name",      name);
    FROB("Type",      ct);
    FROB("Size",      size);
    FROB("Mode",      mode);
    FROB("Permission",  perm);
    FROB("Expiration",  lexp);
    FROB("Subject",    subj);
# undef FROB
    PL_strncpyz(h, MSG_LINEBREAK, hlen);
    status = MimeHeaders_parse_line(h, strlen(h), hdrs);
    if (status < 0) goto FAIL;

    lurl = MimeExternalBody_make_url(ct, at, lexp, size, perm, dir, mode,
                                     name, url, site, svr, subj, bod->body);
    if (lurl)
    {
      lname = MimeGetStringByID(MIME_MSG_LINK_TO_DOCUMENT);
    }
    else
    {
      lname = MimeGetStringByID(MIME_MSG_DOCUMENT_INFO);
      all_headers_p = true;
    }

    all_headers_p = true;  /* #### just do this all the time? */

    if (bod->body && all_headers_p)
    {
      char *s = bod->body;
      while (IS_SPACE(*s)) s++;
      if (*s)
      {
        char *s2;
        const char *pre = "<P><PRE>";
        const char *suf = "</PRE>";
        int32_t i;
        for(i = strlen(s)-1; i >= 0 && IS_SPACE(s[i]); i--)
          s[i] = 0;
        s2 = MsgEscapeHTML(s);
        if (!s2) goto FAIL;
        body = (char *) PR_MALLOC(strlen(pre) + strlen(s2) +
                                  strlen(suf) + 1);
        if (!body)
        {
          NS_Free(s2);
          goto FAIL;
        }
        PL_strcpy(body, pre);
        PL_strcat(body, s2);
        PL_strcat(body, suf);
      }
    }

    newopt->fancy_headers_p = true;
    newopt->headers = (all_headers_p ? MimeHeadersAll : MimeHeadersSome);

FAIL:
      if (hdrs)
        MimeHeaders_free(hdrs);
    PR_FREEIF(h);
    PR_FREEIF(lname);
    PR_FREEIF(lurl);
    PR_FREEIF(body);
    PR_FREEIF(ct);
    PR_FREEIF(at);
    PR_FREEIF(lexp);
    PR_FREEIF(size);
    PR_FREEIF(perm);
    PR_FREEIF(dir);
    PR_FREEIF(mode);
    PR_FREEIF(name);
    PR_FREEIF(url);
    PR_FREEIF(site);
    PR_FREEIF(svr);
    PR_FREEIF(subj);
  }

#ifdef XP_MACOSX
done:
#endif

    return status;
}

#if 0
#if defined(DEBUG) && defined(XP_UNIX)
static int
MimeExternalBody_debug_print (MimeObject *obj, PRFileDesc *stream, int32_t depth)
{
  MimeExternalBody *bod = (MimeExternalBody *) obj;
  int i;
  char *ct, *ct2;
  char *addr = mime_part_address(obj);

  if (obj->headers)
  ct = MimeHeaders_get (obj->headers, HEADER_CONTENT_TYPE, false, false);
  if (bod->hdrs)
  ct2 = MimeHeaders_get (bod->hdrs, HEADER_CONTENT_TYPE, false, false);

  for (i=0; i < depth; i++)
  PR_Write(stream, "  ", 2);
/***
  fprintf(stream,
      "<%s %s\n"
      "\tcontent-type: %s\n"
      "\tcontent-type: %s\n"
      "\tBody:%s\n\t0x%08X>\n\n",
      obj->clazz->class_name,
      addr ? addr : "???",
      ct ? ct : "<none>",
      ct2 ? ct2 : "<none>",
      bod->body ? bod->body : "<none>",
      (uint32_t) obj);
***/
  PR_FREEIF(addr);
  PR_FREEIF(ct);
  PR_FREEIF(ct2);
  return 0;
}
#endif
#endif /* 0 */

static bool
MimeExternalBody_displayable_inline_p (MimeObjectClass *clazz,
                     MimeHeaders *hdrs)
{
  char *ct = MimeHeaders_get (hdrs, HEADER_CONTENT_TYPE, false, false);
  char *at = MimeHeaders_get_parameter(ct, "access-type", NULL, NULL);
  bool inline_p = false;

  if (!at)
  ;
  else if (!PL_strcasecmp(at, "ftp") ||
       !PL_strcasecmp(at, "anon-ftp") ||
       !PL_strcasecmp(at, "local-file") ||
       !PL_strcasecmp(at, "mail-server") ||
       !PL_strcasecmp(at, "url"))
  inline_p = true;
#ifdef XP_UNIX
  else if (!PL_strcasecmp(at, "afs"))   /* only if there is a /afs/ directory */
  {
    nsCOMPtr <nsIFile> fs = do_CreateInstance(NS_LOCAL_FILE_CONTRACTID);
    bool exists = false;
    if (fs)
    {
      fs->InitWithNativePath(NS_LITERAL_CSTRING("/afs/."));
      fs->Exists(&exists);
    }
    if  (!exists)
      return 0;

    inline_p = true;
  }
#endif /* XP_UNIX */

  PR_FREEIF(ct);
  PR_FREEIF(at);
  return inline_p;
}
