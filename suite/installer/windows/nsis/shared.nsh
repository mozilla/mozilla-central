# ***** BEGIN LICENSE BLOCK *****
# Version: MPL 1.1/GPL 2.0/LGPL 2.1
#
# The contents of this file are subject to the Mozilla Public License Version
# 1.1 (the "License"); you may not use this file except in compliance with
# the License. You may obtain a copy of the License at
# http://www.mozilla.org/MPL/
#
# Software distributed under the License is distributed on an "AS IS" basis,
# WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
# for the specific language governing rights and limitations under the
# License.
#
# The Original Code is the Mozilla Installer code.
#
# The Initial Developer of the Original Code is Mozilla Foundation
# Portions created by the Initial Developer are Copyright (C) 2006
# the Initial Developer. All Rights Reserved.
#
# Contributor(s):
#  Robert Strong <robert.bugzilla@gmail.com>
#  Scott MacGregor <mscott@mozilla.org>
#
# Alternatively, the contents of this file may be used under the terms of
# either the GNU General Public License Version 2 or later (the "GPL"), or
# the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
# in which case the provisions of the GPL or the LGPL are applicable instead
# of those above. If you wish to allow use of your version of this file only
# under the terms of either the GPL or the LGPL, and not to allow others to
# use your version of this file under the terms of the MPL, indicate your
# decision by deleting the provisions above and replace them with the notice
# and other provisions required by the GPL or the LGPL. If you do not delete
# the provisions above, a recipient may use your version of this file under
# the terms of any one of the MPL, the GPL or the LGPL.
#
# ***** END LICENSE BLOCK *****

!macro PostUpdate
  SetShellVarContext all
  ${SetStartMenuInternet}
  ${SetClientsMail}

  ; Remove registry entries for non-existent apps and for apps that point to our
  ; install location in the Software\Mozilla key and uninstall registry entries
  ; that point to our install location for both HKCU and HKLM.
  SetShellVarContext current  ; Set SHCTX to HKCU
  ${RegCleanMain} "Software\Mozilla"
  ${RegCleanUninstall}

  SetShellVarContext all  ; Set SHCTX to HKLM
  ${RegCleanMain} "Software\Mozilla"
  ${RegCleanUninstall}

  ; Add Software\Mozilla\ registry entries
  ${SetAppKeys}

  ${SetUninstallKeys}

  ${FixClassKeys}
!macroend
!define PostUpdate "!insertmacro PostUpdate"

!macro SetAsDefaultAppUser
  SetShellVarContext current
  ${SetHandlers}
!macroend
!define SetAsDefaultAppUser "!insertmacro SetAsDefaultAppUser"

!macro SetAsDefaultAppGlobal
  SetShellVarContext all
  ${SetHandlers}
  ${SetStartMenuInternet}
  WriteRegStr HKLM "Software\Clients\StartMenuInternet" "" "$R9"
  ${SetClientsMail}
  WriteRegStr HKLM "Software\Clients\Mail" "" "${BrandFullNameInternal}"
  ${ShowShortcuts}
!macroend
!define SetAsDefaultAppGlobal "!insertmacro SetAsDefaultAppGlobal"

!macro HideShortcuts
  StrCpy $R1 "Software\Clients\Mail\${BrandFullNameInternal}\InstallInfo"
  WriteRegDWORD HKLM $R1 "IconsVisible" 0
  SetShellVarContext all  ; Set $DESKTOP to All Users
  ${Unless} ${FileExists} "$DESKTOP\${BrandFullName}.lnk"
    SetShellVarContext current  ; Set $DESKTOP to the current user's desktop
  ${EndUnless}

  ${If} ${FileExists} "$DESKTOP\${BrandFullName}.lnk"
    ShellLink::GetShortCutArgs "$DESKTOP\${BrandFullName}.lnk"
    Pop $0
    ${If} $0 == ""
      ShellLink::GetShortCutTarget "$DESKTOP\${BrandFullName}.lnk"
      Pop $0
      ; Needs to handle short paths
      ${If} $0 == "$INSTDIR\${FileMainEXE}"
        Delete "$DESKTOP\${BrandFullName}.lnk"
      ${EndIf}
    ${EndIf}
  ${EndIf}

  ${If} ${FileExists} "$QUICKLAUNCH\${BrandFullName}.lnk"
    ShellLink::GetShortCutArgs "$QUICKLAUNCH\${BrandFullName}.lnk"
    Pop $0
    ${If} $0 == ""
      ShellLink::GetShortCutTarget "$QUICKLAUNCH\${BrandFullName}.lnk"
      Pop $0
      ; Needs to handle short paths
      ${If} $0 == "$INSTDIR\${FileMainEXE}"
        Delete "$QUICKLAUNCH\${BrandFullName}.lnk"
      ${EndIf}
    ${EndIf}
  ${EndIf}
