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
  ${CreateShortcutsLog}

  ; Remove registry entries for non-existent apps and for apps that point to our
  ; install location in the Software\Mozilla key and uninstall registry entries
  ; that point to our install location for both HKCU and HKLM.
  SetShellVarContext current  ; Set SHCTX to the current user (e.g. HKCU) 
  ${RegCleanMain} "Software\Mozilla"
  ${RegCleanUninstall}
  ${UpdateProtocolHandlers}

  ClearErrors
  WriteRegStr HKLM "Software\Mozilla" "${BrandShortName}InstallerTest" "Write Test"
  ${If} ${Errors}
    StrCpy $TmpVal "HKCU" ; used primarily for logging
  ${Else}
    DeleteRegValue HKLM "Software\Mozilla" "${BrandShortName}InstallerTest"
    SetShellVarContext all ; Set SHCTX to all users (e.g. HKLM)
    StrCpy $TmpVal "HKLM" ; used primarily for logging
    ${RegCleanMain} "Software\Mozilla"
    ${RegCleanUninstall}
    ${SetStartMenuInternet}
    ${FixShellIconHandler}
    ${SetUninstallKeys}
    ${UpdateProtocolHandlers}

    ReadRegStr $0 HKLM "Software\mozilla.org\Mozilla" "CurrentVersion"
    ${If} "$0" != "${GREVersion}"
      WriteRegStr HKLM "Software\mozilla.org\Mozilla" "CurrentVersion" "${GREVersion}"
    ${EndIf}

    ; Only update the Clients\Mail registry key values if they don't exist or
    ; this installation is the same as the one set in those keys.
    ReadRegStr $0 HKLM "Software\Clients\Mail\${BrandFullNameInternal}\DefaultIcon" ""
    ${GetPathFromString} "$0" $0
    ${GetParent} "$0" $0
    ${If} ${FileExists} "$0"
      ${GetLongPath} "$0" $0
    ${EndIf}
    ${If} "$0" == "$INSTDIR"
      ${SetClientsMail}
    ${EndIf}

    ; Only update the Clients\News registry key values if they don't exist or
    ; this installation is the same as the one set in those keys.
    ReadRegStr $0 HKLM "Software\Clients\News\${BrandFullNameInternal}\DefaultIcon" ""
    ${GetPathFromString} "$0" $0
    ${GetParent} "$0" $0
    ${If} ${FileExists} "$0"
      ${GetLongPath} "$0" $0
    ${EndIf}
    ${If} "$0" == "$INSTDIR"
      ${SetClientsNews}
    ${EndIf}
  ${EndIf}

  ; Add Software\Mozilla\ registry entries
  ${SetAppKeys}

  ${FixClassKeys}

  ; Remove files that may be left behind by the application in the
  ; VirtualStore directory.
  ${CleanVirtualStore}
!macroend
!define PostUpdate "!insertmacro PostUpdate"

