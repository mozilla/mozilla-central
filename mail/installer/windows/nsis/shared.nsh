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
  ; Remove registry entries for non-existent apps and for apps that point to our
  ; install location in the Software\Mozilla key and uninstall registry entries
  ; that point to our install location for both HKCU and HKLM.
  SetShellVarContext current  ; Set SHCTX to the current user (e.g. HKCU)
  ${RegCleanMain} "Software\Mozilla"
  ${RegCleanUninstall}
  ${UpdateProtocolHandlers}

  ; Upgrade the copies of the MAPI DLL's
  ${UpgradeMapiDLLs}

  ClearErrors
  WriteRegStr HKLM "Software\Mozilla" "${BrandShortName}InstallerTest" "Write Test"
  ${If} ${Errors}
    StrCpy $TmpVal "HKCU" ; used primarily for logging
  ${Else}
    DeleteRegValue HKLM "Software\Mozilla" "${BrandShortName}InstallerTest"
    SetShellVarContext all    ; Set SHCTX to all users (e.g. HKLM)
    StrCpy $TmpVal "HKLM" ; used primarily for logging
    ${RegCleanMain} "Software\Mozilla"
    ${RegCleanUninstall}
    ${UpdateProtocolHandlers}

    ; Only update the Clients\Mail registry key values if they don't exist or
    ; this installation is the same as the one set in those keys.
    ReadRegStr $0 HKLM "Software\Clients\Mail\${ClientsRegName}\DefaultIcon" ""
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
    ReadRegStr $0 HKLM "Software\Clients\News\${ClientsRegName}\DefaultIcon" ""
    ${GetPathFromString} "$0" $0
    ${GetParent} "$0" $0
    ${If} ${FileExists} "$0"
      ${GetLongPath} "$0" $0
    ${EndIf}
    ${If} "$0" == "$INSTDIR"
      ${SetClientsNews}
    ${EndIf}

    ${SetUninstallKeys}
  ${EndIf}

  ${RemoveDeprecatedKeys}

  ; Add Software\Mozilla\ registry entries
  ${SetAppKeys}

  ; Remove files that may be left behind by the application in the
  ; VirtualStore directory.
  ${CleanVirtualStore}

  ; Remove talkback if it is present (remove after bug 386760 is fixed)
  ${If} ${FileExists} "$INSTDIR\extensions\talkback@mozilla.org\"
    RmDir /r "$INSTDIR\extensions\talkback@mozilla.org\"
  ${EndIf}
!macroend
!define PostUpdate "!insertmacro PostUpdate"

!macro SetAsDefaultAppUser
  ; It is only possible to set this installation of the application as the
  ; Start Menu Mail handler if it was added to the HKLM Clients\Mail registry
  ; keys.
  ; http://support.microsoft.com/kb/297878

  ${GetParameters} $R0

  ClearErrors
  ${GetOptions} "$R0" "Mail" $R1
  ${Unless} ${Errors}
    ReadRegStr $0 HKLM "Software\Clients\Mail\${ClientsRegName}\DefaultIcon" ""
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
    WriteRegStr HKCU "Software\Clients\Mail" "" "${ClientsRegName}"
    ClearErrors
    ${GetOptions} "$R0" "/UAC:" $R1
    ${If} ${Errors}
      Call SetAsDefaultMailAppUser
    ${Else}
      GetFunctionAddress $0 SetAsDefaultMailAppUser
      UAC::ExecCodeSegment $0
    ${EndIf}
  ${EndUnless}

  ClearErrors
  ${GetOptions} "$R0" "News" $R1
  ${Unless} ${Errors}
    ReadRegStr $0 HKLM "Software\Clients\News\${ClientsRegName}\DefaultIcon" ""
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
          DeleteRegValue HKLM "Software\Mozilla" "${BrandShortName}InstallerTest"
          Quit
        ${EndUnless}
        ${ElevateUAC}
      ${EndIf}
      DeleteRegValue HKLM "Software\Mozilla" "${BrandShortName}InstallerTest"
      SetShellVarContext all     ; Set SHCTX to all users (e.g. HKLM)
      ${SetClientsNews}
    ${EndIf}
    WriteRegStr HKCU "Software\Clients\News" "" "${ClientsRegName}"
    ClearErrors
    ${GetOptions} "$R0" "/UAC:" $R1
    ${If} ${Errors}
      Call SetAsDefaultNewsAppUser
    ${Else}
      GetFunctionAddress $0 SetAsDefaultNewsAppUser
      UAC::ExecCodeSegment $0
    ${EndIf}
  ${EndUnless}

  ${RemoveDeprecatedKeys}
