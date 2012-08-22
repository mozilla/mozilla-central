/* -*- Mode: C; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _MIMEI_H_
#define _MIMEI_H_

/*
  This module, libmime, implements a general-purpose MIME parser.
  One of the methods provided by this parser is the ability to emit
  an HTML representation of it.

  All Mozilla-specific code is (and should remain) isolated in the
  file mimemoz.c.  Generally, if the code involves images, netlib
  streams it should be in mimemoz.c instead of in the main body of
  the MIME parser.

  The parser is object-oriented and fully buzzword-compliant.
  There is a class for each MIME type, and each class is responsible
  for parsing itself, and/or handing the input data off to one of its
  child objects.

  The class hierarchy is:

     MimeObject (abstract)
      |
      +--- MimeContainer (abstract)
      |     |
      |     +--- MimeMultipart (abstract)
      |     |     |
      |     |     +--- MimeMultipartMixed
      |     |     |
      |     |     +--- MimeMultipartDigest
      |     |     |
      |     |     +--- MimeMultipartParallel
      |     |     |
      |     |     +--- MimeMultipartAlternative
      |     |     |
      |     |     +--- MimeMultipartRelated
      |     |     |
      |     |     +--- MimeMultipartAppleDouble
      |     |     |
      |     |     +--- MimeSunAttachment
      |     |     |
      |     |     \--- MimeMultipartSigned (abstract)
      |     |          |
      |     |          \--- MimeMultipartSignedCMS
      |     |
      |     +--- MimeEncrypted (abstract)
      |     |     |
      |     |     \--- MimeEncryptedPKCS7
      |     |
      |     +--- MimeXlateed (abstract)
      |     |     |
      |     |     \--- MimeXlateed
      |     |
      |     +--- MimeMessage
      |     |
      |     \--- MimeUntypedText
      |
      +--- MimeLeaf (abstract)
      |     |
      |     +--- MimeInlineText (abstract)
      |     |     |
      |     |     +--- MimeInlineTextPlain
      |     |     |     |
      |     |     |     \--- MimeInlineTextHTMLAsPlaintext
      |     |     |
      |     |     +--- MimeInlineTextPlainFlowed
      |     |     |
      |     |     +--- MimeInlineTextHTML
      |     |     |     |
      |     |     |     \--- MimeInlineTextHTMLSanitized
      |     |     |
      |     |     +--- MimeInlineTextRichtext
      |     |     |     |
      |     |     |     \--- MimeInlineTextEnriched
      |     |    |
      |     |    +--- MimeInlineTextVCard
      |     |
      |     +--- MimeInlineImage
      |     |
      |     \--- MimeExternalObject
      |
      \--- MimeExternalBody


  =========================================================================
  The definition of these classes is somewhat idiosyncratic, since I defined
  my own small object system, instead of giving the C++ virus another foothold.
  (I would have liked to have written this in Java, but our runtime isn't
  quite ready for prime time yet.)

  There is one header file and one source file for each class (for example,
  the MimeInlineText class is defined in "mimetext.h" and "mimetext.c".)
  Each header file follows the following boiler-plate form:

  TYPEDEFS: these come first to avoid circular dependencies.

      typedef struct FoobarClass FoobarClass;
      typedef struct Foobar      Foobar;

  CLASS DECLARATION:
  Theis structure defines the callback routines and other per-class data
  of the class defined in this module.

      struct FoobarClass {
        ParentClass superclass;
        ...any callbacks or class-variables...
      };

  CLASS DEFINITION:
  This variable holds an instance of the one-and-only class record; the
  various instances of this class point to this object.  (One interrogates
  the type of an instance by comparing the value of its class pointer with
  the address of this variable.)

      extern FoobarClass foobarClass;

  INSTANCE DECLARATION:
  Theis structure defines the per-instance data of an object, and a pointer
  to the corresponding class record.

      struct Foobar {
        Parent parent;
        ...any instance variables...
      };

  Then, in the corresponding .c file, the following structure is used:

  CLASS DEFINITION:
  First we pull in the appropriate include file (which includes all necessary
  include files for the parent classes) and then we define the class object
  using the MimeDefClass macro:

      #include "foobar.h"
      #define MIME_SUPERCLASS parentlClass
      MimeDefClass(Foobar, FoobarClass, foobarClass, &MIME_SUPERCLASS);

  The definition of MIME_SUPERCLASS is just to move most of the knowlege of the
  exact class hierarchy up to the file's header, instead of it being scattered
  through the various methods; see below.

  METHOD DECLARATIONS:
  We will be putting function pointers into the class object, so we declare
  them here.  They can generally all be static, since nobody outside of this
  file needs to reference them by name; all references to these routines should
  be through the class object.

      extern int FoobarMethod(Foobar *);
      ...etc...

  CLASS INITIALIZATION FUNCTION:
  The MimeDefClass macro expects us to define a function which will finish up
  any initialization of the class object that needs to happen before the first
  time it is instantiated.  Its name must be of the form "<class>Initialize",
  and it should initialize the various method slots in the class as
  appropriate.  Any methods or class variables which this class does not wish
  to override will be automatically inherited from the parent class (by virtue
  of its class-initialization function having been run first.)  Each class
  object will only be initialized once.

      static int
      FoobarClassInitialize(FoobarClass *class)
      {
        clazz->method = FoobarMethod.
        ...etc...
      }

  METHOD DEFINITIONS:
  Next come the definitions of the methods we referred to in the class-init
  function.  The way to access earlier methods (methods defined on the
  superclass) is to simply extract them from the superclass's object.
  But note that you CANNOT get at methods by indirecting through
  object->clazz->superclass: that will only work to one level, and will
  go into a loop if some subclass tries to continue on this method.

  The easiest way to do this is to make use of the MIME_SUPERCLASS macro that
  was defined at the top of the file, as shown below.  The alternative to that
  involves typing the literal name of the direct superclass of the class
  defined in this file, which will be a maintenance headache if the class
  hierarchy changes.  If you use the MIME_SUPERCLASS idiom, then a textual
  change is required in only one place if this class's superclass changes.

      static void
      Foobar_finalize (MimeObject *object)
      {
        ((MimeObjectClass*)&MIME_SUPERCLASS)->finalize(object);  //  RIGHT
        parentClass.whatnot.object.finalize(object);             //  (works...)
        object->clazz->superclass->finalize(object);             //  WRONG!!
      }

  If you write a libmime content type handler, libmime might create several
  instances of your class at once and call e.g. the same finalize code for
  3 different objects in a row.
 */