!macro SetAsDefaultAppUser
  SetShellVarContext current

  ; It is only possible to set this installation of the application as the
  ; handler for the various types if those types were added to the respective
  ; HKLM\Clients registry keys.
  ; http://support.microsoft.com/kb/297878
  ${GetParameters} $R0

  ClearErrors
  ${GetOptions} "$R0" "Browser" $R1
  ${Unless} ${Errors}
    ${StrFilter} "${FileMainEXE}" "+" "" "" $R9
    ClearErrors
    ReadRegStr $0 HKLM "Software\Clients\StartMenuInternet\$R9\DefaultIcon" ""
    ${GetPathFromString} "$0" $0
    ${GetParent} "$0" $0
    ${If} ${FileExists} "$0"
      ${GetLongPath} "$0" $0
    ${EndIf}
    ${If} "$0" != "$INSTDIR"
      DeleteRegValue HKLM "Software\Mozilla" "${BrandShortName}InstallerTest"
      ClearErrors
      WriteRegStr HKLM "Software\Mozilla" "${BrandShortName}InstallerTest" "Write Test"
      ${If} ${Errors}
        ; Prevent multiple elevation requests
        ClearErrors
        ${GetOptions} "$R0" "/UAC:" $R1
        ${Unless} ${Errors}
          Quit
        ${EndUnless}
        ${ElevateUAC}
      ${EndIf}
      DeleteRegValue HKLM "Software\Mozilla" "${BrandShortName}InstallerTest"
      ${SetStartMenuInternet}
    ${EndIf}
    SetShellVarContext all  ; Set SHCTX to all users (e.g. HKLM)
    ${FixShellIconHandler}
    WriteRegStr HKCU "Software\Clients\StartMenuInternet" "" "$R9"

    ${If} ${AtLeastWinVista}
      ClearErrors
      ReadRegStr $0 HKLM "Software\RegisteredApplications" "${AppRegName}"
      ; Only register as the handler on Vista if the app registry name exists
      ; under the RegisteredApplications registry key.
      ${Unless} ${Errors}
        AppAssocReg::SetAppAsDefaultAll "${AppRegName}"
      ${EndUnless}
    ${EndIf}

    SetShellVarContext current  ; Set SHCTX to the current user (e.g. HKCU)
    ${SetHandlersBrowser}
  ${EndUnless} 

  ClearErrors
  ${GetOptions} "$R0" "Mail" $R1
  ${Unless} ${Errors}
    ReadRegStr $0 HKLM "Software\Clients\Mail\${BrandFullNameInternal}\DefaultIcon" ""
    ${GetPathFromString} "$0" $0
    ${GetParent} "$0" $0
    ${If} ${FileExists} "$0"
      ${GetLongPath} "$0" $0
    ${EndIf}
    ${If} "$0" != "$INSTDIR"
      DeleteRegValue HKLM "Software\Mozilla" "${BrandShortName}InstallerTest"
      ClearErrors
      WriteRegStr HKLM "Software\Mozilla" "${BrandShortName}InstallerTest" "Write Test"
      ${If} ${Errors}
        ; Prevent multiple elevation requests
        ClearErrors
        ${GetOptions} "$R0" "/UAC:" $R1
        ${Unless} ${Errors}
          Quit
        ${EndUnless}
        ${ElevateUAC}
      ${EndIf}
      DeleteRegValue HKLM "Software\Mozilla" "${BrandShortName}InstallerTest"
      SetShellVarContext all     ; Set SHCTX to all users (e.g. HKLM)
      ${SetClientsMail}
    ${EndIf}
    WriteRegStr HKCU "Software\Clients\Mail" "" "${BrandFullNameInternal}"
    GetFunctionAddress $0 SetAsDefaultMailAppUser
    UAC::ExecCodeSegment $0
  ${EndUnless}

  ClearErrors
  ${GetOptions} "$R0" "News" $R1
  ${Unless} ${Errors}
    ReadRegStr $0 HKLM "Software\Clients\News\${BrandFullNameInternal}\DefaultIcon" ""
    ${GetPathFromString} "$0" $0
    ${GetParent} "$0" $0
    ${If} ${FileExists} "$0"
      ${GetLongPath} "$0" $0
    ${EndIf}
    ${If} "$0" != "$INSTDIR"
      DeleteRegValue HKLM "Software\Mozilla" "${BrandShortName}InstallerTest"
      ClearErrors
      WriteRegStr HKLM "Software\Mozilla" "${BrandShortName}InstallerTest" "Write Test"
      ${If} ${Errors}
        ; Prevent multiple elevation requests
        ClearErrors
        ${GetOptions} "$R0" "/UAC:" $R1
        ${Unless} ${Errors}
          Quit
        ${EndUnless}
        ${ElevateUAC}
      ${EndIf}
      DeleteRegValue HKLM "Software\Mozilla" "${BrandShortName}InstallerTest"
      SetShellVarContext all     ; Set SHCTX to all users (e.g. HKLM)
      ${SetClientsNews}
    ${EndIf}
    WriteRegStr HKCU "Software\Clients\News" "" "${BrandFullNameInternal}"
    GetFunctionAddress $0 SetAsDefaultNewsAppUser
    UAC::ExecCodeSegment $0
  ${EndUnless}
