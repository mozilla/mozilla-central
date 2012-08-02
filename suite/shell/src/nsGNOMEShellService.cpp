/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsCOMPtr.h"
#include "nsComponentManagerUtils.h"
#include "nsDirectoryServiceDefs.h"
#include "nsDirectoryServiceUtils.h"
#include "nsGNOMEShellService.h"
#include "nsServiceManagerUtils.h"
#include "nsIGSettingsService.h"
#include "nsIGConfService.h"
#include "nsIGnomeVFSService.h"
#include "nsIStringBundle.h"
#include "nsIImageLoadingContent.h"
#include "nsIDOMElement.h"
#include "imgIRequest.h"
#include "imgIContainer.h"
#include "nsIImageToPixbuf.h"
#include "nsIFile.h"
#include "nsIProcess.h"
#include "prenv.h"
#include <glib.h>
#include <glib-object.h>
#include <gtk/gtk.h>
#include <gdk/gdk.h>
#include <gdk-pixbuf/gdk-pixbuf.h>

// GConf registry key constants
#define DG_BACKGROUND "/desktop/gnome/background"

#define DGB_OPTIONS DG_BACKGROUND "/picture_options"
#define DGB_IMAGE DG_BACKGROUND "/picture_filename"
#define DGB_DRAWBG DG_BACKGROUND "/draw_background"

#define OGDB_SCHEMA "org.gnome.desktop.background"
#define OGDB_OPTIONS "picture-options"
#define OGDB_IMAGE "picture-uri"
#define OGDB_DRAWBG "draw-background"

NS_IMPL_ISUPPORTS1(nsGNOMEShellService, nsIShellService)

nsresult
nsGNOMEShellService::Init()
{
  nsresult rv;

  // Check G_BROKEN_FILENAMES.  If it's set, then filenames in glib use
  // the locale encoding.  If it's not set, they use UTF-8.
  mUseLocaleFilenames = PR_GetEnv("G_BROKEN_FILENAMES") != nullptr;

  nsCOMPtr<nsIFile> appPath;
  rv = NS_GetSpecialDirectory(NS_XPCOM_CURRENT_PROCESS_DIR,
                              getter_AddRefs(appPath));
  NS_ENSURE_SUCCESS(rv, rv);

  rv = appPath->AppendNative(NS_LITERAL_CSTRING(MOZ_APP_NAME));
  NS_ENSURE_SUCCESS(rv, rv);

  return appPath->GetNativePath(mAppPath);
}

NS_IMETHODIMP
nsGNOMEShellService::IsDefaultClient(bool aStartupCheck, PRUint16 aApps,
                                     bool* aIsDefaultClient)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsGNOMEShellService::SetDefaultClient(bool aForAllUsers,
                                      bool aClaimAllTypes, PRUint16 aApps)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsGNOMEShellService::GetShouldCheckDefaultClient(bool* aResult)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsGNOMEShellService::SetShouldCheckDefaultClient(bool aShouldCheck)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsGNOMEShellService::GetShouldBeDefaultClientFor(PRUint16* aApps)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsGNOMEShellService::SetShouldBeDefaultClientFor(PRUint16 aApps)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsGNOMEShellService::GetCanSetDesktopBackground(bool* aResult)
{
  nsCOMPtr<nsIGConfService> gconf(do_GetService(NS_GCONFSERVICE_CONTRACTID));
  *aResult = gconf && getenv("GNOME_DESKTOP_SESSION_ID");
  return NS_OK;
}