!macroend
!define HideShortcuts "!insertmacro HideShortcuts"

!macro ShowShortcuts
  StrCpy $R1 "Software\Clients\Mail\${BrandFullNameInternal}\InstallInfo"
  WriteRegDWORD HKLM $R1 "IconsVisible" 1
  SetShellVarContext all  ; Set $DESKTOP to All Users
  ${Unless} ${FileExists} "$DESKTOP\${BrandFullName}.lnk"
    CreateShortCut "$DESKTOP\${BrandFullName}.lnk" "$INSTDIR\${FileMainEXE}" "" "$INSTDIR\${FileMainEXE}" 0
    ShellLink::SetShortCutWorkingDirectory "$DESKTOP\${BrandFullName}.lnk" "$INSTDIR"
    ${Unless} ${FileExists} "$DESKTOP\${BrandFullName}.lnk"
      SetShellVarContext current  ; Set $DESKTOP to the current user's desktop
      ${Unless} ${FileExists} "$DESKTOP\${BrandFullName}.lnk"
        CreateShortCut "$DESKTOP\${BrandFullName}.lnk" "$INSTDIR\${FileMainEXE}" "" "$INSTDIR\${FileMainEXE}" 0
        ShellLink::SetShortCutWorkingDirectory "$DESKTOP\${BrandFullName}.lnk" "$INSTDIR"
      ${EndUnless}
    ${EndUnless}
  ${EndUnless}
  ${Unless} ${FileExists} "$QUICKLAUNCH\${BrandFullName}.lnk"
    CreateShortCut "$QUICKLAUNCH\${BrandFullName}.lnk" "$INSTDIR\${FileMainEXE}" "" "$INSTDIR\${FileMainEXE}" 0
    ShellLink::SetShortCutWorkingDirectory "$QUICKLAUNCH\${BrandFullName}.lnk" "$INSTDIR"
  ${EndUnless}
!macroend
!define ShowShortcuts "!insertmacro ShowShortcuts"

!macro SetHandlers
  GetFullPathName $8 "$INSTDIR\${FileMainEXE}"

  StrCpy $0 "SOFTWARE\Classes"
  StrCpy $2 "$\"$8$\" -url $\"%1$\" -requestPending"
  StrCpy $2 "$\"$8$\" -mail $\"%1$\""
  StrCpy $3 "$\"$8$\" -compose $\"%1$\""

  ; BROWSER part
  ; Associate the file handlers with SeaMonkeyHTML
  WriteRegStr SHCTX "$0\.htm"   "" "SeaMonkeyHTML"
  WriteRegStr SHCTX "$0\.html"  "" "SeaMonkeyHTML"
  WriteRegStr SHCTX "$0\.shtml" "" "SeaMonkeyHTML"
  WriteRegStr SHCTX "$0\.xht"   "" "SeaMonkeyHTML"
  WriteRegStr SHCTX "$0\.xhtml" "" "SeaMonkeyHTML"

  ; An empty string is used for the 5th param because SeaMonkeyHTML is not a
  ; protocol handler
  ${AddHandlerValues} "$0\SeaMonkeyHTML" "$2" "$INSTDIR\chrome\icons\default\html-file.ico" "${AppRegName} Document" "" "true"

  ${AddHandlerValues} "$0\SeaMonkeyURL" "$2" "$8,0" "${AppRegName} URL" "true" "true"
  ${AddHandlerValues} "$0\gopher" "$2" "$8,0" "URL:Gopher Protocol" "true" "true"

  ; An empty string is used for the 4th & 5th params because the following
  ; protocol handlers already have a display name and additional keys required
  ; for a protocol handler.
  ${AddHandlerValues} "$0\ftp" "$2" "$8,0" "" "" "true"
  ${AddHandlerValues} "$0\http" "$2" "$8,0" "" "" "true"
  ${AddHandlerValues} "$0\https" "$2" "$8,0" "" "" "true"

  ; MAIL/NEWS part
  ; Associate the .eml file handler with SeaMonkeyEML
  WriteRegStr SHCTX "$0\.eml"   "" "SeaMonkeyEML"

  ; An empty string is used for the 5th param because SeaMonkeyEML is not a
  ; protocol handler
  ${AddHandlerValues} "$0\SeaMonkeyEML"  "$2" "$INSTDIR\chrome\icons\default\misc-file.ico" "${AppRegNameMail} Document" "" ""

  ${AddHandlerValues} "$0\SeaMonkeyCOMPOSE"  "$3" "$8,0" "${AppRegNameMail} URL" "true" ""
  ${AddHandlerValues} "$0\SeaMonkeyNEWS" "$2" "$8,0" "${AppRegNameNews} URL" "true" ""

  ; An empty string is used for the 4th & 5th params because the following
  ; protocol handlers already have a display name and additional keys required
  ; for a protocol handler.
  ${AddHandlerValues} "$0\mailto" "$3" "$8,0" "${AppRegNameMail} URL" "true" ""
  ${AddHandlerValues} "$0\news"   "$2" "$8,0" "${AppRegNameNews} URL" "true" ""
  ${AddHandlerValues} "$0\nntp"   "$2" "$8,0" "${AppRegNameNews} URL" "true" ""
  ${AddHandlerValues} "$0\snews"  "$2" "$8,0" "${AppRegNameNews} URL" "true" ""