!macroend
!define SetAsDefaultAppUser "!insertmacro SetAsDefaultAppUser"

!macro SetAsDefaultAppGlobal
  SetShellVarContext all      ; Set SHCTX to all users (e.g. HKLM)
  ${SetHandlersBrowser}
  ${SetHandlersMail}
  ${SetHandlersNews}
  ${SetStartMenuInternet}
  ${SetClientsMail}
  ${SetClientsNews}
  ${FixShellIconHandler}
  ${ShowShortcuts}
  ${StrFilter} "${FileMainEXE}" "+" "" "" $R9
  WriteRegStr HKLM "Software\Clients\StartMenuInternet" "" "$R9"
  WriteRegStr HKLM "Software\Clients\Mail" "" "${BrandFullNameInternal}"
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
    ${If} "$0" == ""
      ShellLink::GetShortCutTarget "$DESKTOP\${BrandFullName}.lnk"
      Pop $0
      ; Needs to handle short paths
      ${If} "$0" == "$INSTDIR\${FileMainEXE}"
        Delete "$DESKTOP\${BrandFullName}.lnk"
      ${EndIf}
    ${EndIf}
  ${EndIf}

  ${If} ${FileExists} "$QUICKLAUNCH\${BrandFullName}.lnk"
    ShellLink::GetShortCutArgs "$QUICKLAUNCH\${BrandFullName}.lnk"
    Pop $0
    ${If} "$0" == ""
      ShellLink::GetShortCutTarget "$QUICKLAUNCH\${BrandFullName}.lnk"
      Pop $0
      ; Needs to handle short paths
      ${If} "$0" == "$INSTDIR\${FileMainEXE}"
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

!macro SetHandlersBrowser
  ${GetLongPath} "$INSTDIR\${FileMainEXE}" $8

  StrCpy $0 "SOFTWARE\Classes"
  StrCpy $1 "$\"$8$\" -requestPending -osint -url $\"%1$\""
  StrCpy $2 "$\"$8$\" -url $\"%1$\""
  StrCpy $3 "$\"%1$\",,0,0,,,,"

  ; An empty string is used for the 5th param because SeaMonkeyHTML is not a
  ; protocol handler
  ${AddHandlerValues} "$0\SeaMonkeyHTML" "$2" \
                      "$INSTDIR\chrome\icons\default\html-file.ico" \
                      "${AppRegName} Document" "" ""
  ${AddDDEHandlerValues} "SeaMonkeyURL" "$1" "$8,0" "${AppRegName} URL" "true" \
                         "${DDEApplication}" "$3" "WWW_OpenURL"

  ; An empty string is used for the 4th & 5th params because the following
  ; protocol handlers already have a display name and additional keys required
  ; for a protocol handler.
  ${AddDDEHandlerValues} "ftp" "$1" "$8,0" "" "" "${DDEApplication}" "$3" "WWW_OpenURL"
  ${AddDDEHandlerValues} "http" "$1" "$8,0" "" "" "${DDEApplication}" "$3" "WWW_OpenURL"
  ${AddDDEHandlerValues} "https" "$1" "$8,0" "" "" "${DDEApplication}" "$3" "WWW_OpenURL"

  ${AddDDEHandlerValues} "gopher" "$1" "$8,0" "URL:Gopher Protocol" "true" \
                         "${DDEApplication}" "$3" "WWW_OpenURL"

  ReadRegStr $6 HKCR ".htm" ""
  ${If} "$6" != "SeaMonkeyHTML"
    WriteRegStr SHCTX "$0\.htm" "" "SeaMonkeyHTML"
  ${EndIf}

  ReadRegStr $6 HKCR ".html" ""
  ${If} "$6" != "SeaMonkeyHTML"
    WriteRegStr SHCTX "$0\.html" "" "SeaMonkeyHTML"
  ${EndIf}

  ReadRegStr $6 HKCR ".shtml" ""
  ${If} "$6" != "SeaMonkeyHTML"
    WriteRegStr SHCTX "$0\.shtml" "" "SeaMonkeyHTML"
  ${EndIf}

  ReadRegStr $6 HKCR ".xht" ""
  ${If} "$6" != "SeaMonkeyHTML"
     WriteRegStr SHCTX "$0\.xht" "" "SeaMonkeyHTML"
  ${EndIf}

  ReadRegStr $6 HKCR ".xhtml" ""
  ${If} "$6" != "SeaMonkeyHTML"
    WriteRegStr SHCTX "$0\.xhtml" "" "SeaMonkeyHTML"
  ${EndIf}
