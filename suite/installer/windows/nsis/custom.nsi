# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

!macro checkSuiteComponents
  ; If no extensions are available skip the components page
  ${Unless} ${FileExists} "$EXEDIR\optional\distribution\extensions\{59c81df5-4b7a-477b-912d-4e0fdf64e5f2}.xpi"
  ${AndUnless} ${FileExists} "$EXEDIR\optional\distribution\extensions\inspector@mozilla.org.xpi"
  ${AndUnless} ${FileExists} "$EXEDIR\optional\distribution\extensions\debugQA@mozilla.org.xpi"
  ${AndUnless} ${FileExists} "$EXEDIR\optional\distribution\extensions\{f13b157f-b174-47e7-a34d-4815ddfdfeb8}.xpi"
    Abort
  ${EndUnless}
!macroend

!macro createSuiteComponentsIni
  WriteINIStr "$PLUGINSDIR\components.ini" "Field 1" Type   "label"
  WriteINIStr "$PLUGINSDIR\components.ini" "Field 1" Text   "$(OPTIONAL_COMPONENTS_LABEL)"
  WriteINIStr "$PLUGINSDIR\components.ini" "Field 1" Left   "0"
  WriteINIStr "$PLUGINSDIR\components.ini" "Field 1" Right  "-1"
  WriteINIStr "$PLUGINSDIR\components.ini" "Field 1" Top    "0"
  WriteINIStr "$PLUGINSDIR\components.ini" "Field 1" Bottom "15"

  StrCpy $R1 2
  ; Top of checkbox
  StrCpy $R2 15
  ; Bottom of checkbox
  StrCpy $R3 25
  ; Seperation between titles/text
  StrCpy $R4 25

  ${If} ${FileExists} "$EXEDIR\optional\distribution\extensions\{59c81df5-4b7a-477b-912d-4e0fdf64e5f2}.xpi"
    WriteINIStr "$PLUGINSDIR\components.ini" "Field $R1" Type   "checkbox"
    WriteINIStr "$PLUGINSDIR\components.ini" "Field $R1" Text   "$(CHATZILLA_TITLE)"
    WriteINIStr "$PLUGINSDIR\components.ini" "Field $R1" Left   "15"
    WriteINIStr "$PLUGINSDIR\components.ini" "Field $R1" Right  "-1"
    WriteINIStr "$PLUGINSDIR\components.ini" "Field $R1" Top    "$R2"
    WriteINIStr "$PLUGINSDIR\components.ini" "Field $R1" Bottom "$R3"
    WriteINIStr "$PLUGINSDIR\components.ini" "Field $R1" State  "1"
    WriteINIStr "$PLUGINSDIR\components.ini" "Field $R1" Flags  "GROUP"
    ${GetSize} "$EXEDIR\optional\distribution\extensions\{59c81df5-4b7a-477b-912d-4e0fdf64e5f2}.xpi" "/S=0K" $0 $8 $9
    ${If} ${FileExists} "$EXEDIR\optional\distribution\extensions\langpack-${AB_CD}@chatzilla.mozilla.org.xpi"
      ${GetSize} "$EXEDIR\optional\distribution\extensions\langpack-${AB_CD}@chatzilla.mozilla.org.xpi" "/S=0K" $1 $8 $9
      IntOp $0 $0 + $1
    ${EndIf}
    SectionSetSize ${CZ_IDX} $0
    IntOp $R1 $R1 + 1
    IntOp $R2 $R2 + $R4
    IntOp $R3 $R3 + $R4
  ${Else}
    ; Hide ChatZilla in the components page if it isn't available.
    SectionSetText ${CZ_IDX} ""
  ${EndIf}

  ${If} ${FileExists} "$EXEDIR\optional\distribution\extensions\inspector@mozilla.org.xpi"
    ; Set the details for DOMI
    WriteINIStr "$PLUGINSDIR\components.ini" "Field $R1" Type   "checkbox"
    WriteINIStr "$PLUGINSDIR\components.ini" "Field $R1" Text   "$(DOMI_TITLE)"
    WriteINIStr "$PLUGINSDIR\components.ini" "Field $R1" Left   "15"
    WriteINIStr "$PLUGINSDIR\components.ini" "Field $R1" Right  "-1"
    WriteINIStr "$PLUGINSDIR\components.ini" "Field $R1" Top    "$R2"
    WriteINIStr "$PLUGINSDIR\components.ini" "Field $R1" Bottom "$R3"
    WriteINIStr "$PLUGINSDIR\components.ini" "Field $R1" State  "1"
    WriteINIStr "$PLUGINSDIR\components.ini" "Field $R1" Flags  "GROUP"
    ${GetSize} "$EXEDIR\optional\distribution\extensions\inspector@mozilla.org.xpi" "/S=0K" $0 $8 $9
    SectionSetSize ${DOMI_IDX} $0
    IntOp $R1 $R1 + 1
    IntOp $R2 $R2 + $R4
    IntOp $R3 $R3 + $R4
  ${Else}
    ; Hide DOMi in the components page if it isn't available.
    SectionSetText ${DOMI_IDX} ""
  ${EndIf}

  ${If} ${FileExists} "$EXEDIR\optional\distribution\extensions\debugQA@mozilla.org.xpi"
    WriteINIStr "$PLUGINSDIR\components.ini" "Field $R1" Type   "checkbox"
    WriteINIStr "$PLUGINSDIR\components.ini" "Field $R1" Text   "$(DEBUGQA_TITLE)"
    WriteINIStr "$PLUGINSDIR\components.ini" "Field $R1" Left   "15"
    WriteINIStr "$PLUGINSDIR\components.ini" "Field $R1" Right  "-1"
    WriteINIStr "$PLUGINSDIR\components.ini" "Field $R1" Top    "$R2"
    WriteINIStr "$PLUGINSDIR\components.ini" "Field $R1" Bottom "$R3"
    WriteINIStr "$PLUGINSDIR\components.ini" "Field $R1" State  "1"
    WriteINIStr "$PLUGINSDIR\components.ini" "Field $R1" Flags  "GROUP"
    ${GetSize} "$EXEDIR\optional\distribution\extensions\debugQA@mozilla.org.xpi" "/S=0K" $0 $8 $9
    SectionSetSize ${DEBUG_IDX} $0
    IntOp $R1 $R1 + 1
    IntOp $R2 $R2 + $R4
    IntOp $R3 $R3 + $R4
  ${Else}
    ; Hide debugQA in the components page if it isn't available.
    SectionSetText ${DEBUG_IDX} ""
  ${EndIf}

  ${If} ${FileExists} "$EXEDIR\optional\distribution\extensions\{f13b157f-b174-47e7-a34d-4815ddfdfeb8}.xpi"
    WriteINIStr "$PLUGINSDIR\components.ini" "Field $R1" Type   "checkbox"
    WriteINIStr "$PLUGINSDIR\components.ini" "Field $R1" Text   "$(VENKMAN_TITLE)"
    WriteINIStr "$PLUGINSDIR\components.ini" "Field $R1" Left   "15"
    WriteINIStr "$PLUGINSDIR\components.ini" "Field $R1" Right  "-1"
    WriteINIStr "$PLUGINSDIR\components.ini" "Field $R1" Top    "$R2"
    WriteINIStr "$PLUGINSDIR\components.ini" "Field $R1" Bottom "$R3"
    WriteINIStr "$PLUGINSDIR\components.ini" "Field $R1" State  "1"
    WriteINIStr "$PLUGINSDIR\components.ini" "Field $R1" Flags  "GROUP"
    ${GetSize} "$EXEDIR\optional\distribution\extensions\{f13b157f-b174-47e7-a34d-4815ddfdfeb8}.xpi" "/S=0K" $0 $8 $9
    ${If} ${FileExists} "$EXEDIR\optional\distribution\extensions\langpack-${AB_CD}@venkman.mozilla.org.xpi"
      ${GetSize} "$EXEDIR\optional\distribution\extensions\langpack-${AB_CD}@venkman.mozilla.org.xpi" "/S=0K" $1 $8 $9
      IntOp $0 $0 + $1
    ${EndIf}
    SectionSetSize ${VENKMAN_IDX} $0
    IntOp $R1 $R1 + 1
    IntOp $R2 $R2 + $R4
    IntOp $R3 $R3 + $R4
  ${Else}
    ; Hide Venkman in the components page if it isn't available.
    SectionSetText ${VENKMAN_IDX} ""
  ${EndIf}

  ; Set new values for the top and bottom of labels
  ; Top of label box
  StrCpy $R2 27
  ; Bottom of label box
  StrCpy $R3 47

  ${If} ${FileExists} "$EXEDIR\optional\distribution\extensions\{59c81df5-4b7a-477b-912d-4e0fdf64e5f2}.xpi"
    WriteINIStr "$PLUGINSDIR\components.ini" "Field $R1" Type   "label"
    WriteINIStr "$PLUGINSDIR\components.ini" "Field $R1" Text   "$(CHATZILLA_TEXT)"
    WriteINIStr "$PLUGINSDIR\components.ini" "Field $R1" Left   "30"
    WriteINIStr "$PLUGINSDIR\components.ini" "Field $R1" Right  "-1"
    WriteINIStr "$PLUGINSDIR\components.ini" "Field $R1" Top    "$R2"
    WriteINIStr "$PLUGINSDIR\components.ini" "Field $R1" Bottom "$R3"
    IntOp $R1 $R1 + 1
    IntOp $R2 $R2 + $R4
    IntOp $R3 $R3 + $R4
  ${EndIf}

  ${If} ${FileExists} "$EXEDIR\optional\distribution\extensions\inspector@mozilla.org.xpi"
    WriteINIStr "$PLUGINSDIR\components.ini" "Field $R1" Type   "label"
    WriteINIStr "$PLUGINSDIR\components.ini" "Field $R1" Text   "$(DOMI_TEXT)"
    WriteINIStr "$PLUGINSDIR\components.ini" "Field $R1" Left   "30"
    WriteINIStr "$PLUGINSDIR\components.ini" "Field $R1" Right  "-1"
    WriteINIStr "$PLUGINSDIR\components.ini" "Field $R1" Top    "$R2"
    WriteINIStr "$PLUGINSDIR\components.ini" "Field $R1" Bottom "$R3"
    IntOp $R1 $R1 + 1
    IntOp $R2 $R2 + $R4
    IntOp $R3 $R3 + $R4
  ${EndIf}

  ${If} ${FileExists} "$EXEDIR\optional\distribution\extensions\debugQA@mozilla.org.xpi"
    WriteINIStr "$PLUGINSDIR\components.ini" "Field $R1" Type   "label"
    WriteINIStr "$PLUGINSDIR\components.ini" "Field $R1" Text   "$(DEBUGQA_TEXT)"
    WriteINIStr "$PLUGINSDIR\components.ini" "Field $R1" Left   "30"
    WriteINIStr "$PLUGINSDIR\components.ini" "Field $R1" Right  "-1"
    WriteINIStr "$PLUGINSDIR\components.ini" "Field $R1" Top    "$R2"
    WriteINIStr "$PLUGINSDIR\components.ini" "Field $R1" Bottom "$R3"
    IntOp $R1 $R1 + 1
    IntOp $R2 $R2 + $R4
    IntOp $R3 $R3 + $R4
  ${EndIf}

  ${If} ${FileExists} "$EXEDIR\optional\distribution\extensions\{f13b157f-b174-47e7-a34d-4815ddfdfeb8}.xpi"
    WriteINIStr "$PLUGINSDIR\components.ini" "Field $R1" Type   "label"
    WriteINIStr "$PLUGINSDIR\components.ini" "Field $R1" Text   "$(VENKMAN_TEXT)"
    WriteINIStr "$PLUGINSDIR\components.ini" "Field $R1" Left   "30"
    WriteINIStr "$PLUGINSDIR\components.ini" "Field $R1" Right  "-1"
    WriteINIStr "$PLUGINSDIR\components.ini" "Field $R1" Top    "$R2"
    WriteINIStr "$PLUGINSDIR\components.ini" "Field $R1" Bottom "$R3"
    IntOp $R2 $R2 + $R4
    IntOp $R3 $R3 + $R4
  ${EndIf}

  WriteINIStr "$PLUGINSDIR\components.ini" "Settings" NumFields "$R1"

!macroend