NS_IMETHODIMP
nsGNOMEShellService::SetDesktopBackground(nsIDOMElement* aElement, 
                                          PRInt32 aPosition)
{
  // get the product brand name from localized strings
  nsresult rv;
  nsString brandName;
  nsCOMPtr<nsIStringBundleService> bundleService(do_GetService("@mozilla.org/intl/stringbundle;1", &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIStringBundle> brandBundle;
  rv = bundleService->CreateBundle(BRAND_PROPERTIES, getter_AddRefs(brandBundle));
  NS_ENSURE_TRUE(brandBundle, rv);

  rv = brandBundle->GetStringFromName(NS_LITERAL_STRING("brandShortName").get(),
                                      getter_Copies(brandName));
  NS_ENSURE_SUCCESS(rv, rv);

  // build the file name
  nsCAutoString filePath(PR_GetEnv("HOME"));
  filePath.Append('/');
  filePath.Append(NS_ConvertUTF16toUTF8(brandName));
  filePath.AppendLiteral("_wallpaper.png");

  // get the image container
  nsCOMPtr<nsIImageLoadingContent> imageContent(do_QueryInterface(aElement, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<imgIRequest> request;
  rv = imageContent->GetRequest(nsIImageLoadingContent::CURRENT_REQUEST,
                                getter_AddRefs(request));
  NS_ENSURE_TRUE(request, rv);

  nsCOMPtr<imgIContainer> container;
  rv = request->GetImage(getter_AddRefs(container));
  NS_ENSURE_TRUE(request, rv);

  nsCOMPtr<nsIImageToPixbuf> imgToPixbuf(do_GetService("@mozilla.org/widget/image-to-gdk-pixbuf;1"));
  if (!imgToPixbuf)
    return NS_ERROR_NOT_AVAILABLE;

  GdkPixbuf* pixbuf = imgToPixbuf->ConvertImageToPixbuf(container);
  if (!pixbuf)
    return NS_ERROR_NOT_AVAILABLE;

  // write the image to a file in the home dir
  gboolean res = gdk_pixbuf_save(pixbuf, filePath.get(), "png", NULL, NULL);

  g_object_unref(pixbuf);
  if (!res)
    return NS_ERROR_FAILURE;

  // set desktop wallpaper filling style
  const char* options;
  switch (aPosition) {
    case BACKGROUND_TILE:
      options = "wallpaper";
      break;
    case BACKGROUND_STRETCH:
      options = "stretched";
      break;
    case BACKGROUND_FILL:
      options = "zoom";
      break;
    case BACKGROUND_FIT:
      options = "scaled";
      break;
    default:
      options = "centered";
      break;
  }

  // Try GSettings first. If we don't have GSettings or the right schema, fall back
  // to using GConf instead. Note that if GSettings works ok, the changes get
  // mirrored to GConf by the gsettings->gconf bridge in gnome-settings-daemon
  nsCOMPtr<nsIGSettingsService> gsettings(do_GetService(NS_GSETTINGSSERVICE_CONTRACTID));
  if (gsettings) {
    nsCOMPtr<nsIGSettingsCollection> background_settings;
    gsettings->GetCollectionForSchema(NS_LITERAL_CSTRING(OGDB_SCHEMA),
                                      getter_AddRefs(background_settings));
    if (background_settings) {
      gchar *file_uri = g_filename_to_uri(filePath.get(), NULL, NULL);
      if (!file_uri)
       return NS_ERROR_FAILURE;

      background_settings->SetString(NS_LITERAL_CSTRING(OGDB_OPTIONS),
                                     nsDependentCString(options));
      background_settings->SetString(NS_LITERAL_CSTRING(OGDB_IMAGE),
                                     nsDependentCString(file_uri));
      g_free(file_uri);
      background_settings->SetBoolean(NS_LITERAL_CSTRING(OGDB_DRAWBG), true);
      return NS_OK;
    }
  }

  // if the file was written successfully, set it as the system wallpaper
  nsCOMPtr<nsIGConfService> gconf(do_GetService(NS_GCONFSERVICE_CONTRACTID));

  if (gconf) {
    gconf->SetString(NS_LITERAL_CSTRING(DGB_OPTIONS), nsDependentCString(options));

    // Set the image to an empty string first to force a refresh (since we could
    // be writing a new image on top of an existing SeaMonkey_wallpaper.png
    // and nautilus doesn't monitor the file for changes).
    gconf->SetString(NS_LITERAL_CSTRING(DGB_IMAGE), EmptyCString());
    gconf->SetString(NS_LITERAL_CSTRING(DGB_IMAGE), filePath);
    gconf->SetBool(NS_LITERAL_CSTRING(DGB_DRAWBG), true);
  }

  return NS_OK;
}

NS_IMETHODIMP
nsGNOMEShellService::GetDesktopBackgroundColor(PRUint32 *aColor)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsGNOMEShellService::SetDesktopBackgroundColor(PRUint32 aColor)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsGNOMEShellService::OpenApplicationWithURI(nsIFile* aApplication, const nsACString& aURI)
{
  nsresult rv;
  nsCOMPtr<nsIProcess> process = 
    do_CreateInstance("@mozilla.org/process/util;1", &rv);
  if (NS_FAILED(rv))
    return rv;
  
  rv = process->Init(aApplication);
  if (NS_FAILED(rv))
    return rv;

  const nsCString& spec = PromiseFlatCString(aURI);
  const char* specStr = spec.get();
  return process->Run(false, &specStr, 1);
}

NS_IMETHODIMP
nsGNOMEShellService::GetDefaultFeedReader(nsIFile** _retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}