!macroend
!define SetHandlers "!insertmacro SetHandlers"
; XXXrstrong - there are several values that will be overwritten by and
; overwrite other installs of the same application.
!macro SetStartMenuInternet
  GetFullPathName $8 "$INSTDIR\${FileMainEXE}"
  GetFullPathName $7 "$INSTDIR\uninstall\helper.exe"

  ${StrFilter} "${FileMainEXE}" "+" "" "" $R9

  StrCpy $0 "Software\Clients\StartMenuInternet\$R9"
  WriteRegStr HKLM "$0" "" "${BrandFullName}"

  WriteRegStr HKLM "$0\DefaultIcon" "" "$8,0"

  ; The Reinstall Command is defined at
  ; http://msdn.microsoft.com/library/default.asp?url=/library/en-us/shellcc/platform/shell/programmersguide/shell_adv/registeringapps.asp
  WriteRegStr HKLM "$0\InstallInfo" "HideIconsCommand" "$\"$7$\" /HideShortcuts"
  WriteRegStr HKLM "$0\InstallInfo" "ShowIconsCommand" "$\"$7$\" /ShowShortcuts"
  WriteRegStr HKLM "$0\InstallInfo" "ReinstallCommand" "$\"$7$\" /SetAsDefaultAppGlobal"

  WriteRegStr HKLM "$0\shell\open\command" "" "$8"

  WriteRegStr HKLM "$0\shell\properties" "" "$(CONTEXT_OPTIONS)"
  WriteRegStr HKLM "$0\shell\properties\command" "" "$\"$8$\" -preferences"

  WriteRegStr HKLM "$0\shell\safemode" "" "$(CONTEXT_SAFE_MODE)"
  WriteRegStr HKLM "$0\shell\safemode\command" "" "$\"$8$\" -safe-mode"

  ; Vista Capabilities registry keys
  WriteRegStr HKLM "$0\Capabilities" "ApplicationDescription" "$(REG_APP_DESC)"
  WriteRegStr HKLM "$0\Capabilities" "ApplicationIcon" "$8,0"
  WriteRegStr HKLM "$0\Capabilities" "ApplicationName" "${BrandShortName}"

  WriteRegStr HKLM "$0\Capabilities\FileAssociations" ".htm"   "SeaMonkeyHTML" 
  WriteRegStr HKLM "$0\Capabilities\FileAssociations" ".html"  "SeaMonkeyHTML"
  WriteRegStr HKLM "$0\Capabilities\FileAssociations" ".shtml" "SeaMonkeyHTML"
  WriteRegStr HKLM "$0\Capabilities\FileAssociations" ".xht"   "SeaMonkeyHTML"
  WriteRegStr HKLM "$0\Capabilities\FileAssociations" ".xhtml" "SeaMonkeyHTML"

  WriteRegStr HKLM "$0\Capabilities\StartMenu" "StartMenuInternet" "$R9"

  WriteRegStr HKLM "$0\Capabilities\URLAssociations" "ftp"    "SeaMonkeyURL"
  WriteRegStr HKLM "$0\Capabilities\URLAssociations" "gopher" "SeaMonkeyURL"
  WriteRegStr HKLM "$0\Capabilities\URLAssociations" "http"   "SeaMonkeyURL"
  WriteRegStr HKLM "$0\Capabilities\URLAssociations" "https"  "SeaMonkeyURL"

  ; Vista Registered Application
  WriteRegStr HKLM "Software\RegisteredApplications" "${AppRegName}" "$0\Capabilities"

  ; The IconHandler reference for SeaMonkeyHTML can end up in an inconsistent
  ; state due to changes not being detected by the IconHandler for side by side
  ; installs. The symptoms can be either an incorrect icon or no icon being
  ; displayed for files associated with Firefox. By setting it here it will
  ; always reference the install referenced in the
  ; HKLM\Software\Classes\SeaMonkeyHTML registry key.
  ClearErrors
  ReadRegStr $2 HKLM "Software\Classes\SeaMonkeyHTML\ShellEx\IconHandler" ""
  ${Unless} ${Errors}
    ClearErrors
    ReadRegStr $3 HKLM "Software\Classes\CLSID\$2\Old Icon\SeaMonkeyHTML\DefaultIcon" ""
    ${Unless} ${Errors}
      WriteRegStr HKLM "Software\Classes\CLSID\$2\Old Icon\SeaMonkeyHTML\DefaultIcon" "" "$8,1"
    ${EndUnless}
  ${EndUnless}