!macroend
!define SetAsDefaultAppUser "!insertmacro SetAsDefaultAppUser"

!macro SetAsDefaultAppGlobal
  ${RemoveDeprecatedKeys}

  SetShellVarContext all      ; Set SHCTX to all users (e.g. HKLM)
  ${SetHandlersMail}
  ${SetHandlersNews}
  ${SetClientsMail}
  ${SetClientsNews}
  ${ShowShortcuts}
  WriteRegStr HKLM "Software\Clients\Mail" "" "${ClientsRegName}"
!macroend
!define SetAsDefaultAppGlobal "!insertmacro SetAsDefaultAppGlobal"

!macro HideShortcuts
  StrCpy $R1 "Software\Clients\Mail\${ClientsRegName}\InstallInfo"
  WriteRegDWORD HKLM "$R1" "IconsVisible" 0
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
  StrCpy $R1 "Software\Clients\Mail\${ClientsRegName}\InstallInfo"
  WriteRegDWORD HKLM "$R1" "IconsVisible" 1
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

!macro SetHandlersMail
  ${GetLongPath} "$INSTDIR\${FileMainEXE}" $8
  StrCpy $0 "SOFTWARE\Classes"
  StrCpy $1 "$\"$8$\" $\"%1$\""
  StrCpy $2 "$\"$8$\" -osint -compose $\"%1$\""

  ; An empty string is used for the 5th param because ThunderbirdEML is not a
  ; protocol handler
  ${AddHandlerValues} "$0\ThunderbirdEML"  "$1" "$8,0" \
                      "${AppRegNameMail} Document" "" ""
  ${AddHandlerValues} "$0\Thunderbird.Url.mailto"  "$2" "$8,0" "${AppRegNameMail} URL" "true" ""
  ${AddHandlerValues} "$0\mailto" "$2" "$8,0" "${AppRegNameMail} URL" "true" ""

  ; Associate the file handlers with ThunderbirdEML
  ReadRegStr $6 HKCR ".eml" ""
  ${If} "$6" != "ThunderbirdEML"
    WriteRegStr SHCTX "$0\.eml"   "" "ThunderbirdEML"
  ${EndIf}
!macroend
!define SetHandlersMail "!insertmacro SetHandlersMail"

!macro SetHandlersNews
  ${GetLongPath} "$INSTDIR\${FileMainEXE}" $8
  StrCpy $0 "SOFTWARE\Classes"
  StrCpy $1 "$\"$8$\" -osint -mail $\"%1$\""

  ${AddHandlerValues} "$0\Thunderbird.Url.news" "$1" "$8,0" \
                      "${AppRegNameNews} URL" "true" ""
  ${AddHandlerValues} "$0\news"   "$1" "$8,0" "${AppRegNameNews} URL" "true" ""
  ${AddHandlerValues} "$0\nntp"   "$1" "$8,0" "${AppRegNameNews} URL" "true" ""
  ${AddHandlerValues} "$0\snews"  "$1" "$8,0" "${AppRegNameNews} URL" "true" ""
!macroend
!define SetHandlersNews "!insertmacro SetHandlersNews"

