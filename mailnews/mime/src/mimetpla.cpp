/* -*- Mode: C; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "mimetpla.h"
#include "mimebuf.h"
#include "prmem.h"
#include "plstr.h"
#include "mozITXTToHTMLConv.h"
#include "nsCOMPtr.h"
#include "nsIComponentManager.h"
#include "nsStringGlue.h"
#include "nsMimeStringResources.h"
#include "mimemoz2.h"
#include "nsIServiceManager.h"
#include "nsIPrefBranch.h"
#include "prprf.h"
#include "nsMsgI18N.h"

#define MIME_SUPERCLASS mimeInlineTextClass
MimeDefClass(MimeInlineTextPlain, MimeInlineTextPlainClass,
       mimeInlineTextPlainClass, &MIME_SUPERCLASS);

static int MimeInlineTextPlain_parse_begin (MimeObject *);
static int MimeInlineTextPlain_parse_line (const char *, int32_t, MimeObject *);
static int MimeInlineTextPlain_parse_eof (MimeObject *, bool);

static int
MimeInlineTextPlainClassInitialize(MimeInlineTextPlainClass *clazz)
{
  MimeObjectClass *oclass = (MimeObjectClass *) clazz;
  NS_ASSERTION(!oclass->class_initialized, "class not initialized");
  oclass->parse_begin = MimeInlineTextPlain_parse_begin;
  oclass->parse_line  = MimeInlineTextPlain_parse_line;
  oclass->parse_eof   = MimeInlineTextPlain_parse_eof;
  return 0;
}

extern "C"
void
MimeTextBuildPrefixCSS(int32_t    quotedSizeSetting,   // mail.quoted_size
                       int32_t    quotedStyleSetting,  // mail.quoted_style
                       char       *citationColor,      // mail.citation_color
                       nsACString &style)
{
  switch (quotedStyleSetting)
  {
  case 0:     // regular
    break;
  case 1:     // bold
    style.Append("font-weight: bold; ");
    break;
  case 2:     // italic
    style.Append("font-style: italic; ");
    break;
  case 3:     // bold-italic
    style.Append("font-weight: bold; font-style: italic; ");
    break;
  }

  switch (quotedSizeSetting)
  {
  case 0:     // regular
    break;
  case 1:     // large
    style.Append("font-size: large; ");
    break;
  case 2:     // small
    style.Append("font-size: small; ");
    break;
  }

  if (citationColor && *citationColor)
  {
    style += "color: ";
    style += citationColor;
    style += ';';
  }
}

static int
MimeInlineTextPlain_parse_begin (MimeObject *obj)
{
  int status = 0;
  bool quoting = ( obj->options
    && ( obj->options->format_out == nsMimeOutput::nsMimeMessageQuoting ||
         obj->options->format_out == nsMimeOutput::nsMimeMessageBodyQuoting
       )       );  // The output will be inserted in the composer as quotation
  bool plainHTML = quoting || (obj->options &&
       (obj->options->format_out == nsMimeOutput::nsMimeMessageSaveAs));
       // Just good(tm) HTML. No reliance on CSS.
  bool rawPlainText = obj->options &&
       (obj->options->format_out == nsMimeOutput::nsMimeMessageFilterSniffer
         || obj->options->format_out == nsMimeOutput::nsMimeMessageAttach);

  status = ((MimeObjectClass*)&MIME_SUPERCLASS)->parse_begin(obj);
  if (status < 0) return status;

  if (!obj->output_p) return 0;

  if (obj->options &&
    obj->options->write_html_p &&
    obj->options->output_fn)
  {
      MimeInlineTextPlain *text = (MimeInlineTextPlain *) obj;
      text->mCiteLevel = 0;

      // Get the prefs

      // Quoting
      text->mBlockquoting = true; // mail.quoteasblock

      // Viewing
      text->mQuotedSizeSetting = 0;   // mail.quoted_size
      text->mQuotedStyleSetting = 0;  // mail.quoted_style
      text->mCitationColor = nullptr;  // mail.citation_color
      bool graphicalQuote = true; // mail.quoted_graphical

      nsIPrefBranch *prefBranch = GetPrefBranch(obj->options);
      if (prefBranch)
      {
        prefBranch->GetIntPref("mail.quoted_size", &(text->mQuotedSizeSetting));
        prefBranch->GetIntPref("mail.quoted_style", &(text->mQuotedStyleSetting));
        prefBranch->GetCharPref("mail.citation_color", &(text->mCitationColor));
        prefBranch->GetBoolPref("mail.quoted_graphical", &graphicalQuote);
        prefBranch->GetBoolPref("mail.quoteasblock", &(text->mBlockquoting));
      }

      if (!rawPlainText)
      {
        // Get font
        // only used for viewing (!plainHTML)
        nsAutoCString fontstyle;
        nsAutoCString fontLang;  // langgroup of the font

        // generic font-family name ( -moz-fixed for fixed font and NULL for
        // variable font ) is sufficient now that bug 105199 has been fixed.

        if (!obj->options->variable_width_plaintext_p)
          fontstyle = "font-family: -moz-fixed";

        if (nsMimeOutput::nsMimeMessageBodyDisplay == obj->options->format_out ||
            nsMimeOutput::nsMimeMessagePrintOutput == obj->options->format_out)
        {
          int32_t fontSize;       // default font size
          int32_t fontSizePercentage;   // size percentage
          nsresult rv = GetMailNewsFont(obj,
                             !obj->options->variable_width_plaintext_p,
                             &fontSize, &fontSizePercentage, fontLang);
          if (NS_SUCCEEDED(rv))
          {
            if ( ! fontstyle.IsEmpty() ) {
              fontstyle += "; ";
            }
            fontstyle += "font-size: ";
            fontstyle.AppendInt(fontSize);
            fontstyle += "px;";
          }
        }

        // Opening <div>. We currently have to add formatting here. :-(
        nsAutoCString openingDiv;
        if (!quoting)
             /* 4.x' editor can't break <div>s (e.g. to interleave comments).
                We'll add the class to the <blockquote type=cite> later. */
        {
          openingDiv = "<div class=\"moz-text-plain\"";
          if (!plainHTML)
          {
            if (obj->options->wrap_long_lines_p)
              openingDiv += " wrap=true";
            else
              openingDiv += " wrap=false";

            if (graphicalQuote)
              openingDiv += " graphical-quote=true";
            else
              openingDiv += " graphical-quote=false";

            if (!fontstyle.IsEmpty())
            {
              openingDiv += " style=\"";
              openingDiv += fontstyle;
              openingDiv += '\"';
            }
            if (!fontLang.IsEmpty())
            {
              openingDiv += " lang=\"";
              openingDiv += fontLang;
              openingDiv += '\"';
            }
          }
          openingDiv += "><pre wrap>\n";
        }
        else
          openingDiv = "<pre wrap>\n";

      /* text/plain objects always have separators before and after them.
       Note that this is not the case for text/enriched objects. */
      status = MimeObject_write_separator(obj);
      if (status < 0) return status;

      status = MimeObject_write(obj, openingDiv.get(), openingDiv.Length(), true);
      if (status < 0) return status;
    }
  }

  return 0;
}

