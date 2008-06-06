; This is an AutoHotKey script, tested using AHK 1.0.47.06
; http://www.autohotkey.com/
SetTitleMatchMode Regex
; 7-Zip
WinWait, 7-Zip.+Setup, &Install, 10
if ErrorLevel
   Exit
WinActivate
Click, 365, 365
WinWait, 7-Zip.+Setup, Finish, 10
if ErrorLevel
   Exit
Click, 365, 365
; Python Setup (silent, just displays a finish screen)
WinWait, Python.+Setup, Finish, 60
if ErrorLevel
   Exit
Click, 350, 400
; MSYS setup (complicated)
WinWait, Minimal SYStem, Welcome, 60
if ErrorLevel
   Exit
WinActivate
Click, 360, 360
WinWait, Minimal SYStem, License, 10
if ErrorLevel
   Exit
Click, 360, 360
WinWait, Minimal SYStem, InfoBefore, 10
if ErrorLevel
   Exit
Click, 360, 360
WinWait, Minimal SYStem, SelectDir, 10
if ErrorLevel
   Exit
Click, 360, 360
WinWait, Minimal SYStem, SelectComponents, 10
if ErrorLevel
   Exit
Click, 360, 360
WinWait, Minimal SYStem, SelectProgramGroup, 10
if ErrorLevel
   Exit
Click, 360, 360
WinWait, Minimal SYStem, Install, 10
if ErrorLevel
   Exit
Click, 360, 360
; Answer no to post-setup
WinWaitActive, ahk_class ConsoleWindowClass, , 60
if ErrorLevel
   Exit
Sleep 500
Send, n{Enter}
Sleep 500
Send, {Enter}
WinWait, Minimal SYStem, Finished, 10
if ErrorLevel
   Exit
Click, 185, 130
Click, 185, 155
Click, 360, 360
; MSYS DTK
WinWait, MSYS Developer Tool Kit, Welcome, 60
if ErrorLevel
   Exit
WinActivate
Click, 360, 360
WinWait, MSYS Developer Tool Kit, License, 10
if ErrorLevel
   Exit
Click, 360, 360
WinWait, MSYS Developer Tool Kit, SelectDir, 10
if ErrorLevel
   Exit
Click, 360, 360
WinWait, MSYS Developer Tool Kit, SelectComponents, 10
if ErrorLevel
   Exit
Click, 360, 360
WinWait, MSYS Developer Tool Kit, Ready, 10
if ErrorLevel
   Exit
Click, 360, 360
WinWait, MSYS Developer Tool Kit, InfoAfter, 60
if ErrorLevel
   Exit
Click, 360, 360
WinWait, MSYS Developer Tool Kit, Finished, 10
if ErrorLevel
   Exit
Click, 360, 360
; XEmacs Setup
WinWait, Setup - XEmacs, Welcome to the XEmacs Setup Wizard, 60
if ErrorLevel
   Exit
WinActivate
Click, 365, 365
WinWait, Setup - XEmacs, Select Destination Location, 10
if ErrorLevel
   Exit
Click, 365, 365
WinWait, Setup - XEmacs, Select Start Menu Folder, 10
if ErrorLevel
   Exit
Click, 365, 365
WinWait, Setup - XEmacs, Select Additional Tasks, 10
if ErrorLevel
   Exit
Click, 365, 365
WinWait, Setup - XEmacs, Ready to Install, 10
if ErrorLevel
   Exit
Click, 365, 365
WinWait, Setup - XEmacs, Information, 60
if ErrorLevel
   Exit
Click, 365, 365
WinWait, Setup - XEmacs, Completing the XEmacs Setup Wizard, 10
if ErrorLevel
   Exit
Click, 187, 164
Click, 365, 365
; Mercurial Setup
WinWait, Setup - Mercurial, Welcome to the Mercurial Setup Wizard, 60
if ErrorLevel
   Exit
WinActivate
Click, 365, 365
WinWait, Setup - Mercurial, License Agreement, 10
if ErrorLevel
   Exit
Click, 50, 305
Click, 365, 365
WinWait, Setup - Mercurial, Select Destination Location, 10
if ErrorLevel
   Exit
Click, 365, 365
WinWait, Setup - Mercurial, Select Start Menu Folder, 10
if ErrorLevel
   Exit
Click, 365, 365
WinWait, Setup - Mercurial, Ready to Install, 10
if ErrorLevel
   Exit
Click, 365, 365
WinWait, Setup - Mercurial, Information, 60
if ErrorLevel
   Exit
Click, 365, 365
WinWait, Setup - Mercurial, Completing the Mercurial Setup Wizard, 10
if ErrorLevel
   Exit
Click, 190, 160
Click, 190, 185
Click, 365, 365