!macroend
!define SetStartMenuInternet "!insertmacro SetStartMenuInternet"

; XXXrstrong - there are several values that will be overwritten by and
; overwrite other installs of the same application.
!macro SetClientsMail
  GetFullPathName $8 "$INSTDIR\${FileMainEXE}"
  GetFullPathName $7 "$INSTDIR\uninstall\helper.exe"
  GetFullPathName $6 "$INSTDIR\mozMapi32.dll"

  StrCpy $0 "Software\Clients\Mail\${BrandFullNameInternal}"
  WriteRegStr HKLM "$0" "" "${BrandFullNameInternal}"
  WriteRegStr HKLM "$0\DefaultIcon" "" "$8,0"
  WriteRegStr HKLM "$0" "DLLPath" "$6"

  ; MapiProxy.dll can be used by multiple applications but
  ; is only registered for the last application installed. When the last
  ; application installed is uninstalled MapiProxy.dll will no longer be
  ; registered.
  !ifndef NO_LOG
    ${LogHeader} "DLL Registration"
  !endif
  ClearErrors
  RegDLL "$INSTDIR\MapiProxy.dll"
  !ifndef NO_LOG
    ${If} ${Errors}
      ${LogMsg} "** ERROR Registering: $INSTDIR\MapiProxy.dll **"
    ${Else}
      ${LogUninstall} "DLLReg: \MapiProxy.dll"
      ${LogMsg} "Registered: $INSTDIR\MapiProxy.dll"
    ${EndIf}
  !endif

  StrCpy $1 "Software\Classes\CLSID\{29F458BE-8866-11D5-A3DD-00B0D0F3BAA7}"
  WriteRegStr HKLM "$1\LocalServer32" "" "$\"$8$\" /MAPIStartup"
  WriteRegStr HKLM "$1\ProgID" "" "MozillaMapi.1"
  WriteRegStr HKLM "$1\VersionIndependentProgID" "" "MozillaMAPI"
  StrCpy $1 "SOFTWARE\Classes"
  WriteRegStr HKLM "$1\MozillaMapi" "" "Mozilla MAPI"
  WriteRegStr HKLM "$1\MozillaMapi\CLSID" "" "{29F458BE-8866-11D5-A3DD-00B0D0F3BAA7}"
  WriteRegStr HKLM "$1\MozillaMapi\CurVer" "" "MozillaMapi.1"
  WriteRegStr HKLM "$1\MozillaMapi.1" "" "Mozilla MAPI"
  WriteRegStr HKLM "$1\MozillaMapi.1\CLSID" "" "{29F458BE-8866-11D5-A3DD-00B0D0F3BAA7}"

  ; The Reinstall Command is defined at
  ; http://msdn.microsoft.com/library/default.asp?url=/library/en-us/shellcc/platform/shell/programmersguide/shell_adv/registeringapps.asp
  WriteRegStr HKLM "$0\InstallInfo" "HideIconsCommand" "$\"$7$\" /HideShortcuts"
  WriteRegStr HKLM "$0\InstallInfo" "ShowIconsCommand" "$\"$7$\" /ShowShortcuts"
  WriteRegStr HKLM "$0\InstallInfo" "ReinstallCommand" "$\"$7$\" /SetAsDefaultAppGlobal"

  ; Mail shell/open/command
  WriteRegStr HKLM "$0\shell\open\command" "" "$\"$8$\" -mail"

  ; options
  WriteRegStr HKLM "$0\shell\properties" "" "$(CONTEXT_OPTIONS)"
  WriteRegStr HKLM "$0\shell\properties\command" "" "$\"$8$\" -options"

  ; safemode
  WriteRegStr HKLM "$0\shell\safemode" "" "$(CONTEXT_SAFE_MODE)"
  WriteRegStr HKLM "$0\shell\safemode\command" "" "$\"$8$\" -safe-mode"

  ; Protocols
  StrCpy $1 "$\"$8$\" -compose $\"%1$\""
  ${AddHandlerValues} "$0\Protocols\mailto" "$1" "$8,0" "${AppRegNameMail} URL" "true" ""
 
  ; Vista Capabilities registry keys
  WriteRegStr HKLM "$0\Capabilities" "ApplicationDescription" "$(REG_APP_DESC)"
  WriteRegStr HKLM "$0\Capabilities" "ApplicationIcon" "$8,0"
  WriteRegStr HKLM "$0\Capabilities" "ApplicationName" "${AppRegNameMail}"
  WriteRegStr HKLM "$0\Capabilities\FileAssociations" ".eml"   "SeaMonkeyEML"
  WriteRegStr HKLM "$0\Capabilities\StartMenu" "Mail" "${BrandFullNameInternal}"
  WriteRegStr HKLM "$0\Capabilities\URLAssociations" "mailto" "SeaMonkeyCOMPOSE"

  ; Vista Registered Application
  WriteRegStr HKLM "Software\RegisteredApplications" "${AppRegNameMail}" "$0\Capabilities"

  ;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
  ; News
  ;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
  StrCpy $0 "Software\Clients\News\${BrandFullNameInternal}"
  WriteRegStr HKLM "$0" "" "${BrandFullNameInternal}"
  WriteRegStr HKLM "$0\DefaultIcon" "" "$8,0"
  WriteRegStr HKLM "$0" "DLLPath" "$6"

  ; Mail shell/open/command
  WriteRegStr HKLM "$0\shell\open\command" "" "$\"$8$\" -mail"

  ; Vista Capabilities registry keys
  WriteRegStr HKLM "$0\Capabilities" "ApplicationDescription" "$(REG_APP_DESC)"
  WriteRegStr HKLM "$0\Capabilities" "ApplicationIcon" "$8,0"
  WriteRegStr HKLM "$0\Capabilities" "ApplicationName" "${AppRegNameNews}"
  WriteRegStr HKLM "$0\Capabilities\URLAssociations" "nntp" "SeaMonkeyNEWS"
  WriteRegStr HKLM "$0\Capabilities\URLAssociations" "news" "SeaMonkeyNEWS"
  WriteRegStr HKLM "$0\Capabilities\URLAssociations" "snews" "SeaMonkeyNEWS"

  ; Protocols
  StrCpy $1 "$\"$8$\" -mail $\"%1$\""
  ${AddHandlerValues} "$0\Protocols\nntp" "$1" "$8,0" "${AppRegNameNews} URL" "true" ""
  ${AddHandlerValues} "$0\Protocols\news" "$1" "$8,0" "${AppRegNameNews} URL" "true" ""
  ${AddHandlerValues} "$0\Protocols\snews" "$1" "$8,0" "${AppRegNameNews} URL" "true" ""

  ; Vista Registered Application
  WriteRegStr HKLM "Software\RegisteredApplications" "${AppRegNameNews}" "$0\Capabilities"