; XXXrstrong - there are several values that will be overwritten by and
; overwrite other installs of the same application.
!macro SetClientsMail
  ${GetLongPath} "$INSTDIR\${FileMainEXE}" $8
  ${GetLongPath} "$INSTDIR\uninstall\helper.exe" $7
  ${GetLongPath} "$INSTDIR\mozMapi32_InUse.dll" $6

  StrCpy $0 "Software\Clients\Mail\${ClientsRegName}"

  WriteRegStr HKLM "$0" "" "${ClientsRegName}"
  WriteRegStr HKLM "$0\DefaultIcon" "" "$8,0"
  WriteRegStr HKLM "$0" "DLLPath" "$6"

  ; The MapiProxy dll can exist in multiple installs of the application.
  ; Registration occurs as follows with the last action to occur being the one
  ; that wins:
  ; On install and software update when helper.exe runs with the /PostUpdate
  ; argument. On setting the application as the system's default application 
  ; using Window's "Set program access and defaults".

  !ifndef NO_LOG
    ${LogHeader} "DLL Registration"
  !endif
  ClearErrors
  RegDLL "$INSTDIR\MapiProxy_InUse.dll"
  !ifndef NO_LOG  
    ${If} ${Errors}
      ${LogMsg} "** ERROR Registering: $INSTDIR\MapiProxy_InUse.dll **"
    ${Else}
      ${LogUninstall} "DLLReg: \MapiProxy_InUse.dll"
      ${LogMsg} "Registered: $INSTDIR\MapiProxy_InUse.dll"
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
  ; If the IconsVisible name vale pair doesn't exist add it otherwise the
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
  StrCpy $1 "$\"$8$\" -osint -compose $\"%1$\""
  ${AddHandlerValues} "$0\Protocols\mailto" "$1" "$8,0" "${AppRegNameMail} URL" "true" ""
 
  ; Vista Capabilities registry keys
  WriteRegStr HKLM "$0\Capabilities" "ApplicationDescription" "$(REG_APP_DESC)"
  WriteRegStr HKLM "$0\Capabilities" "ApplicationIcon" "$8,0"
  WriteRegStr HKLM "$0\Capabilities" "ApplicationName" "${AppRegNameMail}"
  WriteRegStr HKLM "$0\Capabilities\FileAssociations" ".eml"   "ThunderbirdEML"
  WriteRegStr HKLM "$0\Capabilities\FileAssociations" ".wdseml" "ThunderbirdEML"
  WriteRegStr HKLM "$0\Capabilities\StartMenu" "Mail" "${ClientsRegName}"
  WriteRegStr HKLM "$0\Capabilities\URLAssociations" "mailto" "Thunderbird.Url.mailto"

  ; Vista Registered Application
  WriteRegStr HKLM "Software\RegisteredApplications" "${AppRegNameMail}" "$0\Capabilities"
!macroend
!define SetClientsMail "!insertmacro SetClientsMail"