static int
MimeInlineTextPlain_parse_eof (MimeObject *obj, bool abort_p)
{
  int status;

  // Has this method already been called for this object?
  // In that case return.
  if (obj->closed_p) return 0;

  nsCString citationColor;
  MimeInlineTextPlain *text = (MimeInlineTextPlain *) obj;
  if (text && text->mCitationColor)
    citationColor.Adopt(text->mCitationColor);

  bool quoting = ( obj->options
    && ( obj->options->format_out == nsMimeOutput::nsMimeMessageQuoting ||
         obj->options->format_out == nsMimeOutput::nsMimeMessageBodyQuoting
       )           );  // see above

  bool rawPlainText = obj->options &&
       (obj->options->format_out == nsMimeOutput::nsMimeMessageFilterSniffer
        || obj->options->format_out == nsMimeOutput::nsMimeMessageAttach);

  /* Run parent method first, to flush out any buffered data. */
  status = ((MimeObjectClass*)&MIME_SUPERCLASS)->parse_eof(obj, abort_p);
  if (status < 0) return status;

  if (!obj->output_p) return 0;

  if (obj->options &&
    obj->options->write_html_p &&
    obj->options->output_fn &&
    !abort_p && !rawPlainText)
  {
      MimeInlineTextPlain *text = (MimeInlineTextPlain *) obj;
      if (text->mIsSig && !quoting)
      {
        status = MimeObject_write(obj, "</div>", 6, false);  // .moz-txt-sig
        if (status < 0) return status;
      }
      status = MimeObject_write(obj, "</pre>", 6, false);
      if (status < 0) return status;
      if (!quoting)
      {
        status = MimeObject_write(obj, "</div>", 6, false);
                                        // .moz-text-plain
        if (status < 0) return status;
      }

      /* text/plain objects always have separators before and after them.
     Note that this is not the case for text/enriched objects.
     */
    status = MimeObject_write_separator(obj);
    if (status < 0) return status;
  }

  return 0;
}