!macroend
!define SetHandlersBrowser "!insertmacro SetHandlersBrowser"

!macro SetHandlersMail
  ${GetLongPath} "$INSTDIR\${FileMainEXE}" $8

  StrCpy $0 "SOFTWARE\Classes"
  StrCpy $1 "$\"$8$\" $\"%1$\""
  StrCpy $2 "$\"$8$\" -osint -compose $\"%1$\""

  ; An empty string is used for the 5th param because SeaMonkeyEML is not a
  ; protocol handler
  ${AddHandlerValues} "$0\SeaMonkeyEML"  "$1" "$INSTDIR\chrome\icons\default\misc-file.ico" "${AppRegNameMail} Document" "" ""

  ${AddHandlerValues} "$0\SeaMonkeyCOMPOSE" "$2" "$8,0" "${AppRegNameMail} URL" "true" ""

  ; An empty string is used for the 4th & 5th params because the following
  ; protocol handler already has a display name and additional keys required
  ; for a protocol handler.
  ${AddHandlerValues} "$0\mailto" "$2" "$8,0" "${AppRegNameMail} URL" "true" ""

  ; Associate the file handlers with SeaMonkeyEML
  ReadRegStr $6 HKCR ".eml" ""
  ${If} "$6" != "SeaMonkeyEML"
    WriteRegStr SHCTX "$0\.eml"   "" "SeaMonkeyEML"
  ${EndIf}
!macroend
!define SetHandlersMail "!insertmacro SetHandlersMail"

!macro SetHandlersNews
  ${GetLongPath} "$INSTDIR\${FileMainEXE}" $8
  StrCpy $0 "SOFTWARE\Classes"
  StrCpy $1 "$\"$8$\" -osint -mail $\"%1$\""

  ${AddHandlerValues} "$0\SeaMonkeyNEWS" "$1" "$8,0" "${AppRegNameNews} URL" "true" ""
  ; An empty string is used for the 4th & 5th params because the following
  ; protocol handlers already have a display name and additional keys required
  ; for a protocol handler.
  ${AddHandlerValues} "$0\news"   "$1" "$8,0" "${AppRegNameNews} URL" "true" ""
  ${AddHandlerValues} "$0\nntp"   "$1" "$8,0" "${AppRegNameNews} URL" "true" ""
  ${AddHandlerValues} "$0\snews"  "$1" "$8,0" "${AppRegNameNews} URL" "true" ""
!macroend
!define SetHandlersNews "!insertmacro SetHandlersNews"

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
!macroend
!define SetStartMenuInternet "!insertmacro SetStartMenuInternet"

!macro FixShellIconHandler
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
!define FixShellIconHandler "!insertmacro FixShellIconHandler"