; XXXrstrong - there are several values that will be overwritten by and
; overwrite other installs of the same application.
!macro SetClientsNews
  ${GetLongPath} "$INSTDIR\${FileMainEXE}" $8
  ${GetLongPath} "$INSTDIR\uninstall\helper.exe" $7
  ${GetLongPath} "$INSTDIR\mozMapi32_InUse.dll" $6

  StrCpy $0 "Software\Clients\News\${ClientsRegName}"

  WriteRegStr HKLM "$0" "" "${ClientsRegName}"
  WriteRegStr HKLM "$0\DefaultIcon" "" "$8,0"
  WriteRegStr HKLM "$0" "DLLPath" "$6"

  ; The MapiProxy dll can exist in multiple installs of the application.
  ; Registration occurs as follows with the last action to occur being the one
  ; that wins:
  ; On install and software update when helper.exe runs with the /PostUpdate
  ; argument. On setting the application as the system's default application 
  ; using Window's "Set program access and defaults".

  !ifndef NO_LOG
    ${LogHeader} "DLL Registration"
  !endif
  ClearErrors
  RegDLL "$INSTDIR\MapiProxy_InUse.dll"
  !ifndef NO_LOG  
    ${If} ${Errors}
      ${LogMsg} "** ERROR Registering: $INSTDIR\MapiProxy_InUse.dll **"
    ${Else}
      ${LogUninstall} "DLLReg: \MapiProxy_InUse.dll"
      ${LogMsg} "Registered: $INSTDIR\MapiProxy_InUse.dll"
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
  WriteRegStr HKLM "$0\Capabilities\URLAssociations" "nntp" "Thunderbird.Url.news"
  WriteRegStr HKLM "$0\Capabilities\URLAssociations" "news" "Thunderbird.Url.news"
  WriteRegStr HKLM "$0\Capabilities\URLAssociations" "snews" "Thunderbird.Url.news"

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
  ${WriteRegStr2} $TmpVal "$0" "Program Folder Path" "$SMPROGRAMS\$StartMenuDir" 0

  SetShellVarContext all  ; Set $DESKTOP to All Users
  ${Unless} ${FileExists} "$DESKTOP\${BrandFullName}.lnk"
    SetShellVarContext current  ; Set $DESKTOP to the current user's desktop
  ${EndUnless}

  ${If} ${FileExists} "$DESKTOP\${BrandFullName}.lnk"
    ShellLink::GetShortCutArgs "$DESKTOP\${BrandFullName}.lnk"
    Pop $1
    ${If} "$1" == ""
      ShellLink::GetShortCutTarget "$DESKTOP\${BrandFullName}.lnk"
      Pop $1
      ${GetLongPath} "$1" $1
      ${If} "$1" == "$8\${FileMainEXE}"
        ${WriteRegDWORD2} $TmpVal "$0" "Create Desktop Shortcut" 1 0
      ${Else}
        ${WriteRegDWORD2} $TmpVal "$0" "Create Desktop Shortcut" 0 0
      ${EndIf}
    ${EndIf}
  ${EndIf}

  ; XXXrstrong - need a cleaner way to prevent unsetting SHCTX from HKLM when
  ; trying to find the desktop shortcut.
  ${If} "$TmpVal" == "HKCU"
    SetShellVarContext current ; Set SHCTX to the current user (e.g. HKCU)
  ${Else}
    SetShellVarContext all     ; Set SHCTX to all users (e.g. HKLM)
  ${EndIf}

  ${If} ${FileExists} "$QUICKLAUNCH\${BrandFullName}.lnk"
    ShellLink::GetShortCutArgs "$QUICKLAUNCH\${BrandFullName}.lnk"
    Pop $1
    ${If} "$1" == ""
      ShellLink::GetShortCutTarget "$QUICKLAUNCH\${BrandFullName}.lnk"
      Pop $1
      ${GetLongPath} "$1" $1
      ${If} "$1" == "$8\${FileMainEXE}"
        ${WriteRegDWORD2} $TmpVal "$0" "Create Quick Launch Shortcut" 1 0
      ${Else}
        ${WriteRegDWORD2} $TmpVal "$0" "Create Quick Launch Shortcut" 0 0
      ${EndIf}
    ${EndIf}
  ${EndIf}
  ; XXXrstrong - "Create Start Menu Shortcut" and "Start Menu Folder" are only
  ; set in the installer and should also be set here for software update.

  StrCpy $0 "Software\Mozilla\${BrandFullNameInternal}\${AppVersion} (${AB_CD})\Uninstall"
  ${WriteRegStr2} $TmpVal "$0" "Uninstall Log Folder" "$8\uninstall" 0
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
  StrCpy $3 "$\"$8$\" $\"%1$\""

  ; Only set the file and protocol handlers if the existing one under HKCR is
  ; for this install location.
  ${IsHandlerForInstallDir} "ThunderbirdEML" $R9
  ${If} "$R9" == "true"
    ${AddHandlerValues} "SOFTWARE\Classes\ThunderbirdEML" "$3" "$8,0" \
                        "${AppRegNameMail} Document" "" ""
  ${EndIf}

  ${IsHandlerForInstallDir} "Thunderbird.Url.mailto" $R9
  ${If} "$R9" == "true"
    ${AddHandlerValues} "SOFTWARE\Classes\Thunderbird.Url.mailto" "$1" "$8,0" \
                        "${AppRegNameMail} URL" "true" ""
  ${EndIf}

  ${IsHandlerForInstallDir} "mailto" $R9
  ${If} "$R9" == "true"
    ${AddHandlerValues} "SOFTWARE\Classes\mailto" "$1" "$8,0" "" "" ""
  ${EndIf}

  ${IsHandlerForInstallDir} "Thunderbird.Url.news" $R9
  ${If} "$R9" == "true"
    ${AddHandlerValues} "SOFTWARE\Classes\Thunderbird.Url.news" "$2" "$8,0" \
                        "${AppRegNameNews} URL" "true" ""
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

