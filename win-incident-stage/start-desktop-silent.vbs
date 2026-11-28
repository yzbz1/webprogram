Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

rootDir = fso.GetParentFolderName(WScript.ScriptFullName)
portableExe = fso.BuildPath(rootDir, "release\win-incident-stage-portable\IncidentStage.exe")
electronCmd = fso.BuildPath(rootDir, "node_modules\.bin\electron.cmd")

If fso.FileExists(portableExe) Then
  shell.Run """" & portableExe & """", 0, False
ElseIf fso.FileExists(electronCmd) Then
  cmd = "cmd /c cd /d """ & rootDir & """ && """ & electronCmd & """ """ & rootDir & """"
  shell.Run cmd, 0, False
Else
  MsgBox "Cannot find IncidentStage.exe or node_modules\.bin\electron.cmd in: " & rootDir, 16, "Win Incident Stage"
  WScript.Quit 1
End If