#include "mimehdrs.h"
#include "nsTArray.h"

typedef struct MimeObject      MimeObject;
typedef struct MimeObjectClass MimeObjectClass;

#ifdef ENABLE_SMIME
class nsICMSMessage;
#endif // ENABLE_SMIME

/* (I don't pretend to understand this.) */
#define cpp_stringify_noop_helper(x)#x
#define cpp_stringify(x) cpp_stringify_noop_helper(x)


/* Macro used for setting up class definitions.
 */
#define MimeDefClass(ITYPE,CTYPE,CVAR,CSUPER) \
 static int CTYPE##Initialize(CTYPE *); \
 CTYPE CVAR = { cpp_stringify(ITYPE), sizeof(ITYPE), \
        (MimeObjectClass *) CSUPER, \
        (int (*) (MimeObjectClass *)) CTYPE##Initialize, 0, }


/* Creates a new (subclass of) MimeObject of the given class, with the
   given headers (which are copied.)
 */
extern MimeObject *mime_new (MimeObjectClass *clazz, MimeHeaders *hdrs,
               const char *override_content_type);


/* Destroys a MimeObject (or subclass) and all data associated with it.
 */
extern "C" void mime_free (MimeObject *object);

/* Given a content-type string, finds and returns an appropriate subclass
   of MimeObject.  A class object is returned.  If `exact_match_p' is true,
   then only fully-known types will be returned; that is, if it is true,
   then "text/x-unknown" will return MimeInlineTextPlainType, but if it is
   false, it will return NULL.
 */
extern MimeObjectClass *mime_find_class (const char *content_type,
                     MimeHeaders *hdrs,
                     MimeDisplayOptions *opts,
                     bool exact_match_p);

/** Given a content-type string, creates and returns an appropriate subclass
 * of MimeObject.  The headers (from which the content-type was presumably
 * extracted) are copied. forceInline is set to true when the caller wants
 * the function to ignore opts->show_attachment_inline_p and force inline
 * display, e.g., mimemalt wants the body part to be shown inline.
 */
extern MimeObject *mime_create (const char *content_type, MimeHeaders *hdrs,
                MimeDisplayOptions *opts, bool forceInline = false);


/* Querying the type hierarchy */
extern bool mime_subclass_p(MimeObjectClass *child,
                 MimeObjectClass *parent);
extern bool mime_typep(MimeObject *obj, MimeObjectClass *clazz);

/* Returns a string describing the location of the part (like "2.5.3").
   This is not a full URL, just a part-number.
 */
extern char *mime_part_address(MimeObject *obj);

/* Returns a string describing the location of the *IMAP* part (like "2.5.3").
   This is not a full URL, just a part-number.
   This part is explicitly passed in the X-Mozilla-IMAP-Part header.
   Return value must be freed by the caller.
 */
extern char *mime_imap_part_address(MimeObject *obj);

extern char *mime_external_attachment_url(MimeObject *obj);

/* Puts a part-number into a URL.  If append_p is true, then the part number
   is appended to any existing part-number already in that URL; otherwise,
   it replaces it.
 */
extern char *mime_set_url_part(const char *url, const char *part, bool append_p);

/*
  cut the part of url for display a attachment as a email.
*/
extern char *mime_get_base_url(const char *url);

/* Puts an *IMAP* part-number into a URL.
 */
extern char *mime_set_url_imap_part(const char *url, const char *part, const char *libmimepart);


/* Given a part ID, looks through the MimeObject tree for a sub-part whose ID
   number matches, and returns the MimeObject (else NULL.)
   (part is not a URL -- it's of the form "1.3.5".)
 */
extern MimeObject *mime_address_to_part(const char *part, MimeObject *obj);


/* Given a part ID, looks through the MimeObject tree for a sub-part whose ID
   number matches; if one is found, returns the Content-Name of that part.
   Else returns NULL.  (part is not a URL -- it's of the form "1.3.5".)
 */
extern char *mime_find_suggested_name_of_part(const char *part,
                        MimeObject *obj);

/* Given a part ID, looks through the MimeObject tree for a sub-part whose ID
   number matches; if one is found, returns the Content-Name of that part.
   Else returns NULL.  (part is not a URL -- it's of the form "1.3.5".)
 */
extern char *mime_find_content_type_of_part(const char *part, MimeObject *obj);

/* Parse the various "?" options off the URL and into the options struct.
 */
extern int mime_parse_url_options(const char *url, MimeDisplayOptions *);

#ifdef ENABLE_SMIME

/* Asks whether the given object is one of the cryptographically signed
   or encrypted objects that we know about.  (MimeMessageClass uses this
   to decide if the headers need to be presented differently.)
 */
extern bool mime_crypto_object_p(MimeHeaders *, bool clearsigned_counts);

/* Tells whether the given MimeObject is a message which has been encrypted
   or signed.  (Helper for MIME_GetMessageCryptoState()).
 */
extern void mime_get_crypto_state (MimeObject *obj,
                   bool *signed_p, bool *encrypted_p,
                   bool *signed_ok, bool *encrypted_ok);


/* Whether the given object has written out the HTML version of its headers
   in such a way that it will have a "crypto stamp" next to the headers.  If
   this is true, then the child must write out its HTML slightly differently
   to take this into account...
 */
extern bool mime_crypto_stamped_p(MimeObject *obj);

/* How the crypto code tells the MimeMessage object what the crypto stamp
   on it says. */
extern void mime_set_crypto_stamp(MimeObject *obj,
                  bool signed_p, bool encrypted_p);
#endif // ENABLE_SMIME

class MimeParseStateObject {
public:

  MimeParseStateObject()
      {root = 0; separator_queued_p = false; separator_suppressed_p = false;
        first_part_written_p = false; post_header_html_run_p = false; first_data_written_p = false;
        decrypted_p = false; strippingPart = false;
      }
  MimeObject *root;        /* The outermost parser object. */

  bool separator_queued_p;  /* Whether a separator should be written out
                   before the next text is written (this lets
                   us write separators lazily, so that one
                   doesn't appear at the end, and so that more
                   than one don't appear in a row.) */

  bool separator_suppressed_p; /* Whether the currently-queued separator
                   should not be printed; this is a kludge to
                   prevent seps from being printed just after
                   a header block... */

  bool first_part_written_p;  /* State used for the `Show Attachments As
                   Links' kludge. */

  bool post_header_html_run_p; /* Whether we've run the
                   options->generate_post_header_html_fn */

  bool first_data_written_p;  /* State used for Mozilla lazy-stream-
                   creation evilness. */

  bool decrypted_p; /* If options->dexlate_p is true, then this
                        will be set to indicate whether any
                        dexlateion did in fact occur.
                      */
  nsTArray<nsCString> partsToStrip; /* if we're stripping parts, what parts to strip */
  nsTArray<nsCString> detachToFiles; /* if we're detaching parts, where each part was detached to */
  bool strippingPart;
  nsCString detachedFilePath;       /* if we've detached this part, filepath of detached part */
};


/* Some output-generation utility functions...
 */
extern int MimeObject_output_init(MimeObject *obj, const char *content_type);

/* The `user_visible_p' argument says whether the output that has just been
   written will cause characters or images to show up on the screen, that
   is, it should be false if the stuff being written is merely structural
   HTML or whitespace ("<P>", "</TABLE>", etc.)  This information is used
   when making the decision of whether a separating <HR> is needed.
 */
extern int MimeObject_write(MimeObject *, const char *data, int32_t length,
                            bool user_visible_p);
extern int MimeOptions_write(MimeDisplayOptions *, nsCString &name,
                             const char *data, int32_t length,
                             bool user_visible_p);

/* Writes out the right kind of HR (or rather, queues it for writing.) */
extern int MimeObject_write_separator(MimeObject *);

extern bool MimeObjectIsMessageBody(MimeObject *obj);

/* This is the data tagged to contexts and the declaration needs to be
   in a header file since more than mimemoz.c needs to see it now...
   */
#ifdef HAVE_MIME_DATA_SLOT
# define LOCK_LAST_CACHED_MESSAGE
#endif

struct MimeDisplayData {            /* This struct is what we hang off of
                                       (context)->mime_data, to remember info
                                       about the last MIME object we've
                                       parsed and displayed.  See
                                       MimeGuessURLContentName() below.
                                     */
  MimeObject *last_parsed_object;
  char *last_parsed_url;

#ifdef LOCK_LAST_CACHED_MESSAGE
  char *previous_locked_url;
#endif /* LOCK_LAST_CACHED_MESSAGE */
};

#endif /* _MIMEI_H_ */
