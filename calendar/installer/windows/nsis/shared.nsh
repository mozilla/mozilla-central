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
    ${SetUninstallKeys}
  ${EndIf}

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
  ; This macro must be defined to use UninstallOnInitCommon in commmon.nsh
!macroend
!define SetAsDefaultAppUser "!insertmacro SetAsDefaultAppUser"

!macro SetAsDefaultAppGlobal
  ; This macro must be defined to use UninstallOnInitCommon in commmon.nsh
!macroend
!define SetAsDefaultAppGlobal "!insertmacro SetAsDefaultAppGlobal"

!macro HideShortcuts
  ; This macro must be defined to use UninstallOnInitCommon in commmon.nsh
!macroend
!define HideShortcuts "!insertmacro HideShortcuts"

!macro ShowShortcuts
  ; This macro must be defined to use UninstallOnInitCommon in commmon.nsh
!macroend
!define ShowShortcuts "!insertmacro ShowShortcuts"

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
  Push "${FileMainEXE}"
!macroend
!define PushFilesToCheck "!insertmacro PushFilesToCheck"
