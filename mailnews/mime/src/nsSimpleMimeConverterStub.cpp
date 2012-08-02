/* -*- Mode: C++; tab-width: 20; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "mimecth.h"
#include "mimeobj.h"
#include "mimetext.h"
#include "mimemoz2.h"
#include "mimecom.h"
#include "nsStringGlue.h"
#include "nsComponentManagerUtils.h"
#include "nsICategoryManager.h"
#include "nsCOMPtr.h"
#include "nsAutoPtr.h"
#include "nsISimpleMimeConverter.h"
#include "nsServiceManagerUtils.h"
#include "nsSimpleMimeConverterStub.h"

typedef struct MimeSimpleStub MimeSimpleStub;
typedef struct MimeSimpleStubClass MimeSimpleStubClass;

struct MimeSimpleStubClass {
    MimeInlineTextClass text;
};

struct MimeSimpleStub {
    MimeInlineText text;
    nsCString *buffer;
    nsCOMPtr<nsISimpleMimeConverter> innerScriptable;
};

MimeDefClass(MimeSimpleStub, MimeSimpleStubClass, mimeSimpleStubClass, NULL);

static int
BeginGather(MimeObject *obj)
{
    MimeSimpleStub *ssobj = (MimeSimpleStub *)obj;
    int status = ((MimeObjectClass *)XPCOM_GetmimeLeafClass())->parse_begin(obj);

    if (status < 0)
        return status;

    if (!obj->output_p ||
        !obj->options ||
        !obj->options->write_html_p) {
        return 0;
    }

    ssobj->buffer->Truncate();
    return 0;
}

static int
GatherLine(const char *line, PRInt32 length, MimeObject *obj)
{
    MimeSimpleStub *ssobj = (MimeSimpleStub *)obj;

    if (!obj->output_p ||
        !obj->options ||
        !obj->options->output_fn) {
        return 0;
    }

    if (!obj->options->write_html_p)
        return MimeObject_write(obj, line, length, true);

    ssobj->buffer->Append(line);
    return 0;
}

static int
EndGather(MimeObject *obj, bool abort_p)
{
    MimeSimpleStub *ssobj = (MimeSimpleStub *)obj;

    if (obj->closed_p)
        return 0;

    int status = ((MimeObjectClass *)MIME_GetmimeInlineTextClass())->parse_eof(obj, abort_p);
    if (status < 0)
        return status;

    if (ssobj->buffer->IsEmpty())
        return 0;

    mime_stream_data  *msd = (mime_stream_data *) (obj->options->stream_closure);
    nsIChannel *channel = msd->channel;  // note the lack of ref counting...
    if (channel)
    {
        nsCOMPtr<nsIURI> uri;
        channel->GetURI(getter_AddRefs(uri));
        ssobj->innerScriptable->SetUri(uri);
    }
    nsCString asHTML;
    nsresult rv = ssobj->innerScriptable->ConvertToHTML(nsDependentCString(obj->content_type),
                                                        *ssobj->buffer,
                                                        asHTML);
    if (NS_FAILED(rv)) {
        NS_ASSERTION(NS_SUCCEEDED(rv), "converter failure");
        return -1;
    }

    // MimeObject_write wants a non-const string for some reason, but it doesn't mutate it
    status = MimeObject_write(obj, asHTML.get(),
                              asHTML.Length(), true);
    if (status < 0)
        return status;
    return 0;
}

static int
Initialize(MimeObject *obj)
{
    MimeSimpleStub *ssobj = (MimeSimpleStub *)obj;

    nsresult rv;
    nsCOMPtr<nsICategoryManager> catman =
        do_GetService(NS_CATEGORYMANAGER_CONTRACTID, &rv);
    if (NS_FAILED(rv))
        return -1;

    nsCString value;
    rv = catman->GetCategoryEntry(NS_SIMPLEMIMECONVERTERS_CATEGORY,
                                  obj->content_type, getter_Copies(value));
    if (NS_FAILED(rv) || value.IsEmpty())
        return -1;

    ssobj->innerScriptable = do_CreateInstance(value.get(), &rv);
    if (NS_FAILED(rv) || !ssobj->innerScriptable)
        return -1;
    ssobj->buffer = new nsCString();
    ((MimeObjectClass *)XPCOM_GetmimeLeafClass())->initialize(obj);

    return 0;
}

static void
Finalize(MimeObject *obj)
{
    MimeSimpleStub *ssobj = (MimeSimpleStub *)obj;
    ssobj->innerScriptable = nullptr;
    delete ssobj->buffer;
}

static int
MimeSimpleStubClassInitialize(MimeSimpleStubClass *clazz)
{
    MimeObjectClass *oclass = (MimeObjectClass *)clazz;
    oclass->parse_begin = BeginGather;
    oclass->parse_line = GatherLine;
    oclass->parse_eof = EndGather;
    oclass->initialize = Initialize;
    oclass->finalize = Finalize;
    return 0;
}

class nsSimpleMimeConverterStub : public nsIMimeContentTypeHandler
{
public:
    nsSimpleMimeConverterStub(const char *aContentType) : mContentType(aContentType) { }
    virtual ~nsSimpleMimeConverterStub() { }

    NS_DECL_ISUPPORTS

    NS_IMETHOD GetContentType(char **contentType)
    {
        *contentType = ToNewCString(mContentType);
        return *contentType ? NS_OK : NS_ERROR_OUT_OF_MEMORY;
    }
    NS_IMETHOD CreateContentTypeHandlerClass(const char *contentType,
                                             contentTypeHandlerInitStruct *initString,
                                             MimeObjectClass **objClass);
private:
    nsCString mContentType;
};

NS_IMPL_ISUPPORTS1(nsSimpleMimeConverterStub, nsIMimeContentTypeHandler)

NS_IMETHODIMP
nsSimpleMimeConverterStub::CreateContentTypeHandlerClass(const char *contentType,
                                                     contentTypeHandlerInitStruct *initStruct,
                                                         MimeObjectClass **objClass)
{
    NS_ENSURE_ARG_POINTER(objClass);

    *objClass = (MimeObjectClass *)&mimeSimpleStubClass;
    (*objClass)->superclass = (MimeObjectClass *)XPCOM_GetmimeInlineTextClass();
    NS_ENSURE_TRUE((*objClass)->superclass, NS_ERROR_UNEXPECTED);

    initStruct->force_inline_display = true;
    return NS_OK;;
}

nsresult
MIME_NewSimpleMimeConverterStub(const char *aContentType,
                                nsIMimeContentTypeHandler **aResult)
{
    nsRefPtr<nsSimpleMimeConverterStub> inst = new nsSimpleMimeConverterStub(aContentType);
    NS_ENSURE_TRUE(inst, NS_ERROR_OUT_OF_MEMORY);

    return CallQueryInterface(inst.get(), aResult);
}