; XXXrstrong - there are several values that will be overwritten by and
; overwrite other installs of the same application.
!macro SetClientsMail
  ${GetLongPath} "$INSTDIR\${FileMainEXE}" $8
  ${GetLongPath} "$INSTDIR\uninstall\helper.exe" $7
  ${GetLongPath} "$INSTDIR\mozMapi32.dll" $6

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

  ClearErrors
  ReadRegDWORD $1 HKLM "$0\InstallInfo" "IconsVisible"
  ; If the IconsVisible name value pair doesn't exist add it otherwise the
  ; application won't be displayed in Set Program Access and Defaults.
  ${If} ${Errors}
    ${If} ${FileExists} "$QUICKLAUNCH\${BrandFullName}.lnk"
      WriteRegDWORD HKLM "$0\InstallInfo" "IconsVisible" 1
    ${Else}
      WriteRegDWORD HKLM "$0\InstallInfo" "IconsVisible" 0
    ${EndIf}
  ${EndIf}

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
!macroend
!define SetClientsMail "!insertmacro SetClientsMail"

; XXXrstrong - there are several values that will be overwritten by and
; overwrite other installs of the same application.
!macro SetClientsNews
  ${GetLongPath} "$INSTDIR\${FileMainEXE}" $8
  ${GetLongPath} "$INSTDIR\uninstall\helper.exe" $7
  ${GetLongPath} "$INSTDIR\mozMapi32.dll" $6
  
  StrCpy $0 "Software\Clients\News\${BrandFullNameInternal}"
  WriteRegStr HKLM "$0" "" "${BrandFullNameInternal}"
  WriteRegStr HKLM "$0\DefaultIcon" "" "$8,0"
  WriteRegStr HKLM "$0" "DLLPath" "$6"

  ; MapiProxy.dll can exist in multiple installs of the application. Registration
  ; occurs as follows with the last action to occur being the one that wins:
  ; On install and software update when helper.exe runs with the /PostUpdate
  ; argument. On setting the application as the system's default application 
  ; using Window's "Set program access and defaults".

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
  StrCpy $1 "$\"$8$\" -osint -mail $\"%1$\""
  ${AddHandlerValues} "$0\Protocols\nntp" "$1" "$8,0" "${AppRegNameNews} URL" "true" ""
  ${AddHandlerValues} "$0\Protocols\news" "$1" "$8,0" "${AppRegNameNews} URL" "true" ""
  ${AddHandlerValues} "$0\Protocols\snews" "$1" "$8,0" "${AppRegNameNews} URL" "true" ""

  ; Vista Registered Application
  WriteRegStr HKLM "Software\RegisteredApplications" "${AppRegNameNews}" "$0\Capabilities"
!macroend
!define SetClientsNews "!insertmacro SetClientsNews"

!macro SetAppKeys
  ${GetLongPath} "$INSTDIR" $8
  StrCpy $0 "Software\Mozilla\${BrandFullNameInternal}\${AppVersion} (${AB_CD})\Main"
  ${WriteRegStr2} $TmpVal "$0" "Install Directory" "$8" 0
  ${WriteRegStr2} $TmpVal "$0" "PathToExe" "$8\${FileMainEXE}" 0

  StrCpy $0 "Software\Mozilla\${BrandFullNameInternal}\${AppVersion} (${AB_CD})\Uninstall"
  ${WriteRegStr2} $TmpVal "$0" "Description" "${BrandFullNameInternal} (${AppVersion})" 0

  StrCpy $0 "Software\Mozilla\${BrandFullNameInternal}\${AppVersion} (${AB_CD})"
  ${WriteRegStr2} $TmpVal  "$0" "" "${AppVersion} (${AB_CD})" 0

  StrCpy $0 "Software\Mozilla\${BrandFullNameInternal} ${AppVersion}\bin"
  ${WriteRegStr2} $TmpVal "$0" "PathToExe" "$8\${FileMainEXE}" 0

  StrCpy $0 "Software\Mozilla\${BrandFullNameInternal} ${AppVersion}\extensions"
  ${WriteRegStr2} $TmpVal "$0" "Components" "$8\components" 0
  ${WriteRegStr2} $TmpVal "$0" "Plugins" "$8\plugins" 0

  StrCpy $0 "Software\Mozilla\${BrandFullNameInternal} ${AppVersion}"
  ${WriteRegStr2} $TmpVal "$0" "GeckoVer" "${GREVersion}" 0

  StrCpy $0 "Software\Mozilla\${BrandFullNameInternal}"
  ${WriteRegStr2} $TmpVal "$0" "" "${GREVersion}" 0
  ${WriteRegStr2} $TmpVal "$0" "CurrentVersion" "${AppVersion} (${AB_CD})" 0
