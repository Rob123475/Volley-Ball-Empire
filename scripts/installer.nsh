; electron-builder NSIS include (package.json build.nsis.include).
;
; R-66: the install folder is always named "Beach Volleyball Empire" (${APP_FILENAME}).
;
; electron-builder's assisted installer offers the folder that a previous install
; recorded under HKCU/HKLM "Software\${APP_GUID}" InstallLocation (multiUser.nsh),
; whatever that folder is called. On this machine that value came from test
; installs and from a build made before the rename (R-23), whose folder was
; "...\Volley-Ball-Empire". The installer offered it again, and its directory
; check (instFilesPre) only appends "\Beach Volleyball Empire" underneath, giving
; "...\Volley-Ball-Empire\Beach Volleyball Empire".
;
; The same registry value is also what the OLD version's own uninstaller reads to
; find its folder: un.onInit runs initMultiUser, which sets $INSTDIR from it and
; ignores the _?= folder it was started with (uninstaller.nsh, multiUser.nsh). So
; the value cannot simply be deleted — the first version of this fix did that,
; and the old install's 953 files stayed where they were.
;
; What happens now, when no /D= is given and the remembered folder's own name is
; not ${APP_FILENAME}:
;   customInit           the value is set aside, deleted, and the install mode set
;                        again, so $INSTDIR is the default <Programs>\${APP_FILENAME}.
;                        A silent install puts the value back at once: no page runs
;                        to read it again.
;   the pages            the install-mode page re-reads the registry when it is
;                        left and finds nothing, so the directory page offers the
;                        default.
;   after the directory  an invisible page puts the value back before the install
;   page                 section, where uninstallOldVersion hands it to the old
;                        uninstaller, which then removes its own folder.
;   cancel               .onUserAbort (MUI_CUSTOMFUNCTION_ABORT) puts it back too.
; Not covered: choosing "all users" re-launches the installer elevated, and the
; outer process quits without putting a per-user value back.
;
; Everything that names ${INSTALL_REGISTRY_KEY} sits inside a macro: this file is
; compiled before the templates that define it, and a macro expands where the
; template inserts it.

!ifndef BUILD_UNINSTALLER
  Var R66StaleFolder
  Var R66StaleRoot
  !define MUI_CUSTOMFUNCTION_ABORT R66RestoreLocation
!endif

!macro R66WriteBack
  ${If} $R66StaleFolder != ""
    ${If} $R66StaleRoot == "HKLM"
      WriteRegStr HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation $R66StaleFolder
    ${Else}
      WriteRegStr HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation $R66StaleFolder
    ${EndIf}
    StrCpy $R66StaleFolder ""
  ${EndIf}
!macroend

!macro customInit
  ${StdUtils.GetParameter} $R0 "D" ""
  ${If} $R0 == ""
  ${AndIf} $INSTDIR != ""
    ${GetFileName} $INSTDIR $R1
    ${If} $R1 != "${APP_FILENAME}"
      StrCpy $R66StaleFolder $INSTDIR
      ${If} $installMode == "all"
        StrCpy $R66StaleRoot "HKLM"
        DeleteRegValue HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation
        !insertmacro setInstallModePerAllUsers
      ${Else}
        StrCpy $R66StaleRoot "HKCU"
        DeleteRegValue HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation
        !insertmacro setInstallModePerUser
      ${EndIf}
      ${If} ${Silent}
        !insertmacro R66WriteBack
      ${EndIf}
    ${EndIf}
  ${EndIf}
!macroend

!macro customPageAfterChangeDir
  Function R66RestoreLocation
    !insertmacro R66WriteBack
  FunctionEnd

  Function R66RestoreBeforeInstall
    Call R66RestoreLocation
    Abort
  FunctionEnd

  Page custom R66RestoreBeforeInstall
!macroend