!macro RemoveDeprecatedKeys
  StrCpy $0 "SOFTWARE\Classes"

  ; remove DI and SOC from the .eml class if it exists and contains
  ; thunderbird.exe
  ClearErrors
  ReadRegStr $1 HKLM "$0\.eml\shell\open\command" ""
  ${WordFind} "$1" "${FileMainEXE}" "E+1{" $R1
  ${Unless} ${Errors}
    DeleteRegKey HKLM "$0\.eml\shell\open\command"
  ${EndUnless}

  ClearErrors
  ReadRegStr $1 HKCU "$0\.eml\shell\open\command" ""
  ${WordFind} "$1" "${FileMainEXE}" "E+1{" $R1
  ${Unless} ${Errors}
    DeleteRegKey HKCU "$0\.eml\shell\open\command"
  ${EndUnless}

  ClearErrors
  ReadRegStr $1 HKLM "$0\.eml\DefaultIcon" ""
  ${WordFind} "$1" "${FileMainEXE}" "E+1{" $R1
  ${Unless} ${Errors}
    DeleteRegKey HKLM "$0\.eml\DefaultIcon"
  ${EndUnless}

  ClearErrors
  ReadRegStr $1 HKCU "$0\.eml\DefaultIcon" ""
  ${WordFind} "$1" "${FileMainEXE}" "E+1{" $R1
  ${Unless} ${Errors}
    DeleteRegKey HKCU "$0\.eml\DefaultIcon"
  ${EndUnless}

  ; Remove the Shredder clients key if its default icon contains thunderbird.exe
  ClearErrors
  ReadRegStr $1 HKLM "SOFTWARE\clients\mail\Shredder\DefaultIcon" ""
  ${WordFind} "$1" "${FileMainEXE}" "E+1{" $R1
  ${Unless} ${Errors}
    DeleteRegKey HKLM "SOFTWARE\clients\mail\Shredder"
  ${EndUnless}

  ClearErrors
  ReadRegStr $1 HKLM "SOFTWARE\clients\news\Shredder\DefaultIcon" ""
  ${WordFind} "$1" "${FileMainEXE}" "E+1{" $R1
  ${Unless} ${Errors}
    DeleteRegKey HKLM "SOFTWARE\clients\news\Shredder"
  ${EndUnless}

  ; The Vista shim for 1.5.0.10 writes out a set of bogus keys which we need to
  ; cleanup. Intentionally hard coding Mozilla Thunderbird here
  ; as this is the string used by the vista shim.
  DeleteRegKey HKLM "$0\Mozilla Thunderbird.Url.mailto"
  DeleteRegValue HKLM "Software\RegisteredApplications" "Mozilla Thunderbird"
!macroend
!define RemoveDeprecatedKeys "!insertmacro RemoveDeprecatedKeys"

; The MAPI DLL's are copied and the copies are used for the MAPI registration
; to lessen file in use errors on application update.
!macro UpgradeMapiDLLs
  ClearErrors
  ${DeleteFile} "$INSTDIR\MapiProxy_InUse.dll"
  ${If} ${Errors}
    ${DeleteFile} "$INSTDIR\MapiProxy_InUse.dll.moz-delete" ; shouldn't exist
    Rename "$INSTDIR\MapiProxy_InUse.dll" "$INSTDIR\MapiProxy_InUse.dll.moz-delete"
    Delete /REBOOTOK "$INSTDIR\MapiProxy_InUse.dll.moz-delete"
  ${EndIf}
  CopyFiles /SILENT "$INSTDIR\MapiProxy.dll" "$INSTDIR\MapiProxy_InUse.dll"

  ClearErrors
  ${DeleteFile} "$INSTDIR\mozMapi32_InUse.dll"
  ${If} ${Errors}
    ${DeleteFile} "$INSTDIR\mozMapi32_InUse.dll.moz-delete" ; shouldn't exist
    Rename "$INSTDIR\mozMapi32_InUse.dll" "$INSTDIR\mozMapi32_InUse.dll.moz-delete"
    Delete /REBOOTOK "$INSTDIR\mozMapi32_InUse.dll.moz-delete"
  ${EndIf}
  CopyFiles /SILENT "$INSTDIR\mozMapi32.dll" "$INSTDIR\mozMapi32_InUse.dll"
!macroend
!define UpgradeMapiDLLs "!insertmacro UpgradeMapiDLLs"

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
  Push "MapiProxy_InUse.dll"
  Push "mozMapi32.dll"
  Push "mozMapi32_InUse.dll"
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