!macroend
!define SetAppKeys "!insertmacro SetAppKeys"

!macro SetUninstallKeys
  StrCpy $0 "Software\Microsoft\Windows\CurrentVersion\Uninstall\${BrandFullNameInternal} (${AppVersion})"
  ${GetLongPath} "$INSTDIR" $8

  ; Write the uninstall registry keys
  ${WriteRegStr2} $TmpVal "$0" "Comments" "${BrandFullNameInternal}" 0
  ${WriteRegStr2} $TmpVal "$0" "DisplayIcon" "$8\${FileMainEXE},0" 0
  ${WriteRegStr2} $TmpVal "$0" "DisplayName" "${BrandFullNameInternal} (${AppVersion})" 0
  ${WriteRegStr2} $TmpVal "$0" "DisplayVersion" "${AppVersion} (${AB_CD})" 0
  ${WriteRegStr2} $TmpVal "$0" "InstallLocation" "$8" 0
  ${WriteRegStr2} $TmpVal "$0" "Publisher" "Mozilla" 0
  ${WriteRegStr2} $TmpVal "$0" "UninstallString" "$8\uninstall\helper.exe" 0
  ${WriteRegStr2} $TmpVal "$0" "URLInfoAbout" "${URLInfoAbout}" 0
  ${WriteRegStr2} $TmpVal "$0" "URLUpdateInfo" "${URLUpdateInfo}" 0
  ${WriteRegDWORD2} $TmpVal "$0" "NoModify" 1 0
  ${WriteRegDWORD2} $TmpVal "$0" "NoRepair" 1 0
!macroend
!define SetUninstallKeys "!insertmacro SetUninstallKeys"