static int
MimeInlineTextPlain_parse_line (const char *line, int32_t length, MimeObject *obj)
{
  int status;
  bool quoting = ( obj->options
    && ( obj->options->format_out == nsMimeOutput::nsMimeMessageQuoting ||
         obj->options->format_out == nsMimeOutput::nsMimeMessageBodyQuoting
       )           );  // see above
  bool plainHTML = quoting || (obj->options &&
       obj->options->format_out == nsMimeOutput::nsMimeMessageSaveAs);
       // see above

  bool rawPlainText = obj->options &&
       (obj->options->format_out == nsMimeOutput::nsMimeMessageFilterSniffer
       || obj->options->format_out == nsMimeOutput::nsMimeMessageAttach);

  // this routine gets called for every line of data that comes through the
  // mime converter. It's important to make sure we are efficient with
  // how we allocate memory in this routine. be careful if you go to add
  // more to this routine.

  NS_ASSERTION(length > 0, "zero length");
  if (length <= 0) return 0;

  mozITXTToHTMLConv *conv = GetTextConverter(obj->options);
  MimeInlineTextPlain *text = (MimeInlineTextPlain *) obj;

  bool skipConversion = !conv || rawPlainText ||
                          (obj->options && obj->options->force_user_charset);

  char *mailCharset = NULL;
  nsresult rv;

  if (!skipConversion)
  {
    nsDependentCString inputStr(line, length);
    nsAutoString lineSourceStr;

    // For 'SaveAs', |line| is in |mailCharset|.
    // convert |line| to UTF-16 before 'html'izing (calling ScanTXT())
    if (obj->options->format_out == nsMimeOutput::nsMimeMessageSaveAs)
    { // Get the mail charset of this message.
      MimeInlineText  *inlinetext = (MimeInlineText *) obj;
      if (!inlinetext->initializeCharset)
         ((MimeInlineTextClass*)&mimeInlineTextClass)->initialize_charset(obj);
      mailCharset = inlinetext->charset;
      if (mailCharset && *mailCharset) {
        rv = nsMsgI18NConvertToUnicode(mailCharset, inputStr, lineSourceStr);
        NS_ENSURE_SUCCESS(rv, -1);
      }
      else // this probably never happens ...
        CopyUTF8toUTF16(inputStr, lineSourceStr);
    }
    else  // line is in UTF-8
      CopyUTF8toUTF16(inputStr, lineSourceStr);

    nsAutoCString prefaceResultStr;  // Quoting stuff before the real text

    // Recognize quotes
    uint32_t oldCiteLevel = text->mCiteLevel;
    uint32_t logicalLineStart = 0;
    rv = conv->CiteLevelTXT(lineSourceStr.get(),
                            &logicalLineStart, &(text->mCiteLevel));
    NS_ENSURE_SUCCESS(rv, -1);

    // Find out, which recognitions to do
    uint32_t whattodo = obj->options->whattodo;
    if (plainHTML)
    {
      if (quoting)
        whattodo = 0;  // This is done on Send. Don't do it twice.
      else
        whattodo = whattodo & ~mozITXTToHTMLConv::kGlyphSubstitution;
                   /* Do recognition for the case, the result is viewed in
                      Mozilla, but not GlyphSubstitution, because other UAs
                      might not be able to display the glyphs. */
      if (!text->mBlockquoting)
        text->mCiteLevel = 0;
    }

    // Write blockquote
    if (text->mCiteLevel > oldCiteLevel)
    {
      prefaceResultStr += "</pre>";
      for (uint32_t i = 0; i < text->mCiteLevel - oldCiteLevel; i++)
      {
        nsAutoCString style;
        MimeTextBuildPrefixCSS(text->mQuotedSizeSetting, text->mQuotedStyleSetting,
                               text->mCitationColor, style);
        if (!plainHTML && !style.IsEmpty())
        {
          prefaceResultStr += "<blockquote type=cite style=\"";
          prefaceResultStr += style;
          prefaceResultStr += "\">";
        }
        else
          prefaceResultStr += "<blockquote type=cite>";
      }
      prefaceResultStr += "<pre wrap>\n";
    }
    else if (text->mCiteLevel < oldCiteLevel)
    {
      prefaceResultStr += "</pre>";
      for (uint32_t i = 0; i < oldCiteLevel - text->mCiteLevel; i++)
        prefaceResultStr += "</blockquote>";
      prefaceResultStr += "<pre wrap>\n";
    }

    // Write plain text quoting tags
    if (logicalLineStart != 0 && !(plainHTML && text->mBlockquoting))
    {
      if (!plainHTML)
        prefaceResultStr += "<span class=\"moz-txt-citetags\">";

      nsString citeTagsSource(StringHead(lineSourceStr, logicalLineStart));

      // Convert to HTML
      nsString citeTagsResultUnichar;
      rv = conv->ScanTXT(citeTagsSource.get(), 0 /* no recognition */,
                         getter_Copies(citeTagsResultUnichar));
      if (NS_FAILED(rv)) return -1;

      prefaceResultStr.Append(NS_ConvertUTF16toUTF8(citeTagsResultUnichar));
      if (!plainHTML)
        prefaceResultStr += "</span>";
    }


    // recognize signature
    if ((lineSourceStr.Length() >= 4)
        && lineSourceStr.First() == '-'
        && Substring(lineSourceStr, 0, 3).EqualsLiteral("-- ")
        && (lineSourceStr[3] == '\r' || lineSourceStr[3] == '\n') )
    {
      text->mIsSig = true;
      if (!quoting)
        prefaceResultStr += "<div class=\"moz-txt-sig\">";
    }


    /* This is the main TXT to HTML conversion:
       escaping (very important), eventually recognizing etc. */
    nsString lineResultUnichar;

    rv = conv->ScanTXT(lineSourceStr.get() + logicalLineStart,
                       whattodo, getter_Copies(lineResultUnichar));
    NS_ENSURE_SUCCESS(rv, -1);

    if (!(text->mIsSig && quoting))
    {
      status = MimeObject_write(obj, prefaceResultStr.get(), prefaceResultStr.Length(), true);
      if (status < 0) return status;
      nsAutoCString outString;
      if (obj->options->format_out != nsMimeOutput::nsMimeMessageSaveAs ||
          !mailCharset || !*mailCharset)
        CopyUTF16toUTF8(lineResultUnichar, outString);
      else
      { // convert back to mailCharset before writing.
        rv = nsMsgI18NConvertFromUnicode(mailCharset,
                                         lineResultUnichar, outString);
        NS_ENSURE_SUCCESS(rv, -1);
      }

      status = MimeObject_write(obj, outString.get(), outString.Length(), true);
    }
    else
    {
      status = NS_OK;
    }
  }
  else
  {
    status = MimeObject_write(obj, line, length, true);
  }

  return status;
}