!macroend
!define SetClientsMail "!insertmacro SetClientsMail"

!macro SetAppKeys
  StrCpy $0 "Software\Mozilla\${BrandFullNameInternal}\${AppVersion} (${AB_CD})\Main"
  ${WriteRegStr2} $TmpVal "$0" "Install Directory" "$INSTDIR" 0
  ${WriteRegStr2} $TmpVal "$0" "PathToExe" "$INSTDIR\${FileMainEXE}" 0
  ${WriteRegStr2} $TmpVal "$0" "Program Folder Path" "$SMPROGRAMS\$StartMenuDir" 0

  SetShellVarContext all  ; Set $DESKTOP to All Users
  ${Unless} ${FileExists} "$DESKTOP\${BrandFullName}.lnk"
    SetShellVarContext current  ; Set $DESKTOP to the current user's desktop
  ${EndUnless}

  ${If} ${FileExists} "$DESKTOP\${BrandFullName}.lnk"
    ShellLink::GetShortCutArgs "$DESKTOP\${BrandFullName}.lnk"
    Pop $1
    ${If} $1 == ""
      ShellLink::GetShortCutTarget "$DESKTOP\${BrandFullName}.lnk"
      Pop $1
      ; Needs to handle short paths
      ${If} $1 == "$INSTDIR\${FileMainEXE}"
        ${WriteRegDWORD2} $TmpVal "$0" "Create Desktop Shortcut" 1 0
      ${Else}
        ${WriteRegDWORD2} $TmpVal "$0" "Create Desktop Shortcut" 0 0
      ${EndIf}
    ${EndIf}
  ${EndIf}

  ; XXXrstrong - need a cleaner way to prevent unsetting SHCTX from HKLM when
  ; trying to find the desktop shortcut.
  ${If} $TmpVal == "HKCU"
    SetShellVarContext current
  ${Else}
    SetShellVarContext all
  ${EndIf}

  ${If} ${FileExists} "$QUICKLAUNCH\${BrandFullName}.lnk"
    ShellLink::GetShortCutArgs "$QUICKLAUNCH\${BrandFullName}.lnk"
    Pop $1
    ${If} $1 == ""
      ShellLink::GetShortCutTarget "$QUICKLAUNCH\${BrandFullName}.lnk"
      Pop $1
      ; Needs to handle short paths
      ${If} $1 == "$INSTDIR\${FileMainEXE}"
        ${WriteRegDWORD2} $TmpVal "$0" "Create Quick Launch Shortcut" 1 0
      ${Else}
        ${WriteRegDWORD2} $TmpVal "$0" "Create Quick Launch Shortcut" 0 0
      ${EndIf}
    ${EndIf}
  ${EndIf}
  ; XXXrstrong - "Create Start Menu Shortcut" and "Start Menu Folder" are only
  ; set in the installer and should also be set here for software update.

  StrCpy $0 "Software\Mozilla\${BrandFullNameInternal}\${AppVersion} (${AB_CD})\Uninstall"
  ${WriteRegStr2} $TmpVal "$0" "Uninstall Log Folder" "$INSTDIR\uninstall" 0
  ${WriteRegStr2} $TmpVal "$0" "Description" "${BrandFullNameInternal} (${AppVersion})" 0

  StrCpy $0 "Software\Mozilla\${BrandFullNameInternal}\${AppVersion} (${AB_CD})"
  ${WriteRegStr2} $TmpVal  "$0" "" "${AppVersion} (${AB_CD})" 0

  StrCpy $0 "Software\Mozilla\${BrandFullNameInternal} ${AppVersion}\bin"
  ${WriteRegStr2} $TmpVal "$0" "PathToExe" "$INSTDIR\${FileMainEXE}" 0

  StrCpy $0 "Software\Mozilla\${BrandFullNameInternal} ${AppVersion}\extensions"
  ${WriteRegStr2} $TmpVal "$0" "Components" "$INSTDIR\components" 0
  ${WriteRegStr2} $TmpVal "$0" "Plugins" "$INSTDIR\plugins" 0

  StrCpy $0 "Software\Mozilla\${BrandFullNameInternal} ${AppVersion}"
  ${WriteRegStr2} $TmpVal "$0" "GeckoVer" "${GREVersion}" 0

  StrCpy $0 "Software\Mozilla\${BrandFullNameInternal}"
  ${WriteRegStr2} $TmpVal "$0" "" "${GREVersion}" 0
  ${WriteRegStr2} $TmpVal "$0" "CurrentVersion" "${AppVersion} (${AB_CD})" 0