; Updates protocol handlers if their registry open command value is for this
; install location
!macro UpdateProtocolHandlers
  ; Store the command to open the app with an url in a register for easy access.
  ${GetLongPath} "$INSTDIR\${FileMainEXE}" $8
  StrCpy $0 "SOFTWARE\Classes"
  StrCpy $1 "$\"$8$\" -osint -compose $\"%1$\""
  StrCpy $2 "$\"$8$\" -osint -mail $\"%1$\""
  StrCpy $3 "$\"$8$\" -requestPending -osint -url $\"%1$\""
  StrCpy $4 "$\"%1$\",,0,0,,,,"
  StrCpy $5 "$\"$8$\" -url $\"%1$\""

  ; Only set the file and protocol handlers if the existing one under HKCR is
  ; for this install location.
  ${IsHandlerForInstallDir} "SeaMonkeyHTML" $R9
  ${If} "$R9" == "true"
    ; An empty string is used for the 5th param because SeaMonkeyHTML is not a
    ; protocol handler.
    ${AddHandlerValues} "SeaMonkeyHTML" "$5" \
                        "$INSTDIR\chrome\icons\default\html-file.ico" \
                        "${AppRegName} Document" "" ""
  ${EndIf}

  ${IsHandlerForInstallDir} "SeaMonkeyURL" $R9
  ${If} "$R9" == "true"
    ${AddDDEHandlerValues} "SeaMonkeyURL" "$3" "$8,0" "${AppRegName} URL" \
                           "true" "${DDEApplication}" "$4" "WWW_OpenURL"
  ${EndIf}

  ${IsHandlerForInstallDir} "ftp" $R9
  ${If} "$R9" == "true"
    ${AddDDEHandlerValues} "ftp" "$3" "$8,0" "" "" "${DDEApplication}" \
                           "$4" "WWW_OpenURL"
  ${EndIf}

  ${IsHandlerForInstallDir} "http" $R9
  ${If} "$R9" == "true"
    ${AddDDEHandlerValues} "http" "$3" "$8,0" "" "" "${DDEApplication}" \
                           "$4" "WWW_OpenURL"
  ${EndIf}

  ${IsHandlerForInstallDir} "https" $R9
  ${If} "$R9" == "true"
    ${AddDDEHandlerValues} "https" "$3" "$8,0" "" "" "${DDEApplication}" \
                           "$4" "WWW_OpenURL"
  ${EndIf}

  ${IsHandlerForInstallDir} "SeaMonkeyEML" $R9
  ${If} "$R9" == "true"
    ${AddHandlerValues} "SOFTWARE\Classes\SeaMonkeyEML" "$2" \
                        "$INSTDIR\chrome\icons\default\misc-file.ico" \
                        "${AppRegNameMail} Document" "" ""
  ${EndIf}

  ${IsHandlerForInstallDir} "SeaMonkeyMAIL" $R9
  ${If} "$R9" == "true"
    ${AddHandlerValues} "SOFTWARE\Classes\SeaMonkeyMAIL" "$2" "$8,0" \
                        "${AppRegNameMail} URL" "true" ""
  ${EndIf}

  ${IsHandlerForInstallDir} "mailto" $R9
  ${If} "$R9" == "true"
    ${AddHandlerValues} "SOFTWARE\Classes\mailto" "$1" "$8,0" "" "" ""
  ${EndIf}

  ${IsHandlerForInstallDir} "SeaMonkeyNEWS" $R9
  ${If} "$R9" == "true"
    ${AddHandlerValues} "SOFTWARE\Classes\SeaMonkeyNEWS" "$2" "$8,0" \
                        "${AppRegNameMail} URL" "true" ""
  ${EndIf}

  ${IsHandlerForInstallDir} "news" $R9
  ${If} "$R9" == "true"
    ${AddHandlerValues} "SOFTWARE\Classes\news" "$2" "$8,0" "" "" ""
  ${EndIf}

  ${IsHandlerForInstallDir} "snews" $R9
  ${If} "$R9" == "true"
    ${AddHandlerValues} "SOFTWARE\Classes\snews" "$2" "$8,0" "" "" ""
  ${EndIf}

  ${IsHandlerForInstallDir} "nntp" $R9
  ${If} "$R9" == "true"
    ${AddHandlerValues} "SOFTWARE\Classes\nntp" "$2" "$8,0" "" "" ""
  ${EndIf}
!macroend
!define UpdateProtocolHandlers "!insertmacro UpdateProtocolHandlers"

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
  StrCpy $1 "$\"$8$\" -requestPending -osint -url $\"%1$\""
  StrCpy $2 "$\"$8$\" -url $\"%1$\""

  ; Always set the file and protocol handlers since they may specify a
  ; different path and the path is used by Vista when setting associations.
  ${AddHandlerValues} "$0\SeaMonkeyURL" "$1" "$8,0" "${AppRegName} URL" "true" "true"

  ; An empty string is used for the 5th param because SeaMonkeyHTML is not a
  ; protocol handler
  ${AddHandlerValues} "$0\SeaMonkeyHTML" "$2" \
                      "$INSTDIR\chrome\icons\default\html-file.ico" \
                      "${AppRegName} Document" "" ""

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
  ${AddHandlerValues} "$0\SeaMonkeyEML" "$1" "$INSTDIR\chrome\icons\default\misc-file.ico" "${AppRegNameMail} Document" "" ""

  StrCpy $1 "$\"$8$\" -osint -mail $\"%1$\""
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