!macroend
!define SetAppKeys "!insertmacro SetAppKeys"

!macro SetUninstallKeys
  ; Write the uninstall registry keys
  StrCpy $0 "Software\Microsoft\Windows\CurrentVersion\Uninstall\${BrandFullNameInternal} (${AppVersion})"
  GetFullPathName $8 "$INSTDIR\${FileMainEXE}"
  GetFullPathName $7 "$INSTDIR\uninstall\helper.exe"

  ${WriteRegStr2} $TmpVal "$0" "Comments" "${BrandFullNameInternal}" 0
  ${WriteRegStr2} $TmpVal "$0" "DisplayIcon" "$8,0" 0
  ${WriteRegStr2} $TmpVal "$0" "DisplayName" "${BrandFullNameInternal} (${AppVersion})" 0
  ${WriteRegStr2} $TmpVal "$0" "DisplayVersion" "${AppVersion} (${AB_CD})" 0
  ${WriteRegStr2} $TmpVal "$0" "InstallLocation" "$INSTDIR" 0
  ${WriteRegStr2} $TmpVal "$0" "Publisher" "Mozilla" 0
  ${WriteRegStr2} $TmpVal "$0" "UninstallString" "$7" 0
  ${WriteRegStr2} $TmpVal "$0" "URLInfoAbout" "${URLInfoAbout}" 0
  ${WriteRegStr2} $TmpVal "$0" "URLUpdateInfo" "${URLUpdateInfo}" 0
  ${WriteRegDWORD2} $TmpVal "$0" "NoModify" 1 0
  ${WriteRegDWORD2} $TmpVal "$0" "NoRepair" 1 0
!macroend
!define SetUninstallKeys "!insertmacro SetUninstallKeys"

!macro FixClassKeys
  StrCpy $0 "SOFTWARE\Classes"

  ; BROWSER part
  ; File handler keys and name value pairs that may need to be created during
  ; install or upgrade.
  ReadRegStr $2 SHCTX "$0\.shtml" "Content Type"
  ${If} $2 == ""
    StrCpy $2 "$0\.shtml"
    ${WriteRegStr2} $TmpVal "$0\.shtml" "" "shtmlfile" 0
    ${WriteRegStr2} $TmpVal "$0\.shtml" "Content Type" "text/html" 0
    ${WriteRegStr2} $TmpVal "$0\.shtml" "PerceivedType" "text" 0
  ${EndIf}

  ReadRegStr $2 SHCTX "$0\.xht" "Content Type"
  ${If} $2 == ""
    ${WriteRegStr2} $TmpVal "$0\.xht" "" "xhtfile" 0
    ${WriteRegStr2} $TmpVal "$0\.xht" "Content Type" "application/xhtml+xml" 0
  ${EndIf}

  ReadRegStr $2 SHCTX "$0\.xhtml" "Content Type"
  ${If} $2 == ""
    ${WriteRegStr2} $TmpVal "$0\.xhtml" "" "xhtmlfile" 0
    ${WriteRegStr2} $TmpVal "$0\.xhtml" "Content Type" "application/xhtml+xml" 0
  ${EndIf}

  ; Protocol handler keys and name value pairs that may need to be updated during
  ; install or upgrade.

  ; Bug 301073 Comment #9 makes it so Firefox no longer supports launching
  ; chrome urls from the shell so remove it during install or update if the
  ; DefaultIcon is from firefox.exe.
  ReadRegStr $2 SHCTX "$0\chrome\DefaultIcon" ""

  ClearErrors
  ${WordFind} "$2" "${FileMainEXE}" "E+1{" $R1

  ${Unless} ${Errors}
    DeleteRegKey SHCTX "$0\chrome"
  ${EndUnless}

  ; Store the command to open the app with an url in a register for easy access.
  GetFullPathName $8 "$INSTDIR\${FileMainEXE}"
  StrCpy $1 "$\"$8$\" -url $\"%1$\" -requestPending"

  ; Always set the file and protocol handlers since they may specify a
  ; different path and the path is used by Vista when setting associations.
  ${AddHandlerValues} "$0\SeaMonkeyURL" "$1" "$8,0" "${AppRegName} URL" "true" "true"

  ; An empty string is used for the 5th param because SeaMonkeyHTML is not a
  ; protocol handler
  ${AddHandlerValues} "$0\SeaMonkeyHTML" "$1" "$8,1" "${AppRegName} Document" "" "true"

  ReadRegStr $2 SHCTX "$0\http\shell\open\command" ""
  ClearErrors
  ${WordFind} "$2" "${FileMainEXE}" "E+1{" $R1
  ${Unless} ${Errors}
    ${AddHandlerValues} "$0\http" "$1" "$8,0" "" "" "true"
  ${EndUnless}

  ReadRegStr $2 SHCTX "$0\https\shell\open\command" ""
  ClearErrors
  ${WordFind} "$2" "${FileMainEXE}" "E+1{" $R1
  ${Unless} ${Errors}
    ${AddHandlerValues} "$0\https" "$1" "$8,0" "" "" "true"
  ${EndUnless}

  ReadRegStr $2 SHCTX "$0\ftp\shell\open\command" ""
  ClearErrors
  ${WordFind} "$2" "${FileMainEXE}" "E+1{" $R1
  ${Unless} ${Errors}
    ${AddHandlerValues} "$0\ftp" "$1" "$8,0" "" "" "true"
  ${EndUnless}

  ; Only set the gopher key if it doesn't already exist with a default value
  ReadRegStr $2 SHCTX "$0\gopher" ""
  ${If} $2 == ""
    ${AddHandlerValues} "$0\gopher" "$1" "$8,0" "URL:Gopher Protocol" "true" "true"
  ${Else}
    ReadRegStr $2 SHCTX "$0\gopher\shell\open\command" ""
    ClearErrors
    ${WordFind} "$2" "${FileMainEXE}" "E+1{" $R1
    ${Unless} ${Errors}
      ${AddHandlerValues} "$0\gopher" "$1" "$8,0" "URL:Gopher Protocol" "true" "true"
    ${EndUnless}
  ${EndIf}


  ; MAIL/NEWS part
  GetFullPathName $8 "$INSTDIR\${FileMainEXE}"

  StrCpy $1 "$\"$8$\" -compose $\"%1$\""
  ${AddHandlerValues} "$0\SeaMonkeyCOMPOSE" "$1" "$8,0" "${AppRegNameMail} URL" "true" ""

  ReadRegStr $2 SHCTX "$0\mailto\shell\open\command" ""
  ${GetPathFromString} "$2" $3
  GetFullPathName $2 "$3"
  ClearErrors
  ${WordFind} "$2" "${FileMainEXE}" "E+1{" $R1
  ${Unless} ${Errors}
   ${AddHandlerValues} "$0\mailto" "$1" "$8,0" "" "" ""
  ${EndUnless}

  StrCpy $1 "$\"$8$\" $\"%1$\""
  ${AddHandlerValues} "$0\SeaMonkeyEML" "$1" "$8,0" "${AppRegNameMail} Document" "" ""

  StrCpy $1 "$\"$8$\" -mail $\"%1$\""
  ${AddHandlerValues} "$0\SeaMonkeyNEWS" "$1" "$8,0" "${AppRegNameNews} URL" "true" ""

  ReadRegStr $2 SHCTX "$0\news\shell\open\command" ""
  ${GetPathFromString} "$2" $3
  GetFullPathName $2 "$3"
  ClearErrors
  ${WordFind} "$2" "${FileMainEXE}" "E+1{" $R1
  ${Unless} ${Errors}
    ${AddHandlerValues} "$0\news" "$1" "$8,0" "" "" ""
  ${EndUnless}

  ReadRegStr $2 SHCTX "$0\snews\shell\open\command" ""
  ${GetPathFromString} "$2" $3
  GetFullPathName $2 "$3"
  ClearErrors
  ${WordFind} "$2" "${FileMainEXE}" "E+1{" $R1
  ${Unless} ${Errors}
    ${AddHandlerValues} "$0\snews" "$1" "$8,0" "" "" ""
  ${EndUnless}

  ReadRegStr $2 SHCTX "$0\nntp\shell\open\command" ""
  ${GetPathFromString} "$2" $3
  GetFullPathName $2 "$3"
  ClearErrors
  ${WordFind} "$2" "${FileMainEXE}" "E+1{" $R1
  ${Unless} ${Errors}
    ${AddHandlerValues} "$0\nntp" "$1" "$8,0" "" "" ""
  ${EndUnless}

  ; remove DI and SOC from the .eml class if it exists
  ReadRegStr $2 SHCTX "$0\.eml\shell\open\command" ""
  ${GetPathFromString} "$2" $3
  GetFullPathName $2 "$3"
  ClearErrors
  ${WordFind} "$2" "${FileMainEXE}" "E+1{" $R1
  ${Unless} ${Errors}
    DeleteRegKey HKLM "$0\.eml\shell\open\command"
  ${EndUnless}

  ReadRegStr $2 SHCTX "$0\.eml\DefaultIcon" ""
  ${GetPathFromString} "$2" $3
  GetFullPathName $2 "$3"
  ClearErrors
  ${WordFind} "$2" "${FileMainEXE}" "E+1{" $R1
  ${Unless} ${Errors}
    DeleteRegKey HKLM "$0\.eml\DefaultIcon"
  ${EndUnless}

!macroend
!define FixClassKeys "!insertmacro FixClassKeys"