; Creates the shortcuts log ini file with the appropriate entries if it doesn't
; already exist.
!macro CreateShortcutsLog
  ${GetShortcutsLogPath} $0
  ${Unless} ${FileExists} "$0"
    ; Default to ${BrandFullName} for the Start Menu Folder
    StrCpy $TmpVal "${BrandFullName}"
    ; Prior to Unicode installer the Start Menu directory was written to the
    ; registry and this value can be used to set the Start Menu directory.
    ClearErrors
    ReadRegStr $0 SHCTX "Software\Mozilla\${BrandFullNameInternal}\${AppVersion} (${AB_CD})\Main" "Start Menu Folder"
    ${If} ${Errors}
      ${FindSMProgramsDir} $0
      ${If} "$0" != ""
        StrCpy $TmpVal "$0"
      ${EndIf}
    ${Else}
      StrCpy $TmpVal "$0"
    ${EndUnless}

    ${LogSMProgramsDirRelPath} "$TmpVal"
    ${LogSMProgramsShortcut} "${BrandFullName}.lnk"
    ${LogSMProgramsShortcut} "${BrandFullName} ($(SAFE_MODE)).lnk"
    ${LogSMProgramsShortcut} "${BrandFullNameInternal} $(MAILNEWS_TEXT).lnk"
    ${LogSMProgramsShortcut} "$(PROFILE_TEXT).lnk"
    ${LogQuickLaunchShortcut} "${BrandFullName}.lnk"
    ${LogDesktopShortcut} "${BrandFullName}.lnk"
  ${EndUnless}
!macroend
!define CreateShortcutsLog "!insertmacro CreateShortcutsLog"

; The files to check if they are in use during (un)install so the restart is
; required message is displayed. All files must be located in the $INSTDIR
; directory.
!macro PushFilesToCheck
  ; The first string to be pushed onto the stack MUST be "end" to indicate
  ; that there are no more files to check in $INSTDIR and the last string
  ; should be ${FileMainEXE} so if it is in use the CheckForFilesInUse macro
  ; returns after the first check.
  Push "end"
  Push "AccessibleMarshal.dll"
  Push "freebl3.dll"
  Push "nssckbi.dll"
  Push "nspr4.dll"
  Push "nssdbm3.dll"
  Push "sqlite3.dll"
  Push "xpcom.dll"
  Push "crashreporter.exe"
  Push "updater.exe"
  Push "xpicleanup.exe"
  Push "MapiProxy.dll"
  Push "mozMapi32.dll"
  Push "${FileMainEXE}"
!macroend
!define PushFilesToCheck "!insertmacro PushFilesToCheck"

; The !ifdef NO_LOG prevents warnings when compiling the installer since these
; functions are currently only used by the uninstaller.
!ifdef NO_LOG
Function SetAsDefaultMailAppUser
  SetShellVarContext current  ; Set SHCTX to the current user (e.g. HKCU)
  ${SetHandlersMail}
  ${If} ${AtLeastWinVista}
    ClearErrors
    ReadRegStr $0 HKLM "Software\RegisteredApplications" "${AppRegNameMail}"
    ; Only register as the handler on Vista if the app registry name exists
    ; under the RegisteredApplications registry key.
    ${Unless} ${Errors}
      AppAssocReg::SetAppAsDefaultAll "${AppRegNameMail}"
    ${EndUnless}
  ${EndIf}
FunctionEnd

Function SetAsDefaultNewsAppUser
  SetShellVarContext current  ; Set SHCTX to the current user (e.g. HKCU)
  ${SetHandlersNews}
  ${If} ${AtLeastWinVista}
    ClearErrors
    ReadRegStr $0 HKLM "Software\RegisteredApplications" "${AppRegNameNews}"
    ; Only register as the handler on Vista if the app registry name exists
    ; under the RegisteredApplications registry key.
    ${Unless} ${Errors}
      AppAssocReg::SetAppAsDefaultAll "${AppRegNameNews}"
    ${EndUnless}
  ${EndIf}
FunctionEnd
!endif

